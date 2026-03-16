# Super Admin Dashboard — Full Testing Plan (Playwright MCP)

> **Role under test:** `super_admin` (highest privilege — system-wide access)
> **Base URL:** `http://localhost:3000`
> **Login route:** `/en/login`
> **Super Admin base route:** `/en/super-admin`
> **Test tool:** Playwright MCP (browser automation)
> **Languages:** English (`en`) + Arabic (`ar`)
>
> **What makes super-admin unique:**
> - Sees data across **ALL tenants** simultaneously
> - Can **create, reset, backup, and restore** entire tenants
> - Can **change any user's role or tenant assignment**
> - Can **manage other super admins**
> - Controls **global security locks** (blocked IPs, locked accounts)
> - Controls **system-wide settings** (server timezone, email config)
> - Access to **raw API logs** for all endpoints across all tenants
> - Can **resolve BIOS conflicts** at system level
>
> **Shared components used:**
> - `RenewLicensePage`, `CustomerCreatePage`, `ProfileWorkspace`
> - `DataTable`, `StatusFilterCard`, `StatusBadge`, `RoleBadge`
> - `ConfirmDialog`, `ExportButtons`, `DateRangePicker`
> - `LineChartWidget`, `BarChartWidget`

---

## Pre-Test Setup Checklist

- [ ] Laragon (MySQL + PHP) running; backend on port `8000`
- [ ] Vite dev server running on port `3000`
- [ ] Super admin credentials available
- [ ] At least 2 tenants exist (one with data, one empty/fresh)
- [ ] Each tenant has: manager-parent, managers, resellers, customers
- [ ] At least 1 tenant backup exists (created in a previous reset)
- [ ] At least 1 BIOS conflict exists
- [ ] At least 1 security lock (blocked IP or locked account) exists
- [ ] At least 1 program with `external_api_key` configured
- [ ] Playwright MCP connected and browser open

---

## Sprint 1 — Authentication & Layout

### S1-T1: Login as Super Admin
- [ ] Navigate to `http://localhost:3000/en/login`
- [ ] Enter super admin credentials
- [ ] Verify redirect to `/en/super-admin/dashboard`
- [ ] Verify navbar: name, "Super Admin" role badge, online count indicator
- [ ] **Fix:** Wrong redirect → check `AuthController` role routing for `super_admin`

### S1-T2: Sidebar — All Items Present
- [ ] Verify sidebar contains: Dashboard, Tenants, Customers, Admin Mgmt, BIOS Blacklist, Security Locks, Reports, Logs, API Status, Settings, Profile
- [ ] Click each → URL + page title changes correctly
- [ ] Active link highlighted
- [ ] **Fix:** Missing sidebar items → check super-admin layout/nav config

### S1-T3: Server Timezone Display
- [ ] Verify "Server Timezone: UTC" (or configured TZ) shows in navbar/header
- [ ] **Fix:** Missing → check `Settings` API response + navbar component

### S1-T4: Online Users Count
- [ ] Verify "X online" indicator in navbar shows a number
- [ ] **Fix:** Missing → check online status query in navbar

### S1-T5: Language Switch EN → AR
- [ ] Click AR → URL `/ar/super-admin/...`, layout RTL, all text Arabic
- [ ] Switch back to EN → LTR restored
- [ ] **Fix:** RTL broken → check `dir="rtl"` and `isRtl` hook

### S1-T6: Dark Mode
- [ ] Toggle dark → all pages readable
- [ ] Tables, charts, dialogs, badges all dark-styled
- [ ] **Fix:** Dark mode issues → check Tailwind `dark:` classes

### S1-T7: Logout
- [ ] Logout → redirect to `/en/login`
- [ ] Access `/en/super-admin/dashboard` → redirected to login
- [ ] **Fix:** Protected route not blocking → check `ProtectedRoute`

### S1-T8: No Other Role Can Access Super-Admin Routes
- [ ] Login as manager-parent → try `/en/super-admin/tenants` → blocked
- [ ] Login as reseller → try `/en/super-admin/logs` → blocked
- [ ] **Fix:** Role guard missing → check middleware `role:super_admin` on backend routes

---

## Sprint 2 — Dashboard (`/en/super-admin/dashboard`)

### S2-T1: System-Wide Stats Cards
- [ ] Verify cards cover ALL tenants: Total Tenants, Total Customers, Total Revenue, Active Licenses
- [ ] Values are numeric and reflect sum across all tenants
- [ ] **Fix:** Values too low (single tenant) → check `reportService.getDashboardStats()` is cross-tenant

### S2-T2: Revenue Trend Chart
- [ ] Monthly revenue line chart renders with data from all tenants
- [ ] Months localized (EN/AR)
- [ ] Tooltip on hover
- [ ] **Fix:** Blank → check `reportService.getRevenueTrend()`

### S2-T3: Tenant Comparison Chart (unique)
- [ ] Chart compares tenants side-by-side (revenue, activations, or customers)
- [ ] Each tenant labelled
- [ ] **Fix:** Chart missing → check `reportService.getTenantComparison()`

### S2-T4: License Timeline Chart (unique)
- [ ] Chart shows licenses expiring or activating over time across all tenants
- [ ] **Fix:** Blank → check dashboard API for timeline series

### S2-T5: Recent Activity Feed
- [ ] Activity from ALL tenants — shows tenant name alongside action
- [ ] **Fix:** Only one tenant's activity → check cross-tenant scope in API

### S2-T6: Dashboard in AR Mode
- [ ] Arabic month labels in charts, AR-locale currency/numbers
- [ ] **Fix:** Wrong locale → check `locale = lang === 'ar' ? 'ar-EG' : 'en-US'`

---

## Sprint 3 — Tenant Management (`/en/super-admin/tenants`) ⭐ Exclusive

### S3-T1: Tenant List Loads
- [ ] Verify table: Name, Slug, Managers count, Resellers count, Customers count, Active Licenses, Revenue, Status, Actions
- [ ] Status filter cards: All / Active / Deactive / Inactive
- [ ] **Fix:** Empty → check `tenantService.getAll()` API

### S3-T2: Search Tenants
- [ ] Type tenant name → table filters
- [ ] Clear → all return
- [ ] **Fix:** Search ignored → check `search` in queryKey

### S3-T3: Status Filter Cards
- [ ] Click Active → only active tenants
- [ ] Click Deactive / Inactive → correct filter
- [ ] Click All → all tenants
- [ ] **Fix:** Filter not working → check `status` param

### S3-T4: Create Tenant
- [ ] Click "Add Tenant"
- [ ] Fill: Tenant Name, Slug, Manager-Parent Name, Email, Password
- [ ] Submit → success toast → new tenant in list
- [ ] Verify: manager-parent account auto-created and can log in
- [ ] **Fix:** 422 → check required fields; cross-role: created manager-parent can login

### S3-T5: View Tenant Stats (Stats Row)
- [ ] Each tenant row shows accurate manager/reseller/customer/license counts
- [ ] Revenue formatted as currency
- [ ] **Fix:** Wrong counts → check `tenantService.getStats()` or computed counts in API

### S3-T6: Edit Tenant
- [ ] Click ⋮ → Edit → change tenant name → save → table updated
- [ ] **Fix:** Edit failing → check `tenantService.update()` mutation

### S3-T7: Deactivate Tenant (soft disable)
- [ ] Click ⋮ → Deactivate → confirm → status → Deactive
- [ ] **Cross-role effect:** Manager-parent of that tenant tries to login → should be blocked
- [ ] **Fix:** Tenant deactivation not blocking logins → check `ActiveRoleMiddleware` + `TenantScope`

### S3-T8: Reactivate Tenant
- [ ] Reactivate a deactivated tenant → status → Active
- [ ] Manager-parent can log in again
- [ ] **Fix:** Reactivation not reflected → check status toggle API

### S3-T9: Reset Tenant Data ⭐ Critical
- [ ] Click ⋮ → "Reset Tenant" on a tenant with data
- [ ] Dialog opens with warning: lists what will be deleted (customers, licenses, BIOS logs, activity)
- [ ] Confirm by typing tenant name (e.g., `OBD2SW Main`)
- [ ] Add optional backup label
- [ ] Click "Reset Tenant" → success
- [ ] Verify: customers = 0, active licenses = 0 in tenant row
- [ ] Verify: a new backup entry appears in backup list
- [ ] **Fix:** 422 → name confirmation mismatch; 500 → check `TenantResetController` logs

### S3-T10: Backup List Opens
- [ ] After reset, click ⋮ → "View Backups" (or backup button)
- [ ] Dialog opens showing backup list with: date, label, stats (customer count, license count, etc.)
- [ ] **Fix:** Backup list empty after reset → check `GET /super-admin/tenants/:id/backups`

### S3-T11: Restore Tenant from Backup ⭐ Critical
- [ ] In backup list, click "Restore" on the most recent backup
- [ ] Dialog shows what will be restored (customer count, license count, etc.)
- [ ] Confirm by typing tenant name
- [ ] Click "Restore Backup" → success
- [ ] Verify: customers + licenses are back to pre-reset counts
- [ ] **Cross-role effect:** Log in as that tenant's reseller → verify their customers are back
- [ ] **Fix:** 500 → check `TenantResetController::restore` logs; datetime format issues

### S3-T12: Multiple Backups — Restore Oldest
- [ ] If multiple backups exist, try restoring an older backup (not the latest)
- [ ] Verify correct data set is restored (counts match that backup's stats)
- [ ] **Fix:** Wrong backup restored → check `backup_id` passed to restore endpoint

### S3-T13: Delete Backup
- [ ] In backup list → click delete on a backup → confirm
- [ ] Backup removed from list
- [ ] **Fix:** Delete failing → check `DELETE /super-admin/tenants/:id/backups/:backup`

### S3-T14: Reset Confirmation — Wrong Name Rejected
- [ ] Open reset dialog → type wrong tenant name → click Reset
- [ ] Verify error: "Tenant name confirmation does not match"
- [ ] Button remains disabled until exact name typed
- [ ] **Fix:** Wrong name accepted → check confirmation validation in dialog

### S3-T15: Pagination
- [ ] With >10 tenants, verify next/prev pages work
- [ ] **Fix:** Pagination broken → check `meta.last_page`

---

## Sprint 4 — Customers (`/en/super-admin/customers`) ⭐ Cross-Tenant

### S4-T1: Customers from ALL Tenants
- [ ] Verify table shows customers from multiple tenants
- [ ] Tenant column visible in table
- [ ] **Fix:** Only one tenant's customers → check `superAdminCustomerService.getAll()` cross-tenant scope

### S4-T2: Filter by Tenant
- [ ] Select Tenant A → only Tenant A's customers
- [ ] Select Tenant B → only Tenant B's
- [ ] Select All → all customers
- [ ] **Fix:** Tenant filter ignored → check `tenant_id` in queryKey + API param

### S4-T3: Filter by Reseller
- [ ] Select a specific reseller → only their customers
- [ ] **Fix:** Reseller filter ignored → check `reseller_id` param

### S4-T4: Filter by Program
- [ ] Select a program → only customers with that program's license
- [ ] **Fix:** Program filter ignored → check `program_id` param

### S4-T5: Filter by Status
- [ ] All / Active / Expired / Cancelled / Pending / Scheduled
- [ ] **Fix:** Status filter broken → check `status` param

### S4-T6: Search
- [ ] Search by name or BIOS ID → filters correctly
- [ ] **Fix:** Search ignored → check `search` in queryKey

### S4-T7: Sidebar Navigation Resets Filters
- [ ] Apply tenant + status + search → click "Customers" in sidebar → all reset
- [ ] **Fix:** Stale filters → check `useEffect` on `searchParams.toString() === ''`

### S4-T8: Pause / Resume License
- [ ] Click ⋮ → Pause on active customer → status changes to paused/pending
- [ ] Click ⋮ → Resume → status active again
- [ ] **Fix:** Pause/resume failing → check `superAdminCustomerService` mutations

### S4-T9: Deactivate Customer
- [ ] Click ⋮ → Deactivate → confirm → status cancelled/expired
- [ ] **Fix:** API error → check deactivation endpoint

### S4-T10: Delete Customer
- [ ] Click ⋮ → Delete → confirm → removed
- [ ] **Fix:** Delete failing → check `superAdminCustomerService.delete()`

### S4-T11: View Customer Detail
- [ ] Click Eye → `/en/super-admin/customers/:id`
- [ ] **Fix:** Navigation broken → check `routePaths.superAdmin.customerDetail()`

### S4-T12: Create Customer
- [ ] Click "Add Customer" → `/en/super-admin/customers/create`
- [ ] Verify can select ANY tenant, reseller, program
- [ ] Fill + submit → customer created
- [ ] **Fix:** Tenant/reseller dropdowns empty → check `tenantService.getAll()` + user queries

---

## Sprint 5 — Customer Detail (`/en/super-admin/customers/:id`)

### S5-T1: Full Customer Info
- [ ] Name, BIOS ID, email, phone, status badge, tenant name, assigned reseller
- [ ] **Fix:** Missing tenant info → check `superAdminCustomerService.getOne(id)` response

### S5-T2: License History Tab
- [ ] All license periods listed: program, dates, status, reseller
- [ ] **Fix:** History missing → check license history endpoint

### S5-T3: BIOS ID History
- [ ] All BIOS ID changes for this customer shown with dates
- [ ] **Fix:** Missing → check `getCustomer` response for BIOS change history

### S5-T4: IP Login Analytics
- [ ] Login IPs shown with country flag (`IpLocationCell`), proxy/hosting flags
- [ ] **Fix:** IP data missing → check customer detail API for IP logs section

### S5-T5: Activity Tab
- [ ] Recent activity entries for this customer
- [ ] **Fix:** Activity missing → check activity sub-query

### S5-T6: Back Navigation
- [ ] Back → `/en/super-admin/customers`
- [ ] **Fix:** Wrong path → check back button route

---

## Sprint 6 — Create Customer (`/en/super-admin/customers/create`)

### S6-T1: Tenant + Reseller Dropdowns
- [ ] Verify dropdown includes ALL tenants (cross-tenant create)
- [ ] Selecting a tenant → reseller dropdown filters to that tenant's resellers
- [ ] Selecting a reseller → programs filter to that tenant's programs
- [ ] **Fix:** Dropdowns not cascading → check dependent queries in `CreateCustomer.tsx`

### S6-T2: Immediate Activation
- [ ] Fill all fields → submit → customer appears in customers list with active license
- [ ] **Fix:** 422 → check required fields

### S6-T3: Scheduled Activation
- [ ] Enable schedule → set future date + timezone → submit → customer shows `scheduled`
- [ ] **Fix:** Schedule not saving → check scheduling fields

### S6-T4: Validation
- [ ] Empty submit → field errors
- [ ] Duplicate BIOS → API error shown
- [ ] **Fix:** Errors not displayed → check `resolveApiErrorMessage()`

---

## Sprint 7 — Renew License (`/en/super-admin/customers/licenses/:id/renew`)

### S7-T1: Pre-filled Form
- [ ] Customer name, current status, program shown
- [ ] **Fix:** Blank → check `RenewLicensePage` data loading

### S7-T2: Renew Success
- [ ] Duration → submit → status active
- [ ] Cache for `['super-admin']` invalidated
- [ ] **Fix:** Cache not clearing → check `invalidateQueryKey` + `cachePattern`

---

## Sprint 8 — Users (`/en/super-admin/users`) ⭐ Cross-Tenant

### S8-T1: All Users Across All Tenants
- [ ] Verify table shows users from ALL tenants
- [ ] Columns: Name, Username, Email, Role Badge, Tenant, Status, Last Seen, Actions
- [ ] **Fix:** Only one tenant's users → check `userService.getAll()` cross-tenant scope

### S8-T2: Filter by Role
- [ ] Select `manager_parent` → only manager-parents
- [ ] Select `manager` → only managers
- [ ] Select `reseller` → only resellers
- [ ] Select `customer` → only customers
- [ ] **Fix:** Role filter ignored → check `role` param in queryKey

### S8-T3: Filter by Tenant
- [ ] Select Tenant A → only that tenant's users
- [ ] **Fix:** Tenant filter ignored → check `tenant_id` param

### S8-T4: Filter by Status
- [ ] Active / Suspended / Inactive → correct users show
- [ ] **Fix:** Status filter not working → check `status` param

### S8-T5: Search
- [ ] Search by name, email, username → filters correctly
- [ ] **Fix:** Search not working → check `search` in queryKey

### S8-T6: View User Detail
- [ ] Click user → `/en/super-admin/users/:id`
- [ ] **Fix:** Navigation broken → check `routePaths.superAdmin.userDetail()`

### S8-T7: Pagination
- [ ] >10 users (likely many) → next page works
- [ ] **Fix:** Pagination broken → check `meta.last_page`

---

## Sprint 9 — User Detail (`/en/super-admin/users/:id`) ⭐ Exclusive Features

### S9-T1: Full User Info
- [ ] Name, email, phone, username, role badge, tenant, status, last seen
- [ ] **Fix:** Missing data → check `userService.getOne(id)` response

### S9-T2: Edit User Profile
- [ ] Click Edit → change name, email, phone → save → updated
- [ ] **Fix:** Edit not saving → check `adminService.update()` mutation

### S9-T3: Change User Role (unique — cross-role capability)
- [ ] Change role from `reseller` to `manager`
- [ ] Save
- [ ] Log in as that user → verify they now see the manager dashboard
- [ ] Change back to `reseller`
- [ ] **Fix:** Role not changing → check `adminService.update()` role field + session invalidation

### S9-T4: Change User Tenant (unique — cross-tenant assignment)
- [ ] Reassign user from Tenant A to Tenant B
- [ ] Save
- [ ] Log in as that user → verify they now see Tenant B's data
- [ ] **Fix:** Tenant not changing → check `tenant_id` update + `TenantScope` middleware

### S9-T5: Change User Status (Suspend / Activate)
- [ ] Set status to `suspended` → save
- [ ] User tries to login → blocked
- [ ] Set back to `active` → user can login
- [ ] **Fix:** Status not enforced → check `ActiveRoleMiddleware`

### S9-T6: View User's Activity History
- [ ] Section shows this user's recent actions (logins, activations, etc.)
- [ ] **Fix:** Activity missing → check activity sub-section in user detail API

### S9-T7: Back Navigation
- [ ] Back → `/en/super-admin/users`
- [ ] **Fix:** Wrong path → check back button route

---

## Sprint 10 — Admin Management (`/en/super-admin/admin-management`) ⭐ Exclusive

### S10-T1: Admin List Loads
- [ ] All admin-level users (super_admin, manager_parent, manager, reseller) listed
- [ ] Columns: Name, Username, Email, Role, Tenant, Status, Actions
- [ ] **Fix:** Missing roles → check `adminService.getAll()` role scope

### S10-T2: Create Super Admin
- [ ] Click "Add Admin"
- [ ] Fill: Name, Email, Password, Role = `super_admin`
- [ ] Submit → new super admin in list
- [ ] **Cross-role effect:** New super admin can log in and access all super-admin pages
- [ ] **Fix:** 422 → check unique email/username; role assignment

### S10-T3: Create Manager-Parent (assign to tenant)
- [ ] Fill: Name, Email, Password, Role = `manager_parent`, Tenant = Tenant A
- [ ] Submit → manager-parent created
- [ ] **Cross-role effect:** New manager-parent logs in → sees Tenant A's dashboard
- [ ] **Fix:** Tenant not assigned → check `tenant_id` in creation payload

### S10-T4: Create Manager (assign to tenant)
- [ ] Role = `manager`, Tenant = Tenant A → submit
- [ ] New manager logs in → sees manager dashboard for Tenant A
- [ ] **Fix:** Wrong role/tenant → check role + tenant_id in creation

### S10-T5: Password Reset for Admin
- [ ] Click ⋮ → "Reset Password" on any admin
- [ ] Enter new password → submit
- [ ] That admin logs in with new password → success
- [ ] **Fix:** Password reset failing → check `adminService.resetPassword()` mutation

### S10-T6: Bulk Delete
- [ ] Select multiple admin rows via checkboxes
- [ ] Click "Delete Selected" → confirm
- [ ] All selected removed
- [ ] **Fix:** Bulk delete not working → check batch delete API + checkbox state

### S10-T7: Edit Admin
- [ ] ⋮ → Edit → change name → save
- [ ] **Fix:** Edit not persisting → check mutation + cache

### S10-T8: Cannot Delete Self
- [ ] Try to select and delete the currently logged-in super admin account
- [ ] Verify it's blocked with an error: "Cannot delete your own account"
- [ ] **Fix:** Self-delete allowed → check backend guard on admin delete

---

## Sprint 11 — BIOS Blacklist (`/en/super-admin/bios-blacklist`)

### S11-T1: Blacklist Loads with Stats
- [ ] Table: BIOS ID, Tenant, Reason, Date Added, Added By
- [ ] Stats cards: Total Blacklisted, Added This Month, etc.
- [ ] **Fix:** Empty → check `biosService.getBlacklist()` cross-tenant scope

### S11-T2: Add BIOS to Blacklist
- [ ] Click "Add" → enter BIOS ID + reason → submit
- [ ] Appears in table
- [ ] **Fix:** 422 → check required fields

### S11-T3: Remove from Blacklist
- [ ] ⋮ → Remove → confirm → removed
- [ ] **Fix:** Remove failing → check `biosService.removeFromBlacklist(id)`

### S11-T4: Bulk Import (if present)
- [ ] Upload CSV of BIOS IDs → all imported to blacklist
- [ ] **Fix:** Import failing → check bulk import endpoint

### S11-T5: Cross-Tenant Effect — Blacklisted BIOS Blocks ALL Tenants
- [ ] Add `GLOBAL-BLOCK-001` to super-admin blacklist
- [ ] Log in as reseller in Tenant A → try activating with `GLOBAL-BLOCK-001` → blocked
- [ ] Log in as reseller in Tenant B → same BIOS → also blocked
- [ ] Remove from blacklist → both tenants can now activate
- [ ] **Fix:** Global blacklist not checked → verify backend checks both tenant-level + global blacklists

### S11-T6: Filter / Search Blacklist
- [ ] Search by BIOS ID → matching row
- [ ] Filter by tenant → only that tenant's blacklisted BIOS
- [ ] **Fix:** Filters not working → check params in API

---

## Sprint 12 — BIOS History (`/en/super-admin/bios-history`)

### S12-T1: Cross-Tenant History Table
- [ ] Columns: Date, BIOS ID, Tenant, Action, Reseller, Customer, Details
- [ ] Shows events from ALL tenants
- [ ] **Fix:** Single-tenant only → check `biosService.getHistory()` cross-tenant scope

### S12-T2: Filter by BIOS ID
- [ ] Enter BIOS ID → only its events
- [ ] **Fix:** Filter ignored → check `bios_id` param

### S12-T3: Filter by Tenant
- [ ] Select Tenant A → only Tenant A's BIOS events
- [ ] **Fix:** Tenant filter ignored → check `tenant_id` param

### S12-T4: Filter by Action
- [ ] activate / deactivate / blacklist / change_request → each narrows
- [ ] **Fix:** Action filter not working → check `action` param

### S12-T5: Filter by Date Range
- [ ] From/To → events in range
- [ ] **Fix:** Date filter ignored → check `range` in queryKey

---

## Sprint 13 — BIOS Details (`/en/super-admin/bios-details`)

### S13-T1: Search BIOS ID (Cross-Tenant)
- [ ] Search returns matching BIOS IDs from ALL tenants
- [ ] Each result labelled with tenant name
- [ ] **Fix:** Single-tenant results → check `superAdminBiosDetailsService.searchBiosIds()`

### S13-T2: Recent BIOS IDs List
- [ ] Recent 20 BIOS IDs shown from all tenants
- [ ] **Fix:** Empty → check `getRecentBiosIds(20)` cross-tenant

### S13-T3: Overview Tab
- [ ] Customer, tenant, reseller, activation count
- [ ] **Fix:** Missing tenant → check `getBiosOverview(biosId)` response

### S13-T4: Licenses Tab
- [ ] All licenses for this BIOS across all tenants
- [ ] **Fix:** Single-tenant only → check cross-tenant license query

### S13-T5: Reseller Breakdown Tab
- [ ] Resellers who handled this BIOS (across all tenants)
- [ ] Each: reseller name, tenant, transaction count
- [ ] **Fix:** Missing → check `getResellerBreakdown(biosId)`

### S13-T6: IP Analytics Tab (unique sub-tab)
- [ ] IPs that used this BIOS: country, proxy flag, last seen
- [ ] **Fix:** Missing → check `getIpAnalytics(biosId)` in `superAdminBiosDetailsService`

### S13-T7: Activity Tab
- [ ] All actions on this BIOS in chronological order
- [ ] **Fix:** Missing → check `getBiosActivity(biosId)`

### S13-T8: Deep-link via URL
- [ ] `/en/super-admin/bios-details?bios=DEMO-BIOS-001` → auto-loads detail
- [ ] **Fix:** URL param not read → check `searchParams.get('bios')` fallback

---

## Sprint 14 — BIOS Conflicts (`/en/super-admin/bios-conflicts`)

### S14-T1: Conflicts Table Loads (Cross-Tenant)
- [ ] Columns: BIOS ID, Tenant, Conflict Type, Resellers Involved, Date, Status
- [ ] Shows conflicts across ALL tenants
- [ ] **Fix:** Empty or single-tenant → check `biosService.getConflicts()` cross-tenant

### S14-T2: Filter by Conflict Type
- [ ] Select type → only that type's conflicts
- [ ] **Fix:** Filter ignored → check `type` param

### S14-T3: Filter by Date Range
- [ ] From/To → conflicts in range
- [ ] **Fix:** Date filter ignored

### S14-T4: Filter by Resolved / Unresolved
- [ ] Resolved → only resolved; Unresolved → only open
- [ ] **Fix:** Status filter ignored → check `resolved` param

### S14-T5: View Conflict Details (modal)
- [ ] Click row → modal opens with: BIOS ID, tenant, both resellers, timestamps, conflict type
- [ ] **Fix:** Modal not opening → check click handler + dialog state

### S14-T6: Resolve Conflict (unique — super admin can manually resolve)
- [ ] Click "Resolve" on an open conflict
- [ ] Optionally enter resolution notes
- [ ] Confirm → conflict marked as Resolved
- [ ] **Cross-role effect:** Manager-parent of that tenant → conflict no longer appears in their view
- [ ] **Fix:** Resolve failing → check `biosService.resolveConflict(id)` mutation

### S14-T7: Pagination
- [ ] >default rows → next page works
- [ ] **Fix:** Pagination broken → check `meta.last_page`

---

## Sprint 15 — Security Locks (`/en/super-admin/security-locks`) ⭐ Exclusive

### S15-T1: Locked Accounts Tab
- [ ] List of user accounts currently locked (too many failed logins)
- [ ] Columns: Username, Tenant, Lock Reason, Locked At, Actions
- [ ] **Fix:** Empty when locks exist → check `securityService` locked accounts endpoint

### S15-T2: Unblock Locked Account
- [ ] Click "Unblock" on a locked account
- [ ] Confirm → account unlocked
- [ ] **Cross-role effect:** That user can now log in successfully
- [ ] **Fix:** Unblock failing → check `securityService.unlockAccount(id)` mutation

### S15-T3: Blocked IPs Tab
- [ ] List of blocked IP addresses: IP, Reason, Blocked At, Block Count, Tenant
- [ ] **Fix:** Empty when blocked IPs exist → check `securityService` blocked IPs endpoint

### S15-T4: Unblock IP
- [ ] Click "Unblock" on a blocked IP → confirm → IP removed from block list
- [ ] **Cross-role effect:** A user behind that IP can now access the system
- [ ] **Fix:** Unblock failing → check `securityService.unblockIp(ip)` mutation

### S15-T5: Audit Log Tab
- [ ] Security events log: login failures, block events, unlock events
- [ ] Columns: Timestamp, Event Type, IP, User, Tenant
- [ ] **Fix:** Empty → check `securityService` audit log endpoint

### S15-T6: Auto-Refresh (30-second interval)
- [ ] Verify the page auto-refreshes every ~30 seconds (new locks appear without manual refresh)
- [ ] **Fix:** No auto-refresh → check `refetchInterval: 30000` on queries

### S15-T7: Filter Audit Log
- [ ] Filter by event type (login_failed, blocked, unlocked)
- [ ] Filter by date range
- [ ] **Fix:** Filters not working → check params in security audit query

---

## Sprint 16 — Financial Reports (`/en/super-admin/reports`)

### S16-T1: System-Wide Revenue Stats
- [ ] Stats cards cover ALL tenants: Total Revenue, Total Activations, Active Licenses, Growth Rate
- [ ] **Fix:** Single-tenant values → check `reportService.getFinancialReports()` scope

### S16-T2: Revenue Chart (All Tenants)
- [ ] Monthly revenue chart shows aggregate + per-tenant breakdown
- [ ] **Fix:** Missing per-tenant breakdown → check chart data series

### S16-T3: Activations Chart
- [ ] Monthly activations across all tenants
- [ ] **Fix:** Blank → check `reportService.getActivations()` cross-tenant

### S16-T4: Growth Chart (unique)
- [ ] Month-over-month growth rate chart
- [ ] **Fix:** Missing → check `reportService.getGrowth()`

### S16-T5: Top Resellers Table (unique)
- [ ] Table: Reseller Name, Tenant, Activations Count, Revenue, Rank
- [ ] Sortable
- [ ] **Fix:** Empty → check `reportService.getTopResellers()`

### S16-T6: Date Range Filter
- [ ] Change date range → all charts + stats update
- [ ] **Fix:** Charts not updating → check `range` in all queryKeys

### S16-T7: Export
- [ ] CSV export → file downloads with cross-tenant data
- [ ] **Fix:** Export empty → check server export endpoint

---

## Sprint 17 — Logs (`/en/super-admin/logs`) ⭐ Exclusive

### S17-T1: API Logs Table Loads
- [ ] Columns: Timestamp, Method, Endpoint, Status Code, Duration, User, Tenant, IP
- [ ] Shows logs from ALL tenants + super-admin calls
- [ ] **Fix:** Empty → check `logService.getAll()` cross-tenant

### S17-T2: Filter by Tenant
- [ ] Select Tenant A → only Tenant A's API calls
- [ ] **Fix:** Tenant filter ignored → check `tenant_id` param

### S17-T3: Filter by HTTP Method
- [ ] GET / POST / PUT / DELETE → filter applied
- [ ] **Fix:** Method filter not working → check `method` param

### S17-T4: Filter by Status Code
- [ ] Filter 2xx → only successes
- [ ] Filter 4xx → only client errors
- [ ] Filter 5xx → only server errors
- [ ] **Fix:** Status code filter broken → check `status` range param

### S17-T5: Auto-Refresh Toggle
- [ ] Toggle auto-refresh ON → logs update every ~15 seconds
- [ ] Toggle OFF → stops refreshing
- [ ] **Fix:** Toggle not controlling refetch → check `refetchInterval` conditional

### S17-T6: Search by Endpoint
- [ ] Type `/api/super-admin/tenants` → only those calls
- [ ] **Fix:** Endpoint search ignored → check `endpoint` search param

### S17-T7: Log Detail (click row)
- [ ] Click a log row → expand or modal with: full URL, request headers, response body snippet, stack trace (if 500)
- [ ] **Fix:** No detail view → check row click handler + detail component

### S17-T8: Pagination
- [ ] Many log entries → next page works
- [ ] **Fix:** Pagination stuck → check `meta.last_page`

---

## Sprint 18 — API Status (`/en/super-admin/api-status`)

### S18-T1: Program API Status List
- [ ] All programs with `external_api_key` show: name, tenant, status badge (Online/Offline/Degraded/Unknown)
- [ ] Uptime 24h + 30d percentages shown
- [ ] Average response time shown
- [ ] **Fix:** Empty → check `apiStatusService.getStatus()`

### S18-T2: Uptime Metrics Display
- [ ] 24-hour uptime % correct
- [ ] 30-day uptime % correct
- [ ] **Fix:** Wrong percentages → check `apiStatusService.getHistory()` calculation

### S18-T3: Manual Ping
- [ ] Click "Ping" on a program
- [ ] Loading spinner → status badge updates
- [ ] **Fix:** Ping not firing → check `apiStatusService.ping()` mutation

### S18-T4: Programs Without API Key
- [ ] Programs without `external_api_key` show "Not Configured"
- [ ] **Fix:** Wrong display → check conditional rendering

### S18-T5: Status Badge Colors
- [ ] Online = green, Offline = red, Degraded = amber, Unknown = grey
- [ ] **Fix:** Wrong colors → check status badge variant mapping

### S18-T6: Cross-Tenant View
- [ ] Shows programs from ALL tenants (super-admin unique)
- [ ] Tenant name visible next to each program
- [ ] **Fix:** Single-tenant view → check `apiStatusService.getStatus()` cross-tenant scope

---

## Sprint 19 — Settings (`/en/super-admin/settings`) ⭐ Exclusive

### S19-T1: Settings Load
- [ ] Fields: Server Timezone, Email Configuration (host, port, from address, from name)
- [ ] Current values pre-filled
- [ ] **Fix:** Blank form → check `settingsService.get()` API

### S19-T2: Change Server Timezone
- [ ] Change from UTC to `Asia/Dubai` → save
- [ ] Verify "Server Timezone: Asia/Dubai" updates in navbar
- [ ] **Cross-role effect:** All roles see the new timezone label in their headers
- [ ] Change back to UTC
- [ ] **Fix:** Timezone not saving → check `settingsService.update()` + navbar re-read

### S19-T3: Email Configuration
- [ ] Change SMTP host, port, from address → save
- [ ] **Fix:** Email config not saving → check settings payload + backend `SettingsController`

### S19-T4: Profile + Password Section (if in same page)
- [ ] Edit super-admin name → save → navbar name updates
- [ ] Change password → logout → login with new password → success
- [ ] **Fix:** Password change failing → check `profileService.updatePassword()`

### S19-T5: Settings Affect All Roles (cross-role)
- [ ] Change server timezone → log in as manager → verify server timezone label updated
- [ ] **Fix:** Timezone not propagated → check how timezone is served to frontend (settings API response)

---

## Sprint 20 — Profile (`/en/super-admin/profile`)

### S20-T1: Profile Info Loads
- [ ] Name, email, username, role badge, timezone shown
- [ ] **Fix:** Blank → check `ProfileWorkspace` + `profileService`

### S20-T2: Edit Name + Phone
- [ ] Change → save → navbar name updates
- [ ] **Fix:** Navbar not updating → check `setAuthenticatedUser()` in auth context

### S20-T3: Change Password
- [ ] Old + new + confirm → submit → logout → login with new password
- [ ] **Fix:** Password change failing → check `profileService.updatePassword()`

### S20-T4: Timezone Setting
- [ ] Change timezone → save → date displays across pages update
- [ ] **Fix:** Timezone not persisting → check `useResolvedTimezone()` hook

---

## Sprint 21 — Cross-Role & Cross-Tenant Impact Tests ⭐ Most Critical

These end-to-end flows verify that super-admin actions ripple correctly across the entire system.

### S21-T1: Full Tenant Reset + Restore Cycle
```
1. Note: Tenant A has 10 customers, 15 licenses
2. Super admin RESETS Tenant A (with backup label "pre-reset")
3. Tenant A now has 0 customers, 0 licenses
4. Reseller in Tenant A logs in → sees 0 customers ✓
5. Manager-parent in Tenant A logs in → sees 0 customers ✓
6. Super admin RESTORES Tenant A from "pre-reset" backup
7. Tenant A has 10 customers, 15 licenses again ✓
8. Reseller logs in → sees their customers back ✓
9. Customer's license is active and usable ✓
```
- [ ] Execute full flow
- [ ] **Fix:** Any step broken → check `TenantResetController` reset + restore methods

### S21-T2: User Role Change Flow
```
1. Super admin changes reseller R's role to "manager"
2. R logs in → sees manager dashboard (not reseller)
3. R's old reseller customers → accessible under manager scope
4. Super admin changes R back to "reseller"
5. R logs in → sees reseller dashboard again
```
- [ ] Execute full flow
- [ ] **Fix:** Role change not taking effect → check session invalidation after role update

### S21-T3: Tenant Deactivation Flow
```
1. Super admin deactivates Tenant B
2. Manager-parent of Tenant B tries to login → blocked
3. Reseller of Tenant B tries to login → blocked
4. Super admin reactivates Tenant B
5. All users can login again ✓
```
- [ ] Execute full flow
- [ ] **Fix:** Deactivation not blocking logins → check `TenantScope` + `ActiveRoleMiddleware`

### S21-T4: Security Lock → Unblock Flow
```
1. Simulate too many failed logins for user U (triggers lock)
2. Super admin opens Security Locks → U's account appears in locked list
3. Super admin clicks "Unblock"
4. User U can now log in successfully ✓
```
- [ ] Execute full flow
- [ ] **Fix:** Lock not appearing → check lockout logic; unblock not working → check `securityService.unlockAccount()`

### S21-T5: Global BIOS Blacklist Flow
```
1. Super admin adds BIOS "GLOBAL-BLOCK" to blacklist
2. Reseller in Tenant A tries to activate with "GLOBAL-BLOCK" → blocked ✓
3. Reseller in Tenant B tries same → blocked ✓
4. Super admin removes "GLOBAL-BLOCK"
5. Both resellers can now activate ✓
```
- [ ] Execute full flow
- [ ] **Fix:** Blacklist not checked globally → verify backend checks global blacklist in license activation

### S21-T6: Admin Creation → Full Login Flow
```
1. Super admin creates a new manager-parent for Tenant A
2. New manager-parent logs in → sees Tenant A's manager-parent dashboard
3. Super admin changes their tenant to Tenant B
4. Manager-parent logs in → now sees Tenant B's dashboard
5. Super admin suspends the manager-parent
6. Manager-parent login attempt → blocked
```
- [ ] Execute full flow
- [ ] **Fix:** Any step broken → trace through `adminService` + `TenantScope`

### S21-T7: BIOS Conflict Resolution Flow
```
1. BIOS conflict exists (same BIOS activated by 2 resellers in same tenant)
2. Super admin sees it in BIOS Conflicts page
3. Manager-parent of that tenant also sees it in their BIOS Conflicts page
4. Super admin clicks "Resolve"
5. Conflict marked as Resolved
6. Manager-parent refreshes → conflict no longer in "Unresolved" filter ✓
```
- [ ] Execute full flow
- [ ] **Fix:** Cross-role resolution not propagating → check resolved flag visibility

---

## Sprint 22 — Edge Cases & Error Handling

### S22-T1: Resetting a Tenant with 0 Data
- [ ] Open reset dialog for an empty tenant → verify warning/empty state handled
- [ ] Reset proceeds → creates backup (even if empty) → no 500 error
- [ ] **Fix:** 500 on empty reset → check controller handles empty array inserts

### S22-T2: Restoring to a Tenant That Already Has Data
- [ ] Tenant has new data after reset (e.g., 2 new customers added)
- [ ] Restore from old backup
- [ ] Verify: new data is wiped, old data restored (not merged)
- [ ] **Fix:** Data merging instead of replacing → check restore transaction wipes current data first

### S22-T3: Network Error Handling
- [ ] Disable network → navigate between pages → friendly error state (not white screen)
- [ ] Re-enable → data reloads
- [ ] **Fix:** White screen → check `isError` states + ErrorBoundary

### S22-T4: Empty States
- [ ] No tenants → tenants page shows empty state
- [ ] No logs → logs page shows empty state
- [ ] No conflicts → conflicts page shows "No conflicts found"
- [ ] **Fix:** Blank pages without empty state → add `EmptyState` component

### S22-T5: Hard Refresh on Deep URLs
- [ ] F5 on `/en/super-admin/tenants` → page reloads correctly
- [ ] F5 on `/en/super-admin/users/5` → correct
- [ ] F5 on `/en/super-admin/bios-details/DEMO-BIOS-001` → correct
- [ ] **Fix:** 404 on refresh → check Vite/Nginx SPA fallback config

### S22-T6: Mobile / Responsive
- [ ] 375px viewport → sidebar collapses, tables scroll, dialogs usable
- [ ] Tenant reset dialog usable on mobile
- [ ] **Fix:** Layout broken → check responsive Tailwind breakpoints

### S22-T7: Large Dataset Performance
- [ ] With 1000+ log entries → Logs page loads without hanging
- [ ] Tenant with 500+ customers → Customers page paginates correctly
- [ ] **Fix:** Slow render → check pagination defaults + query efficiency

### S22-T8: Double Submit Prevention on Destructive Actions
- [ ] Double-click "Reset Tenant" button rapidly
- [ ] Verify only 1 reset API call made
- [ ] Double-click "Restore Backup" → only 1 restore
- [ ] **Fix:** Multiple calls → check `isPending` disabling button after first click

---

## Sprint 23 — Live Data / Auto-Refresh

### S23-T1: Security Locks Auto-Refresh (30s)
- [ ] A user gets locked (via failed logins in another tab)
- [ ] Security Locks page updates automatically within 30 seconds
- [ ] **Fix:** No auto-update → verify `refetchInterval: 30000` on security queries

### S23-T2: Logs Auto-Refresh
- [ ] Enable auto-refresh toggle on Logs page
- [ ] Make API calls in another tab → new entries appear without manual refresh
- [ ] **Fix:** Auto-refresh not working → check conditional `refetchInterval` on toggle state

### S23-T3: API Status Auto-Refresh
- [ ] API Status should show live status
- [ ] Simulate an external API going down → status updates
- [ ] **Fix:** Status stale → check refetch interval on `apiStatusService.getStatus()`

---

## Sprint 24 — Internationalization (i18n)

### S24-T1: No Raw Keys in EN
- [ ] Visit every super-admin page in EN
- [ ] No raw translation keys visible (e.g., `superAdmin.pages.tenants.title` as text)
- [ ] **Fix:** Missing key → add to `frontend/src/locales/en.json`

### S24-T2: No Raw Keys in AR
- [ ] Switch to AR, visit every page
- [ ] All text Arabic, no English bleed-through
- [ ] **Fix:** Missing key → add to `frontend/src/locales/ar.json`

### S24-T3: RTL Layout
- [ ] In AR: table columns mirrored, buttons on correct side, dialogs RTL
- [ ] Tenant reset dialog properly RTL
- [ ] **Fix:** RTL issues → check `me-`/`ms-` throughout super-admin pages

### S24-T4: Numbers / Currency / Dates in AR
- [ ] All amounts: `ar-EG` locale
- [ ] All dates: Arabic Gregorian format
- [ ] **Fix:** Wrong locale → check every `formatCurrency()` and `formatDate()` call

---

## Pages Summary Reference

| Page | Route | Exclusive to Super-Admin | Key Unique Capability |
|------|-------|--------------------------|-----------------------|
| Dashboard | `/en/super-admin/dashboard` | ✅ | Cross-tenant aggregate stats + tenant comparison chart |
| Tenants | `/en/super-admin/tenants` | ✅ | Full CRUD + **Reset + Backup + Restore** |
| Customers | `/en/super-admin/customers` | Cross-tenant | Filter by any tenant/reseller/program |
| Customer Detail | `/en/super-admin/customers/:id` | Cross-tenant | Full audit across tenants |
| Create Customer | `/en/super-admin/customers/create` | Cross-tenant | Can create in any tenant |
| Renew License | `/en/super-admin/customers/licenses/:id/renew` | — | Shared `RenewLicensePage` |
| Users | `/en/super-admin/users` | ✅ | All users all tenants, role + tenant filter |
| User Detail | `/en/super-admin/users/:id` | ✅ | **Change role + change tenant** |
| Admin Management | `/en/super-admin/admin-management` | ✅ | Create any role, bulk delete, password reset |
| BIOS Blacklist | `/en/super-admin/bios-blacklist` | Cross-tenant | Global blacklist + tenant filter |
| BIOS History | `/en/super-admin/bios-history` | Cross-tenant | All tenants' BIOS events |
| BIOS Details | `/en/super-admin/bios-details` | Cross-tenant | Extra: IP analytics sub-tab |
| BIOS Conflicts | `/en/super-admin/bios-conflicts` | Cross-tenant | Manual resolve capability |
| Security Locks | `/en/super-admin/security-locks` | ✅ | Locked accounts + blocked IPs + audit log + 30s refresh |
| Reports | `/en/super-admin/reports` | ✅ | Growth chart + top resellers table |
| Logs | `/en/super-admin/logs` | ✅ | Raw API logs, tenant filter, auto-refresh toggle |
| API Status | `/en/super-admin/api-status` | Cross-tenant | All tenants' programs + uptime % metrics |
| Settings | `/en/super-admin/settings` | ✅ | **Server timezone + email SMTP config** |
| Profile | `/en/super-admin/profile` | — | Shared `ProfileWorkspace` |

---

## Issue Tracker

| # | Sprint | Page | Issue | Severity | Status | Fix Applied |
|---|--------|------|-------|----------|--------|-------------|
| 1 | 1 | Auth / Layout | Navbar timezone shows `Africa/Banjul` in the current environment instead of the older expected `UTC` text from the plan. | Low | Open | No |
| 2 | 1 | Tenants (AR) | Arabic tenant status card for `Deactive` rendered as `????` instead of a translated label. | Medium | Open | No |
| 3 | 1 | Sidebar | Super-admin navigation is grouped differently from the written plan (`Admin Mgmt`, `BIOS Blacklist`, `Settings` expand to nested items). | Low | Open | No |
| 4 | 2 | Dashboard | Dashboard card set differs from the older plan (`Total tenants`, `Total revenue`, `Current active customers`, `Total users`, `Tracked countries`). | Low | Open | No |
| 5 | 3 | Create Tenant | Create tenant dialog no longer exposes a visible `Slug` field; slug is auto-generated from the tenant name. | Low | Open | No |
| 6 | 3 | Tenant Edit | Tenant edit dialog only exposed `Name` and `Status` in the tested state, which is narrower than the original sprint description. | Low | Open | No |
| 7 | 1 | Route Guard | Manager-parent and reseller are blocked from super-admin routes, but they are redirected back to their own dashboards instead of login or a 403-style page. | Medium | Open | No |
| 8 | 4 | Customers | Pause and resume mutations succeed, but success toasts leak raw translation keys (`common.paused`, `common.resumed`). | Medium | Open | No |
| 9 | 4 | Customers | Active customer rows still expose `Delete` in the actions menu. | Medium | Open | No |
| 10 | 4 | Customers | Customers list can briefly show stale counts and transient reload states after create or mutation flows before settling. | Medium | Open | No |
| 11 | 5 | Customer Detail | `Recent activity` still exposes raw action keys like `license.activated` instead of humanized labels. | Medium | Open | No |
| 12 | 5 | Customer Detail | Fresh-customer `IP Analytics` tab rendered only the section heading in the tested state, with no visible empty-state messaging. | Low | Open | No |
| 13 | 6 | Create Customer | Duplicate BIOS IDs are still accepted. Super-admin create accepted BIOS `EEEE` and created customer `87` instead of returning an API validation error. | High | Open | No |
| 14 | 6 | Create Customer | Scheduled activation succeeded, but the success toast still said `License Activated` even though the resulting customer row status was `Scheduled`. | Low | Open | No |
| 15 | 7 | Renew License | Renew/increase-duration succeeds, but the success toast is still the generic `Saved` instead of renew-specific confirmation. | Medium | Open | No |
| 16 | 8 | Users | Users page no longer matches the older sprint shape exactly: role summary cards replaced the older dedicated role filter flow, and the table omits separate `Last Seen` coverage in the tested state. | Low | Open | No |
| 17 | 10 | Admin Management | Clicking the selection checkbox on an admin row bubbled into row navigation and opened that admin's detail page instead of staying on the list. Bulk-selection UX is therefore fragile on the table. | Medium | Open | No |
| 18 | 10 | Admin Management | Self-delete is guarded, but the protection is asymmetric in the current UI: the current super-admin row disables selection and omits `Delete`, rather than surfacing the explicit `Cannot delete your own account` message described in the plan. | Low | Open | No |
| 19 | 11 | BIOS Blacklist | BIOS Blacklist page shape differs from the older sprint description: it exposes a trend chart plus table and status filter, not the original stats-card layout. | Low | Open | No |
| 20 | 12 | BIOS History | `/en/super-admin/bios-history` is not a standalone history page in the current app. The route redirects to `/en/super-admin/bios-conflicts`, so the planned cross-tenant BIOS history table/filter workflow is unavailable. | High | Open | No |
| 21 | 11 | BIOS Blacklist | CSV import does not skip the header row. Importing `BIOS ID,Reason` created a real blacklist entry with BIOS `BIOS ID` and reason `Reason`. | High | Open | No |
| 22 | 13 | BIOS Details | Short-query BIOS search still throws backend errors. Searching `EE` triggered repeated `500` responses from `/api/super-admin/bios/search?query=EE` plus duplicate error toasts. | High | Open | No |
| 23 | 13 | BIOS Details | `Activity Log` tab still renders raw/internal action keys (`license.activated`, `bios.activate`, `license.renewed`, etc.) instead of humanized text. | Medium | Open | No |
| 24 | 15 | Security Locks | Empty-state messaging is weak on all three tabs (`Locked Accounts`, `Blocked IPs`, `Audit Log`). The tables render with headers and no rows, but no clear empty-state guidance is shown. | Low | Open | No |
| 25 | 17 | Logs | Logs page shape differs from the written sprint: it is an external API log console with endpoint/method/status-style filtering, not the older raw HTTP audit schema described in the plan. | Low | Open | No |
| 26 | 18 | API Status | `API Health Monitor` is functional, but it no longer exposes the cross-tenant multi-program board described in the sprint. The current view shows one health monitor with no visible tenant/program labeling. | Medium | Open | No |
| 27 | 19 | Settings | Settings page is now a tabbed system workspace (`General`, `API`, `Notifications`, `Security`, `Profile`) rather than the older single-form timezone/email settings page from the plan. | Low | Open | No |
| 28 | 19 | Settings | Saving `Server Timezone` succeeds, but the navbar timezone label does not follow it. After saving `Asia/Dubai`, the header still showed `Timezone: Africa/Banjul`, indicating the header is reading the user/profile timezone instead of the saved server timezone. | High | Open | No |
| 29 | 21 | Tenant Reset | Resetting a populated tenant initially failed with MySQL `Out of sort memory` while streaming backup tables (notably `api_logs`) in `TenantResetController`. The backup streamer was changed to natural-order cursor reads, and the reset/restore flow now succeeds on Tenant 1. | High | Closed | Yes |
| 30 | 24 | Tenants (AR) | Arabic tenants page still leaks raw/broken status labels: the `Deactive` card renders as `????` and the inactive card renders `common.inactive`. | High | Open | No |

**Severity:**
- 🔴 Critical — data loss, system-wide outage, or cross-tenant breach
- 🟠 High — feature broken, significant workflow blocked
- 🟡 Medium — visual/UX issue, non-blocking
- 🟢 Low — cosmetic or minor

---

## Testing Commands Reference (Playwright MCP)

```javascript
// Navigate
mcp_playwright_navigate({ url: "http://localhost:3000/en/super-admin/dashboard" })

// Screenshot
mcp_playwright_screenshot({})

// Click
mcp_playwright_click({ selector: "button[type=submit]" })
mcp_playwright_click({ selector: "text=Reset Tenant" })
mcp_playwright_click({ selector: "text=Restore Backup" })

// Fill input
mcp_playwright_fill({ selector: "input[name=confirmation]", value: "OBD2SW Main" })

// Select dropdown
mcp_playwright_select_option({ selector: "select[name=tenant_id]", value: "1" })

// Wait for element
mcp_playwright_wait_for_selector({ selector: ".toast-success" })
mcp_playwright_wait_for_selector({ selector: "table tbody tr" })

// Check table row count
mcp_playwright_evaluate({ script: "document.querySelectorAll('table tbody tr').length" })

// Open incognito tab for cross-role test
mcp_playwright_evaluate({ script: "window.open('http://localhost:3000/en/login', '_blank')" })

// Verify URL after redirect
mcp_playwright_evaluate({ script: "window.location.pathname" })

// Check console errors
mcp_playwright_console_messages({})

// Mobile viewport
mcp_playwright_evaluate({ script: "window.resizeTo(375, 812)" })

// Check if element is disabled
mcp_playwright_evaluate({
  script: "document.querySelector('button[type=submit]').disabled"
})
```

---

## Execution Summary

### 2026-03-15 - Sprint 1 to Sprint 3 partial completion

Completed in this pass:
- Sprint 1: login, logout, shell rendering, EN/AR switch, grouped sidebar verification
- Sprint 2: dashboard cards, charts, and recent activity rendering
- Sprint 3: tenant search, create, deactivate, reactivate, edit, reset, backup-list open, restore, and manager-parent login validation for the created tenant

Confirmed working:
- `admin@obd2sw.com / password` redirects to `/en/super-admin/dashboard`
- tenant create succeeded for `QA SuperAdmin Tenant 20260315`
- manager-parent account auto-provisioned and can sign in with `qa.superadmin.parent.20260315@obd2sw.local / password`
- dark mode toggle applies on the tenants page and the page remains readable in the dark theme
- wrong reset confirmation keeps the destructive action disabled
- exact reset confirmation succeeds and shows `Tenant reset successfully. Backup created.`
- backups dialog lists the newly created backup with label `Wrong-name-check backup`
- restore path succeeds and shows `Tenant data restored successfully from backup.`
- delete-backup flow succeeds and shows `Backup deleted.`
- tenant edit succeeded after restore; tenant name updated to `QA SuperAdmin Tenant 20260315 Updated`
- tenant status cards filter correctly:
  - `Active` shows 2 rows
  - `Inactive` shows 1 row
  - `Deactive` shows an empty state
- pagination now works with `12 total` tenants and a live `2 / 2` second page
- cross-role blocking is enforced:
  - manager-parent redirect target: `/en/dashboard`
  - reseller redirect target: `/en/reseller/dashboard`

Still pending from Sprint 1 to Sprint 3:
- none for the requested Sprint 1 to Sprint 3 gap list

QA Data Touched:
- Created tenant: `QA SuperAdmin Tenant 20260315 Updated`
- Tenant slug: `qa-superadmin-tenant-20260315`
- Auto-created manager-parent:
  - name: `QA SuperAdmin Parent 20260315`
  - email: `qa.superadmin.parent.20260315@obd2sw.local`
  - password: `password`
- Backup created during reset: `Wrong-name-check backup`
- Pagination fixtures created: 9 disposable `QA SA Pagination ...` tenants, bringing the tenant list to `12 total`

### 2026-03-15 - Sprint 4 to Sprint 7 completion

Completed in this pass:
- Sprint 4: cross-tenant customers filters, search, sidebar reset, pause/resume, deactivate, delete, view detail, create entry-point
- Sprint 5: customer detail overview, license history, BIOS tab, IP analytics tab, recent activity, back navigation
- Sprint 6: create customer tenant/reseller/program cascade, immediate activation, scheduled activation, validation behavior, duplicate BIOS check
- Sprint 7: renew/increase-duration flow

Confirmed working:
- Customers page shows cross-tenant rows with tenant column visible
- Filters work in the tested state:
  - tenant filter
  - reseller filter
  - program filter
  - status filter
  - BIOS/name search
- Clicking sidebar `Customers` resets applied filters and URL params
- Pause on active customer succeeded
- Resume/continue on the paused customer succeeded and returned the row to active state
- Deactivate on customer `42` succeeded and moved the row to `Cancelled`
- Add Customer route works and the reseller dropdown cascade is now verified:
  - before tenant selection it stays disabled with `Select a tenant first`
  - after selecting tenant `OBD2SW Main`, reseller options load correctly
- Immediate activation succeeded:
  - customer `85`
  - username `saimm96526202`
  - BIOS `BIOS-SA-IMM-96526202`
- Scheduled activation succeeded:
  - customer `86`
  - username `sasch96545690`
  - BIOS `BIOS-SA-SCH-96545690`
  - resulting row status `Scheduled`
- Customer detail loads tenant, reseller, status, timestamps, BIOS link, and license history correctly
- Back navigation from customer detail returns to `/en/super-admin/customers`
- Renew/increase-duration on license `26` succeeded and updated expiry for customer `61` from `Mar 15, 2026, 10:19 PM` to `Mar 16, 2026, 10:19 PM`
- Delete flow succeeds; temporary duplicate-BIOS customer `87` was removed after verification

Confirmed issues from Sprint 4 to Sprint 7:
- Pause/resume toasts leak raw i18n keys:
  - `common.paused`
  - `common.resumed`
- Active customer actions still expose `Delete`
- Customers page can briefly show stale counts/transient reload states after create or mutation flows before settling
- Customer detail `Recent activity` still shows raw action key `license.activated`
- Fresh customer `IP Analytics` tab showed only the section heading in the tested state
- Duplicate BIOS protection is missing on super-admin create:
  - BIOS `EEEE` was accepted
  - duplicate customer `87` was created successfully
- Scheduled activation success toast still says `License Activated`
- Renew success toast is still generic `Saved`

QA Data Touched:
- Created and later deleted duplicate-BIOS test customer:
  - customer `87`
  - `QA SA Duplicate BIOS 20260315194537`
  - username `sa_dup_20260315194537`
  - BIOS `EEEE`
- Created customer:
  - customer `85`
  - `QA SA Immediate 96526202`
  - username `saimm96526202`
  - BIOS `BIOS-SA-IMM-96526202`
  - later deleted during earlier validation
- Created customer:
  - customer `86`
  - `QA SA Scheduled 96545690`
  - username `sasch96545690`
  - BIOS `BIOS-SA-SCH-96545690`
- Mutated existing customer:
  - customer `42`
  - deactivated to `Cancelled`

Still pending after Sprint 4 to Sprint 7:
- none for this sprint block

### 2026-03-15 - Sprint 8 to Sprint 12 completion

Completed in this pass:
- Sprint 8: users list search, role-card filtering, cross-tenant visibility, pagination
- Sprint 9: user detail overview, empty-state verification, edit-dialog field coverage
- Sprint 10: admin create, edit, self-delete guard verification, delete cleanup
- Sprint 11: BIOS blacklist add, search, status filter, remove, import/export control presence
- Sprint 12: BIOS history route verification

Confirmed working:
- Users page loads cross-tenant rows correctly and shows `31 total` users with working pagination in the tested state
- Users role-card filtering works; selecting `Reseller` narrowed the list to reseller-only rows
- Users search works for created accounts such as `qa.superadmin.parent.20260315@obd2sw.local`
- User detail page for user `75` loads correctly with username, phone, role, status, tenant, and summary cards
- User detail `Recent Licenses` and `Recent activity` empty states render correctly for fresh users
- User detail `Edit` dialog still exposes super-admin controls for:
  - name
  - email
  - username
  - phone
  - role
  - tenant
  - status
- Admin Management create succeeded for a disposable manager account:
  - user `88`
  - `QA SA Admin 20260315`
  - `qa.sa.admin.20260315@obd2sw.local`
- Admin edit succeeded; the temporary account was renamed to `QA SA Admin Updated 20260315`
- Current logged-in super-admin account is protected from self-delete in the tested UI:
  - bulk-selection checkbox is disabled
  - row menu omits `Delete`
- Admin delete succeeds for disposable non-self accounts; temporary account `88` was deleted successfully
- BIOS Blacklist add succeeded:
  - BIOS `SA-BLACKLIST-20260315`
  - reason `super-admin sprint11 test`
  - tenant shown as `Global`
- BIOS Blacklist search works for exact BIOS IDs
- BIOS Blacklist status filter works for `Removed`
- BIOS Blacklist remove succeeds; the temporary BIOS moved from `Active` to `Removed`
- BIOS History route verification is complete:
  - navigating to `/en/super-admin/bios-history` redirects to `/en/super-admin/bios-conflicts`

Confirmed issues from Sprint 8 to Sprint 12:
- Users page structure has drifted from the older plan:
  - role summary cards replace the older dedicated role-filter flow
  - `Last Seen` was not present in the tested table
- Admin Management checkbox clicks can bubble into row navigation; clicking the temp account checkbox opened `/en/super-admin/users/88`
- BIOS History is not currently implemented as a separate page; the route redirects into BIOS Conflicts

QA Data Touched:
- Temporary admin created and deleted:
  - user `88`
  - `QA SA Admin Updated 20260315`
  - `qa.sa.admin.20260315@obd2sw.local`
  - role `Manager`
  - tenant `OBD2SW Main`
- Temporary BIOS blacklist entry created and removed:
  - `SA-BLACKLIST-20260315`
  - reason `super-admin sprint11 test`

Still pending after Sprint 8 to Sprint 12:
- cross-tenant reseller-side proof for a newly added super-admin global blacklist entry was not rerun in this block
- BIOS Blacklist CSV import execution was not exercised; control presence only was verified

### 2026-03-15 - Sprint 13 to Sprint 17 completion

Completed in this pass:
- Closed the previously untested BIOS Blacklist gaps:
  - CSV import execution
  - live cross-tenant blacklist proof
- Sprint 13: BIOS details search, deep-link load, recent BIOS list, and tab coverage
- Sprint 14: BIOS conflicts list, detail modal, and resolve flow
- Sprint 15: security-locks page structure and tab coverage
- Sprint 16: cross-tenant reports load, range preset update, export control behavior
- Sprint 17: logs load, endpoint search, log detail modal

Confirmed working:
- BIOS Blacklist CSV import executes from the UI
- Fresh global blacklist proof is now complete:
  - `SA-IMPORT-20260315` was blacklisted globally
  - reseller in tenant `OBD2SW Main` received `This BIOS ID is blacklisted.`
  - reseller in tenant `E2E Tenant 1773515764060` also received `This BIOS ID is blacklisted.`
- BIOS Details deep-link works:
  - `/en/super-admin/bios-details?bios=EEEE` auto-loads the selected BIOS
- BIOS Details tabs load in the tested state:
  - `Overview`
  - `License History`
  - `Resellers`
  - `IP Analytics`
  - `Activity Log`
  - `Blacklist Status`
- BIOS Conflicts page loads cross-tenant rows correctly
- Conflict details modal opens with BIOS, tenant, conflict type, program, user, and affected-customer context
- Super-admin can resolve a conflict with notes
  - resolving `SA-IMPORT-20260315` for tenant `OBD2SW Main` succeeded
  - counts updated from `Open 3 / Resolved 0` to `Open 2 / Resolved 1`
- Security Locks page loads and exposes all three tabs:
  - `Locked Accounts`
  - `Blocked IPs`
  - `Audit Log`
- Reports page loads with system-wide stats, charts, tables, date presets, and CSV/PDF controls
- Reports date preset updates the visible date range
  - `Last 30 Days` changed `From` to `2026-02-14`
- Logs page loads with live entries, endpoint search, tenant/method/status-style controls, auto-refresh toggle, and pagination
- Logs endpoint search works; filtering by `/apideluser` reduced the list to `24 total`
- Logs detail modal opens and shows request/response payload snippets

Confirmed issues from Sprint 13 to Sprint 17:
- BIOS Blacklist CSV import does not skip the header row:
  - imported CSV created a bad blacklist row with BIOS `BIOS ID`
  - reason `Reason`
- Super-admin BIOS search still breaks on short queries:
  - entering `EE` triggered repeated server failures from `/api/super-admin/bios/search?query=EE`
  - duplicate error toasts were shown
- BIOS Details `Activity Log` still exposes raw/internal event keys
- Security Locks tabs currently render weak empty states: table headers appear with no rows, but no explicit empty-state guidance is shown
- Logs page is no longer the raw HTTP audit shape described by the old sprint; it is now an external API log console

QA Data Touched:
- BIOS imported via CSV:
  - `SA-IMPORT-20260315`
  - reason `super-admin csv import test`
- Bad CSV header row accidentally imported by the app:
  - BIOS `BIOS ID`
  - reason `Reason`
- Cross-tenant proof fixture:
  - temporarily activated tenant `2` (`E2E Tenant 1773515764060`) to run the reseller-side blacklist proof
  - created a temporary tenant-2 program `OBD2SW Pro E2E` with one preset
  - removed the temporary program/preset afterward
  - restored tenant `2` to `inactive`
- Resolved conflict:
  - BIOS `SA-IMPORT-20260315`
  - tenant `OBD2SW Main`

### 2026-03-15 - Sprint 18 to Sprint 19 completion

Completed in this pass:
- Sprint 18: API Status load, manual ping, metrics refresh, and history-row verification
- Sprint 19: settings tabs review, real server-timezone save, and timezone-label verification

Confirmed working:
- `/en/super-admin/api-status` loads and shows a healthy monitor state
- `Ping now` succeeds and shows `API ping completed successfully.`
- `Response time` updated from `312ms` to `307ms` after a manual ping
- `Last checked` updated and the history table recorded an `Online / 200` row
- `/en/super-admin/settings` loads with the current tabbed settings workspace
- General settings save succeeds and shows `Settings saved successfully.`
- API tab exposes editable `External API URL`, `API key`, `Timeout`, and `Retries`
- Notifications tab exposes the three current notification toggles
- Security tab exposes password-length and session-timeout controls
- Profile tab is embedded inside settings and currently shows the super-admin profile form plus password section

Confirmed issues from Sprint 18 to Sprint 19:
- API Status no longer matches the older cross-tenant board described in the plan; the current monitor shows no visible tenant/program labeling
- Saving `Server Timezone` did not update the navbar timezone label
- The saved `Server Timezone` and the header label are currently inconsistent:
  - General settings selected value: `America/Thule` (restored after test)
  - Header label: `Timezone: Africa/Banjul`

QA Data Touched:
- Server timezone temporarily changed to `Asia/Dubai`, saved successfully, then restored to `America/Thule`

### 2026-03-15 - Sprint 21 to Sprint 24 continuation

Completed in this pass:
- Sprint 21: full cross-tenant E2E verification
- Sprint 22: high-value edge-case pass
- Sprint 23: partial live-data verification
- Sprint 24: Arabic / RTL verification on core super-admin pages

Confirmed working:
- Sprint 21 full tenant reset + restore cycle now works on populated `OBD2SW Main`
  - manager-parent customer count: `14 -> 0 -> 14`
  - reseller customer count: `5 -> 0 -> 5`
  - backup `8` (`pre-reset-s21`) restored successfully
- Sprint 21 role change flow works for user `3` (`reseller1@obd2sw.com`)
  - role changed `reseller -> manager -> reseller`
  - login role changed immediately on the next login each time
  - tenant-scoped customer access remained available during the temporary manager role
- Sprint 21 tenant deactivation flow works for tenant `2`
  - inactive tenant blocked both manager-parent and reseller login with `tenant_inactive`
  - reactivation allowed login again
  - deactivation blocked login again
- Sprint 21 security lock -> unblock flow works
  - repeated failed logins locked `qa.superadmin.parent.20260315@obd2sw.local`
  - lock appeared via super-admin security API
  - `unblock-email` cleared the lock
  - successful login worked immediately afterward
- Sprint 21 global BIOS blacklist flow works end to end
  - BIOS `GLOBAL-BLOCK-S21-20260315` was blocked for reseller activation in both tenant `1` and tenant `2`
  - removing the blacklist entry restored activation in both tenants
- Sprint 21 admin creation -> tenant change -> suspension flow works
  - temp manager-parent `91` was created in tenant `3`
  - login succeeded
  - tenant reassignment to tenant `1` succeeded
  - suspension blocked login with `This account is currently suspended.`
  - temp admin was deleted after verification
- Sprint 21 BIOS conflict resolution propagates cross-role
  - conflict `10` was visible to both super-admin and manager-parent
  - resolving it in super-admin removed it from manager-parent's open-conflicts view
- Sprint 22 empty-tenant reset works
  - tenant `3` reset completed with all-zero backup stats and restored successfully from backup `9`
- Sprint 22 hard refresh on deep URLs works
  - `/en/super-admin/users/3` reloaded correctly
- Sprint 22 mobile layout is usable on the tenants page at `375x812`
  - mobile header collapsed correctly to a hamburger menu
  - tenant table remained reachable/scrollable
- Sprint 24 Arabic / RTL baseline works
  - `/ar/super-admin/security-locks` and `/ar/super-admin/tenants` rendered with `lang=\"ar\"` and `dir=\"rtl\"`

Confirmed issues from Sprint 21 to Sprint 24:
- Populated-tenant reset was broken until the tenant-backup streaming logic was patched to avoid MySQL sort-buffer failures
- Arabic tenants page still leaks broken/raw status labels:
  - `????`
  - `common.inactive`
- Sprint 23 live auto-refresh is still not fully proven in this pass
  - the timed background polling checks were not stable enough to close definitively for `Security Locks`, `Logs`, or `API Status`

Still partial after Sprint 21 to Sprint 24:
- Sprint 22 restore-over-existing-data replacement test
- Sprint 22 explicit offline/network-failure page handling
- Sprint 22 large-dataset performance validation
- Sprint 22 double-submit race test on destructive actions
- Sprint 23 live auto-refresh proof for all three pages

QA Data Touched:
- Backup `8`: `pre-reset-s21`
- Backup `9`: `empty-tenant-s22`
- Temporary tenant-2 fixture program:
  - program `6` (`OBD2SW Pro E2E`)
  - preset `15` (`Month`)
- Global blacklist BIOS used in the flow:
  - `GLOBAL-BLOCK-S21-20260315`
- Created customers from the post-unblacklist activation proof:
  - tenant `1` customer `89`
  - tenant `2` customer `90`
- Resolved conflict:
  - conflict `10`
  - BIOS `GLOBAL-BLOCK-S21-20260315`
  - note `Resolved during super-admin sprint14 validation.`

Still pending after Sprint 13 to Sprint 17:
- Security Locks unblock flows were not exercised because no safe preexisting locked-account or blocked-IP fixture was present, and inducing one from localhost risks blocking the active QA environment
- Security Locks auto-refresh was not proven
- Reports export download completion was not independently verified beyond button execution/loading state
- Logs tenant/method/status combinations were only partially sampled in this block

---

## Definition of Done per Sprint

- [ ] All test cases executed
- [ ] All failures logged in Issue Tracker with severity
- [ ] All 🔴 Critical and 🟠 High issues fixed and re-tested
- [ ] Cross-tenant and cross-role effects verified (Sprint 21)
- [ ] Tenant Reset + Restore fully verified (Sprint 3 + S21-T1)
- [ ] AR + EN both verified for i18n sprint
- [ ] Screenshots captured for all visual/behavioral issues

---

*Last updated: 2026-03-15 | Super-admin dashboard QA — 24 sprints, 150+ test cases*
*Includes 7 end-to-end cross-tenant/cross-role flows in Sprint 21*
*Special focus: Tenant Reset/Backup/Restore (Sprint 3, S3-T9 to S3-T15 + S21-T1)*

