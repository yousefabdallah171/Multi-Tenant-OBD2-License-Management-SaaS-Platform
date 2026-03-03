# Manager

- Account: `manager@obd2sw.com`
- Scope: Team
- Tenant: `Test Tenant`
- Default landing page: `/:lang/manager/dashboard`
- Visible navigation routes: 11

## Pages shown

1. `/:lang/manager/dashboard`
2. `/:lang/manager/team`
3. `/:lang/manager/username-management`
4. `/:lang/manager/customers`
5. `/:lang/manager/licenses`
6. `/:lang/manager/software`
7. `/:lang/manager/software-management`
8. `/:lang/manager/reports`
9. `/:lang/manager/activity`
10. `/:lang/manager/reseller-logs`
11. `/:lang/manager/profile`

Additional workflow/detail routes:

- `/:lang/manager/customers/:id`
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

- View assigned resellers
- View reseller details
- View reseller recent licenses and activity in the Team drawer
- View team customers
- Open customer detail/history views from licenses and customer listings
- View team licenses with renew/deactivate workflow
- View software catalog in read-only mode
- Create, edit, and activate team-scoped software/program records
- Activate licenses directly as a manager and have those sales attributed correctly in reports/logs
- View team reports and export them
- View team activity
- View seller activity in `reseller-logs` with filters by seller/action/date
- Unlock usernames for team users
- Change usernames for team users
- Reset passwords for team users
- Edit own profile and password

## Cannot do

- Cannot see data outside the team
- Cannot add, invite, edit, suspend, or delete team members from the Team page
- Cannot manage users outside the assigned team scope
- Customer workspace is operational/read-only outside activation, renewal, and deactivation flows
- Cannot access Super Admin, Manager Parent, Reseller, or Customer pages

