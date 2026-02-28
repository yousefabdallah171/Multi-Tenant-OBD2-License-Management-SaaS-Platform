# PHASE 04: Manager/Reseller Dashboard

**Duration:** Day 6
**Status:** Pending
**Tests Target:** 20 E2E tests
**Depends On:** Phase 01 (Foundation), Phase 02 (Layout), Phase 03 (Programs exist)

---

## Goals

- Build 8 Manager pages (TEAM LEADER - separate dashboard)
- Build 7 Reseller pages (ACTIVATOR - separate dashboard)
- Manager: manage resellers, username/password edit for team, customer overview
- Reseller: Customer activation via BIOS ID (core feature)
- Implement BIOS activation with 4-step check: blacklist → conflict → IP log → API call
- Build license management with status tracking
- Create personal reports for individual performance
- Integrate with external API (`72.60.69.185`) for activation/deactivation
- **Reseller restrictions:** NO username/password editing, NO deleting managers

---

## Manager Pages (8) + Reseller Pages (7) = 15 Total

### 1. Dashboard (`/dashboard`)

**Components:**
- 4 StatsCards: Total Customers, Active Licenses, Revenue Earned, Activations This Month
- Monthly Activations trend (Line chart)
- Revenue trend (Line chart)
- Recent customer activity (last 10 events)

**API Endpoints:**
```
GET /api/reseller/dashboard/stats
GET /api/reseller/dashboard/activations-chart
GET /api/reseller/dashboard/revenue-chart
GET /api/reseller/dashboard/recent-activity
```

### 2. Customer Management (`/customers`) - CORE PAGE

This is the **most important page** - where resellers activate customers via BIOS ID.

**Components:**

**Customer Table:**
- Columns: Name, Email, BIOS ID, Program, License Status, Price, Expiry Date, Actions
- Status badges: Active (green), Expired (red), Suspended (amber), Pending (blue)
- Actions: View, Renew, Deactivate

**Add Customer Modal (Activation Flow):**
```
Step 1: Enter Customer Info
  - Customer Name (required)
  - Customer Email (required)
  - Phone (optional)

Step 2: BIOS Activation
  - BIOS ID (required - customer provides this)
  - Select Program (dropdown of available programs)

Step 3: Pricing & Duration
  - Duration: Number input + Unit selector (days/months/years)
  - Price: Number input (reseller sets freely)

Step 4: Confirm & Activate
  - Summary review
  - "Activate" button
  - Calls: POST /api/licenses/activate
    → Backend calls: POST 72.60.69.185/apiuseradd/{KEY}/{BIOS_ID}
    → On success: Creates License record + Customer user account
    → Pusher notification sent
```

**Renew License Modal:**
```
  - Current license info displayed
  - New duration input
  - New price input
  - "Renew" button
  - Calls: POST /api/licenses/{id}/renew
    → Backend calls: POST 72.60.69.185/apirenew/{KEY}/{BIOS_ID}
```

**Deactivate Flow:**
```
  - ConfirmDialog: "Are you sure you want to deactivate this license?"
  - Calls: POST /api/licenses/{id}/deactivate
    → Backend calls: POST 72.60.69.185/apideluser/{KEY}/{BIOS_ID}
    → License status -> suspended
```

**API Endpoints:**
```
GET    /api/reseller/customers?status=active&search=bios_id&page=1
POST   /api/reseller/customers                    # Create customer account
POST   /api/licenses/activate                      # Activate via BIOS API
POST   /api/licenses/{id}/renew                    # Renew via BIOS API
POST   /api/licenses/{id}/deactivate               # Deactivate via BIOS API
GET    /api/reseller/customers/{id}                # Customer detail
```

### 3. Available Programs (`/software`)

**Components:**
- Card grid (read-only - managed by Manager Parent)
- Each card: Program name, description, version, base price, trial days, status
- No edit/delete capability
- Search by name

**API Endpoints:**
```
GET /api/programs    # Tenant-scoped, read-only for reseller
```

### 4. License Management (`/licenses`)

**Components:**
- DataTable with all licenses created by this reseller
- Columns: Customer, BIOS ID, Program, Duration, Price, Activated, Expires, Status
- Status filter tabs: All | Active | Expired | Suspended | Pending
- Bulk actions: Renew selected, Deactivate selected
- Expiry alerts section: licenses expiring in 7 days, 3 days, 1 day (highlighted rows)
- Click row for license detail

**API Endpoints:**
```
GET /api/reseller/licenses?status=active&page=1
GET /api/reseller/licenses/{id}
POST /api/reseller/licenses/bulk-renew
POST /api/reseller/licenses/bulk-deactivate
GET /api/reseller/licenses/expiring?days=7
```

### 5. Personal Reports (`/reports`)

**Components:**
- Date range picker
- Revenue chart (daily/weekly/monthly toggle)
- Activation count chart
- Top programs by sales (horizontal bar)
- Customer retention rate
- Summary: Total Revenue, Total Activations, Avg Price, Success Rate
- Export CSV / PDF

**API Endpoints:**
```
GET /api/reseller/reports/revenue?period=monthly
GET /api/reseller/reports/activations
GET /api/reseller/reports/top-programs
GET /api/reseller/reports/export/csv
GET /api/reseller/reports/export/pdf
```

### 6. Activity Log (`/activity`)

**Components:**
- Personal action history
- Each entry: timestamp, action type, description, status
- Filter by action type: Activation, Deactivation, Renewal, Login
- Pagination

**API Endpoints:**
```
GET /api/reseller/activity?action=activation&page=1
```

### 7. Profile (`/profile`)

Same shared profile component.

---

## File Structure

### Frontend

```
frontend/src/pages/manager-reseller/
├── Dashboard.tsx
├── Customers.tsx               # Core: BIOS activation
├── Software.tsx                # Read-only program list
├── Licenses.tsx                # License management
├── Reports.tsx                 # Personal reports
├── Activity.tsx                # Personal activity log
└── Profile.tsx

frontend/src/services/
├── license.service.ts          # activate, renew, deactivate, getAll
└── reseller.service.ts         # dashboard stats, reports, activity
```

### Backend

```
backend/app/Http/Controllers/Reseller/
├── DashboardController.php
├── CustomerController.php       # Create customer + BIOS activation
├── LicenseController.php        # Activate, renew, deactivate (calls external API)
├── ReportController.php
└── ActivityController.php

backend/app/Services/
├── LicenseService.php           # Business logic: create license, call external API
└── ExternalApiService.php       # (from Phase 01) HTTP calls to 72.60.69.185
```

---

## Backend Routes

```php
Route::middleware(['auth:sanctum', 'role:manager,reseller', 'tenant.scope'])->group(function () {

    // Dashboard
    Route::prefix('reseller')->group(function () {
        Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
        Route::get('/dashboard/activations-chart', [DashboardController::class, 'activationsChart']);
        Route::get('/dashboard/revenue-chart', [DashboardController::class, 'revenueChart']);
        Route::get('/dashboard/recent-activity', [DashboardController::class, 'recentActivity']);

        // Customers
        Route::get('/customers', [CustomerController::class, 'index']);
        Route::post('/customers', [CustomerController::class, 'store']);
        Route::get('/customers/{id}', [CustomerController::class, 'show']);

        // Licenses
        Route::get('/licenses', [LicenseController::class, 'index']);
        Route::get('/licenses/{id}', [LicenseController::class, 'show']);
        Route::get('/licenses/expiring', [LicenseController::class, 'expiring']);
        Route::post('/licenses/bulk-renew', [LicenseController::class, 'bulkRenew']);
        Route::post('/licenses/bulk-deactivate', [LicenseController::class, 'bulkDeactivate']);

        // Reports
        Route::get('/reports/revenue', [ReportController::class, 'revenue']);
        Route::get('/reports/activations', [ReportController::class, 'activations']);
        Route::get('/reports/top-programs', [ReportController::class, 'topPrograms']);
        Route::get('/reports/export/csv', [ReportController::class, 'exportCsv']);
        Route::get('/reports/export/pdf', [ReportController::class, 'exportPdf']);

        // Activity
        Route::get('/activity', [ActivityController::class, 'index']);
    });

    // License actions (shared routes)
    Route::post('/licenses/activate', [LicenseController::class, 'activate']);
    Route::post('/licenses/{id}/renew', [LicenseController::class, 'renew']);
    Route::post('/licenses/{id}/deactivate', [LicenseController::class, 'deactivate']);
});
```

---

## License Activation Logic (LicenseService)

```php
class LicenseService
{
    public function activate(array $data): License
    {
        // 1. Validate BIOS ID format
        // 2. Check if BIOS ID already has active license for this program
        // 3. Call ExternalApiService->activateUser($data['bios_id'])
        // 4. If external API success:
        //    a. Create or find Customer user account
        //    b. Create License record (status: active)
        //    c. Log to activity_logs
        //    d. Dispatch LicenseActivated event (Pusher)
        //    e. Return license
        // 5. If external API fails:
        //    a. Log error to api_logs
        //    b. Throw exception with API error message
    }

    public function renew(License $license, array $data): License
    {
        // 1. Call ExternalApiService->renewUser($license->bios_id)
        // 2. Update license: new duration, new expiry, new price
        // 3. Log activity
        // 4. Dispatch event
    }

    public function deactivate(License $license): License
    {
        // 1. Call ExternalApiService->deleteUser($license->bios_id)
        // 2. Update license status to 'suspended'
        // 3. Log activity
        // 4. Dispatch event
    }
}
```

---

## Acceptance Criteria

- [ ] All 7 Manager/Reseller pages render correctly
- [ ] **Customer activation via BIOS ID works end-to-end:**
  - Reseller fills form → Backend calls 72.60.69.185 → License created → Customer notified
- [ ] License renewal calls external API and updates expiry
- [ ] License deactivation calls external API and suspends license
- [ ] All external API calls are logged in api_logs
- [ ] Licenses page shows expiry warnings (7/3/1 day)
- [ ] Bulk renew/deactivate works for selected licenses
- [ ] Personal reports show only this reseller's data
- [ ] Programs page is read-only (no edit/delete)
- [ ] Error handling: API failures show user-friendly messages
- [ ] 20 E2E tests passing (Cypress)
