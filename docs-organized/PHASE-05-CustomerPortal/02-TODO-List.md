# PHASE 05: Customer Portal - TODO List

**Duration:** Day 7
**Deadline:** End of Day 7

---

## Backend

### Controllers

- [ ] Create `Customer/DashboardController.php`
  - `index()`: Return all licenses for authenticated customer with program data
  - Include: program name, version, bios_id, activated_at, expires_at, status
  - Calculate: days_remaining, percentage_remaining
- [ ] Create `Customer/SoftwareController.php`
  - `index()`: Return programs where customer has active license
  - Include: name, description, version, download_link, icon
- [ ] Create `Customer/DownloadController.php`
  - `index()`: Return downloadable programs with links
  - `logDownload($id)`: Record download event in activity_logs

### Routes

- [ ] Add customer routes to `routes/api.php`:
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

- [ ] Create `src/components/customer/LicenseCard.tsx`
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

- [ ] Create `src/components/customer/LicenseProgress.tsx`
  ```tsx
  Props: { percentage: number, daysRemaining: number }
  ```
  - Horizontal progress bar using shadcn/ui Progress
  - Color: green (>30%), yellow (10-30%), red (<10%)
  - Text below: "X days remaining" (or "Expired" if 0)
  - Arabic translation: "X يوم متبقي"

### ProgramCard

- [ ] Create `src/components/customer/ProgramCard.tsx`
  - Program icon (placeholder if none)
  - Name + version
  - Description (truncated)
  - Status badge
  - Download button (enabled only if active license)

### DownloadButton

- [ ] Create `src/components/customer/DownloadButton.tsx`
  - If active: Blue button with download icon, opens link in new tab
  - If expired: Disabled gray button with tooltip "License expired"
  - On click (active): calls `POST /downloads/{id}/log` then opens link

---

## Frontend: Pages

### Dashboard (`/customer/dashboard`)

- [ ] Create `src/pages/customer/Dashboard.tsx`
- [ ] Fetch licenses from `/api/customer/dashboard`
- [ ] Summary stats row: Total | Active | Expired (3 small cards)
- [ ] License cards grid:
  - Mobile: 1 column
  - Tablet: 2 columns
  - Desktop: 3 columns
- [ ] Each card is a `LicenseCard` component
- [ ] If no licenses: EmptyState component ("No active licenses")
- [ ] Loading: skeleton cards while fetching
- [ ] "Request Renewal" button: opens dialog with message form (or mailto reseller)

### Software (`/customer/software`)

- [ ] Create `src/pages/customer/Software.tsx`
- [ ] Fetch from `/api/customer/software`
- [ ] Card grid of `ProgramCard` components
- [ ] Only shows programs with active licenses
- [ ] Search by program name
- [ ] Empty state if no programs

### Download (`/customer/download`)

- [ ] Create `src/pages/customer/Download.tsx`
- [ ] Fetch from `/api/customer/downloads`
- [ ] List view (not cards):
  - Program name + version
  - Download button (large, prominent)
  - File info (if available)
  - Last downloaded date
- [ ] System requirements section (static or per-program)
- [ ] Installation guide link (if provided)
- [ ] Log each download click

---

## Frontend: Customer Layout

- [ ] Create customer-specific layout variant (or modify DashboardLayout):
  - No sidebar (only 3 pages)
  - Top navbar: Logo | Dashboard | Software | Download | Language | Theme | Profile dropdown
  - Simpler footer
- [ ] Add customer routes to router:
  ```tsx
  <Route path="/customer" element={<CustomerLayout />}>
    <Route path="dashboard" element={<CustomerDashboard />} />
    <Route path="software" element={<CustomerSoftware />} />
    <Route path="download" element={<CustomerDownload />} />
  </Route>
  ```

---

## Dark/Light Mode (Complete)

- [ ] Verify `useTheme` hook works across all pages
- [ ] Test dark mode on:
  - [ ] Login page
  - [ ] Super Admin pages (Phase 02)
  - [ ] Manager Parent pages (Phase 03)
  - [ ] Reseller pages (Phase 04)
  - [ ] Customer pages (this phase)
- [ ] Dark mode colors verified:
  - Background: `#111827` (gray-900)
  - Cards: `#1F2937` (gray-800)
  - Text: `#F9FAFB` (gray-50)
  - Borders: `#374151` (gray-700)
- [ ] Toggle persists across page navigation (localStorage)
- [ ] System preference detection on first visit

---

## Responsive Design (Complete Check)

- [ ] Test all pages at 375px (iPhone SE)
- [ ] Test all pages at 768px (iPad)
- [ ] Test all pages at 1024px (laptop)
- [ ] Test all pages at 1440px (desktop)
- [ ] Mobile hamburger menu works
- [ ] Tables scroll horizontally on mobile
- [ ] Cards stack in single column on mobile
- [ ] Touch targets >= 44px on mobile

---

## Frontend: Services

- [ ] Create `src/services/customer.service.ts`:
  ```typescript
  getDashboard(): Promise<CustomerDashboardData>
  getSoftware(): Promise<ProgramWithLicense[]>
  getDownloads(): Promise<DownloadItem[]>
  logDownload(programId: number): Promise<void>
  ```

---

## Testing (15 Component Tests)

### LicenseCard
- [ ] Test 1: Renders program name and version
- [ ] Test 2: Shows "Active" badge with green color
- [ ] Test 3: Shows "Expired" badge with red color
- [ ] Test 4: Progress bar shows correct percentage
- [ ] Test 5: Progress bar is green when >30%
- [ ] Test 6: Progress bar is red when <10%
- [ ] Test 7: "Download" button enabled when active
- [ ] Test 8: "Download" button disabled when expired
- [ ] Test 9: Displays correct days remaining

### Pages
- [ ] Test 10: Dashboard renders license cards grid
- [ ] Test 11: Dashboard shows empty state when no licenses
- [ ] Test 12: Software page renders program cards
- [ ] Test 13: Download page renders download list

### Responsive
- [ ] Test 14: Cards show in 1 column on mobile viewport
- [ ] Test 15: Dark mode class toggles correctly

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

**Phase 05 complete. Proceed to PHASE-06-ReportsAnalytics.**
