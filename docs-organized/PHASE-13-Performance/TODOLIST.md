# Phase 13 — Performance Optimization Checklist

## PRIORITY 1 — Database Indexes (30–40% improvement, ~5 min each)

- [x] **Add indexes to licenses table**
  - File: `backend/database/migrations/2026_02_28_100300_create_licenses_table.php`
  - OR create new migration: `backend/database/migrations/XXXX_add_indexes_to_licenses_table.php`
  - Add indexes on: `reseller_id`, `customer_id`, `tenant_id`, `status`, `expires_at`
  - Add compound index: `[tenant_id, status]`, `[tenant_id, reseller_id]`

- [x] **Add indexes to activity_logs table**
  - File: `backend/database/migrations/2026_02_28_100500_create_activity_logs_table.php`
  - OR new migration: `backend/database/migrations/XXXX_add_indexes_to_activity_logs_table.php`
  - Add indexes on: `user_id`, `tenant_id`, `created_at`

- [x] **Add indexes to bios_conflicts table**
  - File: `backend/database/migrations/2026_02_28_100800_create_bios_conflicts_table.php`
  - OR new migration: `backend/database/migrations/XXXX_add_indexes_to_bios_conflicts_table.php`
  - Add indexes on: `tenant_id`, `bios_id`, `created_at`

- [x] **Add indexes to user_ip_logs table**
  - File: `backend/database/migrations/2026_02_28_100600_create_user_ip_logs_table.php`
  - OR new migration: `backend/database/migrations/XXXX_add_indexes_to_user_ip_logs_table.php`
  - Add indexes on: `user_id`, `tenant_id`, `ip_address`

---

## PRIORITY 2 — Fix N+1 Queries in Dashboard Controllers (50% improvement)

- [x] **Fix ManagerParent DashboardController — teamPerformance()**
  - File: `backend/app/Http/Controllers/ManagerParent/DashboardController.php` (lines 71–88)
  - Replace: loop that queries licenses per user
  - With: single query using `selectRaw('user_id, COUNT(*) as count, SUM(price) as revenue')` + `groupBy('reseller_id')`

- [x] **Fix ManagerParent DashboardController — revenueChart()**
  - File: `backend/app/Http/Controllers/ManagerParent/DashboardController.php` (lines 42–46)
  - Replace: `->get()` then PHP `groupBy`
  - With: `selectRaw('YEAR(activated_at) as year, MONTH(activated_at) as month, SUM(price) as revenue, COUNT(*) as count')->groupByRaw('YEAR(activated_at), MONTH(activated_at)')`

- [x] **Fix ManagerParent DashboardController — conflictRate()**
  - File: `backend/app/Http/Controllers/ManagerParent/DashboardController.php` (lines 98–100)
  - Replace: fetch all conflicts then PHP group
  - With: SQL `groupByRaw('YEAR(created_at), MONTH(created_at)')` + `selectRaw` count

- [x] **Fix ManagerParent DashboardController — expiryForecast()**
  - File: `backend/app/Http/Controllers/ManagerParent/DashboardController.php` (lines 56–67)
  - Consolidate 3 separate COUNT queries into a single query with CASE WHEN

- [x] **Fix Manager DashboardController — revenueChart() N+1**
  - File: `backend/app/Http/Controllers/Manager/DashboardController.php` (lines 41–58)
  - Replace: resellers loop with per-reseller license query
  - With: single aggregated SQL query grouped by month

---

## PRIORITY 3 — React Query Cache Configuration (20% improvement, 5 min fix)

- [x] **Create/update queryClient configuration**
  - File: `frontend/src/lib/queryClient.ts`
  - Set `defaultOptions.queries.staleTime = 5 * 60 * 1000` (5 minutes)
  - Set `defaultOptions.queries.gcTime = 10 * 60 * 1000` (10 minutes)
  - Set `defaultOptions.queries.retry = 1`
  - Set `defaultOptions.queries.refetchOnWindowFocus = false`

---

## PRIORITY 4 — Consolidate Dashboard API Endpoints (30% improvement)

- [x] **Combine 5 ManagerParent dashboard endpoints into 1**
  - Backend file: `backend/app/Http/Controllers/ManagerParent/DashboardController.php`
  - Frontend file: `frontend/src/pages/manager-parent/Dashboard.tsx` (lines 36–59)
  - Create single `GET /api/manager-parent/dashboard` that returns `{ stats, revenueChart, expiryForecast, teamPerformance, conflictRate }` in one response
  - Frontend: replace 5 `useQuery` hooks with 1

- [x] **Combine Manager dashboard endpoints into 1**
  - Backend file: `backend/app/Http/Controllers/Manager/DashboardController.php`
  - Frontend file: `frontend/src/pages/manager/Dashboard.tsx` (lines 25–43)
  - Same pattern — combine into single endpoint

---

## PRIORITY 5 — DashboardController.stats() Optimization (15% improvement)

- [x] **Replace multiple COUNT queries with single query**
  - File: `backend/app/Http/Controllers/DashboardController.php` (lines 25–44)
  - Replace 4 separate `->count()` calls with single `selectRaw('status, COUNT(*) as total')->groupBy('status')`
  - Replace 3 license status counts with same pattern

---

## PRIORITY 6 — Cache Driver & HTTP Caching (10% improvement)

- [x] **Change cache driver from database to file**
  - File: `backend/.env` (production)
  - Change `CACHE_DRIVER=database` → `CACHE_DRIVER=file`
  - OR set up Redis: `CACHE_DRIVER=redis`

- [x] **Add Laravel response caching to dashboard endpoints**
  - File: `backend/routes/api.php`
  - Wrap dashboard routes with `cache()->remember()` for 5 minutes
  - OR add `Cache-Control: private, max-age=300` headers in DashboardController

---

## PRIORITY 7 — Frontend Bundle Optimization (page load improvement)

- [x] **Add route-based lazy loading for all dashboard pages**
  - File: `frontend/src/router/index.tsx` (or wherever routes are defined)
  - Wrap all page components with `React.lazy()` + `Suspense`
  - Example: `const Dashboard = lazy(() => import('@/pages/manager-parent/Dashboard'))`

- [x] **Fix Vite chunk splitting**
  - File: `frontend/vite.config.ts`
  - Ensure `react-query` is in a separate named chunk
  - Separate `vendor-react` from `vendor-misc`

---

## PRIORITY 8 — Add Date Range Limits to Analytics (prevents future slowdown)

- [x] **Add 12-month limit to all chart queries**
  - File: `backend/app/Http/Controllers/ManagerParent/DashboardController.php`
  - Add `->where('created_at', '>=', now()->subYear())` to revenueChart, conflictRate
  - File: `backend/app/Http/Controllers/Manager/DashboardController.php`
  - Same 12-month limit on all chart queries

---

## PRIORITY 9 — Strict Column Selection (eliminate SELECT *)

- [x] **Use select() on all heavy queries — never SELECT ***
  - File: `backend/app/Http/Controllers/ManagerParent/DashboardController.php`
  - File: `backend/app/Http/Controllers/Manager/DashboardController.php`
  - File: `backend/app/Http/Controllers/ManagerParent/CustomerController.php`
  - File: `backend/app/Http/Controllers/Manager/CustomerController.php`
  - Pattern: add `->select(['id','tenant_id','reseller_id','status','price','activated_at','expires_at'])` on license queries
  - Pattern: add `->select(['id','name','email','role','tenant_id'])` on user queries
  - Add `->latest()->limit(100)` to all log/activity queries to prevent unbounded fetches

---

## PRIORITY 10 — Redis Cache for Dashboard Stats

- [x] **Switch cache driver to Redis**
  - File: `backend/.env` (production server)
  - Change: `CACHE_DRIVER=database` → `CACHE_DRIVER=redis`
  - Change: `SESSION_DRIVER=file` → `SESSION_DRIVER=redis`
  - Add: `REDIS_HOST=127.0.0.1`, `REDIS_PORT=6379`

- [x] **Add Cache::remember() to all dashboard stats**
  - File: `backend/app/Http/Controllers/ManagerParent/DashboardController.php`
  - File: `backend/app/Http/Controllers/Manager/DashboardController.php`
  - File: `backend/app/Http/Controllers/DashboardController.php`
  - Pattern: wrap each method body with `Cache::remember('dashboard:tenant:'.$tenantId.':stats', 300, fn() => [...])`
  - TTL: 300 seconds (5 minutes) for stats, 60 seconds for charts

- [x] **Invalidate cache on license activate/renew/deactivate**
  - File: `backend/app/Services/LicenseService.php`
  - After each mutation, call `Cache::forget('dashboard:tenant:'.$tenantId.':stats')`

---

## PRIORITY 11 — Queue Heavy Background Jobs

- [x] **Move IP geolocation lookups to queue**
  - File: `backend/app/Services/GeoIpService.php` (or wherever geoip is resolved)
  - Create Job: `backend/app/Jobs/ResolveIpGeoLocation.php`
  - Dispatch on login: `ResolveIpGeoLocation::dispatch($ipLog->id)`
  - Set `QUEUE_CONNECTION=redis` in `.env`

- [x] **Move PDF/export generation to queue**
  - Any export endpoints that generate reports should dispatch a Job
  - Return a job ID immediately, poll for completion
  - File: wherever PDF export is triggered

- [x] **Run queue worker in production**
  - Server: `php artisan queue:work --queue=default --tries=3 --sleep=3`
  - Add as a supervisor process or systemd service

---

## PRIORITY 12 — Frontend: Lazy Loading All Pages

- [x] **Wrap all route page components with React.lazy()**
  - File: `frontend/src/router/index.tsx` (or main router file)
  - Pattern for every page:
    ```ts
    const Dashboard = lazy(() => import('@/pages/manager-parent/Dashboard'))
    const CustomerList = lazy(() => import('@/pages/manager-parent/CustomerList'))
    // ... all pages
    ```
  - Wrap router with `<Suspense fallback={<PageSkeleton />}>`
  - Expected: reduce initial bundle from ~1.2MB to ~300KB

---

## PRIORITY 13 — Advanced React Query Settings

- [x] **Set staleTime: Infinity for static/rarely-changed data**
  - File: `frontend/src/pages/manager-parent/Dashboard.tsx`
  - Apply to: program lists, tenant config, reseller lists
  - Pattern: `useQuery({ ..., staleTime: Infinity, gcTime: 24 * 60 * 60 * 1000 })`

- [x] **Use useInfiniteQuery for logs and tables**
  - File: `frontend/src/pages/manager-parent/ProgramLogs.tsx`
  - File: `frontend/src/pages/manager-parent/IpAnalytics.tsx`
  - Replace paginated `useQuery` with `useInfiniteQuery` + "Load more" button or virtual scroll
  - Prevents loading 500+ rows at once

- [x] **Add prefetchQuery on hover for navigation links**
  - File: `frontend/src/components/layout/Sidebar.tsx` (or nav component)
  - On `onMouseEnter` of nav links, call `queryClient.prefetchQuery()`
  - Users perceive instant load because data is already in cache

---

## PRIORITY 14 — Bundle Analysis & Reduction

- [x] **Install and run vite-bundle-analyzer**
  - File: `frontend/vite.config.ts`
  - Run: `npx vite-bundle-visualizer` or install `rollup-plugin-visualizer`
  - Identify largest chunks and find what can be split or tree-shaken

- [x] **Ensure react-query is in its own vendor chunk**
  - File: `frontend/vite.config.ts`
  - In `manualChunks`, add: `'vendor-query': ['@tanstack/react-query']`

- [x] **Lazy-import heavy third-party libs (charts, pdf)**
  - Any chart library (recharts, etc.) should only load on pages that use it
  - Pattern: `const { BarChart } = await import('recharts')` inside the component

---

## PRIORITY 15 — Server & Infrastructure

- [x] **Enable OPcache on PHP**
  - File: `/etc/php/8.x/fpm/php.ini` (production server)
  - Set: `opcache.enable=1`, `opcache.memory_consumption=256`, `opcache.max_accelerated_files=20000`
  - Run: `php artisan optimize` + `composer install --optimize-autoloader --no-dev`

- [x] **Enable HTTP/2 in Nginx**
  - File: `/etc/nginx/sites-available/obd2sw` (production server)
  - Change: `listen 443 ssl;` → `listen 443 ssl http2;`
  - HTTP/2 multiplexes all 5 dashboard API calls over 1 connection

- [x] **Serve frontend dist/ from CDN**
  - Upload `frontend/dist/` to Cloudflare R2, AWS S3, or BunnyCDN
  - Update `VITE_BASE_URL` to CDN domain
  - Static assets (JS/CSS/fonts) served from edge, not VPS

- [x] **Enable Nginx gzip/brotli compression**
  - File: `/etc/nginx/nginx.conf`
  - Add: `gzip on; gzip_types text/css application/javascript application/json;`
  - Add: `gzip_min_length 1024; gzip_comp_level 6;`

---

## PRIORITY 16 — Monitoring (Measure Before & After)

- [x] **Install Laravel Telescope (dev/staging only)**
  - Run: `composer require laravel/telescope --dev`
  - Run: `php artisan telescope:install && php artisan migrate`
  - Use to profile every slow query, N+1, cache miss in real time
  - File created: `backend/config/telescope.php`

- [x] **Add query time logging to production**
  - File: `backend/app/Providers/AppServiceProvider.php`
  - Add `DB::listen()` to log queries over 500ms to log file
  - This catches slow queries in production without Telescope overhead

---

## Summary (Complete)

| Priority | Task | Est. Improvement | Effort |
|----------|------|-----------------|--------|
| 1 | Add DB indexes | 30–40% | Low |
| 2 | Fix N+1 queries | 50% | Medium |
| 3 | React Query cache config | 20% | Low |
| 4 | Consolidate dashboard endpoints | 30% | Medium |
| 5 | Optimize stats() queries | 15% | Low |
| 6 | Cache driver + HTTP cache | 10% | Low |
| 7 | Frontend lazy loading | 10% | Low |
| 8 | Date range limits | Prevents future | Low |
| 9 | Strict column SELECT | 10% | Low |
| 10 | Redis cache + Cache::remember | 40% | Medium |
| 11 | Queue heavy jobs | UX improvement | Medium |
| 12 | React lazy() all pages | Initial load -60% | Low |
| 13 | Advanced React Query | Navigation instant | Low |
| 14 | Bundle analysis & splitting | Initial load -30% | Low |
| 15 | OPcache + HTTP/2 + CDN | 2–3x PHP speed | Medium |
| 16 | Telescope + DB::listen | Measurement only | Low |

**Phase 1 (P1–P8): 2000ms → 300–400ms**
**Phase 2 (P9–P16): 300–400ms → under 150ms at scale**

---

## Post-Phase Operational Fixes (2026-03-02)

- [x] Auto-expire overdue active licenses with minute scheduler command (`licenses:expire`).
- [x] Added request-time expiry fallback (tenant-throttled) to avoid stale active statuses when scheduler is delayed.
- [x] Fixed program update payload to persist cleared optional fields (`file_size`, `system_requirements`, `installation_guide_url`, `external_logs_endpoint`).
- [x] Reduced false `422` during software edit by normalizing optional external API fields.
