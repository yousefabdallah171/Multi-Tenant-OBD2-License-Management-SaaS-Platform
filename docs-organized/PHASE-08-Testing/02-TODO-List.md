# PHASE 08: Testing - TODO List

**Duration:** Day 11
**Deadline:** End of Day 11

---

## Setup (in `tests-frontend/`)

> All tests live in `tests-frontend/` — separate from `frontend/` production code. Delete before production build.

- [ ] Verify Jest config: `tests-frontend/jest.config.ts` with React Testing Library
- [ ] Verify Cypress config: `tests-frontend/cypress.config.ts` with baseUrl
- [ ] Create test utilities: `tests-frontend/tests/utils/test-utils.tsx`
  ```tsx
  // Custom render with providers (Router, QueryClient, I18n, Theme)
  export function renderWithProviders(ui, options?) { ... }
  ```
- [ ] Create mock data: `tests-frontend/tests/mocks/`
  - `users.ts`, `tenants.ts`, `programs.ts`, `licenses.ts`
- [ ] Create API mock helpers: `tests-frontend/tests/mocks/api.ts`
  ```tsx
  // MSW (Mock Service Worker) or manual Axios mocks
  ```

---

## Jest Component Tests (80 tests)

### Layout Components (21 tests)

**Navbar (8)**
- [ ] Renders logo
- [ ] Shows correct nav links for super_admin role
- [ ] Shows correct nav links for reseller role
- [ ] Shows correct nav links for customer role
- [ ] Language toggle switches between AR/EN
- [ ] Theme toggle switches between dark/light
- [ ] Profile dropdown shows user name
- [ ] Logout button calls logout service

**Sidebar (8)**
- [ ] Renders navigation items with icons
- [ ] Highlights active route item
- [ ] Collapses when toggle clicked
- [ ] Shows only icons when collapsed
- [ ] Renders on right side when RTL
- [ ] Mobile: renders as overlay
- [ ] Mobile: backdrop click closes sidebar
- [ ] Shows correct items per role

**DashboardLayout (5)**
- [ ] Renders Navbar, Sidebar, and children
- [ ] Passes role to sidebar for correct navigation
- [ ] Content area scrollable
- [ ] Footer renders copyright text
- [ ] Mobile: no sidebar space, full-width content

### Shared Components (37 tests)

**StatsCard (5)**
- [ ] Renders title, value, and icon
- [ ] Shows positive trend with green arrow
- [ ] Shows negative trend with red arrow
- [ ] Shows no trend arrow when trend is undefined
- [ ] Applies custom color class

**DataTable (10)**
- [ ] Renders column headers
- [ ] Renders data rows
- [ ] Shows pagination controls
- [ ] Changes page when next clicked
- [ ] Sorts by column when header clicked
- [ ] Filters rows by search input
- [ ] Shows skeleton rows when loading
- [ ] Shows EmptyState when no data
- [ ] Renders action buttons per row
- [ ] Handles page size change

**StatusBadge (5)**
- [ ] Renders green for "active"
- [ ] Renders red for "expired"
- [ ] Renders amber for "suspended"
- [ ] Renders gray for "inactive"
- [ ] Renders blue for "pending"

**RoleBadge (5)**
- [ ] Correct color for super_admin
- [ ] Correct color for manager_parent
- [ ] Correct color for manager
- [ ] Correct color for reseller
- [ ] Correct color for customer

**EmptyState (3)**
- [ ] Renders icon and message
- [ ] Shows action button when provided
- [ ] Calls onClick when action button clicked

**ErrorBoundary (4)**
- [ ] Renders children when no error
- [ ] Shows fallback UI when child throws
- [ ] Try Again button re-mounts children
- [ ] Logs error to console

**ConfirmDialog (3)**
- [ ] Opens when trigger clicked
- [ ] Calls onConfirm when confirm clicked
- [ ] Closes when cancel clicked

**ExportButtons (4)**
- [ ] Renders CSV and PDF buttons
- [ ] Calls onExportCsv when CSV clicked
- [ ] Calls onExportPdf when PDF clicked
- [ ] Shows loading spinner during export

**LicenseCard (8) - from customer/**
- [ ] Renders program name and version
- [ ] Shows BIOS ID
- [ ] Shows "Active" status badge (green)
- [ ] Shows "Expired" status badge (red)
- [ ] Progress bar shows correct percentage
- [ ] Green progress when >30%
- [ ] Red progress when <10%
- [ ] Download button disabled when expired

### Chart Components (12 tests)

**LineChartWidget (3)**
- [ ] Renders SVG chart with data
- [ ] Shows loading skeleton when isLoading
- [ ] Shows empty state when no data

**BarChartWidget (3)**
- [ ] Renders bars with data
- [ ] Supports horizontal orientation
- [ ] Shows loading state

**PieChartWidget (3)**
- [ ] Renders pie/donut slices
- [ ] Shows legend with labels
- [ ] Shows loading state

**AreaChartWidget (3)**
- [ ] Renders area with gradient
- [ ] Shows loading state
- [ ] Shows empty state

---

## Jest Page Tests (80 tests)

### Auth (8)
- [ ] Login page renders email and password fields
- [ ] Submit with empty fields shows validation errors
- [ ] Submit with invalid email shows error
- [ ] Successful login stores token and redirects
- [ ] Failed login shows error message
- [ ] Forgot password form renders
- [ ] Forgot password submits email
- [ ] Already logged in user redirected to dashboard

### Super Admin Pages (45)
**Dashboard (4)**
- [ ] Renders 5 stats cards
- [ ] Renders revenue chart
- [ ] Renders tenant comparison chart
- [ ] Shows recent activity feed

**Tenants (5)**
- [ ] Renders tenant data table
- [ ] Add Tenant button opens dialog
- [ ] Create tenant form validates
- [ ] Delete tenant shows confirm dialog
- [ ] Status filter tabs work

**Users (4)**
- [ ] Renders user table
- [ ] Role filter changes displayed users
- [ ] Suspend user changes status badge
- [ ] Search filters by name/email

**Admin Management (4)**
- [ ] Renders admin table with role badges
- [ ] Add Admin opens modal with role selection
- [ ] Reset Password action works
- [ ] Suspend/Delete actions work

**BIOS Blacklist (4)**
- [ ] Renders blacklist table
- [ ] Add to blacklist opens modal
- [ ] Remove from blacklist updates status
- [ ] Search by BIOS ID works

**BIOS History (3)**
- [ ] Search returns timeline for BIOS ID
- [ ] Shows cross-tenant data (global)
- [ ] Filter by action type works

**Username Management (4)**
- [ ] Renders user table with lock status
- [ ] Unlock action shows confirm dialog
- [ ] Change Username opens modal
- [ ] Reset Password logs to activity_logs

**Financial Reports (4)**
- [ ] Renders revenue charts
- [ ] Reseller Balances table renders
- [ ] Export CSV calls service
- [ ] Export PDF calls service

**Reports (4)**
- [ ] Renders all charts
- [ ] Date range picker changes data
- [ ] Export CSV calls service
- [ ] Export PDF calls service

**Logs (4)**
- [ ] Renders log table
- [ ] Click row expands JSON viewer
- [ ] Filter by endpoint works
- [ ] Color-coded status codes

**API Status (3)**
- [ ] Shows current status badge
- [ ] Shows uptime percentages
- [ ] Ping button triggers check

**Settings (3)**
- [ ] Renders form sections
- [ ] Saves settings on submit
- [ ] Validates required fields

**Profile (3)**
- [ ] Renders profile info
- [ ] Edit form saves changes
- [ ] Change password validates

### Manager Parent Pages (30)
- [ ] Dashboard: 4 stats cards + charts render (3)
- [ ] Team Management: tabs render, invite works (4)
- [ ] Software Management: CRUD operations (4)
- [ ] Reseller Pricing: table renders, edit works (3)
- [ ] BIOS Blacklist (Tenant): table + add/remove (3)
- [ ] BIOS History (Tenant): search + timeline (2)
- [ ] IP Analytics: charts + table render (3)
- [ ] Username Management (Tenant): table + actions (3)
- [ ] Financial Reports (Tenant): charts + balances (3)
- [ ] Reports: charts + export (3)
- [ ] Customers: table + filters (2)
- [ ] Activity: feed renders (1)

### Manager Pages (12)
- [ ] Dashboard: team stats + charts (2)
- [ ] Team/Resellers: table + detail (2)
- [ ] Username Management (Team): table + unlock/change (3)
- [ ] Customers: read-only table + filters (2)
- [ ] Software: read-only cards (1)
- [ ] Reports: team charts + export (2)

### Reseller Pages (12)
- [ ] Dashboard: stats + charts (2)
- [ ] Customers: table + activation wizard (5)
- [ ] Licenses: table + filters + expiry warnings (3)
- [ ] Software: read-only cards (1)
- [ ] Reports: charts + export (1)

### Customer Pages (8)
- [ ] Dashboard: license cards render (2)
- [ ] Dashboard: empty state when no licenses (1)
- [ ] Dashboard: progress bar correct percentage (2)
- [ ] Software: program cards render (1)
- [ ] Download: download buttons render (1)
- [ ] Download: disabled button for expired (1)

---

## Jest Hook & Service Tests (30 tests)

### Hooks (15)
**useAuth (5)**
- [ ] Returns user data when authenticated
- [ ] login() stores token in localStorage
- [ ] logout() removes token
- [ ] isAuthenticated returns true with token
- [ ] Redirects to login when token expired

**useTheme (4)**
- [ ] Returns current theme
- [ ] toggle() switches theme
- [ ] Persists theme to localStorage
- [ ] Reads system preference on init

**useRoleGuard (3)**
- [ ] Returns true when role matches
- [ ] Redirects when role doesn't match
- [ ] Shows loading while checking

**useLicenses (3)**
- [ ] Fetches licenses with React Query
- [ ] Creates license via mutation
- [ ] Filters by status

### Services (10)
**auth.service (4)**
- [ ] login() calls POST /api/auth/login
- [ ] logout() calls POST /api/auth/logout
- [ ] getMe() calls GET /api/auth/me
- [ ] forgotPassword() calls POST /api/auth/forgot-password

**license.service (5)**
- [ ] activate() calls POST /api/licenses/activate
- [ ] renew() calls POST /api/licenses/{id}/renew
- [ ] deactivate() calls POST /api/licenses/{id}/deactivate
- [ ] getAll() calls GET with params
- [ ] getExpiring() calls GET with days param

**api (Axios instance) (3)**
- [ ] Attaches Authorization header
- [ ] Handles 401 by redirecting to login
- [ ] Handles network error gracefully

### Utilities (5)
- [ ] formatDate() formats correctly
- [ ] formatCurrency() adds $ and decimals
- [ ] validateEmail() accepts valid emails
- [ ] validateBiosId() checks min length
- [ ] isRequired() returns error for empty string

---

## Cypress E2E (35 scenarios)

### Setup
- [ ] Create custom commands in `tests-frontend/cypress/support/commands.ts`:
  ```typescript
  Cypress.Commands.add('login', (role: string) => { ... })
  Cypress.Commands.add('apiMock', (route: string, fixture: string) => { ... })
  ```
- [ ] Create fixtures: users.json, tenants.json, programs.json, licenses.json

### Auth (5)
- [ ] 1: Super Admin login + redirect
- [ ] 2: Manager Parent login + redirect
- [ ] 3: Reseller login + redirect
- [ ] 4: Customer login + redirect
- [ ] 5: Invalid credentials show error

### Role Boundaries (3)
- [ ] 6: Reseller visiting /super-admin -> redirected
- [ ] 7: Customer visiting /dashboard -> redirected
- [ ] 8: Unauthenticated -> /login

### License Activation (5)
- [ ] 9: Open Add Customer dialog
- [ ] 10: Fill Step 1 (name, email)
- [ ] 11: Fill Step 2 (BIOS ID, program)
- [ ] 12: Fill Step 3 (duration, price)
- [ ] 13: Submit -> success + appears in table

### License Management (4)
- [ ] 14: Renew license flow
- [ ] 15: Deactivate license flow
- [ ] 16: Filter by Active status
- [ ] 17: Expiry warnings visible

### Software Management (3)
- [ ] 18: Add program with download link
- [ ] 19: Edit program
- [ ] 20: Delete program with confirmation

### Team Management (3)
- [ ] 21: Invite Manager
- [ ] 22: Invite Reseller
- [ ] 23: Suspend member

### Customer Portal (3)
- [ ] 24: License cards visible
- [ ] 25: Download active license
- [ ] 26: Download disabled for expired

### Manager Dashboard (3)
- [ ] 27: Manager login -> separate /manager/dashboard
- [ ] 28: Manager username management: unlock username
- [ ] 29: Manager cannot access reseller-only routes

### BIOS & Username Management (3)
- [ ] 30: Super Admin adds BIOS to blacklist
- [ ] 31: Super Admin unlocks user's username
- [ ] 32: Manager Parent views BIOS history for tenant

### UI/UX (3)
- [ ] 33: Visiting `/ar/...` URL applies RTL layout, `/en/...` applies LTR
- [ ] 34: Dark mode toggle works
- [ ] 35: Mobile hamburger menu

---

## Performance Optimization

- [ ] Add React.lazy() for all page components
- [ ] Add Suspense boundaries with loading fallback
- [ ] Verify Vite code splitting in build output
- [ ] Check bundle size: `npm run build -- --report`
- [ ] Target: main bundle < 200KB gzipped
- [ ] Add image lazy loading for program icons
- [ ] Add prefetch for adjacent routes
- [ ] Run Lighthouse audit: `npx lighthouse http://localhost:3000`
- [ ] Fix any Lighthouse recommendations

---

## Run All Tests

```bash
# Jest (should see 250+ tests) — run from tests-frontend/
cd tests-frontend
npm run test:unit -- --coverage --watchAll=false

# Cypress (should see 35 scenarios) — run from tests-frontend/
cd tests-frontend
npm run test:e2e

# Backend (should see 75+ tests)
cd backend && php artisan test

# Lighthouse
npx lighthouse http://localhost:3000 --output html --output-path ./lighthouse-report.html
```

---

## Verification (End of Day 11)

```
Jest:      250+ tests,  0 failures, coverage > 80%
Cypress:   35 scenarios, 0 failures
PHPUnit:   75+ tests,   0 failures
Lighthouse: Performance 95+, Accessibility 90+
Console:   0 errors, 0 warnings
```

**Phase 08 complete. Proceed to PHASE-09-Deployment.**
