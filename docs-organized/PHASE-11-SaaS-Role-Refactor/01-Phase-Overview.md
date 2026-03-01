# PHASE 11: SaaS Role Refactor — Full Restructure

**Created:** 2026-03-01
**Status:** Pending
**Estimated Duration:** 3 hours across 7 sub-phases
**Depends On:** Phases 00–07 (all complete)

---

## Summary of What This Phase Does

This phase is a structural refactor of all role permissions, navigation, and pages.
It does NOT change the database schema or authentication system.
It changes what each role can see and do in the UI and which API endpoints each role has access to.

**Before this phase:** 5 roles, 45 pages total
**After this phase:** 4 roles, 40 pages total (Customer portal fully removed)

> **Security note (updated 2026-03-01):** Customer removal is implemented as a
> **Silent Deny** — not a redirect, not a 403, not an access-denied page.
> A customer login attempt returns the exact same `401 Invalid credentials`
> response as a wrong password. No outside observer can detect the customer
> role exists. See Sub-Phase 1 for the full implementation.

---

## Before vs After: Page Count by Role

| Role | Before | After | Change |
|---|---|---|---|
| Super Admin | 13 | 10 | -3 pages (admin-management, username-management, profile as standalone) |
| Manager Parent | 14 | 17 | +3 pages (logs, api-status, bios-conflicts added) |
| Manager | 8 | 9 | +1 page (software-management CRUD added) |
| Reseller | 7 | 4 | -3 pages (software, activity, profile removed from nav) |
| Customer | 3 | 0 | -3 pages (entire portal deleted) |
| **Total** | **45** | **40** | **-5 pages** |

---

## Before vs After: Final Page Lists

### Super Admin — 10 Pages

Removed from navigation: `admin-management`, `username-management`, `profile` (profile merged as Settings tab).

| # | Route | Page | Status |
|---|---|---|---|
| 1 | `/super-admin/dashboard` | Dashboard | Keep as-is |
| 2 | `/super-admin/tenants` | Tenants | Enhance creation flow |
| 3 | `/super-admin/users` | All Users | Keep as-is |
| 4 | `/super-admin/bios-blacklist` | BIOS Blacklist | Keep as-is |
| 5 | `/super-admin/bios-history` | BIOS History | Keep as-is |
| 6 | `/super-admin/financial-reports` | Financial Reports | Keep as-is |
| 7 | `/super-admin/reports` | Reports | Keep as-is |
| 8 | `/super-admin/logs` | System Logs | Keep as-is |
| 9 | `/super-admin/api-status` | API Status | Keep as-is |
| 10 | `/super-admin/settings` | Settings (+ Profile tab) | Add Profile tab inside |

**Removed pages:** `admin-management`, `username-management`, `profile` (standalone route deleted).

---

### Manager Parent — 17 Pages

Added 3 new pages: `logs`, `api-status`, `bios-conflicts`.
All other 14 pages remain exactly as implemented.

| # | Route | Page | Status |
|---|---|---|---|
| 1 | `/dashboard` | Dashboard | Keep as-is |
| 2 | `/team-management` | Team Management | Keep as-is |
| 3 | `/reseller-pricing` | Reseller Pricing | Keep as-is |
| 4 | `/software-management` | Software Management | Keep as-is |
| 5 | `/bios-blacklist` | BIOS Blacklist | Keep as-is |
| 6 | `/bios-history` | BIOS History | Keep as-is |
| 7 | `/bios-conflicts` | BIOS Conflicts | **NEW PAGE** |
| 8 | `/ip-analytics` | IP Analytics | Keep as-is |
| 9 | `/username-management` | Username Management | Keep as-is |
| 10 | `/financial-reports` | Financial Reports | Keep as-is |
| 11 | `/reports` | Reports | Keep as-is |
| 12 | `/activity` | Activity | Keep as-is |
| 13 | `/customers` | Customers | Keep as-is |
| 14 | `/settings` | Settings | Keep as-is |
| 15 | `/profile` | Profile | Keep as-is |
| 16 | `/logs` | Tenant Logs | **NEW PAGE** |
| 17 | `/api-status` | Tenant API Status | **NEW PAGE** |

---

### Manager — 9 Pages

Added 1 new page: `software-management` (CRUD). Existing `software` page stays as read-only catalog.

| # | Route | Page | Status |
|---|---|---|---|
| 1 | `/manager/dashboard` | Dashboard | Keep as-is |
| 2 | `/manager/team` | Team (read-only resellers) | Keep as-is |
| 3 | `/manager/username-management` | Username Management | Keep as-is |
| 4 | `/manager/customers` | Customers (read-only) | Keep as-is |
| 5 | `/manager/software` | Software Catalog (read-only) | Keep as-is |
| 6 | `/manager/software-management` | Software Management CRUD | **NEW PAGE** |
| 7 | `/manager/reports` | Reports | Keep as-is |
| 8 | `/manager/activity` | Activity | Keep as-is |
| 9 | `/manager/profile` | Profile | Keep as-is |

---

### Reseller — 4 Pages

Removed 3 pages from navigation and routes: `software`, `activity`, `profile`.
The backend controllers for those are NOT deleted — only the frontend nav and routes are removed.

| # | Route | Page | Status |
|---|---|---|---|
| 1 | `/reseller/dashboard` | Dashboard | Keep as-is |
| 2 | `/reseller/customers` | Customers + BIOS Activation | Keep as-is |
| 3 | `/reseller/licenses` | Licenses | Keep as-is |
| 4 | `/reseller/reports` | Reports | Keep as-is |

**Removed from nav:** `software`, `activity`, `profile` routes are blocked — redirect to `/reseller/dashboard`.

---

### Customer — 0 Pages (Portal Completely Removed)

The customer portal is deleted. If a user with role `customer` logs in, they receive an "Access Denied" response and are redirected to the login page with a message.

---

## Sub-Phase Breakdown

---

### Sub-Phase 1: Customer Portal — Complete Removal + Silent Deny

**Goal:** Remove the customer portal with zero information leakage.
A customer login attempt must be indistinguishable from a wrong-password attempt.
No redirect, no 403, no access-denied page — just the same unified 401 response.

---

#### Security Design: Three Layers

```
Layer 1 — Login (AuthController.php)
  Customer credentials correct → logout immediately → return 401 "Invalid credentials."
  Same 401 message as wrong password → attacker sees NO difference

Layer 2 — Token Guard (NEW ActiveRoleMiddleware.php)
  Any request with a customer Sanctum token → revoke token → return 401 "Invalid credentials."
  Catches any edge case where a customer token was issued before this phase

Layer 3 — Frontend Cleanup
  All customer routes and pages deleted from source
  Customer role removed from constants — login page stays on login with error message
```

---

#### Layer 1 — Modify `backend/app/Http/Controllers/AuthController.php`

The current `login()` method (line 14) checks credentials then status.
Add the customer silent deny between those two checks.

Current code structure:
```php
// Line 20: credential check
if (! $user || ! Hash::check(...)) {
    return response()->json(['message' => 'Invalid credentials.'], 401);
}
// Line 24: status check
if ($user->status !== 'active') { ... }
// Line 28: token creation
$token = $user->createToken('auth-token')->plainTextToken;
```

Add the customer check between lines 22 and 24:
```php
if (! $user || ! Hash::check($request->string('password')->toString(), $user->password)) {
    return response()->json(['message' => 'Invalid credentials.'], Response::HTTP_UNAUTHORIZED);
}

// CUSTOMER SILENT DENY — returns identical response as wrong credentials.
// No trace the customer role exists.
$userRole = $user->role?->value ?? (string) $user->role;
if ($userRole === 'customer') {
    return response()->json(['message' => 'Invalid credentials.'], Response::HTTP_UNAUTHORIZED);
}

if ($user->status !== 'active') {
    return response()->json(['message' => 'User account is not active.'], Response::HTTP_FORBIDDEN);
}

$token = $user->createToken('auth-token')->plainTextToken;
```

**Why this works:**
- `customer@obd2sw.com` + wrong password → 401 (credential check fails)
- `customer@obd2sw.com` + correct password → 401 (silent deny fires)
- Both return HTTP 401 with body `{"message":"Invalid credentials."}`
- Response timing is also similar (both paths hit the DB once)

---

#### Layer 2 — Create `backend/app/Http/Middleware/ActiveRoleMiddleware.php`

New file. Protects every authenticated API call as a safety net.

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ActiveRoleMiddleware
{
    protected array $allowedRoles = [
        'super_admin',
        'manager_parent',
        'manager',
        'reseller',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Not authenticated — let auth middleware handle it, pass through
        if (! $user) {
            return $next($request);
        }

        $role = $user->role?->value ?? (string) $user->role;

        // Role not in the allowed list (e.g. customer with an old token)
        // Revoke token and return SAME message as wrong credentials
        if (! in_array($role, $this->allowedRoles, true)) {
            $request->user()?->currentAccessToken()?->delete();

            return response()->json(
                ['message' => 'Invalid credentials.'],
                Response::HTTP_UNAUTHORIZED
            );
        }

        return $next($request);
    }
}
```

---

#### Layer 2 — Register in `backend/bootstrap/app.php`

This project uses **Laravel 12** — there is no `Kernel.php`.
Middleware is registered in `bootstrap/app.php` via `->withMiddleware()`.

Add `ActiveRoleMiddleware` to the API middleware group so it runs on every API request:

```php
use App\Http\Middleware\ActiveRoleMiddleware;
// ... existing imports

->withMiddleware(function (Middleware $middleware): void {
    // Add to API group — runs on every /api/* route
    $middleware->appendToGroup('api', ActiveRoleMiddleware::class);

    // Existing aliases — keep these unchanged
    $middleware->alias([
        'role'           => RoleMiddleware::class,
        'tenant.scope'   => TenantScope::class,
        'api.logger'     => ApiLogger::class,
        'bios.blacklist' => BiosBlacklistCheck::class,
        'ip.tracker'     => IpTracker::class,
    ]);
})
```

**Note:** `appendToGroup('api', ...)` adds the middleware to the built-in Laravel API
middleware group (`ThrottleRequests`, `SubstituteBindings`). This runs on every
`/api/*` route automatically. The `if (! $user) { return $next($request); }` guard
inside the middleware ensures it passes through on unauthenticated routes like `/api/auth/login`.

---

#### Layer 3 — Comment out customer routes in `backend/routes/api.php`

Do **NOT** delete — comment out. This preserves the code in case it is ever needed.

```php
// ============================================================
// CUSTOMER PORTAL REMOVED — Phase 11 Role Refactor (2026-03-01)
// Silent deny implemented in AuthController + ActiveRoleMiddleware
// Controllers preserved on disk at backend/app/Http/Controllers/Customer/
// ============================================================
// Route::middleware(['auth:sanctum', 'role:customer'])
//     ->prefix('customer')
//     ->group(function () {
//         Route::get('/dashboard', [Customer\DashboardController::class, 'index']);
//         Route::get('/software', [Customer\SoftwareController::class, 'index']);
//         Route::get('/downloads', [Customer\DownloadController::class, 'index']);
//         Route::post('/downloads/{id}/log', [Customer\DownloadController::class, 'log']);
//     });
```

Also comment out (do not remove) any `use App\Http\Controllers\Customer\...;` import
lines at the top of `api.php`.

---

#### Layer 3 — Frontend: Delete customer pages

| File | Action |
|---|---|
| `frontend/src/pages/customer/Dashboard.tsx` | DELETE entire file |
| `frontend/src/pages/customer/Software.tsx` | DELETE entire file |
| `frontend/src/pages/customer/Download.tsx` | DELETE entire file |
| `frontend/src/components/layout/CustomerLayout.tsx` | DELETE entire file |

---

#### Layer 3 — Frontend: Update `frontend/src/router/index.tsx`

Remove these 4 import lines:
```typescript
import { CustomerLayout } from '@/components/layout/CustomerLayout'
import { DashboardPage as CustomerDashboardPage } from '@/pages/customer/Dashboard'
import { DownloadPage as CustomerDownloadPage } from '@/pages/customer/Download'
import { SoftwarePage as CustomerSoftwarePage } from '@/pages/customer/Software'
```

Remove the entire customer route block:
```tsx
<Route element={<RoleGuard allowedRoles={['customer']} />}>
  <Route path="customer" element={<CustomerLayout />}>
    <Route index element={<Navigate to="customer/dashboard" replace />} />
    <Route path="dashboard" element={<CustomerDashboardPage />} />
    <Route path="software" element={<CustomerSoftwarePage />} />
    <Route path="download" element={<CustomerDownloadPage />} />
  </Route>
</Route>
```

**Do NOT add any redirect or access-denied route for customer.**
The customer never gets past the login form — the backend returns 401 before any
token is issued, so the frontend login page just shows the error message and stays put.

---

#### Layer 3 — Frontend: Update `frontend/src/router/routes.ts`

Remove the entire `customer` block:
```typescript
// DELETE this entire block:
customer: {
  root: (lang) => `/${lang}/customer`,
  dashboard: (lang) => `/${lang}/customer/dashboard`,
  software: (lang) => `/${lang}/customer/software`,
  download: (lang) => `/${lang}/customer/download`,
},
```

---

#### Layer 3 — Frontend: Update `frontend/src/lib/constants.ts`

Remove `customer` from `ROLE_DASHBOARD_SEGMENTS` completely.
Do not set it to `'access-denied'` — the backend now handles this silently.

```typescript
// DELETE this entry:
customer: 'customer/dashboard',
```

---

#### Layer 3 — Frontend: Verify `frontend/src/components/layout/Sidebar.tsx`

The customer role never had sidebar items (it used `CustomerLayout`).
Confirm there is no `customerItems` array in this file — no change needed if clean.

---

#### Backend controllers — Keep on disk, do NOT delete

The 4 customer controllers remain in the codebase but are unreachable:
- `backend/app/Http/Controllers/Customer/BaseCustomerController.php` — keep
- `backend/app/Http/Controllers/Customer/DashboardController.php` — keep
- `backend/app/Http/Controllers/Customer/SoftwareController.php` — keep
- `backend/app/Http/Controllers/Customer/DownloadController.php` — keep

Routes are commented out, so these controllers cannot be called.
They are preserved in case business requirements change.

---

#### Security verification after Sub-Phase 1

| Test | Expected Result |
|---|---|
| `customer@obd2sw.com` + **wrong** password | `401 {"message":"Invalid credentials."}` |
| `customer@obd2sw.com` + **correct** password | `401 {"message":"Invalid credentials."}` — identical |
| `reseller1@obd2sw.com` + correct password | `200 {"token":"...","user":{...}}` — normal |
| Old customer Sanctum token sent to any `/api/*` route | `401 {"message":"Invalid credentials."}` + token revoked |
| `php artisan route:list \| grep customer` | Zero results |
| Typing `/ar/customer/dashboard` in browser | 404 (route does not exist in frontend) |

---

### Sub-Phase 2: Manager Parent — Add 3 New Pages

**Goal:** Add `logs`, `api-status`, and `bios-conflicts` pages to Manager Parent.
All three are tenant-scoped versions of similar Super Admin pages.

#### New frontend files to CREATE

**`frontend/src/pages/manager-parent/Logs.tsx`**

- Copy structure from `frontend/src/pages/super-admin/Logs.tsx`
- Change all API calls from `/api/super-admin/logs` to `/api/manager-parent/logs`
- Remove the Tenant filter (Manager Parent only sees their own tenant's logs)
- Keep all other filters: Endpoint, Method, Status code, Date range
- Keep row expand with JSON viewer
- Keep color-coded status (2xx green, 4xx yellow, 5xx red)
- API calls use `useQuery(['manager-parent-logs', filters], ...)`

**`frontend/src/pages/manager-parent/ApiStatus.tsx`**

- Copy structure from `frontend/src/pages/super-admin/ApiStatus.tsx`
- Change all API calls from `/api/super-admin/api-status` to `/api/manager-parent/api-status`
- The data shown is the same external API status (tenant cannot have a different external API)
- This is a read-only view for Manager Parent — remove the "Ping Now" admin button, or keep it read-only
- Keep: status badge, uptime percentages, response time chart

**`frontend/src/pages/manager-parent/BiosConflicts.tsx`**

- NEW page (this page was planned in Phase 3 but never implemented)
- Shows BIOS conflict events for this tenant only
- Table columns: BIOS ID, Conflict Type, Customer 1, Customer 2, Date, Resolution Status, Actions
- Actions: Mark Resolved, View Details
- Filters: Date range, Conflict type, Resolution status
- API endpoint: `GET /api/manager-parent/bios-conflicts`
- API endpoint: `PUT /api/manager-parent/bios-conflicts/{id}/resolve`

#### Routes to ADD in `frontend/src/router/routes.ts`

```typescript
managerParent: {
  // ...existing routes...
  logs: (lang) => `/${lang}/logs`,
  apiStatus: (lang) => `/${lang}/api-status`,
  biosConflicts: (lang) => `/${lang}/bios-conflicts`,
}
```

Note: Manager Parent routes use the bare `/:lang/` prefix (no role prefix).

#### Routes to ADD in `frontend/src/router/index.tsx`

Inside the `RoleGuard allowedRoles={['manager_parent']}` block:
```tsx
<Route path="logs" element={<ManagerParentLogsPage />} />
<Route path="api-status" element={<ManagerParentApiStatusPage />} />
<Route path="bios-conflicts" element={<ManagerParentBiosConflictsPage />} />
```

Add the three new imports at the top of the file.

#### Sidebar to UPDATE in `frontend/src/components/layout/Sidebar.tsx`

Add three items to `managerParentItems` array:
```typescript
{ key: 'biosConflicts', icon: AlertTriangle, href: routePaths.managerParent.biosConflicts, translationKey: 'managerParent.nav.biosConflicts' },
{ key: 'logs', icon: ScrollText, href: routePaths.managerParent.logs, translationKey: 'managerParent.nav.logs' },
{ key: 'apiStatus', icon: Activity, href: routePaths.managerParent.apiStatus, translationKey: 'managerParent.nav.apiStatus' },
```

Import `AlertTriangle` from `lucide-react` (add to existing import line).

#### New backend files to CREATE

**`backend/app/Http/Controllers/ManagerParent/LogController.php`**

```php
namespace App\Http\Controllers\ManagerParent;

class LogController extends BaseManagerParentController
{
    public function index(Request $request)
    // Returns api_logs filtered by tenant_id (from auth user's tenant_id)
    // Params: endpoint, method, status_code_range, date_from, date_to, page
    // Joins with users table to get user info, filters WHERE tenant_id = auth()->user()->tenant_id

    public function show($id)
    // Returns single log entry with full request/response JSON
    // Must verify log belongs to auth user's tenant
}
```

**`backend/app/Http/Controllers/ManagerParent/ApiStatusController.php`**

```php
namespace App\Http\Controllers\ManagerParent;

class ApiStatusController extends BaseManagerParentController
{
    public function index()
    // Returns current external API health status
    // Uses ExternalApiService::getStatus()
    // Returns: status (online/offline/degraded), last_ping, response_time_ms, uptime_24h, uptime_7d

    public function history()
    // Returns response time history for last 24 hours
    // From api_logs table aggregated by hour
}
```

**`backend/app/Http/Controllers/ManagerParent/BiosConflictController.php`**

```php
namespace App\Http\Controllers\ManagerParent;

class BiosConflictController extends BaseManagerParentController
{
    public function index(Request $request)
    // Returns bios_conflicts filtered by tenant_id
    // Params: status (open/resolved), date_from, date_to, page

    public function resolve($id, Request $request)
    // Marks conflict as resolved
    // Validates conflict belongs to auth user's tenant_id
    // Logs action to activity_logs
}
```

#### Backend routes to ADD in `backend/routes/api.php`

Inside the `manager-parent` middleware group:
```php
// Logs (tenant-scoped)
Route::get('/logs', [ManagerParent\LogController::class, 'index']);
Route::get('/logs/{id}', [ManagerParent\LogController::class, 'show']);

// API Status (read-only for manager parent)
Route::get('/api-status', [ManagerParent\ApiStatusController::class, 'index']);
Route::get('/api-status/history', [ManagerParent\ApiStatusController::class, 'history']);

// BIOS Conflicts (tenant-scoped)
Route::get('/bios-conflicts', [ManagerParent\BiosConflictController::class, 'index']);
Route::put('/bios-conflicts/{id}/resolve', [ManagerParent\BiosConflictController::class, 'resolve']);
```

#### Service to UPDATE

**`frontend/src/services/manager-parent.service.ts`**

Add methods:
```typescript
// Logs
getLogs(params: LogFilters): Promise<PaginatedResponse<LogEntry>>
getLogById(id: number): Promise<LogEntry>

// API Status
getApiStatus(): Promise<ApiStatusData>
getApiStatusHistory(): Promise<ApiStatusHistory[]>

// BIOS Conflicts
getBiosConflicts(params: BiosConflictFilters): Promise<PaginatedResponse<BiosConflict>>
resolveBiosConflict(id: number, data: ResolveData): Promise<void>
```

#### i18n keys to ADD

**`frontend/src/locales/en.json`** — add inside `managerParent.nav`:
```json
"biosConflicts": "BIOS Conflicts",
"logs": "Logs",
"apiStatus": "API Status"
```

**`frontend/src/locales/ar.json`** — add inside `managerParent.nav`:
```json
"biosConflicts": "تعارضات BIOS",
"logs": "السجلات",
"apiStatus": "حالة API"
```

---

### Sub-Phase 3: Manager — Add Software Management CRUD Page

**Goal:** Add a new `software-management` page for Manager role with full CRUD and an activation popup.

The existing `frontend/src/pages/manager/Software.tsx` remains — it is the **read-only catalog**.
The new `software-management` page adds **create / edit / delete / toggle active** capabilities.

#### New frontend file to CREATE

**`frontend/src/pages/manager/SoftwareManagement.tsx`**

Structure:
- Copy base layout from `frontend/src/pages/manager-parent/SoftwareManagement.tsx`
- Change API calls to use `/api/manager/software` endpoints
- Program card or table showing: Program Name, Version, Download URL, Trial Days, Price, Active toggle, Actions
- "Add Program" button → Dialog with form:
  - Program Name (required, text input)
  - Download Link URL (required, url input)
  - Trial Days (number input, default 7)
  - Price (number input with currency)
  - Program Icon URL (optional)
  - Active toggle (default: false)
- Edit button on each row → same Dialog pre-filled
- Delete button → ConfirmDialog → DELETE request
- **Active Toggle → Activation Popup:**
  - When manager toggles a program from inactive → active, a Dialog opens:
  - Title: "Register Program"
  - Fields: Customer Username (text input), Customer BIOS ID (text input)
  - Button: "Register Now" → calls POST `/api/manager/software/{id}/activate`
  - On success: shows success toast, closes popup, updates toggle to active
- Uses React Query `useQuery` for list, `useMutation` for create/edit/delete/activate

#### Route to ADD in `frontend/src/router/routes.ts`

```typescript
manager: {
  // ...existing routes...
  softwareManagement: (lang) => `/${lang}/manager/software-management`,
}
```

#### Route to ADD in `frontend/src/router/index.tsx`

Inside the `RoleGuard allowedRoles={['manager']}` block under `/manager`:
```tsx
<Route path="software-management" element={<ManagerSoftwareManagementPage />} />
```

Add import at top:
```typescript
import { SoftwareManagementPage as ManagerSoftwareManagementPage } from '@/pages/manager/SoftwareManagement'
```

#### Sidebar to UPDATE in `frontend/src/components/layout/Sidebar.tsx`

Add to `managerItems` array (after `software`):
```typescript
{ key: 'softwareManagement', icon: PackagePlus, href: routePaths.manager.softwareManagement, translationKey: 'manager.nav.softwareManagement' },
```

Import `PackagePlus` from `lucide-react`.

#### New backend file to CREATE

**`backend/app/Http/Controllers/Manager/SoftwareController.php`**

```php
namespace App\Http\Controllers\Manager;

class SoftwareController extends BaseManagerController
{
    public function index()
    // Returns programs scoped to auth user's tenant_id
    // Manager can see/manage programs within their tenant

    public function store(Request $request)
    // Creates new program record
    // Validates: name (required), download_link (required, url), trial_days, price, icon_url
    // Sets tenant_id = auth()->user()->tenant_id
    // Sets active = false by default

    public function update($id, Request $request)
    // Updates program fields
    // Must verify program belongs to auth user's tenant_id

    public function destroy($id)
    // Soft deletes program
    // Must verify program belongs to auth user's tenant_id

    public function activate($id, Request $request)
    // Activates a program for a given customer
    // Validates: username (required), bios_id (required)
    // Sets program.active = true
    // Calls BiosActivationService to register the program for that customer/BIOS
    // Logs action to activity_logs
}
```

#### Backend routes to ADD in `backend/routes/api.php`

Inside the `manager` middleware group:
```php
// Software Management (CRUD)
Route::get('/software', [Manager\SoftwareController::class, 'index']);
Route::post('/software', [Manager\SoftwareController::class, 'store']);
Route::put('/software/{id}', [Manager\SoftwareController::class, 'update']);
Route::delete('/software/{id}', [Manager\SoftwareController::class, 'destroy']);
Route::post('/software/{id}/activate', [Manager\SoftwareController::class, 'activate']);
```

#### Service to UPDATE

**`frontend/src/services/manager.service.ts`**

Add methods:
```typescript
// Software Management CRUD
getSoftwarePrograms(): Promise<PaginatedResponse<Program>>
createProgram(data: CreateProgramData): Promise<Program>
updateProgram(id: number, data: UpdateProgramData): Promise<Program>
deleteProgram(id: number): Promise<void>
activateProgram(id: number, data: ActivateProgramData): Promise<void>
```

#### i18n keys to ADD

**`frontend/src/locales/en.json`** — add inside `manager.nav`:
```json
"softwareManagement": "Software Management"
```

**`frontend/src/locales/ar.json`** — add inside `manager.nav`:
```json
"softwareManagement": "إدارة البرامج"
```

---

### Sub-Phase 4: Reseller — Restrict to 4 Pages

**Goal:** Remove `software`, `activity`, and `profile` pages from Reseller navigation and block their routes.

The backend controllers for these pages are NOT deleted. Only frontend routes and sidebar nav items are removed.

#### Sidebar to UPDATE in `frontend/src/components/layout/Sidebar.tsx`

In `resellerItems`, remove these three entries:
```typescript
// DELETE these three items:
{ key: 'software', icon: Package, href: routePaths.reseller.software, translationKey: 'reseller.nav.software' },
{ key: 'activity', icon: Activity, href: routePaths.reseller.activity, translationKey: 'reseller.nav.activity' },
{ key: 'profile', icon: User, href: routePaths.reseller.profile, translationKey: 'reseller.nav.profile' },
```

Keep these four:
```typescript
{ key: 'dashboard', ... }
{ key: 'customers', ... }
{ key: 'licenses', ... }
{ key: 'reports', ... }
```

#### Router to UPDATE in `frontend/src/router/index.tsx`

Inside the `RoleGuard allowedRoles={['reseller']}` block, remove these three routes:
```tsx
// DELETE these:
<Route path="software" element={<ResellerSoftwarePage />} />
<Route path="activity" element={<ResellerActivityPage />} />
<Route path="profile" element={<ResellerProfilePage />} />
```

Add a catch-all redirect inside the reseller block so any attempt to access removed pages goes to the dashboard:
```tsx
<Route path="*" element={<Navigate to="dashboard" replace />} />
```

Remove the unused imports from the top of `index.tsx`:
```typescript
// DELETE these imports:
import { ActivityPage as ResellerActivityPage } from '@/pages/reseller/Activity'
import { ProfilePage as ResellerProfilePage } from '@/pages/reseller/Profile'
import { SoftwarePage as ResellerSoftwarePage } from '@/pages/reseller/Software'
```

#### Routes to UPDATE in `frontend/src/router/routes.ts`

Remove the three route definitions from the `reseller` block:
```typescript
// DELETE these:
software: (lang) => `/${lang}/reseller/software`,
activity: (lang) => `/${lang}/reseller/activity`,
profile: (lang) => `/${lang}/reseller/profile`,
```

---

### Sub-Phase 5: Super Admin — Reduce to 10 Pages

**Goal:** Remove `admin-management`, `username-management`, and `profile` (standalone) from Super Admin.
Profile functionality moves into the Settings page as an additional tab.

#### Sidebar to UPDATE in `frontend/src/components/layout/Sidebar.tsx`

In `superAdminItems`, remove these three entries:
```typescript
// DELETE:
{ key: 'adminManagement', icon: UserCog, href: routePaths.superAdmin.adminManagement, ... },
{ key: 'usernameManagement', icon: KeyRound, href: routePaths.superAdmin.usernameManagement, ... },
{ key: 'profile', icon: User, href: routePaths.superAdmin.profile, ... },
```

Remove `UserCog` and `KeyRound` from the Lucide import if they are now unused across all role items (check first).

#### Router to UPDATE in `frontend/src/router/index.tsx`

Inside the `RoleGuard allowedRoles={['super_admin']}` block, remove these routes:
```tsx
// DELETE:
<Route path="admin-management" element={<AdminManagementPage />} />
<Route path="username-management" element={<UsernameManagementPage />} />
<Route path="profile" element={<ProfilePage />} />
```

Remove the unused imports:
```typescript
// DELETE:
import { AdminManagementPage } from '@/pages/super-admin/AdminManagement'
import { UsernameManagementPage } from '@/pages/super-admin/UsernameManagement'
import { ProfilePage } from '@/pages/super-admin/Profile'
```

Add a catch-all redirect inside the super-admin block:
```tsx
<Route path="*" element={<Navigate to="dashboard" replace />} />
```

#### Routes to UPDATE in `frontend/src/router/routes.ts`

Remove the three route definitions from `superAdmin`:
```typescript
// DELETE:
adminManagement: (lang) => `/${lang}/super-admin/admin-management`,
usernameManagement: (lang) => `/${lang}/super-admin/username-management`,
profile: (lang) => `/${lang}/super-admin/profile`,
```

#### Settings page to UPDATE

**`frontend/src/pages/super-admin/Settings.tsx`**

Add a fifth tab: **Profile**
Tabs become: General | API | Notifications | Security | **Profile**

The Profile tab contains:
- Edit name, email, phone fields
- Change password section (current password, new password, confirm)
- Save Profile button and Save Password button

The profile data is loaded from `GET /api/auth/me` (already exists).
Save calls `PUT /api/auth/profile` and `PUT /api/auth/password` (already exist).

#### Tenant Creation Flow to ENHANCE

**`frontend/src/pages/super-admin/Tenants.tsx`**

The "Create New Tenant" modal already exists. Verify and enhance it to include:
- Tenant Name (required)
- Manager Parent Full Name (required)
- Manager Parent Email (required)
- Manager Parent Password (required, auto-generated or manual)
- Submit calls `POST /api/super-admin/tenants` which creates both tenant + manager_parent user in one transaction

**`backend/app/Http/Controllers/SuperAdmin/TenantController.php`**

The `store()` method should wrap in a database transaction:
```php
DB::transaction(function () use ($validated) {
    $tenant = Tenant::create([...]);
    $user = User::create([
        'role' => 'manager_parent',
        'tenant_id' => $tenant->id,
        ...
    ]);
});
```

Verify this is already implemented. If not, update the `store()` method.

---

### Sub-Phase 6: Backend Middleware — Scope Cleanup

**Goal:** Ensure the backend correctly enforces the new role scopes.
No new middleware files need to be created — only verify and adjust existing middleware.

#### Files to VERIFY/UPDATE

**`backend/app/Http/Middleware/RoleMiddleware.php`**

Verify the middleware correctly blocks:
- `customer` role from ALL routes (return 403 with message "Customer portal is disabled")
- `reseller` role from `/api/reseller/software`, `/api/reseller/activity`, `/api/reseller/profile`
- `super_admin` from `/api/super-admin/admin-management`, `/api/super-admin/username-management`, `/api/super-admin/profile` routes (remove these routes entirely from api.php)

**`backend/routes/api.php`**

Remove these route entries from the `super_admin` middleware group:
```php
// DELETE these route registrations:
Route::apiResource('admin-management', AdminManagementController::class);
Route::get('/username-management', [UsernameManagementController::class, 'index']);
Route::post('/username-management/{id}/unlock', [UsernameManagementController::class, 'unlock']);
Route::put('/username-management/{id}/username', [UsernameManagementController::class, 'changeUsername']);
Route::put('/username-management/{id}/password', [UsernameManagementController::class, 'resetPassword']);
```

Note: The controller files `AdminManagementController.php` and `UsernameManagementController.php` are NOT deleted from disk. They are simply not registered as routes. This preserves them in case functionality is needed later.

---

### Sub-Phase 7: Documentation Update

**Goal:** Update the role-permissions reference document to reflect the new structure.

#### Files to UPDATE

**`docs-organized/ROLE-PERMISSIONS-AND-DASHBOARD-PAGES.md`**

Update all page counts and page lists to match the new structure.
Mark Customer section as: "Customer portal removed. Customers with role=customer cannot log in."

**`README.md`**

Update the roles section page counts:
- Super Admin: 13 → 10
- Manager Parent: 14 → 17
- Manager: 8 → 9
- Reseller: 7 → 4
- Customer: 3 → Removed

---

## Code Standards — All New Files Must Follow

All new files created in this phase must follow the same standards as existing phases:

- **Tailwind CSS only** — no inline styles anywhere
- **Dark mode** — every element must use `dark:` variants: `dark:bg-slate-900`, `dark:text-white`, `dark:border-slate-700`
- **RTL support** — use `rtl:` and `ltr:` Tailwind variants for directional spacing and layout
- **TypeScript** — no `any` types; define interfaces for all API response shapes and component props
- **React Query** — use `useQuery` for all data fetching, `useMutation` for all write operations
- **shadcn/ui** — use `Button`, `Dialog`, `Card`, `Badge`, `Input`, `Label`, `Switch` from `@/components/ui/`
- **Mobile-first responsive** — all grids use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- **Loading states** — every page shows `SkeletonCard`, `SkeletonTable`, or `SkeletonChart` while data loads
- **Error states** — every `useQuery` wraps in `try/catch` or checks `isError` and shows `EmptyState` with retry
- **i18n** — all visible strings use `t('namespace.key')` — no hardcoded English or Arabic strings

---

## Acceptance Criteria

- [ ] Customer login redirects to `/:lang/access-denied` with message "Customer portal is not available"
- [ ] Manager Parent sidebar shows exactly 17 items
- [ ] Manager Parent can view tenant-scoped logs at `/logs`
- [ ] Manager Parent can view API status at `/api-status`
- [ ] Manager Parent can view and resolve BIOS conflicts at `/bios-conflicts`
- [ ] Manager sidebar shows exactly 9 items (includes new `software-management`)
- [ ] Manager can create, edit, delete programs at `/manager/software-management`
- [ ] Manager "Activate" popup accepts Username + BIOS ID and submits successfully
- [ ] Reseller sidebar shows exactly 4 items (dashboard, customers, licenses, reports)
- [ ] Reseller navigating to `/reseller/software` or `/reseller/activity` or `/reseller/profile` is redirected to dashboard
- [ ] Super Admin sidebar shows exactly 10 items
- [ ] Super Admin navigating to `/super-admin/admin-management` is redirected to dashboard
- [ ] Super Admin navigating to `/super-admin/username-management` is redirected to dashboard
- [ ] Super Admin Settings page has 5 tabs including Profile
- [ ] Super Admin can create new tenant with manager parent from Tenants page
- [ ] All new pages render without TypeScript errors
- [ ] `npm run build` passes with no errors
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] All 4 test accounts (admin, parent, manager, reseller) can log in and see correct pages
