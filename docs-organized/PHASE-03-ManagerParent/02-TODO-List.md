# PHASE 03: Manager Parent - TODO List

**Duration:** Day 4-5
**Deadline:** End of Day 5

---

## Day 4: Core Pages

### Dashboard (`/dashboard`)

- [ ] Create `src/pages/manager-parent/Dashboard.tsx`
- [ ] 4 StatsCards: Team Members, Customers, Active Licenses, Monthly Revenue
- [ ] Monthly Revenue line chart (Recharts)
- [ ] License Expiry Forecast bar chart
- [ ] Team Performance comparison chart
- [ ] Quick Actions panel (buttons to navigate to common tasks)
- [ ] Wire to API with React Query

### Software Management (`/software-management`)

- [ ] Create `src/pages/manager-parent/SoftwareManagement.tsx`
- [ ] Toggle view: Card grid / Table list
- [ ] Card view: program icon, name, version, price, status badge, edit/delete buttons
- [ ] "Add Program" button opens dialog with form:
  - [ ] Program Name (required, min 2 chars)
  - [ ] Description (optional textarea)
  - [ ] Version (default "1.0")
  - [ ] Download Link URL (required, must be valid URL)
  - [ ] Trial Days (number input, default 0)
  - [ ] Base Price (number input with 2 decimal places)
  - [ ] Icon upload (optional, accept image/*)
  - [ ] Status toggle (Active/Inactive)
- [ ] Edit button opens same form pre-filled
- [ ] Delete button shows ConfirmDialog
- [ ] Form validation on submit
- [ ] Success/error toast notifications
- [ ] Create `src/services/program.service.ts`
  - `getAll()`, `create(data)`, `update(id, data)`, `delete(id)`, `getStats(id)`

### Team Management (`/team-management`)

- [ ] Create `src/pages/manager-parent/TeamManagement.tsx`
- [ ] Tab layout: Managers | Resellers
- [ ] DataTable per tab:
  - Columns: Name, Email, Phone, Status, Customers, Revenue, Actions
  - Sort by name, revenue, customers
  - Search by name/email
- [ ] "Invite Manager" button (on Managers tab):
  - [ ] Name, Email, Password, Phone (optional)
  - [ ] Role auto-set to `manager`
- [ ] "Invite Reseller" button (on Resellers tab):
  - [ ] Name, Email, Password, Phone (optional)
  - [ ] Role auto-set to `reseller`
- [ ] Row actions: Edit, Suspend/Activate, Delete
- [ ] Mini stats per member (total customers, active licenses, revenue)
- [ ] Create `src/services/team.service.ts`
  - `getAll(params)`, `create(data)`, `update(id, data)`, `delete(id)`, `updateStatus(id, status)`, `getStats(id)`

---

## Day 4-5: Remaining Pages

### Reseller Pricing (`/reseller-pricing`)

- [ ] Create `src/pages/manager-parent/ResellerPricing.tsx`
- [ ] Main table: Program Name | Base Price | Reseller Price | Margin % | Edit
- [ ] Click "Edit" to inline-edit reseller price
- [ ] "Bulk Update" button opens dialog:
  - Select reseller(s)
  - Set percentage markup or fixed price
  - Apply to all programs
- [ ] Pricing history tab/section: timestamp, program, old price, new price, changed by
- [ ] Create `src/services/pricing.service.ts`

### Reports (`/reports`)

- [ ] Create `src/pages/manager-parent/Reports.tsx`
- [ ] Date range picker at top
- [ ] Revenue by Reseller (Recharts Pie chart)
- [ ] Revenue by Program (Recharts Bar chart)
- [ ] Activation Success/Failure (Recharts Donut)
- [ ] Customer Retention (Recharts Line - monthly active customers)
- [ ] Summary cards: Total Revenue, Total Activations, Success Rate
- [ ] Export CSV button (calls API, triggers download)
- [ ] Export PDF button

### Activity (`/activity`)

- [ ] Create `src/pages/manager-parent/Activity.tsx`
- [ ] Timeline-style feed (latest first)
- [ ] Each entry: avatar/icon, user name, action text, timestamp, metadata chips
- [ ] Filters: User dropdown, Action type dropdown, Date range
- [ ] Pagination or infinite scroll
- [ ] Export button

### Customers (`/customers`)

- [ ] Create `src/pages/manager-parent/Customers.tsx`
- [ ] DataTable: Name, Email, BIOS ID, Reseller (who activated), Program, Status, Expiry
- [ ] Filters: Reseller dropdown, Program dropdown, Status tabs, BIOS ID search
- [ ] Click row to view detail drawer:
  - Customer info, license history, activation date, reseller who activated
- [ ] No edit/delete capability (read-only for Manager Parent)

### Settings (`/settings`)

- [ ] Create `src/pages/manager-parent/Settings.tsx`
- [ ] Business Info section: Company name, email, phone, address
- [ ] Defaults section: Default trial days, default pricing
- [ ] Notifications section: Email alerts toggles
- [ ] Save button
- [ ] Validation (email format, required fields)

### Profile (`/profile`)

- [ ] Create `src/pages/manager-parent/Profile.tsx`
- [ ] Reuse Profile component from Phase 02 (or create shared Profile page)
- [ ] Profile card, edit form, change password, notification prefs

### BIOS Blacklist - Tenant Level (`/bios-blacklist`)

- [ ] Create `src/pages/manager-parent/BiosBlacklist.tsx`
- [ ] DataTable: BIOS ID, Added By, Reason, Status, Date Added, Actions
- [ ] "Add to Blacklist" button opens modal:
  - BIOS ID input (required)
  - Reason textarea (required)
- [ ] Row actions: Remove from Blacklist
- [ ] Search by BIOS ID
- [ ] Filter: Active | Removed
- [ ] Scope: Only THIS tenant's blacklist entries
- [ ] Wire to `/api/bios-blacklist` endpoints (tenant-scoped)

### BIOS History - Tenant Level (`/bios-history`)

- [ ] Create `src/pages/manager-parent/BiosHistory.tsx`
- [ ] Search bar: Enter BIOS ID to view history within tenant
- [ ] Timeline view per BIOS ID:
  - Activations, deactivations, renewals, conflicts within THIS tenant
- [ ] DataTable: BIOS ID, Customer, Reseller, Action, Date, Status
- [ ] Filter by reseller, action type, date range
- [ ] Wire to `/api/bios-history` endpoints (tenant-scoped)

### IP Analytics - Tenant Level (`/ip-analytics`)

- [ ] Create `src/pages/manager-parent/IpAnalytics.tsx`
- [ ] IP Country Distribution (Pie chart - top countries)
- [ ] IP Activity DataTable: User, IP Address, Country, City, ISP, Reputation, Action, Date
- [ ] Suspicious IP alerts (high reputation score IPs)
- [ ] Filter by user, country, reputation score, date range
- [ ] Wire to `/api/ip-analytics` endpoints (tenant-scoped)

### Username Management - Tenant Level (`/username-management`)

- [ ] Create `src/pages/manager-parent/UsernameManagement.tsx`
- [ ] DataTable: User, Username, Email, Role, Locked Status, Actions
- [ ] Scope: Only users within THIS tenant (TENANT scope)
- [ ] Actions per user:
  - Unlock username (if locked)
  - Change username
  - Reset password
- [ ] "Unlock" shows ConfirmDialog with reason input
- [ ] "Change Username" opens modal: new username input + reason
- [ ] All changes logged to `activity_logs` table
- [ ] Filter by role, locked status
- [ ] Search by username/email
- [ ] Wire to `/api/username-management` endpoints (tenant-scoped)

### Financial Reports - Tenant Level (`/financial-reports`)

- [ ] Create `src/pages/manager-parent/FinancialReports.tsx`
- [ ] Date range picker
- [ ] Revenue by Reseller (Bar chart)
- [ ] Revenue by Program (Stacked Bar)
- [ ] Monthly Revenue Trend (Line chart)
- [ ] Reseller Balances section:
  - DataTable: Reseller, Total Revenue, Total Activations, Avg Price, Commission
  - Sort by revenue, activations
- [ ] Summary cards: Total Tenant Revenue, Total Activations, Active Licenses
- [ ] Export CSV + PDF
- [ ] Wire to `/api/financial-reports` endpoints (tenant-scoped)

---

## Backend Controllers

- [ ] Create `ManagerParent/DashboardController.php`
  - `stats()` - tenant-scoped counts + revenue
  - `revenueChart()` - monthly data
  - `expiryForecast()` - licenses expiring soon
  - `teamPerformance()` - per-member stats
- [ ] Create `ManagerParent/TeamController.php` (apiResource)
  - Store creates user with role manager or reseller under tenant
  - Index lists team members with counts
  - Status update: suspend/activate
- [ ] Create `ManagerParent/ProgramController.php` (apiResource)
  - Full CRUD for programs within tenant
  - Stats: licenses sold, active count
- [ ] Create `ManagerParent/PricingController.php`
  - Index: programs with pricing
  - Update: set reseller price per program
  - Bulk: update multiple at once
  - History: pricing change log
- [ ] Create `ManagerParent/ReportController.php`
  - Revenue by reseller, by program
  - Activation rate, retention
  - CSV/PDF export
- [ ] Create `ManagerParent/ActivityController.php`
  - Index: paginated tenant activity
  - Export: download full audit trail
- [ ] Create `ManagerParent/CustomerController.php`
  - Index: all customers in tenant (read-only)
  - Show: single customer with license history
- [ ] Create `ManagerParent/SettingsController.php`
  - Get/update tenant settings JSON
- [ ] Create `ManagerParent/BiosBlacklistController.php`
  - Index: paginated tenant blacklist
  - Store: add BIOS to tenant blacklist
  - Remove: remove from blacklist
- [ ] Create `ManagerParent/BiosHistoryController.php`
  - Index: tenant-scoped BIOS history
  - Show: timeline for specific BIOS within tenant
- [ ] Create `ManagerParent/IpAnalyticsController.php`
  - Index: IP activity for tenant users
  - Stats: country distribution, suspicious IPs
- [ ] Create `ManagerParent/UsernameManagementController.php`
  - Index: tenant users with username info
  - Unlock: unlock username for tenant user
  - ChangeUsername: change username + log
  - ResetPassword: reset password + log
- [ ] Create `ManagerParent/FinancialReportController.php`
  - Revenue by reseller, by program (tenant-scoped)
  - Reseller balances aggregation
  - CSV/PDF export

---

## Router Updates

- [ ] Add Manager Parent routes:
  ```tsx
  {/* Under /:lang prefix */}
  <Route path="/:lang" element={<DashboardLayout role="manager_parent" />}>
    <Route path="dashboard" element={<MPDashboard />} />
    <Route path="team-management" element={<TeamManagement />} />
    <Route path="reseller-pricing" element={<ResellerPricing />} />
    <Route path="software-management" element={<SoftwareManagement />} />
    <Route path="bios-blacklist" element={<MPBiosBlacklist />} />
    <Route path="bios-history" element={<MPBiosHistory />} />
    <Route path="ip-analytics" element={<MPIpAnalytics />} />
    <Route path="username-management" element={<MPUsernameManagement />} />
    <Route path="financial-reports" element={<MPFinancialReports />} />
    <Route path="reports" element={<MPReports />} />
    <Route path="activity" element={<MPActivity />} />
    <Route path="customers" element={<MPCustomers />} />
    <Route path="settings" element={<MPSettings />} />
    <Route path="profile" element={<MPProfile />} />
  </Route>
  ```
- [ ] Update Sidebar navigation for manager_parent role

---

## Testing (30 Integration Tests)

### Software Management
- [ ] Test 1: Programs page renders program cards
- [ ] Test 2: Add Program form validates required fields
- [ ] Test 3: Add Program creates new program (API mock)
- [ ] Test 4: Edit Program pre-fills form with existing data
- [ ] Test 5: Delete Program shows confirmation dialog
- [ ] Test 6: Delete Program removes from list after confirm
- [ ] Test 7: Toggle card/table view works

### Team Management
- [ ] Test 8: Team page renders Managers and Resellers tabs
- [ ] Test 9: Invite Manager form submits correctly
- [ ] Test 10: Invite Reseller form submits correctly
- [ ] Test 11: Suspend team member updates status
- [ ] Test 12: Delete team member removes from list
- [ ] Test 13: Team member stats display correctly

### Reseller Pricing
- [ ] Test 14: Pricing table renders programs with prices
- [ ] Test 15: Edit pricing inline saves new value
- [ ] Test 16: Bulk pricing applies to selected programs
- [ ] Test 17: Pricing history shows changes

### Dashboard
- [ ] Test 18: Dashboard renders 4 stats cards with data
- [ ] Test 19: Revenue chart renders with monthly data
- [ ] Test 20: Quick actions navigate to correct pages

### Reports
- [ ] Test 21: Reports page renders all charts
- [ ] Test 22: Date range filter updates chart data
- [ ] Test 23: Export CSV triggers download
- [ ] Test 24: Export PDF triggers download

### Customers
- [ ] Test 25: Customers table renders with data
- [ ] Test 26: Filter by reseller works
- [ ] Test 27: Filter by program works
- [ ] Test 28: Click row opens detail drawer

### Activity & Settings
- [ ] Test 29: Activity feed renders entries with timestamps
- [ ] Test 30: Settings form saves and shows success toast

### BIOS Blacklist (Tenant)
- [ ] Test 31: BIOS Blacklist page renders table with blacklist entries
- [ ] Test 32: "Add to Blacklist" opens modal with BIOS ID and reason
- [ ] Test 33: Remove from blacklist updates status

### BIOS History (Tenant)
- [ ] Test 34: BIOS History search returns timeline for BIOS ID
- [ ] Test 35: BIOS History shows only tenant-scoped data

### IP Analytics
- [ ] Test 36: IP Analytics renders country distribution chart
- [ ] Test 37: IP Activity table renders with filters

### Username Management (Tenant)
- [ ] Test 38: Username Management page renders user table
- [ ] Test 39: "Unlock" action shows confirm dialog
- [ ] Test 40: "Change Username" opens modal with input

### Financial Reports (Tenant)
- [ ] Test 41: Financial Reports renders charts and summary
- [ ] Test 42: Reseller Balances table renders with data
- [ ] Test 43: Export CSV/PDF buttons trigger download

---

## Verification (End of Day 5)

```bash
# All 12 pages accessible:
/dashboard
/team-management
/reseller-pricing
/software-management
/bios-blacklist
/bios-history
/ip-analytics
/username-management
/financial-reports
/reports
/activity
/customers
/settings
/profile

# Test: Add a program with download link -> appears in list
# Test: Add a reseller -> appears in team list
# Test: Set reseller pricing -> saves correctly
# Test: Customer list shows tenant-scoped data only
# Test: Add BIOS to blacklist -> appears in list
# Test: Search BIOS history -> shows timeline
# Test: Unlock username -> status changes
# 43 tests passing (run from tests-frontend/)
cd tests-frontend && npm run test:unit -- --testPathPattern=manager-parent
```

**Phase 03 complete. Proceed to PHASE-04-ManagerReseller.**
