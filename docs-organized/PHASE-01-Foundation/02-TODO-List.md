# PHASE 01: Foundation - TODO List

**Status:** Complete  
**Updated:** 2026-02-28  

---

## Backend Foundation

### Schema

- [x] Create `tenants` table
- [x] Extend `users` table for multi-tenant roles and username locking
- [x] Create `programs` table
- [x] Create `licenses` table
- [x] Create `api_logs` table
- [x] Create `activity_logs` table
- [x] Create `user_ip_logs` table
- [x] Create `bios_blacklist` table
- [x] Create `bios_conflicts` table
- [x] Create `bios_access_logs` table
- [x] Create `user_balances` table
- [x] Create `financial_reports` table
- [x] Add required indexes
- [x] Run migrations successfully on the local MySQL database

### Models, Trait, Middleware, Services

- [x] Create all Phase 01 Eloquent models
- [x] Create `BelongsToTenant` trait
- [x] Apply tenant trait to scoped models
- [x] Create `RoleMiddleware`
- [x] Create `TenantScope`
- [x] Create `ApiLogger`
- [x] Create `BiosBlacklistCheck`
- [x] Create `IpTracker`
- [x] Create `ExternalApiService`
- [x] Create `IpGeolocationService`
- [x] Create `BiosActivationService`
- [x] Create `BalanceService`

### Controllers and Routes

- [x] Create `AuthController`
- [x] Create `ApiProxyController`
- [x] Create `DashboardController`
- [x] Create `BiosBlacklistController`
- [x] Create `BiosConflictController`
- [x] Create `BalanceController`
- [x] Register middleware aliases in `bootstrap/app.php`
- [x] Define public auth routes
- [x] Define authenticated auth routes
- [x] Define dashboard route
- [x] Define external proxy routes
- [x] Define BIOS blacklist and conflict routes
- [x] Define balance routes

### Seeders and Environment

- [x] Create `SuperAdminSeeder`
- [x] Create `TestDataSeeder`
- [x] Update `DatabaseSeeder`
- [x] Seed admin and sample tenant/program/license data
- [x] Update `.env.example` files for the actual project setup
- [x] Update live local `.env` for the current Laragon setup

---

## Authentication and Access Control

- [x] Login endpoint returns token and user payload
- [x] Logout revokes the current token
- [x] `/api/auth/me` returns authenticated user data
- [x] Auth routes are protected with Sanctum
- [x] Role-based access control works for protected routes
- [x] Tenant scoping works for non-super-admin access

---

## External API Proxy

- [x] External API config exists
- [x] Proxy endpoints are implemented
- [x] External service uses timeout and retry options
- [x] API logger writes external request metadata to `api_logs`
- [x] BIOS blacklist guard blocks disallowed BIOS IDs
- [x] External API service behavior is covered by automated tests

---

## Frontend Foundation

### Shared Setup

- [x] Configure React Query provider
- [x] Configure i18n with `ar` and `en`
- [x] Configure URL-based language routing with `/:lang`
- [x] Create `lib/` utilities
- [x] Create Zustand stores for auth, theme, and sidebar state
- [x] Create shared UI primitives (`Button`, `Card`, `Input`, `Label`, `Toast`)

### Auth and Routing

- [x] Create login page
- [x] Create forgot password page
- [x] Create axios API client with interceptors
- [x] Create auth service methods
- [x] Create auth hook with localStorage persistence
- [x] Create route path constants
- [x] Create `ProtectedRoute`
- [x] Create `GuestRoute`
- [x] Create `RoleGuard`
- [x] Create role-specific dashboard placeholders
- [x] Verify frontend login flow works against `http://license.test/api`

---

## Testing

### Backend

- [x] Valid login test
- [x] Invalid login test
- [x] Authenticated `/auth/me` test
- [x] Unauthenticated `/auth/me` test
- [x] Logout token revocation test
- [x] Super Admin role access test
- [x] Reseller forbidden test
- [x] Customer forbidden test
- [x] Tenant scope filter test
- [x] Super Admin global scope test
- [x] External API request test
- [x] External API failure-handling test
- [x] API logger persistence test
- [x] Seeder verification test
- [x] User role enum cast test

### Frontend

- [x] Login form render test
- [x] Login invalid credentials test
- [x] Auth store localStorage persistence test
- [x] ProtectedRoute redirect test
- [x] RoleGuard redirect test
- [x] Root redirect to `/:lang/login` test

---

## Verified Commands

- [x] `php artisan test`
- [x] `npm run lint`
- [x] `npx tsc --noEmit -p tsconfig.app.json`
- [x] `cd tests-frontend && npx jest --runInBand --no-cache`
- [x] `php artisan migrate --force`
- [x] `php artisan db:seed --force`

---

## Phase Result

- [x] Phase 01 backend foundation is complete
- [x] Phase 01 frontend foundation is complete
- [x] Local login flow is working end-to-end
- [x] Repository is ready for `PHASE-02-SuperAdmin`
