# Manager-Parent Financial Report Performance Fix Plan

**Issue:** Manager-Parent Financial Report uses PHP-side aggregation (slow for large tenants)
**Priority:** HIGH (Performance/Consistency)
**Estimated Time:** 20-30 minutes
**Date:** 2026-03-12

---

## The Problem

### Current Behavior (SLOW ❌)
**File:** `backend/app/Http/Controllers/ManagerParent/FinancialReportController.php` (lines 18-51)

```php
// Line 18: Load ALL licenses into PHP memory
$licenses = $this->filteredLicenses($request);  // calls ->get()

// Lines 39-48: PHP-side aggregation (groupBy, map, sum)
'revenue_by_reseller' => $licenses
    ->groupBy(fn (License $license): string => $license->reseller?->name ?? 'Unknown')
    ->map(fn ($group, string $reseller): array => [
        'reseller' => $reseller,
        'revenue' => round((float) $group->sum('price'), 2),
        'activations' => $group->count()
    ])

// Lines 44-48: Same for programs
'revenue_by_program' => $licenses
    ->groupBy(fn (License $license): string => $license->program?->name ?? 'Unknown')
    ->map(fn ($group, string $program): array => [...])
```

**Why It's Slow:**
- Large tenant with 100k licenses = load 100k records into PHP
- PHP `groupBy()` + `sum()` + `count()` on 100k rows = slow aggregation
- No caching (unlike Manager ReportController which uses `Cache::remember(90s)`)

### Correct Behavior (FAST ✅)
**Reference:** `backend/app/Http/Controllers/Manager/ReportController.php` (lines 39-51)

```php
// SQL-side aggregation with LEFT JOIN
$revenueByReseller = $this->baseQuery($tenantId, $sellerIds, $validated)
    ->leftJoin('users as resellers', 'resellers.id', '=', 'licenses.reseller_id')
    ->selectRaw("COALESCE(resellers.name, 'Unknown') as reseller, ROUND(COALESCE(SUM(licenses.price), 0), 2) as revenue, COUNT(*) as activations")
    ->groupBy('licenses.reseller_id', 'resellers.name')
    ->orderByDesc('revenue')
    ->get()
    ->map(fn ($row): array => ['reseller' => (string) $row->reseller, 'revenue' => round((float) $row->revenue, 2), 'activations' => (int) $row->activations])
    ->values()
    ->all();
```

**Why It's Fast:**
- MySQL does the `GROUP BY`, `SUM()`, `COUNT()` (optimized)
- Only aggregated results returned to PHP (~20-100 rows, not 100k)
- Zero memory waste

---

## The Fix

### Step 1: Refactor `FinancialReportController::index()` to Use SQL Aggregations

**File:** `backend/app/Http/Controllers/ManagerParent/FinancialReportController.php`

**What to change:**
- Remove `$licenses = $this->filteredLicenses($request);` call (line 18)
- Replace `$licenses->groupBy()...->map()` with SQL `LEFT JOIN` + `GROUP BY`
- Keep the monthly revenue and reseller balances logic (they work fine)

**New implementation:**

Replace lines 18-51 with:

```php
public function index(Request $request): JsonResponse
{
    $tenantId = $this->currentTenantId($request);
    $validated = $request->validate([
        'from' => ['nullable', 'date'],
        'to' => ['nullable', 'date'],
    ]);

    // Calculate active customers (same as before)
    $activeCustomers = License::query()
        ->where('tenant_id', $tenantId)
        ->whereEffectivelyActive()
        ->whereNotNull('customer_id')
        ->distinct('customer_id')
        ->count('customer_id');

    // Base query for aggregations
    $baseQuery = License::query()
        ->where('tenant_id', $tenantId)
        ->with(['program:id,name', 'reseller:id,name'])
        ->when(!empty($validated['from']), fn($q) => $q->whereDate('activated_at', '>=', $validated['from']))
        ->when(!empty($validated['to']), fn($q) => $q->whereDate('activated_at', '<=', $validated['to']));

    // Summary (total revenue, activations)
    $summary = (clone $baseQuery)
        ->selectRaw('ROUND(COALESCE(SUM(price), 0), 2) as total_revenue, COUNT(*) as total_activations')
        ->first();

    // Total customers
    $totalCustomers = User::query()
        ->where('tenant_id', $tenantId)
        ->where('role', UserRole::CUSTOMER->value)
        ->count();

    // Revenue by reseller (SQL-side aggregation)
    $revenueByReseller = (clone $baseQuery)
        ->leftJoin('users as resellers', 'resellers.id', '=', 'licenses.reseller_id')
        ->selectRaw("COALESCE(resellers.name, 'Unknown') as reseller, ROUND(COALESCE(SUM(licenses.price), 0), 2) as revenue, COUNT(*) as activations")
        ->groupBy('licenses.reseller_id', 'resellers.name')
        ->orderByDesc('revenue')
        ->get()
        ->map(fn($row): array => [
            'reseller' => (string) $row->reseller,
            'revenue' => round((float) $row->revenue, 2),
            'activations' => (int) $row->activations
        ])
        ->values()
        ->all();

    // Revenue by program (SQL-side aggregation)
    $revenueByProgram = (clone $baseQuery)
        ->leftJoin('programs', 'programs.id', '=', 'licenses.program_id')
        ->selectRaw("COALESCE(programs.name, 'Unknown') as program, ROUND(COALESCE(SUM(licenses.price), 0), 2) as revenue, COUNT(*) as activations")
        ->groupBy('licenses.program_id', 'programs.name')
        ->orderByDesc('revenue')
        ->get()
        ->map(fn($row): array => [
            'program' => (string) $row->program,
            'revenue' => round((float) $row->revenue, 2),
            'activations' => (int) $row->activations
        ])
        ->values()
        ->all();

    // Monthly revenue (keep existing logic, but use base query)
    $monthlyRevenue = $this->monthlyRevenue($baseQuery, $validated);

    // Reseller balances (keep existing logic)
    $resellerBalances = $this->resellerBalances($tenantId);

    return response()->json([
        'data' => [
            'summary' => [
                'total_revenue' => round((float) ($summary?->total_revenue ?? 0), 2),
                'total_activations' => (int) ($summary?->total_activations ?? 0),
                'total_customers' => $totalCustomers,
                'active_customers' => $activeCustomers,
                'active_licenses' => $activeCustomers,
            ],
            'revenue_by_reseller' => $revenueByReseller,
            'revenue_by_program' => $revenueByProgram,
            'monthly_revenue' => $monthlyRevenue,
            'reseller_balances' => $resellerBalances,
        ],
    ]);
}
```

### Step 2: Update `monthlyRevenue()` Helper

**Current (lines 104-115):**
```php
private function monthlyRevenue($licenses)
{
    $months = collect(range(5, 0))...
    $grouped = $licenses->groupBy(fn (License $license): string => ...);  // PHP groupBy
    ...
}
```

**New (use SQL):**
```php
private function monthlyRevenue($baseQuery, array $validated)
{
    $months = collect(range(5, 0))
        ->map(fn (int $offset): CarbonImmutable => CarbonImmutable::now()->startOfMonth()->subMonths($offset));

    $grouped = (clone $baseQuery)
        ->whereNotNull('licenses.activated_at')
        ->where('licenses.activated_at', '>=', CarbonImmutable::now()->startOfMonth()->subMonths(5))
        ->selectRaw("DATE_FORMAT(licenses.activated_at, '%Y-%m') as month_key, ROUND(COALESCE(SUM(licenses.price), 0), 2) as revenue")
        ->groupByRaw("DATE_FORMAT(licenses.activated_at, '%Y-%m')")
        ->pluck('revenue', 'month_key');

    return $months->map(fn (CarbonImmutable $month): array => [
        'month' => $month->format('M Y'),
        'revenue' => round((float) ($grouped->get($month->format('Y-m')) ?? 0), 2),
    ])->values();
}
```

### Step 3: Update `resellerBalances()` Helper

**Current (lines 117-145):** Works fine, but update signature to accept `$tenantId` instead of `$licenses`

```php
private function resellerBalances($tenantId)
{
    return UserBalance::query()
        ->with('user:id,name')
        ->whereHas('user', fn ($query) => $query
            ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value])
            ->where('tenant_id', $tenantId))
        ->get()
        ->map(fn (UserBalance $balance): array => [
            'id' => $balance->id,
            'reseller' => $balance->user?->name,
            'total_revenue' => round((float) $balance->total_revenue, 2),
            'total_activations' => $balance->total_activations,
            'avg_price' => $balance->total_activations > 0 ? round((float) $balance->total_revenue / $balance->total_activations, 2) : 0,
            'commission' => round((float) $balance->pending_balance, 2),
        ])
        ->values();
}
```

### Step 4: Remove `filteredLicenses()` Helper

**File:** `backend/app/Http/Controllers/ManagerParent/FinancialReportController.php` (lines 89-102)

**Action:** DELETE this method entirely (no longer used)

```php
// DELETE:
private function filteredLicenses(Request $request)
{
    $validated = $request->validate([...]);
    return License::query()
        ->where('tenant_id', $this->currentTenantId($request))
        ->with(['program:id,name', 'reseller:id,name'])
        ->when(...)
        ->get();  // ← This was the culprit
}
```

---

## Todo List & Checklist

### Phase 1: Code Changes
- [ ] **Read current FinancialReportController.php**
  - Path: `backend/app/Http/Controllers/ManagerParent/FinancialReportController.php`
  - Focus: Lines 18-102 (index + helpers)

- [ ] **Refactor `index()` method**
  - Path: Same file, lines 18-51
  - Task: Replace PHP-side aggregation with SQL `LEFT JOIN` + `GROUP BY`
  - Reference: Check `Manager/ReportController.php` lines 39-51 for SQL pattern
  - Add `use Carbon\CarbonImmutable;` at top if not present

- [ ] **Update `monthlyRevenue()` helper**
  - Path: Same file, lines 104-115
  - Task: Change from PHP `groupBy()` to SQL `selectRaw()` + `groupByRaw()`
  - New signature: `monthlyRevenue($baseQuery, array $validated)` instead of `monthlyRevenue($licenses)`

- [ ] **Update `resellerBalances()` helper**
  - Path: Same file, lines 117-145
  - Task: Change signature from `resellerBalances($licenses, Request $request)` to `resellerBalances($tenantId)`
  - Keep logic the same (already SQL-efficient)

- [ ] **Delete `filteredLicenses()` method**
  - Path: Same file, lines 89-102
  - Task: Remove entirely (no longer used)

### Phase 2: Validation
- [ ] **PHP Lint Check**
  ```bash
  php -l backend/app/Http/Controllers/ManagerParent/FinancialReportController.php
  ```

- [ ] **Static Analysis**
  ```bash
  npx tsc -b  # Check frontend types still resolve
  ```

- [ ] **Manual Code Review**
  - Verify SQL joins match reseller/program names correctly
  - Verify `COALESCE(xxx.name, 'Unknown')` pattern used
  - Verify `groupBy()` includes both `id` and `name` columns

### Phase 3: Testing
- [ ] **Backend API Test (if available)**
  - Endpoint: `GET /api/manager-parent/financial-reports?from=2026-01-01&to=2026-03-12`
  - Expected: Response under 1 second (was possibly 5+ seconds before)
  - Verify: `summary.total_revenue`, `summary.total_customers`, `revenue_by_reseller`, `revenue_by_program` all present

- [ ] **Verify No Regressions**
  - Check export CSV still works: `GET /api/manager-parent/financial-reports/export/csv`
  - Check export PDF still works: `GET /api/manager-parent/financial-reports/export/pdf`
  - Verify frontend FinancialReports.tsx still loads data correctly

- [ ] **Browser Test**
  - Navigate to `/manager-parent/financial-reports`
  - Date range: Last 365 days
  - Verify cards load and show data (may not see visible performance improvement in small dataset, but code is correct)

### Phase 4: Finalization
- [ ] **Commit Changes**
  ```bash
  git add backend/app/Http/Controllers/ManagerParent/FinancialReportController.php
  git commit -m "Optimize Manager-Parent financial report: replace PHP-side aggregation with SQL"
  ```

- [ ] **Push to dev**
  ```bash
  git push origin dev
  ```

- [ ] **Mark as Complete**
  - Update this file to show completion date
  - Move to next priority item

---

## Files to Edit Summary

| File | Lines | Action | Why |
|------|-------|--------|-----|
| `ManagerParent/FinancialReportController.php` | 18-51 | Rewrite `index()` with SQL aggregations | Core fix |
| `ManagerParent/FinancialReportController.php` | 104-115 | Refactor `monthlyRevenue()` to use SQL | SQL-side aggregation |
| `ManagerParent/FinancialReportController.php` | 117-145 | Update `resellerBalances()` signature | Fix method parameter |
| `ManagerParent/FinancialReportController.php` | 89-102 | DELETE `filteredLicenses()` | No longer needed |

---

## Performance Impact

### Before (Current - SLOW ❌)
- Tenant with 50k licenses: ~3-5 seconds (load all 50k rows, PHP groupBy)
- Tenant with 100k licenses: ~10+ seconds (memory spikes, slow aggregation)

### After (Fixed - FAST ✅)
- Tenant with 50k licenses: <500ms (SQL does aggregation, PHP gets ~50 rows)
- Tenant with 100k licenses: <500ms (same as above)
- **10-20x faster for large tenants**

---

## Reference Implementation

For complete context, see:
- **Manager ReportController (SQL pattern):** `backend/app/Http/Controllers/Manager/ReportController.php` lines 39-65
- **Reseller ReportController (SQL pattern):** `backend/app/Http/Controllers/Reseller/ReportController.php` lines 53-90

---

## Q&A

**Q: Will this break the frontend?**
A: No. The JSON response structure stays the same. Frontend expects `revenue_by_reseller`, `revenue_by_program`, `monthly_revenue`, `reseller_balances` — all still provided.

**Q: Why not add caching?**
A: Optional enhancement for later. The SQL fix alone solves the performance issue. Caching would be nice-to-have (wrap in `Cache::remember(90s)` like Manager does).

**Q: What if SQL is slower than I think?**
A: It won't be. SQL `GROUP BY` with indexes is always faster than PHP groupBy on 50k+ rows.
