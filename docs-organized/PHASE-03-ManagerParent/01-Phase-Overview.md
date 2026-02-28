# PHASE 03: Manager Parent Core

**Duration:** Day 4-5
**Status:** Pending
**Tests Target:** 30 integration tests
**Depends On:** Phase 01 (Foundation), Phase 02 (Layout + shared components)

---

## Goals

- Build 12 Manager Parent pages with full CRUD operations
- Implement Software Management (Programs + Download Links)
- Build Team Management (Add Managers + Resellers)
- Create Reseller Pricing management
- Build BIOS Blacklist management (tenant-level)
- Build BIOS History viewer (tenant only)
- Build BIOS Conflicts page
- Build IP Analytics (tenant-level)
- Build Username/Password management (tenant users)
- Build Financial Reports (tenant-level)
- Build Reseller Balances (tenant resellers)
- All data scoped by `tenant_id` automatically
- UI inspired by MANDIAG design system

---

## Pages (12)

### 1. Dashboard Home (`/dashboard`)

**Components:**
- 4 StatsCards: Team Members, Total Customers, Active Licenses, Monthly Revenue
- Monthly Revenue chart (Line)
- License Expiry Forecast chart (Bar - licenses expiring in next 30/60/90 days)
- Team Performance comparison (Bar - activations per team member)
- Quick Actions panel: Add Program, Add Team Member, View Reports

**API Endpoints:**
```
GET /api/dashboard/stats                  # Tenant-scoped stats
GET /api/dashboard/revenue-chart          # Monthly revenue data
GET /api/dashboard/expiry-forecast        # License expiry forecast
GET /api/dashboard/team-performance       # Per-member activations
```

### 2. Team Management (`/team-management`)

**Components:**
- Two-tab layout: Managers | Resellers
- DataTable per tab with: Name, Email, Phone, Status, Customers Count, Revenue, Actions
- "Invite Manager" / "Invite Reseller" button opens modal:
  - Name, Email, Password, Phone (optional)
- Edit member modal
- Suspend / Activate / Delete actions
- Performance metrics per member (mini stats)

**API Endpoints:**
```
GET    /api/team?role=manager&page=1
POST   /api/team
PUT    /api/team/{id}
DELETE /api/team/{id}
PUT    /api/team/{id}/status
GET    /api/team/{id}/stats
```

### 3. Reseller Pricing (`/reseller-pricing`)

**Components:**
- Pricing table: Program | Base Price | Reseller Price | Margin | Actions
- Edit pricing per program per reseller
- Bulk pricing modal: set price for all programs at once
- Commission rate settings
- Pricing history log table

**API Endpoints:**
```
GET    /api/pricing
PUT    /api/pricing/{program_id}
POST   /api/pricing/bulk
GET    /api/pricing/history
```

### 4. Software Management (`/software-management`)

**Components:**
- Card grid view of programs (icon, name, version, price, status)
- Toggle between card view and table view
- "Add Program" button opens form:
  - Program Name (required)
  - Description (textarea)
  - Version (e.g., "1.0")
  - Download Link URL (required - the EXE download URL)
  - Trial Days (number, default 0)
  - Base Price (decimal)
  - Icon upload
  - Status toggle (Active/Inactive)
- Edit program modal
- Delete with confirmation
- Program detail page: stats (licenses sold, active, expired)

**API Endpoints:**
```
GET    /api/programs
POST   /api/programs
PUT    /api/programs/{id}
DELETE /api/programs/{id}
GET    /api/programs/{id}/stats
```

### 5. Tenant Reports (`/reports`)

**Components:**
- Date range picker
- Revenue Breakdown by Reseller (Pie chart)
- Revenue Breakdown by Program (Bar chart)
- Activation Success/Failure rate (Donut chart)
- Customer Retention (Line chart - monthly)
- Summary stats cards
- Export CSV / PDF buttons

**API Endpoints:**
```
GET /api/reports/revenue-by-reseller
GET /api/reports/revenue-by-program
GET /api/reports/activation-rate
GET /api/reports/retention
GET /api/reports/export/csv
GET /api/reports/export/pdf
```

### 6. Activity Log (`/activity`)

**Components:**
- Timeline-style activity feed
- Filters: User, Action type, Date range
- Each entry: timestamp, user avatar, action description, metadata
- Export audit trail

**API Endpoints:**
```
GET /api/activity?user_id=1&action=license_activated&page=1
GET /api/activity/export
```

### 7. Customer Overview (`/customers`)

**Components:**
- Read-only aggregated view (Manager Parent cannot activate directly)
- DataTable: Name, Email, BIOS ID, Reseller, Program, License Status, Expiry
- Filters: Reseller dropdown, Program dropdown, Status, Search by BIOS ID
- Click row to view customer detail (license history)

**API Endpoints:**
```
GET /api/customers?reseller_id=1&program_id=1&status=active&page=1
GET /api/customers/{id}
```

### 8. Tenant Settings (`/settings`)

**Components:**
- Business Info: Company name, contact email, phone, address
- Default Pricing: Base prices, default trial days
- Notification Preferences: Email alerts for new activations, expiry warnings
- Branding: Logo upload (optional)

**API Endpoints:**
```
GET  /api/settings
PUT  /api/settings
```

### 9. Profile (`/profile`)

Same as Super Admin profile but tenant-scoped.

---

## File Structure

### Frontend

```
frontend/src/pages/manager-parent/
├── Dashboard.tsx
├── TeamManagement.tsx
├── ResellerPricing.tsx
├── SoftwareManagement.tsx
├── Reports.tsx
├── Activity.tsx
├── Customers.tsx
├── Settings.tsx
└── Profile.tsx

frontend/src/services/
├── team.service.ts
├── pricing.service.ts
├── program.service.ts        # Shared with reseller (read-only for them)
├── customer.service.ts       # Shared across roles
└── activity.service.ts
```

### Backend

```
backend/app/Http/Controllers/ManagerParent/
├── DashboardController.php
├── TeamController.php
├── PricingController.php
├── ProgramController.php
├── ReportController.php
├── ActivityController.php
├── CustomerController.php
└── SettingsController.php
```

---

## Backend Routes

```php
Route::middleware(['auth:sanctum', 'role:manager_parent', 'tenant.scope'])->group(function () {

    // Dashboard
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/dashboard/revenue-chart', [DashboardController::class, 'revenueChart']);
    Route::get('/dashboard/expiry-forecast', [DashboardController::class, 'expiryForecast']);
    Route::get('/dashboard/team-performance', [DashboardController::class, 'teamPerformance']);

    // Team Management
    Route::apiResource('team', TeamController::class);
    Route::put('/team/{id}/status', [TeamController::class, 'updateStatus']);
    Route::get('/team/{id}/stats', [TeamController::class, 'stats']);

    // Programs
    Route::apiResource('programs', ProgramController::class);
    Route::get('/programs/{id}/stats', [ProgramController::class, 'stats']);

    // Pricing
    Route::get('/pricing', [PricingController::class, 'index']);
    Route::put('/pricing/{program_id}', [PricingController::class, 'update']);
    Route::post('/pricing/bulk', [PricingController::class, 'bulkUpdate']);
    Route::get('/pricing/history', [PricingController::class, 'history']);

    // Reports
    Route::prefix('reports')->group(function () {
        Route::get('/revenue-by-reseller', [ReportController::class, 'revenueByReseller']);
        Route::get('/revenue-by-program', [ReportController::class, 'revenueByProgram']);
        Route::get('/activation-rate', [ReportController::class, 'activationRate']);
        Route::get('/retention', [ReportController::class, 'retention']);
        Route::get('/export/csv', [ReportController::class, 'exportCsv']);
        Route::get('/export/pdf', [ReportController::class, 'exportPdf']);
    });

    // Activity
    Route::get('/activity', [ActivityController::class, 'index']);
    Route::get('/activity/export', [ActivityController::class, 'export']);

    // Customers (read-only)
    Route::get('/customers', [CustomerController::class, 'index']);
    Route::get('/customers/{id}', [CustomerController::class, 'show']);

    // Settings
    Route::get('/settings', [SettingsController::class, 'index']);
    Route::put('/settings', [SettingsController::class, 'update']);
});
```

---

## i18n Keys (Manager Parent)

```json
{
  "managerParent": {
    "dashboard": {
      "teamMembers": "أعضاء الفريق",
      "totalCustomers": "إجمالي العملاء",
      "activeLicenses": "تراخيص نشطة",
      "monthlyRevenue": "إيرادات الشهر",
      "quickActions": "إجراءات سريعة"
    },
    "team": {
      "title": "إدارة الفريق",
      "addManager": "إضافة مدير",
      "addReseller": "إضافة موزع",
      "managers": "المديرين",
      "resellers": "الموزعين"
    },
    "software": {
      "title": "إدارة البرامج",
      "addProgram": "إضافة برنامج",
      "programName": "اسم البرنامج",
      "downloadLink": "رابط التحميل",
      "trialDays": "أيام التجربة",
      "basePrice": "السعر الأساسي"
    },
    "pricing": {
      "title": "تسعير الموزعين",
      "basePrice": "السعر الأساسي",
      "resellerPrice": "سعر الموزع",
      "margin": "هامش الربح"
    }
  }
}
```

---

## Acceptance Criteria

- [ ] All 9 Manager Parent pages render correctly
- [ ] Software Management: Add, Edit, Delete programs with download links
- [ ] Team Management: Add Managers and Resellers with role assignment
- [ ] Reseller Pricing: Set per-program pricing for resellers
- [ ] All data is tenant-scoped (Manager Parent only sees their own data)
- [ ] Dashboard charts display real data from API
- [ ] Customer overview shows aggregated view (no edit capability)
- [ ] Activity log shows all tenant actions
- [ ] Settings save and persist correctly
- [ ] All forms have validation (required fields, email format, price > 0)
- [ ] 30 integration tests passing
