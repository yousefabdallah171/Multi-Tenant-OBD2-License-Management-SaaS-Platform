# BIOS Change Audit Page — Tasks
## Manager Parent Feature

**Created:** 2026-04-10  
**Status:** 🆕 NOT STARTED

---

## Phase 1 — Backend: Controller + Routes

### Task 1.1 — Create `BiosChangeAuditController`
**File:** `backend/app/Http/Controllers/ManagerParent/BiosChangeAuditController.php`

Create new controller extending `BaseManagerParentController`.

**`summary()` method:**
- Query `bios_change_requests` where `tenant_id = currentTenantId($request)`
- Count total, approved (approved + approved_pending_sync), rejected, pending
- Query `activity_logs` where `user_id IN ($managerIds)` AND `action = 'bios.direct_changed'`
- Return `{ total_requests, approved, rejected, pending, direct_changes }`

**`index()` method:**
- Validate query params: `manager_id`, `reseller_id`, `type` (request|direct_change), `status`, `from`, `to`, `page`, `per_page`
- Build `$managerIds` = users where `tenant_id = x AND role = manager`
- Build `$tenantId = currentTenantId($request)`

**Source 1 — Requests:**
```php
$requests = BiosChangeRequest::query()
    ->with(['license.customer:id,name', 'license.program:id,name', 'reseller:id,name', 'reviewer:id,name'])
    ->where('tenant_id', $tenantId)
    ->when($managerId, fn($q) => $q->where('reviewer_id', $managerId))
    ->when($resellerId, fn($q) => $q->where('reseller_id', $resellerId))
    ->when($status && $status !== 'completed' && $status !== 'failed', fn($q) => ...)
    ->when($from, fn($q) => $q->whereDate('created_at', '>=', $from))
    ->when($to, fn($q) => $q->whereDate('created_at', '<=', $to))
    ->get();
```
Map each to unified shape with `type = 'request'`, `occurred_at = created_at`.

**Source 2 — Direct changes:**
```php
$directLogs = ActivityLog::query()
    ->whereIn('user_id', $managerIds)
    ->whereIn('action', ['bios.direct_changed', 'bios.direct_change_failed'])
    ->when($managerId, fn($q) => $q->where('user_id', $managerId))
    ->when($from, fn($q) => $q->whereDate('created_at', '>=', $from))
    ->when($to, fn($q) => $q->whereDate('created_at', '<=', $to))
    ->with('user:id,name')
    ->get();
```
Batch-load licenses by `license_id` from properties JSON. Map each to unified shape with `type = 'direct_change'`.

**Merge + filter + paginate:**
```php
$merged = $requestsCollection->merge($directCollection)
    ->when($resellerId && $type === 'direct_change', ...) // filter reseller on direct
    ->sortByDesc('occurred_at')
    ->values();

return $this->paginateCollection($merged, $page, $perPage);
```

**Serialize method** producing the shape described in the plan.

---

### Task 1.2 — Add Routes
**File:** `backend/routes/api.php`

Inside the `Route::middleware('role:manager_parent')` group, after existing bios routes, add:
```php
Route::get('/bios-change-audit', [BiosChangeAuditController::class, 'index']);
Route::get('/bios-change-audit/summary', [BiosChangeAuditController::class, 'summary']);
```

Add import at top of file if needed:
```php
use App\Http\Controllers\ManagerParent\BiosChangeAuditController;
```

---

## Phase 2 — Frontend: Types + Service

### Task 2.1 — Add Types
**File:** `frontend/src/types/manager-parent.types.ts`

Add at the bottom:
```ts
export interface BiosChangeAuditEntry {
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

export interface BiosChangeAuditSummary {
  total_requests: number
  approved: number
  rejected: number
  pending: number
  direct_changes: number
}

export interface BiosChangeAuditParams {
  page?: number
  per_page?: number
  manager_id?: number | ''
  reseller_id?: number | ''
  type?: 'request' | 'direct_change' | ''
  status?: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed' | ''
  from?: string
  to?: string
}
```

---

### Task 2.2 — Add Service Methods
**File:** `frontend/src/services/manager-parent.service.ts`

Add two methods:

```ts
async getBiosChangeAudit(params: BiosChangeAuditParams = {}): Promise<{ data: BiosChangeAuditEntry[]; meta: PaginationMeta }> {
  const response = await apiClient.get('/bios-change-audit', { params })
  return response.data
}

async getBiosChangeAuditSummary(): Promise<BiosChangeAuditSummary> {
  const response = await apiClient.get('/bios-change-audit/summary')
  return response.data
}
```

---

## Phase 3 — Frontend: Page Component

### Task 3.1 — Create `BiosChangeAudit.tsx`
**File:** `frontend/src/pages/manager-parent/BiosChangeAudit.tsx`

**Imports needed:**
- `useState` from react
- `useQuery` from @tanstack/react-query
- `useTranslation`, `useLanguage`, `formatDate`
- `PageHeader`, `Card`, `CardContent` from ui/
- `Input`, `Select`, `Button` from ui/
- `managerParentService`, `teamService` (from `@/services/team.service`)
- Types: `BiosChangeAuditEntry`
- **DO NOT import `DataTable`** — this page uses a custom `<table>` with manual `<tbody>/<tr>` for expandable row support (DataTable component has no expand feature)

**State:**
```ts
const [page, setPage] = useState(1)
const [perPage] = useState(15)
const [managerId, setManagerId] = useState<number | ''>('')
const [resellerId, setResellerId] = useState<number | ''>('')
const [type, setType] = useState<'request' | 'direct_change' | ''>('')
const [status, setStatus] = useState<string>('')
const [dateFrom, setDateFrom] = useState('')
const [dateTo, setDateTo] = useState('')
const [expandedRow, setExpandedRow] = useState<string | null>(null)
```

**Queries:**
```ts
const summaryQuery = useQuery({
  queryKey: ['manager-parent', 'bios-change-audit', 'summary'],
  queryFn: () => managerParentService.getBiosChangeAuditSummary(),
  staleTime: 60_000,
})

const listQuery = useQuery({
  queryKey: ['manager-parent', 'bios-change-audit', page, perPage, managerId, resellerId, type, status, dateFrom, dateTo],
  queryFn: () => managerParentService.getBiosChangeAudit({ page, per_page: perPage, manager_id: managerId || undefined, reseller_id: resellerId || undefined, type: type || undefined, status: status || undefined, from: dateFrom || undefined, to: dateTo || undefined }),
  staleTime: 30_000,
})

// teamService from @/services/team.service — NOT managerParentService
const managersQuery = useQuery({
  queryKey: ['team', 'managers'],
  queryFn: () => teamService.getAll({ role: 'manager', per_page: 100 }),
  staleTime: 300_000,
})

const resellersQuery = useQuery({
  queryKey: ['team', 'resellers'],
  queryFn: () => teamService.getAll({ role: 'reseller', per_page: 100 }),
  staleTime: 300_000,
})
```

**Summary Cards — 5 stat cards:**
- Total Requests (blue)
- Approved (green)
- Rejected (red)
- Pending (amber)
- Direct Changes (violet)

**Filters row:**
- Manager select (options from `managersQuery.data?.data ?? []`)
- Reseller select (options from `resellersQuery.data?.data ?? []`)
- Type select: All / Request / Direct Change
- Status select: All / Pending / Approved / Rejected / Completed / Failed
- Date From input (type="date")
- Date To input (type="date")
- Reset button (clears all filters, resets page to 1)

**Table — custom `<table>` (not DataTable component):**
Render manually with `<thead>` and `<tbody>`. For each row render a `<tr>` with data cells, then conditionally render a second `<tr>` spanning all columns with the expand detail panel when `expandedRow === row.id`.

Columns: Type badge | Reseller | Manager (or "—") | Old BIOS (`<code>`) | New BIOS (`<code>`) | Status badge | Date | Expand toggle button

**Expandable row detail panel (inline, shown below the row):**
```tsx
{expandedRow === row.id ? (
  <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/40 space-y-2 text-sm">
    {row.customer_name ? <p><span className="text-slate-500">{t('common.customer')}:</span> {row.customer_name}</p> : null}
    {row.program_name ? <p><span className="text-slate-500">{t('common.program')}:</span> {row.program_name}</p> : null}
    {row.license_id ? <p><span className="text-slate-500">{t('common.licenseId')}:</span> #{row.license_id}</p> : null}
    {row.reason ? <p><span className="text-slate-500">{t('biosChangeAudit.reason')}:</span> {row.reason}</p> : null}
    {row.reviewer_notes ? <p><span className="text-slate-500">{t('biosChangeAudit.reviewerNotes')}:</span> {row.reviewer_notes}</p> : null}
  </div>
) : null}
```

**TypeBadge helper component (inside same file):**
```tsx
function TypeBadge({ type }: { type: 'request' | 'direct_change' }) {
  if (type === 'direct_change') {
    return <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-sm font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">{t('biosChangeAudit.typeDirectChange')}</span>
  }
  return <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-sm font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">{t('biosChangeAudit.typeRequest')}</span>
}
```

**Empty state:** show `EmptyState` component when `listQuery.data?.data.length === 0`.

---

## Phase 4 — Frontend: Routing + Sidebar

### Task 4.1 — Add Route Path
**File:** `frontend/src/router/routes.ts`

Inside `managerParent` object, after `biosChangeRequests` line:
```ts
biosChangeAudit: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/bios-change-audit`,
```

---

### Task 4.2 — Register in Router
**File:** `frontend/src/router/index.tsx`

Add lazy import (with other Manager Parent lazy imports):
```ts
const ManagerParentBiosChangeAuditPage = lazyNamed(() => import('@/pages/manager-parent/BiosChangeAudit'), 'BiosChangeAuditPage')
```

Add route inside Manager Parent routes group (after `bios-change-requests` route):
```tsx
<Route path="bios-change-audit" element={<ManagerParentBiosChangeAuditPage />} />
```

---

### Task 4.3 — Add Sidebar Entry
**File:** `frontend/src/components/layout/Sidebar.tsx`

In `managerParentItems` array, inside the BIOS group (after the `biosChangeRequests` entry):
```ts
{ key: 'biosChangeAudit', icon: History, href: routePaths.managerParent.biosChangeAudit, translationKey: 'managerParent.nav.biosChangeAudit' },
```

Also add to the `biosGroupUrls` array used for active-state detection:
```ts
routePaths.managerParent.biosChangeAudit(lang),
```

---

## Phase 5 — Translations

### Task 5.1 — English (`en.json`)

Add `biosChangeAudit` section:
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
  "pending": "Pending",
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

Also add to `managerParent.nav`:
```json
"biosChangeAudit": "BIOS Operations Audit"
```

---

### Task 5.2 — Arabic (`ar.json`)

Add `biosChangeAudit` section (same keys, Arabic values):
```json
"biosChangeAudit": {
  "title": "سجل عمليات BIOS",
  "description": "السجل الكامل لجميع تغييرات BIOS عبر المديرين والموزعين.",
  "type": "النوع",
  "typeRequest": "طلب",
  "typeDirectChange": "تغيير مباشر",
  "manager": "المدير",
  "reseller": "الموزع",
  "oldBios": "BIOS القديم",
  "newBios": "BIOS الجديد",
  "statusCompleted": "مكتمل",
  "statusFailed": "فشل",
  "totalRequests": "إجمالي الطلبات",
  "approved": "مقبول",
  "rejected": "مرفوض",
  "pending": "قيد الانتظار",
  "directChanges": "التغييرات المباشرة",
  "filterByManager": "تصفية حسب المدير",
  "filterByReseller": "تصفية حسب الموزع",
  "filterByType": "تصفية حسب النوع",
  "reason": "السبب",
  "reviewerNotes": "ملاحظات المراجع",
  "noHistory": "لم يتم العثور على سجل تغييرات BIOS.",
  "noHistoryDesc": "لا توجد عمليات تطابق الفلاتر الحالية."
}
```

Also add to `managerParent.nav`:
```json
"biosChangeAudit": "سجل عمليات BIOS"
```

---

## Phase 6 — TypeScript Check

### Task 6.1 — Verify No TypeScript Errors
Run:
```bash
cd /c/laragon/www/License/frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1; echo "EXIT:$?"
```
Expected: `EXIT:0`

---

## Implementation Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
Backend    Types    Page      Routing   i18n      TypeCheck
```

Dependencies:
- Phase 3 (page) needs Phase 2 (types + service) to be done first
- Phase 4 (routing) can be done alongside Phase 3
- Phase 5 (translations) can be done at any point after Phase 3
- Phase 1 (backend) is independent of all frontend phases

---

## Files Summary

| # | File | Action | Phase |
|---|---|---|---|
| 1 | `backend/app/Http/Controllers/ManagerParent/BiosChangeAuditController.php` | CREATE | 1 |
| 2 | `backend/routes/api.php` | MODIFY (+2 lines) | 1 |
| 3 | `frontend/src/types/manager-parent.types.ts` | MODIFY (+3 interfaces) | 2 |
| 4 | `frontend/src/services/manager-parent.service.ts` | MODIFY (+2 methods) | 2 |
| 5 | `frontend/src/pages/manager-parent/BiosChangeAudit.tsx` | CREATE | 3 |
| 6 | `frontend/src/router/routes.ts` | MODIFY (+1 path) | 4 |
| 7 | `frontend/src/router/index.tsx` | MODIFY (+1 import, +1 route) | 4 |
| 8 | `frontend/src/components/layout/Sidebar.tsx` | MODIFY (+1 nav item) | 4 |
| 9 | `frontend/src/locales/en.json` | MODIFY (+section) | 5 |
| 10 | `frontend/src/locales/ar.json` | MODIFY (+section) | 5 |

**Total: 2 new files, 8 modified files, 0 new migrations**
