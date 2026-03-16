# Manager-Parent Dashboard — Full Testing Plan (Playwright MCP)

> **Role under test:** `manager_parent` (highest non-super-admin role)
> **Base URL:** `http://localhost:3000`
> **Login route:** `/en/login`
> **Manager-Parent base route:** `/en/dashboard` (no role prefix in URL)
> **Test tool:** Playwright MCP (browser automation)
> **Languages:** English (`en`) + Arabic (`ar`)
>
> **Shared components covered here:**
> - `ProgramCatalogPage`, `ActivateLicensePage`, `RenewLicensePage`
> - `CustomerCreatePage`, `ProfileWorkspace`
> - `RoleResellerPaymentsPage`, `RoleResellerPaymentDetailPage`
> - `ProgramPresetEditor`, `DataTable`, `StatusFilterCard`
> - `EditCustomerDialog`, `RenewLicenseDialog`, `ConfirmDialog`
> - `StatusBadge`, `RoleBadge`, `ExportButtons`, `DateRangePicker`
> - `BarChartWidget`, `LineChartWidget`, `PieChartWidget`
> - `IpLocationCell`
>
> **Cross-role interactions tested here (unique to this plan):**
> - Settings changes → affect manager + reseller dashboards
> - BIOS blacklist → blocks reseller activations
> - BIOS change requests: reseller submits → manager-parent approves/rejects
> - Programs created here → visible to manager + reseller catalogs
> - Team member (manager) created here → can log in as manager role
> - Commission rates set here → affect reseller payment calculations

---

## Pre-Test Setup Checklist

- [ ] Laragon (MySQL + PHP) running; backend on port `8000`
- [ ] Vite dev server running on port `3000`
- [ ] Test manager-parent account with known credentials
- [ ] At least 2 managers under this manager-parent
- [ ] Each manager has at least 1–2 resellers
- [ ] At least 5 customers across the hierarchy (mix of statuses)
- [ ] At least 1 active program with presets
- [ ] At least 1 BIOS change request pending
- [ ] At least 1 BIOS conflict record
- [ ] At least 1 reseller payment record
- [ ] External API key configured on 1 program (for API Status test)
- [ ] Playwright MCP connected and browser open

---

## Execution Status

- Scope completed so far: `Sprints 1-25`
- Role/session used: `manager_parent` via `manager@obd2sw.com`
- Environment observed: the seeded manager-parent demo account in this environment is `manager@obd2sw.com`, not `parent@obd2sw.com`
- Temporary QA data created:
  - Customer `70`: `QA Parent Customer 20260315` / `qa_mp_20260315_1` / `BIOS-MP-20260315-1` (`Pending`)
  - Customer `72`: `QA Parent Activate 20260315` / `qa_mp_act_20260315` / `BIOS-MP-ACT-20260315` (`Active`)
  - Customer `73`: `qa_parent_scheduled_20260315` / `qa_mp_sched_20260315` / `BIOS-MP-SCHED-20260315` (`Scheduled`)
  - Customer `74`: `QA Parent CustomerOnly 20260315` / `qa_mp_cust_20260315` / `BIOS-MP-CUST-20260315` (`Pending`)
- BIOS change requests created during Sprint 15:
  - Request `12`: `BIOS-S6-20260315001820` -> `PARENT-BIOS-REQ-20260315` (`Approved`)
  - Request `13`: `EEEE` -> `PARENT-BIOS-REJECT-20260315` (`Rejected`)
- Existing QA data touched:
  - Customer `61` renamed from `QA Sprint6 Customer 20260315001820` to `QA Parent Sprint4 Edited 20260315`
  - Customer `61` BIOS changed from `BIOS-S6-20260315001820` to `PARENT-BIOS-REQ-20260315` after Sprint 15 approval coverage
  - Customer `72` was renewed once during Sprint 11 coverage; expiry moved to `Mar 17, 2026, 1:49 AM`
  - Temporary manager `71` was created, edited, suspended, reactivated, login-verified, and deleted during Sprint 5 coverage
  - Temporary program `4` was created, edited to `Inactive`, manager-visibility checked, and deleted during Sprint 8 coverage

### Confirmed Sprint 1-4 Summary

- Sprint 1: login, language switch, dark mode, logout, and route protection all work.
- Sprint 2: dashboard loads with working stats, charts, quick actions, and top performers.
- Sprint 3: customer table, search, status cards, create flow, edit dialog, and detail navigation work.
- Sprint 4: customer detail page, grouped history, BIOS deep links, and back navigation work.

### Confirmed Sprint 5-9 Summary

- Sprint 5: team page loads, manager creation works, password visibility toggle works, edit works, status changes apply immediately, deactivated manager login is blocked, reactivation restores login, delete works, and manager-detail navigation works.
- Sprint 6: team member detail loads, detail edit works, back navigation works, and scope activity/history render for an existing manager.
- Sprint 7: software catalog loads, base price is visible, search works, and activate navigation routes correctly.
- Sprint 8: software management loads, `Add Program` routes directly to the full form, full-form create/edit/delete work, preset add works, inactive status hides the temp program from the manager catalog, and external API host validation is enforced.
- Sprint 9: activate-license validation is guarded by a disabled submit state, immediate activation works, scheduled custom-date activation works, and cancel/back returns to software management.

### Confirmed Sprint 10-15 Summary

- Sprint 10: customer-create route loads and saves successfully, but the current page is still the shared create-or-activate form rather than a clean customer-only form.
- Sprint 11: renew route works for the tested parent-manager-created license, and the expiry updated correctly after submit.
- Sprint 12: BIOS blacklist table, add flow, search, status filters, remove flow, and reseller-side blacklist enforcement all work.
- Sprint 13: the dedicated BIOS history experience is no longer reachable in the current parent-manager UI; the route is not present in navigation, and the frontend router redirects `/bios-history` to `/bios-conflicts`.
- Sprint 14: BIOS details page loads recent BIOS chips, route-based deep linking works, and the `Overview`, `Licenses`, and `Resellers` tabs render data for a selected BIOS.
- Sprint 15: BIOS change requests load by pending status, reject-cancel works, rejection with notes works, approval works, and new reseller requests can be reviewed end to end.

### Confirmed Sprint 16-17 Summary

- Sprint 16: BIOS conflicts page loads real conflict data, conflict-type filtering works, the conflict detail dialog opens correctly, and the UI explains the conflict origin through type, reseller, program, affected-customer, and BIOS detail fields.
- Sprint 17: IP analytics loads real tenant-scoped rows with country flags, country filtering works, `VPN/Proxy` filtering produces the correct empty state for this tenant, and clicking an IP address currently does not open any customer lookup or drill-down.

### Confirmed Sprint 18-22 Summary

- Sprint 18: reseller payments page loads, period/status filters render, summary cards render, and the seeded zero-commission reseller row is visible for the active period.
- Sprint 19: reseller payment detail loads, reseller identity and summary cards render, and the page shows correct empty states for both `Amounts Owed by Period` and `Payment History` when the reseller has no commission periods or prior payments yet.
- Sprint 20: reports page loads with charts, range presets work, export controls render, and clicking `Total Activations` deep-links into reseller logs with both `action=license.activated` and the active date range pre-applied.
- Sprint 21: panel activity loads, action and user filters render, preset date ranges work, `Clear` resets the active date range, CSV export downloads successfully, and pagination advances correctly.
- Sprint 22: reseller logs page loads, action cards and seller/action/date filters render, report deep-link parameters are honored, and clicking the sidebar `Reseller Logs` entry resets active filters back to the base route.

### Confirmed Sprint 23-25 Summary

- Sprint 23: the `User Logs` page at `/en/program-logs` loads, program/user/action filters render, the `User Actions` tab shows real records, action filtering works, and CSV export downloads successfully.
- Sprint 24: API Status loads for the externally configured program, reports `Online` status with response time and last-checked metadata, and `Ping now` completes successfully.
- Sprint 25: Settings page loads and real settings changes persist across reload for company name, default pricing, notification preferences, and primary accent color. The current page does not expose a `trial_days` control by product design, so the older trial-length scenarios in the written sprint are no longer applicable to the live UI.

### Partial / Deferred From This Pass

- Sprint 3 pagination stress test was not meaningful with the current dataset size and filter state.
- Sprint 3 renew, deactivate, and delete actions were not executed in this first parent-manager block.
- Sprint 4 live auto-refresh and historical BIOS/IP depth were not fully stressed in this pass.
- Sprint 8 preset delete persistence was not fully exercised after create because the temporary program was cleaned up once create/edit/delete coverage was complete.
- Sprint 9 duration-mode scheduling and past-date validation were not fully exercised in this pass.
- Sprint 13 timeline/date-range/reseller filtering could not be exercised in the earlier pass because the parent-manager BIOS history route was then redirecting to `/bios-conflicts`; the standalone history route has since been restored locally.
- Sprint 14 `IP Analytics`, `Panel Activity`, and `Blacklist Status` tabs were not deeply stressed because the sprint target was satisfied by `Overview`, `Licenses`, `Resellers`, and route deep-link coverage.
- Sprint 15 live auto-refresh of the change-requests list was not proven; newly submitted requests required leaving and re-entering the page to appear in the current session.
- Sprint 14 `?bios=` query-string deep-linking was not cleanly re-proven in this pass because hard direct navigation in the active browser session bounced to login; in-app BIOS detail navigation remained functional.
- Sprint 16 resolved/unresolved status filtering could not be exercised because the current page exposes no status filter, and the seeded conflict dataset contains only one open conflict.
- Sprint 17 true proxy/hosting positive-row coverage could not be exercised because the current tenant dataset returned only safe/low-reputation rows during this pass.
- Sprint 19 record-payment, edit-payment, and commission-override mutation coverage remains blocked by fixture state, not by a page failure. The validated reseller currently has `0%` commission with no commission periods and no payment history rows yet.
- Sprint 23 external-login feed coverage is fixture-limited in the current environment. The `External Login Events` tab rendered a valid empty state for the selected program, so row-level IP-location validation was not possible in this pass.
- Sprint 24 programs without an external API key could not be exercised from the live page because only the externally configured program was available in the selector during this pass.
- Sprint 25 cross-role `trial_days` propagation is not executable from the current Settings UI because trial-day management is no longer exposed there by product design.

---

## Sprint 1 — Authentication & Layout

### S1-T1: Login as Manager-Parent
- [ ] Navigate to `http://localhost:3000/en/login`
- [ ] Enter manager-parent credentials
- [ ] Verify redirect to `/en/dashboard`
- [ ] Verify navbar shows name and "Manager Parent" role badge
- [ ] **Fix:** Wrong redirect → check `AuthController` role routing for `manager_parent`

### S1-T2: Sidebar Links — All Present
- [ ] Verify sidebar contains ALL of: Dashboard, Customers, Team Management, Software, Software Management, BIOS Blacklist, BIOS History, BIOS Details, BIOS Change Requests, BIOS Conflicts, IP Analytics, Reseller Payments, Financial Reports, Activity, Reseller Logs, Program Logs, API Status, Settings, Profile
- [ ] Click each link → verify URL and page title change correctly
- [ ] Verify active link highlighted
- [ ] **Fix:** Missing items → check manager-parent layout/nav config

### S1-T3: Language Switch EN → AR
- [ ] Click AR → URL: `/ar/dashboard`, layout RTL, all text Arabic
- [ ] Switch back to EN → LTR restored
- [ ] Verify every sidebar label translates (no raw keys visible)
- [ ] **Fix:** RTL broken → check `dir="rtl"` and `isRtl` in `useLanguage`

### S1-T4: Dark Mode
- [ ] Toggle dark → all pages readable in dark
- [ ] Charts, tables, badges, dialogs all dark-styled
- [ ] Toggle back to light
- [ ] **Fix:** Dark mode issues → check Tailwind `dark:` classes

### S1-T5: Logout
- [ ] Logout → redirect to `/en/login`
- [ ] Access `/en/dashboard` directly → redirected to login
- [ ] **Fix:** Protected routes not blocking → check `ProtectedRoute`

### S1-T6: Cross-Role Isolation
- [ ] While logged in as manager-parent, navigate to `/en/manager/dashboard`
- [ ] Navigate to `/en/reseller/dashboard`
- [ ] Navigate to `/en/super-admin/tenants`
- [ ] All should redirect to login or 403
- [ ] **Fix:** Role guard missing → check `ProtectedRoute` allowed roles

---

## Sprint 2 — Dashboard (`/en/dashboard`)

### S2-T1: Stats Cards Load
- [ ] Verify cards: Total Customers, Active Licenses, Total Revenue, Team Size (managers + resellers)
- [ ] Values are numeric, non-zero if data exists
- [ ] Skeleton loaders appear briefly, not permanently
- [ ] **Fix:** Stats missing → check `managerParentService.getDashboard()`

### S2-T2: Team Performance Ranking
- [ ] Verify top performers list shows resellers/managers ranked by activations or revenue
- [ ] Each entry: name, role badge, activation count or revenue
- [ ] **Fix:** Empty ranking → check `stats.topPerformers` or equivalent in dashboard API response

### S2-T3: Revenue Chart
- [ ] Monthly revenue line/bar chart renders with data
- [ ] Month labels localized (EN: Jan / AR: يناير)
- [ ] Tooltip shows on hover
- [ ] **Fix:** Blank chart → check `activationsChart` / revenue series in `getDashboard()`

### S2-T4: Conflict Rate / Expiry Forecast Charts (unique)
- [ ] Verify additional analytics charts render (conflict rate, license expiry forecast)
- [ ] Data points visible and labeled
- [ ] **Fix:** Charts blank → check dashboard API response fields for these series

### S2-T5: Quick Action Buttons
- [ ] "Team Management" button → navigates to `/en/team-management`
- [ ] "Customer Overview" button → navigates to `/en/customers`
- [ ] **Fix:** Navigation broken → check `onClick` handlers + `routePaths.managerParent.*`

### S2-T6: Dashboard in AR Mode
- [ ] Switch to AR, reload dashboard
- [ ] Verify Arabic month labels in charts
- [ ] Currency formatted with Arabic locale
- [ ] **Fix:** Locale not applied → check `locale = lang === 'ar' ? 'ar-EG' : 'en-US'`

---

## Sprint 3 — Customers (`/en/customers`)

### S3-T1: Customer Table Loads with Manager Filter
- [ ] Verify table: Name, Username/BIOS, Manager, Reseller, Status, Active License, Revenue, Actions
- [ ] Verify filter includes **Manager** dropdown (unique to manager-parent — sees all managers' customers)
- [ ] **Fix:** Manager column/filter missing → check `managerParentService.getCustomers()` response + column def

### S3-T2: Filter by Manager
- [ ] Select a specific manager from filter dropdown
- [ ] Verify only customers under that manager's resellers appear
- [ ] Select "All Managers" → all customers show
- [ ] **Fix:** Manager filter ignored → check `manager_id` in queryKey + API param

### S3-T3: Status Filter Cards
- [ ] All / Active / Scheduled / Expired / Cancelled / Pending — each filters correctly
- [ ] URL updates with `?status=...`
- [ ] **Fix:** Filter not working → check `status` param

### S3-T4: Search Filter
- [ ] Search by customer name → table filters
- [ ] Search by BIOS ID → matching rows appear
- [ ] Clear → all return
- [ ] **Fix:** Search not filtering → check `search` in queryKey

### S3-T5: Sidebar Navigation Resets Filters
- [ ] Apply manager + status + search filters
- [ ] Click "Customers" in sidebar
- [ ] URL clean, all filters reset
- [ ] **Fix:** Stale filters → check `useEffect` on `searchParams.toString() === ''`

### S3-T6: Pagination
- [ ] >10 customers → next page works
- [ ] Change rows per page → more rows load
- [ ] **Fix:** Pagination broken → check `meta.last_page`

### S3-T7: Create / Activate Customer (inline dialog)
- [ ] Click "Add" → activation dialog opens
- [ ] Fill: Customer Name, BIOS ID, Program, Duration
- [ ] Assign to a specific Manager + Reseller (if selectable)
- [ ] Submit → customer in table
- [ ] **Fix:** 422 → check required fields + manager/reseller assignment

### S3-T8: Edit Customer
- [ ] ⋮ → Edit → change name → save → verify update
- [ ] **Fix:** `EditCustomerDialog` not saving → check mutation + cache

### S3-T9: Renew License
- [ ] ⋮ on expired → Renew → set duration → success → status active
- [ ] **Fix:** `RenewLicenseDialog` error → check `licenseService.renew()`

### S3-T10: Deactivate License
- [ ] ⋮ on active → Deactivate → confirm → status cancelled/expired
- [ ] **Fix:** API error → check deactivation endpoint

### S3-T11: Delete Customer
- [ ] ⋮ → Delete → confirm → removed from table
- [ ] **Fix:** Delete failing → check `managerParentService.deleteCustomer()`

### S3-T12: View Customer Detail
- [ ] Click Eye/name → navigates to `/en/customers/:id`
- [ ] **Fix:** Link broken → check `routePaths.managerParent.customerDetail()`

---

## Sprint 4 — Customer Detail (`/en/customers/:id`)

### S4-T1: Customer Info
- [ ] Verify: name, BIOS ID/username, status badge, assigned manager + reseller
- [ ] **Fix:** Missing fields → check `managerParentService.getCustomer(id)` response

### S4-T2: License History Grouped by Reseller
- [ ] Verify license history shows all past licenses, grouped by reseller
- [ ] Each group: reseller name, list of license periods with dates + status
- [ ] **Fix:** History missing → check `getCustomerLicenseHistory()` or equivalent

### S4-T3: BIOS Change History
- [ ] Verify section shows previous BIOS ID changes (old → new, date, approved by)
- [ ] **Fix:** Missing → check `getCustomerBiosChangeHistory()` or detail API response

### S4-T4: IP Location Cell
- [ ] If login IPs exist → verify country flag + name renders via `IpLocationCell`
- [ ] **Fix:** Flag missing → check `IpLocationCell` utility + country data file

### S4-T5: Live Auto-Refresh
- [ ] In another tab, change a license status for this customer
- [ ] Detail page updates without manual refresh
- [ ] **Fix:** Stale → check `liveQueryOptions()` on query

### S4-T6: Back Navigation
- [ ] Click back → returns to `/en/customers`
- [ ] **Fix:** Wrong path → check `routePaths.managerParent.customers(lang)`

---

## Sprint 5 — Team Management (`/en/team-management`)

### S5-T1: Team List Loads (Managers, not just Resellers)
- [ ] Verify table shows **managers** (role=manager) — unique difference from manager role which shows resellers
- [ ] Columns: Name, Username, Email, Phone, Status, Role Badge, Actions
- [ ] **Fix:** Empty or wrong role → check `managerParentService.getTeam()` role filter

### S5-T2: Create Manager
- [ ] Click "Add Manager"
- [ ] Fill: Name, Email, Password, Phone, Username
- [ ] Submit → success toast → new manager in table with Manager role badge
- [ ] **Fix:** 422 → check unique email/username + password requirements

### S5-T3: Password Visibility Toggle
- [ ] Eye icon on password field → toggles visible/hidden
- [ ] **Fix:** Toggle broken → check state in `TeamManagement.tsx`

### S5-T4: Edit Manager
- [ ] ⋮ → Edit → change name/phone → save → table updated
- [ ] **Fix:** Edit not persisting → check mutation + cache invalidation

### S5-T5: Suspend Manager
- [ ] Suspend an active manager → status → `suspended`
- [ ] Verify that suspended manager **cannot log in** (cross-role effect)
  - Open incognito → try to login with suspended manager credentials
  - Verify blocked (401 or error message)
- [ ] **Fix:** Suspension not blocking login → check `ActiveRoleMiddleware` on backend

### S5-T6: Unsuspend Manager
- [ ] Unsuspend → status active → manager can log in again
- [ ] **Fix:** Unsuspend option hidden → check status-conditional menu item

### S5-T7: Delete Manager
- [ ] ⋮ → Delete → confirm → removed
- [ ] Verify manager's resellers are unaffected (not cascading delete)
- [ ] **Fix:** Delete failing → check API + whether resellers become orphaned

### S5-T8: Phone Validation
- [ ] Enter invalid phone → error shown
- [ ] Valid phone (+XXX...) → error clears
- [ ] **Fix:** Validation missing → check `isValidPhoneNumber()` + `normalizePhoneInput()`

### S5-T9: Navigate to Team Member Detail
- [ ] Click manager name or Eye → `/en/team-management/:id`
- [ ] **Fix:** Navigation broken → check route + `Link` href

---

## Sprint 6 — Team Member Detail (`/en/team-management/:id`)

### S6-T1: Manager Info Card
- [ ] Name, username, email, phone, role badge (Manager), status badge
- [ ] **Fix:** Blank → check `managerParentService.getTeamMember(id)`

### S6-T2: Edit Manager Info
- [ ] Click Edit → dialog pre-filled → change name/phone → save
- [ ] Verify header updates
- [ ] **Fix:** Form not pre-filling → check form state init from query data

### S6-T3: Resellers List Under This Manager
- [ ] Verify list of resellers assigned to this manager
- [ ] Each row: reseller name, status, revenue, activation count
- [ ] Click reseller → navigates to reseller payment detail or reseller profile
- [ ] **Fix:** Resellers missing → check `detail.resellers` in API response

### S6-T4: Customer Activity for This Manager's Scope
- [ ] Verify activity/transaction log section loads entries for this manager's resellers
- [ ] Each entry: action label, reseller name, customer, date
- [ ] **Fix:** Activity empty → check `isCustomerLicenseHistoryAction()` filter

### S6-T5: Back Navigation
- [ ] Click back → returns to `/en/team-management` (restores scroll/state if applicable)
- [ ] **Fix:** Back navigates wrong → check `returnTo` from `location.state`

---

## Sprint 7 — Software Catalog (`/en/software`)

### S7-T1: Program List Loads with Base Price Visible
- [ ] Verify programs render with: name, description, version, icon, base price
- [ ] Manager-parent sees base price (unlike resellers who don't)
- [ ] **Fix:** Price hidden or missing → check `showBasePrice` prop passed to `ProgramCatalogPage`

### S7-T2: Activate Button Navigation
- [ ] Click "Activate" on a program → `/en/software-management/:id/activate`
- [ ] Verify program pre-selected on activate form
- [ ] **Fix:** Wrong route → check `routePaths.managerParent.activateLicense()`

### S7-T3: Search Programs
- [ ] Type name → list filters; clear → all show
- [ ] **Fix:** Search not filtering → check `ProgramCatalogPage` filter state

---

## Sprint 8 — Software Management (`/en/software-management`)

### S8-T1: Program Grid/List Loads
- [ ] Verify all programs for this tenant show with: name, version, base price, status badge
- [ ] **Fix:** Empty → check `programService.getAll()` or `managerParentService.getPrograms()`

### S8-T2: Create Program — Quick Dialog
- [ ] Click "Add Program" → dialog with basic fields
- [ ] Fill name, version, base price, description → submit
- [ ] Verify appears in list
- [ ] **Fix:** 422 → check required fields

### S8-T3: Create Program — Full Form (`/en/software-management/create`)
- [ ] Click "Advanced / Full Form" → navigate to create page
- [ ] Verify ALL fields: Name, Description, Version, Download Link, File Size, System Requirements, Installation Guide URL, Base Price, Status, Icon, External API Key, External Software ID, External API Base URL, External Logs Endpoint
- [ ] Fill and submit → redirect to list + program appears
- [ ] **Fix:** Missing fields → check `ProgramForm.tsx` FormState

### S8-T4: Program Preset Editor (unique)
- [ ] In full form, find Presets section
- [ ] Add preset: label, duration value + unit, price
- [ ] Add second preset → verify both show
- [ ] Delete one preset → removed
- [ ] Submit → verify presets persist on edit
- [ ] **Fix:** Presets not saving → check `ProgramPresetEditor` + `mapProgramPresetsToEditable()`

### S8-T5: Edit Program — Full Form (`/en/software-management/:id/edit`)
- [ ] ⋮ → "Edit (Full)" → form pre-filled with existing data
- [ ] Change version + base price → save → list updated
- [ ] **Fix:** Form not pre-filling → check `useQuery` + `useEffect` in `ProgramForm.tsx`

### S8-T6: External API Configuration Fields (unique)
- [ ] In program form, fill: External API Key, External Software ID, External API Base URL, External Logs Endpoint
- [ ] Save → verify data persists
- [ ] Eye/EyeOff toggle on API key field → reveals/hides key
- [ ] **Fix:** Fields not saving → check API payload; toggle broken → check Eye state

### S8-T7: Toggle Program Active/Inactive
- [ ] ⋮ → Deactivate → badge → Inactive
- [ ] ⋮ → Activate → badge → Active
- [ ] **Cross-role effect:** Switch to manager account → verify deactivated program no longer shows in manager's Software Catalog
- [ ] **Fix:** Cross-role not reflecting → check program `status` filter in catalog API

### S8-T8: Delete Program
- [ ] ⋮ → Delete → confirm → removed
- [ ] **Cross-role effect:** Verify deleted program disappears from manager + reseller catalogs
- [ ] **Fix:** Deletion not propagating → check cache invalidation + soft vs hard delete

### S8-T9: Icon Upload/URL
- [ ] Set icon URL for a program → verify icon shows on catalog card
- [ ] **Fix:** Icon not displaying → check `img` src loading + fallback

---

## Sprint 9 — Activate License (`/en/software-management/:id/activate`)

### S9-T1: Form Fields
- [ ] Fields: Customer Name, Client Name, BIOS ID, Program (pre-selected), Duration/End Date, Schedule toggle, Timezone
- [ ] **Fix:** Fields missing → check `ActivateLicensePage` shared component

### S9-T2: Activate with Duration
- [ ] Fill all, 30 days → success toast → customer in `/en/customers`
- [ ] **Fix:** 422 → check required fields + BIOS format

### S9-T3: Activate with End Date
- [ ] Switch to end date mode → pick future date → success
- [ ] **Fix:** Date format error → check ISO vs datetime-local

### S9-T4: Scheduled — Relative
- [ ] Enable schedule → Relative → set 2 hours offset → customer shows `scheduled`
- [ ] **Fix:** Not scheduling → check `schedule_mode: 'relative'` fields

### S9-T5: Scheduled — Custom Date + Timezone
- [ ] Enable schedule → Custom → pick date + timezone → `scheduled`
- [ ] **Fix:** Timezone mismatch → check `formatDateTimeLocalInTimezone()`

### S9-T6: Validation
- [ ] Empty submit → field errors
- [ ] Past end date → error
- [ ] **Fix:** No validation → check Zod schema in `ActivateLicensePage`

### S9-T7: Back Navigation
- [ ] Cancel → back to `/en/software-management`
- [ ] **Fix:** Wrong back path → check `defaultBackPath={routePaths.managerParent.softwareManagement}`

---

## Sprint 10 — Create Customer (`/en/customers/create`)

### S10-T1: Form Loads
- [ ] Fields: Customer Name, Client Name, Email (optional), Phone (optional), BIOS ID
- [ ] **Fix:** Wrong form → check `CustomerCreatePage` shared component

### S10-T2: Valid Create
- [ ] Fill name + BIOS → submit → customer in list
- [ ] **Fix:** API error → check `managerParentService.createCustomer()`

### S10-T3: Duplicate BIOS Error
- [ ] Enter already-used BIOS ID → API error shown
- [ ] **Fix:** Error not displayed → check `resolveApiErrorMessage()` handling

---

## Sprint 11 — Renew License (`/en/customers/licenses/:id/renew`)

### S11-T1: Pre-filled Info
- [ ] Customer name, current status, program shown
- [ ] **Fix:** Blank form → check `RenewLicensePage` data loading

### S11-T2: Renew Success
- [ ] Enter duration → submit → status active
- [ ] Cache for `['manager-parent']` prefix invalidated
- [ ] **Fix:** Cache not updating → check `invalidateQueryKey` + `cachePattern`

---

## Sprint 12 — BIOS Blacklist (`/en/bios-blacklist`) ⭐ Unique

### S12-T1: Blacklist Table Loads
- [ ] Verify columns: BIOS ID, Reason, Date Added, Added By, Actions
- [ ] **Fix:** Empty → check `tenantBiosService.getBlacklist()` API

### S12-T2: Add BIOS to Blacklist
- [ ] Click "Add to Blacklist"
- [ ] Enter BIOS ID + reason → submit
- [ ] Verify appears in table
- [ ] **Fix:** 422 → check required fields

### S12-T3: Remove from Blacklist
- [ ] Click ⋮ → Remove → confirm → row removed
- [ ] **Fix:** Remove failing → check `tenantBiosService.removeFromBlacklist(id)`

### S12-T4: Cross-Role Effect — Blacklisted BIOS Blocks Activation
- [ ] Add a BIOS ID to blacklist (e.g., `BLOCKED-001`)
- [ ] Log in as reseller (separate tab/incognito)
- [ ] Try to activate a license with `BLOCKED-001`
- [ ] Verify activation is **blocked** with clear error message
- [ ] Remove `BLOCKED-001` from blacklist → retry activation → now succeeds
- [ ] **Fix:** Blacklist not enforced → check backend `BiosBlacklist` check in license create/activate controller

### S12-T5: Search/Filter Blacklist
- [ ] Search for a BIOS ID → matching row shows
- [ ] **Fix:** Search not filtering → check filter state and query

---

## Sprint 13 — BIOS History (`/en/bios-history`) ⭐ Unique

### S13-T1: History Table Loads
- [ ] Verify columns: Date, BIOS ID, Action, Reseller, Customer, Details
- [ ] **Fix:** Empty when data exists → check `managerParentService.getBiosHistory()` API

### S13-T2: Filter by BIOS ID
- [ ] Enter a specific BIOS ID → only its events show
- [ ] **Fix:** Filter not working → check `bios_id` param

### S13-T3: Filter by Action Type
- [ ] Select action type (activate / deactivate / blacklist / change_request) → filter applied
- [ ] **Fix:** Action filter ignored → check `action` param

### S13-T4: Filter by Reseller
- [ ] Select a specific reseller → only their BIOS events
- [ ] **Fix:** Reseller filter ignored → check `reseller_id` param

### S13-T5: Filter by Date Range
- [ ] Set From/To dates → events filter to range
- [ ] **Fix:** Date filter ignored → check `range` in queryKey

### S13-T6: Timeline View
- [ ] For a single BIOS ID, verify events show as a chronological timeline
- [ ] **Fix:** Timeline missing → check rendering logic in `BiosHistory.tsx`

---

## Sprint 14 — BIOS Details (`/en/bios-details`)

### S14-T1: Search BIOS ID (min 2 chars)
- [ ] Type 2+ chars → matching BIOS IDs appear
- [ ] Click a result → detail panel loads
- [ ] **Fix:** Search not triggering → check `enabled: search.trim().length >= 2`

### S14-T2: Recent BIOS IDs List
- [ ] On page load → recent 20 BIOS IDs shown
- [ ] Click one → detail loads
- [ ] **Fix:** Empty → check `managerParentBiosDetailsService.getRecentBiosIds(20)`

### S14-T3: Overview Tab
- [ ] Customer name, license status, assigned reseller, activation count
- [ ] **Fix:** Blank → check `getBiosOverview(biosId)`

### S14-T4: Licenses Tab
- [ ] All licenses for this BIOS with dates, program, status badges
- [ ] **Fix:** Empty → check `getBiosLicenses(biosId)`

### S14-T5: Resellers Tab
- [ ] Resellers who handled this BIOS + their transaction counts
- [ ] **Fix:** Empty → check `getBiosResellers(biosId)` (resellers query)

### S14-T6: Deep-link via URL param
- [ ] Navigate to `/en/bios-details?bios=DEMO-BIOS-001`
- [ ] Verify BIOS auto-loaded and detail shown
- [ ] **Fix:** URL param not read → check `searchParams.get('bios')` fallback

---

## Sprint 15 — BIOS Change Requests (`/en/bios-change-requests`)

### S15-T1: Pending Requests Load (default filter)
- [ ] Verify pending requests in table: Date, Reseller, Customer, Old BIOS, New BIOS, Reason, Actions
- [ ] **Fix:** Empty → check `managerParentService.getBiosChangeRequests({ status: 'pending' })`

### S15-T2: Filter by Status
- [ ] Approved / Rejected / All / approved_pending_sync — each filters
- [ ] **Fix:** Filter not working → check `status` in queryKey

### S15-T3: Approve Request
- [ ] Click Approve → success toast → row removed from Pending
- [ ] **Cross-role effect:** The reseller's customer BIOS ID should now be updated
  - Log in as reseller → open that customer → verify new BIOS ID shows
- [ ] **Fix:** BIOS not updated after approval → check backend `approveBiosChangeRequest` logic

### S15-T4: Reject with Notes
- [ ] Click Reject → dialog with notes textarea → type reason → confirm
- [ ] Success toast → row removed from Pending
- [ ] **Cross-role effect:** Reseller sees request marked as Rejected (check reseller customer detail)
- [ ] **Fix:** Dialog not opening → check `rejectTarget` state

### S15-T5: Cancel Reject Dialog
- [ ] Open reject dialog → press Escape or Cancel → closes, no API call
- [ ] **Fix:** Dialog not closing → check `setRejectTarget(null)`

### S15-T6: Full Approval Flow (end-to-end)
- [ ] Log in as reseller → submit a BIOS change request for a customer
- [ ] Log in as manager-parent → verify request appears in pending list
- [ ] Approve it
- [ ] Log back in as reseller → verify customer now has new BIOS ID active
- [ ] **Fix:** Any breakage in this flow is critical — check the full API chain

---

## Sprint 16 — BIOS Conflicts (`/en/bios-conflicts`) ⭐ Unique

### S16-T1: Conflicts Table Loads
- [ ] Verify columns: BIOS ID, Conflict Type, Resellers Involved, Date, Status (resolved/unresolved)
- [ ] **Fix:** Empty when conflicts exist → check `managerParentService.getBiosConflicts()`

### S16-T2: Filter by Conflict Type
- [ ] Select a conflict type from dropdown → table narrows
- [ ] **Fix:** Filter ignored → check `type` param

### S16-T3: Filter by Date Range
- [ ] Set From/To → events in range
- [ ] **Fix:** Date filter ignored

### S16-T4: Filter by Resolved / Unresolved
- [ ] Toggle Resolved → only resolved conflicts
- [ ] Toggle Unresolved → only open conflicts
- [ ] **Fix:** Status filter ignored → check `resolved` boolean param

### S16-T5: View Conflict Details (modal)
- [ ] Click a conflict row → modal/dialog opens with full details
- [ ] Verify: BIOS ID, both resellers, timestamps, conflict description
- [ ] **Fix:** Modal not opening → check click handler + dialog state

### S16-T6: Understanding Conflict Origin
- [ ] Verify UI explains WHY a conflict occurred (e.g., same BIOS activated by 2 resellers)
- [ ] **Fix:** No explanation text → check conflict detail modal content

---

## Sprint 17 — IP Analytics (`/en/ip-analytics`) ⭐ Unique

### S17-T1: IP Log Table Loads
- [ ] Verify columns: IP Address, Country Flag, Country, ISP, Is Proxy, Is Hosting, Login Count, Last Seen
- [ ] `IpLocationCell` renders flag + country name
- [ ] **Fix:** Empty when login data exists → check `managerParentService.getIpAnalytics()`

### S17-T2: Filter by Country
- [ ] Select a country from dropdown → only IPs from that country show
- [ ] **Fix:** Country filter ignored → check `country` param

### S17-T3: Filter by Safe / Proxy / Hosting
- [ ] Select "Proxy IPs only" → only proxy=true rows
- [ ] Select "Hosting IPs only" → only hosting=true rows
- [ ] Select "Safe only" → only proxy=false AND hosting=false
- [ ] **Fix:** Filter not working → check boolean params in API

### S17-T4: Pie Chart — IP Risk Breakdown (unique)
- [ ] Verify `PieChartWidget` renders slices: Safe / Proxy / Hosting / Unknown
- [ ] Legend labels visible and correct
- [ ] **Fix:** Pie chart blank → check `PieChartWidget` data prop format

### S17-T5: High-Risk IP Highlight
- [ ] Verify proxy or hosting IPs are highlighted (red row or badge)
- [ ] **Fix:** No visual distinction → check row conditional styling

### S17-T6: Click IP → Customer Lookup
- [ ] Click an IP address → shows which customer(s) logged in from that IP
- [ ] **Fix:** No drill-down → check click handler or tooltip

---

## Sprint 18 — Reseller Payments (`/en/reseller-payments`)

### S18-T1: Reseller List Loads
- [ ] Columns: Reseller, Manager (unique — shows which manager they belong to), Total Sales, Amount Owed, Paid, Outstanding
- [ ] **Fix:** Manager column missing → check API response + column def in `RoleResellerPaymentsPage`

### S18-T2: Navigate to Detail
- [ ] Click reseller → `/en/reseller-payments/:id`
- [ ] **Fix:** Navigation broken → check `detailPath` prop

### S18-T3: Currency Formatting
- [ ] All amounts formatted `$XXX.XX`; in AR mode `ar-EG` locale
- [ ] **Fix:** Wrong format → check `formatCurrency()`

---

## Sprint 19 — Reseller Payment Detail (`/en/reseller-payments/:id`)

### S19-T1: Page Loads
- [ ] Reseller name, role badge, summary stats (total sales, owed, paid, outstanding)
- [ ] **Fix:** Blank → check `managerParentService.getResellerPaymentDetail(id)`

### S19-T2: Record Payment
- [ ] Click "Record Payment" → fill Amount, Date, Method, Reference, Notes → submit
- [ ] Outstanding balance decreases
- [ ] **Fix:** Payment not recording → check `managerParentService.recordPayment()`

### S19-T3: Edit Payment
- [ ] Click Edit on a payment row → change amount → save → table updated
- [ ] **Fix:** Edit not saving → check `managerParentService.updatePayment()`

### S19-T4: Commission Override per Program
- [ ] Set custom commission % for a specific program
- [ ] Save → verify rate persisted
- [ ] **Cross-role effect:** Log in as that reseller → verify their commission rate on Payment Status page reflects the override
- [ ] **Fix:** Commission not propagating → check `storeCommission()` + reseller payment API

### S19-T5: Payment History Table
- [ ] Columns: Date, Amount, Method, Reference, Notes
- [ ] Dates formatted correctly
- [ ] **Fix:** Raw ISO dates → check `formatDate(row.payment_date, locale)`

---

## Sprint 20 — Financial Reports (`/en/reports`) ⭐ Unique

### S20-T1: Default Load (Last Year)
- [ ] Stats cards: Total Revenue, Active Customers, Active Licenses, Total Activations
- [ ] Monthly revenue line chart renders
- [ ] Retention rate chart renders
- [ ] **Fix:** Blank → check `managerParentService.getFinancialReports(range)` + `getRetention(range)`

### S20-T2: Date Range Presets
- [ ] Last 7 / 30 / 90 / 365 days preset cards → all update charts + stats
- [ ] Selected preset highlighted
- [ ] **Fix:** Preset not triggering refetch → check `range` state in queryKey

### S20-T3: Custom Date Range Picker
- [ ] Pick custom From/To → all charts update
- [ ] To before From → constraint enforced
- [ ] **Fix:** Invalid range allowed → check DateRangePicker min/max

### S20-T4: Revenue Chart — Aggregated Across All Managers (unique)
- [ ] Chart shows total revenue from ALL managers under this manager-parent
- [ ] **Fix:** Only one manager's data → check API is scoped to manager-parent, not single manager

### S20-T5: Manager Breakdown Table (unique)
- [ ] Table of managers with: name, activations count, revenue, commission paid
- [ ] Sortable columns
- [ ] Click manager → navigates to their detail (payment detail or team member detail)
- [ ] **Fix:** Table missing → check `report.manager_breakdown` or `reseller_breakdown` in API

### S20-T6: Retention Chart
- [ ] Line chart shows license renewal rate over time
- [ ] **Fix:** Blank → check `retentionQuery.data?.data`

### S20-T7: Export Buttons
- [ ] CSV export → file downloads with correct data
- [ ] Verify exported data matches on-screen values
- [ ] **Fix:** Export empty → check server export endpoint

### S20-T8: "View Activations" Link
- [ ] Button navigates to `/en/reseller-logs` with correct date range + action filter pre-applied
- [ ] **Fix:** Wrong URL → check `buildQueryUrl()` call

---

## Sprint 21 — Activity Log (`/en/activity`)

### S21-T1: Activity List Loads
- [ ] Entries with: role badge, actor name, action label, date
- [ ] **Fix:** Empty → check `managerParentService.getActivity()` or `activityService`

### S21-T2: Filter by Team Member
- [ ] Dropdown includes ALL team members (managers + resellers) — unique scope vs manager role
- [ ] Select one → only their actions
- [ ] **Fix:** Wrong scope in dropdown → check `getTeam({ per_page: 100 })` includes all roles

### S21-T3: Filter by Action Type
- [ ] Options built dynamically from loaded data
- [ ] Select action → filter applied
- [ ] **Fix:** Options not building → check `actionOptions` useMemo

### S21-T4: Date Range Filter
- [ ] From/To → entries in range
- [ ] "Clear Dates" button → full range restored
- [ ] **Fix:** Clear not working → check `setRange({ from: '', to: '' })`

### S21-T5: Export
- [ ] Click Export → CSV downloads
- [ ] **Fix:** Export failing → check `managerParentService.exportActivity(range)`

### S21-T6: Pagination
- [ ] >12 entries → next page works
- [ ] **Fix:** Pagination stuck → check `meta.last_page`

---

## Sprint 22 — Reseller Logs (`/en/reseller-logs`)

### S22-T1: Table Loads
- [ ] Columns: Date, Reseller, Manager (unique — shows which manager the reseller belongs to), Action, Customer, BIOS ID, Status, Revenue
- [ ] **Fix:** Manager column missing → check column def in `ResellerLogs.tsx`

### S22-T2: Filter by Seller (Reseller)
- [ ] Select reseller from dropdown → only their log entries
- [ ] **Fix:** Filter ignored → check `sellerId` in queryKey

### S22-T3: Filter by Manager (unique — manager-parent sees all managers' resellers)
- [ ] Select a specific manager → only resellers under that manager show in dropdown + table
- [ ] **Fix:** Manager filter missing → check `manager_id` param in API + whether filter UI exists

### S22-T4: Filter by Action
- [ ] license.activated / license.renewed / license.deactivated / license.delete
- [ ] **Fix:** Action filter not working → check `action` param

### S22-T5: Date Range Filter + Sidebar Reset
- [ ] Apply all filters → click "Reseller Logs" in sidebar → all filters reset
- [ ] **Fix:** Stale filters → check `useEffect` on `searchParams.toString() === ''`

### S22-T6: Deep-link from Financial Reports
- [ ] From Reports page, click "View Activations"
- [ ] Verify Reseller Logs loads with `action=license.activated` + date range pre-applied
- [ ] **Fix:** Params not pre-applied → check URL param reading in useState initializers

### S22-T7: Role Badges in Table
- [ ] Verify `RoleBadge` renders correctly for each log entry (reseller vs manager entries)
- [ ] **Fix:** Badge wrong → check `RoleBadge` variant by role value

---

## Sprint 23 — Program Logs (`/en/program-logs`) ⭐ Unique

### S23-T1: Summary Tab Loads
- [ ] Verify summary stats per program: total activations, active, expired, revenue
- [ ] **Fix:** Empty → check `managerParentService.getProgramLogs()` summary API

### S23-T2: Users Tab Loads
- [ ] Switch to "Users" tab → list of all users who activated each program
- [ ] Columns: Customer Name, BIOS ID, IP Location (flag), Activation Date, Status
- [ ] `IpLocationCell` renders correctly
- [ ] **Fix:** Tab blank → check users endpoint in `getProgramLogs()`

### S23-T3: Filter by Program
- [ ] Select a specific program → only its logs show
- [ ] **Fix:** Filter ignored → check `program_id` param

### S23-T4: Filter by Action Type
- [ ] schedule / pause / resume / delete / activate — each narrows correctly
- [ ] **Fix:** Action filter not working → check `action` param

### S23-T5: Export CSV
- [ ] Click Export → CSV downloads with current filter applied
- [ ] **Fix:** Export failing → check export endpoint + filter params forwarded

### S23-T6: Date Range Filter
- [ ] Set From/To → events filter
- [ ] **Fix:** Date filter ignored → check `range` in queryKey

---

## Sprint 24 — API Status (`/en/api-status`) ⭐ Unique

### S24-T1: Program List with API Status
- [ ] Verify each program with `external_api_key` shows a status indicator (Online / Offline / Degraded / Unknown)
- [ ] **Fix:** Status badges missing → check `managerParentService.getApiStatus()`

### S24-T2: Ping / Check Status
- [ ] Click "Check" / "Refresh" on a program → triggers status ping
- [ ] Verify status updates (loading → Online/Offline)
- [ ] **Fix:** Ping not triggering → check API endpoint + mutation

### S24-T3: Programs Without External API Key
- [ ] Programs with no external_api_key should show "Not Configured" or similar
- [ ] **Fix:** Wrong display → check conditional rendering in `ApiStatus.tsx`

### S24-T4: Status Badge Colors
- [ ] Online = green, Offline = red, Degraded = amber, Unknown = grey
- [ ] **Fix:** Wrong colors → check `StatusBadge` or custom badge variant mapping

### S24-T5: Cross-role Effect on Degraded API
- [ ] When a program API shows Degraded/Offline, verify if resellers/customers see any indicator
- [ ] **Fix:** No user-facing indicator → document for future enhancement if not implemented

---

## Sprint 25 — Settings (`/en/settings`) ⭐ Unique

### S25-T1: Settings Page Loads
- [ ] Verify fields: Company Name, Trial Days, Base Price (default), Notification Preferences, Branding options
- [ ] All current values pre-filled
- [ ] **Fix:** Blank form → check `managerParentService.getSettings()` API

### S25-T2: Update Company Name
- [ ] Change company name → save → toast success
- [ ] Refresh page → new name persists
- [ ] **Fix:** Name not saving → check `managerParentService.updateSettings()` + response handling

### S25-T3: Update Trial Days
- [ ] Change trial days (e.g., 7 → 14) → save
- [ ] **Cross-role effect:** Create a new customer from reseller with trial mode → verify new trial length
- [ ] **Fix:** Trial days not applied → check backend `SettingsController` + trial logic

### S25-T4: Update Default Base Price
- [ ] Change default base price → save
- [ ] **Cross-role effect:** Create a new program without specifying price → verify default price applied
- [ ] **Fix:** Default not used → check program creation defaults in backend

### S25-T5: Branding / Theme Settings (if present)
- [ ] Change primary color → save
- [ ] Verify UI accent colors update
- [ ] Change back to original
- [ ] **Fix:** Color not applying → check CSS variable update logic

### S25-T6: Notification Preferences
- [ ] Toggle email notification preferences (e.g., on license expiry, on new activation)
- [ ] Save → verify settings persist
- [ ] **Fix:** Preferences not saving → check settings payload + backend handler

### S25-T7: Settings Affect All Roles (critical cross-role test)
- [ ] Set `trial_days = 3`
- [ ] As reseller: activate with trial mode → verify 3-day trial applied
- [ ] Change `trial_days = 7` → repeat → verify 7-day trial
- [ ] **Fix:** Settings not flowing to activation logic → check `SettingsController` + how `trial_days` is consumed in `LicenseController`

---

## Sprint 26 — Profile (`/en/profile`)

### S26-T1: Profile Info Loads
- [ ] Name, email/username, role, timezone displayed
- [ ] **Fix:** Blank → check `ProfileWorkspace` + profile API

### S26-T2: Edit Name and Phone
- [ ] Edit → change → save → navbar and page update
- [ ] **Fix:** Navbar not updating → check auth context `setAuthenticatedUser()`

### S26-T3: Change Password
- [ ] Old + new + confirm → submit → logout → login with new password
- [ ] **Fix:** Password change failing → check `AuthController::changePassword`

### S26-T4: Timezone Setting
- [ ] Change timezone → save → verify date display changes across all date-showing pages
- [ ] **Fix:** Timezone not persisting → check `useResolvedTimezone()` hook

---

## Sprint 27 — Cross-Role Interaction Tests (End-to-End Flows)

These tests verify that actions taken in manager-parent dashboard correctly affect other roles.

### S27-T1: Program Lifecycle Flow
```
manager-parent creates program
→ manager logs in → program visible in Software Catalog ✓
→ reseller logs in → program visible in Software Catalog ✓
→ manager-parent deactivates program
→ manager: program disappears from catalog ✓
→ reseller: program disappears from catalog ✓
```
- [ ] Execute full flow → verify each step
- [ ] **Fix:** Visibility not syncing → check `status` filter in catalog API

### S27-T2: BIOS Blacklist Enforcement Flow
```
manager-parent adds BIOS "BLOCKED-001" to blacklist
→ reseller tries to activate with "BLOCKED-001"
→ activation is blocked with error "BIOS ID is blacklisted"
→ manager-parent removes "BLOCKED-001" from blacklist
→ reseller retries → activation succeeds
```
- [ ] Execute full flow → verify each step
- [ ] **Fix:** Blacklist not checked → check backend activation controller

### S27-T3: BIOS Change Request Full Cycle
```
reseller submits BIOS change request for customer X (old: A → new: B)
→ manager-parent sees it in pending list ✓
→ manager-parent approves
→ customer X now has BIOS ID: B
→ reseller views customer X → sees BIOS: B ✓
→ manager views customer X → sees BIOS: B ✓
```
- [ ] Execute full flow
- [ ] **Fix:** Any step broken is critical — trace through API chain

### S27-T4: Manager Suspension Flow
```
manager-parent suspends manager M
→ manager M tries to login → blocked (401/error) ✓
→ manager-parent unsuspends M
→ manager M can login ✓
```
- [ ] Execute full flow in separate browser tabs
- [ ] **Fix:** Suspension not enforced → check `ActiveRoleMiddleware`

### S27-T5: Commission Override Flow
```
manager-parent sets reseller R commission = 15% for program P
→ reseller R activates license for program P ($100 sale)
→ manager-parent views R's payment detail → commission shows $15
→ reseller R views Payment Status → commission shows $15
```
- [ ] Execute full flow
- [ ] **Fix:** Commission not calculating → check `ResellerCommission` model + calculation logic

### S27-T6: Settings Trial Days Flow
```
manager-parent sets trial_days = 5
→ reseller creates customer with "trial" mode
→ license expires in exactly 5 days (verify expiry date in customer detail)
→ manager-parent changes trial_days = 10
→ new trial activation expires in 10 days ✓
```
- [ ] Execute full flow
- [ ] **Fix:** Trial days not applied → check `SettingsController` integration

---

## Sprint 28 — Edge Cases & Error Handling

### S28-T1: Network Error Handling
- [ ] Disable network → navigate between pages → friendly error states (not white screen)
- [ ] Re-enable → data reloads
- [ ] **Fix:** White screen → check React Query `isError` states

### S28-T2: Empty State Displays
- [ ] Fresh manager-parent with 0 data:
  - Customers → "No customers yet"
  - Team → "No team members yet"
  - BIOS Blacklist → "No BIOS IDs blacklisted"
  - BIOS Conflicts → "No conflicts found"
  - IP Analytics → "No IP data yet"
- [ ] **Fix:** Blank pages → add `EmptyState` component

### S28-T3: Hard Refresh on Deep URLs
- [ ] F5 on `/en/team-management/5` → page reloads correctly
- [ ] F5 on `/en/customers/12` → correct
- [ ] F5 on `/en/bios-details/DEMO-BIOS-001` → correct
- [ ] **Fix:** 404 on refresh → check Vite/Nginx SPA fallback

### S28-T4: Mobile / Responsive
- [ ] 375px viewport → sidebar collapses, tables scroll, dialogs usable
- [ ] **Fix:** Layout broken → check responsive Tailwind breakpoints

### S28-T5: Double Submit Prevention
- [ ] Double-click any save/submit button → only 1 API call made
- [ ] **Fix:** Multiple submissions → check `isPending` disabling button

### S28-T6: Large Dataset Performance
- [ ] With 100+ customers → table loads without hanging
- [ ] With 100+ log entries → Reseller Logs loads
- [ ] **Fix:** Slow render → check virtual scrolling or pagination defaults

---

## Sprint 29 — Live Data / Auto-Refresh

### S29-T1: Customers Live Update
- [ ] Open Customers in 2 tabs
- [ ] Tab 2: create a customer → Tab 1 auto-updates within interval
- [ ] **Fix:** No update → check `liveQueryOptions(LIVE_QUERY_INTERVAL)` on query

### S29-T2: BIOS Change Requests Live Update
- [ ] Reseller submits request → manager-parent Change Requests page auto-shows new entry
- [ ] **Fix:** No auto-update → add live query interval to BIOS change requests query

---

## Sprint 30 — Internationalization (i18n)

### S30-T1: No Raw Keys in EN
- [ ] Visit every manager-parent page in EN
- [ ] No raw translation keys visible (e.g., `managerParent.pages.biosConflicts.title`)
- [ ] **Fix:** Missing key → add to `frontend/src/locales/en.json`

### S30-T2: No Raw Keys in AR
- [ ] Switch to AR, visit every page
- [ ] All text Arabic, no English bleed-through
- [ ] **Fix:** Missing AR key → add to `frontend/src/locales/ar.json`

### S30-T3: RTL Layout Integrity
- [ ] In AR: table columns mirrored, buttons on correct side, charts readable
- [ ] Settings form fields right-aligned
- [ ] **Fix:** RTL issues → check `me-`/`ms-` vs `mr-`/`ml-` throughout manager-parent pages

### S30-T4: Numbers, Dates, Currency in AR
- [ ] All amounts: `ar-EG` locale
- [ ] All dates: Arabic Gregorian format
- [ ] **Fix:** Wrong locale → check every `formatCurrency(val, 'USD', locale)` and `formatDate(val, locale)` call

---

## Issue Tracker

> Log all issues found during testing here

| # | Sprint | Page | Issue | Severity | Status | Fix Applied |
|---|--------|------|-------|----------|--------|-------------|
| 1 | 1 | Auth | Seed/demo credential drift: `parent@obd2sw.com / password` did not work in this environment; the active manager-parent account is `manager@obd2sw.com / password`. | 🟠 High | Open | |
| 2 | 1 | Sidebar | Sidebar structure no longer matches the written plan. BIOS pages, logs, and profile are nested in collapsible groups; no standalone `BIOS History`; `User Logs` replaces `Program Logs`; `Reports` replaces `Financial Reports`; `Panel Activity` replaces `Activity`. | 🟠 High | Open | |
| 3 | 1 | Route Guard | Cross-role isolation redirects manager-parent users back to `/en/dashboard` instead of login or `403` when visiting manager, reseller, or super-admin routes. | 🟠 High | Open | |
| 4 | 2 | Dashboard | Dashboard card labels differ from plan: current UI shows `Team Members`, `Customers`, `Current Active Customers`, and `Monthly Revenue`. | 🟡 Medium | Open | |
| 5 | 2 | Dashboard | Quick actions differ from plan wording: current buttons are `Team Management`, `Review customers`, and `Open reports`. | 🟡 Medium | Open | |
| 6 | 3 | Customers | Customers page description says `Read-only customer directory`, but the page still exposes mutation actions like add, edit, deactivate, pause, and delete. | 🟡 Medium | Open | |
| 7 | 3 | Customers | Create customer flow is a full page at `/en/customers/create`, not the inline dialog described in the plan. The form also has no visible manager/reseller assignment controls in the tested state. | 🟠 High | Open | |
| 8 | 3 | Customers | Active customer action menu still exposes `Delete`. | 🟡 Medium | Open | |
| 9 | 3 | Customers | After editing a customer while a search filter is active, the list drops to `0` results until the search is cleared because the old search text is preserved. This is functional but creates a misleading empty-state moment. | 🟡 Medium | Open | |
| 10 | 4 | Customer Detail | New-customer `Panel Activity` rendered only the section shell with no visible entries, so activity-state clarity on fresh records is weak. | 🟢 Low | Open | |

| 11 | 5 | Team Management | Default team view is `All`, not managers-only as the sprint expects. Managers are isolated only after switching to the `Managers` tab. | ðŸŸ¡ Medium | Open | |
| 12 | 5 | Team Management | Team invite dialog has no visible username field; username is auto-generated. This differs from the written plan. | ðŸŸ¡ Medium | Open | |
| 13 | 5 | Team Management | Phone validation is weak or absent on create. Entering `abc` did not surface an inline validation error, and the saved row simply omitted the phone value. | ðŸŸ  High | Open | |
| 14 | 5 | Team Management | Status wording uses `Deactive` instead of clearer values like `Suspended`, `Inactive`, or `Deactivate`. The status filter also exposes both `Deactive` and `Inactive`. | ðŸŸ¡ Medium | Open | |
| 15 | 6 | Team Member Detail | Team-member detail no longer matches the planned structure. It shows summary cards, `Recent Licenses`, `Panel Activity`, and `Customer & License History`, but no dedicated reseller list section. | ðŸŸ  High | Open | |
| 16 | 6 | Team Member Detail | Panel Activity still exposes raw/internal action keys like `bios.change_approved`, `license.renewed`, `team.status`, `manager.program.update`, and `team.create`. | ðŸŸ¡ Medium | Open | |
| 17 | 7 | Software Catalog | Software catalog route matches the current shared catalog, but the page title is `Software Catalog` and the eyebrow is `Tenant Operations`, not the older role-specific wording implied by the plan. | ðŸŸ¢ Low | Open | |
| 18 | 8 | Software Management | `Add Program` routes directly to the full create form; no quick-create dialog exists in the current UI. | ðŸŸ  High | Open | |
| 19 | 8 | Program Form | Program form field wiring is brittle under automation. Description/download inputs were easy to mis-route into adjacent fields before direct correction, which suggests weak field targeting or input wiring. | ðŸŸ¡ Medium | Open | |
| 20 | 8 | Program Form | External API base URL must resolve to a public IP. `http://127.0.0.1` was rejected with `External API base URL must resolve to a public IP.` | ðŸŸ¢ Low | Open | |
| 21 | 8 | Program Form | The edit form does not reveal the existing external API key even after toggling the eye control; it only keeps a blank `Leave blank to keep existing key` field. | ðŸŸ¡ Medium | Open | |
| 22 | 9 | Activate License | Activate page no longer matches the sprint wording exactly: no separate customer-name field, no program picker, no default visible timezone, and no initial duration/end-date mode switch until scheduling is enabled. | ðŸŸ  High | Open | |
| 23 | 9 | Activate License | Schedule modes differ from the written plan. The current scheduled flow exposes `Custom Date` and `Duration Mode`, not the older `Relative` wording. | ðŸŸ¡ Medium | Open | |
| 24 | 9 | Activate License | Scheduled activation created a display anomaly in the customers list. The scheduled row rendered `qa_parent_scheduled_20260315qa_mp_sched_20260315` as a concatenated name/username string instead of the provided display name `QA Parent Scheduled 20260315`. | ðŸŸ  High | Open | |

| 25 | 10 | Create Customer | Parent-manager customer creation is still routed through the shared activation workspace rather than a dedicated customer-only form. The page includes program/license controls and only exposes customer-only behavior as a mode within that shared screen. | Ã°Å¸Å¸Â  High | Open | |
| 26 | 11 | Renew License | Renew success feedback is too generic. The tested renew flow completed and extended expiry correctly, but the user-facing toast is only `Saved`. | Ã°Å¸Å¸Â¡ Medium | Open | |
| 27 | 13 | BIOS History | The parent-manager BIOS history route had been removed from the current UI and `/bios-history` redirected to `/bios-conflicts`, blocking the planned history coverage. | Ã°Å¸Å¸Â  High | Fixed locally | |
| 28 | 14 | BIOS Details | BIOS details still renders the raw translation key `biosDetails.description` under the page heading. | Ã°Å¸Å¸Â¡ Medium | Open | |
| 29 | 14 | BIOS Details | BIOS search remained unstable. Entering a 2-character query (`EE`) on the BIOS details page triggered a server-side failure instead of narrowing results. | Ã°Å¸Å¸Â  High | Fixed locally | |
| 30 | 15 | BIOS Change Requests | Change-requests list did not auto-refresh after a reseller submitted a new request in another session. The new row appeared only after leaving and re-entering `/en/bios-change-requests`. | Ã°Å¸Å¸Â¡ Medium | Open | |
| 31 | 15 | BIOS Change Requests | Status handling is split across both `Approved` and `Approved, Sync Pending` states. This is functional, but the tested approval flow produced `Approved` for the new request while an older request remained under `Approved, Sync Pending`, so operators must check two filters to review completed approvals. | Ã°Å¸Å¸Â¢ Low | Open | |

| 32 | 15 | BIOS Change Requests | Rejected BIOS requests are not surfaced clearly on the reseller customer-detail side after rejection. The manager-parent list showed the request as `Rejected`, but reseller customer detail for `EEEE` did not expose a visible rejected-request state in the tested view. | Medium | Open | |
| 33 | 16 | BIOS Conflicts | BIOS Conflicts page does not expose the resolved/unresolved status filter described in the sprint. The live UI only provides conflict-type and date-range controls. | High | Open | |
| 34 | 16 | BIOS Conflicts | Conflict status wording differs from the plan. The table uses `Open` instead of the expected `Resolved` / `Unresolved` vocabulary. | Medium | Open | |
| 35 | 17 | IP Analytics | IP Analytics implementation differs materially from the sprint definition. The live page shows `Username`, `BIOS ID`, `Program`, `External ID`, `IP Address`, `Location`, `ISP`, `VPN/Proxy`, and `Timestamp`, but it does not expose `Is Proxy`, `Is Hosting`, `Login Count`, or `Last Seen` columns. | High | Open | |
| 36 | 17 | IP Analytics | The top chart is `Country Distribution`, not the planned IP risk breakdown pie chart (`Safe / Proxy / Hosting / Unknown`). | High | Open | |
| 37 | 17 | IP Analytics | There is no IP drill-down or customer lookup when clicking an IP address. Clicking `154.183.52.60` left the user on `/en/ip-analytics` with no modal, tooltip, or navigation. | High | Open | |
| 38 | 18 | Reseller Payments | The reseller-payments list does not expose the `Manager` column described in the sprint. The live table shows `Reseller, Sales, Rate, Commission Owed, Amount Paid, Outstanding, Status, Actions` only. | High | Open | |
| 39 | 20 | Reports | The reports table differs materially from the planned manager-breakdown view. The live page renders a `Reseller Balances` table with `Reseller, Total Revenue, Activations, Avg Price, Commission` instead of a manager-oriented breakdown. | High | Open | |
| 40 | 21 | Activity | The panel-activity user filter does not include all visible actors. Activity entries include `Main Manager`, but the filter dropdown only exposed `Mohamed Reseller` and `Ahmed Reseller` in the tested state. | Medium | Open | |
| 41 | 21 | Activity | Panel Activity still exposes raw/internal action keys such as `bios.change_requested`, `bios.change_approved`, `license.renewed`, and `license.scheduled_activation_executed` instead of fully humanized labels. | Medium | Open | |
| 42 | 22 | Reseller Logs | Reseller Logs still lacks the manager-specific scope controls described in the sprint. There is no dedicated `Manager` column and no manager filter in the live UI. | High | Open | |
| 43 | 22 | Reseller Logs | Seller filtering is not scoped correctly. Selecting `Ahmed Reseller (Reseller)` applied `seller_id=3`, but the resulting table still included `Main Manager` and `Mohamed Reseller` rows. | High | Open | |
| 44 | 22 | Reseller Logs | Customer-link navigation is hijacked by the row click handler. Clicking the customer link `eeee` in a filtered reseller-log row navigated to `/en/team-management/3` instead of `/en/customers/42`. | High | Open | |
| 45 | 23 | User Logs | The page no longer matches the planned `Program Logs` shape. The live route is titled `User Logs`, uses `User Actions` / `External Login Events` tabs, and does not expose the sprint's date-range filter controls. | Medium | Open | |
| 46 | 23 | User Logs | The action filter contains a duplicate `Activate` option in the current UI. | Low | Open | |
| 47 | 24 | API Status | API Status is implemented as a single-program detail view, not the multi-program status board described in the sprint. The live page shows one selected program with `Status`, `Response time`, `Last checked`, and `Ping now`, but no list of all programs and no `Not Configured` state coverage. | High | Open | |
| 48 | 25 | Settings | The Settings page does not expose the `trial_days` control described in the sprint. This is now an intentional product-scope change rather than an accidental missing field. | High | Superseded by product scope | |
| 49 | 25 | Settings | The Settings page no longer matches the full planned form. The live UI supports business info, default pricing, notifications, logo, and primary accent color, but does not expose the sprint's explicit trial-days field. | Medium | Open | |

**Severity:**
- 🔴 Critical — feature broken, data lost, or cross-role flow broken
- 🟠 High — feature partially broken, workaround needed
- 🟡 Medium — visual/UX issue, non-blocking
- 🟢 Low — cosmetic or minor

---

## Pages Summary Reference

| Page | Route | Unique to Manager-Parent | Shared Component |
|------|-------|--------------------------|-----------------|
| Dashboard | `/en/dashboard` | Team ranking, forecast charts | — |
| Customers | `/en/customers` | Manager filter column | DataTable, StatusFilterCard |
| Customer Detail | `/en/customers/:id` | BIOS change history tab | — |
| Team Management | `/en/team-management` | Manages **managers** (not resellers) | DataTable |
| Team Member Detail | `/en/team-management/:id` | Resellers list under manager | — |
| Software | `/en/software` | — | ProgramCatalogPage |
| Software Management | `/en/software-management` | External API config | — |
| Program Form | `/en/software-management/create` or `/:id/edit` | Full preset editor | ProgramPresetEditor |
| Activate License | `/en/software-management/:id/activate` | — | ActivateLicensePage |
| Renew License | `/en/customers/licenses/:id/renew` | — | RenewLicensePage |
| Create Customer | `/en/customers/create` | — | CustomerCreatePage |
| BIOS Blacklist | `/en/bios-blacklist` | ✅ Exclusive | — |
| BIOS History | `/en/bios-history` | ✅ Exclusive | — |
| BIOS Details | `/en/bios-details` | Broader scope than manager | — |
| BIOS Change Requests | `/en/bios-change-requests` | ✅ Final approver | — |
| BIOS Conflicts | `/en/bios-conflicts` | ✅ Exclusive | — |
| IP Analytics | `/en/ip-analytics` | ✅ Exclusive (PieChart) | IpLocationCell |
| Reseller Payments | `/en/reseller-payments` | Manager column | RoleResellerPaymentsPage |
| Reseller Payment Detail | `/en/reseller-payments/:id` | — | RoleResellerPaymentDetailPage |
| Financial Reports | `/en/reports` | Cross-manager aggregation | ExportButtons |
| Activity | `/en/activity` | All roles scope | — |
| Reseller Logs | `/en/reseller-logs` | Manager filter column | — |
| Program Logs | `/en/program-logs` | ✅ Exclusive | IpLocationCell |
| API Status | `/en/api-status` | ✅ Exclusive | — |
| Settings | `/en/settings` | ✅ Exclusive (org-wide config) | — |
| Profile | `/en/profile` | — | ProfileWorkspace |

---

## Testing Commands Reference (Playwright MCP)

```javascript
// Navigate
mcp_playwright_navigate({ url: "http://localhost:3000/en/dashboard" })

// Screenshot
mcp_playwright_screenshot({})

// Click
mcp_playwright_click({ selector: "button[type=submit]" })
mcp_playwright_click({ selector: "text=Add Manager" })

// Fill input
mcp_playwright_fill({ selector: "input[name=username]", value: "mp1" })

// Select dropdown
mcp_playwright_select_option({ selector: "select[name=status]", value: "active" })

// Wait for element
mcp_playwright_wait_for_selector({ selector: ".toast-success" })
mcp_playwright_wait_for_selector({ selector: "table tbody tr" })

// Read element text
mcp_playwright_evaluate({ script: "document.querySelector('h1').textContent" })

// Open new tab (for cross-role tests)
mcp_playwright_evaluate({ script: "window.open('http://localhost:3000/en/login', '_blank')" })

// Check console errors
mcp_playwright_console_messages({})

// Mobile viewport
mcp_playwright_evaluate({ script: "window.resizeTo(375, 812)" })
```

---

## Definition of Done per Sprint

- [ ] All test cases executed
- [ ] All failures in Issue Tracker with severity
- [ ] All 🔴 Critical and 🟠 High issues fixed and re-tested
- [ ] Cross-role effects verified (not just isolated page testing)
- [ ] AR + EN both verified for i18n sprints
- [ ] Screenshots for all visual issues

---

*Last updated: 2026-03-15 | Manager-Parent dashboard QA — Sprints 1-9 executed in the live app*
*Includes end-to-end reseller blacklist and BIOS change-request flows validated in Sprints 12 and 15*
*Execution status supersedes the legacy footer text above: this document now reflects live QA through Sprint 25.*
