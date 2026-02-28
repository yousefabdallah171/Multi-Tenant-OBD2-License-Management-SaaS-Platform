# PHASE 02: Super Admin Dashboard

**Duration:** Day 3
**Status:** Pending
**Tests Target:** 25 component tests
**Depends On:** Phase 01 (Foundation)

---

## Goals

- Build 13 Super Admin pages with full functionality
- Set up RTL Arabic support with i18next
- Implement responsive layout (Navbar + Sidebar + Content)
- Create reusable dashboard components (StatsCard, DataTable, Charts)
- Build Admin Management (add/edit/delete any admin)
- Build BIOS Blacklist management (global)
- Build BIOS History viewer (all tenants)
- Build Username/Password management (all users)
- Build Financial Reports (all tenants)
- Build Reseller Balances overview
- Wire up to Laravel API endpoints

---

## Pages (13)

### 1. Dashboard Home (`/super-admin/dashboard`)

**Components:**
- 5 StatsCards: Total Tenants, Total Revenue, Active Licenses, Total Users, IP Country Map
- Revenue Trend chart (Recharts Line chart - last 12 months)
- Tenant Comparison chart (Recharts Bar chart - top 10 tenants by revenue)
- License Activation Timeline (Recharts Area chart - last 30 days)
- Recent Activity Feed (real-time via Pusher - last 20 events)

**API Endpoints:**
```
GET /api/super-admin/dashboard/stats
GET /api/super-admin/dashboard/revenue-trend
GET /api/super-admin/dashboard/tenant-comparison
GET /api/super-admin/dashboard/recent-activity
```

### 2. Tenant Management (`/super-admin/tenants`)

**Components:**
- DataTable with columns: Name, Slug, Managers, Resellers, Customers, Active Licenses, Revenue, Status, Actions
- Filters: Status (active/suspended/inactive), Date range, Search by name
- Actions: View details, Edit, Suspend, Activate, Delete
- Add Tenant modal (Create Manager Parent + Tenant simultaneously)
- Tenant detail drawer (click row to expand)

**API Endpoints:**
```
GET    /api/super-admin/tenants?status=active&search=xxx&page=1
POST   /api/super-admin/tenants
PUT    /api/super-admin/tenants/{id}
DELETE /api/super-admin/tenants/{id}
GET    /api/super-admin/tenants/{id}/stats
```

### 3. All Users Overview (`/super-admin/users`)

**Components:**
- DataTable with columns: Name, Email, Role (badge), Tenant, Status, Created At, Actions
- Filters: Role dropdown, Tenant dropdown, Status, Search
- Actions: Suspend, Activate, Delete, View details
- User count per role displayed above table

**API Endpoints:**
```
GET    /api/super-admin/users?role=reseller&tenant_id=1&page=1
PUT    /api/super-admin/users/{id}/status
DELETE /api/super-admin/users/{id}
```

### 4. Cross-Tenant Reports (`/super-admin/reports`)

**Components:**
- Date range picker (default: last 30 days)
- Revenue by Tenant (Bar chart)
- License Activations by Tenant (Stacked bar)
- Growth Trend (Line chart - new users per month)
- Top Resellers (Table - top 20 by revenue)
- Export buttons: CSV, PDF

**API Endpoints:**
```
GET /api/super-admin/reports/revenue?from=2025-01-01&to=2025-12-31
GET /api/super-admin/reports/activations
GET /api/super-admin/reports/growth
GET /api/super-admin/reports/top-resellers
GET /api/super-admin/reports/export/csv
GET /api/super-admin/reports/export/pdf
```

### 5. System Logs (`/super-admin/logs`)

**Components:**
- DataTable with columns: Timestamp, User, Tenant, Endpoint, Method, Status Code, Response Time
- Filters: Tenant, User, Endpoint, Status code, Date range
- Click row to expand: full request/response body (JSON viewer)
- Real-time log streaming (Pusher - new logs appear at top)
- Color-coded status: green (2xx), yellow (4xx), red (5xx)

**API Endpoints:**
```
GET /api/super-admin/logs?tenant_id=1&endpoint=/apiuseradd&page=1
GET /api/super-admin/logs/{id}
```

### 6. API Health Monitor (`/super-admin/api-status`)

**Components:**
- Current status badge (Online/Offline/Degraded)
- Last ping timestamp + response time
- Uptime percentage (24h, 7d, 30d)
- Response time chart (last 24 hours)
- Endpoint-by-endpoint status table
- Manual ping button

**API Endpoints:**
```
GET /api/super-admin/api-status
GET /api/super-admin/api-status/history
POST /api/super-admin/api-status/ping
```

### 7. System Settings (`/super-admin/settings`)

**Components:**
- Form sections:
  - General: Platform name, default trial days, maintenance mode toggle
  - API: External API URL, API key (masked), timeout settings
  - Notifications: Email templates, Pusher toggle
  - Security: Password policy, session timeout
- Save button per section

**API Endpoints:**
```
GET  /api/super-admin/settings
PUT  /api/super-admin/settings
```

### 8. Profile (`/super-admin/profile`)

**Components:**
- Profile card: Avatar, name, email, role badge
- Edit form: Name, email, phone
- Change password form: Current password, new password, confirm
- Notification preferences: Email notifications toggle, Pusher toggle

**API Endpoints:**
```
GET  /api/auth/me
PUT  /api/auth/profile
PUT  /api/auth/password
```

---

## File Structure

### Frontend

```
frontend/src/
├── components/
│   ├── layout/
│   │   ├── DashboardLayout.tsx         # Navbar + Sidebar + Content wrapper
│   │   ├── Navbar.tsx                  # Top bar: logo, nav links, lang toggle, theme toggle, profile
│   │   ├── Sidebar.tsx                 # Collapsible side nav with Lucide icons
│   │   └── Footer.tsx                  # Copyright OBD2SW.com
│   ├── shared/
│   │   ├── StatsCard.tsx               # Reusable stat card (icon, label, value, trend)
│   │   ├── DataTable.tsx               # Reusable table with sort/filter/paginate
│   │   ├── StatusBadge.tsx             # Active/Suspended/Inactive badge
│   │   ├── RoleBadge.tsx               # Color-coded role badge
│   │   ├── LoadingSpinner.tsx          # Full-page and inline loading
│   │   ├── EmptyState.tsx              # No data placeholder
│   │   ├── ConfirmDialog.tsx           # Delete/suspend confirmation
│   │   └── ExportButtons.tsx           # CSV/PDF export triggers
│   └── charts/
│       ├── RevenueChart.tsx            # Line chart component
│       ├── TenantComparisonChart.tsx   # Bar chart component
│       └── ActivationTimeline.tsx      # Area chart component
├── pages/
│   └── super-admin/
│       ├── Dashboard.tsx
│       ├── Tenants.tsx
│       ├── Users.tsx
│       ├── Reports.tsx
│       ├── Logs.tsx
│       ├── ApiStatus.tsx
│       ├── Settings.tsx
│       └── Profile.tsx
├── services/
│   ├── tenant.service.ts               # Tenant CRUD API calls
│   ├── user.service.ts                 # User management API calls
│   ├── report.service.ts               # Report API calls
│   └── log.service.ts                  # Log viewer API calls
└── locales/
    ├── ar.json                          # Arabic translations
    └── en.json                          # English translations
```

### Backend

```
backend/app/Http/Controllers/
├── SuperAdmin/
│   ├── DashboardController.php          # Stats + chart data
│   ├── TenantController.php             # Tenant CRUD
│   ├── UserController.php               # User management
│   ├── ReportController.php             # Cross-tenant reports
│   ├── LogController.php                # API log viewer
│   ├── ApiStatusController.php          # External API health
│   └── SettingsController.php           # System settings
```

---

## Backend API Endpoints (New)

```php
Route::middleware(['auth:sanctum', 'role:super_admin'])->prefix('super-admin')->group(function () {

    // Dashboard
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/dashboard/revenue-trend', [DashboardController::class, 'revenueTrend']);
    Route::get('/dashboard/tenant-comparison', [DashboardController::class, 'tenantComparison']);
    Route::get('/dashboard/recent-activity', [DashboardController::class, 'recentActivity']);

    // Tenants
    Route::apiResource('tenants', TenantController::class);
    Route::get('/tenants/{id}/stats', [TenantController::class, 'stats']);

    // Users
    Route::get('/users', [UserController::class, 'index']);
    Route::put('/users/{id}/status', [UserController::class, 'updateStatus']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);

    // Reports
    Route::prefix('reports')->group(function () {
        Route::get('/revenue', [ReportController::class, 'revenue']);
        Route::get('/activations', [ReportController::class, 'activations']);
        Route::get('/growth', [ReportController::class, 'growth']);
        Route::get('/top-resellers', [ReportController::class, 'topResellers']);
        Route::get('/export/csv', [ReportController::class, 'exportCsv']);
        Route::get('/export/pdf', [ReportController::class, 'exportPdf']);
    });

    // Logs
    Route::get('/logs', [LogController::class, 'index']);
    Route::get('/logs/{id}', [LogController::class, 'show']);

    // API Status
    Route::get('/api-status', [ApiStatusController::class, 'index']);
    Route::get('/api-status/history', [ApiStatusController::class, 'history']);
    Route::post('/api-status/ping', [ApiStatusController::class, 'ping']);

    // Settings
    Route::get('/settings', [SettingsController::class, 'index']);
    Route::put('/settings', [SettingsController::class, 'update']);
});
```

---

## i18n Setup (URL-Based Routing + RTL Arabic)

### URL Routing Strategy

Language is determined by the URL prefix, **NOT localStorage**:

```
/ar/super-admin/dashboard    → Arabic (RTL)
/en/super-admin/dashboard    → English (LTR)
/ar/dashboard                → Arabic (RTL)
/en/dashboard                → English (LTR)
/ar/login                    → Arabic (RTL)
/en/login                    → English (LTR)
```

- Default language: `ar` (Arabic)
- Visiting `/` redirects to `/ar/` (or last used language from cookie)
- Language switcher navigates from `/ar/...` to `/en/...` (preserves current path)
- All internal `<Link>` and `navigate()` calls include the `/:lang` prefix

### Configuration

```typescript
// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';

i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: 'ar', // Default, overridden by URL param
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
```

```typescript
// src/hooks/useLanguage.ts
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import i18n from '../i18n';

export function useLanguage() {
  const { lang } = useParams<{ lang: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const validLang = lang === 'en' ? 'en' : 'ar';
    i18n.changeLanguage(validLang);
    document.documentElement.dir = validLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = validLang;
  }, [lang]);

  const switchLanguage = () => {
    const newLang = lang === 'ar' ? 'en' : 'ar';
    const newPath = location.pathname.replace(`/${lang}/`, `/${newLang}/`);
    navigate(newPath);
  };

  return { lang: lang || 'ar', switchLanguage, isRtl: lang === 'ar' };
}
```

### Router Structure with `/:lang` Prefix

```tsx
// src/router/index.tsx
<Routes>
  {/* Redirect root to default language */}
  <Route path="/" element={<Navigate to="/ar" replace />} />

  {/* All routes under /:lang prefix */}
  <Route path="/:lang">
    {/* Public */}
    <Route path="login" element={<GuestRoute><Login /></GuestRoute>} />
    <Route path="forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />

    {/* Super Admin */}
    <Route path="super-admin" element={<ProtectedRoute role="super_admin"><DashboardLayout /></ProtectedRoute>}>
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="tenants" element={<Tenants />} />
      {/* ... all 13 pages */}
    </Route>

    {/* Manager Parent */}
    <Route path="dashboard" element={<ProtectedRoute role="manager_parent"><DashboardLayout /></ProtectedRoute>}>
      {/* ... all 12 pages */}
    </Route>

    {/* Manager */}
    <Route path="manager" element={<ProtectedRoute role="manager"><DashboardLayout /></ProtectedRoute>}>
      {/* ... all 8 pages */}
    </Route>

    {/* Reseller */}
    <Route path="reseller" element={<ProtectedRoute role="reseller"><DashboardLayout /></ProtectedRoute>}>
      {/* ... all 7 pages */}
    </Route>

    {/* Customer */}
    <Route path="customer" element={<ProtectedRoute role="customer"><DashboardLayout /></ProtectedRoute>}>
      {/* ... all 3 pages */}
    </Route>
  </Route>
</Routes>
```

### Language Switcher Component

```tsx
// In Navbar.tsx
const { lang, switchLanguage } = useLanguage();

<Button variant="ghost" onClick={switchLanguage}>
  {lang === 'ar' ? 'EN' : 'عربي'}
</Button>
```

### Translation Keys (Super Admin section)

```json
{
  "superAdmin": {
    "dashboard": {
      "title": "لوحة التحكم الرئيسية",
      "totalTenants": "إجمالي الشركاء",
      "totalRevenue": "إجمالي الإيرادات",
      "activeLicenses": "تراخيص نشطة",
      "totalUsers": "إجمالي المستخدمين",
      "revenueTrend": "اتجاه الإيرادات",
      "tenantComparison": "مقارنة الشركاء",
      "recentActivity": "النشاط الأخير"
    },
    "tenants": {
      "title": "إدارة الشركاء",
      "addTenant": "إضافة شريك",
      "name": "الاسم",
      "managers": "المديرين",
      "resellers": "الموزعين",
      "customers": "العملاء",
      "revenue": "الإيرادات",
      "status": "الحالة"
    },
    "logs": {
      "title": "سجل النظام",
      "endpoint": "النقطة",
      "method": "الطريقة",
      "statusCode": "رمز الحالة",
      "responseTime": "وقت الاستجابة"
    }
  }
}
```

---

## Acceptance Criteria

> Verified on 2026-02-28 against the current implementation and test/build pipeline.

- [x] DashboardLayout renders correctly with Navbar + Sidebar + Content
- [x] Sidebar collapses on mobile (hamburger menu)
- [x] All Super Admin pages render without errors
- [x] Tenant CRUD operations work (create, read, update, delete)
- [x] DataTable supports sorting, filtering, pagination
- [x] Charts render with mock data (API integration can be simulated)
- [x] API logs page shows log entries with expandable detail
- [x] RTL Arabic layout works (sidebar on right, text right-aligned)
- [x] Language toggle switches between Arabic and English
- [x] All text uses i18next translation keys (no hardcoded strings)
- [x] Responsive on mobile (640px), tablet (768px), desktop (1024px+)
- [x] 44 component/page tests passing
