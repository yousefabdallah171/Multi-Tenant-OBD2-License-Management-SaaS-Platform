# PHASE 05: Customer Portal - TODO List

**Duration:** Day 7
**Deadline:** End of Day 7

---

## Backend

### Controllers

- [x] Create `Customer/DashboardController.php`
  - `index()`: Return all licenses for authenticated customer with program data
  - Include: program name, version, bios_id, activated_at, expires_at, status
  - Calculate: days_remaining, percentage_remaining
- [x] Create `Customer/SoftwareController.php`
  - `index()`: Return programs where customer has active license
  - Include: name, description, version, download_link, icon
- [x] Create `Customer/DownloadController.php`
  - `index()`: Return downloadable programs with links
  - `logDownload($id)`: Record download event in activity_logs

### Routes

- [x] Add customer routes to `routes/api.php`:
  ```php
  Route::middleware(['auth:sanctum', 'role:customer'])->prefix('customer')->group(function () {
      Route::get('/dashboard', [DashboardController::class, 'index']);
      Route::get('/software', [SoftwareController::class, 'index']);
      Route::get('/downloads', [DownloadController::class, 'index']);
      Route::post('/downloads/{id}/log', [DownloadController::class, 'logDownload']);
  });
  ```

---

## Frontend: Components

### LicenseCard

- [x] Create `src/components/customer/LicenseCard.tsx`
  ```tsx
  Props: {
    programName: string
    programVersion: string
    biosId: string
    status: 'active' | 'expired' | 'suspended'
    activatedAt: string
    expiresAt: string
    daysRemaining: number
    percentageRemaining: number
    downloadLink?: string
    onRequestRenewal: () => void
  }
  ```
  - Display program name + version at top
  - BIOS ID row
  - Status badge (green Active / red Expired / amber Suspended)
  - Date rows: Activated, Expires
  - Progress bar: LicenseProgress component
  - Action buttons: Download (if active), Request Renewal

### LicenseProgress

- [x] Create `src/components/customer/LicenseProgress.tsx`
  ```tsx
  Props: { percentage: number, daysRemaining: number }
  ```
  - Horizontal progress bar using shadcn/ui Progress
  - Color: green (>30%), yellow (10-30%), red (<10%)
  - Text below: "X days remaining" (or "Expired" if 0)
  - Arabic translation supported

### ProgramCard

- [x] Create `src/components/customer/ProgramCard.tsx`
  - Program icon (placeholder if none)
  - Name + version
  - Description (truncated)
  - Status badge
  - Download button (enabled only if active license)

### DownloadButton

- [x] Create `src/components/customer/DownloadButton.tsx`
  - If active: Blue button with download icon, opens link in new tab
  - If expired: Disabled gray button with tooltip "License expired"
  - On click (active): calls `POST /downloads/{id}/log` then opens link

---

## Frontend: Pages

### Dashboard (`/customer/dashboard`)

- [x] Create `src/pages/customer/Dashboard.tsx`
- [x] Fetch licenses from `/api/customer/dashboard`
- [x] Summary stats row: Total | Active | Expired (3 small cards)
- [x] License cards grid:
  - Mobile: 1 column
  - Tablet: 2 columns
  - Desktop: 3 columns
- [x] Each card is a `LicenseCard` component
- [x] If no licenses: EmptyState component ("No active licenses")
- [x] Loading: skeleton cards while fetching
- [x] "Request Renewal" button: opens mail client to reseller

### Software (`/customer/software`)

- [x] Create `src/pages/customer/Software.tsx`
- [x] Fetch from `/api/customer/software`
- [x] Card grid of `ProgramCard` components
- [x] Only shows programs with active licenses
- [x] Search by program name
- [x] Empty state if no programs

### Download (`/customer/download`)

- [x] Create `src/pages/customer/Download.tsx`
- [x] Fetch from `/api/customer/downloads`
- [x] List view with:
  - Program name + version
  - Download button
  - File info (if available)
  - Last downloaded date
- [x] System requirements section (static or per-program)
- [x] Installation guide link (if provided)
- [x] Log each download click

---

## Frontend: Customer Layout

- [x] Create customer-specific layout variant (or modify DashboardLayout):
  - No sidebar (only 3 pages)
  - Top navbar: Logo | Dashboard | Software | Download | Language | Theme | Profile dropdown
  - Simpler footer
- [x] Add customer routes to router:
  ```tsx
  <Route path="/customer" element={<CustomerLayout />}>
    <Route path="dashboard" element={<CustomerDashboard />} />
    <Route path="software" element={<CustomerSoftware />} />
    <Route path="download" element={<CustomerDownload />} />
  </Route>
  ```

---

## Dark/Light Mode (Complete)

- [x] Verify `useTheme` hook works across all pages
- [ ] Test dark mode on:
  - [ ] Login page
  - [ ] Super Admin pages (Phase 02)
  - [ ] Manager Parent pages (Phase 03)
  - [ ] Reseller pages (Phase 04)
  - [x] Customer pages (this phase)
- [ ] Dark mode colors verified:
  - Background: `#111827` (gray-900)
  - Cards: `#1F2937` (gray-800)
  - Text: `#F9FAFB` (gray-50)
  - Borders: `#374151` (gray-700)
- [x] Toggle persists across page navigation (localStorage)
- [x] System preference detection on first visit

Remaining unchecked dark-mode items require manual browser QA across non-customer areas.

---

## Responsive Design (Complete Check)

- [ ] Test all pages at 375px (iPhone SE)
- [ ] Test all pages at 768px (iPad)
- [ ] Test all pages at 1024px (laptop)
- [ ] Test all pages at 1440px (desktop)
- [x] Mobile hamburger menu works
- [ ] Tables scroll horizontally on mobile
- [x] Cards stack in single column on mobile
- [x] Touch targets >= 44px on mobile

Remaining unchecked responsive items require manual browser QA across the wider app.

---

## Frontend: Services

- [x] Create `src/services/customer.service.ts`:
  ```typescript
  getDashboard(): Promise<CustomerDashboardData>
  getSoftware(): Promise<ProgramWithLicense[]>
  getDownloads(): Promise<DownloadItem[]>
  logDownload(programId: number): Promise<void>
  ```

---

## Testing (15 Component Tests)

### LicenseCard

- [x] Test 1: Renders program name and version
- [x] Test 2: Shows "Active" badge with green color
- [x] Test 3: Shows "Expired" badge with red color
- [x] Test 4: Progress bar shows correct percentage
- [x] Test 5: Progress bar is green when >30%
- [x] Test 6: Progress bar is red when <10%
- [x] Test 7: "Download" button enabled when active
- [x] Test 8: "Download" button disabled when expired
- [x] Test 9: Displays correct days remaining

### Pages

- [x] Test 10: Dashboard renders license cards grid
- [x] Test 11: Dashboard shows empty state when no licenses
- [x] Test 12: Software page renders program cards
- [x] Test 13: Download page renders download list

### Responsive

- [x] Test 14: Cards show in 1 column on mobile viewport
- [x] Test 15: Dark mode class toggles correctly

---

## Verification (End of Day 7)

```bash
# Login as customer@obd2sw.com
# Verify:
1. /customer/dashboard -> shows license cards with progress bars
2. /customer/software  -> shows licensed programs
3. /customer/download  -> download buttons work

# Test mobile: resize to 375px
# Test dark mode: toggle in navbar
# Test Arabic: visit /ar/customer/dashboard, layout flips RTL

# 15 tests passing (run from tests-frontend/)
cd tests-frontend && npm run test:unit -- --testPathPattern=customer
```

**Phase 05 implementation is complete. Remaining unchecked items are manual QA checks.**
