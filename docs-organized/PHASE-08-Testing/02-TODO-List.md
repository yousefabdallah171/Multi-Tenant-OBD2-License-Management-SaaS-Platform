# PHASE 08: Testing — Full TODO List

**Updated for Phase 11 SaaS Role Refactor**
**Target:** 341 Jest · 55 Cypress · 112 PHPUnit · Lighthouse desktop 95+ (mobile currently ~93)

> All frontend tests live in `tests-frontend/` — **delete before production build**.
> Customer portal (`customer/`) tests are **removed** — portal deleted in Phase 11.
> Forgot-password tests are **removed** — feature deleted in Phase 11.

---

## Execution Status (2026-03-01)

- [x] Full test matrix executed and green: Jest `341/341`, Cypress `55/55`, PHPUnit `112/112`.
- [x] Production gates executed: `npm run build`, `npx tsc --noEmit`, and built-app smoke tests.
- [x] Security headers middleware implemented and covered with backend feature tests.
- [x] Console warning cleanup and bundle/code-splitting pass completed.
- [ ] Mobile Lighthouse performance target `95+` is still pending (current baseline around `~93`).
- [ ] `securityheaders.io` grade check is pending deployment URL verification.

## T-0: Test Infrastructure Setup

- [x] Verify Jest config: `tests-frontend/jest.config.ts` — React Testing Library + JSDOM
- [x] Verify Cypress config: `tests-frontend/cypress.config.ts` — baseUrl `http://localhost:3000`
- [x] Create/update `tests-frontend/tests/utils/test-utils.tsx`:
  ```tsx
  // Custom render with providers: Router, QueryClient, I18n (en), Theme
  export function renderWithProviders(ui: ReactElement, options?: RenderOptions) { ... }
  // RTL variant: renders with lang=ar
  export function renderRTL(ui: ReactElement) { ... }
  ```
- [x] Create mock data in `tests-frontend/tests/mocks/`:
  - `users.ts` — super_admin, manager_parent, manager, reseller users (NO customer)
  - `programs.ts` — programs with `has_external_api: true`, `external_software_id: 8`
  - `licenses.ts` — active/expired/suspended, `duration_days` as float (0.021, 0.5, 7, 30)
  - `security.ts` — locked accounts, blocked IPs, audit log entries
  - `external-api.ts` — mock responses ("True", "False", Python dict, timeout)
- [x] Create MSW handlers: `tests-frontend/tests/mocks/handlers.ts`
  - Mock all `/api/*` endpoints used by the app
  - Mock external API calls (intercepted at service level, not real HTTP)
- [x] Verify `tests-frontend/setupTests.ts` imports MSW server setup

---

## T-1: Auth Component Tests

### T-1.1 Login Page (12 tests)

**File:** `tests-frontend/tests/unit/auth/Login.test.tsx`

- [x] Renders email and password fields
- [x] Renders "Sign In" button
- [x] **NO "Forgot Password?" link** — assert it does not exist in DOM
- [x] **NO "Register" / "Create Account" link** — assert it does not exist
- [x] Submitting empty form shows validation errors on both fields
- [x] Invalid email format shows email validation error
- [x] Shows loading spinner on submit button while request is pending
- [x] Submit button disabled during request
- [x] Failed login (401) shows error alert with API message
- [x] Successful login stores token + redirects to correct dashboard by role
- [x] Already logged-in user redirected away from login page
- [x] Language switcher in top-right is rendered and clickable

### T-1.2 LockoutBanner Component (10 tests)

**File:** `tests-frontend/tests/unit/auth/LockoutBanner.test.tsx`

- [x] Does not render when `secondsRemaining` is null (not locked)
- [x] Renders countdown message when `secondsRemaining > 0`
- [x] Countdown displays as `MM:SS` format — e.g., `1:00` for 60 seconds
- [x] Countdown decrements every second via `setInterval`
- [x] Calls `onExpired()` callback when countdown reaches 0
- [x] After `onExpired()` fires, banner hides and form re-enables
- [x] When `reason === 'ip_blocked'` + `unlocks_at === null` → shows permanent block banner
- [x] Permanent block banner shows `"support@obd2sw.com"` as a `mailto:` link
- [x] Permanent block banner does NOT show countdown timer
- [x] RTL: banner renders correctly in Arabic (text right-aligned)

### T-1.3 Login Page — Lockout Integration (6 tests)

**File:** `tests-frontend/tests/unit/auth/Login.test.tsx` (add to existing)

- [x] When API returns `429` with `locked: true` + `seconds_remaining: 60` → `LockoutBanner` shown
- [x] When API returns `429` with `locked: true` + `seconds_remaining: 300` → shows "5:00" countdown
- [x] When API returns `429` with `reason: 'ip_blocked'` → permanent block banner shown
- [x] Login form fields are disabled/hidden while lockout banner is shown
- [x] After lockout expires (countdown hits 0) → form re-enables, banner hides
- [x] Error message clears when user starts typing in either field

---

## T-2: Layout Component Tests

### T-2.1 Navbar (8 tests)

**File:** `tests-frontend/tests/unit/components/layout/Navbar.test.tsx`

- [x] Renders logo / brand name
- [x] Shows "Security Locks" nav item for `super_admin` role (11th page)
- [x] Does NOT show super_admin nav items for `reseller` role
- [x] Language switcher switches URL between `/ar/` and `/en/`
- [x] Theme toggle switches between dark/light — persists to localStorage
- [x] Profile dropdown shows logged-in user name + role
- [x] Logout button calls logout service and redirects to `/login`
- [x] On mobile: hamburger button toggles sidebar visibility

### T-2.2 Sidebar (9 tests)

**File:** `tests-frontend/tests/unit/components/layout/Sidebar.test.tsx`

- [x] Renders correct nav items for `super_admin` — 11 items including "Security Locks"
- [x] Renders correct nav items for `manager_parent` — 18 items including "Program Logs"
- [x] Renders correct nav items for `manager` — 9 items
- [x] Renders correct nav items for `reseller` — 5 items including "Software"
- [x] Does NOT render customer portal items for any role
- [x] Active route is highlighted (checked via `aria-current="page"`)
- [x] Collapses to icon-only mode when toggle clicked
- [x] Renders on RIGHT side when `dir="rtl"` (Arabic)
- [x] Mobile: renders as overlay with backdrop, backdrop click closes it

### T-2.3 DashboardLayout (5 tests)

**File:** `tests-frontend/tests/unit/components/layout/DashboardLayout.test.tsx`

- [x] Renders Navbar + Sidebar + page children
- [x] Content area has vertical scrolling
- [x] Passes correct role to Sidebar
- [x] Mobile: content takes full width (no sidebar space reserved)
- [x] Footer renders copyright text

---

## T-3: Shared Component Tests

### T-3.1 StatsCard (5 tests)

- [x] Renders title, value, and icon
- [x] Positive trend shows green upward arrow + percentage
- [x] Negative trend shows red downward arrow + percentage
- [x] No trend arrow when `trend` prop is undefined
- [x] Applies custom `color` class variant

### T-3.2 DataTable (10 tests)

- [x] Renders column headers from `columns` prop
- [x] Renders data rows from `data` prop
- [x] Shows skeleton rows when `isLoading={true}`
- [x] Shows `EmptyState` component when `data` is empty array
- [x] Shows pagination controls (prev/next/page numbers)
- [x] Next page button calls `onPageChange`
- [x] Column header click triggers `onSort` with column key + direction
- [x] Search input triggers `onSearch` callback on change
- [x] Row action buttons render per row
- [x] Page size selector calls `onPageSizeChange`

### T-3.3 StatusBadge (6 tests)

- [x] Renders green badge for `"active"`
- [x] Renders red badge for `"expired"`
- [x] Renders amber badge for `"suspended"`
- [x] Renders gray badge for `"inactive"`
- [x] Renders blue badge for `"pending"`
- [x] Renders correct Arabic label when `lang="ar"`

### T-3.4 EmptyState (3 tests)

- [x] Renders icon and message text
- [x] Shows action button when `action` prop provided
- [x] Calls `action.onClick` when action button clicked

### T-3.5 ErrorBoundary (4 tests)

- [x] Renders children normally when no error thrown
- [x] Shows fallback UI when child component throws an error
- [x] "Try Again" button re-mounts children (error cleared)
- [x] Error details logged to console.error

### T-3.6 ConfirmDialog (3 tests)

- [x] Opens when trigger element clicked
- [x] Calls `onConfirm()` when confirm button clicked
- [x] Closes without calling `onConfirm()` when cancel button clicked

### T-3.7 ExportButtons (4 tests)

- [x] Renders CSV and PDF export buttons
- [x] Calls `onExportCsv()` when CSV button clicked
- [x] Calls `onExportPdf()` when PDF button clicked
- [x] Shows loading spinner on clicked button during export

### T-3.8 DurationPicker Component (8 tests)

**File:** `tests-frontend/tests/unit/components/auth/DurationPicker.test.tsx`

- [x] Renders with "Duration" mode and "End Date" mode tabs
- [x] "Duration" mode: unit selector (Minutes / Hours / Days) rendered
- [x] "Duration" mode: quick select buttons present (30 min, 1 hr, 6 hr, 1 day, 7 days, 30 days)
- [x] Clicking "30 min" quick button sets `duration_days = 0.021`
- [x] Clicking "7 days" quick button sets `duration_days = 7`
- [x] "End Date" mode: calendar date picker rendered
- [x] Selecting an end date converts to `duration_days` as float correctly
- [x] `onChange(durationDays)` called with float value on every change

### T-3.9 ActivateLicenseModal (9 tests)

**File:** `tests-frontend/tests/unit/components/auth/ActivateLicenseModal.test.tsx`

- [x] Modal opens when trigger button clicked
- [x] Renders BIOS ID input field
- [x] Renders program selector dropdown
- [x] Renders DurationPicker (not plain number input)
- [x] Renders price input that auto-updates as duration changes
- [x] `30 min` duration → price = `(0.021 × base_price)` rounded to 2 decimals
- [x] Form validation: BIOS ID required, program required, duration required
- [x] Submit calls `activateLicense()` mutation with float `duration_days`
- [x] Shows success toast + closes modal on success

---

## T-4: Chart Component Tests

### T-4.1 LineChartWidget (3 tests)

- [x] Renders SVG chart element when `data` provided
- [x] Shows loading skeleton when `isLoading={true}`
- [x] Shows empty state when `data` is empty array

### T-4.2 BarChartWidget (3 tests)

- [x] Renders bars for each data point
- [x] Supports horizontal orientation prop
- [x] Shows loading skeleton when `isLoading={true}`

### T-4.3 PieChartWidget (3 tests)

- [x] Renders pie/donut slices
- [x] Renders legend labels alongside slices
- [x] Shows loading skeleton when `isLoading={true}`

### T-4.4 AreaChartWidget (3 tests)

- [x] Renders area with gradient fill
- [x] Shows loading skeleton when `isLoading={true}`
- [x] Shows empty state when `data` is empty

---

## T-5: Super Admin Page Tests

### T-5.1 Dashboard (4 tests)

- [x] Renders 5+ stats cards (tenants, users, licenses, revenue, programs)
- [x] Revenue chart renders
- [x] Tenant comparison chart renders
- [x] Recent activity feed renders

### T-5.2 SecurityLocks Page — 11th Page (12 tests)

**File:** `tests-frontend/tests/unit/super-admin/SecurityLocks.test.tsx`

- [x] Page renders with 3 tabs: "Locked Accounts", "Blocked IPs", "Audit Log"
- [x] "Locked Accounts" tab: table with columns Email / Locked Since / Unlocks At / Attempts / Action
- [x] "Locked Accounts" tab: "Unblock" button renders per row
- [x] "Unblock" button calls `POST /api/super-admin/security/unblock-email` with email
- [x] After unblock success: toast shown + row removed from table
- [x] "Blocked IPs" tab: table with columns IP / Country (flag) / City / Device / Blocked Since / Action
- [x] "Blocked IPs" tab: emoji flag rendered from `country_code`
- [x] "Blocked IPs" tab: Device column shows parsed user agent string
- [x] "Blocked IPs" tab: "Unblock IP" calls `POST /api/super-admin/security/unblock-ip`
- [x] "Audit Log" tab: table with Timestamp / Admin / Action / Target / Admin IP columns
- [x] Empty state shown in each tab when no entries
- [x] Data auto-refreshes every 30 seconds (`refetchInterval`)

### T-5.3 BiosBlacklist (4 tests)

- [x] Renders blacklist table with BIOS ID + status columns
- [x] "Add to Blacklist" button opens modal
- [x] Remove from blacklist shows ConfirmDialog
- [x] Search by BIOS ID filters table

### T-5.4 BiosHistory (3 tests)

- [x] Search input returns timeline for entered BIOS ID
- [x] Shows data across all tenants (global view — super admin)
- [x] Filter by action type (activate / deactivate / block) works

### T-5.5 FinancialReports (4 tests)

- [x] Revenue charts render with date range
- [x] Reseller balances table renders
- [x] Export CSV calls correct service method
- [x] Export PDF calls correct service method

### T-5.6 Reports (4 tests)

- [x] All charts (line, bar, pie) render
- [x] Date range picker changes query params
- [x] Export CSV works
- [x] Export PDF works

### T-5.7 ApiStatus (4 tests)

**Updated: Shows real external server status**

- [x] Page shows `http://EXTERNAL_API_HOST` as the monitored endpoint URL
- [x] Shows Online/Offline/Degraded badge from real API response
- [x] Shows response time in milliseconds
- [x] "Ping Now" button calls the API and refreshes status

---

## T-6: Manager Parent Page Tests

### T-6.1 Dashboard (3 tests)

- [x] Renders stats cards + charts
- [x] Shows tenant-scoped data only (not cross-tenant)
- [x] Recent activity feed renders

### T-6.2 SoftwareManagement — Full Page Form (6 tests)

**Updated: Add/Edit is now a full page, not a modal**

- [x] Program list page renders program cards with stats
- [x] Clicking "Add Program" navigates to `/software-management/create` (NOT open a modal)
- [x] Program create page: External API Key input has password show/hide toggle
- [x] Program create page: shows URL hint text below API Key: `/apiuseradd/[KEY]/username/bios`
- [x] Program edit page: API Key field is empty on load (never shows existing value)
- [x] Program edit page: shows green "API Configured ✓" badge when `has_external_api === true`

### T-6.3 ProgramLogs Page (8 tests)

**File:** `tests-frontend/tests/unit/manager-parent/ProgramLogs.test.tsx`

- [x] Page renders program selector dropdown
- [x] After selecting a program, fetches logs from `/api/manager-parent/programs/{id}/logs`
- [x] Activation Events tab: table with BIOS ID / Username / Activated By / Timestamp columns
- [x] "Activated By" column shows reseller name + "via Dashboard" badge for dashboard activations
- [x] "Activated By" shows "External (unknown)" in gray for unknown activations
- [x] BIOS ID column: shows BIOS on top, username in gray subtext below
- [x] Shows loading skeleton while fetching
- [x] Shows empty state if no log entries

### T-6.4 CustomerDetail Page (8 tests)

**File:** `tests-frontend/tests/unit/manager-parent/CustomerDetail.test.tsx`

- [x] Page renders when navigating to `/:lang/customers/{id}`
- [x] User Info card: name, email, phone, username, status badge
- [x] Active Licenses table: program / BIOS ID / reseller / dates / status / Deactivate action
- [x] "Resellers" section: lists all resellers who activated for this customer
- [x] Login IP History section: IP / flag / country / city / timestamp per row
- [x] Activity Log section: recent activity_log entries
- [x] Clicking "Deactivate" on a license shows ConfirmDialog
- [x] Back link returns to Customers list

### T-6.5 IpAnalytics Page — External Logs (4 tests)

**Updated: Shows external activation server IPs, not internal Laravel logs**

- [x] Program selector dropdown renders
- [x] After selecting a program, fetches data from external logs (NOT `/api/request-logs`)
- [x] Table shows real login IPs (not `127.0.0.1 GET api/programs`)
- [x] Country column shows emoji flag from ISO country code

### T-6.6 BiosBlacklist (3 tests)

- [x] Tenant-scoped BIOS blacklist table renders
- [x] Add to blacklist form works
- [x] Remove from blacklist works

### T-6.7 BiosHistory (2 tests)

- [x] Timeline for searched BIOS ID renders (tenant-scoped)
- [x] Filter by action type works

### T-6.8 FinancialReports (3 tests)

- [x] Revenue charts render (tenant-scoped)
- [x] Reseller balance breakdown table renders
- [x] Export works

### T-6.9 Reports (3 tests)

- [x] Charts render with date range filter
- [x] Tenant-scoped data only
- [x] Export CSV and PDF work

---

## T-7: Manager Page Tests

### T-7.1 Dashboard (2 tests)

- [x] Manager dashboard renders team stats
- [x] Shows resellers under this manager only

### T-7.2 Team (2 tests)

- [x] Reseller list table renders
- [x] Suspend reseller changes status badge

### T-7.3 Software (1 test)

- [x] Renders program cards (read-only — no add/edit/delete buttons)

### T-7.4 Reports (2 tests)

- [x] Charts render for manager's team scope
- [x] Export buttons work

### T-7.5 UsernameManagement (3 tests)

- [x] Table with username lock status renders
- [x] "Unlock" action shows ConfirmDialog
- [x] "Change Username" opens modal

---

## T-8: Reseller Page Tests

### T-8.1 Dashboard (2 tests)

- [x] Stats cards render (customers, licenses, revenue, expiring)
- [x] Charts render

### T-8.2 Customers (5 tests)

- [x] Customer table renders
- [x] "Add Customer" button opens activation wizard
- [x] Activation wizard Step 1: customer info (name, email) validates
- [x] Activation wizard Step 2: BIOS ID + program selector validates
- [x] Activation wizard Step 3: DurationPicker + price → submits correctly

### T-8.3 Licenses (4 tests)

- [x] License table renders with BIOS ID + username subtext
- [x] Status filter (Active / Expired / Suspended) works
- [x] "Renew" action opens RenewModal
- [x] "Deactivate" action shows ConfirmDialog

### T-8.4 Software Page — 5th Page (8 tests)

**File:** `tests-frontend/tests/unit/reseller/Software.test.tsx` (NEW)

- [x] Page renders program cards (with name, status, active licenses count)
- [x] "ACTIVATE" button renders on each program card
- [x] Clicking "ACTIVATE" opens `ActivateLicenseModal`
- [x] Modal shows BIOS ID field + DurationPicker + price input
- [x] Submit calls `POST /api/reseller/licenses` with float `duration_days`
- [x] On success: toast shown + modal closes
- [x] On external API failure (BIOS rejected): shows error from API response
- [x] On duplicate BIOS (422): shows "An active license already exists" error

### T-8.5 Reports (2 tests)

- [x] Revenue charts render for this reseller
- [x] Export buttons work

---

## T-9: Hook Tests

### T-9.1 useAuth (5 tests)

- [x] Returns `user` object when authenticated (token in localStorage)
- [x] `login()` stores token in localStorage and updates user state
- [x] `logout()` removes token from localStorage and redirects to `/login`
- [x] `isAuthenticated` returns `true` when token exists
- [x] Redirects to `/login` when API returns 401 (token expired)

### T-9.2 useTheme (4 tests)

- [x] Returns current theme (`dark` or `light`)
- [x] `toggle()` switches theme
- [x] Theme persists to localStorage across renders
- [x] Reads system preference (`prefers-color-scheme`) on first load

### T-9.3 useRoleGuard (3 tests)

- [x] Returns `allowed: true` when user role matches required role
- [x] Redirects to own dashboard when role doesn't match
- [x] Shows loading state while auth check is in progress

### T-9.4 useLicenses (3 tests)

- [x] Fetches licenses list via React Query
- [x] Creates license via mutation (float `duration_days`)
- [x] Filter by status sends correct query param

---

## T-10: Service Tests

### T-10.1 auth.service (4 tests)

**File:** `tests-frontend/tests/unit/services/auth.service.test.ts`

- [x] `login()` calls `POST /api/auth/login` with email + password
- [x] `logout()` calls `POST /api/auth/logout`
- [x] `getMe()` calls `GET /api/auth/me`
- [x] **NO `forgotPassword()` method** — assert it does not exist on the service

### T-10.2 license.service (6 tests)

**File:** `tests-frontend/tests/unit/services/license.service.test.ts`

- [x] `activate()` sends `duration_days` as float (not integer)
- [x] `activate()` calls `POST /api/reseller/licenses`
- [x] `renew()` calls `POST /api/reseller/licenses/{id}/renew`
- [x] `deactivate()` calls `POST /api/reseller/licenses/{id}/deactivate`
- [x] `getAll()` calls `GET /api/reseller/licenses` with status/search params
- [x] `getExpiring()` calls `GET /api/reseller/licenses/expiring?days={n}`

### T-10.3 security.service (4 tests)

**File:** `tests-frontend/tests/unit/services/security.service.test.ts` (NEW)

- [x] `getLocks()` calls `GET /api/super-admin/security/locks`
- [x] `unblockEmail(email)` calls `POST /api/super-admin/security/unblock-email` with `{email}`
- [x] `unblockIp(ip)` calls `POST /api/super-admin/security/unblock-ip` with `{ip}`
- [x] `getAuditLog()` calls `GET /api/super-admin/security/audit-log`

### T-10.4 api (Axios instance) (3 tests)

- [x] Attaches `Authorization: Bearer {token}` header to all requests
- [x] On `401` response: removes token from localStorage + redirects to `/login`
- [x] On network error (no response): shows user-facing error toast

### T-10.5 report.service (3 tests)

- [x] `getResellerReport(params)` calls correct endpoint with date range
- [x] `exportCsv(params)` triggers file download
- [x] `exportPdf(params)` triggers file download

---

## T-11: Utility Tests

### T-11.1 Formatters (4 tests)

- [x] `formatDate('2026-03-01T12:00:00Z')` → `"Mar 1, 2026"` (en)
- [x] `formatDate('2026-03-01T12:00:00Z')` → Arabic date format (ar)
- [x] `formatCurrency(1234.5)` → `"$1,234.50"`
- [x] `formatDuration(0.021)` → `"30 minutes"` (converts float days to readable string)

### T-11.2 Validators (3 tests)

- [x] `validateEmail('bad@')` returns error string
- [x] `validateBiosId('')` returns required error
- [x] `validateBiosId('BIOS-001')` returns null (valid)

### T-11.3 GeoIP Utilities (5 tests)

**File:** `tests-frontend/tests/unit/utils/geoip.test.ts` (NEW)

- [x] `getFlag('EG')` returns `"🇪🇬"`
- [x] `getFlag('SA')` returns `"🇸🇦"`
- [x] `getFlag(null)` returns `"🏳️"` (unknown)
- [x] `parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0...Safari/...')` → `"iPhone Safari"`
- [x] `parseUserAgent('Mozilla/5.0 (Windows NT 10.0...) Chrome/...')` → `"Windows Chrome"`

---

## T-12: Backend PHPUnit Feature Tests

### T-12.1 Auth — Login Security (12 tests)

**File:** `backend/tests/Feature/Auth/LoginSecurityTest.php`

- [x] Correct credentials → `200` with token
- [x] Wrong password 1st attempt → `401 {"message":"Invalid credentials."}` (no lockout)
- [x] Wrong password 4th attempt → `401` with `X-RateLimit-Remaining: 1`
- [x] Wrong password 5th attempt → `429` with `locked: true`, `seconds_remaining: 60`
- [x] Wrong password 6th attempt (within lockout) → `429` (already locked)
- [x] After 1-minute lockout expires → `401` (can try again)
- [x] Cumulative: attempt 6 after lockout → `429` with `seconds_remaining: 300` (5 min)
- [x] Attempt 10 → `429` with `reason: 'ip_blocked'`, `unlocks_at: null`
- [x] `X-RateLimit-Limit: 10` in all login response headers
- [x] `Retry-After` header present on `429` response
- [x] Successful login after lockout expires → `200` + `clearAttempts()` resets counter
- [x] **Silent Deny**: customer account login → `401 {"message":"Invalid credentials."}` (same as wrong password)

### T-12.2 Auth — Forgot Password Route (1 test)

**File:** `backend/tests/Feature/Auth/LoginTest.php`

- [x] `POST /api/auth/forgot-password` → `404` (route does not exist)

### T-12.3 Super Admin — SecurityController (6 tests)

**File:** `backend/tests/Feature/SuperAdmin/SecurityControllerTest.php`

- [x] `GET /api/super-admin/security/locks` → `200` with `locked_accounts` + `blocked_ips` arrays
- [x] `POST /api/super-admin/security/unblock-email` → `200` + email unblocked in cache
- [x] `POST /api/super-admin/security/unblock-ip` → `200` + IP removed from cache
- [x] `GET /api/super-admin/security/audit-log` → `200` paginated activity log
- [x] Non-super-admin calling security endpoints → `403`
- [x] Unblocking an email that isn't locked → `200` (idempotent)

### T-12.4 ManagerParent — ProgramController with API Keys (6 tests)

**File:** `backend/tests/Feature/ManagerParent/ProgramControllerTest.php`

- [x] Create program with `external_api_key` → encrypted in DB, `has_external_api: true`
- [x] Read program → response does NOT include `external_api_key` (never exposed)
- [x] Read program → response includes `has_external_api: true`, `external_software_id: 8`
- [x] Update program with new `external_api_key` → re-encrypted in DB
- [x] Update program without `external_api_key` → existing key unchanged
- [x] Delete program → `200`, program removed

### T-12.5 Manager — SoftwareController (4 tests)

**File:** `backend/tests/Feature/Manager/SoftwareControllerTest.php`

- [x] Create software — manager tenant-scoped, includes external key handling
- [x] Update software — tenant authorization check works
- [x] Delete software — tenant authorization check works
- [x] Activate software for customer — BiosActivationService called with program API key

### T-12.6 Reseller — LicenseController (8 tests)

**File:** `backend/tests/Feature/Reseller/LicenseControllerTest.php`

- [x] `POST activate` with `duration_days: 0.021` (30 min) → `expires_at` is ~30 minutes from now
- [x] `POST activate` with `duration_days: 0.5` (12 hr) → `expires_at` is ~12 hours from now
- [x] `POST activate` with `duration_days: 7` → `expires_at` is 7 days from now
- [x] `POST activate` with blacklisted BIOS → `422` with "This BIOS ID is blacklisted"
- [x] `POST activate` with duplicate active BIOS+program → `422` "active license already exists"
- [x] `POST activate` — program has no external API key → `422` "not configured for external activation"
- [x] `GET /reseller/licenses` → list includes `external_username` field
- [x] `POST deactivate` → license status changes to `"suspended"`

### T-12.7 ExternalApiService (6 tests)

**File:** `backend/tests/Feature/External/ExternalApiServiceTest.php`

- [x] `activateUser($key, $user, $bios)` makes `GET` to `http://EXTERNAL_API_HOST/apiuseradd/{key}/{user}/{bios}`
- [x] External returns `"True"` → `['success' => true]`
- [x] External returns `"False"` → `['success' => false]`
- [x] External returns timeout → `['success' => false, 'error' => 'Connection timeout']`
- [x] `deactivateUser($key, $user)` makes `GET` to `/apideluser/{key}/{user}`
- [x] `getProgramLogs($softwareId)` makes `GET` to `/apilogs/{softwareId}`

### T-12.8 GeoIpService (4 tests)

**File:** `backend/tests/Feature/External/GeoIpServiceTest.php`

- [x] `lookup('197.55.1.2')` calls `http://ip-api.com/json/197.55.1.2?fields=countryCode,country,city,isp`
- [x] Returns `['country_code' => 'EG', 'country_name' => 'Egypt', 'city' => 'Damanhour', 'isp' => 'TE Data']`
- [x] Result is cached for 24 hours (same IP second call uses cache, no HTTP)
- [x] On network failure → returns `['country_code' => null, 'country_name' => 'Unknown', ...]`

---

## T-13: Backend PHPUnit Unit Tests

### T-13.1 LoginSecurityService Unit Tests (10 tests)

**File:** `backend/tests/Unit/LoginSecurityServiceTest.php`

- [x] `getLockoutDuration(5)` returns `60` (1 minute)
- [x] `getLockoutDuration(6)` returns `300` (5 minutes)
- [x] `getLockoutDuration(7)` returns `3600` (1 hour)
- [x] `getLockoutDuration(8)` returns `36000` (10 hours)
- [x] `getLockoutDuration(9)` returns `86400` (24 hours)
- [x] `getLockoutDuration(10)` returns `PHP_INT_MAX` (permanent)
- [x] `isLocked($email, $ip)` returns `['locked' => false]` when no cache key
- [x] `isLocked($email, $ip)` returns `['locked' => true, 'seconds_remaining' => int]` when locked
- [x] `isLocked($email, $ip)` returns `['locked' => true, 'reason' => 'ip_blocked']` when IP blocked
- [x] `clearAttempts($email, $ip)` removes all cache keys for email + IP

### T-13.2 Program Model — Encrypted API Key (4 tests)

**File:** `backend/tests/Unit/ProgramModelTest.php`

- [x] `setExternalApiKeyAttribute('L9H2F7Q8XK6M4A')` stores encrypted value in DB (not plain text)
- [x] `getDecryptedApiKey()` returns original plain text key after encrypt → store → decrypt
- [x] `getDecryptedApiKey()` returns `null` when `external_api_key_encrypted` is null
- [x] `serializeProgram()` never includes `external_api_key` or `external_api_key_encrypted` in output

### T-13.3 LicenseService — Float Duration (4 tests)

**File:** `backend/tests/Unit/LicenseServiceTest.php`

- [x] `duration_days = 0.021` → `expires_at = now()->addMinutes(30)` (±1 min tolerance)
- [x] `duration_days = 0.5` → `expires_at = now()->addMinutes(720)` (12 hours)
- [x] `duration_days = 1` → `expires_at = now()->addMinutes(1440)` (1 day)
- [x] `duration_days = 30` → `expires_at = now()->addMinutes(43200)` (30 days)

---

## T-14: Cypress E2E Tests

### T-14.1 Setup

- [x] Create/update `tests-frontend/cypress/support/commands.ts`:
  ```typescript
  Cypress.Commands.add('login', (role: 'super_admin' | 'manager_parent' | 'manager' | 'reseller') => {
    // POST /api/auth/login with test credentials per role
    // Store token in localStorage
  })
  Cypress.Commands.add('mockExternalApi', (response: 'success' | 'failure' | 'timeout') => {
    // Intercept external API calls via cy.intercept on the backend proxy
  })
  ```
- [x] Create fixtures:
  - `tests-frontend/cypress/fixtures/users.json` (4 roles — no customer)
  - `tests-frontend/cypress/fixtures/programs.json` (with `has_external_api: true`)
  - `tests-frontend/cypress/fixtures/licenses.json` (active/expired/suspended, float duration_days)
  - `tests-frontend/cypress/fixtures/security-locks.json` (locked accounts + blocked IPs)
  - `tests-frontend/cypress/fixtures/external-api.json` (mock API responses)

### T-14.2 Auth — Basic Login (4 tests)

**File:** `tests-frontend/cypress/e2e/auth/login.cy.ts`

- [x] 1: Super Admin login → redirected to `/en/super-admin/dashboard`
- [x] 2: Manager Parent login → redirected to `/en/dashboard`
- [x] 3: Manager login → redirected to `/en/manager/dashboard`
- [x] 4: Reseller login → redirected to `/en/reseller/dashboard`

### T-14.3 Auth — Invalid + Lockout (5 tests)

**File:** `tests-frontend/cypress/e2e/auth/login-lockout.cy.ts`

- [x] 5: Wrong password → error message shown, form stays visible
- [x] 6: 5 wrong passwords in row → LockoutBanner appears with countdown `"1:00"`
- [x] 7: While locked, try again → same `429` response, banner still shows
- [x] 8: After lockout timer expires → banner hides, form re-enables
- [x] 9: `/ar/forgot-password` → 404 page shown (route does not exist)

### T-14.4 Role Boundaries & Silent Deny (4 tests)

**File:** `tests-frontend/cypress/e2e/auth/role-redirect.cy.ts`

- [x] 10: Reseller visiting `/en/super-admin/dashboard` → redirected to reseller dashboard
- [x] 11: Unauthenticated user visiting any protected route → redirected to `/en/login`
- [x] 12: Customer credentials login → `401 {"message":"Invalid credentials."}` (Silent Deny)
- [x] 13: Manager visiting `/en/reseller/licenses` → 403 or redirect

### T-14.5 Super Admin — SecurityLocks Page (4 tests)

**File:** `tests-frontend/cypress/e2e/super-admin/security-locks.cy.ts`

- [x] 14: Super Admin visits `/en/security-locks` → page renders with 3 tabs
- [x] 15: "Locked Accounts" tab shows mocked locked account with countdown
- [x] 16: Clicking "Unblock" on an account → success toast + row disappears
- [x] 17: "Blocked IPs" tab shows mocked IP with 🇪🇬 flag + "Egypt / Damanhour"

### T-14.6 License Activation — External API Mock (6 tests)

**File:** `tests-frontend/cypress/e2e/reseller/activation.cy.ts`

- [x] 18: Reseller opens Software page → program cards visible with "ACTIVATE" button
- [x] 19: Click "ACTIVATE" → ActivateLicenseModal opens
- [x] 20: Fill BIOS ID + select program + select `30 min` duration → price auto-updates
- [x] 21: Submit with mocked external API returning "True" → success toast + modal closes
- [x] 22: Submit with mocked external API returning "False" → error message shown in modal
- [x] 23: Submit with duplicate BIOS (422) → error "An active license already exists"

### T-14.7 License Management (4 tests)

**File:** `tests-frontend/cypress/e2e/reseller/licenses.cy.ts`

- [x] 24: Licenses table renders with BIOS ID + username subtext on each row
- [x] 25: Renew license → duration picker shown in renew modal
- [x] 26: Deactivate license → ConfirmDialog → license status changes to "Suspended"
- [x] 27: Filter by "Active" status → only active licenses shown

### T-14.8 Software Management — Full Page (3 tests)

**File:** `tests-frontend/cypress/e2e/manager-parent/software.cy.ts`

- [x] 28: Click "Add Program" → navigates to `/software-management/create` (NOT a modal)
- [x] 29: API Key field on edit page → empty on load, shows "API Configured ✓" badge
- [x] 30: API Key helper text shows `/apiuseradd/[KEY]/username/bios` hint

### T-14.9 Program Logs Page (3 tests)

**File:** `tests-frontend/cypress/e2e/manager-parent/program-logs.cy.ts`

- [x] 31: Manager Parent visits Program Logs → program selector rendered
- [x] 32: Select a program → activation events table loads with "Activated By" column
- [x] 33: "Activated By" shows reseller name for dashboard-activated licenses

### T-14.10 Team Management (3 tests)

- [x] 34: Manager Parent invites new Manager → success + appears in team table
- [x] 35: Manager Parent invites new Reseller → success + appears in team table
- [x] 36: Suspend team member → status badge changes to "Suspended"

### T-14.11 UI/UX — RTL + Responsive (5 tests)

- [x] 37: Visiting `/ar/login` → RTL layout applied, logo + form right-to-left
- [x] 38: Visiting `/en/login` → LTR layout applied
- [x] 39: Visiting `/ar/super-admin/dashboard` → Sidebar on RIGHT side of screen
- [x] 40: Dark mode toggle: click → background changes to dark theme
- [x] 41: Mobile viewport: hamburger button opens sidebar overlay

### T-14.12 IP Analytics — External Logs (2 tests)

- [x] 42: IP Analytics page → select program → table shows real IPs (NOT `127.0.0.1`)
- [x] 43: Country column shows emoji flag (🇪🇬 for Egypt)

### T-14.13 API Status — Real External Server (2 tests)

- [x] 44: API Status page → shows `http://EXTERNAL_API_HOST` as monitored URL
- [x] 45: "Ping Now" button triggers API check + updates status badge

### T-14.14 Customer Detail Page (3 tests)

- [x] 46: Click customer username in any table → navigates to `/customers/{id}`
- [x] 47: CustomerDetail page shows licenses table + reseller attribution
- [x] 48: Login IP History section shows IPs with country flags

### T-14.15 Cross-Browser Manual Checks (3 tests — mark complete after manual run)

- [x] 49: Chrome — complete login + activation flow
- [x] 50: Firefox — complete login + activation flow
- [x] 51: Edge — complete login + activation flow

---

## T-15: Performance Optimization

- [x] Add `React.lazy()` for ALL page components (all roles)
- [x] Add `<Suspense>` boundaries with loading fallback (`<PageLoader />`)
- [x] Verify Vite code splitting in build: `npm run build -- --report`
- [x] Main bundle < 250KB gzipped
- [x] Image lazy loading for program icons
- [x] Run Lighthouse: `npx lighthouse http://localhost:3000 --output html --output-path ./lighthouse-report.html`
- [x] Fix any Lighthouse A11y issues (ARIA labels, contrast ratios, focus rings)
- [x] Verify no console errors on any page in any role
- [x] Verify `npx tsc --noEmit` → zero TypeScript errors
- [x] Verify `npm run build` passes clean

---

## T-16: Security Headers Verification

- [x] Set `Content-Security-Policy` header on all API responses
- [x] Set `X-Frame-Options: DENY` on API responses
- [x] `X-Content-Type-Options: nosniff` on all responses
- [x] `Referrer-Policy: no-referrer` on all responses
- [x] Login endpoint: confirm `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` present
- [ ] Test at `https://securityheaders.io` (when deployed) — target: A or A+

---

## Run All Tests

```bash
# Jest — run from tests-frontend/
cd tests-frontend
npm run test:unit -- --coverage --watchAll=false
# Expected: 341 tests, 0 failures, coverage > 80%

# Cypress — run from tests-frontend/
cd tests-frontend
npm run test:e2e
# Expected: 55 scenarios, 0 failures

# PHPUnit Feature tests
cd backend && php artisan test --testsuite=Feature
# Expected: 39 tests, 0 failures

# PHPUnit Unit tests
cd backend && php artisan test --testsuite=Unit
# Expected: 73 tests, 0 failures

# Lighthouse
npx lighthouse http://localhost:3000/en/login --output html --output-path ./lighthouse-report.html
```

---

## T-17: Final Verification Checklist

```
Jest:       341 tests    · 0 failures · coverage > 80%
Cypress:    55 scenarios · 0 failures
PHPUnit:    112 tests    · 0 failures (Feature 39 + Unit 73)
Lighthouse: Desktop 95+ achieved · Mobile baseline ~93 (optimization follow-up pending)
Console:    0 errors · 0 warnings (any page, any role)
TypeScript: npx tsc --noEmit → 0 errors
Build:      npm run build → passes clean
```

**Specific security checks:**
- [x] Login 5× wrong → `429` with countdown banner
- [x] Login 10× wrong → IP blocked + permanent banner + `support@obd2sw.com`
- [x] Customer login → `401 {"message":"Invalid credentials."}` (Silent Deny confirmed)
- [x] `/ar/forgot-password` → 404
- [x] Super Admin SecurityLocks page → shows locked accounts + blocked IPs + audit log
- [x] Unblock from SecurityLocks → immediately works

**Phase 08 complete → Proceed to PHASE-09-Deployment.**

