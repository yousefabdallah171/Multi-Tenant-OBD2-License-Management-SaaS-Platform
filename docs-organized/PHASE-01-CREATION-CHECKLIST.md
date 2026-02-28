# Phase 01: File Creation Checklist
**Status:** Pre-Implementation Planning
**Target:** Create all files needed for Phase 01 Foundation

---

## PART 1: FRONTEND FILE CREATION

### 1.1 Create `src/lib/` - Utilities (3 files)

#### ❌ → ✅ src/lib/utils.ts
Purpose: Common utility functions
Must include:
- `cn()` - Tailwind class merging (clsx + tailwind-merge)
- `formatDate(date, format)` - Date formatting
- `formatCurrency(amount, currency)` - Currency formatting
- `formatBytes(bytes)` - File size formatting
- `getStatusColor(status)` - Status to color mapping

Status: **MISSING** - Create from README example

#### ❌ → ✅ src/lib/constants.ts
Purpose: Application constants
Must include:
- `ROUTES` - All route paths with /:lang prefix
- `USER_ROLES` - ['super_admin', 'manager_parent', 'manager', 'reseller', 'customer']
- `LICENSE_STATUSES` - ['active', 'expired', 'suspended', 'pending']
- `ACTIVITY_ACTIONS` - All possible activity log actions
- `PAGINATION_DEFAULTS` - { perPage: 10, currentPage: 1 }

Status: **MISSING** - Create

#### ❌ → ✅ src/lib/validators.ts
Purpose: Form validation functions
Must include:
- `validateEmail(email)` - Email regex validation
- `validateBiosId(biosId)` - BIOS ID format (min length)
- `isRequired(value)` - Required field validation
- `validatePassword(password)` - Password strength
- `validatePhone(phone)` - Phone format

Status: **MISSING** - Create

### 1.2 Create `src/components/layout/` - Layout Components (4 files)

#### ❌ → ✅ src/components/layout/DashboardLayout.tsx
Purpose: Main layout wrapper with Navbar + Sidebar
Must include:
- Navbar component
- Sidebar component
- Outlet for page content
- Footer component
- RTL support (isRtl from useLanguage)
- Dark mode support

Status: **MISSING** - Create from README template

#### ❌ → ✅ src/components/layout/Navbar.tsx
Purpose: Top navigation bar
Must include:
- Logo/branding
- Navigation links (role-based)
- Language switcher (AR/EN)
- Theme toggle (dark/light)
- User profile dropdown
- Logout button

Status: **MISSING** - Create from README example

#### ❌ → ✅ src/components/layout/Sidebar.tsx
Purpose: Left/right collapsible navigation
Must include:
- Navigation items (role-based from constants)
- Collapse/expand toggle
- Active link highlighting
- RTL positioning (right-0 in RTL)
- Dark mode styling
- Mobile overlay mode

Status: **MISSING** - Create

#### ❌ → ✅ src/components/layout/Footer.tsx
Purpose: Footer with copyright
Must include:
- Copyright text
- Links to terms/privacy
- Current year
- Company name

Status: **MISSING** - Create

### 1.3 Create `src/components/shared/` - Reusable Components (9 files)

#### ❌ → ✅ src/components/shared/StatsCard.tsx
Purpose: Statistics display card
Props:
- title: string
- value: string | number
- icon: React.ReactNode
- trend?: number
- color?: string

Status: **MISSING** - Create

#### ❌ → ✅ src/components/shared/DataTable.tsx
Purpose: Reusable data table with sort, filter, paginate
Props:
- columns: array
- data: array
- isLoading?: boolean
- onSearch?: (query: string) => void
- onSort?: (column: string) => void
- onPageChange?: (page: number) => void

Status: **MISSING** - Create

#### ❌ → ✅ src/components/shared/StatusBadge.tsx
Purpose: Status indicator badge
Props:
- status: 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'

Status: **MISSING** - Create

#### ❌ → ✅ src/components/shared/RoleBadge.tsx
Purpose: User role badge with color
Props:
- role: 'super_admin' | 'manager_parent' | 'manager' | 'reseller' | 'customer'

Status: **MISSING** - Create

#### ❌ → ✅ src/components/shared/LoadingSpinner.tsx
Purpose: Loading indicator
Props:
- fullPage?: boolean
- text?: string

Status: **MISSING** - Create

#### ❌ → ✅ src/components/shared/EmptyState.tsx
Purpose: Empty data state
Props:
- icon: React.ReactNode
- message: string
- action?: { label: string, onClick: () => void }

Status: **MISSING** - Create

#### ❌ → ✅ src/components/shared/ConfirmDialog.tsx
Purpose: Confirmation modal (shadcn AlertDialog)
Props:
- title: string
- description: string
- onConfirm: () => void
- children: React.ReactNode (trigger)

Status: **MISSING** - Create

#### ❌ → ✅ src/components/shared/ExportButtons.tsx
Purpose: CSV/PDF export buttons
Props:
- onExportCsv: () => Promise<void>
- onExportPdf: () => Promise<void>

Status: **MISSING** - Create

#### ❌ → ✅ src/components/shared/ErrorBoundary.tsx
Purpose: Error boundary with fallback UI
Props:
- children: React.ReactNode

Status: **MISSING** - Create

### 1.4 Create `src/components/charts/` - Chart Components (4 files)

#### ❌ → ✅ src/components/charts/LineChartWidget.tsx
Purpose: Line chart wrapper (Recharts)
Props:
- data: array
- isLoading?: boolean

Status: **MISSING** - Create using Recharts

#### ❌ → ✅ src/components/charts/BarChartWidget.tsx
Purpose: Bar chart wrapper (Recharts)
Props:
- data: array
- isLoading?: boolean
- horizontal?: boolean

Status: **MISSING** - Create using Recharts

#### ❌ → ✅ src/components/charts/PieChartWidget.tsx
Purpose: Pie/donut chart wrapper (Recharts)
Props:
- data: array
- isLoading?: boolean

Status: **MISSING** - Create using Recharts

#### ❌ → ✅ src/components/charts/AreaChartWidget.tsx
Purpose: Area chart wrapper (Recharts)
Props:
- data: array
- isLoading?: boolean

Status: **MISSING** - Create using Recharts

### 1.5 Create `src/components/ui/` - shadcn/ui Base Components

Need to install and configure shadcn/ui components:
```bash
cd frontend
npx shadcn-ui@latest init
# Select: TypeScript, Tailwind, lib/components/ui
npx shadcn-ui@latest add button card input dialog dropdown-menu tabs toast
```

Components to add:
- ❌ button.tsx
- ❌ card.tsx
- ❌ input.tsx
- ❌ label.tsx
- ❌ dialog.tsx
- ❌ dropdown-menu.tsx
- ❌ tabs.tsx
- ❌ toast.tsx / toaster.tsx
- ❌ select.tsx
- ❌ checkbox.tsx

Status: **MISSING** - Install via shadcn-ui CLI

### 1.6 Create `src/hooks/` - Business Logic Hooks (7 new files)

#### ❌ → ✅ src/hooks/useAuth.ts
Purpose: Authentication logic
Returns:
- user: User | null
- isAuthenticated: boolean
- login: (email, password) => Promise<void>
- logout: () => Promise<void>
- getMe: () => Promise<User>

Status: **MISSING** - Create

#### ❌ → ✅ src/hooks/useTheme.ts
Purpose: Dark/light mode toggle
Returns:
- isDark: boolean
- toggleTheme: () => void
- themeClass: string

Status: **MISSING** - Create from README example

#### ❌ → ✅ src/hooks/useRoleGuard.ts
Purpose: Role-based access check
Returns:
- hasRole: (role: string) => boolean
- isLoading: boolean

Status: **MISSING** - Create

#### ❌ → ✅ src/hooks/useHasPermission.ts
Purpose: Permission checking
Returns:
- hasPermission: (permission: string) => boolean

Status: **MISSING** - Create

#### ❌ → ✅ src/hooks/useLicenses.ts
Purpose: License CRUD operations
Returns:
- licenses: License[] | undefined
- isLoading: boolean
- createLicense: useMutation hook
- updateLicense: useMutation hook
- deleteLicense: useMutation hook

Status: **MISSING** - Create

#### ❌ → ✅ src/hooks/useTenants.ts
Purpose: Tenant CRUD operations
Returns:
- tenants: Tenant[] | undefined
- createTenant: useMutation hook
- updateTenant: useMutation hook
- deleteTenant: useMutation hook

Status: **MISSING** - Create

#### ❌ → ✅ src/hooks/usePagination.ts
Purpose: Pagination state management
Returns:
- page: number
- perPage: number
- onPageChange: (page: number) => void
- onPerPageChange: (perPage: number) => void

Status: **MISSING** - Create

### 1.7 Create `src/stores/` - Global State (3 files)

#### ❌ → ✅ src/stores/authStore.ts
Purpose: Authentication state (Zustand)
State:
- user: User | null
- token: string | null
- isAuthenticated: boolean
- setUser: (user: User) => void
- setToken: (token: string) => void
- logout: () => void

Status: **MISSING** - Create using Zustand

#### ❌ → ✅ src/stores/themeStore.ts
Purpose: Dark/light mode persistence (Zustand)
State:
- isDark: boolean
- toggleTheme: () => void
Persist to localStorage

Status: **MISSING** - Create using Zustand

#### ❌ → ✅ src/stores/sidebarStore.ts
Purpose: Sidebar collapsed state (Zustand)
State:
- isCollapsed: boolean
- toggleSidebar: () => void

Status: **MISSING** - Create using Zustand

### 1.8 Expand `src/services/` - API Layer (10 new files)

#### ✅ src/services/api.ts
Status: **EXISTS** - Update to add:
- Response interceptor for 401 handling
- Request interceptor for Authorization header
- Error handling with toast notifications

#### ❌ → ✅ src/services/auth.service.ts
Purpose: Authentication API calls
Endpoints:
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/forgot-password

Status: **MISSING** - Create

#### ❌ → ✅ src/services/tenant.service.ts
Purpose: Tenant management (Super Admin)
Endpoints:
- GET /api/tenants
- POST /api/tenants
- PATCH /api/tenants/{id}
- DELETE /api/tenants/{id}

Status: **MISSING** - Create

#### ❌ → ✅ src/services/user.service.ts
Purpose: User management
Endpoints:
- GET /api/users
- POST /api/users
- PATCH /api/users/{id}
- DELETE /api/users/{id}

Status: **MISSING** - Create

#### ❌ → ✅ src/services/license.service.ts
Purpose: License management
Endpoints:
- GET /api/licenses
- POST /api/licenses/activate
- POST /api/licenses/{id}/renew
- POST /api/licenses/{id}/deactivate

Status: **MISSING** - Create

#### ❌ → ✅ src/services/program.service.ts
Purpose: Program/software management
Endpoints:
- GET /api/programs
- POST /api/programs
- PATCH /api/programs/{id}
- DELETE /api/programs/{id}

Status: **MISSING** - Create

#### ❌ → ✅ src/services/report.service.ts
Purpose: Reports and analytics
Endpoints:
- GET /api/reports
- POST /api/reports/export-csv
- POST /api/reports/export-pdf

Status: **MISSING** - Create

#### ❌ → ✅ src/services/log.service.ts
Purpose: API logs and activity logs
Endpoints:
- GET /api/logs
- GET /api/logs/{id}

Status: **MISSING** - Create

#### ❌ → ✅ src/services/bios.service.ts
Purpose: BIOS blacklist and history
Endpoints:
- GET /api/bios/blacklist
- POST /api/bios/blacklist
- DELETE /api/bios/blacklist/{id}
- GET /api/bios/history

Status: **MISSING** - Create

#### ❌ → ✅ src/services/balance.service.ts
Purpose: Reseller balance management
Endpoints:
- GET /api/balance
- POST /api/balance/top-up

Status: **MISSING** - Create

#### ❌ → ✅ src/services/financial.service.ts
Purpose: Financial reports
Endpoints:
- GET /api/financial/reports
- POST /api/financial/export

Status: **MISSING** - Create

### 1.9 Expand `src/router/` - Router Configuration (2 new files)

#### ✅ src/router/index.tsx
Status: **EXISTS** - Update to:
- Add all 43 page routes organized by role
- Use /:lang prefix for all routes
- Add role-based route protection

#### ❌ → ✅ src/router/guards.tsx
Purpose: Route protection components
Components:
- ProtectedRoute - Requires authentication + optional role
- RoleGuard - Requires specific role
- GuestRoute - Only for unauthenticated

Status: **MISSING** - Create

#### ❌ → ✅ src/router/routes.ts
Purpose: Route path constants
Exports:
- ROUTES.AUTH.LOGIN = '/ar/login'
- ROUTES.SUPER_ADMIN.DASHBOARD = '/ar/super-admin/dashboard'
- etc. for all 43 pages

Status: **MISSING** - Create

### 1.10 Expand `src/types/` - Type Definitions (4 new files)

#### ✅ src/types/api.types.ts
Status: **EXISTS** - Keep and expand

#### ❌ → ✅ src/types/user.types.ts
Purpose: User interfaces
Types:
- IUser
- IUserRole
- IUserPermission

Status: **MISSING** - Create

#### ❌ → ✅ src/types/tenant.types.ts
Purpose: Tenant interfaces
Types:
- ITenant
- ITenantStatus

Status: **MISSING** - Create

#### ❌ → ✅ src/types/license.types.ts
Purpose: License interfaces
Types:
- ILicense
- ILicenseStatus
- IActivationRequest

Status: **MISSING** - Create

#### ❌ → ✅ src/types/program.types.ts
Purpose: Program interfaces
Types:
- IProgram
- IProgramVersion

Status: **MISSING** - Create

### 1.11 Create `src/pages/auth/` - Authentication Pages (2 files)

#### ❌ → ✅ src/pages/auth/Login.tsx
Purpose: Login page
Must include:
- Email and password inputs
- Form validation
- API call to login endpoint
- Token storage in authStore
- Redirect to dashboard on success
- Dark mode support
- i18n translations

Status: **MISSING** - Create from README template

#### ❌ → ✅ src/pages/auth/ForgotPassword.tsx
Purpose: Password reset page
Must include:
- Email input
- Form validation
- API call to forgot-password endpoint
- Success message
- Link back to login

Status: **MISSING** - Create

### 1.12 Create `src/pages/super-admin/` - Super Admin Pages (13 files)

Status: **MISSING** - Create all 13:
1. ❌ Dashboard.tsx
2. ❌ Tenants.tsx
3. ❌ Users.tsx
4. ❌ AdminManagement.tsx
5. ❌ BiosBlacklist.tsx
6. ❌ BiosHistory.tsx
7. ❌ UsernameManagement.tsx
8. ❌ FinancialReports.tsx
9. ❌ Reports.tsx
10. ❌ Logs.tsx
11. ❌ ApiStatus.tsx
12. ❌ Settings.tsx
13. ❌ Profile.tsx

Each must include:
- TypeScript props interface
- useLanguage hook
- React Query for data fetching
- Dark mode styling (dark: prefixes)
- RTL support (rtl: prefixes)
- i18n translations

### 1.13 Create `src/pages/manager-parent/` - Manager Parent Pages (12 files)

Status: **MISSING** - Create all 12:
1. ❌ Dashboard.tsx
2. ❌ TeamManagement.tsx
3. ❌ SoftwareManagement.tsx
4. ❌ ResellerPricing.tsx
5. ❌ FinancialReports.tsx
6. ❌ BiosBlacklist.tsx
7. ❌ BiosHistory.tsx
8. ❌ BiosConflicts.tsx
9. ❌ IpAnalytics.tsx
10. ❌ UsernameManagement.tsx
11. ❌ Reports.tsx
12. ❌ Activity.tsx
13. ❌ Customers.tsx
14. ❌ Settings.tsx
15. ❌ Profile.tsx

### 1.14 Create `src/pages/manager/` - Manager Pages (8 files)

Status: **MISSING** - Create all 8:
1. ❌ Dashboard.tsx
2. ❌ Team.tsx
3. ❌ UsernameManagement.tsx
4. ❌ Customers.tsx
5. ❌ Software.tsx
6. ❌ Reports.tsx
7. ❌ Activity.tsx
8. ❌ Profile.tsx

### 1.15 Create `src/pages/reseller/` - Reseller Pages (7 files)

Status: **MISSING** - Create all 7:
1. ❌ Dashboard.tsx
2. ❌ Customers.tsx
3. ❌ Software.tsx
4. ❌ Licenses.tsx
5. ❌ Reports.tsx
6. ❌ Activity.tsx
7. ❌ Profile.tsx

### 1.16 Create `src/pages/customer/` - Customer Pages (3 files)

Status: **MISSING** - Create all 3:
1. ❌ Dashboard.tsx
2. ❌ Software.tsx
3. ❌ Download.tsx

**Frontend Summary:**
- Files to create: 100+
- Files to update: 5
- Total frontend work: ~150 files

---

## PART 2: BACKEND FILE CREATION

### 2.1 Create `app/Models/` - Database Models (11 new files + 1 update)

#### ✅ app/Models/User.php
Status: **EXISTS** - Update to add:
- relationships (tenants, roles, permissions)
- `$fillable` array
- `$casts` array
- tenant_id, role, username_locked fields

#### ❌ → ✅ app/Models/Tenant.php
Purpose: Organization/tenant model
Relationships:
- hasMany Users
- hasMany Programs
- hasMany Licenses
- hasMany ActivityLogs

Status: **MISSING** - Create

#### ❌ → ✅ app/Models/Program.php
Purpose: Software program model
Relationships:
- belongsTo Tenant
- hasMany Licenses

Fields:
- tenant_id
- name
- version
- download_url
- description

Status: **MISSING** - Create

#### ❌ → ✅ app/Models/License.php
Purpose: Software license model
Relationships:
- belongsTo User (customer)
- belongsTo Program
- belongsTo Tenant

Fields:
- user_id, program_id, tenant_id
- bios_id
- activation_date, expiration_date
- status (active, expired, suspended)
- price

Status: **MISSING** - Create

#### ❌ → ✅ app/Models/ApiLog.php
Purpose: API call logging
Fields:
- url
- method
- response_code
- response_time
- created_at

Status: **MISSING** - Create

#### ❌ → ✅ app/Models/ActivityLog.php
Purpose: User activity tracking
Fields:
- user_id, tenant_id
- action
- description
- created_at

Status: **MISSING** - Create

#### ❌ → ✅ app/Models/BiosBlacklist.php
Purpose: Blacklisted BIOS IDs
Fields:
- bios_id
- status (active, inactive)
- reason
- created_at

Status: **MISSING** - Create

#### ❌ → ✅ app/Models/BiosConflict.php
Purpose: BIOS conflict history
Fields:
- bios_id
- license_id
- conflict_reason
- created_at

Status: **MISSING** - Create

#### ❌ → ✅ app/Models/BiosAccessLog.php
Purpose: BIOS activation audit trail
Fields:
- bios_id
- user_id
- action (attempt, success, blocked)
- reason
- ip_address
- created_at

Status: **MISSING** - Create

#### ❌ → ✅ app/Models/UserIpLog.php
Purpose: User IP tracking
Fields:
- user_id, tenant_id
- ip_address
- country, city
- device_type
- last_seen

Status: **MISSING** - Create

#### ❌ → ✅ app/Models/UserBalance.php
Purpose: Reseller wallet balance
Fields:
- user_id (reseller)
- balance
- currency
- updated_at

Status: **MISSING** - Create

#### ❌ → ✅ app/Models/FinancialReport.php
Purpose: Monthly financial reports
Fields:
- tenant_id
- month, year
- total_revenue
- total_expenses
- profit_loss
- created_at

Status: **MISSING** - Create

### 2.2 Create `app/Http/Middleware/` - Custom Middleware (5 files)

#### ❌ → ✅ app/Http/Middleware/TenantScope.php
Purpose: Auto-scope queries by tenant_id
Logic:
- For non-super_admin users
- Add WHERE tenant_id = auth()->user()->tenant_id to all queries
- Super admin bypasses this

Status: **MISSING** - Create

#### ❌ → ✅ app/Http/Middleware/RoleMiddleware.php
Purpose: Route-level role checking
Logic:
- Check if auth()->user()->role is in allowed roles
- Return 403 if not authorized

Usage:
```php
Route::middleware('role:super_admin,manager_parent')->get(...)
```

Status: **MISSING** - Create

#### ❌ → ✅ app/Http/Middleware/BiosBlacklistCheck.php
Purpose: Block blacklisted BIOS IDs on activation
Logic:
- Check bios_blacklist table
- Block if found and status = 'active'
- Log to bios_access_logs

Status: **MISSING** - Create

#### ❌ → ✅ app/Http/Middleware/IpTracker.php
Purpose: Log user IP + geolocation
Logic:
- Get IP from request
- Call IP geolocation API
- Log to user_ip_logs

Status: **MISSING** - Create

#### ❌ → ✅ app/Http/Middleware/ApiLogger.php
Purpose: Log API calls to external services
Logic:
- Log HTTP requests to 72.60.69.185
- Log response code and time
- Store in api_logs table

Status: **MISSING** - Create

### 2.3 Create `app/Services/` - Business Logic (4 files)

#### ❌ → ✅ app/Services/ExternalApiService.php
Purpose: HTTP client for external licensing API
Methods:
- activateLicense($biosId, $programId)
- deactivateLicense($biosId, $programId)
- checkLicenseStatus($biosId)
- call($endpoint, $data) - Generic HTTP call

Status: **MISSING** - Create

#### ❌ → ✅ app/Services/IpGeolocationService.php
Purpose: IP geolocation lookup (ipapi.co)
Methods:
- getLocationByIp($ip) - Returns country, city, coordinates

Status: **MISSING** - Create

#### ❌ → ✅ app/Services/BiosActivationService.php
Purpose: 6-step BIOS activation pipeline
Steps:
1. Check BIOS blacklist
2. Check BIOS conflicts
3. Verify username available
4. Get IP geolocation
5. Call external API
6. Update user balance

Methods:
- activate($biosId, $programId, $duration, $price)
- Returns: ActivationResponse (success, license_key, etc.)

Status: **MISSING** - Create

#### ❌ → ✅ app/Services/BalanceService.php
Purpose: Reseller balance management
Methods:
- getBalance($resellerId)
- deductBalance($resellerId, $amount)
- addBalance($resellerId, $amount)
- getStatement($resellerId) - Monthly statement

Status: **MISSING** - Create

### 2.4 Create `app/Traits/` - Reusable Logic (1 file)

#### ❌ → ✅ app/Traits/BelongsToTenant.php
Purpose: Auto tenant_id scoping via global scope
Logic:
- Add Illuminate\Database\Eloquent\ScopedByTenant
- Auto-filter by auth()->user()->tenant_id
- Super admin bypasses

Status: **MISSING** - Create

### 2.5 Create `app/Http/Requests/` - Form Validation (10+ files)

Status: **MISSING** - Create validation request classes:

#### ❌ → ✅ app/Http/Requests/LoginRequest.php
#### ❌ → ✅ app/Http/Requests/StoreTenantRequest.php
#### ❌ → ✅ app/Http/Requests/ActivateLicenseRequest.php
#### ❌ → ✅ app/Http/Requests/StoreUserRequest.php
#### ❌ → ✅ app/Http/Requests/StoreProgramRequest.php
#### ❌ → ✅ app/Http/Requests/RenewLicenseRequest.php
#### ❌ → ✅ app/Http/Requests/CreateBiosBlacklistRequest.php
#### ❌ → ✅ app/Http/Requests/ResetPasswordRequest.php
#### ❌ → ✅ app/Http/Requests/UpdateProfileRequest.php
#### ❌ → ✅ app/Http/Requests/InviteUserRequest.php

### 2.6 Create `database/migrations/` - Database Tables (8 new files)

Need 12 total migrations (4 exist for cache/jobs/sanctum, need 8 more):

#### ❌ → ✅ database/migrations/XXXX_XX_XX_XXXXXX_create_tenants_table.php
Fields: id, name, email, phone, country, status, created_at

#### ❌ → ✅ database/migrations/XXXX_XX_XX_XXXXXX_create_programs_table.php
Fields: id, tenant_id, name, version, download_url, description

#### ❌ → ✅ database/migrations/XXXX_XX_XX_XXXXXX_create_licenses_table.php
Fields: id, user_id, program_id, tenant_id, bios_id, activation_date, expiration_date, status, price

#### ❌ → ✅ database/migrations/XXXX_XX_XX_XXXXXX_create_api_logs_table.php
Fields: id, url, method, response_code, response_time, created_at

#### ❌ → ✅ database/migrations/XXXX_XX_XX_XXXXXX_create_activity_logs_table.php
Fields: id, user_id, tenant_id, action, description, created_at

#### ❌ → ✅ database/migrations/XXXX_XX_XX_XXXXXX_create_bios_blacklists_table.php
Fields: id, bios_id, status, reason, created_at

#### ❌ → ✅ database/migrations/XXXX_XX_XX_XXXXXX_create_bios_conflicts_table.php
Fields: id, bios_id, license_id, conflict_reason, created_at

#### ❌ → ✅ database/migrations/XXXX_XX_XX_XXXXXX_create_bios_access_logs_table.php
Fields: id, bios_id, user_id, action, reason, ip_address, created_at

#### ❌ → ✅ database/migrations/XXXX_XX_XX_XXXXXX_create_user_ip_logs_table.php
Fields: id, user_id, tenant_id, ip_address, country, city, device_type, last_seen

#### ❌ → ✅ database/migrations/XXXX_XX_XX_XXXXXX_create_user_balances_table.php
Fields: id, user_id, balance, currency, updated_at

#### ❌ → ✅ database/migrations/XXXX_XX_XX_XXXXXX_create_financial_reports_table.php
Fields: id, tenant_id, month, year, total_revenue, total_expenses, profit_loss, created_at

**Also UPDATE:**
#### ✅ database/migrations/0001_01_01_000000_create_users_table.php
Add fields:
- tenant_id (nullable for super_admin)
- role: enum(super_admin, manager_parent, manager, reseller, customer)
- username_locked: boolean (default false)

### 2.7 Create `database/seeders/` - Test Data (2 files)

#### ✅ database/seeders/DatabaseSeeder.php
Status: **EXISTS** - Update to call:
- SuperAdminSeeder
- TestDataSeeder

#### ❌ → ✅ database/seeders/SuperAdminSeeder.php
Purpose: Create initial super admin user
Data:
- Email: admin@obd2sw.com
- Password: hashed (from env)
- Role: super_admin
- tenant_id: null

Status: **MISSING** - Create

#### ❌ → ✅ database/seeders/TestDataSeeder.php
Purpose: Create test data for development
Data:
- 3 Tenants
- 3 Managers per tenant
- 5 Resellers per manager
- 10 Customers per reseller
- 5 Programs
- 20 Licenses
- Sample activity logs
- Sample BIOS records

Status: **MISSING** - Create

### 2.8 Create `config/ip-geolocation.php` - IP Geolocation Config

#### ❌ → ✅ config/ip-geolocation.php
Purpose: IP geolocation API configuration
Config:
- provider: 'ipapi' (or similar)
- api_key: env('IP_GEOLOCATION_API_KEY')
- timeout: 5
- cache_days: 30

Status: **MISSING** - Create

### 2.9 Create `app/Http/Controllers/` - API Controllers (40+ files)

#### ❌ → ✅ app/Http/Controllers/AuthController.php
Endpoints:
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

#### ❌ → ✅ app/Http/Controllers/ApiProxyController.php
Purpose: Proxy calls to external API
Endpoints:
- POST /api/proxy/{endpoint}

#### ❌ → ✅ SuperAdmin Controllers (12)
1. DashboardController - GET /api/super-admin/dashboard
2. TenantController - CRUD /api/tenants
3. UserController - CRUD /api/users
4. AdminManagementController - Admin management endpoints
5. BiosBlacklistController - CRUD /api/bios/blacklist
6. BiosHistoryController - GET /api/bios/history
7. UsernameManagementController - Unlock usernames
8. FinancialReportController - GET /api/financial/reports
9. ReportController - GET /api/reports
10. LogController - GET /api/logs
11. ApiStatusController - GET /api/status
12. SettingsController - CRUD /api/settings

#### ❌ → ✅ ManagerParent Controllers (13)
Similar structure for manager_parent role endpoints

#### ❌ → ✅ Manager Controllers (7)
Similar structure for manager role endpoints

#### ❌ → ✅ Reseller Controllers (5)
Similar structure for reseller role endpoints

#### ❌ → ✅ Customer Controllers (3)
Similar structure for customer role endpoints

**Total Backend Files to Create: 85+**

---

## PART 3: SUMMARY BY PRIORITY

### PHASE 01 - Critical Foundation (Week 1)

**Frontend (20 files):**
1. ✅ src/lib/utils.ts, constants.ts, validators.ts
2. ✅ src/components/layout/DashboardLayout.tsx, Navbar.tsx, Sidebar.tsx, Footer.tsx
3. ✅ src/hooks/useAuth.ts, useTheme.ts, useRoleGuard.ts
4. ✅ src/stores/authStore.ts, themeStore.ts, sidebarStore.ts
5. ✅ src/types/user.types.ts, tenant.types.ts, license.types.ts, program.types.ts
6. ✅ src/router/guards.tsx, routes.ts
7. ✅ src/pages/auth/Login.tsx, ForgotPassword.tsx

**Backend (35 files):**
1. ✅ app/Models/ (all 12 models)
2. ✅ app/Http/Middleware/ (all 5 middleware)
3. ✅ app/Services/ (all 4 services)
4. ✅ app/Traits/BelongsToTenant.php
5. ✅ database/migrations/ (all 12 tables including users update)
6. ✅ database/seeders/SuperAdminSeeder.php, TestDataSeeder.php
7. ✅ config/ip-geolocation.php
8. ✅ AuthController.php
9. ✅ ApiProxyController.php

### PHASE 02+ - Pages & Full Endpoints (Weeks 2-3)

**Frontend:**
- All 43 page components (Login + 42 role-specific pages)
- All shared components (StatsCard, DataTable, etc.) = 9 files
- All chart components = 4 files
- All API service files = 10 files
- All remaining hooks = 4 files
- shadcn/ui base components

**Backend:**
- All 40+ controllers (all role-specific endpoints)
- All form request validation classes
- 101 API endpoint definitions in routes/api.php

---

## CHECKLIST FOR YOU

### Frontend Priority 1 (CRITICAL)
- [ ] Create src/lib/ utilities
- [ ] Create src/components/layout/ components
- [ ] Create src/hooks/ business logic
- [ ] Create src/stores/ global state
- [ ] Create src/types/ type definitions
- [ ] Create src/router/ guards and routes
- [ ] Create src/pages/auth/ pages

### Backend Priority 1 (CRITICAL)
- [ ] Create all 12 Models
- [ ] Create all 5 Middleware classes
- [ ] Create all 4 Service classes
- [ ] Create BelongsToTenant trait
- [ ] Create all 12 migrations
- [ ] Create SuperAdminSeeder + TestDataSeeder
- [ ] Create ip-geolocation.php config
- [ ] Create AuthController + ApiProxyController

### Update Existing
- [ ] Update User model (add tenant_id, role, username_locked)
- [ ] Update users migration (add new fields)
- [ ] Update src/services/api.ts (add interceptors)
- [ ] Update router/index.tsx (add all routes)

---

