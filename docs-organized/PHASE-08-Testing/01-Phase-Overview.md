# PHASE 08: Testing

**Duration:** Day 11
**Status:** Pending
**Tests Target:** 250+ Jest tests + 35 Cypress E2E + Lighthouse 95+
**Depends On:** Phases 01-07 (All features built and polished)

---

## Goals

- Achieve comprehensive test coverage across the entire application
- 250+ Jest unit/component tests
- 35 Cypress E2E scenarios
- Lighthouse performance score 95+
- Cross-browser compatibility testing
- Security testing basics

---

## Test Architecture

> **All frontend tests are in `tests-frontend/`** (separate from `frontend/`). Delete `tests-frontend/` entirely before production build.

```
tests-frontend/tests/
├── components/
│   ├── layout/
│   │   ├── Navbar.test.tsx
│   │   ├── Sidebar.test.tsx
│   │   └── DashboardLayout.test.tsx
│   ├── shared/
│   │   ├── StatsCard.test.tsx
│   │   ├── DataTable.test.tsx
│   │   ├── StatusBadge.test.tsx
│   │   ├── EmptyState.test.tsx
│   │   ├── ErrorBoundary.test.tsx
│   │   └── LoadingSpinner.test.tsx
│   ├── charts/
│   │   ├── LineChartWidget.test.tsx
│   │   ├── BarChartWidget.test.tsx
│   │   └── PieChartWidget.test.tsx
│   └── customer/
│       ├── LicenseCard.test.tsx
│       └── LicenseProgress.test.tsx
├── pages/
│   ├── auth/
│   │   └── Login.test.tsx
│   ├── super-admin/
│   │   ├── Dashboard.test.tsx
│   │   ├── Tenants.test.tsx
│   │   ├── Users.test.tsx
│   │   ├── AdminManagement.test.tsx
│   │   ├── BiosBlacklist.test.tsx
│   │   ├── BiosHistory.test.tsx
│   │   ├── UsernameManagement.test.tsx
│   │   ├── FinancialReports.test.tsx
│   │   ├── Reports.test.tsx
│   │   ├── Logs.test.tsx
│   │   ├── ApiStatus.test.tsx
│   │   ├── Settings.test.tsx
│   │   └── Profile.test.tsx
│   ├── manager-parent/
│   │   ├── Dashboard.test.tsx
│   │   ├── TeamManagement.test.tsx
│   │   ├── SoftwareManagement.test.tsx
│   │   ├── ResellerPricing.test.tsx
│   │   ├── BiosBlacklist.test.tsx
│   │   ├── BiosHistory.test.tsx
│   │   ├── IpAnalytics.test.tsx
│   │   ├── UsernameManagement.test.tsx
│   │   ├── FinancialReports.test.tsx
│   │   ├── Reports.test.tsx
│   │   ├── Activity.test.tsx
│   │   ├── Customers.test.tsx
│   │   └── Settings.test.tsx
│   ├── manager/
│   │   ├── Dashboard.test.tsx
│   │   ├── Team.test.tsx
│   │   ├── UsernameManagement.test.tsx
│   │   ├── Customers.test.tsx
│   │   ├── Reports.test.tsx
│   │   └── Software.test.tsx
│   ├── reseller/
│   │   ├── Dashboard.test.tsx
│   │   ├── Customers.test.tsx
│   │   ├── Licenses.test.tsx
│   │   ├── Reports.test.tsx
│   │   └── Software.test.tsx
│   └── customer/
│       ├── Dashboard.test.tsx
│       ├── Software.test.tsx
│       └── Download.test.tsx
├── hooks/
│   ├── useAuth.test.ts
│   ├── useTheme.test.ts
│   └── useRoleGuard.test.ts
├── services/
│   ├── auth.service.test.ts
│   ├── license.service.test.ts
│   └── api.test.ts
└── utils/
    ├── formatters.test.ts
    └── validators.test.ts

tests-frontend/cypress/
├── e2e/
│   ├── auth/
│   │   ├── login.cy.ts
│   │   └── role-redirect.cy.ts
│   ├── super-admin/
│   │   ├── tenants.cy.ts
│   │   └── dashboard.cy.ts
│   ├── manager-parent/
│   │   ├── software.cy.ts
│   │   └── team.cy.ts
│   ├── reseller/
│   │   ├── activation.cy.ts
│   │   └── licenses.cy.ts
│   ├── customer/
│   │   └── portal.cy.ts
│   ├── responsive/
│   │   └── mobile.cy.ts
│   └── i18n/
│       └── rtl.cy.ts
├── fixtures/
│   ├── users.json
│   ├── tenants.json
│   ├── programs.json
│   └── licenses.json
└── support/
    ├── commands.ts          # Custom commands: cy.login(), cy.apiMock()
    └── e2e.ts
```

---

## Jest Test Categories (250+)

### Component Tests (90)

| Component | Tests | Key Scenarios |
|-----------|-------|---------------|
| Navbar | 8 | Renders links by role, language switcher (URL-based), theme toggle, logout |
| Sidebar | 8 | Active item, collapse/expand, RTL position, mobile overlay |
| DashboardLayout | 5 | Renders children, sidebar + navbar, responsive |
| StatsCard | 5 | Renders props, trend arrow, color variants |
| DataTable | 10 | Columns, pagination, sorting, filtering, search, empty, loading |
| StatusBadge | 5 | Each status color, renders label |
| RoleBadge | 5 | Each role color, renders label |
| EmptyState | 3 | Icon, message, action button |
| ErrorBoundary | 4 | Catches error, shows fallback, retry works |
| Charts (x4) | 12 | Renders with data, loading, empty, responsive |
| LicenseCard | 8 | Status, progress bar, buttons, expired state |
| ConfirmDialog | 3 | Opens, confirm action, cancel action |
| ExportButtons | 4 | CSV click, PDF click, loading states |

### Page Tests (110)

| Page Group | Tests | Key Scenarios |
|------------|-------|---------------|
| Login | 8 | Form render, validation, submit, error, redirect |
| Super Admin (x13) | 45 | Each page renders, data loads, actions work, empty states, BIOS blacklist, username mgmt, financial reports |
| Manager Parent (x12) | 30 | CRUD forms, team invite, software management, BIOS blacklist, IP analytics, username mgmt, financial reports |
| Manager (x8) | 12 | Team view, username management, customer overview, reports |
| Reseller (x7) | 12 | Activation wizard, license actions, read-only views |
| Customer (x3) | 8 | License cards, download buttons, empty state |

### Hook Tests (15)

| Hook | Tests |
|------|-------|
| useAuth | 5: login, logout, token persist, role check, redirect |
| useTheme | 4: toggle, persist, system preference, dark class |
| useRoleGuard | 3: allow, redirect, loading state |
| useLicenses | 3: fetch, create, filter |

### Service Tests (15)

| Service | Tests |
|---------|-------|
| auth.service | 4: login, logout, me, forgot-password |
| license.service | 5: activate, renew, deactivate, getAll, getExpiring |
| api (Axios) | 3: attach token, handle 401, handle network error |
| formatters | 3: date format, currency format, Arabic numbers |

### Utility Tests (10)

| Utility | Tests |
|---------|-------|
| validators | 4: email, BIOS ID, required, min length |
| formatters | 3: dates, numbers, currency |
| constants | 3: routes exist, roles defined, status values |

---

## Cypress E2E Scenarios (35)

### Authentication (5)

1. Super Admin login -> redirect to /super-admin/dashboard
2. Manager Parent login -> redirect to /dashboard
3. Reseller login -> redirect to /dashboard
4. Customer login -> redirect to /customer/dashboard
5. Invalid login -> error message displayed

### Role Boundaries (3)

6. Reseller cannot access /super-admin/* (redirect to own dashboard)
7. Customer cannot access /dashboard (redirect to /customer/dashboard)
8. Unauthenticated user redirected to /login

### License Activation (5)

9. Open Add Customer dialog on /customers
10. Complete Step 1: Customer Info
11. Complete Step 2: BIOS ID + Program
12. Complete Step 3: Duration + Price
13. Submit activation -> success toast + customer in table

### License Management (4)

14. Renew license -> new expiry date
15. Deactivate license -> status changes to suspended
16. Filter licenses by Active status
17. Expiry warnings shown for expiring licenses

### Software Management (3)

18. Manager Parent adds new program with download link
19. Manager Parent edits program details
20. Manager Parent deletes program (confirm dialog)

### Team Management (3)

21. Invite new Manager (form submit)
22. Invite new Reseller (form submit)
23. Suspend team member -> status changes

### Customer Portal (3)

24. Customer dashboard shows license cards
25. Download button works (active license)
26. Download button disabled (expired license)

### Manager Dashboard (3)

27. Manager login -> separate /manager/dashboard
28. Manager username management: unlock username
29. Manager cannot access reseller-only routes

### BIOS & Username Management (3)

30. Super Admin adds BIOS to blacklist
31. Super Admin unlocks user's username
32. Manager Parent views BIOS history for tenant

### UI/UX (6)

33. RTL via URL: visiting `/ar/...` applies RTL layout, `/en/...` applies LTR
34. Dark mode toggle: switch -> background changes
35. Mobile: hamburger menu opens sidebar

### Cross-Browser (3 - manual)

36. Chrome: full workflow
37. Firefox: full workflow
38. Safari/Edge: full workflow

---

## Performance Targets (Lighthouse)

| Metric | Target | How to Achieve |
|--------|--------|---------------|
| Performance | 95+ | Code splitting, lazy imports, optimized images |
| Accessibility | 90+ | ARIA labels, focus management, contrast |
| Best Practices | 95+ | HTTPS, no console errors, secure headers |
| SEO | 90+ | Meta tags, semantic HTML |
| FCP | < 1.2s | Critical CSS inline, font preload |
| LCP | < 2.5s | Lazy load below-fold, image optimization |
| TTI | < 3.0s | Code splitting, minimal main bundle |
| CLS | < 0.1 | Fixed dimensions, no layout shift |

### Code Splitting

```tsx
// Lazy load each role's pages
const SuperAdminDashboard = lazy(() => import('./pages/super-admin/Dashboard'));
const ManagerDashboard = lazy(() => import('./pages/manager-parent/Dashboard'));
const ResellerDashboard = lazy(() => import('./pages/manager-reseller/Dashboard'));
const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard'));
```

---

## Backend Tests (PHPUnit)

### Existing from Phase 01: 15 tests
### New tests for Phases 02-06:

| Category | Count | Scenarios |
|----------|-------|-----------|
| Tenant CRUD | 8 | Create, read, update, delete, list, stats, unauthorized |
| User management | 6 | Create by role, status update, role filter, tenant scoping |
| Program CRUD | 6 | Create, update, delete, list, stats, tenant scoping |
| License activation | 8 | Activate, renew, deactivate, API mock, error handling, duplicate |
| Reports | 5 | Revenue query, export CSV, export PDF, date range filter |
| Activity logs | 3 | Log creation, filter, tenant scoping |
| API proxy | 4 | External call mock, error handling, logging |
| BIOS blacklist | 5 | Add, remove, check middleware, import, tenant scoping |
| BIOS history | 3 | Timeline query, conflict detection, cross-tenant (super admin) |
| Username management | 6 | Unlock, change, reset password, scope validation, logging |
| IP analytics | 3 | Geolocation logging, country stats, reputation scoring |
| Financial reports | 4 | Revenue aggregation, reseller balances, CSV/PDF export |

**Total backend: ~75 tests**

---

## Acceptance Criteria

- [ ] 250+ Jest tests passing with 0 failures (in `tests-frontend/`)
- [ ] Test coverage report generated (`cd tests-frontend && npm run test:unit -- --coverage`)
- [ ] 35 Cypress E2E scenarios passing (in `tests-frontend/`)
- [ ] Lighthouse Performance >= 95
- [ ] Lighthouse Accessibility >= 90
- [ ] No console errors or warnings in any page
- [ ] Backend: 75+ PHPUnit tests passing
- [ ] Cross-browser tested: Chrome, Firefox, Edge
- [ ] All API error scenarios handled gracefully
