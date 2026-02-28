# PHASE 04: Manager/Reseller - TODO List

**Duration:** Day 6
**Deadline:** End of Day 6

---

## Backend: License Service

### LicenseService

- [ ] Create `app/Services/LicenseService.php`
- [ ] `activate(array $data)`:
  - Validate BIOS ID is not empty
  - Check no active license exists for this BIOS + program combo
  - Call `ExternalApiService->activateUser($biosId)`
  - On success: create Customer user (if not exists), create License record
  - Log to `activity_logs`
  - Dispatch `LicenseActivated` event (Pusher)
  - Return License model
- [ ] `renew(License $license, int $days, float $price)`:
  - Call `ExternalApiService->renewUser($license->bios_id)`
  - Update `expires_at = now + days`, `price`, `status = active`
  - Log activity
  - Dispatch event
- [ ] `deactivate(License $license)`:
  - Call `ExternalApiService->deleteUser($license->bios_id)`
  - Set `status = suspended`
  - Log activity
  - Dispatch event

### License Events

- [ ] Create `app/Events/LicenseActivated.php` (broadcasts on Pusher)
- [ ] Create `app/Events/LicenseRenewed.php`
- [ ] Create `app/Events/LicenseDeactivated.php`

### Manager Controllers (TEAM scope - manages resellers under them)

- [ ] Create `Manager/DashboardController.php`
  - `stats()` - count team resellers, their customers, active licenses, revenue (TEAM scope)
  - `activationsChart()` - monthly activations for team
  - `revenueChart()` - monthly revenue for team
  - `recentActivity()` - last 10 team activity entries
- [ ] Create `Manager/TeamController.php`
  - `index()` - paginated resellers managed by this manager
  - `show($id)` - reseller detail with stats
- [ ] Create `Manager/UsernameManagementController.php`
  - `index()` - team users (resellers + their customers) with username info
  - `unlock($userId)` - unlock username for team member
  - `changeUsername($userId)` - change username + log
  - `resetPassword($userId)` - reset password + log
- [ ] Create `Manager/CustomerController.php`
  - `index()` - all customers across team's resellers (read-only overview)
  - `show($id)` - customer detail
- [ ] Create `Manager/ReportController.php`
  - Team-scoped reports: revenue, activations, top resellers
  - CSV/PDF export
- [ ] Create `Manager/ActivityController.php`
  - Index: paginated team activity log

### Reseller Controllers (PERSONAL scope - only their own data)

- [ ] Create `Reseller/DashboardController.php`
  - `stats()` - count customers, active licenses, revenue, monthly activations (scoped to reseller)
  - `activationsChart()` - monthly activation count
  - `revenueChart()` - monthly revenue
  - `recentActivity()` - last 10 activity entries
- [ ] Create `Reseller/CustomerController.php`
  - `index()` - paginated customers created by this reseller
  - `store()` - create customer user account (pre-activation)
  - `show()` - customer detail with license history
- [ ] Create `Reseller/LicenseController.php`
  - `index()` - all licenses by this reseller, filterable
  - `show()` - single license detail
  - `activate(ActivateLicenseRequest $request)` - calls LicenseService->activate
  - `renew($id, RenewLicenseRequest $request)` - calls LicenseService->renew
  - `deactivate($id)` - calls LicenseService->deactivate
  - `expiring($days)` - licenses expiring within N days
  - `bulkRenew(Request $request)` - renew array of license IDs
  - `bulkDeactivate(Request $request)` - deactivate array of license IDs
- [ ] Create `Reseller/ReportController.php`
  - Revenue (filterable by period), activations, top programs, CSV/PDF export
- [ ] Create `Reseller/ActivityController.php`
  - Index: paginated personal activity log

### Form Requests

- [ ] Create `ActivateLicenseRequest.php`:
  ```
  customer_name: required|string|min:2
  customer_email: required|email
  customer_phone: nullable|string
  bios_id: required|string|min:5
  program_id: required|exists:programs,id
  duration_days: required|integer|min:1
  price: required|numeric|min:0
  ```
- [ ] Create `RenewLicenseRequest.php`:
  ```
  duration_days: required|integer|min:1
  price: required|numeric|min:0
  ```

### Routes

- [ ] Add Manager routes to `routes/api.php`:
  ```php
  Route::middleware(['auth:sanctum', 'role:manager', 'tenant.scope'])->prefix('manager')->group(function () {
      Route::get('/dashboard/stats', [Manager\DashboardController::class, 'stats']);
      Route::get('/dashboard/activations-chart', [Manager\DashboardController::class, 'activationsChart']);
      Route::get('/dashboard/revenue-chart', [Manager\DashboardController::class, 'revenueChart']);
      Route::get('/dashboard/recent-activity', [Manager\DashboardController::class, 'recentActivity']);
      Route::get('/team', [Manager\TeamController::class, 'index']);
      Route::get('/team/{id}', [Manager\TeamController::class, 'show']);
      Route::get('/username-management', [Manager\UsernameManagementController::class, 'index']);
      Route::post('/username-management/{id}/unlock', [Manager\UsernameManagementController::class, 'unlock']);
      Route::post('/username-management/{id}/change', [Manager\UsernameManagementController::class, 'changeUsername']);
      Route::post('/username-management/{id}/reset-password', [Manager\UsernameManagementController::class, 'resetPassword']);
      Route::get('/customers', [Manager\CustomerController::class, 'index']);
      Route::get('/customers/{id}', [Manager\CustomerController::class, 'show']);
      Route::get('/reports/*', [...]);
      Route::get('/activity', [Manager\ActivityController::class, 'index']);
  });
  ```
- [ ] Add all reseller routes to `routes/api.php` (as specified in Overview)

---

## Frontend: Manager Pages (8) - SEPARATE DASHBOARD

### Manager Dashboard (`/dashboard` for manager role)

- [ ] Create `src/pages/manager/Dashboard.tsx`
- [ ] 4 StatsCards: Team Resellers, Team Customers, Active Licenses, Team Revenue
- [ ] Team activations trend line chart
- [ ] Team revenue trend line chart
- [ ] Recent team activity list (last 10)
- [ ] Wire to `/api/manager/dashboard/*` with React Query

### Manager Team/Resellers (`/team`)

- [ ] Create `src/pages/manager/Team.tsx`
- [ ] DataTable: Reseller Name, Email, Customers Count, Active Licenses, Revenue, Status
- [ ] Click row to view reseller detail (stats, customers)
- [ ] Search by name/email
- [ ] NO add/edit/delete capability (managed by Manager Parent)

### Manager Username Management (`/username-management`)

- [ ] Create `src/pages/manager/UsernameManagement.tsx`
- [ ] DataTable: User, Username, Email, Role, Locked Status, Actions
- [ ] Scope: TEAM - resellers under this manager + their customers
- [ ] Actions: Unlock username, Change username, Reset password
- [ ] "Unlock" shows ConfirmDialog with reason
- [ ] "Change Username" opens modal
- [ ] All changes logged to `activity_logs`
- [ ] Filter by role, locked status
- [ ] Search by username/email

### Manager Customer Overview (`/customers`)

- [ ] Create `src/pages/manager/Customers.tsx`
- [ ] DataTable: Name, Email, BIOS ID, Reseller, Program, Status, Expiry
- [ ] Read-only aggregated view across team's resellers
- [ ] Filter by reseller, program, status
- [ ] Click row for detail drawer

### Manager Software (`/software`)

- [ ] Create `src/pages/manager/Software.tsx`
- [ ] Card grid of available programs (read-only)
- [ ] Same as reseller software view

### Manager Reports (`/reports`)

- [ ] Create `src/pages/manager/Reports.tsx`
- [ ] Team-scoped reports: revenue by reseller, activations, performance
- [ ] Date range picker
- [ ] Export CSV + PDF

### Manager Activity (`/activity`)

- [ ] Create `src/pages/manager/Activity.tsx`
- [ ] Team activity log (actions by team resellers)
- [ ] Filter by reseller, action type, date

### Manager Profile (`/profile`)

- [ ] Create `src/pages/manager/Profile.tsx`
- [ ] Reuse shared profile component

---

## Frontend: Reseller Pages (7) - SEPARATE DASHBOARD

### Reseller Dashboard (`/dashboard` for reseller role)

- [ ] Create `src/pages/manager-reseller/Dashboard.tsx`
- [ ] 4 StatsCards: Customers, Active Licenses, Revenue, Monthly Activations
- [ ] Activations trend line chart
- [ ] Revenue trend line chart
- [ ] Recent activity list (last 10)
- [ ] Wire to `/api/reseller/dashboard/*` with React Query

### Customers (`/customers`) - CORE PAGE

- [ ] Create `src/pages/manager-reseller/Customers.tsx`
- [ ] DataTable: Name, Email, BIOS ID, Program, Status badge, Price, Expiry, Actions
- [ ] Filter tabs: All | Active | Expired | Suspended
- [ ] Search by name, email, or BIOS ID
- [ ] **"Add Customer" button opens multi-step dialog:**

#### Step 1: Customer Info
- [ ] Customer Name input (required)
- [ ] Customer Email input (required, email validation)
- [ ] Phone input (optional)
- [ ] "Next" button

#### Step 2: BIOS Activation
- [ ] BIOS ID input (required, min 5 chars)
- [ ] Program select dropdown (fetches from `/api/programs`)
- [ ] Show program info: name, description, base price
- [ ] "Next" button

#### Step 3: Pricing & Duration
- [ ] Duration number input
- [ ] Duration unit selector: Days / Months / Years
- [ ] Price input (reseller sets freely)
- [ ] Auto-calculate expiry date preview
- [ ] "Next" button

#### Step 4: Review & Confirm
- [ ] Summary card showing all entered info
- [ ] "Activate" button with loading state
- [ ] On click: POST `/api/licenses/activate`
- [ ] Success: Show success toast, close dialog, refresh table
- [ ] Error: Show error message, allow retry

#### Row Actions
- [ ] "View" button -> detail drawer (license info, activation history)
- [ ] "Renew" button -> Renew dialog:
  - Show current license info
  - New duration input + unit
  - New price input
  - "Renew" button -> POST `/api/licenses/{id}/renew`
- [ ] "Deactivate" button -> ConfirmDialog:
  - "This will deactivate the license for BIOS ID: XXX"
  - "Deactivate" button -> POST `/api/licenses/{id}/deactivate`

### Software (`/software`)

- [ ] Create `src/pages/manager-reseller/Software.tsx`
- [ ] Card grid of available programs (read-only)
- [ ] Each card: name, description, version, base price, trial days, status
- [ ] Search by program name
- [ ] No edit/delete buttons (managed by Manager Parent)

### Licenses (`/licenses`)

- [ ] Create `src/pages/manager-reseller/Licenses.tsx`
- [ ] DataTable: Customer, BIOS ID, Program, Duration, Price, Activated Date, Expires Date, Status
- [ ] Filter tabs: All | Active | Expired | Suspended | Pending
- [ ] Expiry warning section at top:
  - Red alert: "X licenses expire in 1 day"
  - Amber alert: "X licenses expire in 3 days"
  - Yellow alert: "X licenses expire in 7 days"
- [ ] Checkbox selection for bulk actions
- [ ] Bulk action dropdown: Renew Selected, Deactivate Selected
- [ ] Bulk Renew dialog: set duration + price for all selected
- [ ] Bulk Deactivate: ConfirmDialog

### Reports (`/reports`)

- [ ] Create `src/pages/manager-reseller/Reports.tsx`
- [ ] Date range picker
- [ ] Period toggle: Daily | Weekly | Monthly
- [ ] Revenue chart (Recharts Line)
- [ ] Activation count chart (Recharts Bar)
- [ ] Top Programs by sales (Recharts horizontal Bar)
- [ ] Summary cards: Total Revenue, Total Activations, Avg Price, Success Rate
- [ ] Export CSV + PDF buttons

### Activity (`/activity`)

- [ ] Create `src/pages/manager-reseller/Activity.tsx`
- [ ] Timeline list of personal actions
- [ ] Each entry: icon, action type badge, description, timestamp
- [ ] Filter by action type: Activation, Deactivation, Renewal, Login
- [ ] Pagination

### Profile (`/profile`)

- [ ] Create `src/pages/manager-reseller/Profile.tsx`
- [ ] Reuse shared profile component

---

## Frontend: Services

- [ ] Create `src/services/license.service.ts`:
  ```typescript
  activate(data: ActivateLicenseData): Promise<License>
  renew(id: number, data: RenewData): Promise<License>
  deactivate(id: number): Promise<void>
  getAll(params: LicenseFilters): Promise<PaginatedResponse<License>>
  getById(id: number): Promise<License>
  getExpiring(days: number): Promise<License[]>
  bulkRenew(ids: number[], data: RenewData): Promise<void>
  bulkDeactivate(ids: number[]): Promise<void>
  ```
- [ ] Create `src/services/reseller.service.ts`:
  ```typescript
  getDashboardStats(): Promise<DashboardStats>
  getActivationsChart(): Promise<ChartData>
  getRevenueChart(): Promise<ChartData>
  getRecentActivity(): Promise<ActivityEntry[]>
  getReports(params): Promise<ReportData>
  getActivity(params): Promise<PaginatedResponse<ActivityEntry>>
  exportCsv(params): Promise<Blob>
  exportPdf(params): Promise<Blob>
  ```

---

## Router Updates

- [ ] Add Manager routes under `/:lang` prefix (SEPARATE from Reseller):
  ```tsx
  {/* Inside <Route path="/:lang"> */}
  <Route path="manager" element={<DashboardLayout role="manager" />}>
    <Route path="dashboard" element={<ManagerDashboard />} />
    <Route path="team" element={<ManagerTeam />} />
    <Route path="username-management" element={<ManagerUsernameManagement />} />
    <Route path="customers" element={<ManagerCustomers />} />
    <Route path="software" element={<ManagerSoftware />} />
    <Route path="reports" element={<ManagerReports />} />
    <Route path="activity" element={<ManagerActivity />} />
    <Route path="profile" element={<ManagerProfile />} />
  </Route>
  ```
- [ ] Add Reseller routes under `/:lang` prefix (SEPARATE from Manager):
  ```tsx
  {/* Inside <Route path="/:lang"> */}
  <Route path="reseller" element={<DashboardLayout role="reseller" />}>
    <Route path="dashboard" element={<ResellerDashboard />} />
    <Route path="customers" element={<ResellerCustomers />} />
    <Route path="software" element={<ResellerSoftware />} />
    <Route path="licenses" element={<ResellerLicenses />} />
    <Route path="reports" element={<ResellerReports />} />
    <Route path="activity" element={<ResellerActivity />} />
    <Route path="profile" element={<ResellerProfile />} />
  </Route>
  ```
- [ ] Update Sidebar: separate navigation items for manager vs reseller
- [ ] Manager sidebar includes: Dashboard, Team, Username Mgmt, Customers, Software, Reports, Activity, Profile
- [ ] Reseller sidebar includes: Dashboard, Customers, Software, Licenses, Reports, Activity, Profile
- [ ] **Reseller has NO username/password management access**

---

## Testing (25 E2E Tests - Cypress)

### Authentication & Separation
- [ ] Test 1: Reseller logs in and sees reseller dashboard at /reseller/dashboard
- [ ] Test 2: Reseller cannot access /super-admin/* (redirected)
- [ ] Test 3: Manager logs in and sees SEPARATE manager dashboard at /manager/dashboard
- [ ] Test 4: Manager cannot access /reseller/* routes
- [ ] Test 5: Reseller cannot access /manager/* routes (NO username mgmt)

### Customer Activation (Critical Path - Reseller)
- [ ] Test 6: Open "Add Customer" dialog
- [ ] Test 7: Fill Step 1 (customer info) and navigate to Step 2
- [ ] Test 8: Fill Step 2 (BIOS ID + select program) and navigate to Step 3
- [ ] Test 9: Fill Step 3 (duration + price) and navigate to Step 4
- [ ] Test 10: Review summary and click "Activate"
- [ ] Test 11: Activation succeeds - toast shown, dialog closes, table updated
- [ ] Test 12: Activation fails (API error) - error message shown, can retry

### License Management (Reseller)
- [ ] Test 13: Licenses page loads with data
- [ ] Test 14: Filter licenses by status (Active tab)
- [ ] Test 15: Renew license - dialog opens, submit, license updated
- [ ] Test 16: Deactivate license - confirm dialog, submit, status changes
- [ ] Test 17: Expiry warnings show for licenses expiring soon

### Manager-Specific Pages
- [ ] Test 18: Manager Team page shows team resellers (read-only)
- [ ] Test 19: Manager Username Management page renders with team users
- [ ] Test 20: Manager can unlock a username (confirm dialog, reason required)
- [ ] Test 21: Manager Customer Overview shows aggregated view

### Other Pages
- [ ] Test 22: Software page shows programs (read-only, no edit buttons)
- [ ] Test 23: Reports page renders charts with data
- [ ] Test 24: Export CSV downloads a file
- [ ] Test 25: Dashboard stats cards show correct numbers

---

## Verification (End of Day 6)

```bash
# Critical test: Full activation flow (Reseller)
1. Login as reseller@obd2sw.com
2. Go to /reseller/customers
3. Click "Add Customer"
4. Fill all steps with test BIOS ID
5. Click "Activate"
6. Verify: customer appears in table with "Active" badge
7. Verify: api_logs has the external API call record
8. Verify: Login as customer@obd2sw.com -> sees license

# Critical test: Manager separate dashboard
9. Login as manager@obd2sw.com
10. Verify: redirected to /manager/dashboard (NOT /reseller/dashboard)
11. Verify: Username Management page accessible
12. Verify: Can unlock/change username for team members
13. Verify: Cannot access /reseller/* routes

# Manager pages (8) accessible:
/manager/dashboard, /manager/team, /manager/username-management,
/manager/customers, /manager/software, /manager/reports,
/manager/activity, /manager/profile

# Reseller pages (7) accessible:
/reseller/dashboard, /reseller/customers, /reseller/software,
/reseller/licenses, /reseller/reports, /reseller/activity,
/reseller/profile

# Reseller has NO access to:
/manager/username-management (returns 403 or redirect)

# 25 E2E tests passing (run from tests-frontend/)
cd tests-frontend && npx cypress run --spec "cypress/e2e/manager/**,cypress/e2e/reseller/**"
```

**Phase 04 complete. Proceed to PHASE-05-CustomerPortal.**
