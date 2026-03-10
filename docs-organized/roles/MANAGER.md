# Manager

Last updated: 2026-03-10

- Account: `reseller2@obd2sw.com`
- Scope: Tenant reseller visibility plus current-manager operational detail access
- Tenant: `Test Tenant`
- Default landing page: `/:lang/manager/dashboard`
- Visible navigation routes: 9 main entries plus detail/workflow routes

## Pages shown

1. `/:lang/manager/dashboard`
2. `/:lang/manager/team`
3. `/:lang/manager/customers`
4. `/:lang/manager/software`
5. `/:lang/manager/software-management`
6. `/:lang/manager/reports`
7. `/:lang/manager/activity`
8. `/:lang/manager/reseller-logs`
9. `/:lang/manager/profile`

Additional workflow/detail routes:

- `/:lang/manager/team/:id`
- `/:lang/manager/customers/:id`
- `/:lang/manager/bios-details/:biosId`
- `/:lang/manager/software-management/create`
- `/:lang/manager/software-management/:id/edit`
- `/:lang/manager/software/:id/activate`

## Dashboard content

- Team resellers
- Team customers
- Active licenses
- Team revenue
- Team activations trend
- Team revenue trend
- Recent team activity

## Can do

- View all tenant resellers
- View reseller and manager detail pages at `/:lang/manager/team/:id`
- View reseller recent licenses, activity, and reseller-history tables from the dedicated detail page
- Invite reseller accounts from the Team page
- Edit reseller accounts from the Team page
- Deactive/reactivate reseller accounts from the Team page
- Delete reseller accounts from the Team page
- View team customers
- Open customer detail/history views from licenses and customer listings
- View team licenses with renew/deactivate workflow
- View software catalog in read-only mode
- Create, edit, and activate team-scoped software/program records
- Activate licenses directly as a manager and have those sales attributed correctly in reports/logs
- View tenant-wide reports in the same financial layout used by Manager Parent and export them
- View team activity
- View seller activity in `reseller-logs` with filters by seller/action/date
- Open seller rows from `reseller-logs` into the canonical manager detail page
- Open BIOS IDs from `reseller-logs`, customer pages, and detail pages into canonical manager BIOS pages
- View BIOS detail pages even when the license row has been removed, using activity-log fallback context
- Unlock usernames for team users
- Change usernames for team users
- Reset passwords for team users
- Edit own profile and password

## Cannot do

- Cannot see data outside the tenant
- Cannot manage users outside the tenant reseller/customer scope
- Customer workspace is operational/read-only outside activation, renewal, and deactivation flows
- Cannot access Super Admin, Manager Parent, Reseller, or Customer pages

