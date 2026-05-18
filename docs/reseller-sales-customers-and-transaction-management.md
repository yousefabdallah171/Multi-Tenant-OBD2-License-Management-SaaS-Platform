# Reseller Sales Customers & Transaction Management

**Last updated:** 2026-05-18
**Scope:** Super Admin features — reseller customer sales detail page, transaction edit, transaction delete, export

---

## 1. Pages Overview

### 1.1 Reseller Sales Customers Page

**URL:** `/super-admin/reseller-payments/reseller/{resellerId}/customers`
**File:** `frontend/src/pages/super-admin/ResellerSalesCustomers.tsx`

Shows every license activation and renewal sold by a specific reseller, with filters, pagination, inline edit, and delete per transaction.

**What's on the page:**

| Section | Details |
|---|---|
| Back button | Returns to `/super-admin/reseller-payments` |
| Page header | Shows reseller name and email from summary |
| Stats cards | Total Customers, Total Sales (USD), Total Events |
| Filter bar | Search, Program, Country, Date From/To |
| Data table | Transaction rows with Edit + View Details + Delete |
| Screen Options | Column visibility toggles + per-page selector (10 / 25 / 50 / 100 / 200) |

**Filter state (client-side):**

```
search          → customer name / BIOS ID / program
program_id      → dropdown from active programs
country_name    → dropdown from countries
from / to       → date range
page            → current page
perPage         → rows per page (default 25)
```

**Column definitions:**

| Key | Label | Notes |
|---|---|---|
| `customer_name` | Customer | Shows name + username |
| `bios_id` | BIOS ID | — |
| `program_name` | Program | — |
| `country_name` | Country | — |
| `sale_amount` | Sale Amount | Formatted USD |
| `sale_date` | Sale Date | Formatted locale date |
| `actions` | Actions | Edit button (if license_id present), View Details (if customer_id present), Delete (super admin only) |

---

### 1.2 Transaction Edit Logs Page

**URL:** `/super-admin/transaction-edit-logs`
**File:** `frontend/src/pages/super-admin/TransactionEditLogsPage.tsx`

Audit dashboard showing all transaction edits across all customers, with who made the change, what changed (before/after diff), and when.

---

### 1.3 Transaction History Page

**URL:** `/super-admin/transaction-history`
**File:** `frontend/src/pages/super-admin/TransactionHistory.tsx`

Shows all license activations and renewals across all tenants and sellers.

**Features added (2026-05-18):**
- Per-page selector: 10 / 25 / 50 / 100 / 200 rows
- Export CSV (downloads all rows matching current filters via backend streaming endpoint)
- Export JSON (client-side download of current page's rows)
- Pagination integrated into DataTable (uses built-in previous/next controls)

---

## 2. Transaction Edit Feature

### 2.1 What Can Be Edited

Super Admin can edit the following fields on any license transaction:

| Field | Effect |
|---|---|
| `price` | Updates `License.price` + `ActivityLog.metadata.price`; recalculates reseller/manager balances |
| `customer_id` | Reassigns the sale to a different customer (must be same tenant) |
| `activated_at` | Moves the sale to a different date/period in reports |
| `duration_days` | Updates license duration and `expires_at` |
| `program_id` | Moves the sale to a different program in program reports (must be same tenant) |
| `reason` | Optional audit note stored in `transaction_edits` table |

### 2.2 What Cannot Be Edited

| Field | Reason |
|---|---|
| `bios_id` | Would break BIOS tracking and affect other licenses with the same BIOS |
| `reseller_id` | Would credit revenue to the wrong seller; deactivate and reactivate instead |
| `status` | Use the deactivate/cancel endpoints |

### 2.3 Cascade on Edit

Every edit triggers a cascade to keep all data consistent:

1. `License` record updated (price, customer_id, activated_at, duration_days, program_id, expires_at)
2. Linked `ActivityLog` entry updated (metadata.price, metadata.customer_id, metadata.program_id, etc.)
3. `TransactionEdit` audit record created (before/after snapshot + reason + who + when)
4. Report caches invalidated (super-admin, manager-parent, manager, reseller for that tenant)
5. `UserBalance` recalculated for affected resellers (and managers up the chain)

### 2.4 Revert

Super Admin can revert a transaction to the state before the most recent edit:

- Creates a NEW `TransactionEdit` record with `action = 'revert'`
- Does NOT delete the edit history
- Triggers same cascade (balances + caches)

---

## 3. Transaction Delete Feature

Deleting a transaction means **permanently deleting the ActivityLog entry** (the sale event). The license record itself remains.

**Who can delete:** Super Admin only

**Effect of deletion:**
- `ActivityLog` row hard-deleted
- Reseller revenue drops by the transaction's amount in all reports
- `UserBalance` recalculated (if applicable)
- Caches invalidated

**Frontend:** Delete button appears in the Actions column of:
- Reseller Sales Customers table (`ResellerSalesCustomers.tsx`)
- Manager Sales Customers table (`ManagerSalesCustomers.tsx`)
- Manager Parent Sales Customers table (`ManagerParentSalesCustomers.tsx`)
- Transaction History table (`TransactionHistory.tsx`)

**Confirmation:** `window.confirm()` dialog before mutation fires.

---

## 4. API Endpoints

### 4.1 Transaction Edit Endpoints

All under `/api/super-admin/` — requires `super_admin` role.

#### GET `/super-admin/transactions/{license}/editable`

Returns current transaction data + full edit history.

**Response:**
```json
{
  "data": {
    "transaction": {
      "license_id": 123,
      "tenant_id": 1,
      "tenant_name": "Acme LLC",
      "reseller_id": 15,
      "reseller_name": "Ahmed",
      "customer_id": 42,
      "customer_name": "John Auto",
      "customer_email": "john@auto.com",
      "bios_id": "HWID-123",
      "program_id": 8,
      "program_name": "Topix",
      "price": 70.00,
      "duration_days": 365,
      "activated_at": "2026-04-15T10:30:00Z",
      "expires_at": "2027-04-15T10:30:00Z",
      "status": "active",
      "created_at": "...",
      "updated_at": "..."
    },
    "edit_history": [
      {
        "id": 1,
        "super_admin_name": "Admin",
        "super_admin_email": "admin@obd2.com",
        "action": "edit",
        "previous_values": { "price": 60.00 },
        "new_values": { "price": 70.00 },
        "reason": "Customer paid additional amount",
        "diffs": { "price": { "from": 60, "to": 70 } },
        "created_at": "2026-05-14T08:00:00Z"
      }
    ]
  }
}
```

#### PATCH `/super-admin/transactions/{license}`

Edit a transaction. At least one editable field must be provided.

**Request:**
```json
{
  "price": 75.00,
  "customer_id": 43,
  "activated_at": "2026-04-20",
  "duration_days": 730,
  "program_id": 9,
  "reason": "Customer upgraded from 1yr to 2yr license"
}
```

**Response:**
```json
{
  "data": { "...updated transaction..." },
  "message": "Transaction edited successfully.",
  "affected": {
    "licenses_updated": 1,
    "activity_logs_updated": 1,
    "caches_invalidated": 5,
    "balances_recalculated": [
      { "user_id": 15, "user_name": "Ahmed", "user_role": "reseller", "total_revenue": 3250.00 }
    ],
    "edit_id": 42
  }
}
```

**Validation errors (422):**
- No fields to change
- `customer_id` belongs to a different tenant
- `program_id` belongs to a different tenant
- `bios_id` or `reseller_id` or `status` sent in request

#### POST `/super-admin/transactions/{license}/revert`

Revert to previous state.

**Request:**
```json
{ "reason": "Mistake, reverting." }
```

**Response:** Same shape as PATCH response.

#### GET `/super-admin/transactions/{license}/history`

Full edit history for one license.

**Response:**
```json
{
  "data": [ "...array of edit records..." ],
  "summary": { "license_id": 123, "total_edits": 3 }
}
```

#### GET `/super-admin/transaction-edit-logs`

All edits across all customers (paginated). Query params:

| Param | Type | Description |
|---|---|---|
| `customer_id` | integer | Filter by customer |
| `search` | string | Search by BIOS ID, customer name, reseller name |
| `from` | date | Edit date from |
| `to` | date | Edit date to |
| `per_page` | integer | Default 25 |

---

### 4.2 Transaction History Endpoints

#### GET `/super-admin/transaction-history`

Paginated list of all license activations and renewals.

| Param | Type |
|---|---|
| `search` | string |
| `tenant_id` | integer |
| `seller_id` | integer |
| `role` | `manager_parent` / `manager` / `reseller` |
| `from` | date |
| `to` | date |
| `page` | integer |
| `per_page` | integer (max 200) |

**Response includes:**
```json
{
  "data": [ "...rows..." ],
  "summary": {
    "total_events": 1234,
    "total_sales": 98765.00,
    "total_sellers": 42
  },
  "meta": { "current_page": 1, "last_page": 5, "total": 120, "per_page": 25 }
}
```

#### GET `/super-admin/transaction-history/export`

Streams a CSV file with all matching rows (no pagination, max 5000 rows).

Same query params as `GET /transaction-history` minus `page` and `per_page`.

**Response headers:**
```
Content-Type: text/csv; charset=UTF-8
Content-Disposition: attachment; filename="transaction-history.csv"
```

**CSV columns:**
Seller, Seller Email, Seller Role, Tenant, Customer, BIOS ID, Program, Country, Amount (USD), Offer Discount %, Type, Sale Date

#### GET `/super-admin/transaction-history/sellers`

List of sellers who appear in transaction history (for filter dropdown).

#### DELETE `/super-admin/activity-logs/{activityLogId}`

Hard-delete a single activity log entry (transaction).

---

## 5. Backend Files

| File | Role |
|---|---|
| `backend/app/Http/Controllers/SuperAdmin/TransactionEditController.php` | REST controller — show, update, revert, history, allLogs |
| `backend/app/Services/TransactionEditService.php` | Business logic — editTransaction, revertTransaction, getTransactionHistory |
| `backend/app/Models/TransactionEdit.php` | Eloquent model for `transaction_edits` audit table |
| `backend/app/Http/Controllers/SuperAdmin/TransactionHistoryController.php` | History list, export CSV, sellers endpoint |
| `backend/routes/api.php` | Route definitions (under `middleware(['auth:sanctum', 'role:super_admin'])`) |

---

## 6. Frontend Files

| File | Role |
|---|---|
| `frontend/src/pages/super-admin/ResellerSalesCustomers.tsx` | Reseller customer sales page with edit + delete |
| `frontend/src/pages/super-admin/ManagerSalesCustomers.tsx` | Manager customer sales page with edit + delete |
| `frontend/src/pages/super-admin/ManagerParentSalesCustomers.tsx` | Manager parent customer sales page |
| `frontend/src/pages/super-admin/TransactionHistory.tsx` | All transactions page with per-page + export |
| `frontend/src/pages/super-admin/TransactionEditLogsPage.tsx` | Audit log page for all edits |
| `frontend/src/components/TransactionEditModal.tsx` | Modal with Edit tab + History tab |
| `frontend/src/components/TransactionEditForm.tsx` | Form inside the edit modal |
| `frontend/src/components/TransactionEditHistory.tsx` | History list inside the modal |
| `frontend/src/services/transaction-edit.service.ts` | API calls: getTransactionDetails, editTransaction, revertTransaction |
| `frontend/src/services/super-admin-platform.service.ts` | deleteActivityLog, exportTransactionHistoryCsv, getTransactionHistory |

---

## 7. Database Schema

### `transaction_edits` table

| Column | Type | Description |
|---|---|---|
| `id` | bigint PK | — |
| `license_id` | bigint FK → licenses | The license that was edited |
| `activity_log_id` | bigint FK nullable → activity_logs | The linked activity log entry |
| `tenant_id` | bigint FK → tenants | For fast tenant-scoped queries |
| `super_admin_id` | bigint FK → users | Who made the edit |
| `action` | varchar(50) | `edit`, `revert`, `delete` |
| `previous_values` | json | Snapshot before change |
| `new_values` | json | What changed |
| `reason` | text nullable | Admin note |
| `created_at` | timestamp | — |

---

## 8. Security & Authorization

- All endpoints require `super_admin` role (enforced by `BaseSuperAdminController` + middleware)
- Customer validation: `customer_id` must belong to same `tenant_id` as license
- Program validation: `program_id` must belong to same `tenant_id` as license
- BIOS ID, reseller, status are explicitly blocked with 422 if passed in request
- Every edit creates an immutable audit record in `transaction_edits`

---

## 9. How Reports Are Kept Consistent

After any edit or delete:

1. **`UserBalance` recalculated** — `UserBalance.total_revenue` and `pending_balance` recomputed from raw `activity_logs` sum for each affected reseller
2. **Cache bumped** — `LicenseCacheInvalidation::bumpVersion()` called for all role scopes (super-admin, manager-parent, manager, reseller) and for the tenant-specific manager-parent key
3. **Next report query** — picks up fresh data because versioned cache key no longer matches

This ensures the reseller payments page, manager reports, and super admin dashboard all reflect the edit immediately on next load.

---

## 10. Quick Reference — Edit Flow

```
Super Admin clicks Edit on a transaction row
  → TransactionEditModal opens (GET /transactions/{license}/editable)
  → User changes price/customer/date/program/duration + optional reason
  → Clicks Save (PATCH /transactions/{license})
  → Backend: DB transaction:
      1. Snapshot previous values
      2. Update License record
      3. Update ActivityLog metadata
      4. Create TransactionEdit audit row
      5. Recalculate UserBalance for reseller chain
      6. Bump cache versions
  → Toast: "Transaction edited successfully"
  → Parent page refetches to show updated row
```

---

## 11. Quick Reference — Delete Flow

```
Super Admin clicks Delete on a transaction row
  → window.confirm() dialog
  → DELETE /super-admin/activity-logs/{activityLogId}
  → Backend: ActivityLog hard-deleted
  → Frontend query cache invalidated
  → Row disappears from table
  → Toast: "Transaction deleted successfully"
```
