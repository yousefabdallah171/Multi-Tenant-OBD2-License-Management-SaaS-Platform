# Super Admin Transaction Edit Feature — Full Plan

**Created:** 2026-05-14
**Status:** Planning
**Complexity:** High (impacts financial reporting across all roles)

---

## Overview

Allow Super Admin to **edit historical transactions** (sales/activations) on the Reseller Payments page with full audit trail. Edits must immediately cascade to:
- **Reseller reports** (revenue totals update)
- **Manager reports** (commission calculations recalculate)
- **Manager Parent reports** (tenant-wide revenue updates)
- **Tenant revenue** (super admin dashboard)
- **User balances** (`UserBalance` table totals)

---

## Financial Data Model

### Current Flow (Read-only)

1. **License created** → stored in `licenses` table with `price`, `activated_at`, `customer_id`, `reseller_id`
2. **Activity log entry created** → `activity_logs` with action=`'license.activated'` + metadata containing `price`, `license_id`, `customer_id`, `program_id`, `bios_id`, etc.
3. **Revenue reported**:
   - Reports query `activity_logs` where action in `['license.activated', 'license.renewed', 'license.scheduled_activation_executed']`
   - Sum `metadata->price` grouped by reseller/program/tenant/period
   - Cache for 90 seconds (varies by endpoint)
4. **Reseller balances** → `UserBalance.total_revenue` and `pending_balance` updated via `BalanceService::recordRevenue()`

### Key Insight

**Revenue is calculated FROM activity logs, NOT from the license table directly.** The license price is stored both:
- In the `License.price` column (for reference)
- In the `ActivityLog.metadata.price` (for reporting)

**Therefore, to edit a transaction, we must:**
1. Update the `License` record (price, customer, dates, etc.)
2. Update the corresponding `ActivityLog` entry (metadata)
3. Invalidate all report caches
4. Recalculate `UserBalance` totals affected by the change
5. Audit the change (new audit table)

---

## Architecture

### New Table: transaction_edits (audit log)

```php
Schema::create('transaction_edits', function (Blueprint $table): void {
    $table->id();
    $table->unsignedBigInteger('license_id');
    $table->unsignedBigInteger('activity_log_id')->nullable();
    $table->unsignedBigInteger('tenant_id');
    $table->unsignedBigInteger('super_admin_id'); // who made the edit
    $table->string('action', 50); // 'edit', 'revert'
    $table->json('previous_values'); // snapshot before edit
    $table->json('new_values'); // what changed
    $table->text('reason')->nullable(); // why?
    $table->timestamp('created_at');
    
    $table->foreign('license_id')->references('id')->on('licenses');
    $table->foreign('activity_log_id')->references('id')->on('activity_logs')->nullableOnDelete();
    $table->foreign('tenant_id')->references('id')->on('tenants');
    $table->foreign('super_admin_id')->references('id')->on('users');
    $table->index(['tenant_id', 'created_at']);
});
```

### Editable Fields

Super Admin can edit a transaction's:
1. **Price** (`license.price` + `activity_log.metadata.price`)
2. **Activation date** (`license.activated_at` + `activity_log.created_at`)
3. **Customer** (`license.customer_id` + `activity_log.metadata.customer_id`)
4. **Duration days** (`license.duration_days` + `activity_log.metadata.duration_days`)
5. **Program** (`license.program_id` + `activity_log.metadata.program_id`)
6. **Reason for edit** (audit trail)

Cannot edit:
- Reseller (already activated — don't want to credit wrong person)
- BIOS ID (would break BIOS linkage)
- Status (handled separately by deactivate/cancel flows)

---

## Implementation Blocks

### Block 1 — Database Migration

Create migration `2026_05_14_100000_create_transaction_edits_table.php`

---

### Block 2 — Backend API Endpoints

#### GET /api/super-admin/transactions/{license}/editable

Return transaction details + edit history:
```json
{
  "data": {
    "transaction": {
      "license_id": 12345,
      "activity_log_id": 67890,
      "tenant_id": 1,
      "reseller_id": 15,
      "reseller_name": "Ahmed",
      "customer_id": 42,
      "customer_name": "John Auto Repair",
      "bios_id": "HWID-123",
      "program_id": 8,
      "program_name": "Topix",
      "price": 70.00,
      "duration_days": 365,
      "activated_at": "2026-04-15T10:30:00Z",
      "expires_at": "2027-04-15T10:30:00Z",
      "status": "active"
    },
    "edit_history": [
      {
        "id": 1,
        "super_admin_name": "Admin User",
        "action": "edit",
        "previous_values": { "price": 60.00 },
        "new_values": { "price": 70.00 },
        "reason": "Customer paid additional amount",
        "created_at": "2026-05-14T08:00:00Z"
      }
    ]
  }
}
```

#### PATCH /api/super-admin/transactions/{license}

Edit a transaction:

```json
Request:
{
  "price": 75.00,
  "customer_id": 43,
  "activated_at": "2026-04-20",
  "duration_days": 730,
  "program_id": 9,
  "reason": "Customer upgraded from 1yr to 2yr license"
}

Response:
{
  "data": { ... updated transaction ... },
  "message": "Transaction edited successfully.",
  "affected": {
    "licenses_updated": 1,
    "activity_logs_updated": 1,
    "caches_invalidated": 5,
    "balances_recalculated": ["reseller:15", "manager_parent:1"]
  }
}
```

#### POST /api/super-admin/transactions/{license}/revert

Revert to previous transaction state. Creates a new edit record (not a delete):

```json
Request:
{ "reason": "Mistake — revert to previous correct values" }

Response:
{
  "data": { ... reverted transaction ... },
  "message": "Transaction reverted successfully."
}
```

---

### Block 3 — Backend Service: TransactionEditService

New file: `backend/app/Services/TransactionEditService.php`

```php
class TransactionEditService
{
    public function editTransaction(
        License $license,
        array $newValues,
        User $superAdmin,
        string $reason = null
    ): array {
        // 1. Validate new values
        // 2. Snapshot previous values
        // 3. Update License record
        // 4. Find & update ActivityLog entry (if exists)
        // 5. Create TransactionEdit audit record
        // 6. Invalidate affected report caches
        // 7. Recalculate UserBalance for affected resellers
        // 8. Log activity to ActivityLog
        // 9. Return affected entities
    }

    public function revertTransaction(
        License $license,
        User $superAdmin,
        string $reason = null
    ): array {
        // Find most recent edit, restore previous values, create revert record
    }

    public function getTransactionHistory(License $license): Collection
    {
        // Return all edits for this license with human-readable diffs
    }

    private function invalidateCaches(License $license): array
    {
        // Invalidate:
        // - Super Admin financial reports
        // - Super Admin reseller payments
        // - Manager Parent reports
        // - Manager reports
        // - Reseller reports
        // Return list of cache keys invalidated
    }

    private function recalculateBalances(License $license): array
    {
        // Recalculate UserBalance for:
        // - Reseller (license.reseller_id)
        // - Manager (reseller.created_by if manager role)
        // - Manager Parent (manager.created_by if exists)
        // Return list of users affected
    }
}
```

---

### Block 4 — Backend Controller Endpoint

New file: `backend/app/Http/Controllers/SuperAdmin/TransactionEditController.php`

```php
class TransactionEditController extends BaseSuperAdminController
{
    public function __construct(
        private readonly TransactionEditService $editService
    ) {}

    public function show(License $license): JsonResponse
    {
        $transaction = $this->resolveLicense($license);
        // Return transaction + edit history
    }

    public function update(Request $request, License $license): JsonResponse
    {
        $transaction = $this->resolveLicense($license);
        $validated = $request->validate([
            'price' => ['nullable', 'numeric', 'min:0'],
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            'activated_at' => ['nullable', 'date'],
            'duration_days' => ['nullable', 'numeric', 'min:0'],
            'program_id' => ['nullable', 'integer', 'exists:programs,id'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        // At least one field must change
        $changeCount = count(array_filter($validated, fn($v) => $v !== null));
        abort_unless($changeCount > 0, 422, 'No fields to update.');

        $result = $this->editService->editTransaction(
            $transaction,
            $validated,
            $request->user(),
            $validated['reason'] ?? null,
        );

        return response()->json([
            'data' => $result['transaction'],
            'message' => 'Transaction edited successfully.',
            'affected' => $result['affected'],
        ]);
    }

    public function revert(Request $request, License $license): JsonResponse
    {
        $transaction = $this->resolveLicense($license);
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $result = $this->editService->revertTransaction(
            $transaction,
            $request->user(),
            $validated['reason'] ?? null,
        );

        return response()->json([
            'data' => $result['transaction'],
            'message' => 'Transaction reverted successfully.',
        ]);
    }

    public function history(License $license): JsonResponse
    {
        $transaction = $this->resolveLicense($license);
        $edits = $this->editService->getTransactionHistory($transaction);

        return response()->json(['data' => $edits]);
    }

    private function resolveLicense(License $license): License
    {
        $license->loadMissing('tenant', 'reseller:id,name,role,created_by', 'customer:id,name,email', 'program:id,name');
        return $license;
    }
}
```

---

### Block 5 — Frontend: Edit Modal/Page

**Location:** `frontend/src/pages/super-admin/TransactionEditModal.tsx` or inline in ResellerPayments

Features:
- Pre-fill current values
- Show edit history drawer
- Confirm before applying
- Show cascade impact ("This will update X reseller reports, Y manager reports")
- Optional reason field

---

### Block 6 — Frontend: Integration in Reseller Payments Page

Add "Edit" button to each transaction row in the super-admin customers table:
- Button only appears for Super Admin
- Opens modal/drawer with TransactionEditForm
- After save, refresh customer transaction list

---

### Block 7 — Routes

**Backend:** `routes/api.php`

```php
Route::middleware('role:super_admin')->group(function () {
    Route::get('/transactions/{license}/editable', [TransactionEditController::class, 'show']);
    Route::patch('/transactions/{license}', [TransactionEditController::class, 'update']);
    Route::post('/transactions/{license}/revert', [TransactionEditController::class, 'revert']);
    Route::get('/transactions/{license}/history', [TransactionEditController::class, 'history']);
});
```

---

## Testing Checklist

- [ ] Edit price → reseller revenue updates
- [ ] Edit price → manager report recalculates commission
- [ ] Edit price → manager parent revenue updates
- [ ] Edit price → tenant revenue updates in super admin dashboard
- [ ] Edit customer → transaction shows new customer name
- [ ] Edit activated_at → transaction moves to different month/period in reports
- [ ] Edit program_id → revenue moves to different program in program reports
- [ ] Edit duration_days → presets update if duration no longer matches preset
- [ ] Two concurrent edits on same license → last write wins (or second fails with conflict)
- [ ] Revert transaction → all changes roll back
- [ ] Edit history → all edits appear with diffs
- [ ] Audit log → ActivityLog entry created for each edit
- [ ] Caches invalidated → next report query uses fresh data (not stale cached data)
- [ ] Balance recalculation → UserBalance totals correct after edit
- [ ] Authorization → only super_admin can edit
- [ ] Validation → invalid program_id rejects
- [ ] Validation → customer_id must belong to same tenant
- [ ] Validation → at least one field must change
- [ ] Non-editable fields → BIOS ID, reseller, status cannot be edited

---

## Security Considerations

- **Authorization:** Only `super_admin` role can edit
- **Tenant isolation:** Cannot edit transactions across tenants
- **Customer validation:** Cannot change customer_id to a customer from different tenant
- **Program validation:** Cannot change program_id to a program from different tenant
- **Audit trail:** Every edit logged with who, when, before/after values, and reason
- **Balance integrity:** Recalculate balances to prevent stale data

---

## Impact Map

### When a Transaction is Edited

| Component | Impact | Action |
|---|---|---|
| `License.price` | Direct field | Update |
| `ActivityLog` (activation entry) | metadata.price | Update |
| `UserBalance` (reseller) | total_revenue, pending_balance | Recalculate |
| `UserBalance` (manager, if any) | total_revenue | Recalculate |
| `UserBalance` (manager_parent, if any) | total_revenue | Recalculate |
| `RevenueAnalytics` cache | All report endpoints | Invalidate |
| `FinancialReportController` cache (super admin) | Dashboard + reports | Invalidate |
| `FinancialReportController` cache (manager parent) | Dashboard + reports | Invalidate |
| `FinancialReportController` cache (manager) | Dashboard + reports | Invalidate |
| `ResellerPaymentController` cache | Payments page (if applicable) | Invalidate |
| `ActivityLog` (edit event) | History + audit | Create new entry |
| `TransactionEdits` table | Audit trail | Create record |

---

## Phased Delivery (Optional)

### Phase 1 — Basic Edit (MVP)
- Edit price only
- Single endpoint: PATCH /transactions/{license}
- No revert endpoint
- Minimal UI (inline edit or simple modal)

### Phase 2 — Full Edit
- Edit all fields (customer, activated_at, duration, program)
- Revert endpoint
- Edit history drawer
- Full cascade (balances + caches)

### Phase 3 — Audit & Analytics
- Audit dashboard showing all edits by user
- Transaction diff visualization
- Bulk transaction edit (spreadsheet import)

---

## Database Changes Summary

| Table | Changes |
|---|---|
| `licenses` | No schema change — only data updates |
| `activity_logs` | No schema change — only metadata updates |
| `user_balances` | No schema change — only data recalculation |
| `transaction_edits` | **New table** for audit trail |

---

## Known Limitations & Decisions

1. **Cannot edit BIOS ID** → would break BIOS usage tracking and potentially affect other licenses with same BIOS
2. **Cannot change reseller** → would credit wrong person; requires manual deactivate + reactivate if needed
3. **Cannot edit cancelled licenses** → should be approved via BIOS change request workflow instead
4. **Edits are not reversible via UI undo** → must use "Revert" endpoint which creates a new edit record
5. **Concurrent edit conflicts** → database update wins, second edit fails with conflict message
6. **Edit timestamps** → transaction edit timestamps are new, original `License.activated_at` is overwritten

---

## Files to Create/Modify

### Create
- `backend/database/migrations/2026_05_14_100000_create_transaction_edits_table.php`
- `backend/app/Models/TransactionEdit.php`
- `backend/app/Services/TransactionEditService.php`
- `backend/app/Http/Controllers/SuperAdmin/TransactionEditController.php`
- `frontend/src/pages/super-admin/TransactionEditModal.tsx` (or component)

### Modify
- `backend/routes/api.php` (add transaction edit routes)
- `frontend/src/pages/super-admin/ResellerPayments.tsx` (add edit button)
- `frontend/src/pages/super-admin/SalesCustomers.tsx` (add edit button to transaction rows)

---
