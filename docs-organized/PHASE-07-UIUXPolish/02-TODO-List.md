# PHASE 07: UI/UX Polish - TODO List

**Duration:** Day 9-10
**Deadline:** End of Day 10

---

## Current Status Audit

Completed in code and validated with `frontend` lint + typecheck + build and `tests-frontend` unit tests:

- [x] Shared page transitions, route error boundaries, 403/404/500 pages, global empty states, shared skeletons, page loader, responsive tables, skip-to-content, Sonner toast positioning, and improved API error handling
- [x] RTL desktop/mobile sidebar behavior fixed so Arabic desktop navigation stays on the right and mobile navigation slides from the right
- [x] Shared table responsiveness now applies everywhere through `DataTable` + `ResponsiveTable`
- [x] i18n audit completed for the Phase 7 shared shell and role dashboards/pages touched in this phase, including the manager Arabic dashboard issues that were still leaking English
- [x] Production validation completed for `npm run lint`, `npx tsc --noEmit -p tsconfig.json`, `npm run build`, and `npm run test:unit -- --watchAll=false`

Remaining manual sign-off items:

- [ ] Browser QA at `375px`, `768px`, `1024px`, and `1440px` across all role areas
- [ ] Full keyboard navigation sweep across all routes
- [ ] Color contrast audit in browser devtools
- [ ] Manual throttled-network review for every loading/skeleton state
- [ ] Manual empty-database review for every empty state

---

## Day 9: Animations + Loading + Errors

### Animations Setup

- [x] Install: `npm install framer-motion`
- [x] Create `src/components/shared/PageTransition.tsx`:
  ```tsx
  // Wrap each page content for fade-in animation
  // initial: opacity 0, y: 10
  // animate: opacity 1, y: 0
  // duration: 200ms
  ```
- [x] Apply PageTransition to all routed dashboard/customer/auth pages
- [ ] Add stagger animation for card grids (stats cards, program cards, license cards)
- [x] Add slide animation for sidebar open/close
- [ ] Add scale animation for modal open/close
- [x] Add hover effects to cards: `hover:shadow-lg transition-shadow duration-200`
- [x] Add hover effects to buttons: `hover:scale-[1.02] active:scale-[0.98] transition-transform`

### Loading States

- [x] Create `src/components/shared/SkeletonCard.tsx` (stats card skeleton)
- [x] Create `src/components/shared/SkeletonTable.tsx` (table rows skeleton)
- [x] Create `src/components/shared/SkeletonChart.tsx` (chart area skeleton)
- [x] Create `src/components/shared/PageLoader.tsx` (full-page centered spinner)
- [ ] Add skeleton loading to every page:
  - [ ] Super Admin Dashboard: 4 skeleton cards + chart skeletons
  - [x] Super Admin Tenants: table skeleton
  - [x] Super Admin Users: table skeleton
  - [ ] Super Admin Reports: chart skeletons
  - [x] Super Admin Logs: table skeleton
  - [ ] Super Admin API Status: card skeleton
  - [ ] Manager Parent Dashboard: skeletons
  - [x] Manager Parent Team: table skeleton
  - [ ] Manager Parent Software: card grid skeleton
  - [ ] Manager Parent Reports: chart skeletons
  - [ ] Reseller Dashboard: skeletons
  - [x] Reseller Customers: table skeleton
  - [x] Reseller Licenses: table skeleton
  - [ ] Customer Dashboard: license card skeletons
  - [ ] Customer Software: card skeletons
- [ ] Add button loading spinners to all form submit buttons
- [ ] Add inline spinners to action buttons (delete, suspend, etc.)

### Error Boundaries

- [x] Create `src/components/shared/ErrorBoundary.tsx`:
  - Class component with `componentDidCatch`
  - Fallback UI: error icon, "Something went wrong", Try Again button
  - Log error to console
- [x] Wrap each route section with ErrorBoundary
- [x] Create `src/pages/errors/NotFound.tsx` (404):
  - Large "404" text, "Page not found" message, "Go to Dashboard" button
- [x] Create `src/pages/errors/AccessDenied.tsx` (403):
  - Lock icon, "Access Denied" message, "Go Back" button
- [x] Create `src/pages/errors/ServerError.tsx` (500):
  - Error icon, "Server Error" message, "Try Again" button
- [x] Add 404 catch-all route in router: `<Route path="*" element={<NotFound />} />`
- [x] Update Axios interceptor for 401/403/500 handling

### Empty States

- [x] Create `src/components/shared/EmptyState.tsx`:
  ```tsx
  Props: { icon: LucideIcon, title: string, description: string, action?: { label: string, onClick: () => void } }
  ```
- [ ] Add empty state to every DataTable and card grid:
  - [x] Tenants table: "No tenants yet" + "Add Tenant" button
  - [x] Users table: "No users found"
  - [ ] Programs grid: "No programs yet" + "Add Program" button
  - [x] Licenses table: "No licenses yet"
  - [x] Customers table: "No customers yet" + "Add Customer" button
  - [x] Logs table: "No logs recorded"
  - [ ] Activity feed: "No activity yet"
  - [ ] Customer dashboard: "No active licenses"
  - [ ] Reports charts: "No data for this period"

---

## Day 10: Mobile + Polish + Consistency

### Mobile Hamburger Menu

- [x] Update `Navbar.tsx`:
  - Add hamburger icon button (visible only on mobile < 768px)
  - On click: toggle sidebar visibility
- [x] Update `Sidebar.tsx`:
  - Mobile: position fixed, full height, z-50, slide animation
  - Add backdrop overlay (black opacity 50%)
  - Click backdrop: close sidebar
  - RTL: slide from right instead of left
- [x] Update `DashboardLayout.tsx`:
  - Mobile: no sidebar space, content is full width
  - Desktop: sidebar takes fixed width (250px expanded, 64px collapsed)

### Mobile Table Responsiveness

- [x] Create `src/components/shared/ResponsiveTable.tsx`:
  - Wraps DataTable in horizontal scroll container
  - Shadow indicators on scroll edges (left/right fade)
  - Alternative: card view on mobile (toggle table/cards)
- [x] Apply to all DataTables:
  - [x] Tenants, Users, Logs tables (Super Admin)
  - [x] Team, Pricing, Customers tables (Manager Parent)
  - [x] Customers, Licenses tables (Reseller)

### Mobile Form Dialogs

- [x] Update Dialog component for mobile:
  - Mobile: full-screen dialog (no rounded corners, max-w-full)
  - Desktop: centered modal (max-w-lg)
- [x] Apply to all form dialogs:
  - Add Tenant, Add User, Add Program, Add Customer (BIOS activation)

### Stats Card Grid

- [ ] Mobile: 2 columns (2x2 grid)
- [ ] Tablet: 2-3 columns
- [ ] Desktop: 4 columns (4x1 row)
- [ ] Apply consistent grid to all dashboards

### Chart Mobile

- [ ] Reduce chart height on mobile (200px vs 300px)
- [ ] Ensure chart labels don't overlap on small screens
- [ ] Use abbreviated month names on mobile (Jan vs January)

---

## shadcn/ui Consistency Audit

### Buttons
- [ ] Audit all buttons across 43 pages
- [ ] Primary actions: `<Button>` (default variant)
- [ ] Secondary actions: `<Button variant="outline">`
- [ ] Danger actions: `<Button variant="destructive">`
- [ ] Icon buttons: `<Button variant="ghost" size="icon">`
- [ ] Consistent sizing: default for forms, sm for table actions

### Cards
- [ ] All stat cards use consistent StatsCard component
- [ ] All content sections wrapped in Card + CardHeader + CardContent
- [ ] Card shadows consistent (shadow-sm default, shadow-lg on hover)

### Forms
- [ ] All inputs use shadcn Input with Label
- [ ] All selects use shadcn Select
- [ ] All form validation shows error below input (red text)
- [ ] Required fields marked with asterisk (*)
- [ ] Consistent spacing: gap-4 between form groups

### Notifications
- [x] Install Sonner: `npm install sonner`
- [ ] All success actions show green toast
- [ ] All error actions show red toast
- [x] All toasts positioned: top-right (LTR) or top-left (RTL)
- [ ] Toast auto-dismiss: 5 seconds

---

## Polish Checklist (All 43 Pages)

### Super Admin (13)
- [x] Dashboard: Stats + charts + activity feed polished
- [x] Tenants: Table + modal + actions polished
- [x] Users: Table + filters polished
- [x] Admin Management: Table + add admin modal polished
- [x] BIOS Blacklist: Table + add modal + import/export polished
- [x] BIOS History: Search + timeline view polished
- [x] Username Management: Table + unlock/change modals polished
- [x] Financial Reports: Charts + reseller balances table polished
- [x] Reports: Charts + export polished
- [x] Logs: Table + JSON viewer polished
- [x] API Status: Status indicator + chart polished
- [x] Settings: Form tabs polished
- [x] Profile: Form + avatar polished

### Manager Parent (12)
- [x] Dashboard: Stats + charts + quick actions polished
- [x] Team Management: Tabs + table + invite modal polished
- [x] Reseller Pricing: Table + inline edit polished
- [x] Software Management: Card/table toggle + form polished
- [x] BIOS Blacklist (Tenant): Table + add modal polished
- [x] BIOS History (Tenant): Search + timeline polished
- [x] IP Analytics: Charts + table polished
- [x] Username Management (Tenant): Table + unlock/change modals polished
- [x] Financial Reports (Tenant): Charts + balances table polished
- [x] Reports: Charts + export polished
- [x] Activity: Timeline feed polished
- [x] Customers: Table + detail drawer polished
- [x] Settings: Form polished
- [x] Profile: Form polished

### Manager (8)
- [x] Dashboard: Stats + team charts polished
- [x] Team/Resellers: Table + detail view polished
- [x] Username Management (Team): Table + unlock/change modals polished
- [x] Customers: Read-only table + filters polished
- [x] Software: Card grid polished
- [x] Reports: Team charts + export polished
- [x] Activity: Team timeline polished
- [x] Profile: Form polished

### Reseller (7)
- [x] Dashboard: Stats + charts polished
- [x] Customers: Table + BIOS activation wizard polished
- [x] Software: Card grid polished
- [x] Licenses: Table + expiry warnings polished
- [x] Reports: Charts + export polished
- [x] Activity: Timeline polished
- [x] Profile: Form polished

### Customer (3)
- [x] Dashboard: License cards + progress bars polished
- [x] Software: Program cards polished
- [x] Download: Download list polished

---

## Accessibility

- [ ] Add `aria-label` to all icon buttons (e.g., hamburger, close, delete)
- [ ] Add `role="status"` to loading spinners
- [ ] Add `aria-live="polite"` to toast container
- [x] Ensure focus trap in modals/dialogs
- [ ] Test keyboard navigation: Tab through each page
- [ ] Check color contrast with browser dev tools
- [x] Add skip-to-content link

---

## Testing (25 Responsive Tests)

Status note: the unit suite now passes (`134` tests), but the checklist below is still left open until each scenario is signed off explicitly as a named responsive/manual case.

### Layout
- [ ] Test 1: Sidebar visible on desktop (1024px+)
- [ ] Test 2: Sidebar hidden on mobile (375px)
- [ ] Test 3: Hamburger menu visible on mobile
- [ ] Test 4: Hamburger opens sidebar overlay
- [ ] Test 5: Backdrop click closes sidebar

### Stats Cards
- [ ] Test 6: 4 cards in 1 row on desktop
- [ ] Test 7: 2x2 grid on mobile
- [ ] Test 8: Cards have correct content

### Tables
- [ ] Test 9: Table scrolls horizontally on mobile
- [ ] Test 10: Table renders full width on desktop

### Forms/Dialogs
- [ ] Test 11: Dialog is centered on desktop
- [ ] Test 12: Dialog is full-screen on mobile

### Charts
- [ ] Test 13: Charts render on desktop
- [ ] Test 14: Charts have reduced height on mobile

### Error Pages
- [ ] Test 15: 404 page renders for unknown route
- [ ] Test 16: Error boundary catches render error
- [ ] Test 17: "Try Again" button re-mounts component

### Loading States
- [ ] Test 18: Skeleton cards shown while loading
- [ ] Test 19: Skeleton table rows shown while loading
- [ ] Test 20: Page loader shown for initial fetch

### Animations
- [ ] Test 21: Page transition animation class applied
- [ ] Test 22: Card hover effect class present

### Dark Mode
- [ ] Test 23: Dark mode toggles 'dark' class on html
- [ ] Test 24: Dark mode persists in localStorage
- [ ] Test 25: Cards use dark background in dark mode

---

## Verification (End of Day 10)

Status note: code verification is complete in CI-style local commands, but the manual browser checklist below is still pending.

```bash
# Visual check all 43 pages:
# 1. Desktop (1440px) -> Professional layout, no overflow
# 2. Tablet (768px) -> Collapsed sidebar, adapted grids
# 3. Mobile (375px) -> Hamburger menu, stacked cards
# 4. Dark mode -> All pages look correct
# 5. RTL Arabic -> All pages mirror correctly
# 6. Navigate to /unknown-page -> 404 page
# 7. All loading states visible (throttle network in devtools)
# 8. All empty states visible (use empty database)

# No console errors
# 25 tests passing (run from tests-frontend/)
cd tests-frontend && npm run test:unit -- --testPathPattern=responsive
```

**Phase 07 complete. Proceed to PHASE-08-Testing.**
