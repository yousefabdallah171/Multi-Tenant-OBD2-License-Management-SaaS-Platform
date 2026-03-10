# Super Admin

Last updated: 2026-03-10

- Account: `admin@obd2sw.com`
- Scope: Global
- Default landing page: `/:lang/super-admin/dashboard`
- Visible pages: 11 main entries plus detail routes

## Pages shown

1. `/:lang/super-admin/dashboard`
2. `/:lang/super-admin/tenants`
3. `/:lang/super-admin/customers`
4. `/:lang/super-admin/users`
5. `/:lang/super-admin/admin-management`
6. `/:lang/super-admin/bios-blacklist`
7. `/:lang/super-admin/bios-history`
8. `/:lang/super-admin/reports`
9. `/:lang/super-admin/logs`
10. `/:lang/super-admin/api-status`
11. `/:lang/super-admin/settings`

Additional workflow/detail routes:

- `/:lang/super-admin/customers/create`
- `/:lang/super-admin/customers/:id`
- `/:lang/super-admin/users/:id`
- `/:lang/super-admin/bios-details/:biosId`
- `/:lang/super-admin/profile`

## Dashboard content

- Stats cards
- Revenue trend
- Tenant comparison
- License activity timeline
- Recent activity feed
- Dashboard stat cards deep-link into Tenants, Users, and Reports

## Can do

- Manage all tenants
- Manage customers globally across all tenants
- Create customer-only profiles or activate customer licenses from the Super Admin workspace
- Open canonical full-page customer detail from customer lists, BIOS views, and user-linked screens
- Create tenant + Manager Parent account
- Edit, suspend, activate, and delete tenants
- View all users across all tenants
- Open full-page cross-tenant user detail from the Users page
- Suspend, activate, and delete users
- Manage admin accounts
- Open canonical full-page user detail from Admin Management rows, names, and usernames
- Manage global BIOS blacklist
- View tenant context inside the Super Admin BIOS blacklist table
- View BIOS history across all tenants
- Open canonical BIOS detail pages from Super Admin BIOS-linked screens
- Unlock usernames, change usernames, and reset passwords from consolidated management pages
- View platform reports and financial reports
- Open Super Admin reports with the last-year date range preloaded by default
- View reseller balances inside Financial Reports
- View logs and API health
- Use the fixed API Status page without the prior api-log memory/sort failure
- Change system settings
- Edit own profile and password
- Use protected Super Admin account actions that block self-delete, self-deactivate, and last-active-super-admin removal

## Cannot do

- No customer-only portal pages
- No reseller workflow pages
- No separate reseller-only workflow pages outside the global customer and user surfaces

