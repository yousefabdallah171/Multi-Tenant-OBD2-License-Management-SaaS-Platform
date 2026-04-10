# Manager Role Changes — Full Task Checklist

Status update as of 2026-04-09:
- Core implementation is complete
- Tenant 3 legacy reseller rows were backfilled to `main.parent@obd2sw.com`
- Use `docs/manager-role-changes-manual-qa-checklist.md` for final browser QA
- Use `docs/manager-role-changes-release-notes.md` for release and deployment notes

Reference plan: `docs/manager-role-changes-plan.md`

Mark each task `[x]` as you complete it.

---

## Phase 0 — Team Network Diagram Bug Fixes

Two bugs in the already-built Team Network diagram. Fix these first since they are quick and isolated.

### 0.1 Fix fitView Double-Fire (NetworkCanvas.tsx)

- [ ] Open `frontend/src/components/team-network/NetworkCanvas.tsx`
- [ ] Find the `<ReactFlow ...>` JSX element
- [ ] Remove the `fitView` prop from it (keep only the `onInit` callback which already calls `instance.fitView({ padding: 0.16 })`)
- [ ] Verify the diagram still fits to view on initial load

### 0.2 Fix AnimatedEdge CSS Injection Per Render

- [ ] Create `frontend/src/components/team-network/edges/AnimatedEdge.css` with:
  ```css
  @keyframes team-network-dash {
    from { stroke-dashoffset: 0; }
    to   { stroke-dashoffset: -20; }
  }
  ```
- [ ] Open `frontend/src/components/team-network/edges/AnimatedEdge.tsx`
- [ ] Add `import './AnimatedEdge.css'` at the top of the file
- [ ] Remove the `<style>{'@keyframes team-network-dash { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -20; } }'}</style>` element from the JSX return
- [ ] Verify edge animations still work in the browser

---

## Phase 1 — Backend: Remove Manager Software Routes + Controller

### 1.1 Remove Routes from api.php

- [ ] Open `backend/routes/api.php`
- [ ] Inside the `Route::prefix('manager')->middleware('role:manager')` group, remove these 5 routes:
  ```php
  Route::get('/software', [ManagerSoftwareController::class, 'index']);
  Route::post('/software', [ManagerSoftwareController::class, 'store']);
  Route::put('/software/{program}', [ManagerSoftwareController::class, 'update']);
  Route::delete('/software/{program}', [ManagerSoftwareController::class, 'destroy']);
  Route::post('/software/{program}/activate', [ManagerSoftwareController::class, 'activate']);
  ```
- [ ] Find and remove the `use App\Http\Controllers\Manager\SoftwareController as ManagerSoftwareController;` import at the top of the file

### 1.2 Delete SoftwareController

- [ ] Delete `backend/app/Http/Controllers/Manager/SoftwareController.php`

---

## Phase 2 — Backend: Security & Data Leak Fixes

### 2.1 Fix BaseManagerController — teamCustomersQuery()

- [ ] Open `backend/app/Http/Controllers/Manager/BaseManagerController.php`
- [ ] Verify `use App\Models\License;` is present in imports (add if missing)
- [ ] Replace `teamCustomersQuery()` method entirely:
  ```php
  protected function teamCustomersQuery(Request $request)
  {
      $sellerIds = $this->teamSellerIds($request);
      $customerIds = License::query()
          ->whereIn('reseller_id', $sellerIds)
          ->whereNotNull('customer_id')
          ->distinct()
          ->pluck('customer_id');
      return User::query()
          ->where('tenant_id', $this->currentTenantId($request))
          ->whereIn('id', $customerIds);
  }
  ```
- [ ] Replace `teamUsersQuery()` method entirely:
  ```php
  protected function teamUsersQuery(Request $request)
  {
      $sellerIds = $this->teamSellerIds($request);
      $customerIds = License::query()
          ->whereIn('reseller_id', $sellerIds)
          ->whereNotNull('customer_id')
          ->distinct()
          ->pluck('customer_id');
      return User::query()
          ->where('tenant_id', $this->currentTenantId($request))
          ->where(function ($builder) use ($sellerIds, $customerIds): void {
              $builder
                  ->whereIn('id', $sellerIds)
                  ->orWhereIn('id', $customerIds);
          });
  }
  ```
- [ ] Replace `resolveTeamUser()` method entirely:
  ```php
  protected function resolveTeamUser(Request $request, User $user): User
  {
      $role = $user->role?->value ?? (string) $user->role;
      if ($role === UserRole::RESELLER->value) {
          return $this->resolveTeamReseller($request, $user);
      }
      $sellerIds = $this->teamSellerIds($request);
      abort_unless(
          License::query()
              ->whereIn('reseller_id', $sellerIds)
              ->where('customer_id', $user->id)
              ->exists(),
          404,
      );
      return $user;
  }
  ```

### 2.2 Fix ActivityController — Add Tenant Filter

- [ ] Open `backend/app/Http/Controllers/Manager/ActivityController.php`
- [ ] In the `index()` method, find the `ActivityLog::query()` chain
- [ ] Add `->where('tenant_id', $this->currentTenantId($request))` as the first condition after `ActivityLog::query()`

### 2.3 Fix CustomerController — Remove manager_id Filter

- [ ] Open `backend/app/Http/Controllers/Manager/CustomerController.php`
- [ ] Remove `'manager_id' => ['nullable', 'integer'],` from the `$request->validate([...])` array
- [ ] Remove the `if (! empty($validated['manager_id'])) { $query->where('created_by', ...) }` block

### 2.4 Fix SuperAdmin FinancialReportController — total_customers Stat

- [ ] Open `backend/app/Http/Controllers/SuperAdmin/FinancialReportController.php`
- [ ] Find `$totalCustomers = User::query()->where('role', UserRole::CUSTOMER->value)->count();`
- [ ] Replace with:
  ```php
  $totalCustomers = License::query()
      ->whereNotNull('customer_id')
      ->distinct('customer_id')
      ->count('customer_id');
  ```
- [ ] Verify `use App\Models\License;` is imported at the top of the file

---

## Phase 3 — Backend: Super Admin Reseller Assignment

### 3.1 Add assignableManagers Endpoint

- [ ] Find the Super Admin tenant/team controller that handles tenant-specific user operations (check `SuperAdmin/TenantController.php`)
- [ ] Add method `assignableManagers()`:
  ```php
  public function assignableManagers(Request $request, Tenant $tenant): JsonResponse
  {
      $managers = User::query()
          ->where('tenant_id', $tenant->id)
          ->whereIn('role', [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value])
          ->orderByRaw("FIELD(role, ?, ?)", [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value])
          ->orderBy('name')
          ->get(['id', 'name', 'email', 'role']);
      return response()->json(['data' => $managers]);
  }
  ```
- [ ] Register route in Super Admin group in `api.php`:
  ```php
  Route::get('/tenants/{tenant}/assignable-managers', [TenantController::class, 'assignableManagers']);
  ```

### 3.2 Accept assign_to_id in Reseller Store

- [ ] In the Super Admin reseller store endpoint, add to validation:
  ```php
  'assign_to_id' => ['nullable', 'integer', 'exists:users,id'],
  ```
- [ ] Add validation that the target user belongs to the same tenant and has role `manager_parent` or `manager`
- [ ] Change `created_by` to use:
  ```php
  'created_by' => isset($validated['assign_to_id']) ? (int) $validated['assign_to_id'] : null,
  ```

---

## Phase 4 — Backend: Granted Value Drill-Down Endpoint

### 4.1 Add Granted Activations Endpoint

- [ ] In `SuperAdmin/FinancialReportController.php` add method `grantedActivations()`:
  - Queries `activity_logs` where `attribution_type = 'granted'`
  - Joins license/program/user data
  - Returns paginated list: `[{ reseller_name, program_name, price, activated_at, bios_id }]`
  - Accepts same date filters (`from`, `to`) as the main report
- [ ] Register route: `Route::get('/reports/granted-activations', [FinancialReportController::class, 'grantedActivations']);`

---

## Phase 5 — Frontend: Remove Manager Software Pages

### 5.1 Delete Software Pages

- [ ] Delete `frontend/src/pages/manager/Software.tsx`
- [ ] Delete `frontend/src/pages/manager/SoftwareManagement.tsx`
- [ ] Delete `frontend/src/pages/manager/ProgramForm.tsx`
- [ ] Delete `frontend/src/pages/manager/ActivateLicense.tsx`

### 5.2 Clean Router — index.tsx

- [ ] Open `frontend/src/router/index.tsx`
- [ ] Remove the `ManagerSoftwareManagementPage` lazy import line
- [ ] Remove the `ActivateLicensePageForManager` lazy import line
- [ ] Remove `<Route path="software" ...>` from Manager routes section
- [ ] Remove `<Route path="software-management" ...>` from Manager routes section
- [ ] Remove `<Route path="software-management/create" ...>` from Manager routes section
- [ ] Remove `<Route path="software-management/:id/edit" ...>` from Manager routes section
- [ ] Remove `<Route path="software/:id/activate" ...>` from Manager routes section

### 5.3 Clean Route Paths — routes.ts

- [ ] Open `frontend/src/router/routes.ts`
- [ ] Remove from the `manager` object:
  - `software: (lang) => ...`
  - `activateLicense: (lang, id) => ...`
  - `softwareManagement: (lang) => ...`
  - `programCreate: (lang) => ...`
  - `programEdit: (lang, id) => ...`

### 5.4 Clean Sidebar

- [ ] Open `frontend/src/components/layout/Sidebar.tsx`
- [ ] Find the Manager nav items array/object
- [ ] Remove the Software nav entry (the one using `routePaths.manager.software` or `softwareManagement`)

### 5.5 Check for Dangling References

- [ ] Run: `grep -r "routePaths.manager.software\|routePaths.manager.softwareManagement\|routePaths.manager.activateLicense\|routePaths.manager.programCreate\|routePaths.manager.programEdit" frontend/src/`
- [ ] Fix any remaining references found in other components

---

## Phase 6 — Frontend: Fix Activation Form for Manager

### 6.1 Update isReseller to Include Manager Role

- [ ] Open `frontend/src/components/activation/ActivateLicenseForm.tsx`
- [ ] Find: `const isReseller = user?.role === 'reseller'`
- [ ] Change to: `const isReseller = user?.role === 'reseller' || user?.role === 'manager'`

### 6.2 Verify Activation Still Works for Manager

- [ ] Confirm Manager can reach activation from the Customers page inline dialog
- [ ] Test that selecting a preset fills price correctly
- [ ] Test that form submits via `POST /licenses/activate`

---

## Phase 7 — Frontend: Scope Audit & Cleanup

### 7.1 Customers Page — Remove Useless Manager Filter

- [ ] Open `frontend/src/pages/manager/Customers.tsx`
- [ ] Find the `managerId` state and `managerOptions` computed value
- [ ] Remove the manager filter `<select>` element from the UI (line ~618-623)
- [ ] Remove `managerId` state declaration
- [ ] Remove `managerOptions` useMemo
- [ ] Remove `manager_id` from `customerFilterParams` useMemo
- [ ] Remove `manager_id` from `queryKey` array
- [ ] Remove `manager_id` from URL search params sync (`setSearchParams` block)

### 7.2 Verify ResellerLogs Page Seller Filter

- [ ] Open `frontend/src/pages/manager/ResellerLogs.tsx`
- [ ] Find the seller/reseller filter dropdown (if any)
- [ ] Verify its data source uses `managerService.getTeam()` → `GET /manager/team` (scoped) and NOT an unscoped endpoint
- [ ] If unscoped: fix to use `managerService.getTeam()`

### 7.3 Verify Reports Page Filters

- [ ] Open `frontend/src/pages/manager/Reports.tsx`
- [ ] Check all filter controls (date range, any dropdowns)
- [ ] Confirm no filter populates options from an unscoped API call
- [ ] Backend is already scoped via `teamSellerIds()` — this is a frontend UX verification only

---

## Phase 8 — Frontend: Super Admin Reseller Assignment UI

### 8.1 Add Service Method

- [ ] Find the Super Admin service file (e.g., `frontend/src/services/super-admin.service.ts` or `tenant.service.ts`)
- [ ] Add method:
  ```ts
  getAssignableManagers(tenantId: number) {
    return api.get<{ data: AssignableManager[] }>(`/tenants/${tenantId}/assignable-managers`)
  }
  ```
- [ ] Add type `AssignableManager` in the relevant types file:
  ```ts
  export interface AssignableManager {
    id: number
    name: string
    email: string
    role: 'manager_parent' | 'manager'
  }
  ```

### 8.2 Add Assignment Dropdown to Reseller Creation Form

- [ ] Find the Super Admin reseller creation form component
- [ ] Add `useQuery` that fetches `getAssignableManagers(tenantId)` when `role === 'reseller'`
- [ ] Add a `Select` or styled `<select>` below the role field, only visible when `role === 'reseller'`:
  - Label: `Assign to Manager` (optional)
  - Placeholder option: "Leave unassigned (visible to Manager Parent only)"
  - Each option renders `<RoleBadge role={item.role} />` + name + email
- [ ] Include `assign_to_id: selectedManagerId || undefined` in the create payload
- [ ] Reset the selected manager when role changes away from reseller

---

## Phase 9 — Frontend: Granted Value Drill-Down

### 9.1 Make Granted Value Card Clickable

- [ ] Find the Granted Value card in the Super Admin Financial Reports page
- [ ] Add `onClick` handler that opens a modal or side drawer
- [ ] The modal queries `GET /super-admin/reports/granted-activations` (with same date filters)
- [ ] Display a table: Reseller, Program, Price, Date, BIOS ID
- [ ] Add tooltip/description on the card: "Total market value of activations given for free (trials, manual grants)"

---

## Phase 10 — TypeScript Check & Verification

### 10.1 TypeScript Validation

- [ ] Run: `npx tsc --noEmit -p tsconfig.app.json` from `frontend/`
- [ ] Fix all type errors

### 10.2 Manual Testing — Team Network Diagram

- [ ] Diagram loads without double-snap on initial view
- [ ] Edge animations are smooth (no duplicate `@keyframes` in DOM)
- [ ] Reset View button correctly fits the diagram
- [ ] Orphan resellers (created by Manager Parent, no manager) show violet edge directly from Manager Parent node
- [ ] Clicking each stat on every node navigates to the correct page

### 10.3 Manual Testing — Manager Software Removal

- [ ] `GET /api/manager/software` → 404 or 405
- [ ] `POST /api/manager/software` → 404 or 405
- [ ] Manager sidebar has no Software link
- [ ] No `/manager/software-management` route exists
- [ ] Manager can still access `GET /programs` (shared programs endpoint)
- [ ] Manager activation form shows preset buttons (not date picker)

### 10.4 Manual Testing — Security Fixes

- [ ] Manager dashboard `team_customers` shows correct count (not 0)
- [ ] Manager Customers page lists customers with licenses under their resellers
- [ ] Manager Activity page activity logs are tenant-scoped
- [ ] `POST /api/manager/customers?manager_id=999` → `manager_id` param silently ignored (removed)
- [ ] Manager Customers page has no "Filter by Manager" dropdown

### 10.5 Manual Testing — Super Admin Reseller Assignment

- [ ] Super Admin creating a Reseller sees "Assign to Manager" dropdown when role = reseller
- [ ] Dropdown does NOT appear when role = manager
- [ ] Dropdown lists Manager Parents (with purple badge) and Managers (with indigo badge) from the correct tenant
- [ ] Created reseller has correct `created_by` value in DB
- [ ] Assigned Manager sees the reseller on their Team page
- [ ] Team Network diagram shows reseller under the correct Manager node (indigo edge), not as orphan (violet edge)

### 10.6 Manual Testing — Granted Value

- [ ] Granted Value card has a tooltip explaining what the value means
- [ ] Clicking the card opens a detailed list of granted activations
- [ ] Super Admin total_customers stat now shows correct count

---

## Files Modified — Complete Reference

### Backend

| File | Action | Phase |
|---|---|---|
| `routes/api.php` | Remove 5 Manager software routes; add assignable-managers + granted-activations routes | 1.1, 3.1, 4.1 |
| `Controllers/Manager/SoftwareController.php` | **DELETE** | 1.2 |
| `Controllers/Manager/BaseManagerController.php` | Fix 3 methods: teamCustomersQuery, teamUsersQuery, resolveTeamUser | 2.1 |
| `Controllers/Manager/ActivityController.php` | Add tenant_id filter to query | 2.2 |
| `Controllers/Manager/CustomerController.php` | Remove manager_id filter | 2.3 |
| `Controllers/SuperAdmin/FinancialReportController.php` | Fix total_customers + add grantedActivations() | 2.4, 4.1 |
| `Controllers/SuperAdmin/TenantController.php` (or equiv) | Add assignableManagers() + accept assign_to_id in store | 3.1, 3.2 |

### Frontend

| File | Action | Phase |
|---|---|---|
| `components/team-network/NetworkCanvas.tsx` | Remove `fitView` prop from `<ReactFlow>` | 0.1 |
| `components/team-network/edges/AnimatedEdge.tsx` | Import CSS, remove `<style>` tag | 0.2 |
| `components/team-network/edges/AnimatedEdge.css` | **CREATE** with `@keyframes` | 0.2 |
| `pages/manager/Software.tsx` | **DELETE** | 5.1 |
| `pages/manager/SoftwareManagement.tsx` | **DELETE** | 5.1 |
| `pages/manager/ProgramForm.tsx` | **DELETE** | 5.1 |
| `pages/manager/ActivateLicense.tsx` | **DELETE** | 5.1 |
| `router/index.tsx` | Remove Manager software lazy imports + routes | 5.2 |
| `router/routes.ts` | Remove Manager software path helpers | 5.3 |
| `components/layout/Sidebar.tsx` | Remove Software nav item from Manager | 5.4 |
| `components/activation/ActivateLicenseForm.tsx` | `isReseller` → include `manager` role | 6.1 |
| `pages/manager/Customers.tsx` | Remove manager filter dropdown + state | 7.1 |
| `pages/manager/ResellerLogs.tsx` | Verify seller filter is scoped (fix if not) | 7.2 |
| `pages/manager/Reports.tsx` | Verify no unscoped filter dropdowns | 7.3 |
| Super Admin reseller creation form | Add assign_to_id dropdown | 8.2 |
| Super Admin service file | Add `getAssignableManagers()` + type | 8.1 |
| Super Admin Reports page | Make Granted Value card clickable + tooltip | 9.1 |
