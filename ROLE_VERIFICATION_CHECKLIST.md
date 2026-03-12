# Role Verification Checklist

Last updated: 2026-03-12

This checklist records the role-by-role verification completed after the latest dashboard, customer, report, auth, and management UX fixes.

## Global Checks

- [x] `php -l` passed on touched backend files
- [x] `npx tsc -b` passed in `frontend/`
- [x] `npx vite build` passed in `frontend/`
- [x] `php artisan optimize:clear` passed in `backend/`
- [x] Browser console error check returned `0` error messages on tested role sessions

## Super Admin

- [x] Dashboard loads
- [x] Customers page loads
- [x] Customers `status=active` matches dashboard active-customer metric
- [x] Reports page loads
- [x] Reports customer metrics match customer directory totals
- [x] Users page loads
- [x] Admin Management page loads
- [x] Active customer counts are aligned across dashboard, customers, and reports

Pages checked:

- [dashboard](/c:/laragon/www/LIcense/frontend/src/pages/super-admin/Dashboard.tsx)
- [Customers](/c:/laragon/www/LIcense/frontend/src/pages/super-admin/Customers.tsx)
- [Reports](/c:/laragon/www/LIcense/frontend/src/pages/super-admin/Reports.tsx)
- [Users](/c:/laragon/www/LIcense/frontend/src/pages/super-admin/Users.tsx)
- [AdminManagement](/c:/laragon/www/LIcense/frontend/src/pages/super-admin/AdminManagement.tsx)

## Manager Parent

- [x] Dashboard loads
- [x] Customers page loads
- [x] Customers `status=active` matches dashboard active-customer metric
- [x] Reports page loads
- [x] Reports `Total Customers` matches customers `All`
- [x] Reports `Active Customers` matches customers `status=active`
- [x] Reports `Total Activations` clicks through to reseller logs with URL filters
- [x] Reseller Logs page hydrates filters from URL
- [x] Panel Activity page loads

Pages checked:

- [Dashboard](/c:/laragon/www/LIcense/frontend/src/pages/manager-parent/Dashboard.tsx)
- [Customers](/c:/laragon/www/LIcense/frontend/src/pages/manager-parent/Customers.tsx)
- [FinancialReports](/c:/laragon/www/LIcense/frontend/src/pages/manager-parent/FinancialReports.tsx)
- [ResellerLogs](/c:/laragon/www/LIcense/frontend/src/pages/manager-parent/ResellerLogs.tsx)
- [Activity](/c:/laragon/www/LIcense/frontend/src/pages/manager-parent/Activity.tsx)

## Manager

- [x] Dashboard loads
- [x] Customers page loads
- [x] Customers `status=active` matches dashboard active-customer metric
- [x] Reports page loads
- [x] Reports `Total Customers` matches customers `All`
- [x] Reports `Active Customers` matches customers `status=active`
- [x] Reports `Total Activations` clicks through to reseller logs with URL filters
- [x] Reseller Logs page hydrates filters from URL
- [x] Panel Activity page loads

Pages checked:

- [Dashboard](/c:/laragon/www/LIcense/frontend/src/pages/manager/Dashboard.tsx)
- [Customers](/c:/laragon/www/LIcense/frontend/src/pages/manager/Customers.tsx)
- [Reports](/c:/laragon/www/LIcense/frontend/src/pages/manager/Reports.tsx)
- [ResellerLogs](/c:/laragon/www/LIcense/frontend/src/pages/manager/ResellerLogs.tsx)
- [Activity](/c:/laragon/www/LIcense/frontend/src/pages/manager/Activity.tsx)

## Reseller

- [x] Dashboard loads
- [x] Customers page loads
- [x] Customers `status=active` matches dashboard active-customer metric
- [x] Reports page loads
- [x] Reports `Total Customers` matches customers `All`
- [x] Reports `Active Customers` matches customers `status=active`
- [x] Reports `Total Activations` clicks through to activations with preserved date filters
- [x] Activations page loads with the routed date range
- [x] Profile page loads

Pages checked:

- [Dashboard](/c:/laragon/www/LIcense/frontend/src/pages/reseller/Dashboard.tsx)
- [Customers](/c:/laragon/www/LIcense/frontend/src/pages/reseller/Customers.tsx)
- [Reports](/c:/laragon/www/LIcense/frontend/src/pages/reseller/Reports.tsx)
- [Activations](/c:/laragon/www/LIcense/frontend/src/pages/reseller/Activations.tsx)
- [Profile](/c:/laragon/www/LIcense/frontend/src/pages/reseller/Profile.tsx)

## Metric Rules Verified

- [x] `Total Customers` means customer directory total for the role scope
- [x] `Active Customers` means distinct customers with an effectively active license in the role scope
- [x] `Total Activations` means activation volume, not customer count
- [x] Customer-facing cards match the page they open
- [x] Super Admin customer metrics remain aligned after reseller/manager/manager-parent fixes

## Notes

- Verification was performed against the local running app.
- Temporary local artifacts were intentionally not committed:
  - `.playwright-cli/`
  - `output-backend-serve.log`
  - `output-frontend-vite.log`
