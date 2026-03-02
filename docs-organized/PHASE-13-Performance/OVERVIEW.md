    # Phase 13 — Performance Optimization

    ## Goal
    Reduce page load time from ~2 seconds → under 400ms.

    ## Root Causes

    ### 1. N+1 Queries (Backend) — CRITICAL
    Dashboard controllers fetch all rows then loop in PHP to query child records per row.
    - `ManagerParent/DashboardController.php` teamPerformance(): fetches all users → queries all licenses per user
    - `Manager/DashboardController.php` revenueChart(): fetches all resellers → queries all licenses per reseller

    ### 2. Full Table Loads Instead of SQL Aggregation — CRITICAL
    PHP groups/counts data that SQL should handle.
    - revenueChart(), conflictRate(), expiryForecast() all load unlimited rows into memory

    ### 3. Missing Database Indexes — CRITICAL
    `licenses` table columns used in every WHERE clause have no indexes:
    `reseller_id`, `customer_id`, `tenant_id`, `status`, `expires_at`

    ### 4. React Query — No Cache Config — HIGH
    Default staleTime = 0ms → refetches ALL data on every page navigation.
    No queryClient.ts configuration exists.

    ### 5. 5 Parallel API Calls per Dashboard Page — HIGH
    ManagerParent dashboard fires 5 separate HTTP requests on every load
    instead of one combined dashboard endpoint.

    ### 6. Other
    - Cache driver is `database` (should be `file` or `redis`)
    - No HTTP cache headers on API responses
    - Frontend: no route-based code splitting (lazy loading)

## Expected Result After All Fixes
~2000ms → ~300-400ms (5x improvement)

## Post-Implementation Stability Notes (2026-03-02)

- Added automatic license expiry reconciliation:
  - Scheduled via `licenses:expire` every minute.
  - Request-time fallback exists to prevent stale `active` status if scheduler is not running.
- Program edit flow now persists cleared optional values (sends explicit empty values on update).
- Optional external API fields were normalized to reduce false validation `422` responses during software edit/update.

    ## Files Edited
    See TODOLIST.md for full file list with paths.
