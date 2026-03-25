# Manager Parent

Last updated: 2026-03-10

- Account: `manager@obd2sw.com`
- Scope: Tenant
- Tenant: `Test Tenant`
- Default landing page: `/:lang/dashboard`
- Visible navigation routes: 17 main entries plus detail/workflow routes

## Pages shown

1. `/:lang/dashboard`
2. `/:lang/team-management`
3. `/:lang/customers`
4. `/:lang/software`
5. `/:lang/program-logs`
6. `/:lang/software-management`
7. `/:lang/bios-blacklist`
8. `/:lang/bios-history`
9. `/:lang/bios-conflicts`
10. `/:lang/ip-analytics`
11. `/:lang/reports`
12. `/:lang/activity`
13. `/:lang/logs`
14. `/:lang/reseller-logs`
15. `/:lang/api-status`
16. `/:lang/settings`
17. `/:lang/profile`

Additional workflow/detail routes:

- `/:lang/team-management/:id`
- `/:lang/bios-details/:biosId`
- `/:lang/software-management/create`
- `/:lang/software-management/:id/edit`
- `/:lang/software-management/:id/activate`
- `/:lang/customers/:id`

## Dashboard content

- Team members stats
- Total customers
- Active licenses
- Monthly revenue
- Revenue chart
- Expiry forecast
- Team performance chart
- Quick actions
- Dashboard stat cards deep-link into Team Management, Customers, active-customer view, and Reports

## Can do

- Manage managers and resellers inside the tenant
- Invite, edit, suspend, activate, and delete team members
- Create, edit, and delete programs
- Set program download links
- Use one normal base price for software without reseller-specific overrides
- Activate licenses directly from manager-parent software/program flows
- View tenant reports and export them
- View tenant financial reports
- Open tenant reports with the last-year date range preloaded by default
- View reseller balances inside Financial Reports
- View tenant activity logs
- View seller activity in `reseller-logs` with filters by seller/action/date
- View tenant customers
- Open customer detail/history views from licenses and related logs
- Open BIOS detail pages from customers, BIOS conflicts, reseller logs, IP analytics, and team detail history
- Manage tenant BIOS blacklist
- View tenant BIOS history
- Resolve BIOS conflicts
- View tenant IP analytics
- Use software-scoped program logs and software-scoped IP analytics
- Unlock usernames, change usernames, and reset passwords for tenant users
- Edit tenant settings
- Edit own profile and password
- Review manager/reseller full-page detail from Team Management
- Review canonical BIOS detail pages with customer, reseller, program, duration, price, and activity context

## Cannot do

- Cannot see data outside the tenant
- Customer workspace is still an internal operational view, not a customer self-service portal
- No separate `reseller-balances` page in the current frontend because balances are inside Financial Reports

