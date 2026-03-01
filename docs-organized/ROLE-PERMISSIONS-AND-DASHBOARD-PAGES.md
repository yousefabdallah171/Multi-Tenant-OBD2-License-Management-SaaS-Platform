# Role Permissions and Dashboard Pages (Phase 11)

Generated on: 2026-03-01  
Source of truth: implemented routes and sidebar in `frontend/src/router/index.tsx`, `frontend/src/router/routes.ts`, `frontend/src/components/layout/Sidebar.tsx`, and backend route/middleware guards.

## Role Summary

| Role | Scope | Default Landing Page | Visible Pages |
|---|---|---|---:|
| Super Admin | Global | `/:lang/super-admin/dashboard` | 10 |
| Manager Parent | Tenant | `/:lang/dashboard` | 18 |
| Manager | Team | `/:lang/manager/dashboard` | 9 |
| Reseller | Personal | `/:lang/reseller/dashboard` | 5 |
| Customer | REMOVED | - | 0 |

## Super Admin

### Pages shown in navigation (10)

1. `/:lang/super-admin/dashboard`
2. `/:lang/super-admin/tenants`
3. `/:lang/super-admin/users`
4. `/:lang/super-admin/bios-blacklist`
5. `/:lang/super-admin/bios-history`
6. `/:lang/super-admin/financial-reports`
7. `/:lang/super-admin/reports`
8. `/:lang/super-admin/logs`
9. `/:lang/super-admin/api-status`
10. `/:lang/super-admin/settings` (includes Profile tab)

### Can do

- Manage tenants (create/update/status/delete).
- Manage global users.
- Use global BIOS blacklist and BIOS history.
- View global logs and API status.
- View platform financial/reports pages.
- Manage own profile/password from Settings.

### Cannot do

- No standalone `admin-management` page.
- No standalone `username-management` page.
- No standalone `profile` route.

## Manager Parent

### Pages shown in navigation (18)

1. `/:lang/dashboard`
2. `/:lang/team-management`
3. `/:lang/reseller-pricing`
4. `/:lang/software-management`
5. `/:lang/bios-blacklist`
6. `/:lang/bios-history`
7. `/:lang/bios-conflicts`
8. `/:lang/ip-analytics`
9. `/:lang/logs`
10. `/:lang/program-logs`
11. `/:lang/api-status`
12. `/:lang/username-management`
13. `/:lang/financial-reports`
14. `/:lang/reports`
15. `/:lang/activity`
16. `/:lang/customers`
17. `/:lang/settings`
18. `/:lang/profile`

### Can do

- Manage tenant team/users within tenant scope.
- Manage tenant pricing and software catalog.
- Use tenant BIOS tools (blacklist/history/conflicts).
- View tenant logs and tenant API status.
- View real-time program activation logs and login IP history per software title.
- Access tenant reports, financial reports, activity, customers.

### Cannot do

- Cannot access global super-admin scope/data outside tenant.
- Cannot access manager-only or reseller-only route trees.

## Manager

### Pages shown in navigation (9)

1. `/:lang/manager/dashboard`
2. `/:lang/manager/team`
3. `/:lang/manager/username-management`
4. `/:lang/manager/customers`
5. `/:lang/manager/software`
6. `/:lang/manager/software-management`
7. `/:lang/manager/reports`
8. `/:lang/manager/activity`
9. `/:lang/manager/profile`

### Can do

- Access team-scoped dashboard/team/customers/reports/activity.
- Use username management for team scope.
- Use software-management CRUD and activation flow (`/api/manager/software/*`).

### Cannot do

- Cannot access super-admin routes.
- Cannot access manager-parent root routes.
- Cannot access reseller route tree.

## Reseller

### Pages shown in navigation (5)

1. `/:lang/reseller/dashboard`
2. `/:lang/reseller/customers`
3. `/:lang/reseller/licenses`
4. `/:lang/reseller/software`
5. `/:lang/reseller/reports`

### Can do

- Manage own customers.
- Manage own licenses and license actions.
- Browse software catalog (read-only) and activate licenses via ACTIVATE modal.
- View personal reports and dashboard.

### Cannot do

- No reseller `activity` page.
- No reseller `profile` page.
- Attempts to removed reseller routes are redirected to reseller dashboard.

## Customer

### Status

Customer portal is removed.

### What happens now

- Customer login with correct password returns `401` with `Invalid credentials.` (silent deny).
- Customer login with wrong password returns the exact same `401` response.
- `/api/customer/*` routes are not registered.
- Any customer token hitting protected API routes is revoked and returns `401 Invalid credentials.`.

### Pages shown in navigation

- None (0 pages).

## Final practical answer by role

- Super Admin: 10 pages.
- Manager Parent: 18 pages.
- Manager: 9 pages.
- Reseller: 5 pages.
- Customer: removed (0 pages, cannot log in to portal).
