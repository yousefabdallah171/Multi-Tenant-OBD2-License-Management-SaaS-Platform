# Master TODO & Fix Plan — OBD2SW Panel Performance & Feature Issues

**Created**: 2026-03-11
**Last Updated**: 2026-03-11 (v2 — ALL 4 roles fully analyzed, including Super Admin)
**Priority**: CRITICAL — Backend is the main bottleneck

---

## 🔍 Root Cause Summary

### Why Pages Load Slowly

The #1 root cause is **PHP-side aggregation on full table loads**. Every slow controller calls `.get()` with NO limit, pulling ALL records into PHP memory, then doing groupBy/sum/count in PHP instead of SQL.

**The problem (current code):**
```php
// Loads ALL licenses into RAM (could be 50,000+ rows across tenants)
$licenses = $this->licenseQuery($request)->with('program:id,name')->get();
return $licenses->groupBy(fn ($l) => $l->program?->name ?? 'Unknown')  // PHP loop
                ->map(fn ($g) => ['count' => $g->count(), ...]);        // PHP aggregation
```

**The fix (SQL does the work):**
```php
// MySQL returns only ~10-20 summary rows
License::query()
    ->leftJoin('programs', 'licenses.program_id', '=', 'programs.id')
    ->where('reseller_id', $resellerId)
    ->selectRaw('COALESCE(programs.name, "Unknown") as program, COUNT(*) as count, ROUND(SUM(price),2) as revenue')
    ->groupBy('licenses.program_id', 'programs.name')
    ->orderByDesc('revenue')
    ->get();
```

### Why the Missing Index Matters

The existing index `(tenant_id, reseller_id)` is NOT used when a query only has `WHERE reseller_id = X`. MySQL requires the leftmost column to use a composite index. Reseller dashboard queries only filter by `reseller_id` → **full table scan** every request.

---

## ✅ COMPLETED (Previous Sessions)

- [x] `frontend/src/lib/apiCache.ts` — Client-side caching service (TTL-based)
- [x] `frontend/src/lib/queryClient.ts` — React Query config (30s staleTime, 5min gcTime)
- [x] `frontend/src/services/reseller.service.ts` — Frontend caching + cache invalidation
- [x] `frontend/src/services/manager.service.ts` — Frontend caching added
- [x] `frontend/src/services/manager-parent.service.ts` — Frontend caching added
- [x] `frontend/src/pages/reseller/Dashboard.tsx` — Skeleton loaders on stats cards
- [x] `frontend/src/pages/manager/Dashboard.tsx` — Skeleton loaders on stats cards
- [x] `frontend/src/pages/manager-parent/Dashboard.tsx` — Skeleton loaders on stats cards
- [x] `frontend/src/components/customers/StatusFilterCard.tsx` — New reusable component
- [x] `frontend/src/pages/reseller/Customers.tsx` — Status filter cards (replaced ExpiryAlert)
- [x] `frontend/src/pages/manager/Customers.tsx` — Status filter cards (replaced ExpiryAlert)
- [x] `frontend/src/pages/manager-parent/Customers.tsx` — Status filter cards (replaced ExpiryAlert)
- [x] `backend/app/Http/Controllers/Reseller/DashboardController.php` — SQL aggregations + Cache::remember() *(done this session)*

**Already well-optimized — NO changes needed:**
- [x] `backend/app/Http/Controllers/Manager/DashboardController.php` — Already uses SQL GROUP BY + Cache::remember() ✅
- [x] `backend/app/Http/Controllers/ManagerParent/DashboardController.php` — Already uses SQL aggregations + Cache::remember() ✅

---

## ❌ PENDING TASKS

---

## SECTION A — BACKEND FIXES (Highest Priority)

---

### A1. Create New Database Migration — Missing Reseller Index

**Priority**: CRITICAL
**File to create**: `backend/database/migrations/2026_03_11_000000_add_reseller_activation_index.php`

**Problem**: No index on `reseller_id` alone. Queries like `WHERE reseller_id = ? AND activated_at >= ?` cannot use the existing `(tenant_id, reseller_id)` composite index. Causes full table scan on every reseller dashboard/report endpoint.

**Migration content:**
```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->index(['reseller_id', 'activated_at'], 'licenses_reseller_activated_at_idx');
            $table->index(['tenant_id', 'reseller_id', 'activated_at'], 'licenses_tenant_reseller_activated_at_idx');
        });
    }
    public function down(): void {
        Schema::table('licenses', function (Blueprint $table): void {
            $table->dropIndex('licenses_reseller_activated_at_idx');
            $table->dropIndex('licenses_tenant_reseller_activated_at_idx');
        });
    }
};
```

**Checklist:**
- [ ] Create the migration file
- [ ] Run `php artisan migrate` from inside `backend/` directory
- [ ] Verify: `SHOW INDEX FROM licenses;` in MySQL — confirm both new indexes appear

---

### A2. Verify All Existing Indexes Were Applied

**Priority**: CRITICAL
**Command** (run from `backend/` directory):
```bash
php artisan migrate:status
php artisan cache:clear
```

**Checklist:**
- [ ] `2026_03_02_120000_add_performance_indexes` → shows **Ran** ✅
- [ ] `2026_03_02_230000_add_api_log_indexes` → shows **Ran** ✅
- [ ] If any show **Pending** → run `php artisan migrate` first
- [ ] Cache cleared after migration

---

### A3. Fix Reseller ReportController — PHP → SQL Aggregation

**Priority**: CRITICAL
**File**: `backend/app/Http/Controllers/Reseller/ReportController.php`

**What's slow (line by line):**
- Line 89: `->with('program:id,name')->get()` — loads ALL reseller licenses into PHP RAM
- Line 18: `$licenses->groupBy(...)` — PHP grouping for revenue
- Line 26: `$licenses->groupBy(...)` — PHP grouping for activations
- Line 37: `$licenses->groupBy(fn => $l->program?->name)` — triggers N+1 lazy loads
- Lines 99–120: `groupByPeriod()` — entire period grouping in PHP

**What to change:**

| Method | Old | New |
|--------|-----|-----|
| `revenue()` | Load all → PHP `groupByPeriod()` | SQL: `DATE_FORMAT + GROUP BY + SUM(price)` |
| `activations()` | Load all → PHP `groupByPeriod()` | SQL: `DATE_FORMAT + GROUP BY + COUNT(*)` |
| `topPrograms()` | Load all → PHP `groupBy(program.name)` | SQL: `LEFT JOIN programs + GROUP BY program_id` |
| `filteredLicenses()` | Returns full Eloquent collection | Remove — each method queries directly |
| `groupByPeriod()` | PHP period grouping helper | Remove — replaced by SQL DATE_FORMAT |

**SQL period formats:**
```sql
-- Daily:   DATE_FORMAT(activated_at, '%Y-%m-%d')
-- Weekly:  DATE_FORMAT(DATE_SUB(activated_at, INTERVAL WEEKDAY(activated_at) DAY), '%Y-%m-%d')
-- Monthly: DATE_FORMAT(activated_at, '%Y-%m')
```

**Checklist:**
- [ ] Rewrite `revenue()` — SQL DATE_FORMAT + GROUP BY + SUM(price), ORDER BY MIN(activated_at)
- [ ] Rewrite `activations()` — SQL DATE_FORMAT + GROUP BY + COUNT(*), ORDER BY MIN(activated_at)
- [ ] Rewrite `topPrograms()` — SQL LEFT JOIN programs + GROUP BY + ORDER BY revenue DESC
- [ ] Handle `COALESCE(programs.name, 'Unknown')` for licenses with null program_id
- [ ] Remove `filteredLicenses()` private method
- [ ] Remove `groupByPeriod()` private method
- [ ] Verify `exportSections()` still works — it calls `revenue()`, `activations()`, `topPrograms()` returning JsonResponse ✅
- [ ] Add `Cache::remember()` (see A8 below)
- [ ] Test: Revenue chart loads < 500ms
- [ ] Test: Activations chart loads < 500ms
- [ ] Test: Top Programs loads < 500ms

---

### A4. Fix Manager ReportController — PHP → SQL Aggregation

**Priority**: HIGH
**File**: `backend/app/Http/Controllers/Manager/ReportController.php`

**What's slow (line by line):**
- Line 126: `->with(['reseller:id,name', 'program:id,name'])->get()` — loads ALL tenant licenses + 2 relationships into memory
- Lines 23–44: 4 PHP-side aggregations (sum, count, groupBy reseller, groupBy program) on full collection
- Lines 134–144: `monthlyRevenue()` — PHP 6-month loop filtering full collection
- Lines 147–185: `resellerBalances()` — `whereHas('user', ...)` slow subquery; fallback loops ALL users × ALL licenses
- Lines 53–56: `activationRate()` — PHP `.where('status')` filter on full collection
- Lines 68–81: `retention()` — PHP 6-month loop filtering full collection per month
- Line 191: `recentActivityData()` — `limit(100)->get()->take(10)` fetches 100 rows but only uses 10

**What to change:**

| Method | Old | New |
|--------|-----|-----|
| `index()` summary | PHP `.sum()` / `.count()` | Single SQL: `SUM(CASE WHEN status='active' THEN 1 ELSE 0 END)` + `ROUND(SUM(price),2)` |
| `revenue_by_reseller` | PHP `groupBy(reseller.name)` | SQL: `LEFT JOIN users AS resellers + GROUP BY reseller_id` |
| `revenue_by_program` | PHP `groupBy(program.name)` | SQL: `LEFT JOIN programs + GROUP BY program_id` |
| `monthly_revenue` | PHP loop on 6 months | SQL: `DATE_FORMAT + GROUP BY` last 6 months |
| `activationRate()` | PHP `.where('status')` | SQL: `SUM(CASE WHEN status='active' THEN 1 ELSE 0 END)` |
| `retention()` | PHP 6-month loop | SQL: `DATE_FORMAT + GROUP BY + COUNT(DISTINCT customer_id)` |
| `resellerBalances()` | `whereHas()` subquery | Add `where('tenant_id', $tenantId)` directly on UserBalance |
| `recentActivityData()` | `limit(100)->get()->take(10)` | `->limit(10)->get()` |
| `filteredLicenses()` | Returns full collection | Return query builder (not `.get()`) or inline per method |

**Checklist:**
- [ ] Rewrite `index()` with 4 separate SQL aggregate queries (summary, by_reseller, by_program, monthly_revenue)
- [ ] Rewrite `activationRate()` — SQL CASE WHEN aggregation
- [ ] Rewrite `retention()` — SQL DATE_FORMAT + GROUP BY + COUNT(DISTINCT customer_id), last 6 months
- [ ] Fix `resellerBalances()` — direct `where('tenant_id')` on UserBalance (remove `whereHas`)
- [ ] Fix `recentActivityData()` — change `limit(100)->get()->take(10)` → `limit(10)->get()`
- [ ] Change `filteredLicenses()` to return Builder or remove it
- [ ] Verify `exportCsv()` / `exportPdf()` still work ✅
- [ ] Add `Cache::remember()` (see A9 below)
- [ ] Test: Manager reports page loads < 1s

---

### A5. Fix Manager Parent ReportController — PHP → SQL Aggregation

**Priority**: HIGH
**File**: `backend/app/Http/Controllers/ManagerParent/ReportController.php`

**What's slow (line by line):**
- Line 120: `->with(['program:id,name', 'reseller:id,name'])->get()` — loads ALL tenant licenses into memory
- Lines 15–27: `revenueByReseller()` — PHP `groupBy(reseller.name)` on full collection
- Lines 30–44: `revenueByProgram()` — PHP `groupBy(program.name)` on full collection
- Lines 47–59: `activationRate()` — PHP `.where('status', 'active')` on full collection
- Lines 62–78: `retention()` — PHP 6-month loop filtering full collection per month

**What to change:**

| Method | Old | New |
|--------|-----|-----|
| `revenueByReseller()` | PHP groupBy on collection | SQL: `LEFT JOIN users + GROUP BY reseller_id + ORDER BY revenue DESC` |
| `revenueByProgram()` | PHP groupBy on collection | SQL: `LEFT JOIN programs + GROUP BY program_id + ORDER BY revenue DESC` |
| `activationRate()` | PHP `.where('status')` filter | SQL: `SUM(CASE WHEN status='active' THEN 1 ELSE 0 END)` |
| `retention()` | PHP 6-month loop | SQL: `DATE_FORMAT + GROUP BY + COUNT(DISTINCT customer_id)` |
| `filteredLicenses()` | Returns full collection | Return query builder (not `.get()`) |

**Checklist:**
- [ ] Rewrite `revenueByReseller()` with SQL LEFT JOIN users + GROUP BY + ORDER BY revenue DESC
- [ ] Rewrite `revenueByProgram()` with SQL LEFT JOIN programs + GROUP BY + ORDER BY revenue DESC
- [ ] Rewrite `activationRate()` with SQL CASE WHEN aggregate
- [ ] Rewrite `retention()` with SQL DATE_FORMAT + GROUP BY for last 6 months + COUNT(DISTINCT customer_id)
- [ ] Ensure `where('tenant_id', $tenantId)` is in each query (currently came from `filteredLicenses()`)
- [ ] Change `filteredLicenses()` to return Builder or remove it
- [ ] Verify `exportSections()` still works ✅
- [ ] Add `Cache::remember()` (see A10 below)
- [ ] Test: Manager Parent reports page loads < 1s

---

### A6. Fix Super Admin DashboardController — PHP → SQL Aggregation

**Priority**: HIGH
**File**: `backend/app/Http/Controllers/SuperAdmin/DashboardController.php`

**What's slow (line by line):**
- Lines 17–27: `stats()` IP map — `UserIpLog::query()->whereNotNull('country')->get()` loads ALL IP logs (could be millions!), PHP groups by country, takes top 5
- Lines 47–51: `revenueTrend()` — `License::query()->whereNotNull('activated_at')->get()` loads ALL licenses across ALL tenants (no date filter!), PHP groups by month
- Lines 88–92: `licenseTimeline()` — same: loads ALL licenses, PHP groups by day for 30-day chart
- Lines 105–108: `recentActivity()` — uses `->take(20)` but missing `->limit(20)` before `.get()` (fetches everything, then slices in PHP)

**Note**: `tenantComparison()` already uses `withCount()` + `withSum()` → SQL-side ✅ No change needed.

**What to change:**

| Method | Old | New |
|--------|-----|-----|
| `stats()` IP map | Load ALL IP logs → PHP groupBy | SQL: `SELECT country, COUNT(*) GROUP BY country ORDER BY COUNT(*) DESC LIMIT 5` |
| `revenueTrend()` | Load ALL licenses (no date filter!) → PHP groupBy month | SQL: Add `where('activated_at', '>=', $firstMonth)` + `DATE_FORMAT + GROUP BY + SUM(price)` |
| `licenseTimeline()` | Load ALL licenses (no date filter!) → PHP groupBy day | SQL: Add `where('activated_at', '>=', $thirtyDaysAgo)` + `DATE_FORMAT + GROUP BY + COUNT(*)` |
| `recentActivity()` | `->take(20)->get()` (PHP slice) | `->limit(20)->get()` (SQL limit) + add `->select([...cols])` |

**Checklist:**
- [ ] Fix `stats()` IP map — SQL `SELECT country, COUNT(*) FROM user_ip_logs WHERE country IS NOT NULL GROUP BY country ORDER BY COUNT(*) DESC LIMIT 5`
- [ ] Fix `revenueTrend()` — add `->where('activated_at', '>=', $firstMonth)` before query + use SQL DATE_FORMAT GROUP BY instead of PHP groupBy
- [ ] Fix `licenseTimeline()` — add `->where('activated_at', '>=', now()->subDays(29)->startOfDay())` + use SQL DATE_FORMAT GROUP BY
- [ ] Fix `recentActivity()` — change `->take(20)->get()` to `->limit(20)->select([...])->get()`
- [ ] Add `Cache::remember()` to all methods (see A11 below)
- [ ] Test: Super Admin dashboard loads < 500ms

---

### A7. Fix Super Admin ReportController — PHP → SQL Aggregation

**Priority**: HIGH (WORST OFFENDER — loads ALL licenses from ALL tenants with no filter!)
**File**: `backend/app/Http/Controllers/SuperAdmin/ReportController.php`

**What's slow (line by line):**
- Lines 138–143: `filteredLicenses()` — `License::query()->with(['tenant:id,name', 'reseller:id,name'])->get()` — **NO tenant filter** — loads the ENTIRE `licenses` table across ALL tenants into PHP memory
- Lines 15–27: `revenue()` — PHP `groupBy(tenant.name)` on ALL licenses
- Lines 30–46: `activations()` — PHP `groupBy(tenant.name)` + multiple `.where('status')` calls on ALL licenses
- Lines 79–96: `topResellers()` — PHP `groupBy(reseller.name)` — lazy-loads `reseller` and `tenant` per license
- Lines 66–69: `growth()` — `User::query()->whereBetween(...)->get()->groupBy(fn => $u->created_at->format('Y-m'))` — loads all matching users into PHP then groups

**What to change:**

| Method | Old | New |
|--------|-----|-----|
| `revenue()` | Load ALL licenses → PHP groupBy tenant | SQL: `LEFT JOIN tenants + GROUP BY tenant_id + ROUND(SUM(price),2) ORDER BY revenue DESC` |
| `activations()` | Load ALL → PHP groupBy + PHP where('status') | SQL: `LEFT JOIN tenants + GROUP BY tenant_id + CASE WHEN status` aggregation |
| `topResellers()` | Load ALL → PHP groupBy reseller.name (lazy-loads!) | SQL: `LEFT JOIN users AS resellers + LEFT JOIN tenants + GROUP BY reseller_id + LIMIT 20` |
| `growth()` | Load users in range → PHP groupBy month | SQL: `DATE_FORMAT(created_at, '%Y-%m') + GROUP BY + COUNT(*)` |
| `filteredLicenses()` | Returns ALL licenses (no tenant scope!) | Change to return Builder (not `.get()`); each method adds its selects |

**Checklist:**
- [ ] Rewrite `revenue()` with SQL LEFT JOIN tenants + GROUP BY tenant_id + ORDER BY revenue DESC
- [ ] Rewrite `activations()` with SQL LEFT JOIN tenants + GROUP BY + CASE WHEN status aggregation
- [ ] Rewrite `topResellers()` with SQL LEFT JOIN users + LEFT JOIN tenants + GROUP BY reseller_id + LIMIT 20
- [ ] Rewrite `growth()` with SQL DATE_FORMAT + GROUP BY month
- [ ] Change `filteredLicenses()` to return Builder or remove entirely
- [ ] Verify `exportSections()` still works — calls revenue/activations/growth/topResellers ✅
- [ ] Add `Cache::remember()` (see A11 below)
- [ ] Test: Super Admin reports page loads < 1s

---

### A8. Add Backend Caching to Reseller Report Endpoints

**Priority**: MEDIUM
**File**: `backend/app/Http/Controllers/Reseller/ReportController.php`

Manager and ManagerParent dashboards have `Cache::remember()`. Reseller reports have none. After the SQL rewrite in A3, add caching on top.

**Cache key pattern**: `reseller:{$resellerId}:reports:{$type}:{md5(json_encode($validated))}`

**Checklist:**
- [ ] Add `Cache::remember()` to `revenue()` — TTL 90s, key includes reseller ID + params hash
- [ ] Add `Cache::remember()` to `activations()` — TTL 90s, key varies by params
- [ ] Add `Cache::remember()` to `topPrograms()` — TTL 90s, key varies by date params
- [ ] Verify cache invalidates when licenses are created/deleted (check Reseller LicenseController mutations)

---

### A9. Add Backend Caching to Manager Report Endpoints

**Priority**: MEDIUM
**File**: `backend/app/Http/Controllers/Manager/ReportController.php`

Manager dashboard has caching but Manager reports do not.

**Cache key pattern**: `manager:{$managerId}:reports:{$type}:{md5(json_encode($validated))}`

**Checklist:**
- [ ] Add `Cache::remember()` to `index()` — TTL 90s
- [ ] Add `Cache::remember()` to `activationRate()` — TTL 90s
- [ ] Add `Cache::remember()` to `retention()` — TTL 90s

---

### A10. Add Backend Caching to Manager Parent Report Endpoints

**Priority**: MEDIUM
**File**: `backend/app/Http/Controllers/ManagerParent/ReportController.php`

**Cache key pattern**: `manager-parent:{$tenantId}:reports:{$type}:{md5(json_encode($validated))}`

**Checklist:**
- [ ] Add `Cache::remember()` to `revenueByReseller()` — TTL 90s
- [ ] Add `Cache::remember()` to `revenueByProgram()` — TTL 90s
- [ ] Add `Cache::remember()` to `activationRate()` — TTL 90s
- [ ] Add `Cache::remember()` to `retention()` — TTL 90s

---

### A11. Add Backend Caching to Super Admin Dashboard + Reports

**Priority**: MEDIUM
**Files**:
- `backend/app/Http/Controllers/SuperAdmin/DashboardController.php`
- `backend/app/Http/Controllers/SuperAdmin/ReportController.php`

Super Admin has zero caching anywhere.

**Checklist:**
- [ ] Add `Cache::remember('super-admin:dashboard:stats', 60, fn() => ...)` to `stats()`
- [ ] Add `Cache::remember('super-admin:dashboard:revenue-trend', 60, fn() => ...)` to `revenueTrend()`
- [ ] Add `Cache::remember('super-admin:dashboard:license-timeline', 60, fn() => ...)` to `licenseTimeline()`
- [ ] Add `Cache::remember('super-admin:dashboard:tenant-comparison', 300, fn() => ...)` to `tenantComparison()` (5 min — doesn't change often)
- [ ] Add param-aware `Cache::remember()` to `revenue()`, `activations()`, `topResellers()`, `growth()` in ReportController — TTL 90s

---

### A12. Minor Fix — Manager DashboardController Activity Limit Bug

**Priority**: LOW
**File**: `backend/app/Http/Controllers/Manager/DashboardController.php` (line ~191)

**Problem:**
```php
// Current (BAD — fetches 100 rows from DB, discards 90):
->limit(100)->get()->take(10)

// Fix (GOOD — fetches exactly 10):
->limit(10)->get()
```

**Checklist:**
- [ ] Find `->limit(100)->get()->take(10)` in `recentActivityData()`
- [ ] Change to `->limit(10)->get()`

---

## SECTION B — FRONTEND FIXES (Lower Priority)

---

### B1. Super Admin Service — Add Frontend Caching

**Priority**: LOW
**File**: `frontend/src/services/super-admin.service.ts`

Reseller, Manager, Manager Parent services have frontend `apiCache` caching. Super Admin does not.

**Checklist:**
- [ ] Read current `frontend/src/services/super-admin.service.ts`
- [ ] Add `import { apiCache } from '@/lib/apiCache'` and `CACHE_TTL` constants
- [ ] Cache dashboard and report methods
- [ ] Add cache invalidation on any mutation methods

---

### B2. Super Admin Customers Page — Check Status Filter Cards

**Priority**: LOW
**File**: `frontend/src/pages/super-admin/Customers.tsx`

Reseller/Manager/ManagerParent have status filter cards. Super Admin uses a different button-based UI.

**Checklist:**
- [ ] Read `frontend/src/pages/super-admin/Customers.tsx`
- [ ] If ExpiryAlert cards still exist → replace with StatusFilterCard (same pattern as other roles)
- [ ] If button-based filtering already works → confirm it's correct and leave as-is

---

## SECTION C — DATABASE & INFRASTRUCTURE

---

### C1. Run and Verify All Migrations

**Priority**: CRITICAL — Do this before any backend testing

```bash
# From backend/ directory:
php artisan migrate:status
php artisan migrate
php artisan cache:clear
```

Then verify in MySQL:
```sql
SHOW INDEX FROM licenses;
-- Must see: licenses_reseller_activated_at_idx
-- Must see: licenses_tenant_reseller_activated_at_idx
-- Must see: licenses_status_idx
-- Must see: licenses_tenant_reseller_idx
-- etc.
```

**Checklist:**
- [ ] All migrations show "Ran" in `migrate:status`
- [ ] New index `licenses_reseller_activated_at_idx` visible in MySQL
- [ ] Cache cleared

---

### C2. Check Laravel Cache Driver (Optional Redis Upgrade)

**Priority**: LOW — File cache works; Redis is optional

```bash
grep CACHE_DRIVER backend/.env
```

**Checklist:**
- [ ] If `CACHE_DRIVER=file` → acceptable, no change needed
- [ ] If Redis available on Laragon → set `CACHE_DRIVER=redis` for ~10x cache speed
- [ ] After `.env` change → `php artisan config:clear`

---

## SECTION D — TESTING & VERIFICATION

---

### D1. Performance Test — API Response Times

Open DevTools (F12) → Network tab → filter by Fetch/XHR. Load each page fresh (Ctrl+Shift+R).

**Target response times after all fixes:**

| Endpoint | Target |
|----------|--------|
| Reseller `/dashboard/stats` | < 300ms |
| Reseller `/dashboard/activations-chart` | < 300ms |
| Reseller `/dashboard/revenue-chart` | < 300ms |
| Reseller `/reports/revenue` | < 500ms |
| Reseller `/reports/activations` | < 500ms |
| Reseller `/reports/top-programs` | < 500ms |
| Manager `/dashboard` (combined) | < 500ms |
| Manager `/reports` | < 500ms |
| Manager Parent `/dashboard` (combined) | < 500ms |
| Manager Parent `/reports/revenue-by-reseller` | < 500ms |
| Super Admin `/dashboard/stats` | < 500ms |
| Super Admin `/dashboard/revenue-trend` | < 500ms |
| Super Admin `/dashboard/license-timeline` | < 500ms |
| Super Admin `/reports/revenue` | < 1s |

**Checklist:**
- [ ] All endpoints meet targets
- [ ] Reload same page — second load < 100ms (using frontend cache)
- [ ] No requests show > 2s

---

### D2. Functional Test — Dashboard Charts Show Data

**Checklist:**
- [ ] Reseller Dashboard: Activation Trend chart shows 12 months of data
- [ ] Reseller Dashboard: Revenue Trend chart shows 12 months of data
- [ ] Manager Dashboard: Team Activations chart loads
- [ ] Manager Dashboard: Team Revenue chart (by reseller) loads
- [ ] Manager Parent Dashboard: Revenue chart loads
- [ ] Manager Parent Dashboard: Expiry Forecast chart loads
- [ ] Manager Parent Dashboard: Team Performance chart loads
- [ ] Manager Parent Dashboard: Conflict Rate chart loads
- [ ] Super Admin Dashboard: Revenue Trend (12 months) loads
- [ ] Super Admin Dashboard: License Timeline (30 days) loads
- [ ] Super Admin Dashboard: Tenant Comparison loads
- [ ] Skeleton loaders appear during loading (no blank white screens)

---

### D3. Functional Test — Reports Pages

**Checklist:**
- [ ] Reseller Reports: Revenue chart shows data
- [ ] Reseller Reports: Activations chart shows data
- [ ] Reseller Reports: Top Programs shows data
- [ ] Reseller Reports: Changing date range (from/to) updates charts
- [ ] Reseller Reports: Period toggle (daily/weekly/monthly) works
- [ ] Manager Reports: All sections load (summary, by reseller, by program, monthly revenue, reseller balances)
- [ ] Manager Parent Reports: Revenue by Reseller loads
- [ ] Manager Parent Reports: Revenue by Program loads
- [ ] Manager Parent Reports: Activation Rate loads
- [ ] Manager Parent Reports: Retention chart loads
- [ ] Super Admin Reports: Revenue by Tenant loads
- [ ] Super Admin Reports: Activations by Tenant loads
- [ ] Super Admin Reports: Top Resellers loads
- [ ] Super Admin Reports: User Growth chart loads

---

### D4. Functional Test — Status Filter Cards (All Roles)

**Checklist:**
- [ ] Reseller Customers: Click "Active" → table shows active only, URL = `?status=active`
- [ ] Reseller Customers: Click "Expired" → table shows expired only
- [ ] Reseller Customers: Click "All" → all customers shown
- [ ] Active card has visible highlight (ring border)
- [ ] Same for Manager Customers
- [ ] Same for Manager Parent Customers
- [ ] Arabic/RTL mode: all cards render correctly

---

### D5. Edge Case Tests

**Checklist:**
- [ ] Reseller with 0 licenses → dashboard shows zeros, no errors
- [ ] Reseller with many licenses → dashboard still < 500ms (SQL handles scale)
- [ ] Date range with no data → charts show empty state gracefully (no crash)
- [ ] Cache invalidation: create a license → dashboard stats update within 90s
- [ ] Export CSV/PDF still works after report controller rewrites

---

## 📁 Complete File Reference

### Backend — Pending Changes

| File | Action | Priority |
|------|--------|----------|
| `backend/database/migrations/2026_03_11_000000_add_reseller_activation_index.php` | CREATE | CRITICAL |
| `backend/app/Http/Controllers/Reseller/ReportController.php` | REWRITE — SQL + cache | CRITICAL |
| `backend/app/Http/Controllers/SuperAdmin/DashboardController.php` | REWRITE — SQL + cache | HIGH |
| `backend/app/Http/Controllers/SuperAdmin/ReportController.php` | REWRITE — SQL + cache | HIGH |
| `backend/app/Http/Controllers/Manager/ReportController.php` | REWRITE — SQL + cache | HIGH |
| `backend/app/Http/Controllers/ManagerParent/ReportController.php` | REWRITE — SQL + cache | HIGH |
| `backend/app/Http/Controllers/Manager/DashboardController.php` | Minor fix only (limit 100→10) | LOW |

### Frontend — Pending Changes

| File | Action | Priority |
|------|--------|----------|
| `frontend/src/services/super-admin.service.ts` | Add frontend caching | LOW |
| `frontend/src/pages/super-admin/Customers.tsx` | Check + add status cards if needed | LOW |

### Already Done ✅

| File | What Was Done |
|------|--------------|
| `backend/app/Http/Controllers/Reseller/DashboardController.php` | SQL aggregations + Cache::remember() |
| `backend/app/Http/Controllers/Manager/DashboardController.php` | Was already optimized ✅ |
| `backend/app/Http/Controllers/ManagerParent/DashboardController.php` | Was already optimized ✅ |
| `frontend/src/lib/apiCache.ts` | Created — client-side caching service |
| `frontend/src/lib/queryClient.ts` | Updated — React Query optimized config |
| `frontend/src/services/reseller.service.ts` | Frontend caching + invalidation |
| `frontend/src/services/manager.service.ts` | Frontend caching |
| `frontend/src/services/manager-parent.service.ts` | Frontend caching |
| `frontend/src/pages/reseller/Dashboard.tsx` | Skeleton loaders |
| `frontend/src/pages/manager/Dashboard.tsx` | Skeleton loaders |
| `frontend/src/pages/manager-parent/Dashboard.tsx` | Skeleton loaders |
| `frontend/src/components/customers/StatusFilterCard.tsx` | New component |
| `frontend/src/pages/reseller/Customers.tsx` | Status filter cards |
| `frontend/src/pages/manager/Customers.tsx` | Status filter cards |
| `frontend/src/pages/manager-parent/Customers.tsx` | Status filter cards |

---

## 🚀 Implementation Order

| # | Task | Est. Time | Why This Order |
|---|------|-----------|----------------|
| 1 | A1 — Create reseller index migration | 5 min | Speeds up all reseller queries |
| 2 | C1 — Run `php artisan migrate` + verify | 5 min | Must be done before testing |
| 3 | A3 — Fix Reseller ReportController | 30 min | Biggest user-visible win (reports were timing out) |
| 4 | A8 — Add cache to Reseller reports | 10 min | Stack on top of A3 |
| 5 | A7 — Fix Super Admin ReportController | 30 min | Worst offender (loads ALL licenses, all tenants!) |
| 6 | A6 — Fix Super Admin DashboardController | 20 min | Super Admin dashboard also slow |
| 7 | A11 — Add cache to Super Admin | 10 min | Stack on A6/A7 |
| 8 | A4 — Fix Manager ReportController | 30 min | Manager reports slow |
| 9 | A5 — Fix Manager Parent ReportController | 20 min | Same issue |
| 10 | A9, A10 — Add cache to Manager/ManagerParent reports | 10 min | Stack on A4/A5 |
| 11 | A12 — Fix Manager Dashboard limit bug | 2 min | Quick fix |
| 12 | C2 — Check Redis | 5 min | Optional optimization |
| 13 | B1, B2 — Super Admin frontend (caching + status cards) | 20 min | Low priority polish |
| 14 | D1–D5 — Full testing pass | 30 min | Final verification |

**Total: ~3 hours**

---

## 💡 SQL Patterns (Ready to Use in Implementation)

### Period Grouping (Revenue & Activations Charts)
```sql
-- Daily
DATE_FORMAT(activated_at, '%Y-%m-%d') as period

-- Weekly (Monday = week start, same as Carbon::startOfWeek())
DATE_FORMAT(DATE_SUB(activated_at, INTERVAL WEEKDAY(activated_at) DAY), '%Y-%m-%d') as period

-- Monthly
DATE_FORMAT(activated_at, '%Y-%m') as period
```

### Aggregate Stats in One Query
```sql
SELECT
    COUNT(DISTINCT customer_id) as customers,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_licenses,
    ROUND(SUM(price), 2) as revenue,
    SUM(CASE WHEN activated_at >= ? THEN 1 ELSE 0 END) as monthly_activations
FROM licenses
WHERE reseller_id = ?
```

### Top N Groups (replaces PHP groupBy)
```sql
SELECT COALESCE(programs.name, 'Unknown') as program,
       COUNT(*) as count,
       ROUND(SUM(licenses.price), 2) as revenue
FROM licenses
LEFT JOIN programs ON licenses.program_id = programs.id
WHERE licenses.reseller_id = ?
  AND licenses.activated_at IS NOT NULL
GROUP BY licenses.program_id, programs.name
ORDER BY revenue DESC
```

### Country Count (replaces UserIpLog PHP groupBy)
```sql
SELECT country, COUNT(*) as count
FROM user_ip_logs
WHERE country IS NOT NULL
GROUP BY country
ORDER BY count DESC
LIMIT 5
```

### Laravel Cache with Param-Aware Key
```php
$paramHash = md5(json_encode($validated));
$cacheKey = "reseller:{$resellerId}:reports:revenue:{$paramHash}";

return Cache::remember($cacheKey, 90, function () use ($resellerId, $validated): array {
    // SQL query here — runs only on cache miss
});
```

---

## 📊 Expected Results After All Fixes

| Metric | Before | After |
|--------|--------|-------|
| Dashboard load (1st visit) | 3–5s | < 300ms |
| Dashboard load (cached repeat) | 3–5s | < 50ms |
| Reports load (1st visit) | 5–10s | < 500ms |
| Reports load (cached) | 5–10s | < 100ms |
| Super Admin reports | Timeout / 10s+ | < 1s |
| Scale: 50,000 license reseller | Crash / OOM | Handles easily (SQL aggregate) |
| UX during loading | Blank screen | Skeleton loaders |
| Customer page filtering | Old expiry cards | Status filter cards |
| MySQL index usage | Full table scans | Index-only lookups |
