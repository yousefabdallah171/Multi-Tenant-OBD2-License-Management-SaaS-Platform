<div align="center">

# OBD2SW.com

### Multi-Tenant OBD2 License Management SaaS Platform

A production-ready, multi-tenant license management system for OBD2 automotive diagnostic software.
Built with **React 19 + Vite 6 + TypeScript** and **Laravel 12 + MySQL 8.0**,
featuring RBAC with 4 active dashboard roles (customer portal removed), hardware-locked licensing via BIOS ID, RTL Arabic support, and real-time analytics.

[![Version](https://img.shields.io/badge/Version-1.0.0-blue)]()
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Laravel](https://img.shields.io/badge/Laravel-12-FF2D20?logo=laravel)](https://laravel.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql)](https://mysql.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://docker.com)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

</div>

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [User Roles & RBAC](#4-user-roles--rbac)
5. [Dashboard Pages & Key Routes](#5-dashboard-pages--key-routes)
6. [Database Schema (Core Runtime Tables)](#6-database-schema-core-runtime-tables)
7. [External API Integration](#7-external-api-integration)
8. [BIOS Activation Flow](#8-bios-activation-flow)
9. [Frontend Structure & Coding Standards](#9-frontend-structure--coding-standards)
10. [Backend Structure & Middleware](#10-backend-structure--middleware)
11. [Testing Architecture (tests-frontend/)](#11-testing-architecture-tests-frontend)
12. [i18n URL Routing (Arabic/English)](#12-i18n-url-routing-arabicenglish)
13. [Development Phases](#13-development-phases)
14. [Production Deployment](#14-production-deployment)
15. [Environment Variables](#15-environment-variables)
16. [License & Ownership](#16-license--ownership)
17. [Laragon Local Setup Guide](#17-laragon-local-setup-guide)

---

## 1. Project Overview

| Field | Value |
|-------|-------|
| **Version** | 1.0.0 |
| **Status** | Phase 12 UX Editing + seller tracking + pause/resume licensing complete (deployment hardening pending) |
| **Last Updated** | 2026-03-05 |
| **Scale** | Multi-tenant SaaS, 4 active dashboard roles, queued exports, tenant-scoped external API workflows |
| **Budget** | $30 |
| **Timeline** | 15 Days (Day 0 - Day 14) |
| **Domain** | obd2sw.com |
| **Hosting** | Hostinger VPS (Ubuntu 22.04) |

### What It Does

OBD2SW.com is a **multi-tenant SaaS platform** that manages software licenses for OBD2 automotive diagnostic tools. Each license is **hardware-locked to a BIOS ID**, ensuring one device per license. The platform supports:

- **Role hierarchy** with tenant isolation (Super Admin > Manager Parent > Manager > Reseller), with Customer portal removed
- **External API integration** for hardware-locked license activation via `EXTERNAL_API_HOST`
- **BIOS security**: Blacklisting, conflict detection, and full activation history
- **IP Geolocation**: Tracks country, city, ISP, and reputation on every activation
- **Real-time analytics**: Dashboards with Recharts, CSV/PDF export, Pusher notifications
- **Bilingual**: Arabic (RTL) and English (LTR) via URL-based routing (`/:lang/...`)

### Development Progress

| Phase | Status | Days |
|-------|--------|------|
| PHASE-00-Setup | :green_circle: Complete | Day 0 |
| PHASE-01-Foundation | :green_circle: Complete | Day 1-2 |
| PHASE-02-SuperAdmin | :green_circle: Complete | Day 3 |
| PHASE-03-ManagerParent | :green_circle: Complete | Day 4-5 |
| PHASE-04-ManagerReseller | :green_circle: Complete | Day 6 |
| PHASE-05-CustomerPortal | :green_circle: Complete | Day 7 |
| PHASE-06-ReportsAnalytics | :green_circle: Complete | Day 8 |
| PHASE-07-UIUXPolish | :green_circle: Complete | Day 9-10 |
| PHASE-08-Testing | :green_circle: Complete | Day 11 |
| PHASE-09-Deployment | :red_circle: Not Started | Day 12-13 |
| PHASE-10-Documentation | :red_circle: Not Started | Day 14 |

### Latest Implemented Features (2026-03-05)

**Pause/Resume & Reactivate Licensing (New)**
- Added `pause` and `resume` actions for resellers to temporarily pause active licenses
- Paused licenses have status `pending` and disable the software externally via API
- Resume/Reactivate buttons restore access using the `resume` endpoint (reuses external API `activateUser`)
- Added "Reactivate" button for `cancelled` licenses (deactivated licenses can be re-activated)
- Pause/Resume/Reactivate dialogs with full localization (English + Arabic)
- All UI strings moved to `frontend/src/locales/{en,ar}.json` (no more hardcoded JSX strings)
- Action buttons converted to dropdown menu (`...`) for cleaner UX
- Pause/Resume/Reactivate action logging in `bios_access_logs` table

**Backend Changes**
- `LicenseService::pause()` - calls external API `deactivateUser`, sets status='pending'
- `LicenseService::resume()` - calls external API `activateUser`, sets status='active' (works for both pause→resume and cancelled→reactivate)
- Routes: `POST /licenses/{id}/pause` and `POST /licenses/{id}/resume` (reseller + manager + manager_parent)
- Migration: Extended `bios_access_logs.action` ENUM to include `'pause'`, `'resume'`, `'reactivate'`

**Translation Keys Added**
- `common.pause`, `common.resume`, `common.reactivate`
- `common.pauseSuccess`, `common.resumeSuccess`, `common.reactivateSuccess`
- `reseller.pages.customers.pauseDialog` (title + description with biosId interpolation)
- `reseller.pages.licenses.confirm.pauseTitle`, `pauseDescription`
- All keys in both `en.json` and `ar.json`

### Previously Implemented UX Updates (2026-03-03)

- IP Analytics is now software-scoped with a program selector, parsed external timestamps, and tenant/program-aware matching.
- Manager Parent and Manager now have dedicated seller activity pages for activations, renewals, deactivations, and deletions.
- Manager and Manager Parent customer names in licenses/logs now link into customer detail/history views.
- Manager Parent Team Management and Manager Team now expose richer recent-license and recent-activity drill-down panels.
- Manager Parent sidebar now has a collapsible Logs group and seller-log navigation.
- Manager and Manager Parent now have Licenses pages with bulk actions.
- Online users floating widget is live with role-based visibility and Super Admin settings toggle.
- Single and bulk deactivate flows now return clearer, actionable API errors.

### Latest Stability Fixes (2026-03-03)

- License expiry now auto-reconciles to `expired` when duration is over:
  - Scheduled command: `php artisan licenses:expire` (every minute).
  - Request-time fallback added (tenant-throttled) so status still updates even if scheduler is delayed.
- Program edit flow now supports clearing optional fields correctly:
  - `file_size`
  - `system_requirements`
  - `installation_guide_url`
  - `external_logs_endpoint`
- Program edit validation hardened to reduce false `422` errors for optional external API fields.
- Activation/customer flows now accept long external usernames and numeric-looking customer names.
- Manager and Manager Parent direct sales are now attributed consistently across reports, customer history, and seller-log views.

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + Vite 6 + TypeScript | SPA with code splitting & lazy loading |
| **Routing** | React Router v7 | Client-side routing with `/:lang` prefix & role guards |
| **UI** | shadcn/ui + Radix UI + Lucide React | Professional component library |
| **Styling** | Tailwind CSS 3.4 + tailwind-rtl | Utility-first CSS with RTL support |
| **Charts** | Recharts | Dashboard analytics & visualizations (18 charts) |
| **State** | React Query (TanStack Query) | Server state management & caching |
| **Global State** | Zustand stores | Auth, theme, sidebar state |
| **i18n** | i18next + react-i18next | Arabic (RTL) / English via URL routing (`/:lang/...`) |
| **Real-time** | Pusher + Laravel Echo | WebSocket notifications |
| **Backend** | Laravel 12 + PHP 8.2/8.3 | RESTful API + external API proxy |
| **Database** | MySQL 8.0 | Multi-tenant relational data (12 tables) |
| **ORM** | Laravel Eloquent | Query builder with tenant scoping |
| **Auth** | Laravel Sanctum + JWT | Token-based auth with role middleware |
| **PDF** | barryvdh/laravel-dompdf | PDF export for reports |
| **Testing FE** | Jest + React Testing Library | Frontend unit suites active in separate `tests-frontend/` workspace (`341` passing on 2026-03-01) |
| **Testing E2E** | Cypress | 55 end-to-end scenarios (separate `tests-frontend/`) |
| **Testing BE** | PHPUnit | Backend suites active (`112` passing on 2026-03-01: Feature 39 + Unit 73) |
| **Container** | Docker + Docker Compose | Dev & production environments |
| **Server** | Nginx + PHP-FPM + Redis | Production reverse proxy + caching |
| **CI/CD** | GitHub Actions | Automated testing & deployment |
| **Hosting** | Hostinger VPS (Ubuntu 22.04) | Production server |
| **SSL** | Let's Encrypt (Certbot) | HTTPS encryption |
| **IP Geolocation** | ip-api.com batch API | Country, city, ISP, proxy/hosting enrichment |
| **Monitoring** | UptimeRobot | Uptime & health monitoring |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                         │
│  React 19 + Vite + TypeScript + Tailwind + shadcn/ui        │
│  React Router (/:lang + role guards) + React Query + i18next │
│  Zustand (auth/theme stores) + hooks/ (business logic)       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS (Sanctum Token)
                           v
┌─────────────────────────────────────────────────────────────┐
│                   Nginx Reverse Proxy                        │
│                 SSL (Let's Encrypt)                           │
└──────────┬──────────────────────────────────┬───────────────┘
           │                                  │
           v                                  v
┌─────────────────────┐          ┌─────────────────────────┐
│   Laravel 12 API    │          │  Static Frontend Build   │
│   PHP 8.3 + FPM     │          │  (Vite → dist/ ~1.2MB)   │
│                     │          └─────────────────────────┘
│  Middleware Stack:   │
│  ├─ TenantScope     │    ┌──────────────────────────┐
│  ├─ RolePermission  │    │    External API            │
│  ├─ BiosBlacklist   │    │    EXTERNAL_API_HOST            │
│  │   Check          │    │    /apiuseradd (activate)  │
│  ├─ IpTracker       ├───>│    /apideluser (deactivate)│
│  └─ ApiLogger       │    │    /apiusers (list)        │
│                     │    └──────────────────────────┘
│  Pusher Events      │
└──────────┬──────────┘    ┌──────────────────────────┐
           │               │    ip-api.com             │
           │               │    Batch IP geolocation   │
           v               └──────────────────────────┘
    ┌──────────────┐    ┌──────────────┐
    │  MySQL 8.0   │    │    Redis 7   │
    │  12 tables   │    │  Cache +     │
    │  tenant_id   │    │  Sessions +  │
    │  scoping     │    │  Queues      │
    └──────────────┘    └──────────────┘
```

### Request Flow

```
Client Request → Nginx (SSL) → Laravel Middleware Pipeline:
  1. auth:sanctum (verify JWT token)
  2. TenantScope (auto WHERE tenant_id = X)
  3. RolePermission (check role access)
  4. BiosBlacklistCheck (block blacklisted BIOS)
  5. IpTracker (log IP + geolocation)
  6. ApiLogger (log external API calls)
  → Controller → Service → Response
```

---

## 4. User Roles & RBAC

### Hierarchy

```
Super Admin (GLOBAL scope)
│
├── Manager Parent (TENANT scope - Tenant Owner)
│   ├── Manager (TEAM scope - Team Leader)
│   │   └── Reseller (PERSONAL scope - License Activator)
│   └── Reseller (Direct under Parent)
│
└── Customer (SELF scope - End User)
```

> Customer portal is removed in Phase 11. Customers cannot access dashboard pages.

### Permissions Matrix

| Permission / Area | Super Admin | Manager Parent | Manager | Reseller | Customer |
|-----------|:-----------:|:--------------:|:-------:|:--------:|:--------:|
| Scope | Global | Tenant | Team | Personal | Removed |
| Login to dashboard | Yes | Yes | Yes | Yes | No (silent 401) |
| Dashboard page count | 14 | 21 | 11 | 5 | 0 |
| Tenant management | Yes | No | No | No | No |
| Team management | No | Yes | Read-only team scope | No | No |
| Username management | No | Yes | Yes (team scope) | No | No |
| BIOS blacklist/history | Yes | Yes | Partial | No | No |
| BIOS conflicts page | No | Yes | No | No | No |
| Logs + API status pages | Yes | Yes | No | No | No |
| Software management CRUD | No | Yes | Yes | No | No |
| Software catalog + activate modal | No | Yes | Yes | Yes | No |
| Customers + licenses workflow | No | Tenant visibility + detail views | Team visibility + detail views | Yes | No |
| Seller activity tracking | Yes | Yes | Yes | No | No |

### Username & Password Rules

- **Customer BIOS = LOCKED username forever** (set once by Reseller during activation)
- Only Admin/Manager can **unlock + change** from their dashboard within their scope
- All username changes are logged to `activity_logs`
- Password resets are logged to `activity_logs`

### Frontend Permission Hook

```typescript
// src/hooks/useHasPermission.ts
export function useHasPermission(permission: string): boolean {
  const { user } = useAuthStore();
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

// Usage in components:
const canManageUsers = useHasPermission('manage_users');
```

---

## 5. Dashboard Pages & Key Routes

> **i18n URL Routing:** All routes use `/:lang/` prefix (`/ar/...` or `/en/...`). Default language is Arabic. Root `/` redirects to `/ar/`.

### Super Admin (14 pages) - SYSTEM OWNER

| Route | Page | Key Features |
|-------|------|-------------|
| `/:lang/super-admin/dashboard` | Dashboard | 5 stats cards + 3 charts + activity feed |
| `/:lang/super-admin/tenants` | Tenant Management | CRUD + stats per tenant |
| `/:lang/super-admin/users` | All Users | Cross-tenant user table + IP info |
| `/:lang/super-admin/admin-management` | Admin Management | Manage admin-level accounts |
| `/:lang/super-admin/reports` | Reports | Cross-tenant analytics + export |
| `/:lang/super-admin/financial-reports` | Financial Reports | Revenue breakdown all tenants |
| `/:lang/super-admin/bios-blacklist` | BIOS Blacklist | Global BIOS blacklist CRUD |
| `/:lang/super-admin/bios-history` | BIOS History | Full history all tenants |
| `/:lang/super-admin/username-management` | Username Management | Unlock and rename usernames |
| `/:lang/super-admin/security-locks` | Security Locks | Locked-account and blocked-IP review |
| `/:lang/super-admin/logs` | System Logs | All activity + API logs |
| `/:lang/super-admin/api-status` | API Health | External API monitor |
| `/:lang/super-admin/settings` | Settings | System configuration + profile tab |
| `/:lang/super-admin/profile` | Profile | Profile management |

### Manager Parent (21 pages) - TENANT OWNER

| Route | Page | Key Features |
|-------|------|-------------|
| `/:lang/dashboard` | Dashboard | Tenant stats overview |
| `/:lang/team-management` | Team Management | Add Managers/Resellers |
| `/:lang/reseller-pricing` | Reseller Pricing | Pricing tiers & commissions |
| `/:lang/software` | Software | Tenant software catalog |
| `/:lang/licenses` | Licenses | Tenant license management + bulk actions |
| `/:lang/program-logs` | Program Logs | External activation/login events per program |
| `/:lang/software-management` | Software Management | Programs + Download Links CRUD |
| `/:lang/financial-reports` | Financial Reports | Tenant-level revenue |
| `/:lang/bios-blacklist` | BIOS Blacklist | Tenant-level blacklist |
| `/:lang/bios-history` | BIOS History | Tenant activation history |
| `/:lang/bios-conflicts` | BIOS Conflicts | Conflict history + resolution |
| `/:lang/ip-analytics` | IP Analytics | Geolocation analytics |
| `/:lang/logs` | Logs | Tenant API/operation logs |
| `/:lang/reseller-logs` | Reseller Logs | Seller activity + revenue tracking |
| `/:lang/api-status` | API Status | Tenant view for API health |
| `/:lang/username-management` | Username Management | Tenant user credentials |
| `/:lang/reports` | Reports | Tenant revenue & analytics |
| `/:lang/activity` | Activity Log | Tenant-wide audit log |
| `/:lang/customers` | Customers | Aggregated customer view |
| `/:lang/settings` | Settings | Tenant configuration |
| `/:lang/profile` | Profile | Profile management |

Additional workflow/detail routes also exist for program create/edit/activate and customer detail pages.

### Manager (11 pages) - TEAM LEADER

| Route | Page | Key Features |
|-------|------|-------------|
| `/:lang/manager/dashboard` | Dashboard | Personal + team stats |
| `/:lang/manager/team` | Team | Manage resellers only |
| `/:lang/manager/username-management` | Username Management | Team credentials only |
| `/:lang/manager/customers` | Customers | Team customer overview |
| `/:lang/manager/licenses` | Licenses | Team license management + bulk actions |
| `/:lang/manager/software` | Software | Available programs (read-only) |
| `/:lang/manager/software-management` | Software Management | Team-scoped CRUD + activation popup |
| `/:lang/manager/reports` | Reports | Personal/team reports |
| `/:lang/manager/activity` | Activity | Team activity logs |
| `/:lang/manager/reseller-logs` | Reseller Logs | Team seller activity and direct-sale tracking |
| `/:lang/manager/profile` | Profile | Profile management |

Additional workflow/detail routes also exist for customer detail pages and program create/edit/activate flows.

### Reseller (5 pages) - ACTIVATOR

| Route | Page | Key Features |
|-------|------|-------------|
| `/:lang/reseller/dashboard` | Dashboard | Personal stats + balance |
| `/:lang/reseller/customers` | Customers | BIOS activation wizard |
| `/:lang/reseller/licenses` | Licenses | License management |
| `/:lang/reseller/software` | Software Catalog | Read-only list + Activate modal |
| `/:lang/reseller/reports` | Reports | Personal sales reports |
 
> Removed reseller routes: `/:lang/reseller/activity` and `/:lang/reseller/profile` now redirect to dashboard.

> **Reseller restrictions:** NO username/password editing. NO deleting managers.

### Customer (0 pages) - REMOVED

- Customer portal routes/pages are removed from frontend and backend routing.
- Login for `customer` role returns `401 Invalid credentials.` (same response as wrong password).
- Any customer token is revoked by API middleware and returns `401 Invalid credentials.`.

---

## 6. Database Schema (Core Runtime Tables)

> Core runtime tables are documented below. Phase 13 also adds `export_tasks` for queued CSV/PDF generation.

```sql
-- ============================================
-- CORE TABLES (4)
-- ============================================

CREATE TABLE tenants (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) UNIQUE NOT NULL,
    settings        JSON NULL,
    status          ENUM('active','suspended','inactive') DEFAULT 'active',
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL
);

CREATE TABLE users (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT UNSIGNED NULL,
    name            TEXT NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    username        VARCHAR(255) NULL,
    password        VARCHAR(255) NOT NULL,
    role            ENUM('super_admin','manager_parent','manager','reseller','customer') NOT NULL,
    phone           VARCHAR(20) NULL,
    status          ENUM('active','suspended','inactive') DEFAULT 'active',
    username_locked BOOLEAN DEFAULT FALSE,
    created_by      BIGINT UNSIGNED NULL,
    remember_token  VARCHAR(100) NULL,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_users_tenant_id (tenant_id),
    INDEX idx_users_role (role)
);

CREATE TABLE programs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT UNSIGNED NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT NULL,
    version         VARCHAR(50) DEFAULT '1.0',
    download_link   VARCHAR(500) NOT NULL,
    trial_days      INT DEFAULT 0,
    base_price      DECIMAL(10,2) DEFAULT 0.00,
    icon            VARCHAR(255) NULL,
    status          ENUM('active','inactive') DEFAULT 'active',
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE licenses (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT UNSIGNED NOT NULL,
    customer_id     BIGINT UNSIGNED NOT NULL,
    reseller_id     BIGINT UNSIGNED NOT NULL,
    program_id      BIGINT UNSIGNED NOT NULL,
    bios_id         VARCHAR(255) NOT NULL,
    duration_days   INT NOT NULL,
    price           DECIMAL(10,2) NOT NULL,
    activated_at    TIMESTAMP NULL,
    expires_at      TIMESTAMP NOT NULL,
    status          ENUM('active','expired','suspended','pending') DEFAULT 'pending',
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reseller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    INDEX idx_licenses_bios_id (bios_id)
);

-- ============================================
-- LOGGING TABLES (2)
-- ============================================

CREATE TABLE api_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT UNSIGNED NULL,
    user_id         BIGINT UNSIGNED NULL,
    endpoint        VARCHAR(255) NOT NULL,
    method          VARCHAR(10) NOT NULL,
    request_body    JSON NULL,
    response_body   JSON NULL,
    status_code     INT NOT NULL,
    response_time_ms INT NOT NULL,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_api_logs_created_at (created_at)
);

CREATE TABLE activity_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT UNSIGNED NULL,
    user_id         BIGINT UNSIGNED NULL,
    action          VARCHAR(255) NOT NULL,
    description     TEXT NULL,
    metadata        JSON NULL,
    ip_address      VARCHAR(45) NULL,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- BIOS SECURITY TABLES (3)
-- ============================================

CREATE TABLE bios_blacklist (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    bios_id         VARCHAR(255) UNIQUE NOT NULL,
    added_by        BIGINT UNSIGNED NOT NULL,
    reason          TEXT NOT NULL,
    status          ENUM('active','removed') DEFAULT 'active',
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    FOREIGN KEY (added_by) REFERENCES users(id),
    INDEX idx_bios_blacklist_bios_id (bios_id)
);

CREATE TABLE bios_conflicts (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    bios_id         VARCHAR(255) NOT NULL,
    attempted_by    BIGINT UNSIGNED NOT NULL,
    tenant_id       BIGINT UNSIGNED NOT NULL,
    program_id      BIGINT UNSIGNED NULL,
    conflict_type   VARCHAR(100) NOT NULL,
    resolved        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    FOREIGN KEY (attempted_by) REFERENCES users(id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
);

CREATE TABLE bios_access_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    bios_id         VARCHAR(255) NOT NULL,
    user_id         BIGINT UNSIGNED NOT NULL,
    tenant_id       BIGINT UNSIGNED NOT NULL,
    action          ENUM('activate','deactivate','renew','check','blacklist','conflict') NOT NULL,
    ip_address      VARCHAR(45) NULL,
    metadata        JSON NULL,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_bios_access_logs_bios_id (bios_id)
);

-- ============================================
-- IP & FINANCIAL TABLES (3)
-- ============================================

CREATE TABLE user_ip_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED NOT NULL,
    ip_address      VARCHAR(45) NOT NULL,
    country         VARCHAR(100) NULL,
    city            VARCHAR(100) NULL,
    isp             VARCHAR(255) NULL,
    reputation_score ENUM('low','medium','high') DEFAULT 'medium',
    action          VARCHAR(100) NOT NULL,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_ip_logs_ip (ip_address)
);

CREATE TABLE user_balances (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED NOT NULL,
    tenant_id       BIGINT UNSIGNED NOT NULL,
    total_revenue   DECIMAL(12,2) DEFAULT 0.00,
    total_activations INT DEFAULT 0,
    pending_balance DECIMAL(12,2) DEFAULT 0.00,
    last_activity_at TIMESTAMP NULL,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_user_balances_user (user_id)
);

CREATE TABLE financial_reports (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT UNSIGNED NOT NULL,
    report_type     ENUM('daily','weekly','monthly') NOT NULL,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    total_revenue   DECIMAL(12,2) DEFAULT 0.00,
    total_activations INT DEFAULT 0,
    total_renewals  INT DEFAULT 0,
    total_deactivations INT DEFAULT 0,
    metadata        JSON NULL,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_financial_reports_period (tenant_id, period_start, period_end)
);
```

**Total: 12 tables** | tenants, users, programs, licenses, api_logs, activity_logs, bios_blacklist, bios_conflicts, bios_access_logs, user_ip_logs, user_balances, financial_reports

---

## 7. External API Integration

All calls to `EXTERNAL_API_HOST` are proxied through Laravel (API key **never** exposed to frontend).

| # | Method | Full Endpoint | Laravel Proxy Route | Description |
|---|--------|--------------|-------------------|-------------|
| 1 | `POST` | `${EXTERNAL_API_URL}/apiuseradd/{EXTERNAL_API_KEY}/{bios_id}` | `POST /api/licenses/activate` | Activate license for BIOS |
| 2 | `POST` | `${EXTERNAL_API_URL}/apideluser/{EXTERNAL_API_KEY}/{user_id}` | `POST /api/licenses/{id}/deactivate` | Deactivate/remove license |
| 3 | `GET` | `${EXTERNAL_API_URL}/apiusers/{id}` | `GET /api/external/users` | List all external licenses |
| 4 | `GET` | `${EXTERNAL_API_URL}/showallapi/{id}` | `GET /api/external/all` | Get all API data |
| 5 | `GET` | `${EXTERNAL_API_URL}/apilogs/{id}` | `GET /api/external/logs` | Get API logs by ID |
| 6 | `GET` | `${EXTERNAL_API_URL}/getmylogs` | `GET /api/external/my-logs` | Get authenticated user logs |

> **API Key:** from backend `.env` (`EXTERNAL_API_KEY`), never exposed to frontend

### IP Geolocation API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `https://ipapi.co/{ip}/json/` | Returns country, city, ISP, org, latitude, longitude |

> Free tier: 1,000 requests/day. Used on every registration and license activation.

### Proxy Flow

```
React Frontend                   Laravel Backend                  External API
      |                                |                               |
      |  POST /api/licenses/activate   |                               |
      |  { bios_id, program_id }       |                               |
      | -----------------------------> |                               |
      |                                |  1. Validate request            |
      |                                |  2. Check role = reseller+      |
      |                                |  3. BiosBlacklistCheck          |
      |                                |  4. BiosConflictDetect          |
      |                                |  5. IpTracker (geolocation)     |
      |                                |  6. Log to api_logs             |
      |                                |                               |
      |                                |  POST /apiuseradd/KEY/BIOS    |
      |                                | ----------------------------> |
      |                                |                               |
      |                                | <---- { success: true } ----- |
      |                                |                               |
      |                                |  7. Save License to MySQL      |
      |                                |  8. Update user_balances       |
      |                                |  9. Log to bios_access_logs    |
      |                                | 10. Dispatch Pusher event      |
      | <---- { license data } ------- |                               |
```

---

## 8. BIOS Activation Flow

The activation process follows a strict 6-step security pipeline:

```
Step 1: CHECK BLACKLIST
  └─ Query bios_blacklist WHERE bios_id = ? AND status = 'active'
  └─ If found → BLOCK activation (403: "BIOS ID is blacklisted")
  └─ Log to bios_access_logs (action: 'blacklist')

Step 2: CHECK CONFLICTS
  └─ Query licenses WHERE bios_id = ? AND status = 'active'
  └─ If active license exists for different tenant → WARN
  └─ Log to bios_conflicts (conflict_type: 'cross_tenant' | 'duplicate')
  └─ Admin can override, Reseller gets blocked

Step 3: CHECK USERNAME
  └─ If customer.username_locked = true AND customer has existing BIOS
  └─ Username stays LOCKED forever (cannot be changed by anyone except Admin)
  └─ New activation = username is SET to BIOS ID (locked permanently)

Step 4: IP GEOLOCATION
  └─ Call ipapi.co/{ip}/json/
  └─ Log to user_ip_logs: country, city, ISP, reputation_score
  └─ Flag suspicious IPs (reputation: 'high' risk)

Step 5: EXTERNAL API CALL
  └─ POST ${EXTERNAL_API_URL}/apiuseradd/KEY/{bios_id}
  └─ Log request + response to api_logs
  └─ On failure → rollback, return error
  └─ On success → continue

Step 6: UPDATE BALANCE & FINALIZE
  └─ Create license record in MySQL
  └─ Update reseller's user_balances (total_revenue, total_activations)
  └─ Log to bios_access_logs (action: 'activate')
  └─ Log to activity_logs
  └─ Dispatch Pusher event (real-time notification)
  └─ Return success + license data
```

---

## 9. Code Quality & Dark Mode + RTL Standards

### ✅ Styling Rules (CRITICAL - No Inline CSS)

**FORBIDDEN:**
```tsx
// ❌ NEVER use inline styles
<div style={{ color: 'red', padding: '10px' }}>Bad</div>

// ❌ NEVER use hardcoded colors
const bgColor = '#ffffff';
```

**REQUIRED:**
```tsx
// ✅ Use Tailwind classes ONLY
<div className="text-red-600 p-2.5">Good</div>

// ✅ Use cn() utility for conditional classes
import { cn } from '@/lib/utils';
<div className={cn(
  "base classes",
  isDark && "dark:bg-slate-900 dark:text-white",
  isRtl && "rtl:mr-4 ltr:ml-4"
)}>Content</div>
```

**Dark Mode:**
- Use Tailwind's `dark:` prefix for all dark mode classes
- Persist theme in `themeStore` (Zustand)
- Test every page in both light + dark mode

**RTL/LTR:**
- Use `rtl:` and `ltr:` Tailwind prefixes
- Test every page in `/ar/` and `/en/` URLs
- Never hardcode margins/padding directions - use utilities:
  - `ml-4` (left margin) automatically flips in RTL via tailwind-rtl
  - Or explicit: `rtl:mr-4 ltr:ml-4`

### ✅ TypeScript Rules

**File Naming:**
```
// Components
components/Button.tsx          // PascalCase
components/header/Navbar.tsx

// Pages
pages/super-admin/Dashboard.tsx // PascalCase

// Hooks
hooks/useAuth.ts               // camelCase, use prefix
hooks/useLanguage.ts

// Services
services/auth.service.ts       // camelCase.service.ts
services/license.service.ts

// Stores
stores/authStore.ts            // camelCase.ts (Zustand)
stores/themeStore.ts

// Utils
lib/utils.ts                   // camelCase
lib/validators.ts
lib/constants.ts

// Types
types/user.types.ts            // ALWAYS exported interfaces
types/license.types.ts
```

**Type Definitions:**
```tsx
// ✅ ALWAYS define types
interface Props {
  title: string;
  onSubmit: (data: FormData) => Promise<void>;
  isLoading?: boolean;
}

export default function Button({ title, onSubmit, isLoading }: Props) {
  // ...
}

// ✅ ALWAYS export at bottom
export type { Props };
```

**No `any` Type:**
```tsx
// ❌ NEVER
const data: any = response.data;

// ✅ ALWAYS
const data: ILicense[] = response.data;
```

### ✅ Component Structure

Every component must support Dark Mode + RTL:

```tsx
// src/components/shared/Button.tsx
import { cn } from '@/lib/utils';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
  className?: string;
}

export function Button({
  children,
  variant = 'primary',
  isLoading,
  className,
}: ButtonProps) {
  return (
    <button
      className={cn(
        // Base styles
        'px-4 py-2 rounded-lg font-medium transition-colors',
        // Variant colors (light mode)
        variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
        variant === 'secondary' && 'bg-gray-200 text-gray-900 hover:bg-gray-300',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        // Dark mode variants
        'dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600',
        // Disabled state
        isLoading && 'opacity-50 cursor-not-allowed',
        // Custom class override
        className
      )}
      disabled={isLoading}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
}
```

### ✅ Page Component Structure

**EVERY page must have this structure:**

```tsx
// src/pages/super-admin/Dashboard.tsx
'use client';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/shared/StatsCard';
import { useLanguage } from '@/hooks/useLanguage';
import { dashboardService } from '@/services/dashboard.service';
import { cn } from '@/lib/utils';

interface DashboardProps {
  // Define props if component is reusable
}

export default function Dashboard({}: DashboardProps) {
  const { lang, isRtl } = useLanguage();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['super-admin-stats'],
    queryFn: dashboardService.getStats,
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <DashboardLayout>
      {/* Header with RTL-aware spacing */}
      <div className={cn(
        'mb-6',
        isRtl && 'text-right'
      )}>
        <h1 className="text-3xl font-bold dark:text-white">
          {lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
        </h1>
      </div>

      {/* Stats grid - responsive + dark mode */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats?.map((stat) => (
          <StatsCard
            key={stat.id}
            title={stat.label}
            value={stat.value}
            icon={stat.icon}
            trend={stat.trend}
          />
        ))}
      </div>

      {/* Chart section */}
      <div className="mt-8 bg-white dark:bg-slate-800 rounded-lg p-6">
        {/* Charts here */}
      </div>
    </DashboardLayout>
  );
}
```

### ✅ New Page Checklist (MUST COMPLETE FOR EVERY PAGE)

When building a new page, follow this checklist:

```markdown
## Page: [Name]

- [ ] **TypeScript**
  - [ ] Page file: `src/pages/[role]/[PageName].tsx` (PascalCase)
  - [ ] Props interface defined
  - [ ] All exports typed
  - [ ] No `any` types

- [ ] **Dark Mode**
  - [ ] Test in light mode (default)
  - [ ] Test in dark mode (toggle in navbar)
  - [ ] All backgrounds: `dark:bg-slate-900`
  - [ ] All text: `dark:text-white`
  - [ ] All borders: `dark:border-slate-700`
  - [ ] All cards/boxes use `dark:` prefix

- [ ] **RTL/Arabic Support**
  - [ ] Test URL: `/ar/[path]` - should be RTL
  - [ ] Test URL: `/en/[path]` - should be LTR
  - [ ] Margins/padding: use `rtl:` prefix or auto-flip via Tailwind
  - [ ] Text alignment: `rtl:text-right ltr:text-left` if needed
  - [ ] All translations in `locales/ar.json` and `locales/en.json`

- [ ] **Styling**
  - [ ] ✅ Tailwind classes ONLY (no inline styles)
  - [ ] ✅ Use `cn()` for conditional classes
  - [ ] ✅ Responsive: mobile-first (sm: md: lg: xl:)
  - [ ] ✅ No hardcoded colors (use Tailwind palette)

- [ ] **Functionality**
  - [ ] API calls in hooks or services (NOT inline)
  - [ ] React Query for data fetching
  - [ ] Error handling + loading states
  - [ ] Form validation (Zod or custom)
  - [ ] Toast notifications for actions

- [ ] **Accessibility**
  - [ ] ARIA labels on interactive elements
  - [ ] Keyboard navigation works
  - [ ] Focus visible on buttons/inputs
  - [ ] Color contrast > 4.5:1 (WCAG AA)

- [ ] **Testing** (in tests-frontend/)
  - [ ] Component renders without errors
  - [ ] Dark mode toggle works
  - [ ] RTL layout renders correctly
  - [ ] API calls mocked
  - [ ] User interactions work (click, type, submit)
```

### ✅ Tailwind + Dark Mode Color Palette

**Standard colors with dark mode:**
```tsx
// Light backgrounds
'bg-white'           // White background
'bg-gray-50'         // Light gray
'bg-gray-100'        // Slightly darker

// Dark backgrounds
'dark:bg-slate-900'  // Almost black
'dark:bg-slate-800'  // Dark gray
'dark:bg-slate-700'  // Medium-dark

// Text colors
'text-gray-900'      // Dark text (light mode)
'text-gray-600'      // Medium text
'text-white'         // White text (light mode)

'dark:text-white'    // White text (dark mode)
'dark:text-gray-100' // Light gray text (dark mode)

// Borders
'border-gray-200'    // Light border
'dark:border-slate-700' // Dark border
```

**Example card with full dark mode:**
```tsx
<div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-lg p-6 border border-gray-200 dark:border-slate-700">
  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
    Title
  </h2>
  <p className="text-gray-600 dark:text-gray-300 mt-2">
    Description
  </p>
</div>
```

## 9. Frontend Structure & Coding Standards

### Folder Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── DashboardLayout.tsx       # Navbar + Sidebar + <Outlet>
│   │   │   ├── Navbar.tsx                # Logo, nav, lang switcher, theme, profile
│   │   │   ├── Sidebar.tsx               # Collapsible, RTL-aware, role-based items
│   │   │   └── Footer.tsx                # Copyright
│   │   ├── shared/
│   │   │   ├── StatsCard.tsx             # Icon + label + value + trend
│   │   │   ├── DataTable.tsx             # Sort, filter, paginate, search
│   │   │   ├── StatusBadge.tsx           # active/suspended/expired badges
│   │   │   ├── RoleBadge.tsx             # Color-coded role badge
│   │   │   ├── LoadingSpinner.tsx        # Full-page + inline
│   │   │   ├── EmptyState.tsx            # No data placeholder
│   │   │   ├── ConfirmDialog.tsx         # shadcn AlertDialog
│   │   │   ├── ExportButtons.tsx         # CSV/PDF download
│   │   │   └── ErrorBoundary.tsx         # Error catch + retry
│   │   ├── charts/
│   │   │   ├── LineChartWidget.tsx        # Recharts LineChart
│   │   │   ├── BarChartWidget.tsx         # Recharts BarChart
│   │   │   ├── PieChartWidget.tsx         # Recharts PieChart
│   │   │   └── AreaChartWidget.tsx        # Recharts AreaChart
│   │   └── ui/                            # shadcn/ui base (button, card, input...)
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── Login.tsx
│   │   │   └── ForgotPassword.tsx
│   │   ├── super-admin/                   # 13 pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Tenants.tsx
│   │   │   ├── Users.tsx
│   │   │   ├── AdminManagement.tsx
│   │   │   ├── BiosBlacklist.tsx
│   │   │   ├── BiosHistory.tsx
│   │   │   ├── UsernameManagement.tsx
│   │   │   ├── FinancialReports.tsx
│   │   │   ├── Reports.tsx
│   │   │   ├── Logs.tsx
│   │   │   ├── ApiStatus.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── Profile.tsx
│   │   ├── manager-parent/                # manager parent pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── TeamManagement.tsx
│   │   │   ├── SoftwareManagement.tsx
│   │   │   ├── ResellerPricing.tsx
│   │   │   ├── FinancialReports.tsx
│   │   │   ├── BiosBlacklist.tsx
│   │   │   ├── BiosHistory.tsx
│   │   │   ├── BiosConflicts.tsx
│   │   │   ├── IpAnalytics.tsx
│   │   │   ├── UsernameManagement.tsx
│   │   │   ├── Reports.tsx
│   │   │   ├── Activity.tsx
│   │   │   ├── Customers.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── Profile.tsx
│   │   ├── manager/                       # manager pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Team.tsx
│   │   │   ├── UsernameManagement.tsx
│   │   │   ├── Customers.tsx
│   │   │   ├── Software.tsx
│   │   │   ├── Reports.tsx
│   │   │   ├── Activity.tsx
│   │   │   └── Profile.tsx
│   │   ├── reseller/                      # 7 pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Customers.tsx
│   │   │   ├── Software.tsx
│   │   │   ├── Licenses.tsx
│   │   │   ├── Reports.tsx
│   │   │   ├── Activity.tsx
│   │   │   └── Profile.tsx
│   │   └── customer/                      # 3 pages
│   │       ├── Dashboard.tsx
│   │       ├── Software.tsx
│   │       └── Download.tsx
│   ├── hooks/                             # Business logic hooks
│   │   ├── useAuth.ts                     # Login, logout, token management
│   │   ├── useLanguage.ts                 # URL-based i18n (reads /:lang)
│   │   ├── useTheme.ts                    # Dark/light mode toggle
│   │   ├── useRoleGuard.ts                # Role-based access check
│   │   ├── useHasPermission.ts            # Permission check hook
│   │   ├── useLicenses.ts                 # License CRUD operations
│   │   ├── useTenants.ts                  # Tenant CRUD operations
│   │   └── usePagination.ts               # Pagination state helper
│   ├── stores/                            # Zustand global state
│   │   ├── authStore.ts                   # User + token + isAuthenticated
│   │   ├── themeStore.ts                  # Dark/light mode persistence
│   │   └── sidebarStore.ts                # Sidebar collapsed state
│   ├── services/                          # API call layer (Axios)
│   │   ├── api.ts                         # Axios instance + interceptors
│   │   ├── auth.service.ts                # Login, logout, me, forgot-password
│   │   ├── tenant.service.ts              # Tenant CRUD
│   │   ├── user.service.ts                # User management
│   │   ├── license.service.ts             # License operations
│   │   ├── program.service.ts             # Program CRUD
│   │   ├── report.service.ts              # Reports + export
│   │   ├── log.service.ts                 # Log viewer
│   │   ├── bios.service.ts                # BIOS blacklist + history
│   │   ├── balance.service.ts             # Reseller balances
│   │   └── financial.service.ts           # Financial reports
│   ├── lib/                               # Utilities
│   │   ├── utils.ts                       # cn(), formatDate(), formatCurrency()
│   │   ├── constants.ts                   # Routes, roles, status values
│   │   └── validators.ts                  # Email, BIOS ID, required validators
│   ├── router/
│   │   ├── index.tsx                      # Route definitions with /:lang
│   │   ├── guards.tsx                     # ProtectedRoute, RoleGuard, GuestRoute
│   │   └── routes.ts                      # Route path constants
│   ├── types/
│   │   ├── user.types.ts
│   │   ├── tenant.types.ts
│   │   ├── license.types.ts
│   │   ├── program.types.ts
│   │   └── api.types.ts
│   ├── locales/
│   │   ├── ar.json                        # Arabic translations
│   │   └── en.json                        # English translations
│   ├── i18n.ts                            # i18next configuration
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                          # Tailwind directives
├── public/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.example
└── package.json
```

### Coding Standards

| Pattern | Rule | Example |
|---------|------|---------|
| **Business logic** | Always in `hooks/` | `useLicenses()` not inline in components |
| **Global state** | Always in `stores/` (Zustand) | `useAuthStore()`, `useThemeStore()` |
| **API calls** | Always in `services/` | `license.service.ts` not in hooks |
| **Utilities** | Always in `lib/` | `cn()`, `formatDate()`, validators |
| **Components** | Functional + TypeScript props | `interface Props { ... }` |
| **Imports** | Use `@/` alias for `src/` | `import { Button } from '@/components/ui/button'` |
| **Data fetching** | React Query (TanStack Query) | `useQuery()`, `useMutation()` |
| **Forms** | React Hook Form + Zod validation | Schema-based validation |
| **No hardcoded strings** | All text via i18next | `t('superAdmin.dashboard.title')` |
| **No inline styles** | Tailwind classes only | `className="flex items-center gap-2"` |

---

## 10. Backend Structure & Middleware

### Folder Structure

```
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── AuthController.php
│   │   │   ├── ApiProxyController.php
│   │   │   ├── SuperAdmin/
│   │   │   │   ├── DashboardController.php
│   │   │   │   ├── TenantController.php
│   │   │   │   ├── UserController.php
│   │   │   │   ├── AdminManagementController.php
│   │   │   │   ├── BiosBlacklistController.php
│   │   │   │   ├── BiosHistoryController.php
│   │   │   │   ├── UsernameManagementController.php
│   │   │   │   ├── FinancialReportController.php
│   │   │   │   ├── ReportController.php
│   │   │   │   ├── LogController.php
│   │   │   │   ├── ApiStatusController.php
│   │   │   │   └── SettingsController.php
│   │   │   ├── ManagerParent/
│   │   │   │   ├── DashboardController.php
│   │   │   │   ├── TeamController.php
│   │   │   │   ├── ProgramController.php
│   │   │   │   ├── PricingController.php
│   │   │   │   ├── BiosBlacklistController.php
│   │   │   │   ├── BiosHistoryController.php
│   │   │   │   ├── IpAnalyticsController.php
│   │   │   │   ├── UsernameManagementController.php
│   │   │   │   ├── FinancialReportController.php
│   │   │   │   ├── ReportController.php
│   │   │   │   ├── ActivityController.php
│   │   │   │   └── CustomerController.php
│   │   │   ├── Manager/
│   │   │   │   ├── DashboardController.php
│   │   │   │   ├── TeamController.php
│   │   │   │   ├── UsernameManagementController.php
│   │   │   │   ├── CustomerController.php
│   │   │   │   ├── ReportController.php
│   │   │   │   └── ActivityController.php
│   │   │   ├── Reseller/
│   │   │   │   ├── DashboardController.php
│   │   │   │   ├── CustomerController.php
│   │   │   │   ├── LicenseController.php
│   │   │   │   ├── ReportController.php
│   │   │   │   └── ActivityController.php
│   │   │   └── Customer/
│   │   │       ├── DashboardController.php
│   │   │       ├── SoftwareController.php
│   │   │       └── DownloadController.php
│   │   ├── Middleware/
│   │   │   ├── TenantScope.php              # Auto WHERE tenant_id = X
│   │   │   ├── RoleMiddleware.php            # Check role on routes
│   │   │   ├── BiosBlacklistCheck.php        # Block blacklisted BIOS IDs
│   │   │   ├── IpTracker.php                 # Log IP + geolocation
│   │   │   └── ApiLogger.php                 # Log external API calls
│   │   └── Requests/
│   │       ├── LoginRequest.php
│   │       ├── StoreTenantRequest.php
│   │       ├── ActivateLicenseRequest.php
│   │       └── ...
│   ├── Models/
│   │   ├── Tenant.php
│   │   ├── User.php
│   │   ├── Program.php
│   │   ├── License.php
│   │   ├── ApiLog.php
│   │   ├── ActivityLog.php
│   │   ├── BiosBlacklist.php
│   │   ├── BiosConflict.php
│   │   ├── BiosAccessLog.php
│   │   ├── UserIpLog.php
│   │   ├── UserBalance.php
│   │   └── FinancialReport.php
│   ├── Services/
│   │   ├── ExternalApiService.php            # HTTP client for EXTERNAL_API_HOST
│   │   ├── IpGeolocationService.php          # HTTP client for ipapi.co
│   │   ├── BiosActivationService.php         # 6-step activation pipeline
│   │   └── BalanceService.php                # Reseller balance updates
│   └── Traits/
│       └── BelongsToTenant.php               # Auto tenant_id scoping
├── database/
│   ├── migrations/                            # 12 migration files
│   └── seeders/
│       ├── SuperAdminSeeder.php
│       └── TestDataSeeder.php
├── routes/
│   └── api.php                                # role and workflow API routes
├── config/
│   ├── external-api.php
│   └── ip-geolocation.php
├── tests/                                     # PHPUnit (112 tests)
├── Dockerfile
├── .env.example
└── composer.json
```

### Middleware Details

**TenantScope** - Automatically scopes all queries by `tenant_id`:
```php
// For non-super-admin users:
// Every Eloquent query on models using BelongsToTenant trait gets:
// WHERE tenant_id = {authenticated user's tenant_id}
// Super Admin bypasses this scope entirely
```

**BiosBlacklistCheck** - Applied on license activation routes:
```php
// Before activation:
// 1. Check bios_blacklist WHERE bios_id = ? AND status = 'active'
// 2. If found → abort(403, 'BIOS ID is blacklisted')
// 3. Log attempt to bios_access_logs
```

**RoleMiddleware** - Route-level role checking:
```php
// Usage: ->middleware('role:super_admin,manager_parent')
// Checks auth()->user()->role is in allowed roles
// Returns 403 if not authorized
```

---

## 11. Testing Architecture (tests-frontend/)

### Latest Test Matrix (2026-03-01)

| Suite | Result |
|-------|--------|
| Jest Unit/Component | 341 passed, 0 failed |
| Cypress E2E | 55 passed, 0 failed |
| PHPUnit (Feature + Unit) | 112 passed, 0 failed |
| TypeScript | `npx tsc --noEmit` passed |
| Build | `npm run build` passed |
| Lighthouse | Desktop >=95 achieved; mobile baseline ~93 |


> **Tests are in a SEPARATE `tests-frontend/` folder**, not inside `frontend/`. Delete `tests-frontend/` completely before production build.

### Structure

```
obd2sw/
├── frontend/                    # Production code ONLY
│   ├── src/
│   └── vite.config.ts
├── tests-frontend/              # Delete before production build
│   ├── package.json             # Test dependencies only
│   ├── jest.config.ts           # Jest configuration
│   ├── cypress.config.ts        # Cypress configuration
│   ├── tests/                   # 341 Jest tests
│   │   ├── utils/
│   │   │   └── test-utils.tsx   # Custom render with providers
│   │   ├── mocks/
│   │   │   ├── users.ts
│   │   │   ├── tenants.ts
│   │   │   ├── programs.ts
│   │   │   ├── licenses.ts
│   │   │   └── api.ts           # MSW or Axios mock helpers
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
│   │   │   │   └── LoadingSpinner.test.tsx
│   │   │   ├── charts/
│   │   │   │   ├── LineChartWidget.test.tsx
│   │   │   │   ├── BarChartWidget.test.tsx
│   │   │   │   └── PieChartWidget.test.tsx
│   │   │   └── customer/
│   │   │       ├── LicenseCard.test.tsx
│   │   │       └── LicenseProgress.test.tsx
│   │   ├── pages/
│   │   │   ├── auth/Login.test.tsx
│   │   │   ├── super-admin/     # 13 page tests (45 tests)
│   │   │   ├── manager-parent/  # manager parent page tests
│   │   │   ├── manager/         # manager page tests
│   │   │   ├── reseller/        # 7 page tests (12 tests)
│   │   │   └── customer/        # 3 page tests (8 tests)
│   │   ├── hooks/
│   │   │   ├── useAuth.test.ts
│   │   │   ├── useTheme.test.ts
│   │   │   └── useRoleGuard.test.ts
│   │   ├── services/
│   │   │   ├── auth.service.test.ts
│   │   │   ├── license.service.test.ts
│   │   │   └── api.test.ts
│   │   └── utils/
│   │       ├── formatters.test.ts
│   │       └── validators.test.ts
│   ├── cypress/                 # 55 E2E scenarios
│   │   ├── e2e/
│   │   │   ├── auth/
│   │   │   ├── super-admin/
│   │   │   ├── manager-parent/
│   │   │   ├── manager/
│   │   │   ├── reseller/
│   │   │   ├── customer/
│   │   │   ├── responsive/
│   │   │   └── i18n/
│   │   ├── fixtures/
│   │   │   ├── users.json
│   │   │   ├── tenants.json
│   │   │   ├── programs.json
│   │   │   └── licenses.json
│   │   └── support/
│   │       ├── commands.ts
│   │       └── e2e.ts
│   └── coverage-report/         # Generated test coverage
├── backend/
│   └── tests/                   # PHPUnit (75+ tests)
└── docker-compose.yml
```

### Test Commands

```bash
# Run Jest tests (341 tests)
cd tests-frontend
npm run test:unit

# Run Jest with coverage
npm run test:unit -- --coverage

# Run Cypress E2E (55 scenarios)
npm run test:e2e

# Run ALL frontend tests
npm run test:all

# Backend tests (PHPUnit)
cd backend
php artisan test
```

### Production Build (Delete Tests)

```bash
# 1. Run tests (optional - CI/CD handles this)
cd tests-frontend && npm run test:all

# 2. Delete the entire tests folder
rm -rf tests-frontend/

# 3. Build production frontend
cd frontend && npm run build
# Output: frontend/dist/ (~1.2MB gzipped)

# 4. Deploy dist/ to server
```

### Test Counts Summary

| Suite | Tests | Coverage Target |
|-------|-------|----------------|
| Jest (Components) | 90 | 80%+ |
| Jest (Pages) | 110 | 80%+ |
| Jest (Hooks) | 15 | 90%+ |
| Jest (Services) | 15 | 90%+ |
| Jest (Utilities) | 10 | 95%+ |
| **Jest Total** | **341** | **80%+** |
| Cypress E2E | 55 | N/A |
| PHPUnit | 112 | N/A |
| **Grand Total** | **508** | - |

---

## 11.5. Dark Mode Implementation Guide

**Provider Setup (App.tsx):**
```tsx
import { useTheme } from '@/hooks/useTheme';

export function App() {
  const { isDark } = useTheme();

  useEffect(() => {
    // Apply dark class to HTML element
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

**useTheme Hook:**
```tsx
// src/hooks/useTheme.ts
import { useThemeStore } from '@/stores/themeStore';

export function useTheme() {
  const { isDark, toggleTheme } = useThemeStore();

  return {
    isDark,
    toggleTheme,
    themeClass: isDark ? 'dark' : 'light',
  };
}
```

**Navbar Theme Toggle:**
```tsx
// src/components/layout/Navbar.tsx
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export function Navbar() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <nav className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 p-4">
      <button
        onClick={toggleTheme}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
      >
        {isDark ? (
          <Sun className="w-5 h-5 text-yellow-500" />
        ) : (
          <Moon className="w-5 h-5 text-gray-600" />
        )}
      </button>
    </nav>
  );
}
```

## 12. i18n URL Routing (Arabic/English) + Implementation

Language is determined by the **URL prefix**, not localStorage:

```
/ar/super-admin/dashboard    → Arabic (RTL)
/en/super-admin/dashboard    → English (LTR)
/                            → Redirects to /ar/ (default)
```

### useLanguage Hook - Complete Implementation

```typescript
// src/hooks/useLanguage.ts
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import i18n from '../i18n';

export function useLanguage() {
  const { lang } = useParams<{ lang: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const currentLang = lang === 'en' ? 'en' : 'ar';
  const isRtl = currentLang === 'ar';

  useEffect(() => {
    // 1. Change i18next language
    i18n.changeLanguage(currentLang);

    // 2. Apply RTL/LTR to HTML element
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;

    // 3. Save to localStorage (optional, for persistence)
    localStorage.setItem('preferredLanguage', currentLang);
  }, [currentLang, isRtl]);

  const switchLanguage = () => {
    const newLang = currentLang === 'ar' ? 'en' : 'ar';
    const newPath = location.pathname.replace(
      `/${currentLang}/`,
      `/${newLang}/`
    );
    navigate(newPath);
  };

  return {
    lang: currentLang,
    isRtl,
    switchLanguage,
    t: (key: string) => i18n.t(key), // For convenience
  };
}
```

### RTL Implementation in Components

**Sidebar RTL Positioning:**
```tsx
const { isRtl } = useLanguage();

<aside className={cn(
  "fixed top-0 h-full w-64 bg-white dark:bg-slate-800",
  isRtl ? "right-0" : "left-0"
)}>
  {/* Content */}
</aside>
```

**Grid/Flex with RTL (auto-flip):**
```tsx
// Tailwind's tailwind-rtl plugin auto-flips these
<div className="flex gap-4">
  <button className="ml-4">Button</button>  {/* flips in RTL */}
</div>

// Explicit RTL/LTR when needed
<div className={cn(
  "flex gap-4",
  isRtl && "flex-row-reverse"
)}>
```

**Text Alignment:**
```tsx
<div className={cn(
  isRtl && "text-right"  // Arabic text right-aligned
)}>
  {text}
</div>
```

### Router Structure

```tsx
<Routes>
  <Route path="/" element={<Navigate to="/ar" replace />} />
  <Route path="/:lang">
    <Route path="login" element={<GuestRoute><Login /></GuestRoute>} />
    <Route path="super-admin" element={<ProtectedRoute role="super_admin" />}>
      <Route path="dashboard" element={<Dashboard />} />
      {/* ... 13 pages */}
    </Route>
    <Route path="manager" element={<ProtectedRoute role="manager" />}>
      {/* ... 8 pages */}
    </Route>
    {/* ... other roles */}
  </Route>
</Routes>
```

### Rules

- Default language: `ar` (Arabic)
- Root `/` always redirects to `/ar/`
- Language switcher navigates from `/ar/...` to `/en/...` preserving path
- All `<Link>` and `navigate()` calls include `/:lang` prefix
- Shareable URLs: `/en/super-admin/tenants` opens directly in English
- No localStorage for language persistence - URL is the source of truth

---

## 13. Development Phases

| Phase | Days | What | Tests |
|-------|------|------|-------|
| 00 Setup | 0 | Monorepo scaffold + Docker + packages | Smoke checks |
| 01 Foundation | 1-2 | Laravel + Docker + MySQL (12 tables) + Auth + IP Geo + BIOS | 15 unit |
| 02 Super Admin | 3 | 13 pages + Admin Mgmt + BIOS + Username + RTL | 35 component |
| 03 Manager Parent | 4-5 | Tenant dashboards, software, logs, BIOS, pricing, and financial flows | 43 integration |
| 04 Manager+Reseller | 6 | Manager team oversight + reseller activation, customer, and license flows | 25 E2E |
| 05 Customer Portal | 7 | Portal removed (silent deny + route cleanup) | 15 component |
| 06 Reports | 8 | 18 Charts (Recharts) + Export CSV/PDF | 20 unit |
| 07 UI/UX Polish | 9-10 | Animations + Dark/Light + Mobile (41 pages) | 25 responsive |
| 08 Testing | 11 | 341 Jest + 55 Cypress + 112 PHPUnit + build/ts gates | Complete (mobile Lighthouse follow-up) |
| 09 Deployment | 12-13 | VPS + Nginx + SSL + CI/CD + Backups | Smoke tests |
| 10 Documentation | 14 | Swagger (101 endpoints) + Admin Manual | Final QA |

**Total: 15 Days (Day 0-Day 14) | Budget: $30**

### Timeline

```
Week 1:  Foundation → Super Admin → Manager Parent → Manager+Reseller → Customer
         Day 0---1---2---3---4---5---6---7

Week 2:  Reports → UI Polish → Testing → Deployment → Documentation
         Day 8---9--10--11--12--13--14
```

### Documentation Structure

| Folder | Phase | Docs |
|--------|-------|------|
| [`PHASE-00-Setup/`](docs-organized/PHASE-00-Setup/) | Monorepo + Docker + packages | [Overview](docs-organized/PHASE-00-Setup/01-Phase-Overview.md) / [TODO](docs-organized/PHASE-00-Setup/02-TODO-List.md) |
| [`PHASE-01-Foundation/`](docs-organized/PHASE-01-Foundation/) | Laravel + Auth + DB (12 tables) | [Overview](docs-organized/PHASE-01-Foundation/01-Phase-Overview.md) / [TODO](docs-organized/PHASE-01-Foundation/02-TODO-List.md) |
| [`PHASE-02-SuperAdmin/`](docs-organized/PHASE-02-SuperAdmin/) | 13 pages + RBAC + RTL | [Overview](docs-organized/PHASE-02-SuperAdmin/01-Phase-Overview.md) / [TODO](docs-organized/PHASE-02-SuperAdmin/02-TODO-List.md) |
| [`PHASE-03-ManagerParent/`](docs-organized/PHASE-03-ManagerParent/) | Tenant owner dashboards, logs, software, and financial flows | [Overview](docs-organized/PHASE-03-ManagerParent/01-Phase-Overview.md) / [TODO](docs-organized/PHASE-03-ManagerParent/02-TODO-List.md) |
| [`PHASE-04-ManagerReseller/`](docs-organized/PHASE-04-ManagerReseller/) | Manager team oversight + reseller customer/license workflows | [Overview](docs-organized/PHASE-04-ManagerReseller/01-Phase-Overview.md) / [TODO](docs-organized/PHASE-04-ManagerReseller/02-TODO-List.md) / [Checklist](docs-organized/PHASE-04-ManagerReseller/03-Completion-Checklist.md) |
| [`PHASE-05-CustomerPortal/`](docs-organized/PHASE-05-CustomerPortal/) | Portal removed in Phase 11 | [Overview](docs-organized/PHASE-05-CustomerPortal/01-Phase-Overview.md) / [TODO](docs-organized/PHASE-05-CustomerPortal/02-TODO-List.md) |
| [`PHASE-06-ReportsAnalytics/`](docs-organized/PHASE-06-ReportsAnalytics/) | 18 Charts + Export | [Overview](docs-organized/PHASE-06-ReportsAnalytics/01-Phase-Overview.md) / [TODO](docs-organized/PHASE-06-ReportsAnalytics/02-TODO-List.md) |
| [`PHASE-07-UIUXPolish/`](docs-organized/PHASE-07-UIUXPolish/) | Animations + Mobile | [Overview](docs-organized/PHASE-07-UIUXPolish/01-Phase-Overview.md) / [TODO](docs-organized/PHASE-07-UIUXPolish/02-TODO-List.md) |
| [`PHASE-08-Testing/`](docs-organized/PHASE-08-Testing/) | 341 Jest + 55 Cypress + 112 PHPUnit | [Overview](docs-organized/PHASE-08-Testing/01-Phase-Overview.md) / [TODO](docs-organized/PHASE-08-Testing/02-TODO-List.md) |
| [`PHASE-09-Deployment/`](docs-organized/PHASE-09-Deployment/) | VPS + SSL + CI/CD | [Overview](docs-organized/PHASE-09-Deployment/01-Phase-Overview.md) / [TODO](docs-organized/PHASE-09-Deployment/02-TODO-List.md) |
| [`PHASE-10-Documentation/`](docs-organized/PHASE-10-Documentation/) | Swagger + Admin Manual | [Overview](docs-organized/PHASE-10-Documentation/01-Phase-Overview.md) / [TODO](docs-organized/PHASE-10-Documentation/02-TODO-List.md) |

---

## 14. Production Deployment

### Server Stack

```
Ubuntu 22.04 (Hostinger VPS)
├── Nginx 1.24            # Reverse proxy + SSL + static files
├── PHP 8.3-FPM           # Laravel API runtime
├── MySQL 8.0             # Database (12 tables)
├── Redis 7               # Cache + Sessions + Queues
├── Node.js 20            # Frontend build only (rm after build)
├── Certbot               # Let's Encrypt SSL auto-renewal
├── Supervisor             # Queue workers + scheduler
├── UFW                   # Firewall (22, 80, 443 only)
└── Cron                  # Laravel scheduler + daily backups
```

### Production Directory

```
/var/www/obd2sw/
├── backend/               # Laravel application
│   ├── public/
│   ├── storage/
│   └── .env               # Production environment
├── frontend/
│   └── dist/              # Vite production build (static files)
├── backups/               # Daily MySQL backups (30-day retention)
└── logs/                  # Nginx access/error logs
```

> **Note:** `tests-frontend/` does NOT exist in production. It is deleted before build.

### Deployment Steps

```bash
# Build & Deploy
cd frontend && npm ci && npm run build      # ~1.2MB gzipped
cd backend && composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan view:cache
sudo systemctl reload nginx
```

### Scheduler (Required for Auto Expiry)

Add Laravel scheduler to server cron (once):

```bash
* * * * * cd /home/obd2sw-panel/htdocs/panel.obd2sw.com/backend && php artisan schedule:run >> /dev/null 2>&1
```

### CI/CD Pipeline

Push to `master` → GitHub Actions:
1. Run PHPUnit tests
2. Run Jest tests (from `tests-frontend/`)
3. Build frontend (`npm run build`)
4. SSH deploy to VPS
5. Run migrations + clear caches
6. Reload Nginx + restart workers

### .gitignore (Production)

```gitignore
# Tests (separate folder)
tests-frontend/coverage-report/
tests-frontend/cypress/screenshots/
tests-frontend/cypress/videos/
tests-frontend/jest-cache/

# Environment
.env
backend/.env
frontend/.env

# Dependencies
backend/vendor/
frontend/node_modules/
tests-frontend/node_modules/

# Build
frontend/dist/

# Logs
backend/storage/logs/
```

---

## 15. Environment Variables

### Backend (`backend/.env.example`)

```env
APP_NAME=OBD2SW
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=obd2sw
DB_USERNAME=root
DB_PASSWORD=secret

REDIS_HOST=redis
REDIS_PORT=6379

CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis

EXTERNAL_API_URL=${EXTERNAL_API_URL}
EXTERNAL_API_KEY=YOUR_EXTERNAL_API_KEY

IP_GEO_PROVIDER=ipapi
IP_GEO_URL=https://ipapi.co

PUSHER_APP_KEY=your_pusher_key
PUSHER_APP_SECRET=your_pusher_secret

SANCTUM_STATEFUL_DOMAINS=localhost:3000
```

### Frontend (`frontend/.env.example`)

```env
VITE_API_URL=http://localhost:8000/api
VITE_APP_NAME=OBD2SW
VITE_PUSHER_KEY=your_pusher_key
VITE_DEFAULT_LOCALE=ar
```

### Default Credentials (Dev)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@obd2sw.com | set via secure env/secret |
| Manager Parent | parent@obd2sw.com | set via secure env/secret |
| Manager | manager@obd2sw.com | set via secure env/secret |
| Reseller | reseller@obd2sw.com | set via secure env/secret |
| Customer | customer@obd2sw.com | set via secure env/secret |

---

## 16. License & Ownership

| Term | Detail |
|------|--------|
| Source code | 100% owned by client |
| Intellectual property | Full rights transferred |
| Confidentiality | Lifetime NDA on project concept |
| Support | 6 months free post-delivery |
| Hosting | Deployed on Hostinger VPS + domain linked |
| Post-delivery | All developer copies deleted |

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yousef-abdallah/obd2sw.git
cd obd2sw

# Start Docker stack
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker-compose up -d

# Backend setup
docker-compose exec backend php artisan key:generate
docker-compose exec backend php artisan migrate --seed

# Frontend
cd frontend && npm install && npm run dev

# Frontend tests (separate workspace)
cd ../tests-frontend && npm install && npm run test:unit -- --watchAll=false

# Open: http://localhost:3000
# Login: admin@obd2sw.com / password
```

---

## 17. Laragon Local Setup Guide

Use this guide if you want to run the Laravel backend with **Laragon + Apache + MySQL** on Windows and keep the React frontend on the Vite dev server.

### Target Local URLs

- Backend domain: `http://license.test`
- Health check: `http://license.test/api/health`
- Frontend dev server: `http://localhost:3000`

### 1. Move the Project Into Laragon

Place the repository here:

```text
C:\laragon\www\License
```

If Laragon auto virtual hosts are enabled, restarting Laragon should register:

```text
http://license.test
```

### 2. Point Apache to Laravel `public/`

By default, Laragon may point `license.test` to the repository root, which only shows a folder index.  
Change the Apache vhost so `DocumentRoot` points to:

```text
C:/laragon/www/License/backend/public
```

Example Apache vhost:

```apache
<VirtualHost *:80>
    ServerName license.test
    DocumentRoot "C:/laragon/www/License/backend/public"

    <Directory "C:/laragon/www/License/backend/public">
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

Optional during backend-only development:

```apache
RedirectMatch 302 ^/$ /api/health
```

This is useful while the frontend is still being served from Vite on `localhost:3000`.

### 3. Create the Local MySQL Database

Using Laragon MySQL, create this database:

```sql
CREATE DATABASE license CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Default local setup used in this project:

- Host: `127.0.0.1`
- Port: `3306`
- Username: `root`
- Password: empty
- Database: `license`

If port `3306` is already used on your machine (for example by WSL forwarding), use Laragon MySQL on `3307` and update `backend/.env` accordingly.

### 4. Backend Environment

Create `backend/.env` from `backend/.env.example` and use values like these:

```env
APP_NAME=License
APP_ENV=local
APP_DEBUG=true
APP_URL=http://license.test
FRONTEND_URLS=http://license.test,http://localhost:3000,http://127.0.0.1:3000

APP_LOCALE=ar
APP_FALLBACK_LOCALE=en

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=license
DB_USERNAME=root
DB_PASSWORD=

SANCTUM_STATEFUL_DOMAINS=license.test,localhost:3000,127.0.0.1:3000

EXTERNAL_API_URL=${EXTERNAL_API_URL}
EXTERNAL_API_KEY=YOUR_EXTERNAL_API_KEY
EXTERNAL_API_TIMEOUT=10
EXTERNAL_API_RETRIES=3
```

### 5. Backend Setup Commands

Run these from `backend/`:

```powershell
composer install
copy .env.example .env
php artisan key:generate
php artisan jwt:secret
php artisan storage:link
php artisan migrate --seed
php artisan config:clear
php artisan route:list
php artisan test
```

### 6. Frontend Environment

Create `frontend/.env` from `frontend/.env.example`:

```env
VITE_API_URL=http://license.test/api
VITE_PUSHER_KEY=REPLACE_ME
VITE_DEFAULT_LOCALE=ar
```

This value is important.  
If `VITE_API_URL` is wrong, the frontend may try to call `http://localhost:3000/api/...` or `http://127.0.0.1:8000/api/...`, which will fail.

### 7. Frontend and Test Workspace Setup

Run these from the project root:

```powershell
cd frontend
npm install
npm run dev
```

In a second terminal:

```powershell
cd tests-frontend
npm install
npx jest --runInBand --no-cache
```

### 8. Verification Checklist

Backend checks:

- Open `http://license.test/api/health`
- Expected result: JSON response with `status: ok`

Frontend checks:

- Open `http://localhost:3000`
- Sign in with:

```text
admin@obd2sw.com
password
```

Expected result:

- Login succeeds
- Token is stored
- User is redirected to the correct dashboard route

### 9. Common Issues

**Issue: `http://license.test` shows `Index of /`**

Cause:
- Apache is pointing to the repository root instead of `backend/public`

Fix:
- Update the vhost `DocumentRoot` to `C:/laragon/www/License/backend/public`
- Restart Apache or restart Laragon

**Issue: `POST http://localhost:3000/api/auth/login 404`**

Cause:
- Vite is not using the correct `VITE_API_URL`

Fix:
- Set `frontend/.env` to `VITE_API_URL=http://license.test/api`
- Stop and restart `npm run dev`
- Hard refresh the browser

**Issue: `http://license.test/api/auth/login` shows `405 Method Not Allowed` in the browser**

Cause:
- This route is `POST` only, and opening it in the browser sends `GET`

Fix:
- This is expected
- Test it from the login form or with Postman/cURL

**Issue: MySQL connection fails**

Check:

- Laragon MySQL is running
- Database `license` exists
- `backend/.env` uses `127.0.0.1`, `3306`, `root`, empty password

If you see `SQLSTATE[HY000] [1698] Access denied for user 'root'@'localhost'`:
- Confirm what process owns port `3306` (`netstat -ano | findstr 3306`).
- If it is not Laragon MySQL (for example `wslrelay.exe`), switch Laragon MySQL to another port (commonly `3307`), then set `DB_PORT=3307` in `backend/.env`.

### 10. Local Dev Summary

For this project, the current recommended local development split is:

- Laravel backend via Laragon Apache: `http://license.test`
- React frontend via Vite: `http://localhost:3000`
- MySQL via Laragon local server

This setup keeps backend routing, Sanctum, and database access stable while frontend development stays fast with Vite hot reload.

### 11. Extra Troubleshooting (Other Devices + Cypress)

**Issue: Login redirects to `/en/server-error` (or `/ar/server-error`) on other devices but works on this machine**

Why this happens:
- The frontend globally redirects to the server error page when any API call returns `>= 500`.
- On other devices, one of the first dashboard API calls can fail because of host/env mismatch (API URL, vhost routing, or backend runtime error).
- If frontend points to the wrong API host, requests may hit the wrong server and fail.

How to fix:
1. Open browser DevTools on the failing device and inspect the first failing request in Network.
2. Verify frontend API target:
   - `frontend/.env` must include `VITE_API_URL=http://license.test/api` (or your real LAN/API host).
   - Restart Vite after any `.env` change.
3. Verify backend health from that device:
   - Open `http://license.test/api/health` (or your API host) and confirm it returns JSON.
4. Check backend logs for the exact 500 cause:
   - `backend/storage/logs/laravel.log`
5. If using LAN/IP access, make sure your host/vhost and firewall allow that device to reach the backend host.

Note:
- Login 401 handling was hardened so failed `/auth/login` credentials no longer trigger a forced redirect loop.

**Issue: Cypress fails with `Cypress.exe: bad option: --smoke-test`**

Why this happens:
- `ELECTRON_RUN_AS_NODE=1` is set in the shell/user environment.
- This forces Cypress Electron to run as plain Node, so Cypress startup flags fail.

How to fix (PowerShell, current session):
```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npx cypress verify
```

How to fix permanently (Windows):
1. Open System Properties -> Environment Variables.
2. Remove `ELECTRON_RUN_AS_NODE` from User/System variables.
3. Open a new terminal and run:
```powershell
npx cypress verify
npx cypress run --spec "cypress/e2e/auth/*.cy.ts"
```

---

### 12. VPS Deployment Runbook (Hostinger + CloudPanel)

This is the production deployment flow used for `panel.obd2sw.com` on Hostinger VPS with CloudPanel.

### Server Stack

- OS: Ubuntu 24.04 (noble)
- Web server: Nginx (CloudPanel managed)
- PHP: `php8.3-fpm`
- Backend: Laravel (`/home/obd2sw-panel/htdocs/panel.obd2sw.com/backend`)
- Frontend: React/Vite (`/home/obd2sw-panel/htdocs/panel.obd2sw.com/frontend`)

### One-Time Vhost Pattern (CloudPanel)

Use one site root for frontend and route API paths to Laravel public:

- Site root: `/home/obd2sw-panel/htdocs/panel.obd2sw.com`
- Frontend fallback: `try_files $uri $uri/ /index.html;`
- API locations:
  - `/api` -> `backend/public/index.php`
  - `/sanctum` -> `backend/public/index.php`
- PHP location should pass to the correct CloudPanel PHP-FPM port for this site.

### Deployment Steps (Fast Path)

1. Pull latest code on server.
2. Backend install/update:
```bash
cd /home/obd2sw-panel/htdocs/panel.obd2sw.com/backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan db:seed --class=SuperAdminSeeder --force
```
3. Frontend build:
```bash
cd /home/obd2sw-panel/htdocs/panel.obd2sw.com/frontend
npm ci
npm run build
```
4. Laravel writable paths and permissions:
```bash
cd /home/obd2sw-panel/htdocs/panel.obd2sw.com/backend
mkdir -p storage/logs storage/framework/{views,cache/data,sessions} bootstrap/cache
chown -R obd2sw-panel:obd2sw-panel storage bootstrap/cache
find storage bootstrap/cache -type d -exec chmod 775 {} \;
find storage bootstrap/cache -type f -exec chmod 664 {} \;
```
5. Cache and service restart:
```bash
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
systemctl restart php8.3-fpm
systemctl reload nginx
```
6. Health checks:
```bash
curl -sS https://panel.obd2sw.com/api/health
curl -I https://panel.obd2sw.com
```

### Production .env Baseline

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://panel.obd2sw.com`
- `FRONTEND_URL=https://panel.obd2sw.com`
- `LOG_CHANNEL=single` or `stack`
- `SESSION_DRIVER=file` (or your intended production driver)
- `CACHE_STORE=file` (or your intended production store)
- `QUEUE_CONNECTION=database` (or your intended queue driver)

### Real Issues We Faced and Fixes

**Issue: `Class "Laravel\Telescope\TelescopeApplicationServiceProvider" not found` in production**

- Cause: production uses `composer install --no-dev`, so Telescope is not installed, but provider was being loaded.
- Fix: conditionally register `App\Providers\TelescopeServiceProvider` only when Telescope package exists (`backend/bootstrap/providers.php`).

**Issue: local `php artisan migrate` failed with `SQLSTATE[HY000] [1698] Access denied for user 'root'@'localhost'`**

- Cause: local `3306` was owned by WSL relay (`wslrelay.exe`), not Laragon MySQL.
- Fix: run Laragon MySQL on another port (e.g. `3307`) and update `backend/.env` `DB_PORT`.

**Issue: `curl -I https://panel.obd2sw.com` returned `403` and `/api/health` returned `404`**

- Cause: Nginx routing was not correctly sending `/api` to Laravel.
- Fix: Update CloudPanel vhost to route `/api` and `/sanctum` to `backend/public` with `index.php` fallback.

**Issue: TLS error `tlsv1 unrecognized name`**

- Cause: wrong SNI/certificate mapping in Nginx site configuration.
- Fix: correct `server_name` + certificate binding for `panel.obd2sw.com`, then `nginx -t` and reload.

**Issue: Laravel boot failed with `Class "L5Swagger\Generator" not found`**

- Cause: Swagger config loaded in production while package/class unavailable.
- Fix: disable/remove `config/l5-swagger.php` from production deployment.

**Issue: Logging failed with `Log [] is not defined`**

- Cause: invalid `LOG_CHANNEL` value in `.env`.
- Fix: set `LOG_CHANNEL=single` or `LOG_CHANNEL=stack` and rebuild config cache.

**Issue: Redis auth error during artisan cache clear**

- Cause: Redis env mismatch (`AUTH called without password configured`).
- Fix: use correct Redis credentials, or temporarily use file drivers for session/cache in production until Redis is correctly configured.

**Issue: Login API returned 500 with `tempnam(): file created in the system's temporary directory`**

- Cause: PHP-FPM pool user could not write Laravel storage/cache paths.
- Fix:
  - Find pool user/group:
```bash
grep -RniE "^\s*(user|group)\s*=" /etc/php/8.3/fpm/pool.d
```
  - In this deployment, correct pool was:
  - `user = obd2sw-panel`
  - `group = obd2sw-panel`
  - Re-apply ownership/permissions on `storage` and `bootstrap/cache`.

### Post-Deploy Validation (Must Pass)

1. `curl -sS https://panel.obd2sw.com/api/health` returns JSON `status: ok`.
2. Login API returns `200` and token:
```bash
curl -i -X POST https://panel.obd2sw.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@obd2sw.com","password":"password"}'
```
3. Browser login works and dashboard loads without `/server-error` redirect.

### Security Follow-Up After Go-Live

1. Rotate any exposed admin passwords.
2. Revoke/regenerate leaked API tokens.
3. Keep `APP_DEBUG=false` in production.
4. Review `storage/logs/laravel.log` after first live login.

### Quick Redeploy Checklist

1. Pull code.
2. `composer install --no-dev --optimize-autoloader`
3. `php artisan migrate --force`
4. Build frontend `npm ci && npm run build`
5. Fix `storage/bootstrap` ownership to pool user.
6. `php artisan optimize:clear && php artisan config:cache && php artisan route:cache && php artisan view:cache`
7. Restart `php8.3-fpm` and reload `nginx`
8. Run health/login smoke tests.

### Phase 13 Performance Completion Notes

- Dashboard endpoints consolidated for Manager Parent and Manager.
- SQL aggregations replaced N+1/data-heavy loops in dashboard/reporting hotspots.
- React Query global cache defaults are configured in `frontend/src/lib/queryClient.ts`.
- Route-level lazy loading and vendor chunk splitting are active (including `vendor-query`).
- Export flows support queued generation with status polling/download endpoints.
- Added DB performance indexes via migrations:
  - `2026_03_02_120000_add_performance_indexes`
  - `2026_03_02_130000_create_export_tasks_table`
- Telescope is installed for dev/staging and guarded for production-safe boot.

**Author:** Yousef Abdallah | Full Stack Developer | Tanta, Egypt


