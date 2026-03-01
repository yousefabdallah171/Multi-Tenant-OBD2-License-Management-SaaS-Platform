# PHASE 08: Testing — Full SaaS Coverage

**Duration:** Day 11–12
**Status:** Completed on 2026-03-01 (with mobile Lighthouse optimization follow-up)
**Tests Target:** 341 Jest tests · 55 Cypress E2E · 112 PHPUnit · Lighthouse desktop 95+
**Depends On:** Phases 01–07 + Phase 11 SaaS Role Refactor (all features built)

---

## What Changed in Phase 11 (impacts testing)

| Area | Change | Test Impact |
|------|---------|-------------|
| Customer Portal | **Deleted entirely** | Remove all `customer/` test files |
| Forgot Password | **Deleted** — route returns 404 | Remove forgotPassword tests, add 404 assertion |
| Login Page | Production layout — no debug artifacts | Rewrite Login tests |
| Login Security | Progressive lockout (5→10 attempts), `LoginSecurityService` | 20+ new tests |
| SecurityLocks | Super Admin 11th page — 3 tabs (Locked, Blocked IPs, Audit Log) | New page test file |
| ExternalApiService | Rewritten — GET URL segments, plain text response | Mock external server in all tests |
| Per-program API keys | `programs.external_api_key_encrypted` + `has_external_api` | Program model tests |
| Duration as float | `duration_days` float — `expires_at = addMinutes(round(d * 1440))` | LicenseService tests |
| GeoIP | `GeoIpService` — ip-api.com lookup with cache | New service tests |
| Suspicious login email | `SuspiciousLoginMail` queued on new-IP login | Mail test + queue test |
| Rate limit headers | `X-RateLimit-Remaining`, `Retry-After` on login responses | Response header tests |
| Reseller Software page | 5th page — ActivateLicenseModal | New page + component test |
| ProgramLogs page | Manager Parent 18th page — external logs enriched | New page test |
| CustomerDetail page | Clickable username → full detail page | New page test |
| IP Analytics | External logs (not internal Laravel) — country flags | Updated page test |
| API Status | Real external server (`EXTERNAL_API_HOST`) — Ping Now | Updated page test |
| Add/Edit Program | Full page (not modal) — URL placeholder hints | Updated page test |
| BIOS ID + username | Subtext pattern on all BIOS columns | Updated component snapshots |
| Silent Deny | Customer login returns same 401 as wrong password | Auth boundary test |

---

## Test Architecture

> **All frontend tests live in `tests-frontend/`** — separate from `frontend/` production code.

```
tests-frontend/
├── tests/
│   ├── unit/
│   │   ├── auth/
│   │   │   ├── Login.test.tsx            ← lockout UI, no forgot-password
│   │   │   └── LockoutBanner.test.tsx    ← NEW
│   │   ├── super-admin/
│   │   │   ├── Dashboard.test.tsx
│   │   │   ├── SecurityLocks.test.tsx    ← NEW (11th page)
│   │   │   ├── BiosBlacklist.test.tsx
│   │   │   ├── BiosHistory.test.tsx
│   │   │   ├── FinancialReports.test.tsx
│   │   │   ├── Reports.test.tsx
│   │   │   └── ApiStatus.test.tsx        ← updated (real external server)
│   │   ├── manager-parent/
│   │   │   ├── Dashboard.test.tsx
│   │   │   ├── SoftwareManagement.test.tsx ← updated (full-page form)
│   │   │   ├── ProgramLogs.test.tsx      ← NEW
│   │   │   ├── CustomerDetail.test.tsx   ← NEW
│   │   │   ├── IpAnalytics.test.tsx      ← updated (external logs)
│   │   │   ├── BiosBlacklist.test.tsx
│   │   │   ├── BiosHistory.test.tsx
│   │   │   ├── FinancialReports.test.tsx
│   │   │   └── Reports.test.tsx
│   │   ├── manager/
│   │   │   ├── Dashboard.test.tsx
│   │   │   ├── Team.test.tsx
│   │   │   ├── Software.test.tsx
│   │   │   └── Reports.test.tsx
│   │   ├── reseller/
│   │   │   ├── Dashboard.test.tsx
│   │   │   ├── Customers.test.tsx
│   │   │   ├── Licenses.test.tsx
│   │   │   ├── Software.test.tsx         ← NEW (5th page + ActivateLicenseModal)
│   │   │   └── Reports.test.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.test.tsx
│   │   │   │   ├── Sidebar.test.tsx
│   │   │   │   └── DashboardLayout.test.tsx
│   │   │   ├── shared/
│   │   │   │   ├── StatsCard.test.tsx
│   │   │   │   ├── DataTable.test.tsx
│   │   │   │   ├── StatusBadge.test.tsx
│   │   │   │   ├── EmptyState.test.tsx
│   │   │   │   ├── ErrorBoundary.test.tsx
│   │   │   │   └── ExportButtons.test.tsx
│   │   │   ├── charts/
│   │   │   │   ├── LineChartWidget.test.tsx
│   │   │   │   ├── BarChartWidget.test.tsx
│   │   │   │   └── PieChartWidget.test.tsx
│   │   │   └── auth/
│   │   │       ├── DurationPicker.test.tsx     ← NEW
│   │   │       └── ActivateLicenseModal.test.tsx ← NEW
│   │   ├── services/
│   │   │   ├── auth.service.test.ts
│   │   │   ├── license.service.test.ts
│   │   │   ├── security.service.test.ts  ← NEW
│   │   │   ├── report.service.test.ts
│   │   │   └── api.test.ts
│   │   └── utils/
│   │       ├── formatters.test.ts
│   │       ├── validators.test.ts
│   │       └── geoip.test.ts             ← NEW (getFlag, parseUserAgent)
│   └── backend/                          ← PHPUnit unit tests (not Laravel Feature tests)
│       ├── LoginSecurityServiceTest.php  ← NEW
│       ├── ExternalApiServiceTest.php    ← NEW
│       ├── LicenseServiceTest.php        ← updated (float duration)
│       ├── GeoIpServiceTest.php          ← NEW
│       └── ProgramModelTest.php          ← NEW (encrypted API key)
│
├── cypress/
│   ├── e2e/
│   │   ├── auth/
│   │   │   ├── login.cy.ts               ← updated (lockout flow)
│   │   │   ├── login-lockout.cy.ts       ← NEW
│   │   │   └── role-redirect.cy.ts       ← updated (no customer portal)
│   │   ├── super-admin/
│   │   │   ├── dashboard.cy.ts
│   │   │   └── security-locks.cy.ts      ← NEW
│   │   ├── manager-parent/
│   │   │   ├── software.cy.ts            ← updated (full-page form)
│   │   │   ├── program-logs.cy.ts        ← NEW
│   │   │   └── team.cy.ts
│   │   ├── manager/
│   │   │   └── dashboard.cy.ts
│   │   ├── reseller/
│   │   │   ├── activation.cy.ts          ← updated (external API mock)
│   │   │   ├── licenses.cy.ts
│   │   │   └── software.cy.ts            ← NEW
│   │   ├── responsive/
│   │   │   └── mobile.cy.ts
│   │   └── i18n/
│   │       └── rtl.cy.ts
│   ├── fixtures/
│   │   ├── users.json
│   │   ├── programs.json
│   │   ├── licenses.json
│   │   ├── security-locks.json           ← NEW
│   │   └── external-api.json             ← NEW (mock external server responses)
│   └── support/
│       ├── commands.ts                   ← cy.login(), cy.mockExternalApi()
│       └── e2e.ts
│
└── backend/
    └── Feature/                          ← Laravel Feature tests
        ├── Auth/
        │   ├── LoginTest.php
        │   └── LoginSecurityTest.php     ← NEW
        ├── SuperAdmin/
        │   ├── SecurityControllerTest.php ← NEW
        │   └── DashboardControllerTest.php
        ├── ManagerParent/
        │   ├── ProgramControllerTest.php
        │   └── ProgramLogsControllerTest.php ← NEW
        ├── Manager/
        │   └── SoftwareControllerTest.php
        ├── Reseller/
        │   └── LicenseControllerTest.php
        └── External/
            ├── ExternalApiServiceTest.php ← NEW
            └── GeoIpServiceTest.php       ← NEW
```

---

## Test Counts Summary

| Category | Count | Notes |
|----------|-------|-------|
| Jest Component Tests | 110 | Layout, Shared, Charts, Auth components |
| Jest Page Tests | 155 | All roles (no customer portal) |
| Jest Hook Tests | 20 | useAuth, useTheme, useRoleGuard, useLicenses |
| Jest Service Tests | 25 | auth, license, security, report, api |
| Jest Utility Tests | 10 | formatters, validators, geoip |
| **Total Jest** | **341** | |
| Cypress E2E | 55 | auth, lockout, roles, activation, security |
| PHPUnit Feature | 39 | feature/API coverage across auth, security, manager, reseller flows |
| PHPUnit Unit | 73 | service, model, and utility unit coverage |
| **Total Backend** | **112** | |

---

## Security Test Requirements (New in Phase 11)

| Scenario | Type | Expected Result |
|----------|------|-----------------|
| Customer logs in → | PHPUnit | `401 {"message":"Invalid credentials."}` — identical to wrong password |
| Wrong password 1–4 times → | PHPUnit + Cypress | `401` with `X-RateLimit-Remaining: 4, 3, 2, 1` |
| Wrong password 5th time → | PHPUnit + Cypress | `429` with `locked: true`, `seconds_remaining: 60` |
| Wrong password 10th time → | PHPUnit | `429` with `reason: ip_blocked`, `unlocks_at: null` |
| Correct password → | PHPUnit | `200`, `clearAttempts()` resets counter |
| Super Admin unblocks IP → | PHPUnit + Cypress | IP removed from cache, login works again |
| New IP login → | PHPUnit | `SuspiciousLoginMail` queued |
| Known IP login → | PHPUnit | No email queued |
| Rate limit headers → | PHPUnit | `X-RateLimit-Remaining` in response headers |

---

## External API Test Requirements (New in Phase 11)

| Scenario | Type | Expected Result |
|----------|------|-----------------|
| `activateUser($key, $user, $bios)` → | Unit | Calls `GET /apiuseradd/{key}/{user}/{bios}` |
| External returns "True" → | Unit | `['success' => true]` |
| External returns "False" → | Unit | `['success' => false]` |
| External timeout → | Unit | `['success' => false, 'error' => 'timeout']` |
| Duplicate BIOS activation → | Feature | `422` with "An active license already exists" |
| Blacklisted BIOS → | Feature | `422` with "This BIOS ID is blacklisted" |
| Program has no API key → | Feature | `422` with "Program not configured for external activation" |
| Duration 0.021 days (30 min) → | Unit | `expires_at = now() + 30 minutes` |

---

## Performance Targets (Lighthouse)

| Metric | Target |
|--------|--------|
| Performance | 95+ |
| Accessibility | 90+ |
| Best Practices | 95+ |
| SEO | 90+ |
| FCP | < 1.2s |
| LCP | < 2.5s |
| TTI | < 3.0s |
| CLS | < 0.1 |

---

## Acceptance Criteria

- [x] 320+ Jest tests passing, 0 failures, coverage > 80% (actual: 341)
- [x] 55 Cypress E2E scenarios passing, 0 failures
- [x] 110+ PHPUnit tests passing, 0 failures (actual: 112)
- [x] No customer portal routes accessible (return 404 or redirect)
- [x] `/ar/forgot-password` returns 404
- [x] Login lockout confirmed: 5 wrong attempts → 429
- [ ] Lighthouse Performance >= 95 (desktop passed, mobile follow-up pending)
- [x] Lighthouse Accessibility >= 90
- [x] No console errors or warnings on any page
- [ ] Cross-browser tested: Chrome, Firefox, Edge (full matrix pending manual run)
- [x] `npx tsc --noEmit` — zero TypeScript errors
- [x] `npm run build` — passes

**Phase 08 complete → Proceed to PHASE-09-Deployment.**

