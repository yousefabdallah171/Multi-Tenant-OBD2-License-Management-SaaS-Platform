# PHASE 08: Testing — Full TODO List

**Updated for Phase 11 SaaS Role Refactor**
**Target:** 320+ Jest · 55 Cypress · 110+ PHPUnit · Lighthouse 95+

> All frontend tests live in `tests-frontend/` — **delete before production build**.
> Customer portal (`customer/`) tests are **removed** — portal deleted in Phase 11.
> Forgot-password tests are **removed** — feature deleted in Phase 11.

---

## T-0: Test Infrastructure Setup

- [ ] Verify Jest config: `tests-frontend/jest.config.ts` — React Testing Library + JSDOM
- [ ] Verify Cypress config: `tests-frontend/cypress.config.ts` — baseUrl `http://localhost:3000`
- [ ] Create/update `tests-frontend/tests/utils/test-utils.tsx`:
  ```tsx
  // Custom render with providers: Router, QueryClient, I18n (en), Theme
  export function renderWithProviders(ui: ReactElement, options?: RenderOptions) { ... }
  // RTL variant: renders with lang=ar
  export function renderRTL(ui: ReactElement) { ... }
  ```
- [ ] Create mock data in `tests-frontend/tests/mocks/`:
  - `users.ts` — super_admin, manager_parent, manager, reseller users (NO customer)
  - `programs.ts` — programs with `has_external_api: true`, `external_software_id: 8`
  - `licenses.ts` — active/expired/suspended, `duration_days` as float (0.021, 0.5, 7, 30)
  - `security.ts` — locked accounts, blocked IPs, audit log entries
  - `external-api.ts` — mock responses ("True", "False", Python dict, timeout)
- [ ] Create MSW handlers: `tests-frontend/tests/mocks/handlers.ts`
  - Mock all `/api/*` endpoints used by the app
  - Mock external API calls (intercepted at service level, not real HTTP)
- [ ] Verify `tests-frontend/setupTests.ts` imports MSW server setup

---

## T-1: Auth Component Tests

### T-1.1 Login Page (12 tests)

**File:** `tests-frontend/tests/unit/auth/Login.test.tsx`

- [ ] Renders email and password fields
- [ ] Renders "Sign In" button
- [ ] **NO "Forgot Password?" link** — assert it does not exist in DOM
- [ ] **NO "Register" / "Create Account" link** — assert it does not exist
- [ ] Submitting empty form shows validation errors on both fields
- [ ] Invalid email format shows email validation error
- [ ] Shows loading spinner on submit button while request is pending
- [ ] Submit button disabled during request
- [ ] Failed login (401) shows error alert with API message
- [ ] Successful login stores token + redirects to correct dashboard by role
- [ ] Already logged-in user redirected away from login page
- [ ] Language switcher in top-right is rendered and clickable

### T-1.2 LockoutBanner Component (10 tests)

**File:** `tests-frontend/tests/unit/auth/LockoutBanner.test.tsx`

- [ ] Does not render when `secondsRemaining` is null (not locked)
- [ ] Renders countdown message when `secondsRemaining > 0`
- [ ] Countdown displays as `MM:SS` format — e.g., `1:00` for 60 seconds
- [ ] Countdown decrements every second via `setInterval`
- [ ] Calls `onExpired()` callback when countdown reaches 0
- [ ] After `onExpired()` fires, banner hides and form re-enables
- [ ] When `reason === 'ip_blocked'` + `unlocks_at === null` → shows permanent block banner
- [ ] Permanent block banner shows `"support@obd2sw.com"` as a `mailto:` link
- [ ] Permanent block banner does NOT show countdown timer
- [ ] RTL: banner renders correctly in Arabic (text right-aligned)

### T-1.3 Login Page — Lockout Integration (6 tests)

**File:** `tests-frontend/tests/unit/auth/Login.test.tsx` (add to existing)

- [ ] When API returns `429` with `locked: true` + `seconds_remaining: 60` → `LockoutBanner` shown
- [ ] When API returns `429` with `locked: true` + `seconds_remaining: 300` → shows "5:00" countdown
- [ ] When API returns `429` with `reason: 'ip_blocked'` → permanent block banner shown
- [ ] Login form fields are disabled/hidden while lockout banner is shown
- [ ] After lockout expires (countdown hits 0) → form re-enables, banner hides
- [ ] Error message clears when user starts typing in either field

---

## T-2: Layout Component Tests

### T-2.1 Navbar (8 tests)

**File:** `tests-frontend/tests/unit/components/layout/Navbar.test.tsx`

- [ ] Renders logo / brand name
- [ ] Shows "Security Locks" nav item for `super_admin` role (11th page)
- [ ] Does NOT show super_admin nav items for `reseller` role
- [ ] Language switcher switches URL between `/ar/` and `/en/`
- [ ] Theme toggle switches between dark/light — persists to localStorage
- [ ] Profile dropdown shows logged-in user name + role
- [ ] Logout button calls logout service and redirects to `/login`
- [ ] On mobile: hamburger button toggles sidebar visibility

### T-2.2 Sidebar (9 tests)

**File:** `tests-frontend/tests/unit/components/layout/Sidebar.test.tsx`

- [ ] Renders correct nav items for `super_admin` — 11 items including "Security Locks"
- [ ] Renders correct nav items for `manager_parent` — 18 items including "Program Logs"
- [ ] Renders correct nav items for `manager` — 9 items
- [ ] Renders correct nav items for `reseller` — 5 items including "Software"
- [ ] Does NOT render customer portal items for any role
- [ ] Active route is highlighted (checked via `aria-current="page"`)
- [ ] Collapses to icon-only mode when toggle clicked
- [ ] Renders on RIGHT side when `dir="rtl"` (Arabic)
- [ ] Mobile: renders as overlay with backdrop, backdrop click closes it

### T-2.3 DashboardLayout (5 tests)

**File:** `tests-frontend/tests/unit/components/layout/DashboardLayout.test.tsx`

- [ ] Renders Navbar + Sidebar + page children
- [ ] Content area has vertical scrolling
- [ ] Passes correct role to Sidebar
- [ ] Mobile: content takes full width (no sidebar space reserved)
- [ ] Footer renders copyright text

---

## T-3: Shared Component Tests

### T-3.1 StatsCard (5 tests)

- [ ] Renders title, value, and icon
- [ ] Positive trend shows green upward arrow + percentage
- [ ] Negative trend shows red downward arrow + percentage
- [ ] No trend arrow when `trend` prop is undefined
- [ ] Applies custom `color` class variant

### T-3.2 DataTable (10 tests)

- [ ] Renders column headers from `columns` prop
- [ ] Renders data rows from `data` prop
- [ ] Shows skeleton rows when `isLoading={true}`
- [ ] Shows `EmptyState` component when `data` is empty array
- [ ] Shows pagination controls (prev/next/page numbers)
- [ ] Next page button calls `onPageChange`
- [ ] Column header click triggers `onSort` with column key + direction
- [ ] Search input triggers `onSearch` callback on change
- [ ] Row action buttons render per row
- [ ] Page size selector calls `onPageSizeChange`

### T-3.3 StatusBadge (6 tests)

- [ ] Renders green badge for `"active"`
- [ ] Renders red badge for `"expired"`
- [ ] Renders amber badge for `"suspended"`
- [ ] Renders gray badge for `"inactive"`
- [ ] Renders blue badge for `"pending"`
- [ ] Renders correct Arabic label when `lang="ar"`

### T-3.4 EmptyState (3 tests)

- [ ] Renders icon and message text
- [ ] Shows action button when `action` prop provided
- [ ] Calls `action.onClick` when action button clicked

### T-3.5 ErrorBoundary (4 tests)

- [ ] Renders children normally when no error thrown
- [ ] Shows fallback UI when child component throws an error
- [ ] "Try Again" button re-mounts children (error cleared)
- [ ] Error details logged to console.error

### T-3.6 ConfirmDialog (3 tests)

- [ ] Opens when trigger element clicked
- [ ] Calls `onConfirm()` when confirm button clicked
- [ ] Closes without calling `onConfirm()` when cancel button clicked

### T-3.7 ExportButtons (4 tests)

- [ ] Renders CSV and PDF export buttons
- [ ] Calls `onExportCsv()` when CSV button clicked
- [ ] Calls `onExportPdf()` when PDF button clicked
- [ ] Shows loading spinner on clicked button during export

### T-3.8 DurationPicker Component (8 tests)

**File:** `tests-frontend/tests/unit/components/auth/DurationPicker.test.tsx`

- [ ] Renders with "Duration" mode and "End Date" mode tabs
- [ ] "Duration" mode: unit selector (Minutes / Hours / Days) rendered
- [ ] "Duration" mode: quick select buttons present (30 min, 1 hr, 6 hr, 1 day, 7 days, 30 days)
- [ ] Clicking "30 min" quick button sets `duration_days = 0.021`
- [ ] Clicking "7 days" quick button sets `duration_days = 7`
- [ ] "End Date" mode: calendar date picker rendered
- [ ] Selecting an end date converts to `duration_days` as float correctly
- [ ] `onChange(durationDays)` called with float value on every change

### T-3.9 ActivateLicenseModal (9 tests)

**File:** `tests-frontend/tests/unit/components/auth/ActivateLicenseModal.test.tsx`

- [ ] Modal opens when trigger button clicked
- [ ] Renders BIOS ID input field
- [ ] Renders program selector dropdown
- [ ] Renders DurationPicker (not plain number input)
- [ ] Renders price input that auto-updates as duration changes
- [ ] `30 min` duration → price = `(0.021 × base_price)` rounded to 2 decimals
- [ ] Form validation: BIOS ID required, program required, duration required
- [ ] Submit calls `activateLicense()` mutation with float `duration_days`
- [ ] Shows success toast + closes modal on success

---

## T-4: Chart Component Tests

### T-4.1 LineChartWidget (3 tests)

- [ ] Renders SVG chart element when `data` provided
- [ ] Shows loading skeleton when `isLoading={true}`
- [ ] Shows empty state when `data` is empty array

### T-4.2 BarChartWidget (3 tests)

- [ ] Renders bars for each data point
- [ ] Supports horizontal orientation prop
- [ ] Shows loading skeleton when `isLoading={true}`

### T-4.3 PieChartWidget (3 tests)

- [ ] Renders pie/donut slices
- [ ] Renders legend labels alongside slices
- [ ] Shows loading skeleton when `isLoading={true}`

### T-4.4 AreaChartWidget (3 tests)

- [ ] Renders area with gradient fill
- [ ] Shows loading skeleton when `isLoading={true}`
- [ ] Shows empty state when `data` is empty

---

## T-5: Super Admin Page Tests

### T-5.1 Dashboard (4 tests)

- [ ] Renders 5+ stats cards (tenants, users, licenses, revenue, programs)
- [ ] Revenue chart renders
- [ ] Tenant comparison chart renders
- [ ] Recent activity feed renders

### T-5.2 SecurityLocks Page — 11th Page (12 tests)

**File:** `tests-frontend/tests/unit/super-admin/SecurityLocks.test.tsx`

- [ ] Page renders with 3 tabs: "Locked Accounts", "Blocked IPs", "Audit Log"
- [ ] "Locked Accounts" tab: table with columns Email / Locked Since / Unlocks At / Attempts / Action
- [ ] "Locked Accounts" tab: "Unblock" button renders per row
- [ ] "Unblock" button calls `POST /api/super-admin/security/unblock-email` with email
- [ ] After unblock success: toast shown + row removed from table
- [ ] "Blocked IPs" tab: table with columns IP / Country (flag) / City / Device / Blocked Since / Action
- [ ] "Blocked IPs" tab: emoji flag rendered from `country_code`
- [ ] "Blocked IPs" tab: Device column shows parsed user agent string
- [ ] "Blocked IPs" tab: "Unblock IP" calls `POST /api/super-admin/security/unblock-ip`
- [ ] "Audit Log" tab: table with Timestamp / Admin / Action / Target / Admin IP columns
- [ ] Empty state shown in each tab when no entries
- [ ] Data auto-refreshes every 30 seconds (`refetchInterval`)

### T-5.3 BiosBlacklist (4 tests)

- [ ] Renders blacklist table with BIOS ID + status columns
- [ ] "Add to Blacklist" button opens modal
- [ ] Remove from blacklist shows ConfirmDialog
- [ ] Search by BIOS ID filters table

### T-5.4 BiosHistory (3 tests)

- [ ] Search input returns timeline for entered BIOS ID
- [ ] Shows data across all tenants (global view — super admin)
- [ ] Filter by action type (activate / deactivate / block) works

### T-5.5 FinancialReports (4 tests)

- [ ] Revenue charts render with date range
- [ ] Reseller balances table renders
- [ ] Export CSV calls correct service method
- [ ] Export PDF calls correct service method

### T-5.6 Reports (4 tests)

- [ ] All charts (line, bar, pie) render
- [ ] Date range picker changes query params
- [ ] Export CSV works
- [ ] Export PDF works

### T-5.7 ApiStatus (4 tests)

**Updated: Shows real external server status**

- [ ] Page shows `http://EXTERNAL_API_HOST` as the monitored endpoint URL
- [ ] Shows Online/Offline/Degraded badge from real API response
- [ ] Shows response time in milliseconds
- [ ] "Ping Now" button calls the API and refreshes status

---

## T-6: Manager Parent Page Tests

### T-6.1 Dashboard (3 tests)

- [ ] Renders stats cards + charts
- [ ] Shows tenant-scoped data only (not cross-tenant)
- [ ] Recent activity feed renders

### T-6.2 SoftwareManagement — Full Page Form (6 tests)

**Updated: Add/Edit is now a full page, not a modal**

- [ ] Program list page renders program cards with stats
- [ ] Clicking "Add Program" navigates to `/software-management/create` (NOT open a modal)
- [ ] Program create page: External API Key input has password show/hide toggle
- [ ] Program create page: shows URL hint text below API Key: `/apiuseradd/[KEY]/username/bios`
- [ ] Program edit page: API Key field is empty on load (never shows existing value)
- [ ] Program edit page: shows green "API Configured ✓" badge when `has_external_api === true`

### T-6.3 ProgramLogs Page (8 tests)

**File:** `tests-frontend/tests/unit/manager-parent/ProgramLogs.test.tsx`

- [ ] Page renders program selector dropdown
- [ ] After selecting a program, fetches logs from `/api/manager-parent/programs/{id}/logs`
- [ ] Activation Events tab: table with BIOS ID / Username / Activated By / Timestamp columns
- [ ] "Activated By" column shows reseller name + "via Dashboard" badge for dashboard activations
- [ ] "Activated By" shows "External (unknown)" in gray for unknown activations
- [ ] BIOS ID column: shows BIOS on top, username in gray subtext below
- [ ] Shows loading skeleton while fetching
- [ ] Shows empty state if no log entries

### T-6.4 CustomerDetail Page (8 tests)

**File:** `tests-frontend/tests/unit/manager-parent/CustomerDetail.test.tsx`

- [ ] Page renders when navigating to `/:lang/customers/{id}`
- [ ] User Info card: name, email, phone, username, status badge
- [ ] Active Licenses table: program / BIOS ID / reseller / dates / status / Deactivate action
- [ ] "Resellers" section: lists all resellers who activated for this customer
- [ ] Login IP History section: IP / flag / country / city / timestamp per row
- [ ] Activity Log section: recent activity_log entries
- [ ] Clicking "Deactivate" on a license shows ConfirmDialog
- [ ] Back link returns to Customers list

### T-6.5 IpAnalytics Page — External Logs (4 tests)

**Updated: Shows external activation server IPs, not internal Laravel logs**

- [ ] Program selector dropdown renders
- [ ] After selecting a program, fetches data from external logs (NOT `/api/request-logs`)
- [ ] Table shows real login IPs (not `127.0.0.1 GET api/programs`)
- [ ] Country column shows emoji flag from ISO country code

### T-6.6 BiosBlacklist (3 tests)

- [ ] Tenant-scoped BIOS blacklist table renders
- [ ] Add to blacklist form works
- [ ] Remove from blacklist works

### T-6.7 BiosHistory (2 tests)

- [ ] Timeline for searched BIOS ID renders (tenant-scoped)
- [ ] Filter by action type works

### T-6.8 FinancialReports (3 tests)

- [ ] Revenue charts render (tenant-scoped)
- [ ] Reseller balance breakdown table renders
- [ ] Export works

### T-6.9 Reports (3 tests)

- [ ] Charts render with date range filter
- [ ] Tenant-scoped data only
- [ ] Export CSV and PDF work

---

## T-7: Manager Page Tests

### T-7.1 Dashboard (2 tests)

- [ ] Manager dashboard renders team stats
- [ ] Shows resellers under this manager only

### T-7.2 Team (2 tests)

- [ ] Reseller list table renders
- [ ] Suspend reseller changes status badge

### T-7.3 Software (1 test)

- [ ] Renders program cards (read-only — no add/edit/delete buttons)

### T-7.4 Reports (2 tests)

- [ ] Charts render for manager's team scope
- [ ] Export buttons work

### T-7.5 UsernameManagement (3 tests)

- [ ] Table with username lock status renders
- [ ] "Unlock" action shows ConfirmDialog
- [ ] "Change Username" opens modal

---

## T-8: Reseller Page Tests

### T-8.1 Dashboard (2 tests)

- [ ] Stats cards render (customers, licenses, revenue, expiring)
- [ ] Charts render

### T-8.2 Customers (5 tests)

- [ ] Customer table renders
- [ ] "Add Customer" button opens activation wizard
- [ ] Activation wizard Step 1: customer info (name, email) validates
- [ ] Activation wizard Step 2: BIOS ID + program selector validates
- [ ] Activation wizard Step 3: DurationPicker + price → submits correctly

### T-8.3 Licenses (4 tests)

- [ ] License table renders with BIOS ID + username subtext
- [ ] Status filter (Active / Expired / Suspended) works
- [ ] "Renew" action opens RenewModal
- [ ] "Deactivate" action shows ConfirmDialog

### T-8.4 Software Page — 5th Page (8 tests)

**File:** `tests-frontend/tests/unit/reseller/Software.test.tsx` (NEW)

- [ ] Page renders program cards (with name, status, active licenses count)
- [ ] "ACTIVATE" button renders on each program card
- [ ] Clicking "ACTIVATE" opens `ActivateLicenseModal`
- [ ] Modal shows BIOS ID field + DurationPicker + price input
- [ ] Submit calls `POST /api/reseller/licenses` with float `duration_days`
- [ ] On success: toast shown + modal closes
- [ ] On external API failure (BIOS rejected): shows error from API response
- [ ] On duplicate BIOS (422): shows "An active license already exists" error

### T-8.5 Reports (2 tests)

- [ ] Revenue charts render for this reseller
- [ ] Export buttons work

---

## T-9: Hook Tests

### T-9.1 useAuth (5 tests)

- [ ] Returns `user` object when authenticated (token in localStorage)
- [ ] `login()` stores token in localStorage and updates user state
- [ ] `logout()` removes token from localStorage and redirects to `/login`
- [ ] `isAuthenticated` returns `true` when token exists
- [ ] Redirects to `/login` when API returns 401 (token expired)

### T-9.2 useTheme (4 tests)

- [ ] Returns current theme (`dark` or `light`)
- [ ] `toggle()` switches theme
- [ ] Theme persists to localStorage across renders
- [ ] Reads system preference (`prefers-color-scheme`) on first load

### T-9.3 useRoleGuard (3 tests)

- [ ] Returns `allowed: true` when user role matches required role
- [ ] Redirects to own dashboard when role doesn't match
- [ ] Shows loading state while auth check is in progress

### T-9.4 useLicenses (3 tests)

- [ ] Fetches licenses list via React Query
- [ ] Creates license via mutation (float `duration_days`)
- [ ] Filter by status sends correct query param

---

## T-10: Service Tests

### T-10.1 auth.service (4 tests)

**File:** `tests-frontend/tests/unit/services/auth.service.test.ts`

- [ ] `login()` calls `POST /api/auth/login` with email + password
- [ ] `logout()` calls `POST /api/auth/logout`
- [ ] `getMe()` calls `GET /api/auth/me`
- [ ] **NO `forgotPassword()` method** — assert it does not exist on the service

### T-10.2 license.service (6 tests)

**File:** `tests-frontend/tests/unit/services/license.service.test.ts`

- [ ] `activate()` sends `duration_days` as float (not integer)
- [ ] `activate()` calls `POST /api/reseller/licenses`
- [ ] `renew()` calls `POST /api/reseller/licenses/{id}/renew`
- [ ] `deactivate()` calls `POST /api/reseller/licenses/{id}/deactivate`
- [ ] `getAll()` calls `GET /api/reseller/licenses` with status/search params
- [ ] `getExpiring()` calls `GET /api/reseller/licenses/expiring?days={n}`

### T-10.3 security.service (4 tests)

**File:** `tests-frontend/tests/unit/services/security.service.test.ts` (NEW)

- [ ] `getLocks()` calls `GET /api/super-admin/security/locks`
- [ ] `unblockEmail(email)` calls `POST /api/super-admin/security/unblock-email` with `{email}`
- [ ] `unblockIp(ip)` calls `POST /api/super-admin/security/unblock-ip` with `{ip}`
- [ ] `getAuditLog()` calls `GET /api/super-admin/security/audit-log`

### T-10.4 api (Axios instance) (3 tests)

- [ ] Attaches `Authorization: Bearer {token}` header to all requests
- [ ] On `401` response: removes token from localStorage + redirects to `/login`
- [ ] On network error (no response): shows user-facing error toast

### T-10.5 report.service (3 tests)

- [ ] `getResellerReport(params)` calls correct endpoint with date range
- [ ] `exportCsv(params)` triggers file download
- [ ] `exportPdf(params)` triggers file download

---

## T-11: Utility Tests

### T-11.1 Formatters (4 tests)

- [ ] `formatDate('2026-03-01T12:00:00Z')` → `"Mar 1, 2026"` (en)
- [ ] `formatDate('2026-03-01T12:00:00Z')` → Arabic date format (ar)
- [ ] `formatCurrency(1234.5)` → `"$1,234.50"`
- [ ] `formatDuration(0.021)` → `"30 minutes"` (converts float days to readable string)

### T-11.2 Validators (3 tests)

- [ ] `validateEmail('bad@')` returns error string
- [ ] `validateBiosId('')` returns required error
- [ ] `validateBiosId('BIOS-001')` returns null (valid)

### T-11.3 GeoIP Utilities (5 tests)

**File:** `tests-frontend/tests/unit/utils/geoip.test.ts` (NEW)

- [ ] `getFlag('EG')` returns `"🇪🇬"`
- [ ] `getFlag('SA')` returns `"🇸🇦"`
- [ ] `getFlag(null)` returns `"🏳️"` (unknown)
- [ ] `parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0...Safari/...')` → `"iPhone Safari"`
- [ ] `parseUserAgent('Mozilla/5.0 (Windows NT 10.0...) Chrome/...')` → `"Windows Chrome"`

---

## T-12: Backend PHPUnit Feature Tests

### T-12.1 Auth — Login Security (12 tests)

**File:** `backend/tests/Feature/Auth/LoginSecurityTest.php`

- [ ] Correct credentials → `200` with token
- [ ] Wrong password 1st attempt → `401 {"message":"Invalid credentials."}` (no lockout)
- [ ] Wrong password 4th attempt → `401` with `X-RateLimit-Remaining: 1`
- [ ] Wrong password 5th attempt → `429` with `locked: true`, `seconds_remaining: 60`
- [ ] Wrong password 6th attempt (within lockout) → `429` (already locked)
- [ ] After 1-minute lockout expires → `401` (can try again)
- [ ] Cumulative: attempt 6 after lockout → `429` with `seconds_remaining: 300` (5 min)
- [ ] Attempt 10 → `429` with `reason: 'ip_blocked'`, `unlocks_at: null`
- [ ] `X-RateLimit-Limit: 10` in all login response headers
- [ ] `Retry-After` header present on `429` response
- [ ] Successful login after lockout expires → `200` + `clearAttempts()` resets counter
- [ ] **Silent Deny**: customer account login → `401 {"message":"Invalid credentials."}` (same as wrong password)

### T-12.2 Auth — Forgot Password Route (1 test)

**File:** `backend/tests/Feature/Auth/LoginTest.php`

- [ ] `POST /api/auth/forgot-password` → `404` (route does not exist)

### T-12.3 Super Admin — SecurityController (6 tests)

**File:** `backend/tests/Feature/SuperAdmin/SecurityControllerTest.php`

- [ ] `GET /api/super-admin/security/locks` → `200` with `locked_accounts` + `blocked_ips` arrays
- [ ] `POST /api/super-admin/security/unblock-email` → `200` + email unblocked in cache
- [ ] `POST /api/super-admin/security/unblock-ip` → `200` + IP removed from cache
- [ ] `GET /api/super-admin/security/audit-log` → `200` paginated activity log
- [ ] Non-super-admin calling security endpoints → `403`
- [ ] Unblocking an email that isn't locked → `200` (idempotent)

### T-12.4 ManagerParent — ProgramController with API Keys (6 tests)

**File:** `backend/tests/Feature/ManagerParent/ProgramControllerTest.php`

- [ ] Create program with `external_api_key` → encrypted in DB, `has_external_api: true`
- [ ] Read program → response does NOT include `external_api_key` (never exposed)
- [ ] Read program → response includes `has_external_api: true`, `external_software_id: 8`
- [ ] Update program with new `external_api_key` → re-encrypted in DB
- [ ] Update program without `external_api_key` → existing key unchanged
- [ ] Delete program → `200`, program removed

### T-12.5 Manager — SoftwareController (4 tests)

**File:** `backend/tests/Feature/Manager/SoftwareControllerTest.php`

- [ ] Create software — manager tenant-scoped, includes external key handling
- [ ] Update software — tenant authorization check works
- [ ] Delete software — tenant authorization check works
- [ ] Activate software for customer — BiosActivationService called with program API key

### T-12.6 Reseller — LicenseController (8 tests)

**File:** `backend/tests/Feature/Reseller/LicenseControllerTest.php`

- [ ] `POST activate` with `duration_days: 0.021` (30 min) → `expires_at` is ~30 minutes from now
- [ ] `POST activate` with `duration_days: 0.5` (12 hr) → `expires_at` is ~12 hours from now
- [ ] `POST activate` with `duration_days: 7` → `expires_at` is 7 days from now
- [ ] `POST activate` with blacklisted BIOS → `422` with "This BIOS ID is blacklisted"
- [ ] `POST activate` with duplicate active BIOS+program → `422` "active license already exists"
- [ ] `POST activate` — program has no external API key → `422` "not configured for external activation"
- [ ] `GET /reseller/licenses` → list includes `external_username` field
- [ ] `POST deactivate` → license status changes to `"suspended"`

### T-12.7 ExternalApiService (6 tests)

**File:** `backend/tests/Feature/External/ExternalApiServiceTest.php`

- [ ] `activateUser($key, $user, $bios)` makes `GET` to `http://EXTERNAL_API_HOST/apiuseradd/{key}/{user}/{bios}`
- [ ] External returns `"True"` → `['success' => true]`
- [ ] External returns `"False"` → `['success' => false]`
- [ ] External returns timeout → `['success' => false, 'error' => 'Connection timeout']`
- [ ] `deactivateUser($key, $user)` makes `GET` to `/apideluser/{key}/{user}`
- [ ] `getProgramLogs($softwareId)` makes `GET` to `/apilogs/{softwareId}`

### T-12.8 GeoIpService (4 tests)

**File:** `backend/tests/Feature/External/GeoIpServiceTest.php`

- [ ] `lookup('197.55.1.2')` calls `http://ip-api.com/json/197.55.1.2?fields=countryCode,country,city,isp`
- [ ] Returns `['country_code' => 'EG', 'country_name' => 'Egypt', 'city' => 'Damanhour', 'isp' => 'TE Data']`
- [ ] Result is cached for 24 hours (same IP second call uses cache, no HTTP)
- [ ] On network failure → returns `['country_code' => null, 'country_name' => 'Unknown', ...]`

---

## T-13: Backend PHPUnit Unit Tests

### T-13.1 LoginSecurityService Unit Tests (10 tests)

**File:** `backend/tests/Unit/LoginSecurityServiceTest.php`

- [ ] `getLockoutDuration(5)` returns `60` (1 minute)
- [ ] `getLockoutDuration(6)` returns `300` (5 minutes)
- [ ] `getLockoutDuration(7)` returns `3600` (1 hour)
- [ ] `getLockoutDuration(8)` returns `36000` (10 hours)
- [ ] `getLockoutDuration(9)` returns `86400` (24 hours)
- [ ] `getLockoutDuration(10)` returns `PHP_INT_MAX` (permanent)
- [ ] `isLocked($email, $ip)` returns `['locked' => false]` when no cache key
- [ ] `isLocked($email, $ip)` returns `['locked' => true, 'seconds_remaining' => int]` when locked
- [ ] `isLocked($email, $ip)` returns `['locked' => true, 'reason' => 'ip_blocked']` when IP blocked
- [ ] `clearAttempts($email, $ip)` removes all cache keys for email + IP

### T-13.2 Program Model — Encrypted API Key (4 tests)

**File:** `backend/tests/Unit/ProgramModelTest.php`

- [ ] `setExternalApiKeyAttribute('L9H2F7Q8XK6M4A')` stores encrypted value in DB (not plain text)
- [ ] `getDecryptedApiKey()` returns original plain text key after encrypt → store → decrypt
- [ ] `getDecryptedApiKey()` returns `null` when `external_api_key_encrypted` is null
- [ ] `serializeProgram()` never includes `external_api_key` or `external_api_key_encrypted` in output

### T-13.3 LicenseService — Float Duration (4 tests)

**File:** `backend/tests/Unit/LicenseServiceTest.php`

- [ ] `duration_days = 0.021` → `expires_at = now()->addMinutes(30)` (±1 min tolerance)
- [ ] `duration_days = 0.5` → `expires_at = now()->addMinutes(720)` (12 hours)
- [ ] `duration_days = 1` → `expires_at = now()->addMinutes(1440)` (1 day)
- [ ] `duration_days = 30` → `expires_at = now()->addMinutes(43200)` (30 days)

---

## T-14: Cypress E2E Tests

### T-14.1 Setup

- [ ] Create/update `tests-frontend/cypress/support/commands.ts`:
  ```typescript
  Cypress.Commands.add('login', (role: 'super_admin' | 'manager_parent' | 'manager' | 'reseller') => {
    // POST /api/auth/login with test credentials per role
    // Store token in localStorage
  })
  Cypress.Commands.add('mockExternalApi', (response: 'success' | 'failure' | 'timeout') => {
    // Intercept external API calls via cy.intercept on the backend proxy
  })
  ```
- [ ] Create fixtures:
  - `tests-frontend/cypress/fixtures/users.json` (4 roles — no customer)
  - `tests-frontend/cypress/fixtures/programs.json` (with `has_external_api: true`)
  - `tests-frontend/cypress/fixtures/licenses.json` (active/expired/suspended, float duration_days)
  - `tests-frontend/cypress/fixtures/security-locks.json` (locked accounts + blocked IPs)
  - `tests-frontend/cypress/fixtures/external-api.json` (mock API responses)

### T-14.2 Auth — Basic Login (4 tests)

**File:** `tests-frontend/cypress/e2e/auth/login.cy.ts`

- [ ] 1: Super Admin login → redirected to `/en/super-admin/dashboard`
- [ ] 2: Manager Parent login → redirected to `/en/dashboard`
- [ ] 3: Manager login → redirected to `/en/manager/dashboard`
- [ ] 4: Reseller login → redirected to `/en/reseller/dashboard`

### T-14.3 Auth — Invalid + Lockout (5 tests)

**File:** `tests-frontend/cypress/e2e/auth/login-lockout.cy.ts`

- [ ] 5: Wrong password → error message shown, form stays visible
- [ ] 6: 5 wrong passwords in row → LockoutBanner appears with countdown `"1:00"`
- [ ] 7: While locked, try again → same `429` response, banner still shows
- [ ] 8: After lockout timer expires → banner hides, form re-enables
- [ ] 9: `/ar/forgot-password` → 404 page shown (route does not exist)

### T-14.4 Role Boundaries & Silent Deny (4 tests)

**File:** `tests-frontend/cypress/e2e/auth/role-redirect.cy.ts`

- [ ] 10: Reseller visiting `/en/super-admin/dashboard` → redirected to reseller dashboard
- [ ] 11: Unauthenticated user visiting any protected route → redirected to `/en/login`
- [ ] 12: Customer credentials login → `401 {"message":"Invalid credentials."}` (Silent Deny)
- [ ] 13: Manager visiting `/en/reseller/licenses` → 403 or redirect

### T-14.5 Super Admin — SecurityLocks Page (4 tests)

**File:** `tests-frontend/cypress/e2e/super-admin/security-locks.cy.ts`

- [ ] 14: Super Admin visits `/en/security-locks` → page renders with 3 tabs
- [ ] 15: "Locked Accounts" tab shows mocked locked account with countdown
- [ ] 16: Clicking "Unblock" on an account → success toast + row disappears
- [ ] 17: "Blocked IPs" tab shows mocked IP with 🇪🇬 flag + "Egypt / Damanhour"

### T-14.6 License Activation — External API Mock (6 tests)

**File:** `tests-frontend/cypress/e2e/reseller/activation.cy.ts`

- [ ] 18: Reseller opens Software page → program cards visible with "ACTIVATE" button
- [ ] 19: Click "ACTIVATE" → ActivateLicenseModal opens
- [ ] 20: Fill BIOS ID + select program + select `30 min` duration → price auto-updates
- [ ] 21: Submit with mocked external API returning "True" → success toast + modal closes
- [ ] 22: Submit with mocked external API returning "False" → error message shown in modal
- [ ] 23: Submit with duplicate BIOS (422) → error "An active license already exists"

### T-14.7 License Management (4 tests)

**File:** `tests-frontend/cypress/e2e/reseller/licenses.cy.ts`

- [ ] 24: Licenses table renders with BIOS ID + username subtext on each row
- [ ] 25: Renew license → duration picker shown in renew modal
- [ ] 26: Deactivate license → ConfirmDialog → license status changes to "Suspended"
- [ ] 27: Filter by "Active" status → only active licenses shown

### T-14.8 Software Management — Full Page (3 tests)

**File:** `tests-frontend/cypress/e2e/manager-parent/software.cy.ts`

- [ ] 28: Click "Add Program" → navigates to `/software-management/create` (NOT a modal)
- [ ] 29: API Key field on edit page → empty on load, shows "API Configured ✓" badge
- [ ] 30: API Key helper text shows `/apiuseradd/[KEY]/username/bios` hint

### T-14.9 Program Logs Page (3 tests)

**File:** `tests-frontend/cypress/e2e/manager-parent/program-logs.cy.ts`

- [ ] 31: Manager Parent visits Program Logs → program selector rendered
- [ ] 32: Select a program → activation events table loads with "Activated By" column
- [ ] 33: "Activated By" shows reseller name for dashboard-activated licenses

### T-14.10 Team Management (3 tests)

- [ ] 34: Manager Parent invites new Manager → success + appears in team table
- [ ] 35: Manager Parent invites new Reseller → success + appears in team table
- [ ] 36: Suspend team member → status badge changes to "Suspended"

### T-14.11 UI/UX — RTL + Responsive (5 tests)

- [ ] 37: Visiting `/ar/login` → RTL layout applied, logo + form right-to-left
- [ ] 38: Visiting `/en/login` → LTR layout applied
- [ ] 39: Visiting `/ar/super-admin/dashboard` → Sidebar on RIGHT side of screen
- [ ] 40: Dark mode toggle: click → background changes to dark theme
- [ ] 41: Mobile viewport: hamburger button opens sidebar overlay

### T-14.12 IP Analytics — External Logs (2 tests)

- [ ] 42: IP Analytics page → select program → table shows real IPs (NOT `127.0.0.1`)
- [ ] 43: Country column shows emoji flag (🇪🇬 for Egypt)

### T-14.13 API Status — Real External Server (2 tests)

- [ ] 44: API Status page → shows `http://EXTERNAL_API_HOST` as monitored URL
- [ ] 45: "Ping Now" button triggers API check + updates status badge

### T-14.14 Customer Detail Page (3 tests)

- [ ] 46: Click customer username in any table → navigates to `/customers/{id}`
- [ ] 47: CustomerDetail page shows licenses table + reseller attribution
- [ ] 48: Login IP History section shows IPs with country flags

### T-14.15 Cross-Browser Manual Checks (3 tests — mark complete after manual run)

- [ ] 49: Chrome — complete login + activation flow
- [ ] 50: Firefox — complete login + activation flow
- [ ] 51: Edge — complete login + activation flow

---

## T-15: Performance Optimization

- [ ] Add `React.lazy()` for ALL page components (all roles)
- [ ] Add `<Suspense>` boundaries with loading fallback (`<PageLoader />`)
- [ ] Verify Vite code splitting in build: `npm run build -- --report`
- [ ] Main bundle < 250KB gzipped
- [ ] Image lazy loading for program icons
- [ ] Run Lighthouse: `npx lighthouse http://localhost:3000 --output html --output-path ./lighthouse-report.html`
- [ ] Fix any Lighthouse A11y issues (ARIA labels, contrast ratios, focus rings)
- [ ] Verify no console errors on any page in any role
- [ ] Verify `npx tsc --noEmit` → zero TypeScript errors
- [ ] Verify `npm run build` passes clean

---

## T-16: Security Headers Verification

- [ ] Set `Content-Security-Policy` header on all API responses
- [ ] Set `X-Frame-Options: DENY` on API responses
- [ ] `X-Content-Type-Options: nosniff` on all responses
- [ ] `Referrer-Policy: no-referrer` on all responses
- [ ] Login endpoint: confirm `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` present
- [ ] Test at `https://securityheaders.io` (when deployed) — target: A or A+

---

## Run All Tests

```bash
# Jest — run from tests-frontend/
cd tests-frontend
npm run test:unit -- --coverage --watchAll=false
# Expected: 320+ tests, 0 failures, coverage > 80%

# Cypress — run from tests-frontend/
cd tests-frontend
npm run test:e2e
# Expected: 51 scenarios, 0 failures

# PHPUnit Feature tests
cd backend && php artisan test --testsuite=Feature
# Expected: 80+ tests, 0 failures

# PHPUnit Unit tests
cd backend && php artisan test --testsuite=Unit
# Expected: 30+ tests, 0 failures

# Lighthouse
npx lighthouse http://localhost:3000/en/login --output html --output-path ./lighthouse-report.html
```

---

## T-17: Final Verification Checklist

```
Jest:       320+ tests   · 0 failures · coverage > 80%
Cypress:    51 scenarios · 0 failures
PHPUnit:    110+ tests   · 0 failures
Lighthouse: Performance 95+ · Accessibility 90+
Console:    0 errors · 0 warnings (any page, any role)
TypeScript: npx tsc --noEmit → 0 errors
Build:      npm run build → passes clean
```

**Specific security checks:**
- [ ] Login 5× wrong → `429` with countdown banner
- [ ] Login 10× wrong → IP blocked + permanent banner + `support@obd2sw.com`
- [ ] Customer login → `401 {"message":"Invalid credentials."}` (Silent Deny confirmed)
- [ ] `/ar/forgot-password` → 404
- [ ] Super Admin SecurityLocks page → shows locked accounts + blocked IPs + audit log
- [ ] Unblock from SecurityLocks → immediately works

**Phase 08 complete → Proceed to PHASE-09-Deployment.**
