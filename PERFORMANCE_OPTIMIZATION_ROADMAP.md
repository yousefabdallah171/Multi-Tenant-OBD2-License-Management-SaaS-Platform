# OBD2SW License Platform - Performance Optimization Roadmap
**Status**: Phase 14+ Planning | **Priority**: Critical for Production

---

## Executive Summary

### Current Performance Issues
- **Backend**: 11 critical issues found (N+1 queries, missing indexes, inefficient pagination)
- **Frontend**: Suboptimal React Query usage, unnecessary renders, bundle size
- **Overall Impact**: Pages loading 5-10x slower than optimal

---

## BACKEND PERFORMANCE ISSUES (Priority Order)

### 🔴 CRITICAL - MUST FIX FOR PRODUCTION

#### 1. Customer Index: Loading ALL Customers into Memory
**Severity**: CRITICAL | **Files**: SuperAdmin/Manager/Reseller CustomerController
**Problem**:
```php
// Current: Loads ALL customers, then paginates in PHP
$allCustomers = $query->get();  // Could be 10,000+ records
$customers = $this->paginateCollection($allCustomers->filter(...), $page, $perPage);
```

**Impact**:
- Memory spikes on large datasets
- Page load time: 5-10 seconds+ with 1000+ customers
- All filters happen in PHP, not database

**Fix** (15 min):
```php
// Use database pagination
$customers = $query
    ->where(...filters...)  // Apply filters in database
    ->paginate($perPage);    // Paginate at DB level
```

**Estimate**: 5-10x faster page load for customer lists

---

#### 2. N+1 Queries: BiosBlacklist Check Per License (125-500 extra queries)
**Severity**: CRITICAL | **Files**: CustomerController serialization
**Problem**:
```php
// In serializeCustomer() - called for EACH customer
'is_blacklisted' => BiosBlacklist::blocksBios($license->bios_id),  // Query per license!
```

**Impact**:
- 25 customers × 5 licenses = 125 extra queries just for blacklist
- Page load adds 2-5 seconds

**Fix** (20 min):
```php
// Batch load blacklist data
$blacklistedIds = BiosBlacklist::active()
    ->whereIn('bios_id', $biosIds)
    ->pluck('bios_id')
    ->toArray();

// Then in serialization:
'is_blacklisted' => in_array($license->bios_id, $blacklistedIds),
```

**Estimate**: 100-500 queries eliminated, 2-5 second reduction per page

---

#### 3. N+1 Queries: bios_active_elsewhere Check Per License (25-100 extra queries)
**Severity**: CRITICAL | **Files**: License serialization
**Problem**:
```php
// One query per license to check if BIOS active elsewhere
'bios_active_elsewhere' => License::query()
    ->where('bios_id', $license->bios_id)
    ->whereIn('status', ['active', 'suspended'])
    ->exists(),  // Another query!
```

**Impact**:
- 25 customers × 2 licenses = 50 extra queries
- Combined with blacklist = 175 queries for simple page load

**Fix** (25 min):
```php
// Load all active licenses for BIOSes in single query
$activeBiosIds = License::query()
    ->whereIn('bios_id', $biosIds)
    ->whereIn('status', ['active', 'suspended'])
    ->pluck('bios_id')
    ->unique();

// Then in serialization:
'bios_active_elsewhere' => $activeBiosIds->contains($license->bios_id),
```

**Estimate**: 50-100 queries eliminated, 1-3 second reduction

---

#### 4. Missing Database Indexes (9 critical indexes)
**Severity**: CRITICAL | **Files**: migrations
**Problem**: Frequently queried columns don't have composite indexes

**Missing Indexes**:
```sql
-- Add these to a new migration
ALTER TABLE licenses ADD INDEX idx_tenant_customer (tenant_id, customer_id);
ALTER TABLE licenses ADD INDEX idx_tenant_status (tenant_id, status);
ALTER TABLE licenses ADD INDEX idx_program_tenant_activated (program_id, tenant_id, activated_at);
ALTER TABLE activity_logs ADD INDEX idx_user_created (user_id, created_at);
ALTER TABLE activity_logs ADD INDEX idx_tenant_created (tenant_id, created_at);
ALTER TABLE user_ip_logs ADD INDEX idx_user_created (user_id, created_at);
ALTER TABLE bios_blacklist ADD INDEX idx_bios_status (bios_id, status);
ALTER TABLE bios_conflicts ADD INDEX idx_tenant_created (tenant_id, created_at);
ALTER TABLE users ADD INDEX idx_tenant_role (tenant_id, role);
```

**Impact**:
- Query time: 10-100ms → 1-5ms per query
- 5-10 queries per page × 10x faster = massive speedup

**Fix Time**: 5 minutes (just run migration)

---

### 🟡 HIGH - FIX SOON

#### 5. Customer Show Page: 100+ Extra Queries
**Severity**: HIGH | **Files**: SuperAdmin CustomerController::show()
**Problem**: Multiple N+1 issues on detail page:
- BiosBlacklist checks per license
- bios_active_elsewhere checks per license
- IP logs schema column checks repeated 100+ times
- Reseller lazy loading if not eager loaded

**Impact**: Detail page loads 5-10 seconds

**Fix**: Fix issues #2, #3, #4 + proper eager loading

---

#### 6. Dashboard Queries: Multiple Queries Instead of One
**Severity**: HIGH | **Files**: DashboardController
**Problem**:
```php
// Current: 4 separate queries
$day1 = (clone $baseQuery)->where('expires_at', '<=', now()->addDay())->count();
$day3 = (clone $baseQuery)->where('expires_at', '<=', now()->addDays(3))->count();
$day7 = (clone $baseQuery)->where('expires_at', '<=', now()->addDays(7))->count();
$expired = License::query()->whereEffectivelyExpired()->count();
```

**Better Approach**:
```php
// Single query with CASE statements
$stats = License::query()
    ->selectRaw('
        COUNT(CASE WHEN expires_at <= DATE_ADD(NOW(), INTERVAL 1 DAY) THEN 1 END) as day1,
        COUNT(CASE WHEN expires_at <= DATE_ADD(NOW(), INTERVAL 3 DAY) THEN 1 END) as day3,
        COUNT(CASE WHEN expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY) THEN 1 END) as day7
    ')
    ->first();
```

**Impact**: Dashboard loads 4x faster

---

### 🟢 MEDIUM PRIORITY

#### 7. Schema Inspection Caching
**Severity**: MEDIUM | **Impact**: Repeated `Schema::hasColumn()` calls

**Fix**: Cache column existence checks during bootstrap

---

## FRONTEND PERFORMANCE OPTIMIZATIONS

### 🔴 CRITICAL

#### 1. React Query Cache Configuration for Dashboard
**Issue**: Each dashboard re-fetches all data on mount
**Fix**:
```typescript
// Add to each dashboard query
staleTime: 5 * 60 * 1000,  // 5 minutes
gcTime: 15 * 60 * 1000,     // 15 minutes cache
```

#### 2. Code Splitting: Lazy Load Dashboard Pages
**Issue**: All pages bundled together
**Fix**:
```typescript
const SuperAdminDashboard = lazy(() => import('./SuperAdminDashboard'));
const CustomerPage = lazy(() => import('./CustomerPage'));
```

#### 3. Table Virtualization: Large Customer Lists
**Issue**: Rendering 1000 rows causes jank
**Fix**: Use `TanStack Virtual` for customer table

### 🟡 HIGH

#### 4. Memoization: Prevent Unnecessary Re-renders
**Issue**: DataTable re-renders on every parent update
**Fix**: Use `memo()` and `useCallback()`

#### 5. Bundle Analysis
**Current**: ~750KB gzip
**Target**: <600KB gzip (-20%)

---

## IMPLEMENTATION TIMELINE

### Phase 1: Quick Wins (Day 1-2) - 70% of benefit
- Add database indexes (5 min)
- Fix customer pagination (15 min)
- Batch load blacklist (20 min)
- Batch load active elsewhere (25 min)
- **Result**: Customer page 5-10x faster

### Phase 2: Medium Effort (Day 3-4) - 20% of benefit
- Fix customer show page eager loading
- Optimize dashboard queries
- Add React Query cache config
- **Result**: Dashboard pages 3-5x faster

### Phase 3: Polish (Day 5)
- Code splitting
- Table virtualization
- Bundle optimization
- **Result**: Overall 50-70% performance improvement

---

## PERFORMANCE TARGETS

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Customer List Load | 8s | 1.5s | 5.3x faster |
| Customer Detail Load | 6s | 1s | 6x faster |
| Dashboard Load | 5s | 1s | 5x faster |
| Dashboard Metrics | 4 queries | 1 query | 4x faster |
| Frontend Bundle | 750KB | 600KB | 20% smaller |

---

## QUICK IMPLEMENTATION GUIDE

### BACKEND - Create Migration
```php
// database/migrations/2026_03_25_add_performance_indexes.php
Schema::table('licenses', function (Blueprint $table) {
    $table->index(['tenant_id', 'customer_id']);
    $table->index(['tenant_id', 'status']);
});
```

### BACKEND - Fix Customer Controller Pagination
```php
// Old: $this->paginateCollection($allCustomers->filter(...))
// New: $query->where(...)->paginate($perPage)
```

### BACKEND - Batch Load Blacklist
```php
// Load once
$blacklistedBios = BiosBlacklist::active()
    ->whereIn('bios_id', $biosIds)
    ->pluck('bios_id');

// Use in loop
'is_blacklisted' => $blacklistedBios->contains($license->bios_id)
```

### FRONTEND - Add Query Cache
```typescript
useQuery({
  queryKey: ['customers'],
  queryFn: () => customerService.getAll(),
  staleTime: 5 * 60 * 1000,      // ← Add this
  gcTime: 15 * 60 * 1000,         // ← Add this
})
```

---

## EXPECTED RESULTS

### Before Optimization
```
Customer List: 8s load
├─ API Call: 4s (200 queries)
├─ React Render: 2s
└─ Browser Paint: 2s

Customer Detail: 6s load
├─ API Call: 4s (120 queries)
└─ React Render: 2s
```

### After Optimization
```
Customer List: 1.5s load
├─ API Call: 0.5s (2 queries)
├─ React Render: 0.6s
└─ Browser Paint: 0.4s

Customer Detail: 1s load
├─ API Call: 0.3s (3 queries)
└─ React Render: 0.7s
```

**Overall Impact**: 5-6x faster page loads = Better UX, Lower server load, Happier users

---

## Next Steps
1. Review this roadmap with team
2. Prioritize Phase 1 (quick wins)
3. Create performance testing environment
4. Implement fixes one by one
5. Measure improvements with performance tools
