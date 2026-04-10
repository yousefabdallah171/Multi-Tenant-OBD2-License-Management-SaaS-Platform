# Manager Role Changes — Full Implementation Plan

Status update as of 2026-04-09:
- This plan has been implemented
- Final verification is tracked in `docs/manager-role-changes-manual-qa-checklist.md`
- Release and deployment notes are tracked in `docs/manager-role-changes-release-notes.md`

Everything discussed across all sessions, fully documented.

---

## Table of Contents

1. [Team Network Diagram — Bug Fixes](#team-network-diagram-bug-fixes) (post-build issues)
2. [Block 1 — Remove Manager Software Management](#block-1--remove-manager-software-management)
3. [Block 2 — Fix Manager Activation Form](#block-2--fix-manager-activation-form)
4. [Block 3 — Security & Data Leak Fixes](#block-3--security--data-leak-fixes)
5. [Block 4 — Super Admin Reseller Assignment](#block-4--super-admin-reseller-assignment)
6. [Block 5 — Granted Value Bug (Super Admin Reports)](#block-5--granted-value-bug-super-admin-reports)
7. [Block 6 — Frontend Scope Audit](#block-6--frontend-scope-audit)

---

## Security Analysis — Full Backend Audit Results

A complete audit of all Manager role controllers was performed before writing this plan.

### CONFIRMED CORRECT (no changes needed to these)

| Component | Why it is safe |
|---|---|
| `teamResellersQuery()` | 3-way filter: `tenant_id + role=reseller + created_by=manager.id` |
| `resolveTeamReseller()` | `abort_unless`: tenant + reseller role + `created_by = manager.id` |
| `resolveTeamLicense()` | Checks `reseller_id` is inside `teamSellerIds()` |
| `TeamController` index | Uses `teamResellersQuery()` — only manager's own resellers |
| `TeamController` CRUD | All mutations go through `resolveTeamReseller()` |
| `ResellerPaymentController` | Uses `resolveTeamReseller()` + `resolvePayment()` + `resolveCommission()` |
| `ResellerLogController` | Has `tenant_id` + scoped `teamSellerIds()` |
| `LicenseController` | All queries scoped via `teamSellerIds()` |
| `ReportController` | Uses `teamSellerIds()` for all base queries |

**Manager already only sees resellers where `created_by = manager.id`.** No list-level data leaks exist. The bugs below are different issues.

### BUGS FOUND — All Fixed in This Plan

| # | File | Severity | Description |
|---|---|---|---|
| B-1 | `SoftwareController` | CRITICAL | `resolveProgram()` only checks `tenant_id` → Manager can edit/delete all tenant programs |
| B-2 | `BaseManagerController.teamCustomersQuery()` | MEDIUM | Uses `role=customer` — Customer role removed Phase 11 → 0 customers shown everywhere |
| B-3 | `ActivityController` | LOW | Missing `tenant_id` filter on ActivityLog queries |
| B-4 | `CustomerController` | LOW | Accepts arbitrary `manager_id` filter param with no ownership validation |

---

## Team Network Diagram — Bug Fixes

Two bugs found during implementation review. The diagram is built and working but has these visual/performance issues.

### Bug A — fitView Double-Fire

**File:** `frontend/src/components/team-network/NetworkCanvas.tsx`

The `<ReactFlow>` component has both a `fitView` prop AND the `onInit` callback calls `fitView({ padding: 0.16 })`. Both fire on mount, causing a visible double-snap animation.

**Fix:** Remove the `fitView` prop from `<ReactFlow>`. Keep only the `onInit` call so fitView runs once with the correct padding.

```tsx
// Before:
<ReactFlow
  nodes={nodes}
  edges={edges}
  fitView   // ← REMOVE THIS
  onInit={(instance) => {
    setFlowInstance(instance)
    instance.fitView({ padding: 0.16 })
  }}
  ...
>

// After:
<ReactFlow
  nodes={nodes}
  edges={edges}
  onInit={(instance) => {
    setFlowInstance(instance)
    instance.fitView({ padding: 0.16 })
  }}
  ...
>
```

### Bug B — AnimatedEdge Injects `<style>` Tag Per Render

**File:** `frontend/src/components/team-network/edges/AnimatedEdge.tsx`

The `@keyframes team-network-dash` rule is written inside a `<style>` tag inside the component. With N edges on screen, this tag is injected N times into the DOM on every render.

**Fix:** Create `AnimatedEdge.css` with the keyframes and import it once in the component file.

```css
/* AnimatedEdge.css */
@keyframes team-network-dash {
  from { stroke-dashoffset: 0; }
  to   { stroke-dashoffset: -20; }
}
```

```tsx
// AnimatedEdge.tsx — add at top:
import './AnimatedEdge.css'

// Remove the <style> tag from the JSX return
```

---

## Block 1 — Remove Manager Software Management

### Problem

Manager currently has full program CRUD (create, edit, delete programs) + activation. This is wrong — Manager should be exactly like Reseller for software: view shared programs and activate licenses. No program management.

Security consequence: `SoftwareController.resolveProgram()` only validates `tenant_id`, meaning any Manager can currently **edit or delete programs owned by Manager Parent or other Managers**.

### Backend — Remove Routes

**File:** `backend/routes/api.php`

Remove these 5 routes from the `role:manager` group:
```php
Route::get('/software', [ManagerSoftwareController::class, 'index']);
Route::post('/software', [ManagerSoftwareController::class, 'store']);
Route::put('/software/{program}', [ManagerSoftwareController::class, 'update']);
Route::delete('/software/{program}', [ManagerSoftwareController::class, 'destroy']);
Route::post('/software/{program}/activate', [ManagerSoftwareController::class, 'activate']);
```

Remove the `use App\Http\Controllers\Manager\SoftwareController as ManagerSoftwareController;` import.

### Backend — Delete Controller

**Delete:** `backend/app/Http/Controllers/Manager/SoftwareController.php`

Manager still has access to programs via the shared `GET /programs` route (line 128 in api.php, available to all roles including manager). No new endpoint needed.

### Frontend — Delete Pages

**Delete these files:**
- `frontend/src/pages/manager/Software.tsx`
- `frontend/src/pages/manager/SoftwareManagement.tsx`
- `frontend/src/pages/manager/ProgramForm.tsx`
- `frontend/src/pages/manager/ActivateLicense.tsx`

### Frontend — Clean Router

**File:** `frontend/src/router/index.tsx`

Remove:
- `const ManagerSoftwareManagementPage = lazyNamed(...)` (line ~44)
- `const ActivateLicensePageForManager = lazyNamed(...)` (line ~29)
- Routes: `software`, `software-management`, `software-management/create`, `software-management/:id/edit`, `software/:id/activate` under Manager

**File:** `frontend/src/router/routes.ts`

Remove from the `manager` block:
```ts
software: (lang) => ...
activateLicense: (lang, id) => ...
softwareManagement: (lang) => ...
programCreate: (lang) => ...
programEdit: (lang, id) => ...
```

### Frontend — Clean Sidebar

**File:** `frontend/src/components/layout/Sidebar.tsx`

Remove the Software nav item from the Manager nav list.

---

## Block 2 — Fix Manager Activation Form

### Problem

`ActivateLicenseForm.tsx` uses `isReseller` to switch between:
- **Preset mode** (Reseller): Shows preset duration buttons from program. Price auto-filled from preset. No date picker.
- **Manual mode** (everyone else): Shows date picker or duration value + unit inputs. Price = `duration_days × price_per_day`.

Manager currently falls into manual mode. The request is for Manager to use preset mode exactly like Reseller — pick a preset, price is auto-set, no date fields.

### Fix

**File:** `frontend/src/components/activation/ActivateLicenseForm.tsx`

One line change:
```ts
// Before (line ~108):
const isReseller = user?.role === 'reseller'

// After:
const isReseller = user?.role === 'reseller' || user?.role === 'manager'
```

This single change makes all the existing form branching apply correctly to Manager. No backend change needed — the shared `POST /licenses/activate` endpoint already handles preset-based activation for all roles.

### Activation Entry Point for Manager

After removing `/manager/software/:id/activate`, Manager still needs a way to activate licenses. The activation entry point already exists in the Customers page (inline activation dialog). Verify this path still works after Block 1 changes.

---

## Block 3 — Security & Data Leak Fixes

### Fix 3a — teamCustomersQuery() — BaseManagerController

**File:** `backend/app/Http/Controllers/Manager/BaseManagerController.php`

**Problem:** Three methods use `UserRole::CUSTOMER->value` which was removed in Phase 11. The Customer role no longer exists, so these methods either return empty results or fail silently.

**Fix `teamCustomersQuery()` (lines 56–69):**
```php
// BEFORE (broken):
protected function teamCustomersQuery(Request $request)
{
    $sellerIds = $this->teamSellerIds($request);
    $query = User::query()
        ->where('tenant_id', $this->currentTenantId($request))
        ->where('role', UserRole::CUSTOMER->value); // role doesn't exist
    return $query->where(function ($builder) use ($sellerIds): void {
        $builder
            ->whereIn('created_by', $sellerIds)
            ->orWhereHas('customerLicenses', fn ($q) => $q->whereIn('reseller_id', $sellerIds));
    });
}

// AFTER (license-based):
protected function teamCustomersQuery(Request $request)
{
    $sellerIds = $this->teamSellerIds($request);
    $customerIds = License::query()
        ->whereIn('reseller_id', $sellerIds)
        ->whereNotNull('customer_id')
        ->distinct()
        ->pluck('customer_id');
    return User::query()
        ->where('tenant_id', $this->currentTenantId($request))
        ->whereIn('id', $customerIds);
}
```

**Fix `teamUsersQuery()` (lines 71–90):**
```php
// AFTER:
protected function teamUsersQuery(Request $request)
{
    $sellerIds = $this->teamSellerIds($request);
    $customerIds = License::query()
        ->whereIn('reseller_id', $sellerIds)
        ->whereNotNull('customer_id')
        ->distinct()
        ->pluck('customer_id');
    return User::query()
        ->where('tenant_id', $this->currentTenantId($request))
        ->where(function ($builder) use ($sellerIds, $customerIds): void {
            $builder
                ->whereIn('id', $sellerIds)
                ->orWhereIn('id', $customerIds);
        });
}
```

**Fix `resolveTeamUser()` (lines 117–132):**
```php
// AFTER:
protected function resolveTeamUser(Request $request, User $user): User
{
    $role = $user->role?->value ?? (string) $user->role;
    if ($role === UserRole::RESELLER->value) {
        return $this->resolveTeamReseller($request, $user);
    }
    // Customer: must have at least one license under this team's resellers
    $sellerIds = $this->teamSellerIds($request);
    abort_unless(
        License::query()
            ->whereIn('reseller_id', $sellerIds)
            ->where('customer_id', $user->id)
            ->exists(),
        404,
    );
    return $user;
}
```

Add `use App\Models\License;` if not already imported in BaseManagerController.

**Affected pages after this fix:** Dashboard `team_customers` stat, CustomerController index, Reports `total_customers` — all will show correct values instead of 0.

### Fix 3b — ActivityController — Add Tenant Filter

**File:** `backend/app/Http/Controllers/Manager/ActivityController.php`

**Problem:** ActivityLog query has no `tenant_id` filter. `ResellerLogController` correctly has one; this controller does not.

**Fix:** Add one line to the query in `index()`:
```php
$query = ActivityLog::query()
    ->with('user:id,name')
    ->where('tenant_id', $this->currentTenantId($request))  // ADD THIS
    ->whereIn('user_id', $userIds)
    ->latest();
```

### Fix 3c — CustomerController — Remove Dead manager_id Filter

**File:** `backend/app/Http/Controllers/Manager/CustomerController.php`

**Problem:** The `manager_id` filter has no meaning for Manager role (a Manager IS the manager). It accepts any integer with no ownership check. The base `teamCustomersQuery()` prevents leaks but the parameter should not exist.

**Fix:** Remove from validation:
```php
'manager_id' => ['nullable', 'integer'],  // REMOVE
```

Remove the filter block:
```php
if (! empty($validated['manager_id'])) {      // REMOVE
    $query->where('created_by', (int) $validated['manager_id']);
}
```

---

## Block 4 — Super Admin: Assign Reseller to Manager on Creation

### Problem

When Super Admin creates a Reseller, `created_by` is currently set to the Super Admin's own user ID (or null). This means the reseller is "orphaned" — no Manager sees them, they only appear as a violet edge under Manager Parent in Team Network.

### Goal

When Super Admin creates a Reseller, show an optional "Assign to Manager" dropdown that lists all `manager_parent` and `manager` users in the target tenant with role badges. Selecting one sets `created_by = selected_user_id`.

### Backend — New Endpoint

Add `GET /super-admin/tenants/{tenant}/assignable-managers`:

```php
public function assignableManagers(Request $request, Tenant $tenant): JsonResponse
{
    $managers = User::query()
        ->where('tenant_id', $tenant->id)
        ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value])
        ->orderByRaw("FIELD(role, ?, ?)", [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value])
        ->orderBy('name')
        ->get(['id', 'name', 'email', 'role']);

    return response()->json(['data' => $managers]);
}
```

Response:
```json
{
  "data": [
    { "id": 5, "name": "Ahmad Khalid", "email": "...", "role": "manager_parent" },
    { "id": 12, "name": "Sara Nasser", "email": "...", "role": "manager" }
  ]
}
```

### Backend — Accept assign_to_id in Reseller Store

In the Super Admin reseller/team user store endpoint, add optional field:
```php
'assign_to_id' => ['nullable', 'integer', 'exists:users,id'],
```

Validate that if provided:
1. Target user belongs to the same `tenant_id` as the reseller being created
2. Target user has role `manager_parent` or `manager`

Set `created_by`:
```php
'created_by' => isset($validated['assign_to_id']) ? (int) $validated['assign_to_id'] : null,
```

### Frontend — Assignment Dropdown

In the Super Admin reseller creation form (inside tenant team management):
- Add conditional section that appears when `role === 'reseller'`
- Query: `GET /tenants/{tenantId}/assignable-managers`
- Render as a `Select` or styled dropdown
- Each option: `<RoleBadge role={item.role} />` + name + email
- Default/placeholder: "Leave unassigned (visible to Manager Parent only)"
- On selection: include `assign_to_id` in create payload

---

## Block 5 — Granted Value Bug (Super Admin Reports)

### Problem

The Super Admin Financial Reports page shows a "Granted Value" card displaying `$65,103.89` while "Total Revenue" is only `$2,362.22`. The user reported this as impossible and the card is also not clickable.

### Investigation

**File:** `backend/app/Http/Controllers/SuperAdmin/FinancialReportController.php`

```php
$summary = $this->revenueQuery($validated)
    ->selectRaw(RevenueAnalytics::revenueSumExpression('earned', ..., 'total_platform_revenue'))
    ->selectRaw(RevenueAnalytics::revenueSumExpression('granted', ..., 'granted_value'))
    ->first();
```

**`revenueQuery()`** calls `RevenueAnalytics::baseQuery($validated)` with no tenant or seller scope — it queries ALL activity_logs globally.

**`revenueSumExpression('granted')`** sums `metadata->price` for all rows where `attribution_type = 'granted'`.

The `granted_value` CAN legitimately exceed `earned_revenue` when:
- The system has many trial/granted activations (batch-created for testing or demos)
- Granted activations store the full market price in metadata even though no payment occurred
- If the test environment had high-value licenses ($100+) granted many times

**The calculation is mathematically correct.** Granted Value = total market value of activations given for free. It is NOT a calculation bug. The issue is:
1. **UI/UX confusion** — it looks like a bug but is valid data
2. **Not clickable** — there is no drill-down to explain what the $65,103.89 consists of

### Fix

**Backend:** Add a `GET /super-admin/reports/granted-activations` endpoint that returns the list of activity_log rows where `attribution_type = 'granted'`, paginated, showing reseller name, program, price, date.

**Frontend:** Make the Granted Value card clickable — opens a drawer or modal showing the list of granted activations using the new endpoint. Add a tooltip/description explaining: "Total market value of activations granted for free (trials, manual grants)."

**Also:** The `total_customers` stat in `FinancialReportController.index()` (line 28-30) still uses `UserRole::CUSTOMER->value` (same Phase 11 bug). Fix:
```php
// BEFORE:
$totalCustomers = User::query()
    ->where('role', UserRole::CUSTOMER->value)
    ->count();

// AFTER:
$totalCustomers = License::query()
    ->whereNotNull('customer_id')
    ->distinct('customer_id')
    ->count('customer_id');
```

---

## Block 6 — Frontend Scope Audit

### Purpose

Verify that every Manager page filter/dropdown only shows data within the Manager's scope. Even if the backend correctly scopes query results, a frontend dropdown populated with all-tenant data is a UX data leak (Manager sees reseller names they shouldn't know about).

### Findings from Code Review

| Page | Filter | Source | Scoped? |
|---|---|---|---|
| Customers | Reseller dropdown | `managerService.getTeam()` → `GET /manager/team` | ✅ Correct — already uses manager's scoped team |
| Customers | Manager filter | Hardcoded `[{ id: user.id, name: user.name }]` | ✅ Harmless but useless — should be removed |
| Customers | Program dropdown | `programService.getAll()` → shared `GET /programs` | ✅ Programs are tenant-level, not manager-scoped (correct) |
| ResellerLogs | Seller filter | Needs verification |  |
| Reports | Any filters | Needs verification |  |
| ResellerPayments | Reseller list | Uses `teamResellersQuery()` backend | ✅ |

### Required Changes

**Customers page — Remove useless Manager filter dropdown:**
- The "Filter by Manager" `<select>` only ever shows the current manager themselves
- It sends `manager_id` to the backend (which is being removed in Fix 3c)
- Remove the dropdown entirely from the UI

**ResellerLogs page — Verify seller_id filter dropdown:**
- Check if the seller filter dropdown fetches from a scoped source
- If it uses `GET /manager/team` → already scoped ✅
- If it fetches from an unscoped endpoint → fix to use `GET /manager/team`

**Reports page — Verify all filter inputs:**
- Check if any date range or filter sends unscoped seller IDs
- Backend is already scoped via `teamSellerIds()` — verify frontend filters don't expose extra data

---

## Affected Files — Complete List

### Backend

| File | Change | Block |
|---|---|---|
| `routes/api.php` | Remove 5 Manager software routes + add assignable-managers route | 1, 4 |
| `Controllers/Manager/SoftwareController.php` | **DELETE** | 1 |
| `Controllers/Manager/BaseManagerController.php` | Fix `teamCustomersQuery()`, `teamUsersQuery()`, `resolveTeamUser()` | 3a |
| `Controllers/Manager/ActivityController.php` | Add `tenant_id` filter | 3b |
| `Controllers/Manager/CustomerController.php` | Remove `manager_id` filter | 3c |
| `Controllers/SuperAdmin/FinancialReportController.php` | Fix `total_customers` stat + add granted activations endpoint | 5 |
| `Controllers/SuperAdmin/TenantController.php` (or equiv) | Add `assignableManagers()` + accept `assign_to_id` | 4 |

### Frontend

| File | Change | Block |
|---|---|---|
| `components/team-network/NetworkCanvas.tsx` | Remove `fitView` prop | TN Bug A |
| `components/team-network/edges/AnimatedEdge.tsx` | Move `@keyframes` to CSS file | TN Bug B |
| `components/team-network/edges/AnimatedEdge.css` | **CREATE** with keyframes | TN Bug B |
| `pages/manager/Software.tsx` | **DELETE** | 1 |
| `pages/manager/SoftwareManagement.tsx` | **DELETE** | 1 |
| `pages/manager/ProgramForm.tsx` | **DELETE** | 1 |
| `pages/manager/ActivateLicense.tsx` | **DELETE** | 1 |
| `router/index.tsx` | Remove Manager software routes + lazy imports | 1 |
| `router/routes.ts` | Remove Manager software path helpers | 1 |
| `components/layout/Sidebar.tsx` | Remove Software nav item from Manager | 1 |
| `components/activation/ActivateLicenseForm.tsx` | `isReseller` → include `manager` role | 2 |
| `pages/manager/Customers.tsx` | Remove manager filter dropdown | 6 |
| `pages/super-admin/Reports.tsx` (or equiv) | Make Granted Value card clickable | 5 |
| Super Admin reseller creation form | Add `assign_to_id` dropdown | 4 |
| Super Admin service file | Add `getAssignableManagers(tenantId)` | 4 |

---

## Locked Decisions

1. Manager only sees resellers where `created_by = manager.id` — already correctly enforced in backend
2. Manager activation form uses presets — single line change to `isReseller` check
3. Customer lookup uses license-based approach — Customer role was removed Phase 11
4. `assign_to_id` is optional when Super Admin creates reseller — null = orphaned under Manager Parent
5. Granted Value calculation is mathematically correct — fix is clickable drill-down + tooltip, not a formula change
6. Manager reseller filter in Customers page is removed entirely (useless + links to deprecated manager_id backend param)
