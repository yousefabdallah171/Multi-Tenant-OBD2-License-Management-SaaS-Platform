# Post-Launch Performance Fixes

Updated: 2026-03-13

## Scope
- Report/dashboard query performance
- Team-management stats performance
- Customer/report metric alignment

## Backend optimizations completed
- Replaced PHP-side aggregation with SQL aggregation in:
  - `backend/app/Http/Controllers/Reseller/ReportController.php`
  - `backend/app/Http/Controllers/Manager/ReportController.php`
  - `backend/app/Http/Controllers/ManagerParent/FinancialReportController.php`
  - `backend/app/Http/Controllers/SuperAdmin/FinancialReportController.php`
- Added/used short-lived cache around heavy report payloads and versioned invalidation for report refresh.
- Optimized team/admin stats queries in:
  - `backend/app/Http/Controllers/Manager/TeamController.php`
  - `backend/app/Http/Controllers/ManagerParent/TeamController.php`
  - `backend/app/Http/Controllers/SuperAdmin/AdminManagementController.php`
  - `backend/app/Http/Controllers/SuperAdmin/UserController.php`
- Added reseller-focused reporting index migration and verified it was applied.

## Metric consistency fixes
- Standardized customer-facing metrics by role:
  - `Total Customers`
  - `Active Customers`
  - `Total Activations`
- Aligned dashboard, customer directory, and report cards so the same metric shows the same number within the same role.
- Fixed customer list serialization so filtered pages show a row whose displayed license matches the active filter.

## Validation completed
- PHP lint checks on touched controllers
- `npx tsc -b`
- `npm run build`
- Browser verification across super admin, manager parent, manager, and reseller report/dashboard pages

## Outcome
- Heavy reports no longer load all matching licenses into PHP memory.
- Team/admin list pages no longer run avoidable in-memory or N+1 stats calculations.
- Cross-page metrics are consistent and clickable destinations match the metric meaning.
