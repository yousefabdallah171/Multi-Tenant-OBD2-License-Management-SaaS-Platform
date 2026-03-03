# Manager Parent

- Account: `parent@obd2sw.com`
- Scope: Tenant
- Tenant: `Test Tenant`
- Default landing page: `/:lang/dashboard`
- Visible navigation routes: 21

## Pages shown

1. `/:lang/dashboard`
2. `/:lang/team-management`
3. `/:lang/reseller-pricing`
4. `/:lang/software`
5. `/:lang/licenses`
6. `/:lang/program-logs`
7. `/:lang/software-management`
8. `/:lang/bios-blacklist`
9. `/:lang/bios-history`
10. `/:lang/bios-conflicts`
11. `/:lang/ip-analytics`
12. `/:lang/username-management`
13. `/:lang/financial-reports`
14. `/:lang/reports`
15. `/:lang/customers`
16. `/:lang/activity`
17. `/:lang/logs`
18. `/:lang/reseller-logs`
19. `/:lang/api-status`
20. `/:lang/settings`
21. `/:lang/profile`

Additional workflow/detail routes:

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

## Can do

- Manage managers and resellers inside the tenant
- Invite, edit, suspend, activate, and delete team members
- Set reseller pricing
- Run bulk pricing updates
- Create, edit, and delete programs
- Set program download links
- Activate licenses directly from manager-parent software/program flows
- View tenant reports and export them
- View tenant financial reports
- View reseller balances inside Financial Reports
- View tenant activity logs
- View seller activity in `reseller-logs` with filters by seller/action/date
- View tenant customers
- Open customer detail/history views from licenses and related logs
- Manage tenant BIOS blacklist
- View tenant BIOS history
- Resolve BIOS conflicts
- View tenant IP analytics
- Use software-scoped program logs and software-scoped IP analytics
- Unlock usernames, change usernames, and reset passwords for tenant users
- Edit tenant settings
- Edit own profile and password
- Review manager/reseller drill-down history from Team Management

## Cannot do

- Cannot see data outside the tenant
- Customer workspace is still an internal operational view, not a customer self-service portal
- No separate `reseller-balances` page in the current frontend because balances are inside Financial Reports

