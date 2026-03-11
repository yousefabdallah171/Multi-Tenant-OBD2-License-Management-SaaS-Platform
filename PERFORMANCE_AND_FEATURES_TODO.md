# Performance Issues & Feature Implementation TODO

**Date**: 2026-03-11
**Status**: Analysis Complete - Ready for Implementation
**Priority**: High (Performance & UX Enhancement)

---

## 📋 Executive Summary

Analyzed the OBD2SW.com panel and identified **3 critical performance issues** and **1 feature enhancement**:

1. **Reseller Dashboard** - Activation Trend & Revenue Trend cards loading slowly + not showing data
2. **Reseller Customers Page** - Missing status filter cards (Active, Scheduled, Expired, Cancelled, Pending)
3. **Reseller Reports Page** - Stats cards and charts loading too slowly
4. **Cross-role implementation** - Same fixes needed for Super Admin & Manager reports/dashboards

---

## 🔍 Root Cause Analysis

### Issue 1: Slow Loading Charts & Missing Data

**Affected Pages:**
- `https://panel.obd2sw.com/en/reseller/dashboard` - Activation Trend & Revenue Trend
- `https://panel.obd2sw.com/en/reseller/reports` - Revenue Chart, Activation Count, Top Programs

**Root Causes:**
1. **Multiple API calls without caching** - Each chart makes independent API requests
   - `getActivationsChart()` - `/reseller/dashboard/activations-chart`
   - `getRevenueChart()` - `/reseller/dashboard/revenue-chart`
   - `getRevenueReport()` - `/reseller/reports/revenue`
   - `getActivationsReport()` - `/reseller/reports/activations`
   - `getTopPrograms()` - `/reseller/reports/top-programs`

2. **No skeleton loaders for chart components** - User sees blank/loading state without visual feedback
   - `LineChartWidget` components lack skeleton states
   - `BarChartWidget` components lack skeleton states

3. **No request batching or deduplication** - Dashboard makes 4 separate API calls simultaneously
   - Stats query
   - Activations chart query
   - Revenue chart query
   - Recent activity query

4. **Potential backend query performance issues**
   - No query-level caching mentioned in docs
   - Likely missing database indexes on reporting endpoints
   - Documentation mentions reporting indexes were added (`121_add_reporting_indexes.sql`) but need verification

**Files Involved:**
- Frontend pages: `frontend/src/pages/reseller/Dashboard.tsx`, `frontend/src/pages/reseller/Reports.tsx`
- Service: `frontend/src/services/reseller.service.ts`
- Chart components: `frontend/src/components/charts/LineChartWidget.tsx`, `BarChartWidget.tsx`
- Data queries: React Query hooks in dashboard/reports pages

---

### Issue 2: Missing Status Filter Cards on Customers Page

**Affected Pages:**
- `https://panel.obd2sw.com/en/reseller/customers`
- `https://panel.obd2sw.com/en/super-admin/customers`
- All role-specific customer pages

**Current State:**
- Simple expiration-based status cards (not interactive):
  - "Expire in 1 day" - 0 licenses
  - "Expire in 3 days" - 0 licenses
  - "Expire in 7 days" - 0 licenses
  - "Expired" - 2 licenses

**Required State:**
- Interactive status filter cards (like tabs):
  - "Active" - clickable to filter/navigate
  - "Scheduled" - clickable to filter/navigate
  - "Expired" - clickable to filter/navigate
  - "Cancelled" - clickable to filter/navigate
  - "Pending" - clickable to filter/navigate

**Behavior:**
- Clicking a status card should filter the customer list by that status
- Similar to existing URL-based filtering: `?status=active`
- Visual highlighting of active filter

**Files Involved:**
- `frontend/src/pages/reseller/Customers.tsx` (main file ~84.7KB)
- `frontend/src/pages/super-admin/Customers.tsx`
- `frontend/src/pages/manager-parent/Customers.tsx`
- `frontend/src/pages/manager/Customers.tsx`

---

### Issue 3: Slow Loading on All Reports Pages

**Affected Pages for All Roles:**
1. Reseller: `https://panel.obd2sw.com/en/reseller/reports`
2. Super Admin: `https://panel.obd2sw.com/en/super-admin/reports`
3. Manager Parent: `https://panel.obd2sw.com/en/manager-parent/reports`
4. Manager: `https://panel.obd2sw.com/en/manager/reports`

**Slow Components:**
- Stats Cards: Total Revenue, Total Activations, Avg Price
- Charts: Revenue trend, Activation Count trend, Top Programs by Sales

**Root Causes:**
Same as Issue 1 - multiple API calls, no caching, no skeleton loaders

---

## 📋 TODO List

### Phase 1: Add API Response Caching (Foundation)

**Task 1.1: Implement API Cache Service Enhancement**
- [ ] Review existing `apiCache.ts` implementation
- [ ] Verify cache duration settings (currently 30-60 seconds)
- [ ] Add cache strategies:
  - Dashboard queries: 30-60 second TTL
  - Report queries: 60-120 second TTL (user may change date ranges)
  - Chart data: 30-60 second TTL
- [ ] Add cache key generation based on params (e.g., `reseller:reports:revenue:2026-01-01:2026-03-11:monthly`)
- [ ] Test cache hit rates

**Files to Review:**
- `frontend/src/lib/apiCache.ts`

**Task 1.2: Integrate Caching into Reseller Service**
- [ ] Add cache check before API call in `resellerService`
- [ ] Cache responses from:
  - `getDashboardStats()` - 45 second TTL
  - `getActivationsChart()` - 30 second TTL
  - `getRevenueChart()` - 30 second TTL
  - `getRecentActivity()` - 60 second TTL
  - `getRevenueReport()` - 90 second TTL
  - `getActivationsReport()` - 90 second TTL
  - `getTopPrograms()` - 90 second TTL
- [ ] Implement cache invalidation on mutations (create, update, delete customer/license)

**Files to Modify:**
- `frontend/src/services/reseller.service.ts`

**Task 1.3: Replicate Caching for Other Role Services**
- [ ] Apply same caching strategy to:
  - `frontend/src/services/manager.service.ts`
  - `frontend/src/services/manager-parent.service.ts`
  - `frontend/src/services/super-admin.service.ts` (if exists)

---

### Phase 2: Add Skeleton Loaders for Charts

**Task 2.1: Create Skeleton Components for Charts**
- [ ] Create `ChartSkeletonLoader.tsx` component
  - Display animated placeholder during loading
  - Match dimensions of actual chart
  - Use gradient shimmer effect for visual feedback
- [ ] Create `StatsCardSkeleton.tsx` component for stats cards
- [ ] Add skeleton to `LineChartWidget` component
  - Show skeleton when `isLoading={true}`
  - Smooth transition from skeleton to chart
- [ ] Add skeleton to `BarChartWidget` component

**Files to Create:**
- `frontend/src/components/skeletons/ChartSkeleton.tsx`
- `frontend/src/components/skeletons/StatsCardSkeleton.tsx`

**Files to Modify:**
- `frontend/src/components/charts/LineChartWidget.tsx`
- `frontend/src/components/charts/BarChartWidget.tsx`

**Task 2.2: Update Dashboard Pages with Skeleton States**
- [ ] Import skeleton components into dashboard/reports pages
- [ ] Show skeleton when `isLoading={true}` on queries
- [ ] Test skeleton display during network delays

**Files to Modify:**
- `frontend/src/pages/reseller/Dashboard.tsx`
- `frontend/src/pages/reseller/Reports.tsx`
- `frontend/src/pages/super-admin/Reports.tsx`
- `frontend/src/pages/manager/Reports.tsx`
- `frontend/src/pages/manager-parent/Reports.tsx`

---

### Phase 3: Optimize Query Structure & Request Batching

**Task 3.1: Review React Query Dependencies**
- [ ] Check current query setup in Dashboard.tsx - 4 separate queries:
  - `statsQuery`
  - `activationsQuery`
  - `revenueQuery`
  - `activityQuery`
- [ ] Consider combining stats-related queries if backend supports it
- [ ] Verify query keys are unique and cache-friendly
- [ ] Add query retry logic (default 3 retries, exponential backoff)
- [ ] Add query timeout (30 seconds for dashboard, 60 seconds for reports)

**Files to Modify:**
- `frontend/src/pages/reseller/Dashboard.tsx`
- `frontend/src/pages/reseller/Reports.tsx`

**Task 3.2: Implement Request Deduplication**
- [ ] Ensure React Query deduplicates simultaneous identical requests
- [ ] Test: Open dashboard twice in rapid succession, verify single API call
- [ ] Verify cache invalidation on mutation

---

### Phase 4: Backend Query Optimization (Verification)

**Task 4.1: Verify Database Indexes**
- [ ] Confirm `121_add_reporting_indexes.sql` migration was applied to production
- [ ] Review indexes created:
  - orders: tenant/restaurant/date(+status)
  - order_items: tenant/restaurant/product/date
  - inventory: product/date(+reason)
- [ ] Run EXPLAIN ANALYZE on slow queries:
  - `/reseller/dashboard/activations-chart`
  - `/reseller/dashboard/revenue-chart`
  - `/reseller/reports/revenue`
  - `/reseller/reports/activations`
  - `/reseller/reports/top-programs`

**Task 4.2: Backend Caching Strategy (if applicable)**
- [ ] Check if backend implements Redis/query caching
- [ ] Review backend handler implementations:
  - `backend/internal/handler/http/report_handler.go`
  - `backend/internal/usecase/report_usecase.go`
- [ ] Verify query response times < 2 seconds for cached queries

**Files to Review:**
- `backend/internal/handler/http/report_handler.go`
- `backend/migrations/121_add_reporting_indexes.sql`

---

### Phase 5: Feature - Add Status Filter Cards to Customers Page

**Task 5.1: Update Reseller Customers Page**
- [ ] Replace expiration-based cards with status-based filter cards
- [ ] Create status filter cards component:
  - Display 5 status options: Active, Scheduled, Expired, Cancelled, Pending
  - Show count of licenses in each status
  - Make each card clickable
  - Highlight active filter
  - Similar styling to existing stats cards
- [ ] Implement click handler:
  - Update URL with `?status=<status_name>`
  - Trigger customer list filter
  - Show visual feedback (highlight card, update table)
- [ ] Reuse existing `getLicenseDisplayStatus()` utility for status logic

**Files to Modify:**
- `frontend/src/pages/reseller/Customers.tsx`

**Task 5.2: Update Super Admin Customers Page**
- [ ] Apply same changes to Super Admin customer page

**Files to Modify:**
- `frontend/src/pages/super-admin/Customers.tsx`

**Task 5.3: Update Manager & Manager Parent Customers Pages**
- [ ] Apply same changes to Manager and Manager Parent customer pages

**Files to Modify:**
- `frontend/src/pages/manager/Customers.tsx`
- `frontend/src/pages/manager-parent/Customers.tsx`

**Task 5.4: Verify Status Filter Functionality**
- [ ] Test each status filter shows correct count
- [ ] Test clicking filter updates URL and table
- [ ] Test reset to "all" status
- [ ] Verify RTL/Arabic label support

---

### Phase 6: Cross-Role Implementation

**Task 6.1: Apply Performance Fixes to Super Admin Pages**
- [ ] `frontend/src/pages/super-admin/Dashboard.tsx` (if exists)
- [ ] `frontend/src/pages/super-admin/Reports.tsx`

**Task 6.2: Apply Performance Fixes to Manager Pages**
- [ ] `frontend/src/pages/manager/Dashboard.tsx` (if exists)
- [ ] `frontend/src/pages/manager/Reports.tsx`

**Task 6.3: Apply Performance Fixes to Manager Parent Pages**
- [ ] `frontend/src/pages/manager-parent/Dashboard.tsx` (if exists)
- [ ] `frontend/src/pages/manager-parent/Reports.tsx`

---

### Phase 7: Testing & Verification

**Task 7.1: Performance Testing**
- [ ] Test dashboard load time:
  - Before optimization: Document baseline
  - After optimization: Measure improvement
  - Goal: < 2 second total load with cached data, < 5 seconds on first load
- [ ] Test chart rendering time
- [ ] Test skeleton loader smoothness
- [ ] Monitor API call count (should be reduced by caching)

**Task 7.2: Functionality Testing**
- [ ] Test status filter on each role's customers page
- [ ] Test status filter persists through navigation
- [ ] Test status filter with different date ranges on reports
- [ ] Test RTL/Arabic support for status labels
- [ ] Test mobile responsiveness

**Task 7.3: Data Accuracy Testing**
- [ ] Verify chart data matches API response
- [ ] Verify stats card totals match underlying data
- [ ] Verify status counts are accurate across all roles

---

## 🎯 Success Criteria

### Performance Goals
- [ ] Dashboard loads < 3 seconds on first visit, < 1 second on subsequent visits (cached)
- [ ] Reports page loads < 4 seconds on first visit, < 2 seconds with cached data
- [ ] Chart components show skeleton loaders during loading
- [ ] No blank/white flash during data loading

### Feature Goals
- [ ] Customers page displays status filter cards for Active, Scheduled, Expired, Cancelled, Pending
- [ ] Clicking a status card filters the table and updates URL
- [ ] Status count badges show accurate numbers
- [ ] Active filter is visually highlighted

### Cross-Role Implementation
- [ ] Same fixes applied to Super Admin, Manager, and Manager Parent pages
- [ ] Consistent UX across all roles

---

## 📁 Files Summary

### Frontend Pages (to modify)
```
frontend/src/pages/reseller/Dashboard.tsx
frontend/src/pages/reseller/Reports.tsx
frontend/src/pages/reseller/Customers.tsx

frontend/src/pages/super-admin/Dashboard.tsx
frontend/src/pages/super-admin/Reports.tsx
frontend/src/pages/super-admin/Customers.tsx

frontend/src/pages/manager/Dashboard.tsx
frontend/src/pages/manager/Reports.tsx
frontend/src/pages/manager/Customers.tsx

frontend/src/pages/manager-parent/Dashboard.tsx
frontend/src/pages/manager-parent/Reports.tsx
frontend/src/pages/manager-parent/Customers.tsx
```

### Services (to modify)
```
frontend/src/services/reseller.service.ts
frontend/src/services/manager.service.ts
frontend/src/services/manager-parent.service.ts
frontend/src/services/super-admin.service.ts
```

### Components (to create/modify)
```
frontend/src/components/skeletons/ChartSkeleton.tsx [CREATE]
frontend/src/components/skeletons/StatsCardSkeleton.tsx [CREATE]
frontend/src/components/charts/LineChartWidget.tsx [MODIFY]
frontend/src/components/charts/BarChartWidget.tsx [MODIFY]
```

### Utilities (to review/modify)
```
frontend/src/lib/apiCache.ts [MODIFY]
frontend/src/lib/utils.ts [REVIEW - for getLicenseDisplayStatus()]
```

### Backend (to review)
```
backend/internal/handler/http/report_handler.go [REVIEW]
backend/internal/usecase/report_usecase.go [REVIEW]
backend/migrations/121_add_reporting_indexes.sql [VERIFY]
```

---

## 🚀 Implementation Priority

**High Priority (Critical Performance Issues)**
1. Phase 1: API Response Caching
2. Phase 2: Skeleton Loaders
3. Phase 4: Backend Verification

**Medium Priority (Feature Enhancement)**
1. Phase 5: Status Filter Cards

**Low Priority (Polish)**
1. Phase 3: Query Optimization
2. Phase 6: Cross-role Implementation
3. Phase 7: Testing

---

## 📝 Notes

- API cache TTL values are suggestions; adjust based on business requirements
- Status filter implementation should reuse existing status logic from `getLicenseDisplayStatus()`
- RTL/Arabic support is critical - test with Arabic locale
- Backend query performance is likely the bottleneck - verify indexes and query execution plans
- Consider implementing backend response caching (Redis) for production scale

---

## 🔗 Related Documentation

- Performance Guide: `docs-organized/03-FRONTEND-DASHBOARD/PERFORMANCE/PERFORMANCE_GUIDE.md`
- Reporting System: `docs-organized/04-MODULES/REPORTS/ADVANCED_REPORTING_ANALYTICS_DISCOVERY_AND_PLAN_V0.md`
- Project README: `README.md`
