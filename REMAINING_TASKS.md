# Remaining Tasks After Code Review
> Generated: 2026-03-11 | Status: Post-implementation review

---

## PRIORITY 1 — Critical (Must Fix)

### [ ] P1-1: Super Admin Customers Page — Replace ExpiryAlert Cards with StatusFilterCard
**File:** `frontend/src/pages/super-admin/Customers.tsx`
**Problem:** Still uses old expiry-style info cards (day1/day3/day7/expired) with `expiringQuery`.
Other roles (Reseller, Manager, ManagerParent) already use `StatusFilterCard` with real status counts.

**Current code (lines ~267-271):**
```tsx
<Card><CardContent><p>Expire in 1 day</p><p>{expiringQuery.data?.data.day1 ?? 0}</p></CardContent></Card>
<Card><CardContent><p>Expire in 3 days</p><p>{expiringQuery.data?.data.day3 ?? 0}</p></CardContent></Card>
<Card><CardContent><p>Expire in 7 days</p><p>{expiringQuery.data?.data.day7 ?? 0}</p></CardContent></Card>
<Card><CardContent><p>Expired</p><p>{expiringQuery.data?.data.expired ?? 0}</p></CardContent></Card>
```

**Fix:** Replace with `StatusFilterCard` components matching the pattern in:
- `frontend/src/pages/reseller/Customers.tsx` (reference implementation — confirmed working)
- `frontend/src/pages/manager/Customers.tsx`
- `frontend/src/pages/manager-parent/Customers.tsx`

**Steps:**
1. Read `frontend/src/pages/super-admin/Customers.tsx` fully
2. Read `frontend/src/pages/reseller/Customers.tsx` as reference
3. Remove `expiringQuery` and its `useQuery` hook
4. Add separate `useQuery` per status (active, pending, expired, suspended) reading `meta.total`
5. Replace old cards with `<StatusFilterCard>` components
6. Verify the super admin customer API endpoint supports `?status=` filter param

---

## PRIORITY 2 — Important (Should Fix)

### [ ] P2-1: Reseller DashboardController — Add Cache to recentActivity()
**File:** `backend/app/Http/Controllers/Reseller/DashboardController.php`
**Problem:** `recentActivity()` method has no `Cache::remember()` unlike all other methods in the same file.
Every page load hits DB directly for recent activity.

**Fix:**
```php
public function recentActivity(Request $request): JsonResponse
{
    $resellerId = $this->currentReseller($request)->id;

    $data = Cache::remember("reseller:{$resellerId}:dashboard:recent-activity", 60, function () use ($resellerId): array {
        return ActivityLog::query()
            ->select(['id', 'user_id', 'action', 'description', 'metadata', 'created_at'])
            ->with('user:id,name')
            ->where('user_id', $resellerId)
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (ActivityLog $entry): array => [
                'id' => $entry->id,
                'action' => $entry->action,
                'description' => $entry->description,
                'metadata' => $entry->metadata ?? [],
                'user' => $entry->user ? ['id' => $entry->user->id, 'name' => $entry->user->name] : null,
                'created_at' => $entry->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();
    });

    return response()->json(['data' => $data]);
}
```

---

### [ ] P2-2: Backend Cache Invalidation on Mutations
**Problem:** When licenses/customers are created/updated/deleted, backend `Cache::remember()` results
are NOT explicitly cleared. They expire naturally (45–90s), which means stale data can show briefly
after mutations.

**Files to update (add Cache::forget in mutation handlers):**
- `backend/app/Http/Controllers/Reseller/LicenseController.php` — on store/update/destroy
- `backend/app/Http/Controllers/Manager/LicenseController.php` — on store/update/destroy
- `backend/app/Http/Controllers/ManagerParent/LicenseController.php` — on store/update/destroy
- Any controller with `activate`, `deactivate`, `suspend` methods

**Pattern to add after mutations:**
```php
// After license create/update/delete:
Cache::forget("reseller:{$resellerId}:dashboard:stats");
Cache::forget("reseller:{$resellerId}:dashboard:activations-chart");
Cache::forget("reseller:{$resellerId}:dashboard:revenue-chart");
// Or use pattern-based clearing if using Redis:
// Cache::tags(['reseller:'.$resellerId])->flush();
```

**Note:** Frontend cache already handles this correctly via `apiCache.clearPattern()` on mutations.
Backend invalidation is a secondary improvement for data consistency within the 45-90s window.

---

## PRIORITY 3 — Optional Improvements

### [ ] P3-1: Switch Cache Driver to Redis
**File:** `backend/.env`
**Current:** `CACHE_DRIVER=file`
**Recommended:** `CACHE_DRIVER=redis`

Redis is ~10x faster than file-based caching and supports atomic operations.
Laragon includes Redis — just enable it:
```
CACHE_DRIVER=redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
```

Then run: `php artisan cache:clear`

**Benefit:** All `Cache::remember()` calls become ~0.1ms instead of ~1-5ms for file I/O.

---

### [ ] P3-2: Add Skeleton Loaders to Super Admin Dashboard
**File:** `frontend/src/pages/super-admin/Dashboard.tsx`
**Problem:** Dashboard may show blank/empty state while data loads instead of skeleton placeholders.
Other role dashboards may already have skeletons — verify consistency.

**Check:**
- Does Super Admin Dashboard show skeletons while `isLoading`?
- Compare with `frontend/src/pages/reseller/Dashboard.tsx` skeleton pattern

---

### [ ] P3-3: Performance Timing Benchmarks
Run before/after query timing to validate the SQL rewrite improvements:
```sql
-- In MySQL:
EXPLAIN SELECT DATE_FORMAT(activated_at, '%Y-%m') as month_key, COUNT(*) as total
FROM licenses
WHERE reseller_id = 1
AND activated_at >= '2025-03-01'
GROUP BY DATE_FORMAT(activated_at, '%Y-%m');
```

Check that new index `licenses_reseller_activated_at_idx` is being used (look for `key` column in EXPLAIN output).

---

### [ ] P3-4: Verify Database Migration Was Applied
**File:** `backend/database/migrations/2026_03_11_000000_add_reseller_activation_index.php`

Run and verify:
```bash
php artisan migrate:status
# Should show migration as "Ran"

# Or directly in MySQL:
SHOW INDEX FROM licenses WHERE Key_name LIKE '%reseller%';
```

Expected indexes:
- `licenses_reseller_activated_at_idx` on `(reseller_id, activated_at)`
- `licenses_tenant_reseller_activated_at_idx` on `(tenant_id, reseller_id, activated_at)`

---

## Code Review Summary — What Was Done Well ✅

| Area | Status | Notes |
|------|--------|-------|
| Reseller DashboardController | ✅ Complete | SQL aggregations, Cache::remember (45s/30s) |
| Reseller ReportController | ✅ Complete | periodExpression(), baseQuery(), SQL GROUP BY |
| Manager DashboardController | ✅ Complete | Fixed limit(100)->get()->take(10) → limit(10)->get() |
| Manager ReportController | ✅ Complete | SQL aggregations, tenant-scoped baseQuery, Cache 90s |
| ManagerParent ReportController | ✅ Complete | SQL aggregations, Cache 90s |
| SuperAdmin DashboardController | ✅ Complete | All 5 methods with Cache::remember |
| SuperAdmin ReportController | ✅ Complete | baseLicenseQuery(), SQL JOINs, Cache 90s |
| Database indexes migration | ✅ Created | Composite indexes for reseller+activated_at |
| Frontend report.service.ts (SuperAdmin) | ✅ Complete | apiCache with TTLs matching backend |
| StatusFilterCard — Reseller | ✅ Working | Real API counts via separate useQuery per status |
| StatusFilterCard — Manager | ✅ Working | Confirmed |
| StatusFilterCard — ManagerParent | ✅ Working | Confirmed |

---

## Remaining Issues Summary

| Priority | Task | File | Effort |
|----------|------|------|--------|
| P1 | StatusFilterCard on SuperAdmin Customers | `frontend/src/pages/super-admin/Customers.tsx` | ~1-2h |
| P2 | Add Cache to recentActivity() | `backend/app/Http/Controllers/Reseller/DashboardController.php` | 15min |
| P2 | Backend cache invalidation on mutations | Multiple LicenseController files | ~1h |
| P3 | Switch to Redis cache driver | `backend/.env` | 5min |
| P3 | Verify migration applied | MySQL / artisan | 5min |
| P3 | SuperAdmin Dashboard skeleton loaders | `frontend/src/pages/super-admin/Dashboard.tsx` | ~30min |

---

## Start Here Next Session

**First task:** Fix P1-1 (Super Admin Customers StatusFilterCard replacement)
1. `Read frontend/src/pages/super-admin/Customers.tsx`
2. `Read frontend/src/pages/reseller/Customers.tsx` (reference)
3. Implement StatusFilterCard pattern
