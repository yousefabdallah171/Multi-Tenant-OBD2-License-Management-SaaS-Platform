# Role Permissions and Dashboard Pages

Generated on: 2026-02-28

## Source of truth used for this file

I read:

- `README.md`
- `docs-organized/PHASE-02-SuperAdmin/01-Phase-Overview.md`
- `docs-organized/PHASE-02-SuperAdmin/02-TODO-List.md`
- `docs-organized/PHASE-03-ManagerParent/01-Phase-Overview.md`
- `docs-organized/PHASE-03-ManagerParent/02-TODO-List.md`
- `docs-organized/PHASE-04-ManagerReseller/01-Phase-Overview.md`
- `docs-organized/PHASE-04-ManagerReseller/02-TODO-List.md`
- `docs-organized/PHASE-04-ManagerReseller/03-Completion-Checklist.md`
- `docs-organized/PHASE-05-CustomerPortal/01-Phase-Overview.md`
- `docs-organized/PHASE-05-CustomerPortal/02-TODO-List.md`

I also verified the implemented frontend route tree and navigation in:

- `frontend/src/router/index.tsx`
- `frontend/src/router/routes.ts`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/CustomerNavbar.tsx`
- `frontend/src/lib/constants.ts`

## Important note about documentation conflicts

Some docs are not fully consistent with each other.

- `README.md` says Super Admin has 13 pages and Manager Parent has 12 pages, but one README table lists extra pages that are not implemented as standalone routes.
- The implemented frontend is the most reliable source for which pages actually show in the dashboard/navigation.
- Where permissions conflict, I used the role-specific phase docs and implemented UI behavior over older summary tables.

Because of that, this file uses:

- Implemented frontend routes/navigation for "pages shown"
- Role docs and checklists for "can do" and "cannot do"

## Role Summary

| Role | Scope | Default landing page | Visible pages |
|---|---|---|---:|
| Super Admin | Global | `/:lang/super-admin/dashboard` | 13 |
| Manager Parent | Tenant | `/:lang/dashboard` | 14 |
| Manager | Team | `/:lang/manager/dashboard` | 8 |
| Reseller | Personal | `/:lang/reseller/dashboard` | 7 |
| Customer | Self | `/:lang/customer/dashboard` | 3 |

## Accounts from your dashboard

| Name | Email | Role | Tenant |
|---|---|---|---|
| Super Admin | `admin@obd2sw.com` | Super Admin | Global / none |
| Manager Parent | `parent@obd2sw.com` | Manager Parent | Test Tenant |
| Manager | `manager@obd2sw.com` | Manager | Test Tenant |
| Reseller | `reseller1@obd2sw.com` | Reseller | Test Tenant |
| Customer | `customer@obd2sw.com` | Customer | Test Tenant |

## Shared access rules

- All routes are protected by authentication.
- Cross-role access is blocked by role guards.
- If a user tries to open another role's pages, the app redirects that user back to the correct dashboard for that role.
- Customer usernames are BIOS-locked by business rule.
- Username unlock/change and password reset actions are limited by role scope.

---

## Super Admin

### Scope

- Global scope
- Can see all tenants and all users across the whole platform

### Default dashboard

- `/:lang/super-admin/dashboard`

### Pages shown in navigation

1. `/:lang/super-admin/dashboard` - Dashboard
2. `/:lang/super-admin/tenants` - Tenant Management
3. `/:lang/super-admin/users` - All Users
4. `/:lang/super-admin/admin-management` - Admin Management
5. `/:lang/super-admin/bios-blacklist` - BIOS Blacklist
6. `/:lang/super-admin/bios-history` - BIOS History
7. `/:lang/super-admin/username-management` - Username Management
8. `/:lang/super-admin/financial-reports` - Financial Reports
9. `/:lang/super-admin/reports` - Reports
10. `/:lang/super-admin/logs` - System Logs
11. `/:lang/super-admin/api-status` - API Status
12. `/:lang/super-admin/settings` - Settings
13. `/:lang/super-admin/profile` - Profile

### What the dashboard shows

- 5 stats cards
- Revenue trend chart
- Tenant comparison chart
- License activity timeline
- Recent activity feed

### What Super Admin can do

- View all tenants
- Create a tenant and create the Manager Parent account for that tenant
- Edit, suspend, activate, and delete tenants
- View all users across all tenants
- Suspend, activate, and delete users
- Manage admin accounts from one place
- Add, edit, suspend, activate, delete, and reset admin accounts
- View platform-wide reports and export CSV/PDF
- View platform-wide financial reports
- View reseller balances across tenants inside Financial Reports
- Manage the global BIOS blacklist
- Search global BIOS history across all tenants
- Unlock usernames, change usernames, and reset passwords for any user
- View system logs and API logs
- Monitor external API health and run manual ping checks
- Change system settings
- Edit own profile, password, and notification preferences

### What Super Admin cannot do

- Does not get customer-only pages like customer download center
- Does not use reseller workflow pages like reseller customers/licenses
- Current implemented UI does not expose a dedicated license activation page for Super Admin

---

## Manager Parent

### Scope

- Tenant scope
- Can only manage data inside the assigned tenant

### Default dashboard

- `/:lang/dashboard`

### Pages shown in navigation

1. `/:lang/dashboard` - Dashboard
2. `/:lang/team-management` - Team Management
3. `/:lang/reseller-pricing` - Reseller Pricing
4. `/:lang/software-management` - Software Management
5. `/:lang/bios-blacklist` - BIOS Blacklist
6. `/:lang/bios-history` - BIOS History
7. `/:lang/ip-analytics` - IP Analytics
8. `/:lang/username-management` - Username Management
9. `/:lang/financial-reports` - Financial Reports
10. `/:lang/reports` - Reports
11. `/:lang/activity` - Activity
12. `/:lang/customers` - Customers
13. `/:lang/settings` - Settings
14. `/:lang/profile` - Profile

### What the dashboard shows

- Team members stats
- Total customers
- Active licenses
- Monthly revenue
- Revenue chart
- Expiry forecast
- Team performance chart
- Quick actions

### What Manager Parent can do

- Manage managers and resellers inside the tenant
- Invite managers and resellers
- Edit, suspend, activate, and delete tenant team members
- Set reseller pricing per program
- Run bulk reseller pricing updates
- Review pricing history
- Create, edit, and delete programs
- Set download links for programs
- View tenant reports and export CSV/PDF
- View tenant financial reports
- View reseller balances inside Financial Reports
- View tenant-wide activity log
- View aggregated customer list for the tenant
- Manage tenant BIOS blacklist
- Search tenant BIOS history
- View tenant IP analytics and suspicious IP activity
- Unlock usernames, change usernames, and reset passwords for tenant users
- Edit tenant settings
- Edit own profile and password

### What Manager Parent cannot do

- Cannot see tenants outside the assigned tenant
- Cannot manage users outside the assigned tenant
- Customer page is read-only aggregated view
- Customer activation is not exposed as a direct Manager Parent workflow in the implemented dashboard
- No separate implemented `bios-conflicts` page in the current frontend
- No separate implemented `reseller-balances` page in the current frontend because reseller balances are inside Financial Reports

---

## Manager

### Scope

- Team scope
- Can manage only resellers under that manager and those resellers' customers

### Default dashboard

- `/:lang/manager/dashboard`

### Pages shown in navigation

1. `/:lang/manager/dashboard` - Dashboard
2. `/:lang/manager/team` - Team
3. `/:lang/manager/username-management` - Username Management
4. `/:lang/manager/customers` - Customers
5. `/:lang/manager/software` - Software
6. `/:lang/manager/reports` - Reports
7. `/:lang/manager/activity` - Activity
8. `/:lang/manager/profile` - Profile

### What the dashboard shows

- Team resellers
- Team customers
- Active licenses
- Team revenue
- Team activations trend
- Team revenue trend
- Recent team activity

### What Manager can do

- View team-scoped dashboard stats
- View assigned resellers and their detail
- View customers across assigned resellers
- View software catalog in read-only mode
- View team reports and export CSV/PDF
- View team activity logs
- Unlock usernames for team users
- Change usernames for team users
- Reset passwords for team users
- Edit own profile and password

### What Manager cannot do

- Cannot see data outside the manager's team
- Cannot add, invite, edit, suspend, or delete managers/resellers from the Team page
- Cannot edit or delete software
- Customer page is read-only
- No reseller activation workflow is exposed to manager users
- Cannot access Super Admin pages
- Cannot access Manager Parent pages
- Cannot access Reseller pages
- Cannot access Customer pages

---

## Reseller

### Scope

- Personal scope
- Can only work with the reseller's own customers and licenses

### Default dashboard

- `/:lang/reseller/dashboard`

### Pages shown in navigation

1. `/:lang/reseller/dashboard` - Dashboard
2. `/:lang/reseller/customers` - Customers
3. `/:lang/reseller/software` - Software
4. `/:lang/reseller/licenses` - Licenses
5. `/:lang/reseller/reports` - Reports
6. `/:lang/reseller/activity` - Activity
7. `/:lang/reseller/profile` - Profile

### What the dashboard shows

- Customers count
- Active licenses
- Revenue
- Monthly activations
- Activation trend
- Revenue trend
- Recent activity
- Quick actions

### What Reseller can do

- View personal dashboard stats
- Create customer accounts
- Activate licenses through the BIOS activation flow
- Enter BIOS ID, select program, set duration, set price, and confirm activation
- Renew licenses
- Deactivate licenses
- Bulk renew licenses
- Bulk deactivate licenses
- View own customers and their license details
- View own license list and expiring-license warnings
- View personal reports and export CSV/PDF
- View own activity history
- View software catalog in read-only mode
- Edit own profile and password in the implemented profile page

### What Reseller cannot do

- Cannot see other resellers' data
- Cannot manage managers or admin accounts
- Cannot access username/password management pages
- Cannot unlock usernames for customers or anyone else
- Cannot reset passwords for other users
- Cannot edit or delete software
- Cannot access Manager pages
- Cannot access Manager Parent pages
- Cannot access Super Admin pages

---

## Customer

### Scope

- Self scope
- Can only see own license and download information

### Default dashboard

- `/:lang/customer/dashboard`

### Pages shown in navigation

1. `/:lang/customer/dashboard` - Dashboard
2. `/:lang/customer/software` - Software
3. `/:lang/customer/download` - Download Center

### What the dashboard shows

- License cards
- BIOS ID
- Status
- Activated date
- Expiry date
- Progress bar
- Days remaining
- Summary stats for total, active, and expired licenses

### What Customer can do

- View own license status
- View expiry countdown
- View only the programs the customer is licensed for
- Download software when the license is active
- See disabled download state when the license is expired
- Request renewal by contacting reseller from the dashboard flow
- Access download center and log downloads

### What Customer cannot do

- Cannot edit users
- Cannot edit username or password from a customer-specific admin page
- Cannot manage licenses
- Cannot activate, renew, or deactivate licenses directly
- Cannot manage software, pricing, reports, or settings
- Cannot see other customers or tenant data
- Has no sidebar admin dashboard; customer uses a separate customer navbar
- Has no profile page in the current implemented customer portal
- Username remains BIOS-locked by business rule

---

## Final practical answer by role

### Super Admin

- Sees 13 pages
- Controls the full system globally
- Can manage tenants, users, admins, BIOS controls, reports, logs, API status, settings, and own profile

### Manager Parent

- Sees 14 pages
- Controls one tenant only
- Can manage managers, resellers, pricing, programs, BIOS tenant tools, username tools, reports, settings, and own profile
- Customer list is read-only

### Manager

- Sees 8 pages
- Controls one team only
- Can monitor resellers, manage team usernames/password resets, review customers, view reports/activity, and edit own profile
- Cannot create or delete team members

### Reseller

- Sees 7 pages
- Works only on personal customers and personal licenses
- Can create customers, activate/renew/deactivate licenses, manage own licenses, view reports/activity, and edit own profile
- Cannot access username management

### Customer

- Sees 3 pages
- Can only view own license/software/download info
- Can download active software and request renewal
- Cannot manage anything administrative
