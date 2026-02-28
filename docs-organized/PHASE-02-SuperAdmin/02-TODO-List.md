# PHASE 02: Super Admin - TODO List

**Duration:** Day 3
**Deadline:** End of Day 3

> Status updated on 2026-02-28:
> Checked items are implemented and verified in the current codebase.
> Phase 02 frontend/backend verification completed with passing lint, typecheck, build, unit tests, and backend tests.

---

## Layout Components

### DashboardLayout

- [x] Create `src/components/layout/DashboardLayout.tsx`
  - Wraps all authenticated pages
  - Renders: Navbar (top) + Sidebar (left/right based on RTL) + Content (main)
  - Sidebar state: expanded (desktop) / collapsed (mobile)
  - Uses `<Outlet />` for nested routes

### Navbar

- [x] Create `src/components/layout/Navbar.tsx`
  - Logo (OBD2SW) on left (or right in RTL)
  - Navigation links based on user role
  - Language toggle button (AR/EN) - navigates between `/ar/...` and `/en/...` URL routes
  - Theme toggle button (sun/moon icon) - dark/light mode
  - Profile dropdown: name, role badge, logout
  - Mobile: hamburger menu icon to toggle sidebar

### Sidebar

- [x] Create `src/components/layout/Sidebar.tsx`
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

- [x] Create `src/components/layout/Footer.tsx`
  - "Copyright 2025 OBD2SW.com" centered

---

## Shared Components

### StatsCard

- [x] Create `src/components/shared/StatsCard.tsx`
  ```tsx
  Props: { title: string, value: string|number, icon: LucideIcon, trend?: number, color?: string }
  // Displays: icon | title | value | trend arrow (up green / down red)
  ```

### DataTable

- [x] Create `src/components/shared/DataTable.tsx`
  - Uses TanStack Table (or shadcn DataTable)
  - Props: columns, data, isLoading, pagination, onSort, onFilter
  - Features: column sorting, global search, per-column filters, page size selector
  - Loading state: skeleton rows
  - Empty state: "No data found" message

### StatusBadge

- [x] Create `src/components/shared/StatusBadge.tsx`
  ```tsx
  Props: { status: 'active' | 'suspended' | 'inactive' | 'expired' | 'pending' }
  // active = green, suspended = amber, inactive = gray, expired = red, pending = blue
  ```

### RoleBadge

- [x] Create `src/components/shared/RoleBadge.tsx`
  ```tsx
  Props: { role: 'super_admin' | 'manager_parent' | 'manager' | 'reseller' | 'customer' }
  // Each role gets a distinct color
  ```

### Other Shared

- [x] Create `LoadingSpinner.tsx` (full page + inline variants)
- [x] Create `EmptyState.tsx` (icon + message + optional action button)
- [x] Create `ConfirmDialog.tsx` (shadcn AlertDialog - "Are you sure?" + confirm/cancel)
- [x] Create `ExportButtons.tsx` (CSV + PDF download buttons)

---

## Chart Components

- [x] Create `src/components/charts/RevenueChart.tsx`
  - Recharts `<LineChart>` with monthly revenue data
  - Responsive container
  - Tooltip on hover
- [x] Create `src/components/charts/TenantComparisonChart.tsx`
  - Recharts `<BarChart>` comparing tenants by revenue
- [x] Create `src/components/charts/ActivationTimeline.tsx`
  - Recharts `<AreaChart>` showing daily activations

---

## Super Admin Pages

### Dashboard (`/super-admin/dashboard`)

- [x] Create `src/pages/super-admin/Dashboard.tsx`
- [x] Render 5 StatsCards in a grid (2x2 mobile, 5-up on wide desktop)
- [x] Render RevenueChart below stats (full width)
- [x] Render TenantComparisonChart (half width) + Recent Activity (half width)
- [x] Use React Query to fetch `/api/super-admin/dashboard/stats`
- [x] Loading skeletons while data fetches

### Tenants (`/super-admin/tenants`)

- [x] Create `src/pages/super-admin/Tenants.tsx`
- [x] DataTable with tenant data
- [x] "Add Tenant" button opens modal with form:
  - Tenant name, Manager Parent name, email, password
- [x] Row actions dropdown: Edit, Suspend/Activate, Delete
- [x] Edit opens modal with pre-filled form
- [x] Delete shows ConfirmDialog
- [x] Status filter tabs: All | Active | Suspended
- [x] Search input for tenant name
- [x] Pagination (10, 25, 50 per page)

### Users (`/super-admin/users`)

- [x] Create `src/pages/super-admin/Users.tsx`
- [x] DataTable with all users
- [x] Role filter dropdown
- [x] Tenant filter dropdown
- [x] Status filter tabs
- [x] Search by name/email
- [x] Row actions: Suspend, Activate, Delete
- [x] Role count cards above table (e.g., "5 Admins, 12 Resellers, 45 Customers")

### Reports (`/super-admin/reports`)

- [x] Create `src/pages/super-admin/Reports.tsx`
- [x] Date range picker (shadcn DateRangePicker)
- [x] Revenue by Tenant chart (Bar)
- [x] Activations by Tenant chart (Stacked Bar)
- [x] Growth chart (Line - new users per month)
- [x] Top Resellers table (top 20)
- [x] Export CSV button
- [x] Export PDF button

### Logs (`/super-admin/logs`)

- [x] Create `src/pages/super-admin/Logs.tsx`
- [x] DataTable with log entries
- [x] Filters: Tenant, Endpoint, Method (GET/POST), Status code range, Date range
- [x] Click row to expand JSON viewer (request + response body)
- [x] Color-coded status: 2xx green, 4xx yellow, 5xx red
- [x] Auto-refresh toggle (new logs via Pusher or polling)

### API Status (`/super-admin/api-status`)

- [x] Create `src/pages/super-admin/ApiStatus.tsx`
- [x] Large status indicator: green circle "Online" / red circle "Offline"
- [x] Last check time + response time in ms
- [x] Uptime percentages: 24h, 7d, 30d
- [x] Response time history chart (Line - last 24h)
- [x] "Ping Now" button (manual health check)
- [x] Endpoint list with individual status

### Settings (`/super-admin/settings`)

- [x] Create `src/pages/super-admin/Settings.tsx`
- [x] Tab layout: General | API | Notifications | Security
- [x] General: Platform name input, default trial days, maintenance mode switch
- [x] API: URL (readonly), API key (masked with reveal toggle), timeout input
- [x] Notifications: Email toggle, Pusher toggle
- [x] Security: Min password length, session timeout
- [x] Save button per section (or single save all)
- [x] Success toast on save

### Profile (`/super-admin/profile`)

- [x] Create `src/pages/super-admin/Profile.tsx`
- [x] Profile card: avatar placeholder, name, email, role badge
- [x] Edit profile form: name, email, phone
- [x] Change password form: current password, new password, confirm password
- [x] Notification preferences toggles
- [x] Save buttons

### Admin Management (`/super-admin/admin-management`)

- [x] Create `src/pages/super-admin/AdminManagement.tsx`
- [x] DataTable: Name, Email, Role, Status, Created At, Actions
- [x] "Add Admin" button opens modal:
  - Name, Email, Password, Role (manager_parent/manager/reseller), Tenant assignment
- [x] Row actions: Edit, Suspend/Activate, Delete, Reset Password
- [x] Filter by role, tenant, status
- [x] Search by name/email
- [x] Bulk actions: Suspend Selected, Delete Selected

### BIOS Blacklist (`/super-admin/bios-blacklist`)

- [x] Create `src/pages/super-admin/BiosBlacklist.tsx`
- [x] DataTable: BIOS ID, Added By, Reason, Status (active/removed), Date Added, Actions
- [x] "Add to Blacklist" button opens modal:
  - BIOS ID input (required)
  - Reason textarea (required)
- [x] Row actions: Remove from Blacklist, View History
- [x] Search by BIOS ID
- [x] Filter: Active | Removed
- [x] Import/Export blacklist (CSV)
- [x] Wire to `/api/super-admin/bios-blacklist` endpoints

### BIOS History (`/super-admin/bios-history`)

- [x] Create `src/pages/super-admin/BiosHistory.tsx`
- [x] Search bar: Enter BIOS ID to view full history
- [x] Timeline view per BIOS ID:
  - All activations, deactivations, renewals, conflicts, blacklist events
  - Across ALL tenants (global view)
- [x] DataTable: BIOS ID, Tenant, Customer, Action, Date, Status
- [x] Filter by tenant, action type, date range
- [x] Wire to `/api/super-admin/bios-history` endpoints

### Username Management (`/super-admin/username-management`)

- [x] Create `src/pages/super-admin/UsernameManagement.tsx`
- [x] DataTable: User, Username, Email, Role, Tenant, Locked Status, Actions
- [x] Scope: ALL users across ALL tenants (GLOBAL)
- [x] Actions per user:
  - Unlock username (if locked)
  - Change username
  - Reset password
- [x] "Unlock" shows ConfirmDialog with reason input
- [x] "Change Username" opens modal: new username input + reason
- [x] All changes logged to `activity_logs` table
- [x] Filter by tenant, role, locked status
- [x] Search by username/email
- [x] Wire to `/api/super-admin/username-management` endpoints

### Financial Reports (`/super-admin/financial-reports`)

- [x] Create `src/pages/super-admin/FinancialReports.tsx`
- [x] Date range picker
- [x] Revenue by Tenant (Bar chart)
- [x] Revenue by Program across tenants (Stacked Bar)
- [x] Monthly Revenue Trend (Line chart)
- [x] Reseller Balances section:
  - DataTable: Reseller, Tenant, Total Revenue, Total Activations, Avg Price, Balance
  - Sort by revenue, activations
- [x] Summary cards: Total Platform Revenue, Total Activations, Active Licenses, Avg Revenue/Tenant
- [x] Export CSV + PDF
- [x] Wire to `/api/super-admin/financial-reports` endpoints

---

## Backend Controllers (New for added pages)

- [x] Create `SuperAdmin/AdminManagementController.php`
  - `index()` - paginated admins with filters
  - `store()` - create admin user with role/tenant
  - `update()` - edit admin details
  - `destroy()` - delete admin
  - `resetPassword()` - reset admin password
- [x] Create `SuperAdmin/BiosBlacklistController.php`
  - `index()` - paginated blacklist entries
  - `store()` - add BIOS to blacklist
  - `remove()` - remove from blacklist
  - `import()` - CSV import
  - `export()` - CSV export
- [x] Create `SuperAdmin/BiosHistoryController.php`
  - `index()` - global BIOS history with filters
  - `show($biosId)` - full timeline for a BIOS ID
- [x] Create `SuperAdmin/UsernameManagementController.php`
  - `index()` - all users with username info
  - `unlock($userId)` - unlock username
  - `changeUsername($userId)` - change username + log
  - `resetPassword($userId)` - reset password + log
- [x] Create `SuperAdmin/FinancialReportController.php`
  - Revenue by tenant, by program
  - Reseller balances aggregation
  - CSV/PDF export

---

## i18n Setup (URL-Based Routing)

- [x] Install: `npm install i18next react-i18next` (should already be installed from Phase 00)
- [x] Create `src/i18n.ts` configuration file (lng defaults to `'ar'`, overridden by URL)
- [x] Create `src/locales/ar.json` with all Super Admin translations
- [x] Create `src/locales/en.json` with all Super Admin translations
- [x] Create `src/hooks/useLanguage.ts`:
  - Reads `/:lang` param from URL (`useParams`)
  - Calls `i18n.changeLanguage(lang)` on mount/change
  - Sets `document.documentElement.dir` (rtl/ltr) based on lang
  - Sets `document.documentElement.lang` based on lang
  - `switchLanguage()` navigates from `/ar/...` to `/en/...` (preserves current path)
- [x] Wrap ALL routes under `/:lang` prefix in `src/router/index.tsx`
- [x] Add `<Navigate from="/" to="/ar" replace />` for root redirect
- [x] Add language switcher button to Navbar (navigates between `/ar/` and `/en/` URLs)
- [x] Test: Visit `/en/super-admin/dashboard` - all text in English, LTR layout
- [x] Test: Visit `/ar/super-admin/dashboard` - all text in Arabic, RTL layout
- [x] Test: Click language toggle - URL changes from `/ar/...` to `/en/...` and vice versa
- [x] Test: Sharing `/en/super-admin/tenants` URL opens in English directly

---

## Dark/Light Mode

- [x] Create `src/hooks/useTheme.ts`
  ```tsx
  // Reads from localStorage or system preference
  // Toggles 'dark' class on <html> element
  // Tailwind dark: variant works
  ```
- [x] Add dark mode colors to `tailwind.config.ts`
- [x] Theme toggle button in Navbar (Sun/Moon icon)
- [x] Test: Toggle preserves across page navigation
- [x] Test: System preference detection on first visit

---

## Backend Controllers (New)

- [x] Create `SuperAdmin/DashboardController.php`
  - `stats()` - count tenants, users, licenses, sum revenue
  - `revenueTrend()` - monthly revenue for last 12 months
  - `tenantComparison()` - top 10 tenants by revenue
  - `recentActivity()` - last 20 activity log entries
- [x] Create `SuperAdmin/TenantController.php` (apiResource)
  - `index()` - paginated tenants with stats (managers_count, resellers_count, etc.)
  - `store()` - create tenant + manager_parent user
  - `show()` - tenant with full stats
  - `update()` - update tenant name/settings/status
  - `destroy()` - soft delete tenant
- [x] Create `SuperAdmin/UserController.php`
  - `index()` - all users with filters (role, tenant, status, search)
  - `updateStatus()` - change user status
  - `destroy()` - delete user
- [x] Create `SuperAdmin/ReportController.php`
  - Revenue, activations, growth, top resellers, CSV/PDF export
- [x] Create `SuperAdmin/LogController.php`
  - `index()` - paginated logs with filters
  - `show()` - single log with full request/response
- [x] Create `SuperAdmin/ApiStatusController.php`
  - `index()` - current API status
  - `history()` - response time history
  - `ping()` - manual health check
- [x] Create `SuperAdmin/SettingsController.php`
  - `index()` - get all settings
  - `update()` - save settings

---

## API Services (Frontend)

- [x] Create `src/services/tenant.service.ts`
  - `getAll(params)`, `create(data)`, `update(id, data)`, `delete(id)`, `getStats(id)`
- [x] Create `src/services/user.service.ts`
  - `getAll(params)`, `updateStatus(id, status)`, `delete(id)`
- [x] Create `src/services/report.service.ts`
  - `getRevenue(params)`, `getActivations(params)`, `exportCsv(params)`, `exportPdf(params)`
- [x] Create `src/services/log.service.ts`
  - `getAll(params)`, `getById(id)`
- [x] Wire all services with React Query hooks in each page

---

## Router Updates

- [x] Add Super Admin routes to `src/router/index.tsx` under `/:lang` prefix:
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

- [x] Test 1: DashboardLayout renders Navbar, Sidebar, and content area
- [x] Test 2: Super admin navigation renders the correct links
- [x] Test 3: Sidebar highlights active route
- [x] Test 4: Sidebar collapses on mobile viewport
- [x] Test 5: StatsCard renders title, value, and icon
- [x] Test 6: StatsCard shows positive trend in green
- [x] Test 7: DataTable renders columns and rows
- [x] Test 8: DataTable pagination works
- [x] Test 9: DataTable search filters rows
- [x] Test 10: StatusBadge shows correct color for each status
- [x] Test 11: RoleBadge shows correct label for each role
- [x] Test 12: Dashboard page renders 5 stats cards
- [x] Test 13: Dashboard page renders charts
- [x] Test 14: Tenants page renders data table
- [x] Test 15: Tenants "Add" button opens modal
- [x] Test 16: Users page renders with role filter
- [x] Test 17: Reports page renders charts and export buttons
- [x] Test 18: Logs page renders log table
- [x] Test 19: Logs page expands row to show JSON
- [x] Test 20: API Status page shows status indicator
- [x] Test 21: Settings page renders form tabs
- [x] Test 22: Profile page renders edit form
- [x] Test 23: Language toggle navigates from `/ar/...` to `/en/...` URL
- [x] Test 24: RTL layout applied when URL starts with `/ar/`
- [x] Test 25: Dark mode toggle adds 'dark' class
- [x] Test 26: Admin Management page renders admin table
- [x] Test 27: Admin Management "Add Admin" opens modal with role selection
- [x] Test 28: BIOS Blacklist page renders blacklist table
- [x] Test 29: BIOS Blacklist "Add" opens modal with BIOS ID + reason
- [x] Test 30: BIOS History page renders search and timeline
- [x] Test 31: Username Management page renders user table with lock status
- [x] Test 32: Username Management "Unlock" shows confirm dialog
- [x] Test 33: Username Management "Change Username" opens modal
- [x] Test 34: Financial Reports page renders charts and reseller balances
- [x] Test 35: Financial Reports export buttons work

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
# 35 frontend tests passing
cd tests-frontend && npm run test:unit -- --runInBand
```

**Phase 02 implementation verified. Remaining unchecked items are follow-up spec-alignment tasks before PHASE-03-ManagerParent.**
