# Phase 3 — Mandiag Tracking Page (Manager Parent)

**Goal:** Manager Parent can see all Mandiag financial data — total money owed
to Mandiag, per-reseller costs, commission, and all transactions — directly
from the panel without logging into Mandiag separately.

**Prerequisite:** Phase 1 complete.

**Estimated effort:** 1 day (backend + frontend)

---

## What the page shows

All data pulled live from Mandiag API on page load (no local DB mirror needed).

### Summary cards (top)
- Total revenue from sub-resellers
- Total owed to Mandiag (`manager_balance_total`)
- Net commission (`revenue - manager_cost`)
- Active sub-resellers count
- Total license count

Period filter: Today / This Week / This Month / This Year / All Time

### Per-reseller table
Columns: Reseller name, sub_id, activations, revenue, Mandiag cost, commission

### All transactions list
Columns: License ID, reseller, software, customer, HWID, duration, price, Mandiag cost, status, created

---

## Files to CREATE

### 1. MandiagTrackingController
**Path:** `backend/app/Http/Controllers/ManagerParent/MandiagTrackingController.php`

Endpoints:
```
GET /api/manager-parent/mandiag/summary?period=month
GET /api/manager-parent/mandiag/resellers?period=month
GET /api/manager-parent/mandiag/licenses?page=1&per_page=25
```

Each endpoint calls Mandiag API and returns the data. No local DB required.
Responses cached for 5 minutes to avoid hammering Mandiag rate limits.

### 2. Frontend page
**Path:** `frontend/src/pages/manager-parent/MandiagTracking.tsx`

- Summary cards row
- Period filter pills (Today / Week / Month / Year / All)
- Per-reseller data table
- Transactions table with pagination

### 3. Frontend route
Add to Manager Parent route config:
```
/:lang/mandiag-tracking  →  MandiagTracking page
```

---

## Files to EDIT

### 4. routes/api.php
Add inside Manager Parent middleware group:
```php
Route::prefix('manager-parent/mandiag')->middleware('role:manager_parent')->group(function() {
    Route::get('/summary',   [MandiagTrackingController::class, 'summary']);
    Route::get('/resellers', [MandiagTrackingController::class, 'resellers']);
    Route::get('/licenses',  [MandiagTrackingController::class, 'licenses']);
});
```

### 5. Manager Parent sidebar navigation
Add "Mandiag" link to sidebar nav for Manager Parent role.

---

## Mandiag API calls used

```
GET /balance                           → summary cards
GET /commission?period={period}        → revenue/cost/commission totals
GET /resellers?include_stats=1&period= → per-reseller table (one API call)
GET /licenses?page=&per_page=          → transactions list
```

---

## Caching strategy

Cache each response for 5 minutes using Laravel Cache:
```php
Cache::remember("mandiag_summary_{$tenantId}_{$period}", 300, fn() => $this->mandiagApi->get('/commission?period='.$period));
```

Invalidate on demand if Manager Parent hits a "Refresh" button.

---

## Rate limit awareness

Mandiag: 100 requests/minute, 5000/hour.
With caching, this page uses at most 3 API calls per refresh.
No rate limit risk.

---

## Validation checklist

- [ ] Summary cards show correct totals matching Mandiag panel
- [ ] Period filter changes data correctly
- [ ] Per-reseller table shows all sub-resellers with correct stats
- [ ] Transactions list paginates correctly
- [ ] Page only visible to Manager Parent role
- [ ] Caching prevents duplicate API calls within 5 minutes
