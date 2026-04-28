# BIOS Change Audit Page — Manager Parent
## Feature Plan

**Created:** 2026-04-10  
**Status:** 🆕 PLANNING

---

## 1. Feature Overview

A new **read-only audit/history page** for the Manager Parent role that gives a complete, unified view of every BIOS ID change operation that occurred within their tenant — from day one.

Two types of operations are tracked:
1. **Request-based changes** — a Reseller submitted a BIOS change request, and a Manager approved or rejected it (or it is still pending).
2. **Direct changes** — a Manager changed a BIOS ID directly without a request.

All historical data already exists in the database:
- `bios_change_requests` table — holds every request ever submitted
- `activity_logs` table — holds every `bios.direct_changed` and `bios.direct_change_failed` event

No new database tables or migrations needed. The page reads what's already there.

---

## 2. What the Page Shows

### 2.1 Summary Stats Bar (5 cards at the top)
| Card | Value |
|---|---|
| Total Requests | count of all rows in `bios_change_requests` for this tenant |
| Approved | count where status = approved / approved_pending_sync |
| Rejected | count where status = rejected |
| Pending | count where status = pending |
| Direct Changes by Managers | count of `bios.direct_changed` activity logs |

### 2.2 Filters Row
- **Manager** — dropdown of all manager-role users in the tenant
- **Reseller** — dropdown of all reseller-role users in the tenant
- **Type** — All / Request / Direct Change
- **Status** — All / Pending / Approved / Rejected / Failed
- **Date From** — date picker
- **Date To** — date picker

### 2.3 Unified Table (newest first, paginated)

| Column | Request rows | Direct Change rows |
|---|---|---|
| # | row index | row index |
| Type | "Request" badge | "Direct Change" badge |
| Reseller | reseller name | reseller whose license was changed |
| Manager | reviewer name (or "—" if pending) | manager who performed the change |
| Old BIOS | old_bios_id | old_bios_id from activity log properties |
| New BIOS | new_bios_id | new_bios_id from activity log properties |
| Status | Pending / Approved / Rejected | Completed / Failed |
| Date | created_at | occurred_at from activity log |
| Details (expand) | reason, reviewer_notes, customer, program | customer, program, license ID |

### 2.4 Row Expansion
Clicking a row expands an inline details panel:
- **Request row:** reason, reviewer_notes, customer name, program name, license ID, reviewed_at
- **Direct change row:** customer name, program name, license ID

---

## 3. Scope Rules

- Only shows data within the **current Manager Parent's tenant** (`tenant_id`)
- Direct changes: only from **Manager-role** users (`role = manager`), NOT Manager Parent actions
- Pending requests (no reviewer yet) are shown with Manager column = "—"
- All past history (from before this page existed) is included from day one

---

## 4. Backend Architecture

### 4.1 New Controller
**`backend/app/Http/Controllers/ManagerParent/BiosChangeAuditController.php`**

Two methods:
- `index(Request $request)` — paginated, filterable list combining both sources
- `summary(Request $request)` — 5 stats for the top cards

**`index` logic:**
1. Get all `bios_change_requests` where `tenant_id = currentTenantId`
2. Get all `activity_logs` where:
   - `user_id` IN (users where `tenant_id = x AND role = manager`)
   - `action` IN (`bios.direct_changed`, `bios.direct_change_failed`)
3. Merge both collections into a unified response with a `type` discriminator field
4. Apply filters (manager_id, reseller_id, type, status, date range)
5. Sort by `occurred_at` DESC, paginate

**Response shape per row:**
```json
{
  "id": "request-123",
  "type": "request",
  "reseller_id": 5,
  "reseller_name": "Reseller A",
  "manager_id": 3,
  "manager_name": "Manager One",
  "old_bios_id": "AAA",
  "new_bios_id": "BBB",
  "status": "approved",
  "reason": "Hardware replaced",
  "reviewer_notes": null,
  "customer_name": "Customer X",
  "program_name": "OBD Pro",
  "license_id": 42,
  "occurred_at": "2026-04-10T12:00:00Z"
}
```

```json
{
  "id": "direct-456",
  "type": "direct_change",
  "reseller_id": 7,
  "reseller_name": "Reseller B",
  "manager_id": 3,
  "manager_name": "Manager One",
  "old_bios_id": "CCC",
  "new_bios_id": "DDD",
  "status": "completed",
  "reason": null,
  "reviewer_notes": null,
  "customer_name": "Customer Z",
  "program_name": "OBD Lite",
  "license_id": 55,
  "occurred_at": "2026-04-09T10:30:00Z"
}
```

**`summary` logic:**
Query `bios_change_requests` by tenant for counts. Query activity_logs for direct_changed count. Return 4 numbers.

### 4.2 New Routes
Added inside `Route::middleware('role:manager_parent')` group in `api.php`:
```php
Route::get('/bios-change-audit', [BiosChangeAuditController::class, 'index']);
Route::get('/bios-change-audit/summary', [BiosChangeAuditController::class, 'summary']);
```

---

## 5. Frontend Architecture

### 5.1 New Route Path
In `frontend/src/router/routes.ts` inside `managerParent`:
```ts
biosChangeAudit: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/bios-change-audit`,
```

### 5.2 New Page Component
**`frontend/src/pages/manager-parent/BiosChangeAudit.tsx`**

Structure:
```
<PageHeader title="BIOS Operations Audit" />
<SummaryCards />           ← 5 stat cards (from /summary endpoint)
<FiltersRow />             ← manager, reseller, type, status, date pickers
<DataTable />              ← unified table with expandable rows
<Pagination />
```

State:
- `page`, `perPage`
- `managerId`, `resellerId`, `type`, `status`, `dateFrom`, `dateTo`

Queries:
- `summaryQuery` — `GET /bios-change-audit/summary`
- `listQuery` — `GET /bios-change-audit?page=&per_page=&manager_id=&reseller_id=&type=&status=&from=&to=`
- `managersQuery` — `GET /team?role=manager` (for manager dropdown)
- `resellersQuery` — `GET /team?role=reseller` (for reseller dropdown)

### 5.3 Service Methods
Added to `frontend/src/services/manager-parent.service.ts`:
```ts
getBiosChangeAudit(params): Promise<PaginatedBiosChangeAudit>
getBiosChangeAuditSummary(): Promise<BiosChangeAuditSummary>
```

### 5.4 Types
Added to `frontend/src/types/manager-parent.types.ts`:
```ts
interface BiosChangeAuditEntry {
  id: string
  type: 'request' | 'direct_change'
  reseller_id: number | null
  reseller_name: string | null
  manager_id: number | null
  manager_name: string | null
  old_bios_id: string
  new_bios_id: string
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed'
  reason: string | null
  reviewer_notes: string | null
  customer_name: string | null
  program_name: string | null
  license_id: number | null
  occurred_at: string
}

interface BiosChangeAuditSummary {
  total_requests: number
  approved: number
  rejected: number
  pending: number
  direct_changes: number
}
```

### 5.5 Sidebar Entry
In `frontend/src/components/layout/Sidebar.tsx`, inside the Manager Parent BIOS group (after `biosChangeRequests`):
```ts
{ key: 'biosChangeAudit', icon: History, href: routePaths.managerParent.biosChangeAudit, translationKey: 'managerParent.nav.biosChangeAudit' },
```

### 5.6 Router
In `frontend/src/router/index.tsx`:
- Lazy import: `const ManagerParentBiosChangeAuditPage = lazyNamed(...)`
- Route: `<Route path="bios-change-audit" element={<ManagerParentBiosChangeAuditPage />} />`

### 5.7 Translation Keys
**English (`en.json`)** — new section `biosChangeAudit`:
```json
"biosChangeAudit": {
  "title": "BIOS Operations Audit",
  "description": "Full history of all BIOS changes across your managers and resellers.",
  "type": "Type",
  "typeRequest": "Request",
  "typeDirectChange": "Direct Change",
  "manager": "Manager",
  "reseller": "Reseller",
  "oldBios": "Old BIOS",
  "newBios": "New BIOS",
  "statusCompleted": "Completed",
  "statusFailed": "Failed",
  "totalRequests": "Total Requests",
  "approved": "Approved",
  "rejected": "Rejected",
  "directChanges": "Direct Changes",
  "filterByManager": "Filter by Manager",
  "filterByReseller": "Filter by Reseller",
  "filterByType": "Filter by Type",
  "reason": "Reason",
  "reviewerNotes": "Reviewer Notes",
  "noHistory": "No BIOS change history found.",
  "noHistoryDesc": "No operations match the current filters."
}
```
Arabic translation added to `ar.json` for all the same keys.

Also add to `managerParent.nav`:
```json
"biosChangeAudit": "BIOS Operations Audit"
```

---

## 6. Files to Create / Modify

| File | Action |
|---|---|
| `backend/app/Http/Controllers/ManagerParent/BiosChangeAuditController.php` | CREATE |
| `backend/routes/api.php` | MODIFY — add 2 routes |
| `frontend/src/pages/manager-parent/BiosChangeAudit.tsx` | CREATE |
| `frontend/src/router/routes.ts` | MODIFY — add 1 path |
| `frontend/src/router/index.tsx` | MODIFY — add lazy import + route |
| `frontend/src/components/layout/Sidebar.tsx` | MODIFY — add nav item |
| `frontend/src/services/manager-parent.service.ts` | MODIFY — add 2 methods |
| `frontend/src/types/manager-parent.types.ts` | MODIFY — add 2 interfaces |
| `frontend/src/locales/en.json` | MODIFY — add translation section |
| `frontend/src/locales/ar.json` | MODIFY — add translation section |

**Total: 2 new files, 8 modified files**

---

## 7. Important Technical Notes

### Activity Log Properties Structure
The `bios.direct_changed` activity log entries store their data in the `properties` JSON column:
```json
{
  "license_id": 55,
  "reseller_id": 7,
  "old_bios_id": "CCC",
  "new_bios_id": "DDD",
  "customer_id": 12,
  "program_id": 3
}
```
The controller must eager-load customer/program names via the `license_id` or `customer_id`/`program_id` from properties. Use a separate query to batch-load License records by IDs collected from the activity log batch.

### Manager IDs for Tenant
To filter activity_logs to only Manager-role users within the tenant:
```php
$managerIds = User::query()
    ->where('tenant_id', $tenantId)
    ->where('role', UserRole::MANAGER)
    ->pluck('id');
```

### Pagination Strategy
Both data sources are merged in PHP (Collection merge), sorted by `occurred_at` DESC, then paginated using the existing `paginateCollection()` helper (already used in `BiosHistoryController`).

### No New Migration Needed
All data already exists. No schema changes required.

### DataTable Does NOT Support Expandable Rows
The shared `DataTable` component (`frontend/src/components/shared/DataTable.tsx`) has no `renderExpanded` or expand prop. Do NOT use `DataTable` for this page. Instead, render a custom `<table>` with `<tbody>/<tr>` manually, using the same Tailwind styling as the rest of the app. The expand toggle state (`expandedRow`) shows a detail `<tr>` immediately below the clicked row.

### Team Dropdowns — Use `teamService`, NOT `managerParentService`
There is no `getTeam()` method on `managerParentService`. The team list lives in `teamService.getAll(params)` from `frontend/src/services/team.service.ts`. Use:
- `teamService.getAll({ role: 'manager', per_page: 100 })` for manager dropdown
- `teamService.getAll({ role: 'reseller', per_page: 100 })` for reseller dropdown
Import `teamService` from `@/services/team.service`.
