# PHASE 02: Super Admin - TODO List

**Duration:** Day 3
**Deadline:** End of Day 3

---

## Layout Components

### DashboardLayout

- [ ] Create `src/components/layout/DashboardLayout.tsx`
  - Wraps all authenticated pages
  - Renders: Navbar (top) + Sidebar (left/right based on RTL) + Content (main)
  - Sidebar state: expanded (desktop) / collapsed (mobile)
  - Uses `<Outlet />` for nested routes

### Navbar

- [ ] Create `src/components/layout/Navbar.tsx`
  - Logo (OBD2SW) on left (or right in RTL)
  - Navigation links based on user role
  - Language toggle button (AR/EN) - navigates between `/ar/...` and `/en/...` URL routes
  - Theme toggle button (sun/moon icon) - dark/light mode
  - Profile dropdown: name, role badge, logout
  - Mobile: hamburger menu icon to toggle sidebar

### Sidebar

- [ ] Create `src/components/layout/Sidebar.tsx`
  - Collapsible (icon-only when collapsed)
  - Navigation items with Lucide icons:
    ```
    Dashboard    - LayoutDashboard
    Tenants      - Building2
    Users        - Users
    Admin Mgmt   - UserCog
    BIOS Blacklist - ShieldBan
    BIOS History - History
    Username Mgmt - KeyRound
    Financial    - DollarSign
    Reports      - BarChart3
    Logs         - ScrollText
    API Status   - Activity
    Settings     - Settings
    Profile      - User
    ```
  - Active item highlighted (based on current route)
  - RTL: sidebar renders on the right side
  - Mobile: overlay sidebar with backdrop

### Footer

- [ ] Create `src/components/layout/Footer.tsx`
  - "Copyright 2025 OBD2SW.com" centered

---

## Shared Components

### StatsCard

- [ ] Create `src/components/shared/StatsCard.tsx`
  ```tsx
  Props: { title: string, value: string|number, icon: LucideIcon, trend?: number, color?: string }
  // Displays: icon | title | value | trend arrow (up green / down red)
  ```

### DataTable

- [ ] Create `src/components/shared/DataTable.tsx`
  - Uses TanStack Table (or shadcn DataTable)
  - Props: columns, data, isLoading, pagination, onSort, onFilter
  - Features: column sorting, global search, per-column filters, page size selector
  - Loading state: skeleton rows
  - Empty state: "No data found" message

### StatusBadge

- [ ] Create `src/components/shared/StatusBadge.tsx`
  ```tsx
  Props: { status: 'active' | 'suspended' | 'inactive' | 'expired' | 'pending' }
  // active = green, suspended = amber, inactive = gray, expired = red, pending = blue
  ```

### RoleBadge

- [ ] Create `src/components/shared/RoleBadge.tsx`
  ```tsx
  Props: { role: 'super_admin' | 'manager_parent' | 'manager' | 'reseller' | 'customer' }
  // Each role gets a distinct color
  ```

### Other Shared

- [ ] Create `LoadingSpinner.tsx` (full page + inline variants)
- [ ] Create `EmptyState.tsx` (icon + message + optional action button)
- [ ] Create `ConfirmDialog.tsx` (shadcn AlertDialog - "Are you sure?" + confirm/cancel)
- [ ] Create `ExportButtons.tsx` (CSV + PDF download buttons)

---

## Chart Components

- [ ] Create `src/components/charts/RevenueChart.tsx`
  - Recharts `<LineChart>` with monthly revenue data
  - Responsive container
  - Tooltip on hover
- [ ] Create `src/components/charts/TenantComparisonChart.tsx`
  - Recharts `<BarChart>` comparing tenants by revenue
- [ ] Create `src/components/charts/ActivationTimeline.tsx`
  - Recharts `<AreaChart>` showing daily activations

---

## Super Admin Pages

### Dashboard (`/super-admin/dashboard`)

- [ ] Create `src/pages/super-admin/Dashboard.tsx`
- [ ] Render 4 StatsCards in a grid (2x2 mobile, 4x1 desktop)
- [ ] Render RevenueChart below stats (full width)
- [ ] Render TenantComparisonChart (half width) + Recent Activity (half width)
- [ ] Use React Query to fetch `/api/super-admin/dashboard/stats`
- [ ] Loading skeletons while data fetches

### Tenants (`/super-admin/tenants`)

- [ ] Create `src/pages/super-admin/Tenants.tsx`
- [ ] DataTable with tenant data
- [ ] "Add Tenant" button opens modal with form:
  - Tenant name, Manager Parent name, email, password
- [ ] Row actions dropdown: Edit, Suspend/Activate, Delete
- [ ] Edit opens modal with pre-filled form
- [ ] Delete shows ConfirmDialog
- [ ] Status filter tabs: All | Active | Suspended
- [ ] Search input for tenant name
- [ ] Pagination (10, 25, 50 per page)

### Users (`/super-admin/users`)

- [ ] Create `src/pages/super-admin/Users.tsx`
- [ ] DataTable with all users
- [ ] Role filter dropdown
- [ ] Tenant filter dropdown
- [ ] Status filter tabs
- [ ] Search by name/email
- [ ] Row actions: Suspend, Activate, Delete
- [ ] Role count cards above table (e.g., "5 Admins, 12 Resellers, 45 Customers")

### Reports (`/super-admin/reports`)

- [ ] Create `src/pages/super-admin/Reports.tsx`
- [ ] Date range picker (shadcn DateRangePicker)
- [ ] Revenue by Tenant chart (Bar)
- [ ] Activations by Tenant chart (Stacked Bar)
- [ ] Growth chart (Line - new users per month)
- [ ] Top Resellers table (top 20)
- [ ] Export CSV button
- [ ] Export PDF button

### Logs (`/super-admin/logs`)

- [ ] Create `src/pages/super-admin/Logs.tsx`
- [ ] DataTable with log entries
- [ ] Filters: Tenant, Endpoint, Method (GET/POST), Status code range, Date range
- [ ] Click row to expand JSON viewer (request + response body)
- [ ] Color-coded status: 2xx green, 4xx yellow, 5xx red
- [ ] Auto-refresh toggle (new logs via Pusher or polling)

### API Status (`/super-admin/api-status`)

- [ ] Create `src/pages/super-admin/ApiStatus.tsx`
- [ ] Large status indicator: green circle "Online" / red circle "Offline"
- [ ] Last check time + response time in ms
- [ ] Uptime percentages: 24h, 7d, 30d
- [ ] Response time history chart (Line - last 24h)
- [ ] "Ping Now" button (manual health check)
- [ ] Endpoint list with individual status

### Settings (`/super-admin/settings`)

- [ ] Create `src/pages/super-admin/Settings.tsx`
- [ ] Tab layout: General | API | Notifications | Security
- [ ] General: Platform name input, default trial days, maintenance mode switch
- [ ] API: URL (readonly), API key (masked with reveal toggle), timeout input
- [ ] Notifications: Email toggle, Pusher toggle
- [ ] Security: Min password length, session timeout
- [ ] Save button per section (or single save all)
- [ ] Success toast on save

### Profile (`/super-admin/profile`)

- [ ] Create `src/pages/super-admin/Profile.tsx`
- [ ] Profile card: avatar placeholder, name, email, role badge
- [ ] Edit profile form: name, email, phone
- [ ] Change password form: current password, new password, confirm password
- [ ] Notification preferences toggles
- [ ] Save buttons

### Admin Management (`/super-admin/admin-management`)

- [ ] Create `src/pages/super-admin/AdminManagement.tsx`
- [ ] DataTable: Name, Email, Role, Status, Created At, Actions
- [ ] "Add Admin" button opens modal:
  - Name, Email, Password, Role (manager_parent/manager/reseller), Tenant assignment
- [ ] Row actions: Edit, Suspend/Activate, Delete, Reset Password
- [ ] Filter by role, tenant, status
- [ ] Search by name/email
- [ ] Bulk actions: Suspend Selected, Delete Selected

### BIOS Blacklist (`/super-admin/bios-blacklist`)

- [ ] Create `src/pages/super-admin/BiosBlacklist.tsx`
- [ ] DataTable: BIOS ID, Added By, Reason, Status (active/removed), Date Added, Actions
- [ ] "Add to Blacklist" button opens modal:
  - BIOS ID input (required)
  - Reason textarea (required)
- [ ] Row actions: Remove from Blacklist, View History
- [ ] Search by BIOS ID
- [ ] Filter: Active | Removed
- [ ] Import/Export blacklist (CSV)
- [ ] Wire to `/api/super-admin/bios-blacklist` endpoints

### BIOS History (`/super-admin/bios-history`)

- [ ] Create `src/pages/super-admin/BiosHistory.tsx`
- [ ] Search bar: Enter BIOS ID to view full history
- [ ] Timeline view per BIOS ID:
  - All activations, deactivations, renewals, conflicts, blacklist events
  - Across ALL tenants (global view)
- [ ] DataTable: BIOS ID, Tenant, Customer, Action, Date, Status
- [ ] Filter by tenant, action type, date range
- [ ] Wire to `/api/super-admin/bios-history` endpoints

### Username Management (`/super-admin/username-management`)

- [ ] Create `src/pages/super-admin/UsernameManagement.tsx`
- [ ] DataTable: User, Username, Email, Role, Tenant, Locked Status, Actions
- [ ] Scope: ALL users across ALL tenants (GLOBAL)
- [ ] Actions per user:
  - Unlock username (if locked)
  - Change username
  - Reset password
- [ ] "Unlock" shows ConfirmDialog with reason input
- [ ] "Change Username" opens modal: new username input + reason
- [ ] All changes logged to `activity_logs` table
- [ ] Filter by tenant, role, locked status
- [ ] Search by username/email
- [ ] Wire to `/api/super-admin/username-management` endpoints

### Financial Reports (`/super-admin/financial-reports`)

- [ ] Create `src/pages/super-admin/FinancialReports.tsx`
- [ ] Date range picker
- [ ] Revenue by Tenant (Bar chart)
- [ ] Revenue by Program across tenants (Stacked Bar)
- [ ] Monthly Revenue Trend (Line chart)
- [ ] Reseller Balances section:
  - DataTable: Reseller, Tenant, Total Revenue, Total Activations, Avg Price, Balance
  - Sort by revenue, activations
- [ ] Summary cards: Total Platform Revenue, Total Activations, Active Licenses, Avg Revenue/Tenant
- [ ] Export CSV + PDF
- [ ] Wire to `/api/super-admin/financial-reports` endpoints

---

## Backend Controllers (New for added pages)

- [ ] Create `SuperAdmin/AdminManagementController.php`
  - `index()` - paginated admins with filters
  - `store()` - create admin user with role/tenant
  - `update()` - edit admin details
  - `destroy()` - delete admin
  - `resetPassword()` - reset admin password
- [ ] Create `SuperAdmin/BiosBlacklistController.php`
  - `index()` - paginated blacklist entries
  - `store()` - add BIOS to blacklist
  - `remove()` - remove from blacklist
  - `import()` - CSV import
  - `export()` - CSV export
- [ ] Create `SuperAdmin/BiosHistoryController.php`
  - `index()` - global BIOS history with filters
  - `show($biosId)` - full timeline for a BIOS ID
- [ ] Create `SuperAdmin/UsernameManagementController.php`
  - `index()` - all users with username info
  - `unlock($userId)` - unlock username
  - `changeUsername($userId)` - change username + log
  - `resetPassword($userId)` - reset password + log
- [ ] Create `SuperAdmin/FinancialReportController.php`
  - Revenue by tenant, by program
  - Reseller balances aggregation
  - CSV/PDF export

---

## i18n Setup (URL-Based Routing)

- [ ] Install: `npm install i18next react-i18next` (should already be installed from Phase 00)
- [ ] Create `src/i18n.ts` configuration file (lng defaults to `'ar'`, overridden by URL)
- [ ] Create `src/locales/ar.json` with all Super Admin translations
- [ ] Create `src/locales/en.json` with all Super Admin translations
- [ ] Create `src/hooks/useLanguage.ts`:
  - Reads `/:lang` param from URL (`useParams`)
  - Calls `i18n.changeLanguage(lang)` on mount/change
  - Sets `document.documentElement.dir` (rtl/ltr) based on lang
  - Sets `document.documentElement.lang` based on lang
  - `switchLanguage()` navigates from `/ar/...` to `/en/...` (preserves current path)
- [ ] Wrap ALL routes under `/:lang` prefix in `src/router/index.tsx`
- [ ] Add `<Navigate from="/" to="/ar" replace />` for root redirect
- [ ] Add language switcher button to Navbar (navigates between `/ar/` and `/en/` URLs)
- [ ] Test: Visit `/en/super-admin/dashboard` - all text in English, LTR layout
- [ ] Test: Visit `/ar/super-admin/dashboard` - all text in Arabic, RTL layout
- [ ] Test: Click language toggle - URL changes from `/ar/...` to `/en/...` and vice versa
- [ ] Test: Sharing `/en/super-admin/tenants` URL opens in English directly

---

## Dark/Light Mode

- [ ] Create `src/hooks/useTheme.ts`
  ```tsx
  // Reads from localStorage or system preference
  // Toggles 'dark' class on <html> element
  // Tailwind dark: variant works
  ```
- [ ] Add dark mode colors to `tailwind.config.ts`
- [ ] Theme toggle button in Navbar (Sun/Moon icon)
- [ ] Test: Toggle preserves across page navigation
- [ ] Test: System preference detection on first visit

---

## Backend Controllers (New)

- [ ] Create `SuperAdmin/DashboardController.php`
  - `stats()` - count tenants, users, licenses, sum revenue
  - `revenueTrend()` - monthly revenue for last 12 months
  - `tenantComparison()` - top 10 tenants by revenue
  - `recentActivity()` - last 20 activity log entries
- [ ] Create `SuperAdmin/TenantController.php` (apiResource)
  - `index()` - paginated tenants with stats (managers_count, resellers_count, etc.)
  - `store()` - create tenant + manager_parent user
  - `show()` - tenant with full stats
  - `update()` - update tenant name/settings/status
  - `destroy()` - soft delete tenant
- [ ] Create `SuperAdmin/UserController.php`
  - `index()` - all users with filters (role, tenant, status, search)
  - `updateStatus()` - change user status
  - `destroy()` - delete user
- [ ] Create `SuperAdmin/ReportController.php`
  - Revenue, activations, growth, top resellers, CSV/PDF export
- [ ] Create `SuperAdmin/LogController.php`
  - `index()` - paginated logs with filters
  - `show()` - single log with full request/response
- [ ] Create `SuperAdmin/ApiStatusController.php`
  - `index()` - current API status
  - `history()` - response time history
  - `ping()` - manual health check
- [ ] Create `SuperAdmin/SettingsController.php`
  - `index()` - get all settings
  - `update()` - save settings

---

## API Services (Frontend)

- [ ] Create `src/services/tenant.service.ts`
  - `getAll(params)`, `create(data)`, `update(id, data)`, `delete(id)`, `getStats(id)`
- [ ] Create `src/services/user.service.ts`
  - `getAll(params)`, `updateStatus(id, status)`, `delete(id)`
- [ ] Create `src/services/report.service.ts`
  - `getRevenue(params)`, `getActivations(params)`, `exportCsv(params)`, `exportPdf(params)`
- [ ] Create `src/services/log.service.ts`
  - `getAll(params)`, `getById(id)`
- [ ] Wire all services with React Query hooks in each page

---

## Router Updates

- [ ] Add Super Admin routes to `src/router/index.tsx` under `/:lang` prefix:
  ```tsx
  <Route path="/" element={<Navigate to="/ar" replace />} />
  <Route path="/:lang">
    <Route path="super-admin" element={<DashboardLayout />}>
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="tenants" element={<Tenants />} />
      <Route path="users" element={<Users />} />
      <Route path="admin-management" element={<AdminManagement />} />
      <Route path="bios-blacklist" element={<BiosBlacklist />} />
      <Route path="bios-history" element={<BiosHistory />} />
      <Route path="username-management" element={<UsernameManagement />} />
      <Route path="financial-reports" element={<FinancialReports />} />
      <Route path="reports" element={<Reports />} />
      <Route path="logs" element={<Logs />} />
      <Route path="api-status" element={<ApiStatus />} />
      <Route path="settings" element={<Settings />} />
      <Route path="profile" element={<Profile />} />
    </Route>
  </Route>
  ```

---

## Testing (35 Component Tests)

- [ ] Test 1: DashboardLayout renders Navbar, Sidebar, and content area
- [ ] Test 2: Navbar shows correct links for super_admin role
- [ ] Test 3: Sidebar highlights active route
- [ ] Test 4: Sidebar collapses on mobile viewport
- [ ] Test 5: StatsCard renders title, value, and icon
- [ ] Test 6: StatsCard shows positive trend in green
- [ ] Test 7: DataTable renders columns and rows
- [ ] Test 8: DataTable pagination works
- [ ] Test 9: DataTable search filters rows
- [ ] Test 10: StatusBadge shows correct color for each status
- [ ] Test 11: RoleBadge shows correct label for each role
- [ ] Test 12: Dashboard page renders 5 stats cards
- [ ] Test 13: Dashboard page renders charts
- [ ] Test 14: Tenants page renders data table
- [ ] Test 15: Tenants "Add" button opens modal
- [ ] Test 16: Users page renders with role filter
- [ ] Test 17: Reports page renders charts and export buttons
- [ ] Test 18: Logs page renders log table
- [ ] Test 19: Logs page expands row to show JSON
- [ ] Test 20: API Status page shows status indicator
- [ ] Test 21: Settings page renders form tabs
- [ ] Test 22: Profile page renders edit form
- [ ] Test 23: Language toggle navigates from `/ar/...` to `/en/...` URL
- [ ] Test 24: RTL layout applied when URL starts with `/ar/`
- [ ] Test 36: LTR layout applied when URL starts with `/en/`
- [ ] Test 37: Direct visit to `/en/super-admin/dashboard` renders in English
- [ ] Test 25: Dark mode toggle adds 'dark' class
- [ ] Test 26: Admin Management page renders admin table
- [ ] Test 27: Admin Management "Add Admin" opens modal with role selection
- [ ] Test 28: BIOS Blacklist page renders blacklist table
- [ ] Test 29: BIOS Blacklist "Add" opens modal with BIOS ID + reason
- [ ] Test 30: BIOS History page renders search and timeline
- [ ] Test 31: Username Management page renders user table with lock status
- [ ] Test 32: Username Management "Unlock" shows confirm dialog
- [ ] Test 33: Username Management "Change Username" opens modal
- [ ] Test 34: Financial Reports page renders charts and reseller balances
- [ ] Test 35: Financial Reports export buttons work

---

## Verification (End of Day 3)

```bash
# All 13 pages accessible at (Arabic):
/ar/super-admin/dashboard
/ar/super-admin/tenants
/ar/super-admin/users
/ar/super-admin/admin-management
/ar/super-admin/bios-blacklist
/ar/super-admin/bios-history
/ar/super-admin/username-management
/ar/super-admin/financial-reports
/ar/super-admin/reports
/ar/super-admin/logs
/ar/super-admin/api-status
/ar/super-admin/settings
/ar/super-admin/profile

# Same pages in English:
/en/super-admin/dashboard  (etc.)

# Language switch: navigates from /ar/... to /en/... (preserves path)
# Switch to Dark mode: all backgrounds change
# Resize to mobile: sidebar becomes hamburger menu
# 35 tests passing (run from tests-frontend/)
cd tests-frontend && npm run test:unit -- --testPathPattern=super-admin
```

**Phase 02 complete. Proceed to PHASE-03-ManagerParent.**
