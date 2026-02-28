# PHASE 05: Customer Portal

**Duration:** Day 7
**Status:** Pending
**Tests Target:** 15 component tests
**Depends On:** Phase 01 (Auth), Phase 04 (Licenses exist)

---

## Goals

- Build 3 Customer-facing pages
- Display license status with expiry countdown
- Provide software download links (set by Manager Parent)
- Fully responsive design (mobile-first for customers)
- Complete dark/light mode implementation

---

## Pages (3)

### 1. License Dashboard (`/customer/dashboard`)

**Components:**

**License Status Cards (one per active license):**
```
┌──────────────────────────────────────────┐
│  HaynesPro v2.1                          │
│                                          │
│  BIOS ID:    ABC-123-XYZ-456             │
│  Status:     ● Active                    │
│  Activated:  2025-01-15                  │
│  Expires:    2025-06-15                  │
│                                          │
│  ┌──────────────────────────────┐        │
│  │  ██████████████░░░░░  68%   │        │
│  │  45 days remaining          │        │
│  └──────────────────────────────┘        │
│                                          │
│  [Download Software]  [Request Renewal]  │
└──────────────────────────────────────────┘
```

- Progress bar showing % of license duration remaining
- Color changes: green (>30%), yellow (10-30%), red (<10%)
- Countdown: "X days remaining"
- If expired: red card with "License Expired" badge + "Contact Reseller" button
- If no licenses: Empty state with "No active licenses" message

**Summary Stats:**
- Total licenses
- Active licenses
- Expired licenses

**API Endpoints:**
```
GET /api/customer/dashboard       # All license data for this customer
```

### 2. Available Software (`/customer/software`)

**Components:**
- Card grid of programs the customer has licenses for
- Each card:
  - Program icon
  - Program name + version
  - Description
  - License status badge
  - "Download" button (only if license is active)
  - Disabled download with tooltip if license expired
- Programs without active license are not shown

**API Endpoints:**
```
GET /api/customer/software        # Programs with active licenses
```

### 3. Download Center (`/customer/download`)

**Components:**
- List of downloadable files per licensed program
- Each entry:
  - Program name + version
  - File size (if available)
  - Download button (direct link set by Manager Parent)
  - Last downloaded timestamp
  - System requirements info
- Download tracking (log when customer downloads)
- Installation guide link (if provided by Manager Parent)

**API Endpoints:**
```
GET  /api/customer/downloads             # Available downloads
POST /api/customer/downloads/{id}/log    # Log download event
```

---

## File Structure

### Frontend

```
frontend/src/pages/customer/
├── Dashboard.tsx              # License status cards + countdown
├── Software.tsx               # Licensed programs list
└── Download.tsx               # Direct download center

frontend/src/components/customer/
├── LicenseCard.tsx            # Single license status card
├── LicenseProgress.tsx        # Progress bar + countdown
├── ProgramCard.tsx            # Software card with download
└── DownloadButton.tsx         # Download with auth check
```

### Backend

```
backend/app/Http/Controllers/Customer/
├── DashboardController.php    # License data
├── SoftwareController.php     # Available programs
└── DownloadController.php     # Download links + logging
```

---

## Backend Routes

```php
Route::middleware(['auth:sanctum', 'role:customer'])->prefix('customer')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/software', [SoftwareController::class, 'index']);
    Route::get('/downloads', [DownloadController::class, 'index']);
    Route::post('/downloads/{id}/log', [DownloadController::class, 'logDownload']);
});
```

---

## Customer Layout

The customer portal uses a **simplified layout** compared to admin dashboards:

```
┌─────────────────────────────────────────────────────┐
│  Navbar: OBD2SW Logo  │  Dashboard │ Software │ 👤  │
├─────────────────────────────────────────────────────┤
│                                                      │
│              Main Content (no sidebar)                │
│                                                      │
│   ┌───────────┐ ┌───────────┐ ┌───────────┐        │
│   │ License 1 │ │ License 2 │ │ License 3 │        │
│   │ Active    │ │ Active    │ │ Expired   │        │
│   │ 45 days   │ │ 12 days   │ │ Expired   │        │
│   └───────────┘ └───────────┘ └───────────┘        │
│                                                      │
├─────────────────────────────────────────────────────┤
│  Footer: Copyright OBD2SW.com                        │
└─────────────────────────────────────────────────────┘
```

- **No sidebar** (only 3 pages, use top nav)
- Simpler navbar with fewer links
- Mobile: full-width cards, stacked layout
- Clean, customer-friendly design

---

## Responsive Design (Mobile-First)

### Mobile (< 640px)
- Single column layout
- License cards stack vertically (full width)
- Large touch targets for download buttons
- Bottom navigation bar (optional)

### Tablet (640-1024px)
- 2-column card grid
- Navbar remains horizontal

### Desktop (> 1024px)
- 3-column card grid
- Full-width progress bars

---

## i18n Keys (Customer)

```json
{
  "customer": {
    "dashboard": {
      "title": "تراخيصي",
      "totalLicenses": "إجمالي التراخيص",
      "activeLicenses": "تراخيص نشطة",
      "expiredLicenses": "تراخيص منتهية",
      "daysRemaining": "يوم متبقي",
      "licenseExpired": "انتهت صلاحية الترخيص",
      "noLicenses": "لا توجد تراخيص نشطة",
      "contactReseller": "تواصل مع الموزع",
      "requestRenewal": "طلب تجديد"
    },
    "software": {
      "title": "البرامج المتاحة",
      "download": "تحميل",
      "licenseRequired": "يتطلب ترخيص نشط",
      "version": "الإصدار"
    },
    "download": {
      "title": "مركز التحميل",
      "downloadNow": "حمل الآن",
      "lastDownloaded": "آخر تحميل",
      "systemRequirements": "متطلبات النظام"
    }
  }
}
```

---

## Acceptance Criteria

- [ ] Customer dashboard shows all licenses with status cards
- [ ] Progress bar shows correct % remaining with color coding
- [ ] Countdown displays correct days remaining
- [ ] Expired licenses show red "Expired" badge
- [ ] Software page shows only programs with active licenses
- [ ] Download button works (opens download link from Manager Parent)
- [ ] Download is logged for analytics
- [ ] Disabled download for expired licenses with tooltip
- [ ] Customer cannot access admin routes (403 redirect)
- [ ] Responsive: mobile (1 col), tablet (2 col), desktop (3 col)
- [ ] Dark mode works on all customer pages
- [ ] RTL Arabic layout correct
- [ ] 15 component tests passing
