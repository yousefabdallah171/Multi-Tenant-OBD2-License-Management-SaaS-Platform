# PHASE 07: UI/UX Polish - TODO List

**Duration:** Day 9-10
**Deadline:** End of Day 10

---

## Day 9: Animations + Loading + Errors

### Animations Setup

- [ ] Install: `npm install framer-motion`
- [ ] Create `src/components/shared/PageTransition.tsx`:
  ```tsx
  // Wrap each page content for fade-in animation
  // initial: opacity 0, y: 10
  // animate: opacity 1, y: 0
  // duration: 200ms
  ```
- [ ] Apply PageTransition to all 43 pages
- [ ] Add stagger animation for card grids (stats cards, program cards, license cards)
- [ ] Add slide animation for sidebar open/close
- [ ] Add scale animation for modal open/close
- [ ] Add hover effects to cards: `hover:shadow-lg transition-shadow duration-200`
- [ ] Add hover effects to buttons: `hover:scale-[1.02] active:scale-[0.98] transition-transform`

### Loading States

- [ ] Create `src/components/shared/SkeletonCard.tsx` (stats card skeleton)
- [ ] Create `src/components/shared/SkeletonTable.tsx` (table rows skeleton)
- [ ] Create `src/components/shared/SkeletonChart.tsx` (chart area skeleton)
- [ ] Create `src/components/shared/PageLoader.tsx` (full-page centered spinner)
- [ ] Add skeleton loading to every page:
  - [ ] Super Admin Dashboard: 4 skeleton cards + chart skeletons
  - [ ] Super Admin Tenants: table skeleton
  - [ ] Super Admin Users: table skeleton
  - [ ] Super Admin Reports: chart skeletons
  - [ ] Super Admin Logs: table skeleton
  - [ ] Super Admin API Status: card skeleton
  - [ ] Manager Parent Dashboard: skeletons
  - [ ] Manager Parent Team: table skeleton
  - [ ] Manager Parent Software: card grid skeleton
  - [ ] Manager Parent Reports: chart skeletons
  - [ ] Reseller Dashboard: skeletons
  - [ ] Reseller Customers: table skeleton
  - [ ] Reseller Licenses: table skeleton
  - [ ] Customer Dashboard: license card skeletons
  - [ ] Customer Software: card skeletons
- [ ] Add button loading spinners to all form submit buttons
- [ ] Add inline spinners to action buttons (delete, suspend, etc.)

### Error Boundaries

- [ ] Create `src/components/shared/ErrorBoundary.tsx`:
  - Class component with `componentDidCatch`
  - Fallback UI: error icon, "Something went wrong", Try Again button
  - Log error to console
- [ ] Wrap each route section with ErrorBoundary
- [ ] Create `src/pages/errors/NotFound.tsx` (404):
  - Large "404" text, "Page not found" message, "Go to Dashboard" button
- [ ] Create `src/pages/errors/AccessDenied.tsx` (403):
  - Lock icon, "Access Denied" message, "Go Back" button
- [ ] Create `src/pages/errors/ServerError.tsx` (500):
  - Error icon, "Server Error" message, "Try Again" button
- [ ] Add 404 catch-all route in router: `<Route path="*" element={<NotFound />} />`
- [ ] Update Axios interceptor for 401/403/500 handling

### Empty States

- [ ] Create `src/components/shared/EmptyState.tsx`:
  ```tsx
  Props: { icon: LucideIcon, title: string, description: string, action?: { label: string, onClick: () => void } }
  ```
- [ ] Add empty state to every DataTable and card grid:
  - [ ] Tenants table: "No tenants yet" + "Add Tenant" button
  - [ ] Users table: "No users found"
  - [ ] Programs grid: "No programs yet" + "Add Program" button
  - [ ] Licenses table: "No licenses yet"
  - [ ] Customers table: "No customers yet" + "Add Customer" button
  - [ ] Logs table: "No logs recorded"
  - [ ] Activity feed: "No activity yet"
  - [ ] Customer dashboard: "No active licenses"
  - [ ] Reports charts: "No data for this period"

---

## Day 10: Mobile + Polish + Consistency

### Mobile Hamburger Menu

- [ ] Update `Navbar.tsx`:
  - Add hamburger icon button (visible only on mobile < 768px)
  - On click: toggle sidebar visibility
- [ ] Update `Sidebar.tsx`:
  - Mobile: position fixed, full height, z-50, slide animation
  - Add backdrop overlay (black opacity 50%)
  - Click backdrop: close sidebar
  - RTL: slide from right instead of left
- [ ] Update `DashboardLayout.tsx`:
  - Mobile: no sidebar space, content is full width
  - Desktop: sidebar takes fixed width (250px expanded, 64px collapsed)

### Mobile Table Responsiveness

- [ ] Create `src/components/shared/ResponsiveTable.tsx`:
  - Wraps DataTable in horizontal scroll container
  - Shadow indicators on scroll edges (left/right fade)
  - Alternative: card view on mobile (toggle table/cards)
- [ ] Apply to all DataTables:
  - [ ] Tenants, Users, Logs tables (Super Admin)
  - [ ] Team, Pricing, Customers tables (Manager Parent)
  - [ ] Customers, Licenses tables (Reseller)

### Mobile Form Dialogs

- [ ] Update Dialog component for mobile:
  - Mobile: full-screen dialog (no rounded corners, max-w-full)
  - Desktop: centered modal (max-w-lg)
- [ ] Apply to all form dialogs:
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
- [ ] Install Sonner: `npm install sonner`
- [ ] All success actions show green toast
- [ ] All error actions show red toast
- [ ] All toasts positioned: top-right (LTR) or top-left (RTL)
- [ ] Toast auto-dismiss: 5 seconds

---

## Polish Checklist (All 43 Pages)

### Super Admin (13)
- [ ] Dashboard: Stats + charts + activity feed polished
- [ ] Tenants: Table + modal + actions polished
- [ ] Users: Table + filters polished
- [ ] Admin Management: Table + add admin modal polished
- [ ] BIOS Blacklist: Table + add modal + import/export polished
- [ ] BIOS History: Search + timeline view polished
- [ ] Username Management: Table + unlock/change modals polished
- [ ] Financial Reports: Charts + reseller balances table polished
- [ ] Reports: Charts + export polished
- [ ] Logs: Table + JSON viewer polished
- [ ] API Status: Status indicator + chart polished
- [ ] Settings: Form tabs polished
- [ ] Profile: Form + avatar polished

### Manager Parent (12)
- [ ] Dashboard: Stats + charts + quick actions polished
- [ ] Team Management: Tabs + table + invite modal polished
- [ ] Reseller Pricing: Table + inline edit polished
- [ ] Software Management: Card/table toggle + form polished
- [ ] BIOS Blacklist (Tenant): Table + add modal polished
- [ ] BIOS History (Tenant): Search + timeline polished
- [ ] IP Analytics: Charts + table polished
- [ ] Username Management (Tenant): Table + unlock/change modals polished
- [ ] Financial Reports (Tenant): Charts + balances table polished
- [ ] Reports: Charts + export polished
- [ ] Activity: Timeline feed polished
- [ ] Customers: Table + detail drawer polished
- [ ] Settings: Form polished
- [ ] Profile: Form polished

### Manager (8)
- [ ] Dashboard: Stats + team charts polished
- [ ] Team/Resellers: Table + detail view polished
- [ ] Username Management (Team): Table + unlock/change modals polished
- [ ] Customers: Read-only table + filters polished
- [ ] Software: Card grid polished
- [ ] Reports: Team charts + export polished
- [ ] Activity: Team timeline polished
- [ ] Profile: Form polished

### Reseller (7)
- [ ] Dashboard: Stats + charts polished
- [ ] Customers: Table + BIOS activation wizard polished
- [ ] Software: Card grid polished
- [ ] Licenses: Table + expiry warnings polished
- [ ] Reports: Charts + export polished
- [ ] Activity: Timeline polished
- [ ] Profile: Form polished

### Customer (3)
- [ ] Dashboard: License cards + progress bars polished
- [ ] Software: Program cards polished
- [ ] Download: Download list polished

---

## Accessibility

- [ ] Add `aria-label` to all icon buttons (e.g., hamburger, close, delete)
- [ ] Add `role="status"` to loading spinners
- [ ] Add `aria-live="polite"` to toast container
- [ ] Ensure focus trap in modals/dialogs
- [ ] Test keyboard navigation: Tab through each page
- [ ] Check color contrast with browser dev tools
- [ ] Add skip-to-content link

---

## Testing (25 Responsive Tests)

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
