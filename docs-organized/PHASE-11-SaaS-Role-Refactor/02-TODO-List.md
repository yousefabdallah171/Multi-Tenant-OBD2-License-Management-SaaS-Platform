# PHASE 11: SaaS Role Refactor — TODO List

**Created:** 2026-03-01
**Status:** Pending
**Duration:** ~3 hours total

> Check each item as you complete it.
> After every sub-phase, run `npm run dev` and test all 4 accounts (admin, parent, manager, reseller).

---

## Sub-Phase 1: Customer Portal — Complete Removal + Silent Deny (25 minutes)

> Security approach: Customer login returns IDENTICAL response to wrong password.
> No redirect. No access-denied page. No trace the customer role exists.
> Three layers: Login controller → Global middleware → Frontend deletion.

---

### LAYER 1 — Backend: Silent Deny at Login

### 1.1 Edit `backend/app/Http/Controllers/AuthController.php`

- [ ] Open the file — find the `login()` method (line 14)
- [ ] Locate the credential check block (currently around line 18–22):
  ```php
  if (! $user || ! Hash::check(...)) {
      return response()->json(['message' => 'Invalid credentials.'], ...);
  }
  ```
- [ ] Immediately AFTER that block and BEFORE the `$user->status` check, add:
  ```php
  // CUSTOMER SILENT DENY
  // Returns identical 401 as wrong password — no trace of customer role
  $userRole = $user->role?->value ?? (string) $user->role;
  if ($userRole === 'customer') {
      return response()->json(['message' => 'Invalid credentials.'], Response::HTTP_UNAUTHORIZED);
  }
  ```
- [ ] Do NOT touch anything else in this file — preserve status check, token creation, all other methods

---

### LAYER 2 — Backend: Global Role Guard Middleware

### 1.2 Create `backend/app/Http/Middleware/ActiveRoleMiddleware.php` (NEW FILE)

- [ ] Create new file at the path above
- [ ] Namespace: `App\Http\Middleware`
- [ ] Define `protected array $allowedRoles = ['super_admin', 'manager_parent', 'manager', 'reseller']`
- [ ] In `handle()`: if `$request->user()` is null → call `$next($request)` (let auth handle it)
- [ ] Get role: `$role = $user->role?->value ?? (string) $user->role`
- [ ] If role NOT in `$allowedRoles`:
  - Call `$request->user()?->currentAccessToken()?->delete()` to revoke the token
  - Return `response()->json(['message' => 'Invalid credentials.'], Response::HTTP_UNAUTHORIZED)`
- [ ] If role IS in `$allowedRoles`: call `$next($request)` normally

### 1.3 Register in `backend/bootstrap/app.php`

- [ ] Open `backend/bootstrap/app.php`
- [ ] Add `use App\Http\Middleware\ActiveRoleMiddleware;` at the top with other imports
- [ ] Inside `->withMiddleware(function (Middleware $middleware): void { ... })`, add BEFORE the `$middleware->alias([...])` call:
  ```php
  $middleware->appendToGroup('api', ActiveRoleMiddleware::class);
  ```
- [ ] Do NOT remove any existing aliases — they must all stay

---

### LAYER 3 — Backend: Comment Out Customer Routes

### 1.4 Edit `backend/routes/api.php`

- [ ] Find the customer route group (search for `prefix('customer')` or `role:customer`)
- [ ] Wrap the ENTIRE group in a block comment — do NOT delete it:
  ```php
  // CUSTOMER PORTAL REMOVED — Phase 11 (2026-03-01)
  // Routes commented out. Controllers preserved on disk.
  // Route::middleware(['auth:sanctum', 'role:customer'])
  //     ->prefix('customer')
  //     ->group(function () {
  //         Route::get('/dashboard', ...);
  //         Route::get('/software', ...);
  //         Route::get('/downloads', ...);
  //         Route::post('/downloads/{id}/log', ...);
  //     });
  ```
- [ ] Find any `use App\Http\Controllers\Customer\...;` lines at the top of `api.php`
- [ ] Comment them out (do NOT delete):
  ```php
  // use App\Http\Controllers\Customer\DashboardController;
  // use App\Http\Controllers\Customer\SoftwareController;
  // use App\Http\Controllers\Customer\DownloadController;
  ```
- [ ] Run `php artisan route:list | grep customer` — must return zero results

### 1.5 Customer backend controllers — DO NOT DELETE

- [ ] Confirm `backend/app/Http/Controllers/Customer/BaseCustomerController.php` is still on disk
- [ ] Confirm `backend/app/Http/Controllers/Customer/DashboardController.php` is still on disk
- [ ] Confirm `backend/app/Http/Controllers/Customer/SoftwareController.php` is still on disk
- [ ] Confirm `backend/app/Http/Controllers/Customer/DownloadController.php` is still on disk
- [ ] Do nothing to these files — routes are commented out so they are unreachable

---

### LAYER 3 — Frontend: Delete Customer Pages

### 1.6 Delete customer frontend files

- [ ] Delete `frontend/src/pages/customer/Dashboard.tsx`
- [ ] Delete `frontend/src/pages/customer/Software.tsx`
- [ ] Delete `frontend/src/pages/customer/Download.tsx`
- [ ] Delete `frontend/src/components/layout/CustomerLayout.tsx`

### 1.7 Edit `frontend/src/router/index.tsx`

- [ ] Remove import line: `import { CustomerLayout } from '@/components/layout/CustomerLayout'`
- [ ] Remove import line: `import { DashboardPage as CustomerDashboardPage } from '@/pages/customer/Dashboard'`
- [ ] Remove import line: `import { DownloadPage as CustomerDownloadPage } from '@/pages/customer/Download'`
- [ ] Remove import line: `import { SoftwarePage as CustomerSoftwarePage } from '@/pages/customer/Software'`
- [ ] Remove the entire customer `<RoleGuard allowedRoles={['customer']}>` block and ALL child `<Route>` elements inside it
- [ ] Do NOT add any new redirect or access-denied route for customer — the backend handles it silently before a token is issued

### 1.8 Edit `frontend/src/router/routes.ts`

- [ ] Remove the entire `customer` object block:
  ```typescript
  customer: {
    root: ...,
    dashboard: ...,
    software: ...,
    download: ...,
  },
  ```

### 1.9 Edit `frontend/src/lib/constants.ts`

- [ ] Find `ROLE_DASHBOARD_SEGMENTS` (or similar constant mapping roles to dashboard paths)
- [ ] Remove the `customer` entry completely — do NOT replace it with `'access-denied'`
- [ ] Reason: the backend now blocks customer at login with a 401 before any frontend redirect happens

### 1.10 Verify `frontend/src/components/layout/Sidebar.tsx`

- [ ] Open the file — confirm there is NO `customerItems` array defined
- [ ] Confirm the `items` selector at the bottom does NOT reference `'customer'` role
- [ ] If clean, no changes needed — leave file untouched

---

### CRITICAL SECURITY VERIFICATION TESTS

### 1.11 Backend security tests

- [ ] Run `php artisan route:list | grep customer` → must return **zero lines**
- [ ] Run `php artisan test` → all existing tests must still pass

### 1.12 Manual login security tests (MOST IMPORTANT)

- [ ] Open the login page
- [ ] Test: `customer@obd2sw.com` + **wrong password** → error message shown on login form (401)
- [ ] Test: `customer@obd2sw.com` + **correct password** (`password`) → **exact same error message** shown on login form (401)
- [ ] Both responses must look identical to the user — no different wording, no redirect, no page change
- [ ] Test: `reseller1@obd2sw.com` + correct password → logs in successfully, 4-page sidebar visible
- [ ] Test: `manager@obd2sw.com` + correct password → logs in successfully, 9-page sidebar visible
- [ ] Test: `parent@obd2sw.com` + correct password → logs in successfully, 17-page sidebar visible
- [ ] Test: `admin@obd2sw.com` + correct password → logs in successfully, 10-page sidebar visible

### 1.13 Frontend build tests

- [ ] Run `npx tsc --noEmit` — must pass with zero TypeScript errors
- [ ] Run `npm run build` — must complete with no missing module errors
- [ ] Run `npm run dev` — console must show no import errors for removed customer files

### 1.14 URL access test

- [ ] Type `/ar/customer/dashboard` in browser → must show 404 (route no longer exists in frontend)
- [ ] Type `/ar/customer/software` in browser → must show 404
- [ ] No `/ar/access-denied` redirect for customer — the login page stays put with error message

---

## Sub-Phase 2: Manager Parent — Add 3 New Pages (30 minutes)

### 2.1 Create `frontend/src/pages/manager-parent/Logs.tsx`

- [ ] Create the file (copy structure from `frontend/src/pages/super-admin/Logs.tsx`)
- [ ] Change all API base URLs from `/api/super-admin/logs` to `/api/manager-parent/logs`
- [ ] Remove the "Tenant" filter column and filter dropdown (manager parent only sees own tenant)
- [ ] Keep filters: Endpoint, Method (GET/POST/PUT/DELETE), Status Code range, Date range
- [ ] Keep row expand to show full JSON request/response
- [ ] Keep color-coding: 2xx = green, 4xx = yellow, 5xx = red
- [ ] All strings use `t('managerParent.logs.*')` translation keys (no hardcoded text)
- [ ] Use `SkeletonTable` while loading, `EmptyState` when no logs

### 2.2 Create `frontend/src/pages/manager-parent/ApiStatus.tsx`

- [ ] Create the file (copy structure from `frontend/src/pages/super-admin/ApiStatus.tsx`)
- [ ] Change all API base URLs from `/api/super-admin/api-status` to `/api/manager-parent/api-status`
- [ ] Keep status indicator (Online/Offline/Degraded badge)
- [ ] Keep uptime % for 24h, 7d, 30d
- [ ] Keep response time chart (line chart, last 24 hours)
- [ ] Remove or disable the "Ping Now" button (read-only for Manager Parent)
- [ ] All strings use `t('managerParent.apiStatus.*')` keys

### 2.3 Create `frontend/src/pages/manager-parent/BiosConflicts.tsx`

- [ ] Create the file as a new page (no existing page to copy — build from scratch)
- [ ] DataTable with columns: BIOS ID, Conflict Type, Affected Customers, Date Detected, Resolution Status, Actions
- [ ] Conflict types: `duplicate_activation`, `bios_mismatch`, `multi_tenant_conflict`
- [ ] Resolution status badges: `open` (red), `resolved` (green), `pending` (yellow)
- [ ] Row actions dropdown: View Details, Mark as Resolved
- [ ] "Mark as Resolved" opens ConfirmDialog with resolution notes textarea
- [ ] Filters: Date range picker, Conflict Type dropdown, Resolution Status tabs (All / Open / Resolved)
- [ ] Pagination (default 15 per page)
- [ ] Loading: `SkeletonTable`, Empty: `EmptyState` with message "No BIOS conflicts found"
- [ ] All strings use `t('managerParent.biosConflicts.*')` keys

### 2.4 Update `frontend/src/router/routes.ts`

- [ ] Add to the `managerParent` block:
  ```typescript
  biosConflicts: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/bios-conflicts`,
  logs: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/logs`,
  apiStatus: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/api-status`,
  ```

### 2.5 Update `frontend/src/router/index.tsx`

- [ ] Add three new imports at the top:
  ```typescript
  import { BiosConflictsPage as ManagerParentBiosConflictsPage } from '@/pages/manager-parent/BiosConflicts'
  import { LogsPage as ManagerParentLogsPage } from '@/pages/manager-parent/Logs'
  import { ApiStatusPage as ManagerParentApiStatusPage } from '@/pages/manager-parent/ApiStatus'
  ```
- [ ] Inside the `RoleGuard allowedRoles={['manager_parent']}` block, add three new routes:
  ```tsx
  <Route path="bios-conflicts" element={<ManagerParentBiosConflictsPage />} />
  <Route path="logs" element={<ManagerParentLogsPage />} />
  <Route path="api-status" element={<ManagerParentApiStatusPage />} />
  ```

### 2.6 Update `frontend/src/components/layout/Sidebar.tsx`

- [ ] Add `AlertTriangle` to the Lucide import line at the top
- [ ] Add three items to `managerParentItems` array (after biosHistory entry):
  ```typescript
  { key: 'biosConflicts', icon: AlertTriangle, href: routePaths.managerParent.biosConflicts, translationKey: 'managerParent.nav.biosConflicts' },
  { key: 'logs', icon: ScrollText, href: routePaths.managerParent.logs, translationKey: 'managerParent.nav.logs' },
  { key: 'apiStatus', icon: Activity, href: routePaths.managerParent.apiStatus, translationKey: 'managerParent.nav.apiStatus' },
  ```

### 2.7 Create `backend/app/Http/Controllers/ManagerParent/LogController.php`

- [ ] Create the file with namespace `App\Http\Controllers\ManagerParent`
- [ ] Extend `BaseManagerParentController`
- [ ] Method `index(Request $request)`:
  - Query `ApiLog` (or `api_logs` table) where `tenant_id = auth()->user()->tenant_id`
  - Filter by: `endpoint` (LIKE), `method`, `status_code` range, `created_at` date range
  - Paginate (15 per page default)
  - Return JSON: `{ data: [...], meta: { current_page, last_page, total } }`
- [ ] Method `show($id)`:
  - Find `ApiLog` by ID
  - Verify `tenant_id` matches auth user's tenant — abort 403 if not
  - Return full record including `request_body` and `response_body` JSON fields

### 2.8 Create `backend/app/Http/Controllers/ManagerParent/ApiStatusController.php`

- [ ] Create the file with namespace `App\Http\Controllers\ManagerParent`
- [ ] Extend `BaseManagerParentController`
- [ ] Method `index()`:
  - Call `ExternalApiService::getStatus()` (or read from cached `api_logs` last entry)
  - Return: `{ status: 'online'|'offline'|'degraded', last_ping: timestamp, response_time_ms: int, uptime_24h: float, uptime_7d: float }`
- [ ] Method `history()`:
  - Query `api_logs` grouped by hour for last 24 hours
  - Return array of `{ hour: string, avg_response_time: int, success_rate: float }`

### 2.9 Create `backend/app/Http/Controllers/ManagerParent/BiosConflictController.php`

- [ ] Create the file with namespace `App\Http\Controllers\ManagerParent`
- [ ] Extend `BaseManagerParentController`
- [ ] Method `index(Request $request)`:
  - Query `bios_conflicts` where `tenant_id = auth()->user()->tenant_id`
  - Filter by: `status` (open/resolved), `conflict_type`, date range
  - Paginate, return JSON
- [ ] Method `resolve($id, Request $request)`:
  - Validate: `resolution_notes` (required string)
  - Find conflict, verify `tenant_id` matches auth user — abort 403 if not
  - Update `status = 'resolved'`, `resolved_at = now()`, `resolution_notes = $request->resolution_notes`
  - Log to `activity_logs`: action `bios_conflict_resolved`
  - Return updated conflict

### 2.10 Update `backend/routes/api.php`

- [ ] Add `use App\Http\Controllers\ManagerParent\LogController;` (or use inline namespace)
- [ ] Add `use App\Http\Controllers\ManagerParent\ApiStatusController;`
- [ ] Add `use App\Http\Controllers\ManagerParent\BiosConflictController;`
- [ ] Inside the manager-parent middleware group, add:
  ```php
  Route::get('/logs', [LogController::class, 'index']);
  Route::get('/logs/{id}', [LogController::class, 'show']);
  Route::get('/api-status', [ApiStatusController::class, 'index']);
  Route::get('/api-status/history', [ApiStatusController::class, 'history']);
  Route::get('/bios-conflicts', [BiosConflictController::class, 'index']);
  Route::put('/bios-conflicts/{id}/resolve', [BiosConflictController::class, 'resolve']);
  ```

### 2.11 Update `frontend/src/services/manager-parent.service.ts`

- [ ] Add type imports: `LogEntry`, `LogFilters`, `ApiStatusData`, `ApiStatusHistory`, `BiosConflict`, `BiosConflictFilters`
- [ ] Add method `getLogs(params: LogFilters): Promise<PaginatedResponse<LogEntry>>`
  - GET `/api/manager-parent/logs` with query params
- [ ] Add method `getLogById(id: number): Promise<LogEntry>`
  - GET `/api/manager-parent/logs/${id}`
- [ ] Add method `getApiStatus(): Promise<ApiStatusData>`
  - GET `/api/manager-parent/api-status`
- [ ] Add method `getApiStatusHistory(): Promise<ApiStatusHistory[]>`
  - GET `/api/manager-parent/api-status/history`
- [ ] Add method `getBiosConflicts(params: BiosConflictFilters): Promise<PaginatedResponse<BiosConflict>>`
  - GET `/api/manager-parent/bios-conflicts` with query params
- [ ] Add method `resolveBiosConflict(id: number, data: { resolution_notes: string }): Promise<BiosConflict>`
  - PUT `/api/manager-parent/bios-conflicts/${id}/resolve`

### 2.12 Update i18n files

- [ ] Open `frontend/src/locales/en.json`
  - Add inside `managerParent.nav`: `"biosConflicts": "BIOS Conflicts"`, `"logs": "Logs"`, `"apiStatus": "API Status"`
  - Add new key group `managerParent.logs`, `managerParent.apiStatus`, `managerParent.biosConflicts` with page-level strings
- [ ] Open `frontend/src/locales/ar.json`
  - Add inside `managerParent.nav`: `"biosConflicts": "تعارضات BIOS"`, `"logs": "السجلات"`, `"apiStatus": "حالة API"`
  - Add matching Arabic key group with page-level strings

### 2.13 Verify and test

- [ ] Run `npx tsc --noEmit` — must pass
- [ ] Run `npm run build` — must pass
- [ ] Log in with `parent@obd2sw.com`
- [ ] Sidebar shows 17 items
- [ ] Navigate to `/ar/logs` — Logs page renders with table
- [ ] Navigate to `/ar/api-status` — API Status page renders with status indicator
- [ ] Navigate to `/ar/bios-conflicts` — BIOS Conflicts page renders with table
- [ ] All three pages render in Arabic RTL without layout issues

---

## Sub-Phase 3: Manager — Add Software Management CRUD (45 minutes)

### 3.1 Create `frontend/src/pages/manager/SoftwareManagement.tsx`

- [ ] Create the file (refer to `frontend/src/pages/manager-parent/SoftwareManagement.tsx` as structural reference)
- [ ] Change all API calls to use `/api/manager/software` endpoints
- [ ] Page title: "Software Management" (translated via i18n)
- [ ] "Add Program" button (top right) opens Dialog
- [ ] Dialog form fields:
  - Program Name: `<Input>` required
  - Download Link: `<Input type="url">` required
  - Trial Days: `<Input type="number">` default 7
  - Price: `<Input type="number">` with currency label
  - Icon URL: `<Input type="url">` optional
  - Active: `<Switch>` default off
- [ ] Programs displayed as cards or table (toggle between card/table view)
- [ ] Card/Row shows: Program Name, Download Link (truncated), Trial Days, Price, Active badge, Edit/Delete/Activate buttons
- [ ] Edit button → opens same Dialog pre-filled with current values
  - On submit: `useMutation` → `PUT /api/manager/software/{id}` → invalidate query → success toast
- [ ] Delete button → `ConfirmDialog` "Are you sure you want to delete this program?"
  - On confirm: `useMutation` → `DELETE /api/manager/software/{id}` → invalidate query → success toast
- [ ] **Activate Toggle / Button:**
  - When toggled ON (from inactive to active): open `<Dialog>` "Register Program"
  - Dialog fields: Customer Username `<Input>`, Customer BIOS ID `<Input>`
  - Dialog buttons: Cancel, "Register Now"
  - "Register Now" → `useMutation` → `POST /api/manager/software/{id}/activate` with `{ username, bios_id }`
  - On success: close dialog, update active status in UI, show success toast
  - On error: show error toast with API message, keep dialog open
- [ ] Loading state: `SkeletonCard` grid while fetching
- [ ] Empty state: `EmptyState` with message "No programs yet — add your first program"
- [ ] All strings use `t('manager.softwareManagement.*')` keys

### 3.2 Update `frontend/src/router/routes.ts`

- [ ] Add to the `manager` block:
  ```typescript
  softwareManagement: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/manager/software-management`,
  ```

### 3.3 Update `frontend/src/router/index.tsx`

- [ ] Add import at the top:
  ```typescript
  import { SoftwareManagementPage as ManagerSoftwareManagementPage } from '@/pages/manager/SoftwareManagement'
  ```
- [ ] Inside the `RoleGuard allowedRoles={['manager']}` block under path `manager`, add:
  ```tsx
  <Route path="software-management" element={<ManagerSoftwareManagementPage />} />
  ```

### 3.4 Update `frontend/src/components/layout/Sidebar.tsx`

- [ ] Add `PackagePlus` to the Lucide import line at the top
- [ ] Add one item to `managerItems` array (after `software` entry):
  ```typescript
  { key: 'softwareManagement', icon: PackagePlus, href: routePaths.manager.softwareManagement, translationKey: 'manager.nav.softwareManagement' },
  ```

### 3.5 Create `backend/app/Http/Controllers/Manager/SoftwareController.php`

- [ ] Create the file with namespace `App\Http\Controllers\Manager`
- [ ] Extend `BaseManagerController`
- [ ] Method `index()`:
  - Query `programs` where `tenant_id = auth()->user()->tenant_id`
  - Return paginated list with fields: `id, name, download_link, trial_days, price, icon_url, active, created_at`
- [ ] Method `store(Request $request)`:
  - Validate: `name` required, `download_link` required url, `trial_days` integer min 0, `price` numeric min 0, `icon_url` nullable url, `active` boolean
  - Set `tenant_id = auth()->user()->tenant_id`
  - Set `created_by = auth()->id()`
  - Create and return the new program
- [ ] Method `update($id, Request $request)`:
  - Find program, verify `tenant_id` matches auth user's tenant — abort 403 if not
  - Validate same rules as store
  - Update and return
- [ ] Method `destroy($id)`:
  - Find program, verify `tenant_id` — abort 403 if not
  - Check no active licenses depend on it (optional: warn instead of block)
  - Soft delete (or hard delete per business rule)
  - Return 204 No Content
- [ ] Method `activate($id, Request $request)`:
  - Validate: `username` required string, `bios_id` required string
  - Find program, verify `tenant_id` — abort 403 if not
  - Call `BiosActivationService::activateForManager(program, username, bios_id)`
  - Set `program->active = true`, save
  - Log to `activity_logs`: action `program_activated`, performed by manager
  - Return updated program

### 3.6 Update `backend/routes/api.php`

- [ ] Add `use App\Http\Controllers\Manager\SoftwareController;` (or inline namespace)
- [ ] Inside the manager middleware group, add:
  ```php
  Route::get('/software', [SoftwareController::class, 'index']);
  Route::post('/software', [SoftwareController::class, 'store']);
  Route::put('/software/{id}', [SoftwareController::class, 'update']);
  Route::delete('/software/{id}', [SoftwareController::class, 'destroy']);
  Route::post('/software/{id}/activate', [SoftwareController::class, 'activate']);
  ```

### 3.7 Update `frontend/src/services/manager.service.ts`

- [ ] Add type definitions (or import from `@/types/manager.types.ts`):
  - `Program`, `CreateProgramData`, `UpdateProgramData`, `ActivateProgramData`
- [ ] Add method `getSoftwarePrograms(): Promise<PaginatedResponse<Program>>`
  - GET `/api/manager/software`
- [ ] Add method `createProgram(data: CreateProgramData): Promise<Program>`
  - POST `/api/manager/software`
- [ ] Add method `updateProgram(id: number, data: UpdateProgramData): Promise<Program>`
  - PUT `/api/manager/software/${id}`
- [ ] Add method `deleteProgram(id: number): Promise<void>`
  - DELETE `/api/manager/software/${id}`
- [ ] Add method `activateProgram(id: number, data: ActivateProgramData): Promise<Program>`
  - POST `/api/manager/software/${id}/activate`

### 3.8 Update i18n files

- [ ] Open `frontend/src/locales/en.json`
  - Add inside `manager.nav`: `"softwareManagement": "Software Management"`
  - Add new key group `manager.softwareManagement` with: title, addProgram, editProgram, deleteProgram, activate, registerNow, programName, downloadLink, trialDays, price, iconUrl, noPrograms, etc.
- [ ] Open `frontend/src/locales/ar.json`
  - Add inside `manager.nav`: `"softwareManagement": "إدارة البرامج"`
  - Add matching Arabic translations for all `manager.softwareManagement.*` keys

### 3.9 Verify and test

- [ ] Run `npx tsc --noEmit` — must pass
- [ ] Run `npm run build` — must pass
- [ ] Log in with `manager@obd2sw.com`
- [ ] Sidebar shows 9 items (softwareManagement visible)
- [ ] Navigate to `/ar/manager/software-management` — page renders with empty state or program cards
- [ ] Click "Add Program" → Dialog opens with all form fields
- [ ] Fill form and submit → program card appears
- [ ] Click Edit → Dialog opens pre-filled → edit name → save → card updates
- [ ] Click Delete → ConfirmDialog → confirm → card disappears
- [ ] Toggle Activate → "Register Program" popup opens with username + BIOS ID fields
- [ ] Fill username + BIOS ID → "Register Now" → success toast, card shows active badge

---

## Sub-Phase 4: Reseller — Restrict to 4 Pages (15 minutes)

### 4.1 Update `frontend/src/components/layout/Sidebar.tsx`

- [ ] In `resellerItems` array, remove these 3 entries completely:
  ```typescript
  { key: 'software', ... }    // DELETE this line
  { key: 'activity', ... }    // DELETE this line
  { key: 'profile', ... }     // DELETE this line
  ```
- [ ] Verify `resellerItems` now has exactly 4 items:
  `dashboard`, `customers`, `licenses`, `reports`
- [ ] Check if removing items makes `Package`, or `User` icons unused across ALL role items — if unused, remove from import

### 4.2 Update `frontend/src/router/index.tsx`

- [ ] Inside the `RoleGuard allowedRoles={['reseller']}` block under path `reseller`, remove these 3 routes:
  ```tsx
  <Route path="software" element={<ResellerSoftwarePage />} />   // DELETE
  <Route path="activity" element={<ResellerActivityPage />} />   // DELETE
  <Route path="profile" element={<ResellerProfilePage />} />     // DELETE
  ```
- [ ] Add a catch-all redirect at the end of the reseller block:
  ```tsx
  <Route path="*" element={<Navigate to="dashboard" replace />} />
  ```
- [ ] Remove unused import lines at the top:
  ```typescript
  import { ActivityPage as ResellerActivityPage } from '@/pages/reseller/Activity'     // DELETE
  import { ProfilePage as ResellerProfilePage } from '@/pages/reseller/Profile'        // DELETE
  import { SoftwarePage as ResellerSoftwarePage } from '@/pages/reseller/Software'     // DELETE
  ```

### 4.3 Update `frontend/src/router/routes.ts`

- [ ] In the `reseller` block, remove these 3 route functions:
  ```typescript
  software: ...,    // DELETE
  activity: ...,    // DELETE
  profile: ...,     // DELETE
  ```

### 4.4 Verify and test

- [ ] Run `npx tsc --noEmit` — must pass
- [ ] Run `npm run build` — must pass
- [ ] Log in with `reseller1@obd2sw.com`
- [ ] Sidebar shows exactly 4 items: Dashboard, Customers, Licenses, Reports
- [ ] Manually type `/ar/reseller/software` in browser → redirects to `/ar/reseller/dashboard`
- [ ] Manually type `/ar/reseller/activity` in browser → redirects to `/ar/reseller/dashboard`
- [ ] Manually type `/ar/reseller/profile` in browser → redirects to `/ar/reseller/dashboard`
- [ ] Dashboard, Customers, Licenses, Reports pages all still work normally

---

## Sub-Phase 5: Super Admin — Reduce to 10 Pages (30 minutes)

### 5.1 Update `frontend/src/components/layout/Sidebar.tsx`

- [ ] In `superAdminItems` array, remove these 3 entries:
  ```typescript
  { key: 'adminManagement', ... }     // DELETE
  { key: 'usernameManagement', ... }  // DELETE
  { key: 'profile', ... }             // DELETE
  ```
- [ ] Verify `superAdminItems` now has exactly 10 items:
  dashboard, tenants, users, biosBlacklist, biosHistory, financialReports, reports, logs, apiStatus, settings
- [ ] Remove `UserCog` from Lucide import if no longer used anywhere in the Sidebar file
- [ ] Keep `KeyRound` import only if it's still used by Manager or Manager Parent items

### 5.2 Update `frontend/src/router/index.tsx`

- [ ] Inside the `RoleGuard allowedRoles={['super_admin']}` block, remove these 3 routes:
  ```tsx
  <Route path="admin-management" element={<AdminManagementPage />} />  // DELETE
  <Route path="username-management" element={<UsernameManagementPage />} />  // DELETE
  <Route path="profile" element={<ProfilePage />} />  // DELETE
  ```
- [ ] Add catch-all redirect inside the super-admin block:
  ```tsx
  <Route path="*" element={<Navigate to="dashboard" replace />} />
  ```
- [ ] Remove the 3 unused import lines:
  ```typescript
  import { AdminManagementPage } from '@/pages/super-admin/AdminManagement'   // DELETE
  import { UsernameManagementPage } from '@/pages/super-admin/UsernameManagement' // DELETE
  import { ProfilePage } from '@/pages/super-admin/Profile'  // DELETE
  ```

### 5.3 Update `frontend/src/router/routes.ts`

- [ ] In the `superAdmin` block, remove these 3 route functions:
  ```typescript
  adminManagement: ...,      // DELETE
  usernameManagement: ...,   // DELETE
  profile: ...,              // DELETE
  ```

### 5.4 Update `frontend/src/pages/super-admin/Settings.tsx` — Add Profile Tab

- [ ] Open `frontend/src/pages/super-admin/Settings.tsx`
- [ ] Find the tabs definition (currently: General, API, Notifications, Security)
- [ ] Add a 5th tab: "Profile"
- [ ] Profile tab content:
  - Avatar placeholder (initials circle, no file upload needed)
  - Name field: `<Input>` bound to `auth().user.name`
  - Email field: `<Input type="email">`
  - Phone field: `<Input type="tel">`
  - "Save Profile" button → `useMutation` → `PUT /api/auth/profile` → success toast
  - Divider
  - "Change Password" section:
    - Current Password: `<Input type="password">`
    - New Password: `<Input type="password">`
    - Confirm Password: `<Input type="password">`
    - "Save Password" button → `useMutation` → `PUT /api/auth/password` → success toast
- [ ] Load initial profile data from `useAuth()` hook (already available)
- [ ] Add i18n keys: `superAdmin.settings.tabs.profile`, `superAdmin.settings.profile.*`
- [ ] Add Arabic translations for all new profile tab keys

### 5.5 Update `backend/routes/api.php`

- [ ] Inside the super-admin middleware group, find and DELETE these route registrations:
  - All routes prefixed with `admin-management` (or apiResource for AdminManagementController)
  - All routes prefixed with `username-management`
  - Keep the backend controllers on disk — do NOT delete them
- [ ] Verify that `profile` routes (from `auth` group) are NOT in the super-admin group — profile uses `/api/auth/profile` which is already shared

### 5.6 Enhance Tenant Creation Flow in `frontend/src/pages/super-admin/Tenants.tsx`

- [ ] Open `frontend/src/pages/super-admin/Tenants.tsx`
- [ ] Find the "Add Tenant" / "Create New Tenant" modal/dialog
- [ ] Verify the modal form has all 4 required fields:
  - Tenant Name (required)
  - Manager Parent Full Name (required)
  - Manager Parent Email (required)
  - Manager Parent Password (required — show/hide toggle)
- [ ] Verify submit calls `POST /api/super-admin/tenants` (or `/api/super-admin/tenants/create-complete`)
- [ ] If the modal is missing any of these fields, add them now

### 5.7 Verify `backend/app/Http/Controllers/SuperAdmin/TenantController.php` `store()` method

- [ ] Open `backend/app/Http/Controllers/SuperAdmin/TenantController.php`
- [ ] Find `store(Request $request)` method
- [ ] Verify it uses `DB::transaction(function () { ... })` to atomically create both the tenant record and the manager_parent user
- [ ] If not wrapped in a transaction, add `DB::transaction()` wrapper
- [ ] Verify validation covers: `name` required, `manager_name` required, `manager_email` required|email|unique:users, `manager_password` required|min:8

### 5.8 Verify and test

- [ ] Run `npx tsc --noEmit` — must pass
- [ ] Run `npm run build` — must pass
- [ ] Log in with `admin@obd2sw.com`
- [ ] Sidebar shows exactly 10 items
- [ ] Navigate to `/ar/super-admin/settings` → 5 tabs visible including "Profile"
- [ ] Profile tab shows name/email/phone form → edit and save → success toast
- [ ] Manually type `/ar/super-admin/admin-management` → redirects to dashboard
- [ ] Manually type `/ar/super-admin/username-management` → redirects to dashboard
- [ ] Go to Tenants page → click "Create New Tenant" → modal shows 4 fields → fill and submit → new tenant appears in list

---

## Sub-Phase 6: Backend Middleware Cleanup (30 minutes)

### 6.1 Update `backend/app/Http/Middleware/RoleMiddleware.php`

- [ ] Add explicit handling for `customer` role:
  - If `auth()->user()->role === 'customer'`, return `response()->json(['message' => 'Customer portal is not available'], 403)`
  - This applies for ALL routes, not just specific ones
- [ ] Verify that no route in `api.php` has `role:customer` — it should be gone after Sub-Phase 1

### 6.2 Verify `backend/routes/api.php` — Complete Cleanup

- [ ] Confirm the customer route group is fully removed (done in Sub-Phase 1, double-check)
- [ ] Confirm the super-admin admin-management routes are removed (done in Sub-Phase 5, double-check)
- [ ] Confirm the super-admin username-management routes are removed (done in Sub-Phase 5, double-check)
- [ ] Confirm the manager-parent new routes are added (logs, api-status, bios-conflicts — done in Sub-Phase 2)
- [ ] Confirm the manager software routes are added (done in Sub-Phase 3)
- [ ] Run `php artisan route:list` and check the output:
  - No `/api/customer/*` routes should appear
  - No `/api/super-admin/admin-management` routes should appear
  - No `/api/super-admin/username-management` routes should appear
  - `/api/manager-parent/logs` should appear
  - `/api/manager-parent/api-status` should appear
  - `/api/manager-parent/bios-conflicts` should appear
  - `/api/manager/software` (CRUD) should appear

### 6.3 Run backend tests

- [ ] Run `php artisan test` from the `backend/` directory
- [ ] All existing 17 tests should still pass
- [ ] If any test references deleted routes, update that test to remove the customer/admin-management assertions

---

## Sub-Phase 7: Documentation Update (15 minutes)

### 7.1 Update `docs-organized/ROLE-PERMISSIONS-AND-DASHBOARD-PAGES.md`

- [ ] Update the Role Summary table at the top:
  ```
  | Super Admin    | Global  | /:lang/super-admin/dashboard | 10  |
  | Manager Parent | Tenant  | /:lang/dashboard             | 17  |
  | Manager        | Team    | /:lang/manager/dashboard     | 9   |
  | Reseller       | Personal| /:lang/reseller/dashboard    | 4   |
  | Customer       | REMOVED | -                            | 0   |
  ```
- [ ] Update the Super Admin "Pages shown in navigation" list to 10 items (remove admin-management, username-management, profile)
- [ ] Update the Manager Parent "Pages shown in navigation" list to 17 items (add bios-conflicts, logs, api-status)
- [ ] Update Manager "Pages shown in navigation" list to 9 items (add software-management)
- [ ] Update Reseller "Pages shown in navigation" list to 4 items (remove software, activity, profile)
- [ ] Replace the entire Customer section with: "Customer portal removed. Users with role=customer cannot log in and are redirected to the access-denied page."
- [ ] Update "Final practical answer by role" section at the bottom to match new counts

### 7.2 Update `README.md`

- [ ] Find the "User Roles & RBAC" section
- [ ] Update page counts:
  - Super Admin: 13 → 10 pages
  - Manager Parent: 14 → 17 pages
  - Manager: 8 → 9 pages
  - Reseller: 7 → 4 pages
  - Customer: Remove or mark as "Portal removed"
- [ ] Update the "All Pages" section or table (originally titled "43 Total" — now "40 Total")

---

## Final Verification Checklist

Run these checks after ALL sub-phases are complete:

### Build checks

- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] `npm run build` — completes successfully, no warnings about missing modules
- [ ] `npm run lint` — zero ESLint errors

### Backend checks

- [ ] `php artisan test` — all tests pass (17 existing)
- [ ] `php artisan route:list` — no customer routes, no removed super-admin routes

### Manual login tests

- [ ] `admin@obd2sw.com` logs in → redirected to `/ar/super-admin/dashboard` → sidebar has 10 items
- [ ] `parent@obd2sw.com` logs in → redirected to `/ar/dashboard` → sidebar has 17 items
- [ ] `manager@obd2sw.com` logs in → redirected to `/ar/manager/dashboard` → sidebar has 9 items
- [ ] `reseller1@obd2sw.com` logs in → redirected to `/ar/reseller/dashboard` → sidebar has 4 items
- [ ] `customer@obd2sw.com` + correct password → **stays on login page, shows "Invalid credentials." — NO redirect, NO dashboard**
- [ ] `customer@obd2sw.com` + wrong password → same "Invalid credentials." error — **visually identical to above**

### Page access tests

- [ ] Super Admin: all 10 sidebar pages load without error
- [ ] Super Admin: `/ar/super-admin/admin-management` → redirects to dashboard
- [ ] Super Admin: `/ar/super-admin/username-management` → redirects to dashboard
- [ ] Super Admin: Settings page has 5 tabs (General, API, Notifications, Security, Profile)
- [ ] Manager Parent: all 17 sidebar pages load without error
- [ ] Manager Parent: Logs page shows API log table
- [ ] Manager Parent: API Status page shows status badge and charts
- [ ] Manager Parent: BIOS Conflicts page shows table with open/resolved filter
- [ ] Manager: all 9 sidebar pages load without error
- [ ] Manager: Software Management page shows CRUD cards and "Add Program" button
- [ ] Manager: Activate popup appears when toggling a program active
- [ ] Reseller: only 4 pages in sidebar — dashboard, customers, licenses, reports
- [ ] Reseller: typing `/ar/reseller/software` in URL → dashboard redirect
- [ ] Reseller: typing `/ar/reseller/activity` in URL → dashboard redirect
- [ ] Reseller: typing `/ar/reseller/profile` in URL → dashboard redirect

### RTL and dark mode

- [ ] All 3 new Manager Parent pages render correctly in Arabic RTL (sidebar on right, text right-aligned)
- [ ] New Manager SoftwareManagement page renders correctly in Arabic RTL
- [ ] All new pages work in dark mode (`dark:bg-slate-900` backgrounds visible)
- [ ] Language toggle on any new page switches between `/ar/` and `/en/` correctly

### Git commit after completion

- [ ] `git add -p` to stage changes file by file
- [ ] `git commit -m "feat: phase-11 role refactor — remove customer portal, add manager-parent tools, restrict reseller to 4 pages"`

---

## Sub-Phase 4.5: Reseller Software + Universal ACTIVATE Modal (45 minutes)

> **Scope**: Add a 5th page to Reseller (`/reseller/software`) — a read-only software catalog where the reseller can activate a license for any listed program. A universal `ActivateLicenseModal` component is created and reused across Reseller, Manager, and Manager Parent software pages. Reseller goes from **4 → 5 pages**.

---

### 4.5.1 Update `frontend/src/router/routes.ts` — Add Reseller Software Route

- [ ] Open `frontend/src/router/routes.ts`
- [ ] In the `reseller` block, add the `software` route after `licenses`:
  ```ts
  software: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/reseller/software`,
  ```
- [ ] Reseller block should now have 5 routes: `root`, `dashboard`, `customers`, `licenses`, `reports`, `software`

---

### 4.5.2 Update `frontend/src/router/index.tsx` — Register Reseller Software Route

- [ ] Open `frontend/src/router/index.tsx`
- [ ] Find the reseller lazy imports block
- [ ] Add lazy import for the new page:
  ```ts
  const ResellerSoftwarePage = lazy(() => import('@/pages/reseller/Software'))
  ```
- [ ] Find the reseller `<Route>` children block (inside `<RoleGuard roles={['reseller']}>`)
- [ ] Add the route:
  ```tsx
  <Route path="software" element={<ResellerSoftwarePage />} />
  ```
- [ ] Verify the route is inside the reseller `ResellerLayout` wrapper (same nesting level as `customers`, `licenses`, `reports`)

---

### 4.5.3 Create `frontend/src/services/activation.service.ts` (NEW FILE)

- [ ] Create `frontend/src/services/activation.service.ts`
- [ ] Add the following API call shape:
  ```ts
  interface ActivationPayload {
    program_id: number
    customer_name: string
    customer_email: string
    bios_id: string
    duration_days: number
    price: number
  }
  interface ActivationResponse {
    message: string
    license_key: string
    customer_id: number
    expires_at: string
  }
  export async function activateLicense(payload: ActivationPayload): Promise<ActivationResponse>
  ```
- [ ] The function calls `POST /api/licenses/activate` via the shared `api` axios instance (from `@/services/api.ts`)
- [ ] Export the `ActivationPayload` and `ActivationResponse` types

---

### 4.5.4 Create `frontend/src/components/ActivateLicenseModal.tsx` (NEW FILE — Universal)

- [ ] Create `frontend/src/components/ActivateLicenseModal.tsx`
- [ ] Props interface:
  ```ts
  interface ActivateLicenseModalProps {
    open: boolean
    onClose: () => void
    program: { id: number; name: string; price_per_day: number } | null
  }
  ```
- [ ] Modal contains these form fields (in order):
  - **Customer Name** — text input, required
  - **Customer Email** — email input, required
  - **BIOS ID** — text input, required, label note: "will be used as username (locked)"
  - **Duration (days)** — number input, required, min=1
  - **Price** — read-only computed field: `duration_days × program.price_per_day` — updates live as duration changes
- [ ] Submit button label: **"CREATE & ACTIVATE"**
- [ ] On submit: call `activateLicense()` from `activation.service.ts`
- [ ] On success: show success toast with license key, close modal, call optional `onSuccess` callback prop
- [ ] On error: show error toast with API error message, keep modal open
- [ ] Loading state: disable submit button and show spinner while request is in flight
- [ ] Use `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` from `@/components/ui/dialog`
- [ ] Use `useMutation` from `@tanstack/react-query` for the submit handler
- [ ] Import `useTranslation` from `react-i18next` and use translation keys for all labels (see 4.5.8)

---

### 4.5.5 Create `frontend/src/pages/reseller/Software.tsx` (NEW FILE)

- [ ] Create `frontend/src/pages/reseller/Software.tsx`
- [ ] Page structure:
  - Page title: `t('software.title')` (e.g., "Software Catalog")
  - Page description: `t('software.description')` (e.g., "Browse available programs and activate licenses for your customers")
  - Software list: table or card grid — columns: Program Name, Version, Price/Day, Actions
  - Each row has an **"ACTIVATE"** button (primary color)
- [ ] Clicking ACTIVATE opens `ActivateLicenseModal` pre-filled with `program` prop
- [ ] Data is fetched via `GET /api/reseller/software` (read-only list — no CRUD controls)
- [ ] Use `useQuery` from `@tanstack/react-query` to fetch the software list
- [ ] Loading state: show `<LoadingSpinner />` or skeleton rows
- [ ] Empty state: show `<EmptyState />` with icon and message if no programs exist
- [ ] Page is wrapped in `<PageTransition>` for consistent animation
- [ ] No add/edit/delete buttons — reseller is read-only on the catalog

---

### 4.5.6 Update Reseller Software Service — Add Catalog Fetch

- [ ] Open `frontend/src/services/reseller.service.ts`
- [ ] Add a `getSoftware()` function:
  ```ts
  export async function getSoftware(): Promise<SoftwareProgram[]>
  ```
  that calls `GET /api/reseller/software`
- [ ] Add `SoftwareProgram` type (if not already in `@/types/manager-reseller.types.ts`):
  ```ts
  interface SoftwareProgram {
    id: number
    name: string
    version: string
    price_per_day: number
    is_active: boolean
  }
  ```

---

### 4.5.7 Update `frontend/src/components/layout/Sidebar.tsx` — Reseller 4 → 5 Items

- [ ] Open `frontend/src/components/layout/Sidebar.tsx`
- [ ] Find the `resellerItems` array
- [ ] Add Software item (after Licenses, before Reports):
  ```ts
  {
    label: t('nav.software'),
    path: routePaths.reseller.software(lang),
    icon: Monitor, // or appropriate icon from lucide-react
  }
  ```
- [ ] Verify the `resellerItems` array now has **5 items**: Dashboard, Customers, Licenses, Software, Reports
- [ ] Import the correct icon from `lucide-react` (use `Monitor` or `Package` — whichever matches the existing software pages)

---

### 4.5.8 Add i18n Keys — `frontend/src/locales/en.json` and `ar.json`

- [ ] Open `frontend/src/locales/en.json`
- [ ] Add the following keys under the appropriate namespaces (or add a new `activate` namespace):
  ```json
  "activate": {
    "title": "Activate License",
    "customerName": "Customer Name",
    "customerEmail": "Customer Email",
    "biosId": "BIOS ID",
    "biosIdHint": "Will be used as username (locked)",
    "duration": "Duration (days)",
    "price": "Total Price",
    "priceAuto": "Auto-calculated",
    "submit": "Create & Activate",
    "successTitle": "License Activated",
    "successMessage": "License key: {{key}}",
    "errorTitle": "Activation Failed"
  }
  ```
- [ ] Open `frontend/src/locales/ar.json`
- [ ] Add the exact same keys with Arabic translations:
  ```json
  "activate": {
    "title": "تفعيل الترخيص",
    "customerName": "اسم العميل",
    "customerEmail": "البريد الإلكتروني للعميل",
    "biosId": "معرّف BIOS",
    "biosIdHint": "سيُستخدم كاسم مستخدم (مقفل)",
    "duration": "المدة (بالأيام)",
    "price": "السعر الإجمالي",
    "priceAuto": "يُحسب تلقائياً",
    "submit": "إنشاء وتفعيل",
    "successTitle": "تم تفعيل الترخيص",
    "successMessage": "مفتاح الترخيص: {{key}}",
    "errorTitle": "فشل التفعيل"
  }
  ```

---

### 4.5.9 Backend — Add `/api/reseller/software` Route

- [ ] Open `backend/routes/api.php`
- [ ] Find the reseller route group (`Route::middleware(['auth:sanctum', 'role:reseller', 'tenant.scope'])->prefix('reseller')`)
- [ ] Add the software read-only route:
  ```php
  Route::get('software', [ResellerSoftwareController::class, 'index']);
  ```
- [ ] If `ResellerSoftwareController` doesn't exist, use the existing `SoftwareController` or create a new one (see 4.5.10)

---

### 4.5.10 Backend — Create/Update `ResellerSoftwareController.php` (Read-Only)

- [ ] Check if `backend/app/Http/Controllers/Reseller/SoftwareController.php` exists
- [ ] If not, create it at that path
- [ ] The `index()` method should:
  - Return all active software programs scoped to the tenant (`tenant_id` via `TenantScope` middleware)
  - Return JSON: `{ data: SoftwareProgram[] }`
  - Only return programs where `is_active = true`
- [ ] Add the `use` import in `api.php`:
  ```php
  use App\Http\Controllers\Reseller\SoftwareController as ResellerSoftwareController;
  ```

---

### 4.5.11 Backend — Add `/api/licenses/activate` Route

- [ ] Open `backend/routes/api.php`
- [ ] Add a shared activation route (accessible by `reseller`, `manager`, `manager_parent`):
  ```php
  Route::middleware(['auth:sanctum', 'role:reseller,manager,manager_parent', 'tenant.scope'])
      ->post('licenses/activate', [LicenseController::class, 'activateLicense']);
  ```
- [ ] Add import at the top of `api.php`:
  ```php
  use App\Http\Controllers\LicenseController;
  ```

---

### 4.5.12 Backend — Update `LicenseController.php` `activateLicense()` Method

- [ ] Open `backend/app/Http/Controllers/LicenseController.php`
- [ ] Find or create the `activateLicense(Request $request)` method
- [ ] The method must:
  1. Validate: `program_id` (required|integer), `customer_name` (required|string), `customer_email` (required|email), `bios_id` (required|string), `duration_days` (required|integer|min:1), `price` (required|numeric|min:0)
  2. Wrap everything in `DB::transaction(function () { ... })`
  3. **Auto-create customer user**: `User::create(['name' => $validated['customer_name'], 'email' => $validated['customer_email'], 'password' => Hash::make(Str::random(32)), 'role' => 'customer', 'username' => $validated['bios_id'], 'tenant_id' => auth()->user()->tenant_id])`
  4. **Create License record**: linked to the new customer, with `bios_id`, `program_id`, `duration_days`, `price`, `expires_at = now()->addDays($duration_days)`, `activated_by = auth()->id()`
  5. **Call External API**: POST to `http://72.60.69.185/api/activate` with BIOS ID and license data — use `Http::post(...)` (Laravel HTTP facade)
  6. On external API failure: throw exception inside transaction so customer + license records are rolled back
  7. Return: `{ message: 'License activated.', license_key: '...', customer_id: ..., expires_at: '...' }`

---

### 4.5.13 Add ACTIVATE Button to Existing Software Pages

- [ ] Open `frontend/src/pages/manager/Software.tsx`
  - [ ] Import `ActivateLicenseModal` from `@/components/ActivateLicenseModal`
  - [ ] Add "Activate" button column to the software table
  - [ ] Wire up modal open/close with the selected program
- [ ] Open `frontend/src/pages/manager/Software.tsx` (software-management — if separate file)
  - [ ] Same: import modal, add activate button per row
- [ ] Open `frontend/src/pages/manager-parent/SoftwareManagement.tsx`
  - [ ] Same: import modal, add activate button per row
- [ ] Verify all 3 existing pages compile after modal import

---

### 4.5.14 Update `docs-organized/ROLE-PERMISSIONS-AND-DASHBOARD-PAGES.md`

- [ ] Open `docs-organized/ROLE-PERMISSIONS-AND-DASHBOARD-PAGES.md`
- [ ] Update the Role Summary table: Reseller visible pages `4` → `5`
- [ ] Under Reseller "Pages shown in navigation" add `5. /:lang/reseller/software`
- [ ] Under Reseller "Can do" add: "Browse software catalog (read-only). Activate licenses for customers via ACTIVATE modal."
- [ ] Under Reseller "Cannot do" remove the line "No reseller `software` page." (it now exists)
- [ ] Update "Final practical answer by role": Reseller `4 pages` → `5 pages`

---

### 4.5.15 Update `README.md` — Page Count

- [ ] Open `README.md`
- [ ] Update total page count: 40 → 41 pages
- [ ] Update Reseller row in the permissions matrix: 4 → 5 pages
- [ ] Add "Software Catalog (read-only + Activate)" to the Reseller capability list

---

### 4.5.16 Verify and Test Phase 4.5

- [ ] Run `npx tsc --noEmit` — zero TypeScript errors
- [ ] Run `npm run build` — passes without errors
- [ ] Log in as `reseller1@obd2sw.com`
  - [ ] Sidebar shows **5 items**: Dashboard, Customers, Licenses, Software, Reports
  - [ ] Navigate to `/ar/reseller/software` — page loads with software catalog
  - [ ] Each program row shows an "ACTIVATE" button
  - [ ] Click ACTIVATE → modal opens with correct program name and price/day
  - [ ] Fill all fields → Price auto-calculates as `duration × price_per_day`
  - [ ] Submit → success toast with license key → modal closes
  - [ ] Go to Customers page → newly created customer appears in list
- [ ] Log in as `manager@obd2sw.com`
  - [ ] Software page shows ACTIVATE button per row
  - [ ] ACTIVATE modal works the same way
- [ ] Log in as `parent@obd2sw.com`
  - [ ] Software Management page shows ACTIVATE button per row
  - [ ] ACTIVATE modal works the same way
- [ ] Test RTL: all modal labels align right in Arabic
- [ ] Test dark mode: modal background is dark, inputs visible

---

### 4.5.17 Git Commit After Phase 4.5

- [ ] `git add -p` to stage changes file by file
- [ ] `git commit -m "feat: phase-4.5 reseller software catalog + universal ActivateLicenseModal"`

---

## Sub-Phase 3.5: External API Integration — Per-Program Keys + Real Endpoints (2.5 hours)

> **Context from codebase audit:**
> - `ExternalApiService.php` already EXISTS but calls **wrong endpoints** — it treats the external server as a JSON REST API (`POST /activate`, `DELETE /users/{id}`) when the real API uses GET-URL-based calls (`GET /apiuseradd/{key}/{username}/{bios}`).
> - `LicenseService.php` and `BiosActivationService.php` already do blacklist check, BIOS conflict detection, balance crediting — this logic is CORRECT and must be kept.
> - `config/external-api.php` uses ONE global API key — but the real system is **per-program**: each software title has its own API key and its own software_id on the external server.
> - `programs` table has NO `external_api_key` or `external_software_id` columns yet.
> - `LicenseController.php` (root) calls `POST http://72.60.69.185/api/activate` directly (wrong) — this needs to be removed in favor of going through `LicenseService`.
> - `Reseller/LicenseController.php` already uses `LicenseService` correctly.
> - `Manager/SoftwareController.php` already uses `BiosActivationService` correctly.
>
> **Real external API URL patterns (confirmed by curl):**
> ```
> GET /apiuseradd/{api_key}/{username}/{bios}   → "True" on success
> GET /apideluser/{api_key}/{username}           → "True" on success
> GET /apiusers/{software_id}                   → {'username': 'bios'} (Python dict, NOT valid JSON)
> GET /showallapi/{software_id}                 → integer (user count)
> GET /apilogs/{software_id}                    → plain text log file
> GET /getmylogs                                → plain text global login log
> ```

---

### 3.5.1 Database Migration — Add External API Fields to `programs` Table

- [ ] Create new migration file: `backend/database/migrations/2026_03_01_000001_add_external_api_fields_to_programs_table.php`
- [ ] Add these columns to `programs` table:
  - `external_api_key_encrypted` — `text`, nullable — stores the Laravel-encrypted API key (never store plain text)
  - `external_software_id` — `unsignedInteger`, nullable — the numeric ID on the external server (e.g. 8, 9, 12)
  - `has_external_api` — `boolean`, default false — flag: true once API key is set (used to show/hide "API configured" badge)
- [ ] Add these columns to `licenses` table (same migration or separate):
  - `external_username` — `string(255)`, nullable — the username sent to external API (= bios_id in current flow)
  - `external_activation_response` — `text`, nullable — raw "True" or error string from `/apiuseradd`
  - `external_deletion_response` — `text`, nullable — raw "True" or error string from `/apideluser`
- [ ] Run `php artisan migrate` to apply
- [ ] Verify `php artisan migrate:status` shows new migration as `Ran`

---

### 3.5.2 Update `Program` Model — Encrypted API Key Attribute

- [ ] Open `backend/app/Models/Program.php`
- [ ] Add `external_api_key_encrypted`, `external_software_id`, `has_external_api` to `$fillable` array
- [ ] Add a **write-only setter** so raw key is never stored: in `setExternalApiKeyAttribute($value)` → `$this->attributes['external_api_key_encrypted'] = encrypt($value)`
- [ ] Add a **getter for decryption** (only for internal service use): `getDecryptedApiKey(): ?string` → `return $this->external_api_key_encrypted ? decrypt($this->external_api_key_encrypted) : null`
- [ ] In all `serializeProgram()` methods across all controllers (ProgramController, Manager/SoftwareController) — **NEVER include** `external_api_key_encrypted` or `getDecryptedApiKey()` in the JSON response. Only expose `has_external_api` (boolean) and `external_software_id` (safe to show).
- [ ] Add `protected $hidden = ['external_api_key_encrypted']` to the model

---

### 3.5.3 Fix `ExternalApiService.php` — Rewrite to Use Real URL Patterns

- [ ] Open `backend/app/Services/ExternalApiService.php`
- [ ] The current `send()` method uses `Http::baseUrl()` + relative paths — this worked for a REST API but the real API uses GET with URL segments, not JSON bodies
- [ ] **Rewrite** the following methods (keep the `logApiCall()` method — it's correct):

  **`activateUser(string $apiKey, string $username, string $biosId): array`**
  - URL: `GET http://72.60.69.185/apiuseradd/{apiKey}/{username}/{biosId}`
  - Response body is plain text `"True"` (with quotes) or an error string
  - Success = response is `200` AND body contains "True"
  - Return: `['success' => true/false, 'data' => ['response' => $body], 'status_code' => $code]`

  **`deactivateUser(string $apiKey, string $username): array`**
  - URL: `GET http://72.60.69.185/apideluser/{apiKey}/{username}`
  - Same plain text response pattern as above

  **`getActiveUsers(int $softwareId): array`**
  - URL: `GET http://72.60.69.185/apiusers/{softwareId}`
  - Response is Python-style dict with single quotes e.g. `{'USER1': 'BIOS1', 'USER2': 'BIOS2'}`
  - **NOT valid JSON** — parse it manually: `str_replace(["'", "True", "False"], ['"', 'true', 'false'], $body)` then `json_decode()`
  - Return: `['success' => true, 'data' => ['users' => $parsed], 'status_code' => 200]`

  **`getSoftwareStats(int $softwareId): array`**
  - URL: `GET http://72.60.69.185/showallapi/{softwareId}`
  - Response is an integer (user count as plain text)
  - Return: `['success' => true, 'data' => ['count' => (int)$body], 'status_code' => 200]`

  **`getProgramLogs(int $softwareId): array`**
  - URL: `GET http://72.60.69.185/apilogs/{softwareId}`
  - Response is plain text (Content-Type: text/plain)
  - Return: `['success' => true, 'data' => ['raw' => $body], 'status_code' => 200]`

  **`getGlobalLogs(): array`**
  - URL: `GET http://72.60.69.185/getmylogs`
  - Same plain text format as program logs
  - Return: `['success' => true, 'data' => ['raw' => $body], 'status_code' => 200]`

- [ ] Remove old methods: `deleteUser()`, `listUsers()`, `checkUser()`, `renewUser()`, `getStatus()` — these used wrong endpoints
- [ ] Remove the `client()` method that used `Http::baseUrl()` — all new methods build full URLs directly
- [ ] Keep `logApiCall()` method unchanged — it is correct

---

### 3.5.4 Update `LicenseService.php` — Pass Program API Key to External Service

- [ ] Open `backend/app/Services/LicenseService.php`
- [ ] In the `activate()` method, after finding the `$program`, get the decrypted API key:
  - `$apiKey = $program->getDecryptedApiKey()`
  - If `$apiKey === null` → throw `ValidationException` with message: "This program is not configured for external activation. Contact your manager."
- [ ] Change the `ExternalApiService::activateUser()` call signature:
  - Old: `$this->externalApiService->activateUser($biosId)`
  - New: `$this->externalApiService->activateUser($apiKey, $biosId, $biosId)` — username = bios_id (current design: BIOS ID is the username on external system)
- [ ] After successful activation, store `external_username = $biosId` on the new license record
- [ ] Store `external_activation_response = $apiResponse['data']['response']` on the license record
- [ ] In the `deactivate()` method:
  - Get `$apiKey = $license->program->getDecryptedApiKey()`
  - Change: `$this->externalApiService->deleteUser($license->bios_id)` → `$this->externalApiService->deactivateUser($apiKey, $license->bios_id)`
  - Store `external_deletion_response` on the license
- [ ] In `renew()`: since the external API has no renew endpoint, remove the external API call — renewal is internal only (extend `expires_at`). Remove the `renewUser()` call entirely.

---

### 3.5.5 Update `BiosActivationService.php` — Same Fix as LicenseService

- [ ] Open `backend/app/Services/BiosActivationService.php`
- [ ] In `activate()`, get `$apiKey = $program->getDecryptedApiKey()`
- [ ] If null → throw `ValidationException`: "Program has no external API configured."
- [ ] Change: `$this->externalApiService->activateUser($biosId)` → `$this->externalApiService->activateUser($apiKey, $biosId, $biosId)`
- [ ] Store `external_username = $biosId` on the created license record
- [ ] Store `external_activation_response` on the created license record

---

### 3.5.6 Fix `LicenseController.php` (Root) — Remove Duplicate Direct API Call

- [ ] Open `backend/app/Http/Controllers/LicenseController.php`
- [ ] This controller duplicates the activation logic AND calls `POST http://72.60.69.185/api/activate` directly (wrong endpoint)
- [ ] Refactor `activateLicense()` to use `LicenseService::activate()` instead of doing everything inline
- [ ] Remove the direct `Http::post('http://72.60.69.185/api/activate', ...)` call completely
- [ ] Inject `LicenseService` into this controller via constructor
- [ ] Keep validation and response format, but delegate all business logic to `LicenseService`

---

### 3.5.7 Update Software Management Form — Manager Parent (`SoftwareManagement.tsx`)

- [ ] Open `frontend/src/pages/manager-parent/SoftwareManagement.tsx`
- [ ] In the **Create Program** and **Edit Program** modal/form, add two new fields:

  **External API Key field:**
  - Label: "External API Key" (i18n key: `software.externalApiKey`)
  - Input type: `password` with show/hide toggle
  - Placeholder: "e.g. L9H2F7Q8XK6M4A"
  - Helper text: "This key is encrypted and stored securely. You will not be able to view it again after saving."
  - Required only when creating a new program (`has_external_api === false`)
  - On edit: if `program.has_external_api === true` → show a green badge "API Configured ✓" + optional field to replace the key

  **External Software ID field:**
  - Label: "External Software ID" (i18n key: `software.externalSoftwareId`)
  - Input type: `number`, min=1
  - Placeholder: "e.g. 8"
  - Helper text: "The numeric ID assigned to this software on the activation server."
  - Required when creating

- [ ] On form submit (POST/PUT), include `external_api_key` and `external_software_id` in the payload
- [ ] After save: DO NOT display the API key in the response — only show `has_external_api: true` and the green badge
- [ ] Add `external_software_id` to the program card/table so manager can see which server ID is linked

---

### 3.5.8 Update Software Management Form — Manager (`SoftwareManagement.tsx`)

- [ ] Open `frontend/src/pages/manager/SoftwareManagement.tsx` (or `Software.tsx` if that's where the form is)
- [ ] Apply the same two new fields as 3.5.7 (External API Key + External Software ID)
- [ ] Same security rules: password type, one-time view, green badge after save

---

### 3.5.9 Update Backend Validation — `ManagerParent/ProgramController.php`

- [ ] Open `backend/app/Http/Controllers/ManagerParent/ProgramController.php`
- [ ] In `store()` — add validation rules:
  - `external_api_key` → `nullable|string|size:14` (API keys appear to be 14 chars like `L9H2F7Q8XK6M4A`)
  - `external_software_id` → `nullable|integer|min:1`
- [ ] In `store()` create block — if `external_api_key` is present:
  - Call `$program->setExternalApiKeyAttribute($validated['external_api_key'])`
  - Set `has_external_api = true`
  - Set `external_software_id = $validated['external_software_id']`
- [ ] In `update()` — same nullable rules, same setter logic
- [ ] In `serializeProgram()` — add `'has_external_api' => (bool)$program->has_external_api` and `'external_software_id' => $program->external_software_id` to response. **Never include** `external_api_key_encrypted`.

---

### 3.5.10 Update Backend Validation — `Manager/SoftwareController.php`

- [ ] Open `backend/app/Http/Controllers/Manager/SoftwareController.php`
- [ ] Apply same validation and save logic as 3.5.9 to `store()` and `update()` methods
- [ ] Update `serializeProgram()` to include `has_external_api` and `external_software_id`

---

### 3.5.11 Create Program Logs Page — Manager Parent (NEW PAGE)

- [ ] Create `frontend/src/pages/manager-parent/ProgramLogs.tsx`
- [ ] Add to `frontend/src/router/routes.ts`: `programLogs: (lang) => \`/${lang}/program-logs\``
- [ ] Add to `frontend/src/router/index.tsx`: lazy import + route under manager-parent guard
- [ ] Add to `frontend/src/components/layout/Sidebar.tsx` Manager Parent items: "Program Logs" with `FileText` icon
- [ ] Manager Parent now has **18 pages** (was 17 — adding Program Logs)

  **Page structure:**
  - Dropdown at top: "Select Program" — loads all tenant programs that have `has_external_api === true`
  - When a program is selected → fetch `GET /api/manager-parent/programs/{id}/logs`
  - Our backend proxies to `GET http://72.60.69.185/apilogs/{external_software_id}`
  - Parse the plain text response into two tabs:

  **Tab 1: "Activation Events"** — lines containing "new user added" or "user deleted":
  - Columns: Event Type (green "Added" / red "Deleted"), Username, BIOS ID, Timestamp
  - Parse format: `new user added - {username} with bios - {bios} at time {day}:{month}:{date}:{year}  {HH:MM:SS}`
  - Parse format: `user deleted - {username} at time {day}:{month}:{date}:{year}  {HH:MM:SS}`

  **Tab 2: "Login Events"** — lines with IP addresses (format: `{username}   {day}:{Mon}:{DD}:{YYYY}  {HH:MM:SS}  {IP}`):
  - Columns: Username, Date, Time, IP Address, VPN/Proxy flag (call `IpGeolocationService` or external IP check)
  - Highlight suspicious IPs (if VPN/proxy detected)

  - Auto-refresh toggle (every 30s)
  - Export as CSV button
  - Show "No logs yet" empty state if no program selected or logs are empty

---

### 3.5.12 Backend Route + Proxy Controller for Program Logs

- [ ] Open `backend/routes/api.php`
- [ ] Add under manager-parent middleware group:
  ```
  GET /manager-parent/programs/{program}/logs → ManagerParent/ProgramLogsController@show
  GET /manager-parent/programs/{program}/active-users → ManagerParent/ProgramLogsController@activeUsers
  GET /manager-parent/programs/{program}/stats → ManagerParent/ProgramLogsController@stats
  ```
- [ ] Create `backend/app/Http/Controllers/ManagerParent/ProgramLogsController.php`:
  - `show(Program $program)` → get `$program->external_software_id` → call `ExternalApiService::getProgramLogs($softwareId)` → return raw text as JSON: `{ data: { raw: '...' } }`
  - `activeUsers(Program $program)` → call `ExternalApiService::getActiveUsers($softwareId)` → return `{ data: { users: {...} } }`
  - `stats(Program $program)` → call `ExternalApiService::getSoftwareStats($softwareId)` → return `{ data: { count: N } }`
  - Scope check: `abort_unless($program->tenant_id === auth()->user()->tenant_id, 403)`
  - If `$program->has_external_api === false` → return `{ message: 'No external API configured for this program.' }` with 422

---

### 3.5.13 Update `frontend/src/services/manager-parent.service.ts` — Logs API

- [ ] Add three new functions:
  - `getProgramLogs(programId: number): Promise<{ raw: string }>` → calls `GET /api/manager-parent/programs/{id}/logs`
  - `getProgramActiveUsers(programId: number): Promise<{ users: Record<string, string> }>` → calls `GET /api/manager-parent/programs/{id}/active-users`
  - `getProgramStats(programId: number): Promise<{ count: number }>` → calls `GET /api/manager-parent/programs/{id}/stats`
- [ ] Add `ProgramLog` type to `frontend/src/types/manager-parent.types.ts`:
  ```ts
  interface ProgramLog {
    type: 'add' | 'delete' | 'login'
    username: string
    bios_id?: string
    timestamp: string
    ip?: string
  }
  ```

---

### 3.5.14 Add i18n Keys — New Fields and Error Messages

- [ ] Open `frontend/src/locales/en.json`
- [ ] Add under `software` namespace:
  ```json
  "externalApiKey": "External API Key",
  "externalSoftwareId": "External Software ID",
  "apiKeyHint": "Encrypted and stored securely. Not visible after saving.",
  "apiConfigured": "API Configured",
  "apiNotConfigured": "No API Key Set",
  "noApiWarning": "This program has no external API configured. Activation will fail."
  ```
- [ ] Add `programLogs` namespace:
  ```json
  "programLogs": {
    "title": "Program Logs",
    "selectProgram": "Select a program to view logs",
    "activationEvents": "Activation Events",
    "loginEvents": "Login Events",
    "eventAdded": "Added",
    "eventDeleted": "Deleted",
    "noLogs": "No logs available for this program.",
    "autoRefresh": "Auto-refresh (30s)",
    "exportCsv": "Export CSV"
  }
  ```
- [ ] Open `frontend/src/locales/ar.json` and add the same keys in Arabic:
  ```json
  "externalApiKey": "مفتاح API الخارجي",
  "externalSoftwareId": "معرّف البرنامج الخارجي",
  "apiKeyHint": "مشفّر ومحفوظ بأمان. لن يظهر مرة أخرى بعد الحفظ.",
  "apiConfigured": "API مُهيّأ",
  "apiNotConfigured": "لم يُضَف مفتاح API",
  "noApiWarning": "هذا البرنامج لا يحتوي على API خارجي. التفعيل لن يعمل."
  ```
  ```json
  "programLogs": {
    "title": "سجلات البرنامج",
    "selectProgram": "اختر برنامجاً لعرض السجلات",
    "activationEvents": "أحداث التفعيل",
    "loginEvents": "أحداث تسجيل الدخول",
    "eventAdded": "مُضاف",
    "eventDeleted": "محذوف",
    "noLogs": "لا توجد سجلات لهذا البرنامج.",
    "autoRefresh": "تحديث تلقائي (30 ثانية)",
    "exportCsv": "تصدير CSV"
  }
  ```

---

### 3.5.15 ACTIVATE Modal — Handle Missing API Key Gracefully

- [ ] Open `frontend/src/components/ActivateLicenseModal.tsx`
- [ ] When the selected program has `has_external_api === false`:
  - Show a yellow warning banner inside the modal: `t('software.noApiWarning')`
  - Disable the "CREATE & ACTIVATE" submit button
- [ ] When the backend returns an error like "Program has no external API configured" → show error toast with the message, keep modal open
- [ ] When backend returns "BIOS already registered" → show specific error: "This BIOS ID already has an active license for this program"
- [ ] When backend returns "BIOS is blacklisted" → show specific error: "This BIOS ID is blacklisted and cannot be activated"

---

### 3.5.16 Update `ROLE-PERMISSIONS-AND-DASHBOARD-PAGES.md`

- [ ] Open `docs-organized/ROLE-PERMISSIONS-AND-DASHBOARD-PAGES.md`
- [ ] Update Manager Parent visible pages count from 17 → **18** (adding Program Logs)
- [ ] Add `18. /:lang/program-logs` to Manager Parent pages list
- [ ] Under Manager Parent "Can do" add: "View real-time program activation logs and login IP history per software title."

---

### 3.5.17 Full Verification Checklist

**Database:**
- [ ] `programs` table: `external_api_key_encrypted`, `external_software_id`, `has_external_api` columns exist
- [ ] `licenses` table: `external_username`, `external_activation_response`, `external_deletion_response` columns exist
- [ ] `SELECT external_api_key_encrypted FROM programs WHERE id=1` → returns encrypted blob (NOT plain text "L9H2F7Q8XK6M4A")

**Software Management (Manager Parent):**
- [ ] Add new program → fill External API Key + Software ID → save → key NOT visible in response → green "API Configured ✓" badge appears
- [ ] Edit same program → key field shows placeholder "Leave blank to keep existing key" → submit blank → key unchanged in DB
- [ ] Edit program → enter new key → submit → old key replaced

**Activation flow (end-to-end):**
- [ ] Log in as reseller → Software → ACTIVATE → fill form → submit
- [ ] Check `curl http://72.60.69.185/apiusers/{software_id}` → new username appears in the response
- [ ] Check `curl http://72.60.69.185/apilogs/{software_id}` → "new user added" line appears in logs
- [ ] Licenses table → new row has `external_username` = bios_id, `external_activation_response` = "True"
- [ ] Try to activate same BIOS again → error "An active license already exists for this BIOS ID"
- [ ] Try to activate a blacklisted BIOS → error "This BIOS ID is blacklisted"
- [ ] Activate with a program that has no external API key → error "Program has no external API configured"

**Deactivation flow:**
- [ ] Reseller → Licenses → DEACTIVATE a license → confirm
- [ ] Check `curl http://72.60.69.185/apiusers/{software_id}` → username NO LONGER appears
- [ ] Check `curl http://72.60.69.185/apilogs/{software_id}` → "user deleted" line appears
- [ ] License row → `status = 'suspended'`, `external_deletion_response = 'True'`

**Program Logs page:**
- [ ] Log in as Manager Parent → sidebar shows "Program Logs" (18th item)
- [ ] Navigate to Program Logs → dropdown shows programs with `has_external_api = true`
- [ ] Select a program → logs load → Tab 1 shows "Added/Deleted" events in table
- [ ] Tab 2 shows login events with username, timestamp, IP
- [ ] Auto-refresh toggle works (refreshes every 30s)
- [ ] Export CSV downloads a valid CSV file

**Security:**
- [ ] Reseller cannot access Manager Parent's program logs API (`GET /api/manager-parent/programs/1/logs` → 403)
- [ ] `GET /api/manager-parent/programs` response NEVER contains `external_api_key_encrypted`
- [ ] `php artisan tinker` → `\App\Models\Program::first()->external_api_key_encrypted` → returns encrypted string

---

### 3.5.18 Git Commit After Phase 3.5

- [ ] `git add -p` to stage changes file by file
- [ ] `git commit -m "feat: phase-3.5 real external API integration — per-program keys, correct endpoints, program logs page"`

---

## Sub-Phase 3.5-SEED: Pre-Register Real Software for Dashboard Testing (15 minutes)

> **Why this exists:** After Phase 3.5 migration runs, the `programs` table has the new columns but no program has `external_api_key` or `external_software_id` set yet. We already confirmed via curl that the real external server is alive with:
> - **API Key:** `L9H2F7Q8XK6M4A`
> - **Software ID:** `8`
> - Logs endpoint: `http://72.60.69.185/apilogs/8`
> - Users endpoint: `http://72.60.69.185/apiusers/8`
>
> This sub-phase seeds one real, testable software program into the tenant so the developer can immediately test ACTIVATE, DEACTIVATE, and Program Logs via the dashboard — no manual DB editing required.
>
> **Run ORDER:** After 3.5.1 migration is applied — before any activation testing.

---

### 3.5-SEED.1 Update `TestDataSeeder.php` — Wire Real API to First Program

- [ ] Open `backend/database/seeders/TestDataSeeder.php`
- [ ] Find the `$programs` collect block (lines ~39–63) — it creates `OBD2SW Diagnostic` and `OBD2SW Flashing`
- [ ] After `$programs` is created, add a block to attach real external API credentials to the **first program** (`OBD2SW Diagnostic`):
  ```php
  // Attach real external API credentials to first program for dashboard testing
  $realProgram = $programs->first();
  $realProgram->external_software_id = 8;
  $realProgram->has_external_api = true;
  $realProgram->setExternalApiKeyAttribute('L9H2F7Q8XK6M4A'); // encrypts on set
  $realProgram->save();
  ```
- [ ] Leave the second program (`OBD2SW Flashing`) with no external API — this gives a test case for "no API configured" warning in the ACTIVATE modal
- [ ] Verify the seeder does NOT hardcode the plain key anywhere in the file except this one `setExternalApiKeyAttribute()` call

---

### 3.5-SEED.2 Create `backend/database/seeders/RealSoftwareSeeder.php` (NEW — Standalone Seeder)

- [ ] Create a new standalone seeder at `backend/database/seeders/RealSoftwareSeeder.php`
- [ ] Namespace: `Database\Seeders`
- [ ] The seeder finds the first tenant (`Tenant::query()->where('slug', 'test-tenant')->firstOrFail()`)
- [ ] Uses `updateOrCreate` to insert/update a program named **"OBD2SW Live Software"** with:
  - `tenant_id` → test tenant id
  - `name` → `'OBD2SW Live Software'`
  - `description` → `'Real external API integration — software_id 8 on 72.60.69.185'`
  - `version` → `'2.0.0'`
  - `download_link` → `'https://obd2sw.com/download/live'`
  - `trial_days` → `7`
  - `base_price` → `25.00`
  - `status` → `'active'`
  - `external_software_id` → `8`
  - `has_external_api` → `true`
- [ ] After `updateOrCreate`, call `$program->setExternalApiKeyAttribute('L9H2F7Q8XK6M4A')` then `$program->save()` to encrypt and store the key
- [ ] Print confirmation to console: `$this->command->info('Real software seeded: OBD2SW Live Software (external_id=8, api=configured)');`
- [ ] This seeder is SAFE to re-run (`updateOrCreate` is idempotent — running twice does not duplicate the row)

---

### 3.5-SEED.3 Register `RealSoftwareSeeder` in `DatabaseSeeder.php`

- [ ] Open `backend/database/seeders/DatabaseSeeder.php`
- [ ] Add `$this->call(RealSoftwareSeeder::class);` after `TestDataSeeder` in the call list
- [ ] This ensures `php artisan db:seed` runs it automatically as part of the full seed

---

### 3.5-SEED.4 Run the Seeders

- [ ] Confirm Phase 3.5.1 migration has been run first: `php artisan migrate:status` → shows the new migration as `Ran`
- [ ] Run: `php artisan db:seed --class=RealSoftwareSeeder`
- [ ] Expected console output: `Real software seeded: OBD2SW Live Software (external_id=8, api=configured)`
- [ ] OR run full seed: `php artisan db:seed` (includes all seeders)

---

### 3.5-SEED.5 Verify in Database

- [ ] Connect to MySQL: `php artisan tinker`
- [ ] Run: `\App\Models\Program::where('name', 'OBD2SW Live Software')->first()`
- [ ] Verify:
  - `external_software_id` = `8`
  - `has_external_api` = `true` (or `1`)
  - `external_api_key_encrypted` = long encrypted string (NOT `L9H2F7Q8XK6M4A` in plain text)
- [ ] Run: `\App\Models\Program::where('name', 'OBD2SW Live Software')->first()->getDecryptedApiKey()`
- [ ] Result should be: `"L9H2F7Q8XK6M4A"` — confirms encryption round-trip works

---

### 3.5-SEED.6 Verify External API is Reachable Before Testing

- [ ] Run in terminal: `curl http://72.60.69.185/apiusers/8`
- [ ] Expected: `{}` (empty — no users yet) or existing users from previous tests
- [ ] Run: `curl http://72.60.69.185/showallapi/8`
- [ ] Expected: `0` or the current user count integer
- [ ] If both return 200 → external server is online → safe to test activation

---

### 3.5-SEED.7 End-to-End Dashboard Test Using Real Software

**Test as Reseller:**
- [ ] Log in as `reseller@obd2sw.com`
- [ ] Go to Software page → `OBD2SW Live Software` appears with green "API Configured ✓" badge
- [ ] Click **ACTIVATE** → modal opens
- [ ] Fill in:
  - Customer Name: `Test Customer`
  - Customer Email: `testcustomer@test.com`
  - BIOS ID: `TESTBIOS-LIVE-001`
  - Duration: `1` day
  - Price: auto-calculated (25.00 × 1 = 25.00)
- [ ] Click **CREATE & ACTIVATE**
- [ ] Expected: success toast with license key
- [ ] Immediately run: `curl http://72.60.69.185/apiusers/8`
- [ ] Expected: `{'TESTBIOS-LIVE-001': 'TESTBIOS-LIVE-001'}` appears in response
- [ ] Run: `curl http://72.60.69.185/apilogs/8` — last line should read: `new user added - TESTBIOS-LIVE-001 with bios - TESTBIOS-LIVE-001 at time ...`

**Test BIOS duplicate block:**
- [ ] Try ACTIVATE again with same BIOS `TESTBIOS-LIVE-001`
- [ ] Expected: error toast "An active license already exists for this BIOS ID" — modal stays open
- [ ] Run: `curl http://72.60.69.185/apiusers/8` — user count unchanged (not duplicated on external server either)

**Test deactivation:**
- [ ] Go to Licenses page → find the license just created → click **DEACTIVATE** → confirm
- [ ] Run: `curl http://72.60.69.185/apiusers/8`
- [ ] Expected: `{}` — user removed from external server
- [ ] Run: `curl http://72.60.69.185/apilogs/8` — last line: `user deleted - TESTBIOS-LIVE-001 at time ...`

**Test Program Logs (Manager Parent):**
- [ ] Log in as `parent@obd2sw.com`
- [ ] Go to Program Logs page → select `OBD2SW Live Software` from dropdown
- [ ] Tab 1 (Activation Events) should show:
  - Green row: "Added — TESTBIOS-LIVE-001 — [timestamp]"
  - Red row: "Deleted — TESTBIOS-LIVE-001 — [timestamp]"
- [ ] Tab 2 (Login Events) → any existing login IPs from the server's history

**Test no-API program:**
- [ ] Log in as `reseller@obd2sw.com` → Software page
- [ ] Click ACTIVATE on `OBD2SW Flashing` (has no API configured)
- [ ] Expected: yellow warning banner in modal "This program has no external API configured. Activation will fail." + submit button is disabled

---

### 3.5-SEED.8 Git Commit After Seeding

- [ ] `git add backend/database/seeders/RealSoftwareSeeder.php`
- [ ] `git add backend/database/seeders/TestDataSeeder.php`
- [ ] `git add backend/database/seeders/DatabaseSeeder.php`
- [ ] `git commit -m "feat: phase-3.5-seed pre-register real OBD2SW software (software_id=8) for dashboard testing"`

---

## Sub-Phase 3.6: UI/UX Fixes from Live Testing (3 hours)

> **Source:** Issues discovered while testing the live dashboard at http://localhost:3000.
> All items below are based on real screenshots and observed behaviour — not hypothetical.
> Do not skip any item — each one was a visible bug or missing feature confirmed in the running app.

---

### 3.6.1 Fix IP Analytics Page — Use External Software Login IPs, Not Internal API Logs

**Problem:** `frontend/src/pages/manager-parent/IpAnalytics.tsx` currently shows internal platform requests (127.0.0.1, `GET api/ip-analytics`, `GET api/username-management`, etc.) — these are Laravel API calls, not software activation IPs.

**What it should show:** Login events parsed from `/apilogs/{software_id}` — lines like `NEHAD5   Tue:Dec:12:2023  08:52:48  109.161.186.94` — real customer IPs from when users ran the software.

- [ ] Open `frontend/src/pages/manager-parent/IpAnalytics.tsx`
- [ ] Add a **program selector dropdown** at the top of the page: "Select Software" — loads all tenant programs with `has_external_api === true`
- [ ] When a program is selected → fetch `GET /api/manager-parent/programs/{id}/logs` → parse **login event lines only** (lines with format `{username}   {day}:{Mon}:{DD}:{YYYY}  {HH:MM:SS}  {IP}`)
- [ ] Display these login events in the table instead of internal API logs:
  - Columns: **Username**, **IP Address**, **Country (with flag)**, **City**, **ISP**, **VPN/Proxy**, **Timestamp**
- [ ] For country flag: use the `IpGeolocationService` (already exists in backend) or call `ipapi.co/{ip}/json/` from frontend — display the country ISO code as an emoji flag: `flag = String.fromCodePoint(...[...countryCode.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)))`
- [ ] Country name: show full name (e.g. "Egypt", "Saudi Arabia") next to the flag emoji
- [ ] Keep the existing filters: date range, reputation score
- [ ] Add a new filter: "Software" (the program dropdown)
- [ ] "Country Distribution" pie chart → update to use the new IP data (group by country from geolocation)
- [ ] **Remove** the "Action" column (currently showing `GET api/programs` etc.) — these are internal platform logs, not relevant here
- [ ] Update backend: `backend/app/Http/Controllers/ManagerParent/IpAnalyticsController.php`
  - Add method `softwareLogs(Program $program)` that proxies `ExternalApiService::getProgramLogs()` and returns only the login event lines as structured JSON: `{ ip, username, timestamp }`
  - OR: the frontend can call the existing `/api/manager-parent/programs/{id}/logs` and parse it client-side (simpler)

---

### 3.6.2 Add Country Flag + Country Name to All IP Displays

**Applies to:** IP Analytics, BIOS History, Program Logs (Login Events tab), any other table showing IP addresses.

- [ ] Create `frontend/src/utils/countryFlag.ts` — a utility function:
  ```ts
  export function countryCodeToFlag(code: string): string {
    // converts 'EG' → '🇪🇬', 'SA' → '🇸🇦', etc.
    return [...code.toUpperCase()].map(c =>
      String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))
    ).join('')
  }
  export function formatIpLocation(country: string, city: string, countryCode: string): string {
    return `${countryCodeToFlag(countryCode)} ${country}${city ? ` / ${city}` : ''}`
  }
  ```
- [ ] In Program Logs Login Events tab: for each IP in the table, call `ipapi.co/{ip}/json/` (client-side) to resolve country — cache results in a `Map` to avoid duplicate requests for same IP
- [ ] Show: `🇪🇬 Egypt / Cairo` in the Location column
- [ ] For `127.0.0.1` or private IPs: show `🖥️ Localhost / Local` — do not call the geolocation API for these
- [ ] VPN/Proxy column: if `ipapi.co` returns `"proxy": true` or `"hosting": true` → show red badge "VPN/Proxy"
- [ ] Add i18n keys: `ipAnalytics.columns.country`, `ipAnalytics.columns.location`, `ipAnalytics.vpnProxy`

---

### 3.6.3 Fix External API Key Field — Placeholder and Masking After Save

**Problem:** After saving a program with an API key, the API Key input field shows the previous value (looks like `try@gmail.com` leaked in) instead of a masked placeholder. The field should NEVER show the raw key — it is write-only.

**Files:** `frontend/src/pages/manager-parent/SoftwareManagement.tsx`, `frontend/src/pages/manager/SoftwareManagement.tsx`

- [ ] In the **Edit Program** form, when `program.has_external_api === true`:
  - Do NOT pre-fill the API key input with any value — leave it empty
  - Show placeholder text: `"Leave blank to keep current key (••••••••••••••)"`
  - Show a green **"API Configured ✓"** badge next to the field label
  - If user types a new 14-char key → it replaces the existing one on save
  - If user leaves it blank → backend keeps the existing encrypted key (don't send `external_api_key` in payload if field is empty)
- [ ] In the **Create Program** form (when `has_external_api === false`):
  - Placeholder: `"e.g. L9H2F7Q8XK6M4A"` (14 characters)
  - Below the input: add a helper line showing what this key does:
    `"Used in: GET /apiuseradd/{this_key}/{username}/{bios}"`
- [ ] For External Software ID field:
  - Placeholder: `"e.g. 8"` (the numeric ID)
  - Below the input: helper line: `"Used in: GET /apilogs/{this_id} and /apiusers/{this_id}"`
- [ ] The raw API key must NEVER appear anywhere in the frontend — check that `serializeProgram()` in both backend controllers does not return `external_api_key_encrypted`
- [ ] After saving: the field resets to empty, badge shows green, placeholder updates

---

### 3.6.4 Convert Add/Edit Program Form from Modal to Full Page

**Problem:** The "Add Program" modal is too large for a dialog popup — it has 10+ fields and feels cramped.

**Files:** `frontend/src/pages/manager-parent/SoftwareManagement.tsx`, `frontend/src/pages/manager/SoftwareManagement.tsx`

- [ ] Create a new full page: `frontend/src/pages/manager-parent/ProgramForm.tsx`
  - Route: `/:lang/software-management/create` (new) and `/:lang/software-management/{id}/edit` (new)
  - Add to `frontend/src/router/routes.ts`:
    ```ts
    programCreate: (lang) => `/${lang}/software-management/create`,
    programEdit: (lang, id) => `/${lang}/software-management/${id}/edit`,
    ```
  - Add routes to `frontend/src/router/index.tsx` under manager-parent guard
- [ ] The SoftwareManagement list page: replace the "Add Program" modal trigger button with a `<Link>` to `/software-management/create`
- [ ] Each program card/row: replace "Edit" modal trigger with a `<Link>` to `/software-management/{id}/edit`
- [ ] Same for Manager: `frontend/src/pages/manager/ProgramForm.tsx` at routes `/:lang/manager/software-management/create` and `/:lang/manager/software-management/{id}/edit`
- [ ] The form page layout: 2-column grid on desktop, 1-column on mobile
  - Left column: Name, Version, Description, Download Link, File Size, System Requirements, Installation Guide URL
  - Right column: Trial Days, Base Price, Icon (upload or URL), Status toggle, External API Key, External Software ID
- [ ] "Cancel" button → navigate back to software list (`routePaths.managerParent.softwareManagement`)
- [ ] "Create Program" / "Save Changes" button → submit → on success navigate back to list with success toast
- [ ] Remove all modal/dialog code from the list page for Add/Edit — list page only has the table/cards and action buttons that navigate

---

### 3.6.5 Fix API Status Page — Show Real External Server Status

**Problem:** `/en/api-status` shows internal platform metrics. It should show the **real status of the external activation server** (`72.60.69.185`).

**Files:** `frontend/src/pages/manager-parent/ApiStatus.tsx`, `backend/app/Http/Controllers/ManagerParent/ApiStatusController.php`

- [ ] Open `backend/app/Http/Controllers/ManagerParent/ApiStatusController.php`
- [ ] In `index()` method: call `ExternalApiService::getSoftwareStats(8)` (use software_id 8 as the health check) — if response is 200 → status `online`, if timeout/503 → `offline`
- [ ] Return:
  ```json
  { "status": "online", "response_time_ms": 145, "last_checked": "2026-03-01T12:00:00Z", "external_url": "http://72.60.69.185" }
  ```
- [ ] In `frontend/src/pages/manager-parent/ApiStatus.tsx`:
  - Show the external server URL `http://72.60.69.185` as the monitored endpoint
  - Show Online/Offline/Degraded badge based on real response
  - Show response time in ms (from the real HTTP call)
  - Show "Last checked" timestamp
  - Add a **"Ping Now"** button → calls the API and refreshes the status immediately
  - Remove any reference to internal Laravel API metrics — this page is ONLY about the external activation server

---

### 3.6.6 Replace Duration (Days) Input with Date/Time Picker in ACTIVATE Modal

**Problem:** The ACTIVATE modal shows "Duration (days)" as a plain number input. User needs to be able to select duration in **minutes, hours, or days**, or pick an exact **end date** from a calendar.

**File:** `frontend/src/components/ActivateLicenseModal.tsx`

- [ ] Replace the `<Input type="number">` for `duration_days` with a **date/time picker** component
- [ ] Use the existing `frontend/src/components/ui/date-range-picker.tsx` or create a new `DurationPicker` component
- [ ] The picker has two modes (tabs or toggle):
  - **Mode 1: "Duration"** — select a unit (Minutes / Hours / Days) + enter a number
    - Examples: 30 Minutes, 2 Hours, 7 Days, 30 Days
    - Quick select buttons: `30 min`, `1 hr`, `6 hr`, `1 day`, `7 days`, `30 days`, `90 days`
  - **Mode 2: "End Date"** — calendar date picker to select the exact expiry date
    - Converts selected date to `duration_days = Math.ceil((endDate - now) / 86400000)`
- [ ] Total Price auto-updates as duration changes — for sub-day durations: `price = (duration_minutes / 1440) × base_price_per_day` (rounded up to 2 decimal places)
- [ ] The payload sent to backend must remain `duration_days` (float allowed: `0.5` = 12 hours, `0.021` = 30 minutes)
- [ ] Backend `LicenseService` validation: change `'duration_days' => ['required', 'integer', 'min:1']` to `'duration_days' => ['required', 'numeric', 'min:0.014']` (≥ 20 minutes minimum)
- [ ] `expires_at` in DB: `now()->addMinutes((int)round($data['duration_days'] * 1440))`
- [ ] Add i18n keys: `activate.durationMode`, `activate.endDateMode`, `activate.minutes`, `activate.hours`, `activate.days`, `activate.quickSelect`
- [ ] Arabic: `"دقائق"`, `"ساعات"`, `"أيام"`, `"تاريخ الانتهاء"`

---

### 3.6.7 Add Reseller Attribution to Program Logs Activation Events

**Problem:** Program Logs shows "Added — TESTUSER — TESTBIOS999" but no info about WHICH reseller made the activation from the dashboard.

**Context:** The external server logs don't include reseller info — we must enrich from our own `licenses` table.

**File:** `frontend/src/pages/manager-parent/ProgramLogs.tsx`, `backend/app/Http/Controllers/ManagerParent/ProgramLogsController.php`

- [ ] In `ProgramLogsController::show(Program $program)`:
  - After fetching raw logs from `ExternalApiService::getProgramLogs()`, also query our `licenses` table:
    ```php
    $licenses = License::query()
        ->where('program_id', $program->id)
        ->with(['reseller:id,name,email'])
        ->get()
        ->keyBy('external_username'); // keyed by BIOS ID / external username
    ```
  - Return both: `{ raw: '...', licenses: { 'BIOS123': { reseller_name: 'Ahmed', reseller_email: 'ahmed@...' } } }`
- [ ] In `frontend/src/pages/manager-parent/ProgramLogs.tsx`, Activation Events tab:
  - Add **"Activated By"** column: look up the BIOS ID in `licenses` map → show reseller name
  - If the activation was done from the dashboard → show reseller name + "via Dashboard" badge
  - If the BIOS is not in our DB (was done directly via external API by an unknown user) → show `"External (unknown)"` in gray
- [ ] Add "Activated By" column to the Activation Events table between "BIOS ID" and "Timestamp"

---

### 3.6.8 Show Username Alongside BIOS ID on All Pages

**Problem:** All pages showing BIOS IDs show only the raw BIOS string. The linked username (stored in `licenses.external_username` or `users.username`) should be shown too.

**Applies to these pages:**
- `frontend/src/pages/manager-parent/BiosHistory.tsx`
- `frontend/src/pages/manager-parent/BiosConflicts.tsx` (already shows it — keep this pattern)
- `frontend/src/pages/manager-parent/ProgramLogs.tsx` (Activation Events tab)
- `frontend/src/pages/reseller/Licenses.tsx`
- `frontend/src/pages/manager/Software.tsx`

- [ ] For each of these pages, update the BIOS ID column to show:
  ```
  BIOS-1001
  @ahmed_bios
  ```
  (BIOS ID on top, username in smaller gray text below — like a subtext)
- [ ] The username is fetched from our `licenses` table: `licenses.external_username` or the linked `customer.username`
- [ ] Backend changes: in the respective controller's `index()` serialization, include `username` alongside `bios_id`:
  ```php
  'bios_id' => $license->bios_id,
  'external_username' => $license->external_username,
  ```

---

### 3.6.9 Clickable Username → User Detail Page

**Problem:** When a username appears in any table (BIOS Conflicts, BIOS History, Program Logs, Licenses), clicking it should open a detailed profile page for that user.

- [ ] Create `frontend/src/pages/manager-parent/CustomerDetail.tsx` (NEW PAGE)
  - Route: `/:lang/customers/{id}` (add to `routes.ts` and `index.tsx`)
  - This is a **standalone detail page** — not a modal
- [ ] Page sections:
  1. **User Info card**: Name, Email, Phone, Username (BIOS locked), Created By (reseller name), Created At, Status badge
  2. **Active Licenses table**: all licenses for this customer — columns: Program, BIOS ID, Activated By (reseller), Activation Date, Expiry Date, Duration, Status, Actions (Deactivate button)
  3. **All Resellers who activated for this customer**: reseller name, email, how many activations, last activation date
  4. **Login IP History**: from `user_ip_logs` table — IP, Country (flag + name), City, ISP, VPN badge, Timestamp
  5. **Activity Log**: recent activity_logs entries related to this customer
- [ ] Make the username/customer name **a clickable link** in these pages:
  - `BiosConflicts.tsx` → "Affected Customers" column → link to `/customers/{customer_id}`
  - `BiosHistory.tsx` → username column → link
  - `ProgramLogs.tsx` → username in Activation Events → link (if we can resolve username to customer_id from our DB)
  - `Licenses.tsx` (reseller) → customer name → link
- [ ] Backend: `GET /api/manager-parent/customers/{id}` — return full customer object with:
  - `licenses` (all, with program + reseller info)
  - `ip_logs` (from `user_ip_logs`)
  - `activity` (from `activity_logs`)
  - `resellers_summary` (aggregated reseller list)

---

### 3.6.10 Add Placeholder Text to External API Key and Software ID Fields

**Context:** The External API Key and External Software ID fields need descriptive placeholders so managers who don't know the URL format can understand what to enter.

**Files:** `frontend/src/pages/manager-parent/SoftwareManagement.tsx` (and new `ProgramForm.tsx`), `frontend/src/pages/manager/SoftwareManagement.tsx` (and new `ProgramForm.tsx`)

- [ ] **External API Key** input:
  - `placeholder="e.g. L9H2F7Q8XK6M4A"`
  - Helper text below: `"Used as: /apiuseradd/[THIS_KEY]/username/bios"`
  - Show as `type="password"` with show/hide eye icon
  - Max length: 50 characters (allow variable length keys, not just 14 — different software providers may use different key lengths)
  - Change validation in both backend controllers from `size:14` to `max:100` to support any length
- [ ] **External Software ID** input:
  - `placeholder="e.g. 8"`
  - Helper text below: `"Used as: /apilogs/[THIS_ID] and /apiusers/[THIS_ID]"`
  - Type: number, min=1
- [ ] These helper texts must use i18n keys (see 3.5.14 for existing keys — extend them):
  - `software.apiKeyUrlHint` → `"Used as: /apiuseradd/[KEY]/username/bios"`
  - `software.softwareIdUrlHint` → `"Used as: /apilogs/[ID] and /apiusers/[ID]"`
  - Arabic: `"يُستخدم في: /apiuseradd/[المفتاح]/اسم-المستخدم/البايوس"`
- [ ] Note: also update `backend/app/Http/Controllers/ManagerParent/ProgramController.php` and `Manager/SoftwareController.php` — change `'external_api_key' => ['nullable', 'string', 'size:14']` to `'nullable', 'string', 'max:100'`

---

### 3.6.11 Final Verification Checklist for Phase 3.6

- [ ] **IP Analytics**: Select a software → table shows real login IPs from `/apilogs/{id}` — no more `127.0.0.1 GET api/programs` rows
- [ ] **Country flags**: Egypt shows 🇪🇬, Saudi Arabia shows 🇸🇦, unknown shows 🏳️
- [ ] **API Status**: Page shows `http://72.60.69.185` as monitored endpoint — real Online/Offline badge — "Ping Now" button works
- [ ] **Add Program**: Clicking "Add Program" navigates to `/software-management/create` (full page) — no modal
- [ ] **Edit Program**: Clicking "Edit" navigates to `/software-management/{id}/edit` (full page) — no modal
- [ ] **API Key field on Edit**: Field is empty on load, placeholder reads "Leave blank to keep current key", green "API Configured ✓" badge visible — no raw key shown
- [ ] **API Key placeholder**: Helper text shows URL pattern `/apiuseradd/[KEY]/username/bios`
- [ ] **ACTIVATE modal — duration**: Shows mode toggle (Duration / End Date) — quick select buttons visible — `30 min`, `1 hr`, `1 day`, `30 days`
- [ ] **ACTIVATE modal — price**: Updates live as duration changes — `30 min` at $25/day → shows $0.52
- [ ] **Program Logs — reseller column**: Activation events show "Activated By: Ahmed Reseller via Dashboard" for dashboard activations
- [ ] **BIOS ID + username**: All BIOS ID cells show BIOS on top + username in gray below
- [ ] **Clickable username**: Clicking any username opens `/customers/{id}` detail page
- [ ] **Customer detail page**: Shows licenses, resellers, IP log, activity in 5 sections
- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Run `npm run build` — passes

---

### 3.6.12 Git Commit After Phase 3.6

- [ ] `git add -p` to stage changes file by file
- [ ] `git commit -m "feat: phase-3.6 ui fixes — IP analytics from external logs, duration picker, full-page program form, username links, API status, country flags"`

---

---

## SEC-LOGIN-1: Login Page Production Layout

**Goal:** Polish the login page to match a final production-ready design. Remove dev-only artifacts, ensure it looks professional on all screen sizes.

**File:** `frontend/src/pages/auth/Login.tsx`

---

### SEC-LOGIN-1.1 Remove Dev Artifacts and Cleanup

- [ ] Open `frontend/src/pages/auth/Login.tsx`
- [ ] Remove any test accounts panel / "Quick login" buttons / demo credentials section that may have been added during development
- [ ] Remove console.log / debug output from the login form's submit handler
- [ ] Remove any hardcoded test emails or passwords from placeholder attributes
- [ ] Ensure the form does NOT autofill with any dev credentials

---

### SEC-LOGIN-1.2 Final UI Layout

- [ ] Centered card layout: max-width `440px`, vertically centered on screen (full viewport height)
- [ ] Background: dark gradient or subtle pattern — consistent with the app's dark theme
- [ ] Card: rounded corners, soft shadow, padding `2rem`
- [ ] **Logo / Brand**: Show the OBD2SW logo (or app name text) at the top center of the card
- [ ] **Title**: `"Sign In"` (i18n: `login.title`) — `font-size: 1.5rem`, bold
- [ ] **Subtitle**: `"OBD2SW License Management Platform"` (i18n: `login.subtitle`) — small gray text below title
- [ ] **Email field**: label `"Email Address"`, placeholder `"your@email.com"`, full width
- [ ] **Password field**: label `"Password"`, placeholder `"••••••••"`, show/hide toggle (eye icon), full width
- [ ] **Sign In button**: full width, primary color, rounded, height `44px`
- [ ] **NO** "Forgot Password?" link (feature doesn't exist — see SEC-LOGIN-2)
- [ ] **NO** "Register" / "Create Account" link (no self-registration in this SaaS)
- [ ] Footer text below card: `"© 2026 OBD2SW. All rights reserved."` — small gray centered text
- [ ] Add i18n keys:
  - `login.title` → `"Sign In"` / `"تسجيل الدخول"`
  - `login.subtitle` → `"OBD2SW License Management Platform"` / `"منصة إدارة تراخيص OBD2SW"`
  - `login.emailLabel` → `"Email Address"` / `"البريد الإلكتروني"`
  - `login.passwordLabel` → `"Password"` / `"كلمة المرور"`
  - `login.submitBtn` → `"Sign In"` / `"دخول"`
  - `login.footer` → `"© 2026 OBD2SW. All rights reserved."` / `"© 2026 OBD2SW. جميع الحقوق محفوظة."`

---

### SEC-LOGIN-1.3 Responsive Design

- [ ] On mobile (`< 480px`): card takes full width with `1rem` horizontal padding — no rounded corners on mobile edge
- [ ] On tablet (`480px–768px`): card at `440px` max-width, centered
- [ ] On desktop: same as tablet — card centered in viewport
- [ ] Language switcher (AR/EN): small button in top-right corner of the page — always visible regardless of card position
- [ ] RTL (Arabic): all text right-aligned, eye icon on left side of password field, correct `dir="rtl"` on the card

---

### SEC-LOGIN-1.4 Error and Loading States

- [ ] **Loading state**: Sign In button shows spinner + disabled during request — button text changes to `"Signing in..."` (`login.signingIn`)
- [ ] **Error state**: red alert box below the button — shows the error message from API (`"Invalid credentials."`) — dismissible with X button
- [ ] **Account locked state** (from SEC-PHASE): show lockout message with countdown timer (see SEC-4 for the component)
- [ ] **Network error**: show `"Unable to connect. Please try again."` in a yellow warning box

---

### SEC-LOGIN-1.5 Verification Checklist

- [ ] Page renders at `/ar/login` and `/en/login` correctly
- [ ] No "Forgot Password?" link visible anywhere on the page
- [ ] No demo/test credentials visible
- [ ] Submit button disabled while loading
- [ ] Error message clears when user starts typing again
- [ ] RTL layout correct for Arabic
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run build` — passes

---

---

## SEC-LOGIN-2: Delete Forgot Password Page

**Goal:** Completely remove the forgot-password feature since it doesn't exist. Eliminate the route, the page component, any links pointing to it, and any related backend code.

---

### SEC-LOGIN-2.1 Delete Frontend Page and Route

- [ ] Delete file: `frontend/src/pages/auth/ForgotPassword.tsx`
- [ ] Open `frontend/src/router/routes.ts` — remove the forgot-password route entry
- [ ] Open `frontend/src/router/index.tsx` — remove the `<Route>` for `/forgot-password`
- [ ] Search entire frontend for any link pointing to forgot-password:
  ```bash
  grep -r "forgot-password\|forgotPassword\|forgot_password" frontend/src/ --include="*.tsx" --include="*.ts"
  ```
- [ ] Remove all found links (expected location: `frontend/src/pages/auth/Login.tsx`)

---

### SEC-LOGIN-2.2 Delete Backend Route and Controller (if any)

- [ ] Open `backend/routes/api.php` — search for `forgot` or `password/reset` routes — remove if found
- [ ] Search for any controller handling password resets:
  ```bash
  grep -r "ForgotPassword\|PasswordReset\|resetPassword\|sendResetLink" backend/app/ --include="*.php"
  ```
- [ ] Delete any found controller files (unlikely to exist but verify)
- [ ] If any password reset migration or table exists in DB, do NOT drop it — leave DB alone; just remove routes and code

---

### SEC-LOGIN-2.3 Delete i18n Keys

- [ ] Open `frontend/src/locales/en.json` — search for any `forgotPassword` keys — remove them
- [ ] Open `frontend/src/locales/ar.json` — remove the same keys
- [ ] Common keys to remove: `login.forgotPassword`, `auth.forgotPassword`, `forgotPassword.*`

---

### SEC-LOGIN-2.4 Verification Checklist

- [ ] Navigating to `/ar/forgot-password` returns 404 (page not found)
- [ ] No link on the login page points to forgot-password
- [ ] No TypeScript errors from removed component
- [ ] `grep -r "forgot-password" frontend/src/` returns zero results
- [ ] `npm run build` — passes

---

---

## SEC-PHASE: Login Security — Rate Limiting + Account Lockout + Super Admin Unblock

**Goal:** Add progressive login rate limiting to prevent brute-force attacks. After 5 failed attempts, lock the account with escalating lockout durations. Super Admin gets a new SecurityLocks page (11th page) to view and manually unblock IPs or accounts.

**Stack:** Laravel Cache (Redis or file driver) — no 3rd-party packages needed.

**Lockout progression:**
```
Attempt 1–4:  No lockout — just wrong password message
Attempt 5:    Locked for 1 minute
Attempt 6:    Locked for 5 minutes  (reset attempt counter after lockout expires)
Attempt 7:    Locked for 1 hour
Attempt 8:    Locked for 10 hours
Attempt 9:    Locked for 24 hours
Attempt 10+:  IP permanently blocked (added to a blocked_ips cache key, Super Admin must unblock manually)
```

---

### SEC-1: Create `LoginSecurityService.php` — Core Lockout Logic

**File:** `backend/app/Services/LoginSecurityService.php` (NEW FILE)

- [ ] Create `backend/app/Services/LoginSecurityService.php`
- [ ] Register it in `backend/app/Providers/AppServiceProvider.php` as a singleton (or use automatic resolution)
- [ ] Methods to implement:

  **`recordFailedAttempt(string $email, string $ip): void`**
  - Increment `Cache::increment("login_attempts:{$email}")` with TTL 24 hours
  - Increment `Cache::increment("login_attempts_ip:{$ip}")` with TTL 24 hours
  - Get total attempt count → determine lockout duration from progression table
  - Store `Cache::put("login_locked:{$email}", $unlocksAt->timestamp, $lockoutDuration)`

  **`isLocked(string $email, string $ip): array`**
  - Check `Cache::get("login_locked:{$email}")` → if exists and future timestamp → return `['locked' => true, 'unlocks_at' => timestamp, 'seconds_remaining' => int]`
  - Check `Cache::get("ip_blocked:{$ip}")` → if exists → return `['locked' => true, 'reason' => 'ip_blocked', 'unlocks_at' => null]`
  - Otherwise → return `['locked' => false]`

  **`clearAttempts(string $email, string $ip): void`**
  - On successful login: `Cache::forget("login_attempts:{$email}")`, `Cache::forget("login_locked:{$email}")`, `Cache::forget("login_attempts_ip:{$ip}")`

  **`getLockoutDuration(int $attemptCount): int`** (returns seconds)
  - `5 → 60`, `6 → 300`, `7 → 3600`, `8 → 36000`, `9 → 86400`, `10+ → PHP_INT_MAX` (permanent block)

  **`blockIp(string $ip): void`**
  - `Cache::forever("ip_blocked:{$ip}", now()->toIso8601String())`

  **`unblockEmail(string $email): void`**
  - `Cache::forget("login_locked:{$email}")`, `Cache::forget("login_attempts:{$email}")`

  **`unblockIp(string $ip): void`**
  - `Cache::forget("ip_blocked:{$ip}")`

  **`getLockedAccounts(): array`** — used by Super Admin SecurityLocks page
  - Iterate over all cache keys matching `login_locked:*` — return list of `[email, unlocks_at, attempt_count]`
  - **Note:** With file cache driver, use `Cache::getStore()` to scan. With Redis, use `Redis::keys("login_locked:*")`

  **`getBlockedIps(): array`** — used by Super Admin SecurityLocks page
  - Same pattern for `ip_blocked:*` keys

---

### SEC-2: Integrate into `AuthController` Login Method

**File:** `backend/app/Http/Controllers/AuthController.php`

- [ ] Open `AuthController.php` — find the `login()` method
- [ ] Inject `LoginSecurityService` via constructor: `public function __construct(private readonly LoginSecurityService $loginSecurity) {}`
- [ ] At the **start** of `login()`, before any DB query:
  ```php
  $ip = $request->ip();
  $email = $request->input('email', '');
  $lockStatus = $this->loginSecurity->isLocked($email, $ip);
  if ($lockStatus['locked']) {
      return response()->json([
          'message' => 'Account temporarily locked due to too many failed attempts.',
          'locked' => true,
          'unlocks_at' => $lockStatus['unlocks_at'] ?? null,
          'seconds_remaining' => $lockStatus['seconds_remaining'] ?? null,
          'reason' => $lockStatus['reason'] ?? 'too_many_attempts',
      ], 429);
  }
  ```
- [ ] After a **failed** login attempt (wrong password or user not found):
  ```php
  $this->loginSecurity->recordFailedAttempt($email, $ip);
  // Check if attempt #10 → block IP permanently
  $attempts = Cache::get("login_attempts_ip:{$ip}", 0);
  if ($attempts >= 10) {
      $this->loginSecurity->blockIp($ip);
  }
  ```
- [ ] After a **successful** login:
  ```php
  $this->loginSecurity->clearAttempts($email, $ip);
  ```
- [ ] The existing `"Invalid credentials."` message stays for wrong password — lockout uses a different `429` response with `locked: true` flag

---

### SEC-3: Create Super Admin `SecurityController.php`

**File:** `backend/app/Http/Controllers/SuperAdmin/SecurityController.php` (NEW FILE)

- [ ] Create `backend/app/Http/Controllers/SuperAdmin/SecurityController.php`
- [ ] Extend `BaseSuperAdminController` (or whatever the super admin base is)
- [ ] Methods:

  **`index(Request $request): JsonResponse`** — list all locked accounts and blocked IPs
  ```php
  return response()->json([
      'locked_accounts' => $this->loginSecurity->getLockedAccounts(),
      'blocked_ips' => $this->loginSecurity->getBlockedIps(),
  ]);
  ```

  **`unblockEmail(Request $request): JsonResponse`**
  ```php
  $request->validate(['email' => ['required', 'email']]);
  $this->loginSecurity->unblockEmail($request->email);
  $this->logActivity($request, 'security.unblock_email', "Unblocked account: {$request->email}");
  return response()->json(['message' => "Account {$request->email} has been unblocked."]);
  ```

  **`unblockIp(Request $request): JsonResponse`**
  ```php
  $request->validate(['ip' => ['required', 'ip']]);
  $this->loginSecurity->unblockIp($request->ip);
  $this->logActivity($request, 'security.unblock_ip', "Unblocked IP: {$request->ip}");
  return response()->json(['message' => "IP {$request->ip} has been unblocked."]);
  ```

---

### SEC-4: Add Backend Routes

**File:** `backend/routes/api.php`

- [ ] Open `backend/routes/api.php`
- [ ] Find the super admin route group (protected by `auth:sanctum` + super admin role middleware)
- [ ] Add inside that group:
  ```php
  // Security Locks
  Route::get('/super-admin/security/locks', [SecurityController::class, 'index']);
  Route::post('/super-admin/security/unblock-email', [SecurityController::class, 'unblockEmail']);
  Route::post('/super-admin/security/unblock-ip', [SecurityController::class, 'unblockIp']);
  ```
- [ ] Add `use App\Http\Controllers\SuperAdmin\SecurityController;` import at the top

---

### SEC-5: Frontend Login — Lockout UI with Countdown Timer

**File:** `frontend/src/pages/auth/Login.tsx`

- [ ] After a failed login attempt, check if the API response has `status === 429` and `data.locked === true`
- [ ] If locked:
  - Hide the login form fields (or gray them out + disable)
  - Show a red lockout banner:
    ```
    ⛔ Account Locked
    Too many failed login attempts.
    Try again in: 04:58
    [countdown timer ticking down in real time]
    ```
  - Countdown timer: use `setInterval` every second, decrement `seconds_remaining` — when it hits 0, re-enable the form and hide the banner
  - If `reason === 'ip_blocked'` and `unlocks_at === null`: show permanent block message: `"Your IP has been blocked. Contact support to regain access."`
- [ ] Create a helper component `frontend/src/components/auth/LockoutBanner.tsx`:
  - Props: `secondsRemaining: number | null`, `reason: string`, `onExpired: () => void`
  - Shows countdown OR permanent block message
  - Uses `useEffect` + `setInterval` for the timer
- [ ] Add i18n keys:
  - `login.locked` → `"Account Locked"` / `"الحساب مقفل"`
  - `login.lockedMessage` → `"Too many failed login attempts."` / `"محاولات تسجيل دخول فاشلة كثيرة جداً."`
  - `login.tryAgainIn` → `"Try again in:"` / `"حاول مجدداً خلال:"`
  - `login.ipBlocked` → `"Your IP has been blocked. Contact support."` / `"تم حظر عنوان IP الخاص بك. تواصل مع الدعم."`
  - `login.countdownExpired` → `"You may try again now."` / `"يمكنك المحاولة مرة أخرى الآن."`

---

### SEC-6: Create `SecurityLocks.tsx` — Super Admin 11th Page

**File:** `frontend/src/pages/super-admin/SecurityLocks.tsx` (NEW FILE)

- [ ] Create `frontend/src/pages/super-admin/SecurityLocks.tsx`
- [ ] Add route: `/:lang/security-locks` inside Super Admin protected routes in `frontend/src/router/index.tsx`
- [ ] Add to `frontend/src/router/routes.ts` as a Super Admin route
- [ ] Add to the Super Admin sidebar in `frontend/src/components/layout/Sidebar.tsx`:
  - Icon: `ShieldAlert` (from lucide-react)
  - Label: `"Security Locks"` / `"الأمان والقفل"` (i18n: `nav.securityLocks`)
  - Position: last item in the Super Admin section (11th page, was 10)

**Page layout — two tabs: "Locked Accounts" and "Blocked IPs"**

**Tab 1: Locked Accounts**
- [ ] Table columns: Email | Locked Since | Unlocks At | Attempts | Action
- [ ] Action: `[Unblock]` button → calls `POST /api/super-admin/security/unblock-email` with `{ email }` → removes from table on success
- [ ] Empty state: `"No accounts are currently locked."` with a green shield icon

**Tab 2: Blocked IPs**
- [ ] Table columns: IP Address | Country (flag + name) | Blocked Since | Action
- [ ] Action: `[Unblock IP]` button → calls `POST /api/super-admin/security/unblock-ip` with `{ ip }` → removes from table on success
- [ ] Country detection: use the same `getCountryFromIp()` utility as IP Analytics page
- [ ] Empty state: `"No IPs are currently blocked."` with a green shield icon

**Common:**
- [ ] Auto-refresh every 30 seconds (use `useQuery` with `refetchInterval: 30000`)
- [ ] Manual `[Refresh]` button top-right
- [ ] Add i18n keys:
  - `nav.securityLocks` → `"Security Locks"` / `"الأمان والقفل"`
  - `security.lockedAccounts` → `"Locked Accounts"` / `"الحسابات المقفلة"`
  - `security.blockedIps` → `"Blocked IPs"` / `"عناوين IP المحظورة"`
  - `security.unblock` → `"Unblock"` / `"إلغاء القفل"`
  - `security.noLockedAccounts` → `"No accounts are currently locked."` / `"لا توجد حسابات مقفلة حالياً."`
  - `security.noBlockedIps` → `"No IPs are currently blocked."` / `"لا توجد عناوين IP محظورة حالياً."`
  - `security.unlocksAt` → `"Unlocks At"` / `"ينتهي القفل في"`
  - `security.blockedSince` → `"Blocked Since"` / `"محظور منذ"`

---

### SEC-7: Frontend Service for Security API

**File:** `frontend/src/services/security.service.ts` (NEW FILE)

- [ ] Create `frontend/src/services/security.service.ts`
- [ ] Implement:
  ```typescript
  export const securityService = {
    getLocks: () => api.get('/super-admin/security/locks'),
    unblockEmail: (email: string) => api.post('/super-admin/security/unblock-email', { email }),
    unblockIp: (ip: string) => api.post('/super-admin/security/unblock-ip', { ip }),
  };
  ```
- [ ] Add TypeScript types in `frontend/src/types/super-admin.types.ts`:
  ```typescript
  export interface LockedAccount {
    email: string;
    locked_since: string;
    unlocks_at: string;
    attempt_count: number;
  }
  export interface BlockedIp {
    ip: string;
    blocked_since: string;
    country_code?: string;
    country_name?: string;
  }
  export interface SecurityLocksData {
    locked_accounts: LockedAccount[];
    blocked_ips: BlockedIp[];
  }
  ```

---

### SEC-8: Tests and Final Verification

- [ ] Manual test — login with wrong password 5 times:
  - 1st–4th attempt: response `401 {"message":"Invalid credentials."}` — no lockout
  - 5th attempt: response `429 {"locked":true,"seconds_remaining":60}` — form locked — countdown visible
  - Wait 60 seconds → form re-enables automatically (timer hits 0)
- [ ] 6th wrong attempt → locked 5 minutes
- [ ] 10th wrong attempt → IP blocked permanently
- [ ] Super Admin navigates to `/en/security-locks` → sees the blocked IP in "Blocked IPs" tab
- [ ] Super Admin clicks "Unblock IP" → IP removed from list → login works again
- [ ] Successful login after lockout → `clearAttempts()` resets the counter → subsequent failures restart from attempt 1
- [ ] Test with Redis cache driver (`CACHE_DRIVER=redis` in `.env`) — verify keys expire correctly
- [ ] Test with file cache driver (`CACHE_DRIVER=file`) — verify it works without Redis
- [ ] Add unit test: `tests/Unit/LoginSecurityServiceTest.php`
  - Test `getLockoutDuration()` returns correct seconds for each attempt count
  - Test `isLocked()` returns correct structure when locked/unlocked
- [ ] Run `php artisan test` — passes
- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Run `npm run build` — passes

---

### SEC-9: Git Commit After SEC-PHASE Core

- [ ] `git add -p` to stage changes file by file
- [ ] `git commit -m "feat: sec-phase — login rate limiting, progressive lockout, super admin security locks page"`

---

---

## SEC-PHASE ENHANCEMENTS (Phase 2) — SEC-10 → SEC-15

**Goal:** Extend the core security system with User Agent tracking, GeoIP enrichment, suspicious login email alerts, permanent IP block UI messaging, rate-limit response headers, and a full security audit log.

**Estimated time:** ~50 minutes total

---

### SEC-10: User Agent Tracking on Locked/Blocked Entries (~5 min)

**Purpose:** Record device/browser when an IP is blocked or account is locked. SecurityLocks page shows `"Blocked from iPhone Safari"` instead of a bare IP.

**Files:** `backend/app/Services/LoginSecurityService.php`, `backend/app/Http/Controllers/SuperAdmin/SecurityController.php`, `frontend/src/pages/super-admin/SecurityLocks.tsx`

- [ ] In `LoginSecurityService::recordFailedAttempt()`, capture `request()->userAgent()` alongside the IP
- [ ] Store user agent in the cache payload when blocking an IP:
  ```php
  Cache::forever("ip_blocked:{$ip}", [
      'blocked_since' => now()->toIso8601String(),
      'user_agent'    => request()->userAgent(),
  ]);
  ```
- [ ] In `getBlockedIps()` and `getLockedAccounts()`, include `user_agent` in the returned array
- [ ] In `SecurityController::index()`, pass `user_agent` through to the JSON response
- [ ] In `SecurityLocks.tsx` — "Blocked IPs" tab, add a **Device** column:
  - Parse User Agent into human-readable text (contains `iPhone`+`Safari` → `"iPhone Safari"`, `Android`+`Chrome` → `"Android Chrome"`, `Windows`+`Chrome` → `"Windows Chrome"`, unknown → `"Unknown Device"`)
  - Show as small gray subtext below the IP address
- [ ] Add i18n key: `security.device` → `"Device"` / `"الجهاز"`

---

### SEC-11: GeoIP Country + City on SecurityLocks Page (~10 min)

**Purpose:** Show `"🇪🇬 Egypt / Damanhour"` next to each blocked IP — reuse GeoIP logic from IP Analytics page.

**Files:** `backend/app/Services/GeoIpService.php` (create if not exists), `backend/app/Http/Controllers/SuperAdmin/SecurityController.php`, `frontend/src/pages/super-admin/SecurityLocks.tsx`

**Backend:**
- [ ] If `GeoIpService` does not yet exist, create `backend/app/Services/GeoIpService.php`:
  - `lookup(string $ip): array` — calls `http://ip-api.com/json/{ip}?fields=countryCode,country,city,isp` (free, no key)
  - Returns `['country_code' => 'EG', 'country_name' => 'Egypt', 'city' => 'Damanhour', 'isp' => 'TE Data']`
  - Cache result for 24 hours: `Cache::remember("geo:{$ip}", 86400, fn() => ...)`
  - Return `['country_code' => null, 'country_name' => 'Unknown', 'city' => '', 'isp' => '']` on failure
- [ ] In `SecurityController::index()`, for each blocked IP call `app(GeoIpService::class)->lookup($ip)` and add `country_code`, `country_name`, `city`, `isp` to the entry
- [ ] Same enrichment for `locked_accounts` using the stored IP from the lock record

**Frontend:**
- [ ] "Blocked IPs" tab — **Country** column: emoji flag + `"country_name / city"` (reuse existing `getFlag(countryCode)` util)
- [ ] "Locked Accounts" tab — add small **"Last IP"** column: flag + city
- [ ] Add i18n keys: `security.country`, `security.city`, `security.lastIp`, `security.isp` (EN + AR)

---

### SEC-12: Suspicious Login Alert Email (~15 min)

**Purpose:** When a user logs in from a **new IP**, send an email: `"New login detected: Egypt / Damanhour — If this wasn't you, contact support."`

**Files:** `backend/app/Mail/SuspiciousLoginMail.php` (NEW), `backend/resources/views/emails/suspicious-login.blade.php` (NEW), `backend/app/Services/LoginSecurityService.php`, `backend/app/Http/Controllers/AuthController.php`

- [ ] Create `backend/app/Mail/SuspiciousLoginMail.php`:
  ```php
  class SuspiciousLoginMail extends Mailable {
      public function __construct(
          public string $userEmail,
          public string $ip,
          public string $country,
          public string $city,
          public string $device,
          public string $loginTime,
      ) {}
      public function envelope(): Envelope {
          return new Envelope(subject: 'New Login Detected — OBD2SW');
      }
      public function content(): Content {
          return new Content(view: 'emails.suspicious-login');
      }
  }
  ```
- [ ] Create `backend/resources/views/emails/suspicious-login.blade.php` (plain text template):
  ```
  Hello,

  A new login to your OBD2SW account was detected:

  Time:    {{ $loginTime }}
  IP:      {{ $ip }}
  Country: {{ $country }} / {{ $city }}
  Device:  {{ $device }}

  If this was you, no action is needed.
  If this wasn't you, contact support@obd2sw.com immediately.

  — OBD2SW Security Team
  ```
- [ ] In `LoginSecurityService`, add:
  - `isNewIp(string $email, string $ip): bool` — check `Cache::get("known_ips:{$email}", [])` — return `true` if `$ip` not in array
  - `recordKnownIp(string $email, string $ip): void` — append to array, `Cache::put("known_ips:{$email}", ..., now()->addDays(90))`
- [ ] In `AuthController::login()` after successful login:
  ```php
  if ($this->loginSecurity->isNewIp($user->email, $ip)) {
      $geo = app(GeoIpService::class)->lookup($ip);
      Mail::to($user->email)->queue(new SuspiciousLoginMail(
          userEmail: $user->email,
          ip: $ip,
          country: $geo['country_name'] ?? 'Unknown',
          city: $geo['city'] ?? 'Unknown',
          device: $request->userAgent() ?? 'Unknown',
          loginTime: now()->toIso8601String(),
      ));
      $this->loginSecurity->recordKnownIp($user->email, $ip);
  }
  ```
- [ ] Use `Mail::to()->queue()` (not `send()`) — requires `QUEUE_CONNECTION` in `.env`; set `QUEUE_CONNECTION=sync` for dev
- [ ] Add `.env` note: `MAIL_FROM_ADDRESS=security@obd2sw.com` must be set

---

### SEC-13: Permanent IP Block UI Message (~5 min)

**Purpose:** When a user's IP is permanently blocked (attempt 10+), show a clear non-countdown banner with support contact.

**File:** `frontend/src/components/auth/LockoutBanner.tsx`

- [ ] When `reason === 'ip_blocked'` AND `unlocks_at === null`, show a **permanent red block banner** (no timer):
  ```
  🚫 Access Permanently Blocked
  Your IP address has been permanently blocked
  due to excessive failed login attempts.

  To regain access, contact:
  support@obd2sw.com  ← clickable mailto: link
  ```
- [ ] Do NOT show countdown — `unlocks_at === null` means it's Super Admin-unblock only
- [ ] Add i18n keys:
  - `login.ipBlockedPermanent` → `"Access Permanently Blocked"` / `"تم حظر الوصول نهائياً"`
  - `login.ipBlockedMessage` → `"Your IP address has been permanently blocked due to excessive failed login attempts."` / `"تم حظر عنوان IP الخاص بك نهائياً بسبب كثرة محاولات الدخول الفاشلة."`
  - `login.contactSupport` → `"To regain access, contact:"` / `"للاسترداد، تواصل مع:"`
  - `login.supportEmail` → `"support@obd2sw.com"`

---

### SEC-14: Rate Limit Response Headers (~5 min)

**Purpose:** Return standard `X-RateLimit-*` headers so DevTools and monitoring show remaining attempts.

**File:** `backend/app/Http/Controllers/AuthController.php`

- [ ] Calculate `$remaining = max(0, 10 - Cache::get("login_attempts:{$email}", 0) - 1)` before recording the attempt
- [ ] On **success response** → add headers:
  ```php
  ->withHeaders(['X-RateLimit-Limit' => 10, 'X-RateLimit-Remaining' => $remaining])
  ```
- [ ] On **failed login (401)** → add headers after incrementing:
  ```php
  ->withHeaders([
      'X-RateLimit-Limit'     => 10,
      'X-RateLimit-Remaining' => max(0, 10 - Cache::get("login_attempts:{$email}", 0)),
      'X-RateLimit-Reset'     => now()->addDay()->timestamp,
  ])
  ```
- [ ] On **429 locked** → add headers:
  ```php
  ->withHeaders([
      'X-RateLimit-Limit'     => 10,
      'X-RateLimit-Remaining' => 0,
      'Retry-After'           => $lockStatus['seconds_remaining'] ?? 0,
      'X-RateLimit-Reset'     => now()->addSeconds($lockStatus['seconds_remaining'] ?? 0)->timestamp,
  ])
  ```
- [ ] Verify: Browser DevTools → Network → login request → Response Headers shows `X-RateLimit-Remaining: 4`

---

### SEC-15: Security Audit Log (~10 min)

**Purpose:** Every Super Admin unblock action recorded in `activity_logs`. New "Audit Log" tab in SecurityLocks page.

**Files:** `backend/app/Http/Controllers/SuperAdmin/SecurityController.php`, `frontend/src/pages/super-admin/SecurityLocks.tsx`

**Backend:**
- [ ] Confirm `unblockEmail()` logs with full metadata:
  ```php
  $this->logActivity($request, 'security.unblock_email', "Unblocked account: {$request->email}", [
      'unblocked_email' => $request->email,
      'admin_id'        => auth()->id(),
      'admin_ip'        => $request->ip(),
  ]);
  ```
- [ ] Confirm `unblockIp()` logs with full metadata:
  ```php
  $this->logActivity($request, 'security.unblock_ip', "Unblocked IP: {$request->input('ip')}", [
      'unblocked_ip' => $request->input('ip'),
      'admin_id'     => auth()->id(),
      'admin_ip'     => $request->ip(),
  ]);
  ```
- [ ] Add `auditLog()` method to `SecurityController`:
  ```php
  public function auditLog(): JsonResponse {
      $logs = ActivityLog::query()
          ->whereIn('action', ['security.unblock_email', 'security.unblock_ip', 'security.block_ip'])
          ->with('user:id,name,email')
          ->latest()
          ->paginate(50);
      return response()->json(['data' => $logs]);
  }
  ```
- [ ] Add route: `Route::get('/super-admin/security/audit-log', [SecurityController::class, 'auditLog']);`

**Frontend:**
- [ ] Add **"Audit Log"** as 3rd tab in `SecurityLocks.tsx`
- [ ] Table columns: Timestamp | Admin | Action | Target | Admin IP
  - Example row: `2026-03-01 14:32 | Super Admin | Unblocked IP | 197.55.1.2 | 192.168.1.1`
  - Action badge: green `"Unblocked IP"`, orange `"Unblocked Account"`
- [ ] Paginated — 50 entries per page with "Load more" button
- [ ] Add i18n keys: `security.auditLog`, `security.admin`, `security.action`, `security.target`, `security.adminIp`, `security.unblockedIp`, `security.unblockedAccount` (EN + AR)

---

### SEC-16: Final Verification Checklist for Full SEC-PHASE

- [ ] **Core lockout**: 5 wrong logins → `LockoutBanner` shows `"1:00 remaining"` countdown
- [ ] **Escalation**: 6th wrong → 5 min; 7th → 1 hour; 8th → 10 hours; confirm each level
- [ ] **IP block**: 10th wrong → response `429` + `reason: 'ip_blocked'` → permanent block banner with `mailto:` link
- [ ] **Rate limit headers**: Browser DevTools → `X-RateLimit-Remaining: 4` visible after 1 wrong attempt
- [ ] **User Agent in SecurityLocks**: Blocked IP shows device: `"Windows Chrome"` / `"iPhone Safari"`
- [ ] **GeoIP in SecurityLocks**: Blocked IP shows `🇪🇬 Egypt / Damanhour`
- [ ] **Unblock flow**: Super Admin clicks "Unblock IP" → IP removed from table → login works immediately
- [ ] **Audit log tab**: After unblocking, Audit Log tab shows entry with admin name + timestamp + target IP
- [ ] **New IP email alert**: Login from new IP → check mailbox → email received with country/city/device info
- [ ] **Permanent block banner**: Shows `"support@obd2sw.com"` as clickable `mailto:` link — no countdown
- [ ] **Arabic RTL**: SecurityLocks page correct in Arabic — all columns right-aligned
- [ ] Run `php artisan test` — passes (includes `LoginSecurityServiceTest.php`)
- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Run `npm run build` — passes

---

### SEC-17: Git Commit After Full SEC-PHASE

- [ ] `git add -p` to stage changes file by file
- [ ] `git commit -m "feat: sec-phase enhancements — user agent tracking, GeoIP, suspicious login alerts, permanent block UI, rate-limit headers, security audit log"`
