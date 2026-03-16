# Master Production Testing Plan — All Roles + Shared Components
# Full Cross-Role Interaction Matrix + Production Readiness

> **Scope:** Every shared component, every shared page, every cross-role effect,
> every middleware, every backend guard, and production deployment verification.
>
> **This plan supplements the 4 individual role plans:**
> - `reseller-dashboard-testing-plan.md`
> - `manager-dashboard-testing-plan.md`
> - `manager-parent-dashboard-testing-plan.md`
> - `super-admin-dashboard-testing-plan.md`
>
> **Run this plan AFTER all 4 individual plans pass.**
>
> **Base URL:** `http://localhost:3000` (dev) → `https://yourdomain.com` (production)
> **Test tool:** Playwright MCP

---

## PART 1 — Shared Component Tests

> Each component is tested once here, across ALL roles that use it.
> Individual role plans confirm the component *exists* on each page —
> this plan confirms the component itself *works correctly* in depth.

---

### SC-1: DataTable (`components/shared/DataTable.tsx`)

**Used by:** All roles (customers, team, activations, logs, payments, reports tables)

#### SC-1-T1: Sticky Header Scroll
- [ ] Open any page with a large table (Customers, Reseller Logs)
- [ ] Scroll down within the table container
- [ ] Verify `<thead>` stays fixed at the top while rows scroll below it
- [ ] Test on: reseller/customers, manager/customers, manager-parent/customers, super-admin/customers
- [ ] **Fix:** Header scrolling away → verify `<div className="max-h-[70vh] overflow-auto">` wraps table and `thead` has `sticky top-0 z-20`

#### SC-1-T2: Client-Side Column Sort
- [ ] Click a sortable column header → rows sort ascending (arrow up)
- [ ] Click again → descending (arrow down)
- [ ] Click third time → sort cleared (no arrow)
- [ ] Verify sort works on: text, number, date, and currency columns
- [ ] **Fix:** Sort not working → check `sortable: true` + `sortValue` in column definition

#### SC-1-T3: Empty State Display
- [ ] Filter a table to return 0 results
- [ ] Verify `EmptyState` component appears inside the table (not just a blank area)
- [ ] Verify "No results" message is translated correctly in AR mode
- [ ] **Fix:** Blank space instead of empty state → check DataTable empty condition rendering

#### SC-1-T4: Pagination Controls
- [ ] With >10 rows: verify Previous / Page X of Y / Next controls show
- [ ] Click Next → correct next page loads
- [ ] Click Previous → goes back
- [ ] Verify first page: Previous disabled; last page: Next disabled
- [ ] **Fix:** Controls broken → check `meta.last_page` + `onPageChange` prop

#### SC-1-T5: Rows Per Page Selector
- [ ] Change from 10 → 25 → verify more rows load
- [ ] Change 25 → 50 → verify URL updates with `per_page=50`
- [ ] **Fix:** Selector not triggering refetch → check `onPerPageChange` handler + queryKey

#### SC-1-T6: Loading Skeleton
- [ ] On slow network (throttle in DevTools to Slow 3G)
- [ ] Navigate to any table page
- [ ] Verify `SkeletonTable` rows appear before data loads (not blank)
- [ ] Verify skeleton disappears when data arrives
- [ ] **Fix:** Blank during load → check `isLoading` conditional rendering

#### SC-1-T7: RTL Column Order
- [ ] Switch to AR mode
- [ ] Open any table
- [ ] Verify columns are mirrored (rightmost column in LTR becomes leftmost in RTL)
- [ ] Verify sort arrows are on correct side
- [ ] **Fix:** Columns not mirrored → check table `dir` attribute inheritance

---

### SC-2: StatusBadge (`components/shared/StatusBadge.tsx`)

**Used by:** All roles (license status, user status, program status)

#### SC-2-T1: All Status Colors — Light Mode
| Status | Expected Color |
|--------|----------------|
| `active` | Emerald/Green |
| `expired` | Rose/Red |
| `cancelled` | Rose/Red |
| `pending` | Sky/Blue |
| `scheduled` | Violet/Purple |
| `suspended` | Amber/Orange |
| `inactive` | Slate/Grey |

- [ ] Find a customer/user with each status and verify badge color matches table above
- [ ] **Fix:** Wrong color → check `StatusBadge` variant map

#### SC-2-T2: All Status Colors — Dark Mode
- [ ] Toggle dark mode → repeat above verification
- [ ] Verify badges are readable against dark backgrounds
- [ ] **Fix:** Badge invisible in dark → check `dark:` class variants

#### SC-2-T3: Status Translated Labels (AR Mode)
- [ ] Switch to AR → verify status labels are in Arabic (not English)
- [ ] **Fix:** English labels in AR → check `t('status.active')` etc. in `ar.json`

---

### SC-3: RoleBadge (`components/shared/RoleBadge.tsx`)

**Used by:** Users page, Admin Management, Team Management, Activity logs, Reseller Logs

#### SC-3-T1: All Role Colors
| Role | Expected Color |
|------|----------------|
| `super_admin` | Rose |
| `manager_parent` | Sky |
| `manager` | Violet |
| `reseller` | Emerald |
| `customer` | Slate |

- [ ] Find a user with each role and verify badge color
- [ ] **Fix:** Wrong color → check `RoleBadge` variant map

#### SC-3-T2: Role Label Translation (AR)
- [ ] In AR mode, verify role labels are Arabic
- [ ] **Fix:** English in AR mode → check `ar.json` role translation keys

---

### SC-4: ConfirmDialog (`components/shared/ConfirmDialog.tsx`)

**Used by:** Delete confirmations, Deactivate, Suspend, Tenant Reset (everywhere)

#### SC-4-T1: Opens and Closes Correctly
- [ ] Trigger any confirm action → dialog appears
- [ ] Click "Cancel" → dialog closes, no action taken
- [ ] Trigger again → click outside (overlay) → dialog closes
- [ ] **Fix:** Dialog not closing → check `onOpenChange` handler

#### SC-4-T2: Keyboard Accessibility
- [ ] Open dialog → press `Escape` → closes without action
- [ ] Open dialog → Tab to "Confirm" → press `Enter` → action executes
- [ ] **Fix:** Keyboard not working → check Dialog `onKeyDown` or Radix Dialog behavior

#### SC-4-T3: Destructive Variant Styling
- [ ] On a delete confirmation → verify "Confirm" button is red/destructive styled
- [ ] On a non-destructive confirm → button is default/primary color
- [ ] **Fix:** Wrong button style → check `variant="destructive"` prop passing

#### SC-4-T4: Loading State During Action
- [ ] Click Confirm → verify button shows loading spinner while API call runs
- [ ] Verify button disabled during loading (prevents double-submit)
- [ ] **Fix:** No loading state → check `isPending` passed to dialog

---

### SC-5: StatsCard (`components/shared/StatsCard.tsx`)

**Used by:** All dashboards, Reports, Payment Status

#### SC-5-T1: Values Render Correctly
- [ ] Verify value is not `NaN`, `undefined`, or `null`
- [ ] Verify currency formatting on revenue cards (`$XXX.XX`)
- [ ] Verify count formatting on count cards (no decimals)
- [ ] **Fix:** Bad value → check data passed to `StatsCard` value prop

#### SC-5-T2: Loading Skeleton
- [ ] On slow network → verify `SkeletonCard` shows while stats load
- [ ] **Fix:** Blank card → check `isLoading` conditional

#### SC-5-T3: Icon Renders
- [ ] Verify each StatsCard has a visible icon
- [ ] Icon color matches card `color` prop
- [ ] **Fix:** Missing icon → check `icon` prop + Lucide import

#### SC-5-T4: RTL Layout
- [ ] In AR mode → verify icon is on the left (RTL = icon on start side)
- [ ] Value text is right-aligned
- [ ] **Fix:** Icon on wrong side → check `flex-row-reverse` in RTL

---

### SC-6: EmptyState (`components/shared/EmptyState.tsx`)

**Used by:** All tables and lists when data is 0

#### SC-6-T1: Renders When Data Is Empty
- [ ] Filter any table to 0 results → EmptyState shown
- [ ] Test on: Customers, Team, Activations, Reseller Logs, Activity
- [ ] **Fix:** Blank instead of EmptyState → check `data.length === 0` condition

#### SC-6-T2: Description Text Translated
- [ ] In AR mode → "No data" message appears in Arabic
- [ ] **Fix:** English text in AR → check translation key

#### SC-6-T3: Action Button (if present)
- [ ] Some EmptyState components have a CTA button (e.g., "Add Customer")
- [ ] Click CTA → navigates to correct create page
- [ ] **Fix:** CTA navigates wrong → check `action.href` prop

---

### SC-7: ErrorBoundary (`components/shared/ErrorBoundary.tsx`)

**Used by:** All route pages as a safety wrapper

#### SC-7-T1: Catches Render Errors
- [ ] Simulate a component crash (temporarily break a component, test, revert)
- [ ] Verify ErrorBoundary shows a fallback UI (not a white screen)
- [ ] Verify fallback shows "Return to Dashboard" button
- [ ] **Fix:** White screen on crash → check ErrorBoundary wraps all route components

#### SC-7-T2: Recovery Navigation
- [ ] Click "Return to Dashboard" on fallback UI
- [ ] Verify navigates to correct role dashboard
- [ ] **Fix:** Wrong navigate target → check role-based dashboard path in ErrorBoundary

---

### SC-8: ProfileWorkspace (`components/shared/ProfileWorkspace.tsx`)

**Used by:** All 4 roles' Profile pages

#### SC-8-T1: Test for ALL Roles
For each role (reseller, manager, manager-parent, super-admin):
- [ ] Navigate to profile page
- [ ] Verify name, email/username, role, timezone displayed
- [ ] Edit name → save → navbar updates immediately
- [ ] Change timezone → save → date displays across the dashboard update
- [ ] Change password → logout → login with new password → success
- [ ] **Fix per role:** Check `ProfileWorkspace` props: `eyebrow`, `description`, `translationPrefix`

#### SC-8-T2: Branding Color (if applicable)
- [ ] Manager-parent profile may have primary color picker
- [ ] Change color → save → UI accent color updates
- [ ] **Fix:** Color not applying → check CSS variable update in `ProfileWorkspace`

#### SC-8-T3: Timezone Sync with `useResolvedTimezone`
- [ ] Change user timezone in profile
- [ ] Navigate to a page using `formatDate()` with timezone
- [ ] Verify dates now display in the new timezone
- [ ] **Fix:** Timezone not reflected → check `useResolvedTimezone()` hook invalidates after profile save

---

### SC-9: OnlineUsersWidget (`components/shared/OnlineUsersWidget.tsx`)

**Used by:** All authenticated layouts (fixed floating widget)

#### SC-9-T1: Widget Visible on All Dashboards
- [ ] Login as each role → verify "X online" widget visible (bottom-right corner)
- [ ] **Fix:** Widget missing → check `OnlineUsersWidget` included in layout + role permission

#### SC-9-T2: Live Count Updates (30s interval)
- [ ] Open 2 browser tabs with different user accounts logged in
- [ ] Verify online count is ≥ 2
- [ ] Logout from one tab → within 30s, count decreases in the other tab
- [ ] **Fix:** Count not updating → check `refetchInterval: 30000` on online users query

#### SC-9-T3: Role Breakdown (if shown)
- [ ] Widget may show breakdown by role (e.g., "2 resellers, 1 manager online")
- [ ] Verify counts match actual logged-in users
- [ ] **Fix:** Wrong counts → check `OnlineUsersController.widgetSettings()` response

---

### SC-10: PageTransition (`components/shared/PageTransition.tsx`)

**Used by:** All page navigations (Framer Motion fade + slide)

#### SC-10-T1: Transition Plays on Navigation
- [ ] Click between sidebar links → verify smooth fade/slide transition
- [ ] **Fix:** No transition → check `PageTransition` wraps route outlet

#### SC-10-T2: Reduced Motion Accessibility
- [ ] Enable "Reduce Motion" in OS accessibility settings
- [ ] Verify page transitions are instant (no animation)
- [ ] **Fix:** Animation still plays → check `prefers-reduced-motion` media query in Framer config

---

### SC-11: Chart Components (`components/charts/`)

**Used by:** All dashboards and reports pages

#### SC-11-T1: LineChartWidget — Data + Tooltip
- [ ] Verify line renders with data points
- [ ] Hover a data point → tooltip shows value + label
- [ ] Verify in: Reseller Dashboard, Manager Dashboard, Manager-Parent Financial Reports, Super-Admin Dashboard
- [ ] **Fix:** Chart blank → check `data` prop format: `[{ month: 'Jan', value: 123 }]`

#### SC-11-T2: BarChartWidget — Data + Legend
- [ ] Verify bars render with correct heights
- [ ] Legend labels visible and correct
- [ ] Verify in: Manager Reports, Manager-Parent Financial Reports, Super-Admin Reports
- [ ] **Fix:** Bars not rendering → check `data` prop + `dataKey` config

#### SC-11-T3: PieChartWidget — Slices + Legend
- [ ] Verify pie chart renders with colored slices
- [ ] Each slice has a legend label
- [ ] Hover a slice → shows percentage + label
- [ ] Verify in: Manager-Parent IP Analytics
- [ ] **Fix:** Empty pie → check `data` prop format: `[{ name: 'Safe', value: 70 }]`

#### SC-11-T4: TenantComparisonChart — Multi-Tenant Data
- [ ] Super admin dashboard → verify bar chart compares multiple tenants
- [ ] Each bar labelled with tenant name
- [ ] **Fix:** Single bar only → check `TenantComparisonChart` data mapping

#### SC-11-T5: Charts in Dark Mode
- [ ] Toggle dark → verify all chart backgrounds, text, grid lines are dark-styled
- [ ] No white backgrounds bleeding through in dark mode
- [ ] **Fix:** White chart area → check `chart-theme.ts` dark mode colors

#### SC-11-T6: Charts in AR Mode
- [ ] Switch to AR → verify month labels are in Arabic
- [ ] Chart tooltip text in Arabic
- [ ] **Fix:** English labels in AR → check `localizeMonthLabel(point.month, locale)` applied to ALL charts

#### SC-11-T7: Charts Responsive (Mobile)
- [ ] 375px viewport → verify charts scale down, don't overflow their containers
- [ ] X-axis labels still readable (or rotated/abbreviated)
- [ ] **Fix:** Chart overflow on mobile → check `ResponsiveContainer` width="100%"

---

### SC-12: ExportButtons (`components/shared/ExportButtons.tsx`)

**Used by:** Reports pages (manager, manager-parent, super-admin), Activity (manager)

#### SC-12-T1: CSV Export for Each Role
- [ ] Manager Reports → CSV export → file downloads
- [ ] Manager-Parent Financial Reports → CSV export → file downloads
- [ ] Super-Admin Reports → CSV export → file downloads
- [ ] Verify file contains correct data (not empty)
- [ ] **Fix:** Empty file → check server export endpoint returns data

#### SC-12-T2: Export Respects Active Date Filter
- [ ] Set a date range → export
- [ ] Open exported file → verify data matches the filtered range (not all data)
- [ ] **Fix:** Export ignores filters → check filter params forwarded to export endpoint

#### SC-12-T3: Export Loading State
- [ ] Click export → verify button shows loading state while generating
- [ ] **Fix:** No loading indicator → check `isPending` on export mutation

---

### SC-13: DateRangePicker (`components/ui/date-range-picker.tsx`)

**Used by:** Reports, Activity, Reseller Logs, Activations, BIOS History

#### SC-13-T1: Select Valid Range
- [ ] Click From → pick date → click To (after From) → range applied
- [ ] Verify table/chart updates with selected range
- [ ] **Fix:** Range not applied → check `onChange` callback + state update

#### SC-13-T2: Invalid Range Rejected
- [ ] Try setting To date BEFORE From date
- [ ] Verify it's blocked (To date can't be earlier than From)
- [ ] **Fix:** Invalid range accepted → check `minDate` on To picker

#### SC-13-T3: Clear Both Dates
- [ ] Set a range → click clear/reset → both dates empty
- [ ] Verify table shows all data again (unfiltered)
- [ ] **Fix:** Clear not resetting → check `setRange({ from: '', to: '' })` call

#### SC-13-T4: DateRangePicker in AR Mode
- [ ] In AR → calendar opens with RTL layout
- [ ] Days/months in Arabic labels
- [ ] **Fix:** Calendar not RTL → check `locale` prop on date picker calendar

---

### SC-14: SkeletonCard / SkeletonTable / SkeletonChart

**Used by:** Loading states across all dashboards

#### SC-14-T1: Skeletons Show on First Load
- [ ] Hard refresh (`F5`) on any data page
- [ ] Verify skeletons appear immediately before data loads
- [ ] Test: Dashboard (SkeletonCard), Customers (SkeletonTable), Reports (SkeletonChart)
- [ ] **Fix:** Blank during load → check `isLoading` conditional for each

#### SC-14-T2: Skeletons Animate
- [ ] Verify shimmer/pulse animation plays on skeleton elements
- [ ] **Fix:** Static skeletons → check `animate-pulse` Tailwind class

---

### SC-15: SkipToContent (`components/shared/SkipToContent.tsx`)

**Accessibility — Used by:** All page layouts

#### SC-15-T1: Skip Link Visible on Focus
- [ ] Press `Tab` immediately after page loads
- [ ] Verify "Skip to main content" link appears at top
- [ ] Press `Enter` → focus jumps to main content area
- [ ] **Fix:** Link not appearing → check `SkipToContent` in layout + `#main-content` id target

---

## PART 2 — Shared Pages Tests (Each Role)

> These pages are reused across multiple roles with different props.
> Test each combination explicitly.

---

### SP-1: ActivateLicensePage (`pages/shared/ActivateLicensePage.tsx`)

**Used by:** Reseller, Manager, Manager-Parent

#### SP-1-T1: Back Path is Role-Correct
| Role | Expected Back Path |
|------|--------------------|
| Reseller | `/en/reseller/software` |
| Manager | `/en/manager/software` |
| Manager-Parent | `/en/software-management` |

- [ ] On each role, after cancelling activation → verify navigates to correct path
- [ ] **Fix:** Wrong back path → check `defaultBackPath` prop passed from role-specific wrapper

#### SP-1-T2: Program Pre-Selection from Navigation State
- [ ] From Software catalog → click "Activate" on Program X
- [ ] Verify Program X is pre-selected in the form (not blank dropdown)
- [ ] Test for: reseller, manager, manager-parent
- [ ] **Fix:** Program not pre-selected → check `state.program` from `navigate()` call

#### SP-1-T3: Activation Creates Correct Customer Scope
- [ ] Reseller activates → customer belongs to that reseller
- [ ] Manager activates → customer belongs to that manager's scope
- [ ] Manager-parent activates → customer belongs to that tenant
- [ ] **Fix:** Wrong scope → check `tenant_id`/`reseller_id` in activation payload

---

### SP-2: RenewLicensePage (`pages/shared/RenewLicensePage.tsx`)

**Used by:** Reseller, Manager, Manager-Parent, Super-Admin

#### SP-2-T1: Cache Invalidation is Role-Correct
| Role | QueryKey Prefix | Cache Pattern |
|------|----------------|---------------|
| Reseller | `['reseller']` | `/^reseller:/` |
| Manager | `['manager']` | `/^manager:/` |
| Manager-Parent | `['manager-parent']` | `/^manager-parent:/` |
| Super-Admin | `['super-admin']` | `/^super-admin:/` |

- [ ] After renewing as each role → verify only that role's cache is cleared
- [ ] Verify other roles' caches are NOT affected (no unnecessary refetches)
- [ ] **Fix:** Wrong cache cleared → check `invalidateQueryKey` + `cachePattern` props

#### SP-2-T2: Back Path is Role-Correct
| Role | Expected Back Path |
|------|-------------------|
| Reseller | `/en/reseller/customers` |
| Manager | `/en/manager/customers` |
| Manager-Parent | `/en/customers` |
| Super-Admin | `/en/super-admin/customers` |

- [ ] After cancel → verify correct path per role
- [ ] **Fix:** Wrong path → check `defaultBackPath` prop per role wrapper

---

### SP-3: CustomerCreatePage (`pages/shared/CustomerCreatePage.tsx`)

**Used by:** Reseller, Manager, Manager-Parent, Super-Admin

#### SP-3-T1: Create Function is Role-Correct
| Role | Service Function |
|------|----------------|
| Reseller | `resellerService.createCustomer` |
| Manager | `managerService.createCustomer` |
| Manager-Parent | `managerParentService.createCustomer` |
| Super-Admin | `superAdminCustomerService.create` (with tenant selector) |

- [ ] As each role: create a customer → verify it appears in THAT role's customer list
- [ ] **Fix:** Customer not in correct scope → check `createCustomer` prop passed per role

#### SP-3-T2: Super-Admin Has Tenant Selector (Unique)
- [ ] Super-admin create page shows tenant dropdown
- [ ] Other roles do NOT show tenant dropdown
- [ ] **Fix:** Tenant dropdown missing for super-admin or incorrectly showing for other roles

---

### SP-4: RoleResellerPaymentsPage (`pages/shared/RoleResellerPaymentsPage.tsx`)

**Used by:** Manager, Manager-Parent

#### SP-4-T1: Data Scope is Role-Correct
- [ ] Manager sees only their own resellers' payments
- [ ] Manager-Parent sees ALL resellers across ALL their managers
- [ ] **Fix:** Wrong scope → check `fetchList` prop (manager vs managerParent service)

#### SP-4-T2: Detail Path is Role-Correct
| Role | Detail Path |
|------|-------------|
| Manager | `/en/manager/reseller-payments/:id` |
| Manager-Parent | `/en/reseller-payments/:id` |

- [ ] Click reseller → verify navigates to correct path per role
- [ ] **Fix:** Wrong detail path → check `detailPath` prop per wrapper

---

### SP-5: RoleResellerPaymentDetailPage (`pages/shared/RoleResellerPaymentDetailPage.tsx`)

**Used by:** Manager, Manager-Parent

#### SP-5-T1: API Functions are Role-Correct
| Role | Record Payment | Update Payment | Store Commission |
|------|---------------|----------------|-----------------|
| Manager | `managerService.recordPayment` | `managerService.updatePayment` | `managerService.storeCommission` |
| Manager-Parent | `managerParentService.recordPayment` | `managerParentService.updatePayment` | `managerParentService.storeCommission` |

- [ ] Record a payment as manager → verify it appears correctly
- [ ] Record a payment as manager-parent → verify correct scope
- [ ] **Fix:** Wrong service called → check props per role wrapper

---

## PART 3 — Backend Middleware Tests

> These test that backend security layers work correctly for every role.

---

### MW-1: RoleMiddleware (`app/Http/Middleware/RoleMiddleware.php`)

#### MW-1-T1: Super-Admin Routes Blocked for Other Roles
- [ ] Login as manager → call `GET /api/super-admin/tenants` directly (via DevTools/Fetch)
- [ ] Expect: `403 Forbidden` or `401 Unauthorized`
- [ ] Login as reseller → call `POST /api/super-admin/tenants/1/reset`
- [ ] Expect: `403`
- [ ] **Fix:** Wrong status code → check `RoleMiddleware` returns 403 for wrong role

#### MW-1-T2: Manager Routes Blocked for Resellers
- [ ] Login as reseller → call `GET /api/manager/team` → expect `403`
- [ ] **Fix:** Reseller accessing manager route → check `role:manager` middleware

#### MW-1-T3: Cross-Role API Access Matrix
Test every sensitive endpoint with a wrong-role token:
- [ ] `POST /api/licenses/activate` → allowed for: reseller, manager, manager_parent, super_admin; blocked for: customer
- [ ] `GET /api/bios-blacklist` → allowed for: super_admin, manager_parent, manager; blocked for: reseller, customer
- [ ] `DELETE /api/bios-blacklist/:id` → allowed for: super_admin, manager_parent; blocked for: manager, reseller
- [ ] `GET /api/bios-conflicts` → allowed for: super_admin, manager_parent, manager; blocked for: reseller
- [ ] `POST /api/balances/:user/adjust` → allowed for: super_admin, manager_parent; blocked for: manager, reseller
- [ ] **Fix per endpoint:** Check middleware declaration in `routes/api.php`

---

### MW-2: TenantScope (`app/Http/Middleware/TenantScope.php`)

#### MW-2-T1: Reseller Cannot See Another Tenant's Customers
- [ ] Login as Reseller in Tenant A
- [ ] Try to fetch a customer ID that belongs to Tenant B: `GET /api/reseller/customers/:tenantB_customer_id`
- [ ] Expect: `404` (not found, not visible)
- [ ] **Fix:** Wrong tenant data returned → check `TenantScope` filters all queries by `tenant_id`

#### MW-2-T2: Manager Cannot See Another Tenant's Data
- [ ] Login as Manager in Tenant A
- [ ] Try to access Tenant B's customer/license/program → expect `404`
- [ ] **Fix:** TenantScope not applied to manager routes

#### MW-2-T3: Super Admin Bypasses TenantScope
- [ ] Login as super-admin
- [ ] Access a customer from Tenant A, then one from Tenant B in the same session
- [ ] Both return data (super-admin bypasses tenant isolation)
- [ ] **Fix:** Super admin getting 404 → check TenantScope has exception for `super_admin` role

---

### MW-3: ActiveRoleMiddleware (`app/Http/Middleware/ActiveRoleMiddleware.php`)

#### MW-3-T1: Suspended User Cannot Login
- [ ] Suspend a reseller via manager panel
- [ ] Reseller tries to login → expect: `401` with "account suspended" error
- [ ] **Fix:** Suspended user allowed in → check `ActiveRoleMiddleware` checks `status` field

#### MW-3-T2: Suspended Tenant Blocks All Users
- [ ] Super admin deactivates Tenant A
- [ ] Manager-parent of Tenant A tries to login → blocked
- [ ] Reseller of Tenant A tries to login → blocked
- [ ] Customer of Tenant A tries to login → blocked
- [ ] Super admin reactivates → all can login
- [ ] **Fix:** Tenant deactivation not blocking → check `ActiveRoleMiddleware` checks tenant status

#### MW-3-T3: Session Invalidated After Suspension
- [ ] Log in as reseller R
- [ ] In another tab, manager suspends R while R is still logged in
- [ ] R makes an API call → expect `401` (session invalidated)
- [ ] **Fix:** Active session not invalidated → check middleware checks status on EVERY request

---

### MW-4: BiosBlacklistCheck (`app/Http/Middleware/BiosBlacklistCheck.php`)

#### MW-4-T1: Blacklisted BIOS Blocks Activation
- [ ] Add BIOS `BLOCKED-TEST-001` to blacklist
- [ ] Try to activate a license with this BIOS ID
- [ ] Expect: `422` with error message "BIOS ID is blacklisted"
- [ ] **Fix:** Activation succeeds with blacklisted BIOS → check `BiosBlacklistCheck` applied to `POST /licenses/activate`

#### MW-4-T2: Error Message Is Clear
- [ ] Verify the 422 response body has a human-readable message (not just a raw DB error)
- [ ] Verify this message is displayed to the user in the frontend
- [ ] **Fix:** Raw error showing → check frontend `resolveApiErrorMessage()` + backend validation message

#### MW-4-T3: Non-Blacklisted BIOS Activates Normally
- [ ] Ensure `CLEAN-BIOS-001` is not in blacklist → activate → succeeds
- [ ] **Fix:** False positive blocking → check blacklist query logic

---

### MW-5: ApiLogger (`app/Http/Middleware/ApiLogger.php`)

#### MW-5-T1: All API Calls Logged
- [ ] Perform: 1 GET, 1 POST, 1 PUT, 1 DELETE request
- [ ] Open Super Admin → Logs page
- [ ] Verify all 4 requests appear with: method, endpoint, status code, duration, user, tenant
- [ ] **Fix:** Missing logs → check `ApiLogger` applied globally to API routes

#### MW-5-T2: Sensitive Data Not Logged
- [ ] Perform a login POST with password
- [ ] Open Logs → verify password field is NOT visible in request body log
- [ ] **Fix:** Password exposed in logs → check `ApiLogger` masks `password`, `token`, `api_key` fields

#### MW-5-T3: 500 Errors Logged with Detail
- [ ] Trigger a 500 error (intentionally break something temporarily)
- [ ] Check Logs page → verify 500 entry appears with endpoint and timestamp
- [ ] **Fix:** 500 not logged → check `ApiLogger` logs all status codes including 5xx

---

### MW-6: IpTracker (`app/Http/Middleware/IpTracker.php`)

#### MW-6-T1: IP Logged on Login
- [ ] Login from a specific IP
- [ ] Super Admin → IP Analytics or User Detail → verify the login IP is recorded
- [ ] **Fix:** IP not tracked → check `IpTracker` fires on authenticated requests

#### MW-6-T2: Proxy Detection
- [ ] If proxy detection is configured, verify proxy IPs are flagged in IP Analytics
- [ ] **Fix:** Not detecting proxy → check proxy detection library/API integration

---

### MW-7: ProcessDueScheduledLicenses (`app/Http/Middleware/ProcessDueScheduledLicenses.php`)

#### MW-7-T1: Scheduled Licenses Activate on First Request After Due
- [ ] Create a license scheduled for 2 minutes in the future
- [ ] Wait for the scheduled time to pass
- [ ] Make any API request to the system
- [ ] Verify the scheduled license is now `active` (not still `scheduled`)
- [ ] **Fix:** License not activating → check `ProcessDueScheduledLicenses` runs and processes due licenses

#### MW-7-T2: Status Updates Reflected on Frontend
- [ ] With live query enabled (15s interval), wait for scheduled license to activate
- [ ] Verify status badge changes from `scheduled` → `active` without page refresh
- [ ] **Fix:** UI not updating → check live query interval is running while tab is active

---

### MW-8: ApiSecurityHeaders (`app/Http/Middleware/ApiSecurityHeaders.php`)

#### MW-8-T1: Security Headers Present on All Responses
Using DevTools → Network → check response headers for any API call:
- [ ] `X-Content-Type-Options: nosniff` present
- [ ] `X-Frame-Options: SAMEORIGIN` or `DENY` present
- [ ] `X-XSS-Protection: 1; mode=block` present (or CSP equivalent)
- [ ] No `Server: Apache/nginx` version disclosure
- [ ] **Fix:** Missing headers → check `ApiSecurityHeaders` middleware applied globally

---

## PART 4 — Cross-Role Interaction Matrix

> Every action from one role that must visibly affect another role.
> Run these as end-to-end flows using multiple browser tabs/incognito windows.

---

### CRI-1: Program Lifecycle (Manager-Parent → Manager → Reseller)

```
STEP 1: manager-parent CREATES new program "Test Pro v1"
STEP 2: manager logs in → Software Catalog → "Test Pro v1" visible ✓
STEP 3: reseller logs in → Software Catalog → "Test Pro v1" visible ✓
STEP 4: manager-parent DEACTIVATES "Test Pro v1"
STEP 5: manager refreshes catalog → "Test Pro v1" gone ✓
STEP 6: reseller refreshes catalog → "Test Pro v1" gone ✓
STEP 7: manager-parent REACTIVATES "Test Pro v1"
STEP 8: manager + reseller → both see it again ✓
```
- [ ] Execute all 8 steps
- [ ] **Fix:** Cross-role catalog not syncing → check program `status` filter in `GET /programs`

---

### CRI-2: BIOS Blacklist (Manager-Parent → Reseller)

```
STEP 1: manager-parent adds "CROSS-BLOCK-001" to blacklist
STEP 2: reseller tries to activate "CROSS-BLOCK-001" → blocked with error ✓
STEP 3: manager tries to activate "CROSS-BLOCK-001" → also blocked ✓
STEP 4: manager-parent removes "CROSS-BLOCK-001"
STEP 5: reseller retries → activation succeeds ✓
STEP 6: manager retries → activation succeeds ✓
```
- [ ] Execute all 6 steps
- [ ] **Fix:** Blacklist not blocking manager → check `BiosBlacklistCheck` applied to all activator roles

---

### CRI-3: BIOS Change Request Cycle (Reseller → Manager-Parent → Reseller)

```
STEP 1: reseller submits BIOS change request (old: A → new: B) for customer X
STEP 2: manager sees request (if manager-level approval is required) ✓
STEP 3: manager-parent sees request in "Pending" list ✓
STEP 4: manager-parent APPROVES request
STEP 5: reseller views customer X → BIOS shows: B ✓
STEP 6: manager views customer X → BIOS shows: B ✓
STEP 7: super admin views BIOS History → shows the change event ✓
```
- [ ] Execute all 7 steps
- [ ] **Fix:** BIOS not updated after approval → check `approveBiosChangeRequest` backend logic

---

### CRI-4: User Suspension (Manager → Reseller, and Super Admin → Any)

```
STEP A — Manager suspends reseller R:
STEP A1: manager suspends reseller R
STEP A2: reseller R tries to login → blocked ✓
STEP A3: reseller R's existing session makes API call → 401 ✓
STEP A4: manager unsuspends R → R can login again ✓

STEP B — Super admin suspends manager M:
STEP B1: super admin suspends manager M
STEP B2: M tries to login → blocked ✓
STEP B3: all resellers under M → unaffected (still can login) ✓
STEP B4: super admin unsuspends M → M can login ✓
```
- [ ] Execute Steps A + B
- [ ] **Fix:** Suspension not enforced → check `ActiveRoleMiddleware` + session invalidation

---

### CRI-5: Tenant Reset + Restore (Super Admin → All Roles of That Tenant)

```
INITIAL STATE: Tenant A has 10 customers, 5 resellers, 8 licenses

RESET PHASE:
STEP 1: super admin resets Tenant A (with backup label "before-reset")
STEP 2: super admin → Tenant A row → customers=0, licenses=0 ✓
STEP 3: manager-parent of Tenant A logs in → 0 customers ✓
STEP 4: manager of Tenant A logs in → 0 customers ✓
STEP 5: reseller of Tenant A logs in → 0 customers ✓
STEP 6: backup "before-reset" appears in backup list ✓

RESTORE PHASE:
STEP 7: super admin restores Tenant A from "before-reset"
STEP 8: super admin → Tenant A row → customers=10, licenses=8 ✓
STEP 9: manager-parent logs in → sees 10 customers ✓
STEP 10: reseller logs in → sees their original customers ✓
STEP 11: a customer's license is active (status=active) ✓
STEP 12: reseller can activate a license for a restored customer ✓
```
- [ ] Execute all 12 steps
- [ ] **Fix:** Any step broken → check `TenantResetController::reset` + `::restore`

---

### CRI-6: Commission Setting (Manager/Manager-Parent → Reseller)

```
STEP 1: manager sets reseller R commission = 20% for program P
STEP 2: reseller R activates a license for program P (price $100)
STEP 3: manager views reseller-payments/:R_id → commission shows $20 ✓
STEP 4: reseller R views Payment Status → sees commission $20 ✓
STEP 5: manager changes commission to 15%
STEP 6: reseller activates another license ($100) → commission = $15 ✓
```
- [ ] Execute all 6 steps
- [ ] **Fix:** Wrong commission → check `ResellerCommission` model + payment calculation

---

### CRI-7: Payment Recording (Manager → Reseller Payment Status)

```
STEP 1: manager records payment of $50 for reseller R
STEP 2: manager views reseller-payments/:R_id → "Total Paid" increases by $50 ✓
STEP 3: reseller R views Payment Status page:
  - "Amount You Paid to Manager" increases by $50 ✓
  - "Still Not Paid" decreases by $50 ✓
```
- [ ] Execute all 3 steps
- [ ] **Fix:** Reseller Payment Status not updating → check `resellerService.getPaymentStatus()` API reflects new payment

---

### CRI-8: Settings Trial Days (Manager-Parent → Reseller Activation)

```
STEP 1: manager-parent sets trial_days = 3 in Settings
STEP 2: reseller activates a "trial" license for customer C
STEP 3: customer C's license expiry = today + 3 days ✓
STEP 4: manager-parent changes trial_days = 7
STEP 5: reseller activates another trial → expiry = today + 7 days ✓
```
- [ ] Execute all 5 steps
- [ ] **Fix:** Trial days not applied → check `SettingsController` + license creation logic

---

### CRI-9: Server Timezone (Super Admin → All Roles)

```
STEP 1: super admin changes Server Timezone to "Asia/Dubai"
STEP 2: super admin → navbar shows "Server Timezone: Asia/Dubai" ✓
STEP 3: manager-parent logs in → same timezone label shown ✓
STEP 4: manager logs in → same ✓
STEP 5: reseller logs in → same ✓
STEP 6: super admin changes back to UTC
STEP 7: all roles show "Server Timezone: UTC" ✓
```
- [ ] Execute all 7 steps
- [ ] **Fix:** Timezone not syncing to other roles → check how frontend reads server timezone

---

### CRI-10: License Renew Cross-Role Visibility

```
STEP 1: customer C has an EXPIRED license
STEP 2: manager renews it
STEP 3: reseller assigned to C opens their customer list → C now shows ACTIVE ✓
STEP 4: manager-parent opens customers → C shows ACTIVE ✓
STEP 5: super admin opens customers → C shows ACTIVE ✓
```
- [ ] Execute all 5 steps
- [ ] **Fix:** Other roles seeing stale status → check live query refetch + cache invalidation scope

---

### CRI-11: Admin Creation (Super Admin → New Role Verification)

```
For each role: super_admin, manager_parent, manager, reseller:
STEP 1: super admin creates a new user with that role
STEP 2: new user logs in
STEP 3: verify they land on the CORRECT dashboard for their role
STEP 4: verify they see correct data (correct tenant scope)
```
- [ ] Execute for all 4 roles
- [ ] **Fix per role:** Wrong dashboard → check `AuthController` post-login redirect + role-dashboard mapping

---

### CRI-12: Tenant Deactivation (Super Admin → All Tenant Users)

```
STEP 1: super admin deactivates Tenant B
STEP 2: manager-parent of Tenant B → login → blocked ✓
STEP 3: manager of Tenant B → login → blocked ✓
STEP 4: reseller of Tenant B → login → blocked ✓
STEP 5: super admin (different tenant) → unaffected ✓
STEP 6: super admin reactivates Tenant B → all users can login ✓
```
- [ ] Execute all 6 steps
- [ ] **Fix:** Deactivation not blocking → check `ActiveRoleMiddleware` checks tenant status

---

## PART 5 — Security Testing

---

### SEC-1: Authentication Security

#### SEC-1-T1: Brute Force Protection
- [ ] Attempt login with wrong password 5+ times for same account
- [ ] Verify account lockout triggers (security lock appears in super-admin Security Locks)
- [ ] Verify clear error message to user: "Account locked"
- [ ] **Fix:** No lockout → check `RateLimiter` on login endpoint or lockout logic

#### SEC-1-T2: Rate Limiting on Login Endpoint
- [ ] Send 20 rapid login requests → expect `429 Too Many Requests` after threshold
- [ ] **Fix:** No rate limit → check Laravel `throttle:6,1` middleware on login route

#### SEC-1-T3: Token Security
- [ ] After logout, try to use the old Bearer token in an API call
- [ ] Expect: `401 Unauthorized` (token invalidated)
- [ ] **Fix:** Old token still works → check Sanctum token deletion on logout

#### SEC-1-T4: CSRF Protection
- [ ] From a different origin, try a POST request to `/api/licenses/activate`
- [ ] Expect: `419` (CSRF) or `403` (blocked by CORS)
- [ ] **Fix:** Cross-origin POST allowed → check CORS config in `config/cors.php`

---

### SEC-2: Input Validation & Injection Prevention

#### SEC-2-T1: SQL Injection — Search Fields
- [ ] In Customer search, enter: `'; DROP TABLE users; --`
- [ ] Expect: no error, no data leak, returns empty results
- [ ] **Fix:** SQL error returned → check all search params use Eloquent bindings (not raw queries)

#### SEC-2-T2: XSS — Text Input Fields
- [ ] In customer name field, enter: `<script>alert('xss')</script>`
- [ ] Save → verify no alert fires when the name is rendered in tables
- [ ] **Fix:** XSS executes → check output escaping in React (`{}` auto-escapes) + backend sanitization

#### SEC-2-T3: BIOS ID Special Characters
- [ ] Enter BIOS ID with: `/`, `\`, `"`, `'`, `%`, `#`
- [ ] Verify:
  - URL encoding correct in navigation links
  - No 500 error on lookup
  - Displayed safely in UI
- [ ] **Fix:** URL broken → check `encodeURIComponent()` in `routePaths.*.biosDetail()` builders

#### SEC-2-T4: API Key Exposure
- [ ] Check that External API Key fields are: masked in UI (input type=password), not in API list responses, not in browser console logs
- [ ] **Fix:** API key visible in response → check `$hidden` on Program model or response transformer

#### SEC-2-T5: No Stack Traces in Production Responses
- [ ] Trigger a 500 error intentionally
- [ ] Check the API JSON response body
- [ ] Verify NO PHP stack trace, file paths, or line numbers in response
- [ ] **Fix:** Stack trace leaking → set `APP_DEBUG=false` in `.env.production`

---

### SEC-3: Authorization Bypass Attempts

#### SEC-3-T1: IDOR — Access Another User's Data
- [ ] Login as Reseller R1 (in Tenant A)
- [ ] Note a customer ID that belongs to Reseller R2 (in same tenant)
- [ ] Call `GET /api/reseller/customers/:R2_customer_id` → expect `403` or `404`
- [ ] **Fix:** R1 seeing R2's customer → check reseller scope in customer query

#### SEC-3-T2: IDOR — Cross-Tenant Customer Access
- [ ] Login as Reseller in Tenant A
- [ ] Try to access a customer ID from Tenant B
- [ ] Expect: `404` (tenant scoped, not visible)
- [ ] **Fix:** Cross-tenant data leak → check `TenantScope` middleware

#### SEC-3-T3: Privilege Escalation Attempt
- [ ] Login as manager → try to call `POST /api/super-admin/tenants/1/reset`
- [ ] Expect: `403 Forbidden`
- [ ] **Fix:** Wrong role accessing reset → check `role:super_admin` on route

---

## PART 6 — Performance Testing

---

### PERF-1: Page Load Times

#### PERF-1-T1: Initial Dashboard Load < 2 seconds
- [ ] Open DevTools → Network tab → hard refresh each dashboard
- [ ] Measure Time to Interactive (TTI)
- [ ] Target: < 2 seconds on fast connection, < 5s on 3G
- [ ] **Fix:** Slow load → check bundle size (Vite build analysis), lazy loading of routes

#### PERF-1-T2: Table Render with 100+ Rows
- [ ] With 100+ customers/logs, open the list page
- [ ] Measure: time from navigation to table rendered
- [ ] Target: < 1 second render after data received
- [ ] **Fix:** Slow table render → check if virtual scrolling needed; optimize column renders

#### PERF-1-T3: Chart Render
- [ ] Open any reports page with charts
- [ ] Charts should render within 500ms of data arriving
- [ ] **Fix:** Slow charts → check if chart libraries are lazy-loaded

---

### PERF-2: API Response Times

#### PERF-2-T1: Dashboard Stats < 500ms
- [ ] Open Network tab → check `GET .../dashboard` response time
- [ ] Target: < 500ms
- [ ] **Fix:** Slow dashboard API → check N+1 queries, add DB indexes

#### PERF-2-T2: Customer List < 800ms
- [ ] Check `GET .../customers` response time
- [ ] Target: < 800ms for first page of 10
- [ ] **Fix:** Slow customers API → check eager loading of relations

#### PERF-2-T3: No N+1 Query Issues
- [ ] Enable Laravel query logging in development
- [ ] Load customers page with 20 rows
- [ ] Verify total DB queries < 10 (not 20+ indicating N+1)
- [ ] **Fix:** N+1 queries → add `->with(['relation'])` eager loading

---

### PERF-3: Frontend Bundle Size

#### PERF-3-T1: Production Build Size
```bash
cd frontend && npm run build
```
- [ ] Check `dist/assets` — main JS bundle should be < 1MB gzipped
- [ ] Check no large unused libraries included
- [ ] **Fix:** Large bundle → run `npx vite-bundle-visualizer` to find large dependencies

#### PERF-3-T2: Lazy Loading of Routes
- [ ] Open Network tab → navigate between different role dashboards
- [ ] Verify route chunks are loaded on demand (not all upfront)
- [ ] **Fix:** All routes loaded at once → check `React.lazy()` + `Suspense` on route definitions

---

## PART 7 — Production Readiness Checklist

---

### PROD-1: Environment Configuration

- [ ] `APP_ENV=production` in `.env`
- [ ] `APP_DEBUG=false` in `.env` (no stack traces to users)
- [ ] `APP_URL` set to correct production domain
- [ ] `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` set for production DB
- [ ] `SANCTUM_STATEFUL_DOMAINS` includes production domain
- [ ] `SESSION_DOMAIN` set to production domain
- [ ] `SESSION_SECURE_COOKIE=true` (HTTPS only)
- [ ] `SESSION_SAME_SITE=strict`
- [ ] Mail settings configured (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, etc.)
- [ ] Frontend `VITE_API_URL` points to production API
- [ ] No `.env` file committed to git

---

### PROD-2: HTTPS & SSL

- [ ] All traffic redirected from HTTP → HTTPS (301 redirect)
- [ ] SSL certificate valid and not expiring within 30 days
- [ ] HSTS header present: `Strict-Transport-Security: max-age=31536000`
- [ ] Verify: `https://yourdomain.com` loads without mixed content warnings
- [ ] **Fix:** Mixed content → find any hardcoded `http://` URLs in frontend

---

### PROD-3: Frontend Build

```bash
cd frontend
npm run build
```
- [ ] Build completes without TypeScript errors
- [ ] Build completes without warnings about missing env vars
- [ ] `dist/` folder generated
- [ ] All routes work when served from `dist/` (SPA routing works)
- [ ] Verify `index.html` exists and loads the app
- [ ] **Fix:** TS errors on build → run `npx tsc --noEmit` to see errors

---

### PROD-4: Backend Optimizations

```bash
cd backend
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan optimize
```
- [ ] All commands complete without errors
- [ ] App responds correctly after caching
- [ ] **Fix:** Route cache breaking routes → check for closures in routes (not cacheable)

---

### PROD-5: Database

- [ ] All migrations run on production: `php artisan migrate --force`
- [ ] `tenant_backups` table exists (newly added migration)
- [ ] No migration errors or missing tables
- [ ] DB indexes on frequently-queried columns:
  - `users.tenant_id`, `users.role`, `users.status`
  - `licenses.tenant_id`, `licenses.status`, `licenses.customer_id`
  - `api_logs.created_at`, `api_logs.tenant_id`
  - `tenant_backups.tenant_id`
- [ ] DB backups configured and running daily
- [ ] **Fix:** Missing migration → run `php artisan migrate:status` to check

---

### PROD-6: File Permissions & Storage

```bash
cd backend
php artisan storage:link
chmod -R 775 storage/ bootstrap/cache/
```
- [ ] `storage/app/public` symlinked to `public/storage`
- [ ] `storage/` and `bootstrap/cache/` are writable by web server
- [ ] Laravel log file exists and is writable: `storage/logs/laravel.log`
- [ ] **Fix:** Permission denied errors → set correct ownership for web server user

---

### PROD-7: Error Monitoring & Logging

- [ ] Laravel logs rotating (not growing unbounded): `LOG_CHANNEL=daily` in `.env`
- [ ] Consider: Sentry or Bugsnag integration for production error tracking
- [ ] 500 errors trigger notification (email/Slack/webhook)
- [ ] Log level set appropriately: `LOG_LEVEL=error` in production
- [ ] Verify: a test 500 error logs to `storage/logs/laravel.log`

---

### PROD-8: Scheduled Tasks (if any)

```bash
# Verify Laravel scheduler runs
php artisan schedule:run
```
- [ ] Cron job configured: `* * * * * php /path/to/artisan schedule:run >> /dev/null 2>&1`
- [ ] Scheduled license processing fires correctly
- [ ] **Fix:** Scheduler not running → check cron entry on server

---

### PROD-9: Rate Limiting & DDoS Protection

- [ ] Login endpoint rate limited (max 6 attempts/minute per IP)
- [ ] API endpoints rate limited (max X requests/minute per token)
- [ ] Cloudflare or similar WAF in front of production (recommended)
- [ ] Large payload rejection (`ValidatePostSize` middleware active)
- [ ] **Fix:** No rate limits → check `throttle:` middleware in `routes/api.php`

---

### PROD-10: Backup & Disaster Recovery

- [ ] Database: automated daily backup to off-site storage (S3, etc.)
- [ ] Tenant backup/restore feature works on production DB (verify after deploy)
- [ ] Recovery plan documented: how long to restore from backup
- [ ] Test: restore a tenant backup on production → verify data correct

---

### PROD-11: Final Smoke Test on Production

After deploying to production, run this checklist:

- [ ] `https://yourdomain.com/en/login` loads login page
- [ ] Login as super admin → lands on super-admin dashboard
- [ ] Login as manager-parent → lands on manager-parent dashboard
- [ ] Login as manager → lands on manager dashboard
- [ ] Login as reseller → lands on reseller dashboard
- [ ] Create a test customer via reseller → appears in list
- [ ] Activate a license → status active
- [ ] Renew a license → status active
- [ ] Super admin → Tenants page → tenant list loads
- [ ] Language switch EN → AR → works
- [ ] Dark mode toggle → works
- [ ] Logout → redirected to login
- [ ] All pages load without console 500 errors
- [ ] No `APP_DEBUG` stack traces visible in API responses

---

## PART 8 — Regression Test Checklist

> Run after every deployment to catch regressions in previously fixed bugs.

| # | Previously Fixed Bug | Regression Test |
|---|---------------------|----------------|
| 1 | Sticky table headers broken | Scroll table → header stays fixed |
| 2 | Filter state persists after sidebar navigation | Click sidebar → all filters reset |
| 3 | Manager filter missing from query key | Change manager filter → table refetches |
| 4 | Tenant backup datetime format error on restore | Restore a backup → no 500 error |
| 5 | `tenant_backups` table missing | Trigger reset → no "table doesn't exist" error |
| 6 | `password` field missing in user restore | Restore backup with users → no "Field 'password'" error |
| 7 | Settings `primary_color` missing default | Open Settings page → no TypeScript error |
| 8 | `setUser` not exported from auth context | Profile save → name updates in navbar |

---

## Test Execution Order (Recommended)

```
Phase 1 — Individual Role Plans (parallel if possible):
  ├── reseller-dashboard-testing-plan.md
  ├── manager-dashboard-testing-plan.md
  ├── manager-parent-dashboard-testing-plan.md
  └── super-admin-dashboard-testing-plan.md

Phase 2 — Shared Components (this plan, Parts 1-2)
  ├── SC-1 through SC-15 (shared components)
  └── SP-1 through SP-5 (shared pages per-role)

Phase 3 — Middleware & Backend (this plan, Part 3)
  └── MW-1 through MW-8

Phase 4 — Cross-Role Flows (this plan, Part 4)
  └── CRI-1 through CRI-12 (run in order — each depends on previous)

Phase 5 — Security (this plan, Part 5)
  └── SEC-1 through SEC-3

Phase 6 — Performance (this plan, Part 6)
  └── PERF-1 through PERF-3

Phase 7 — Production Deploy (this plan, Parts 7-8)
  ├── PROD-1 through PROD-11
  └── Regression checklist
```

---

## Issue Tracker (Master)

| # | Plan | Sprint | Issue | Severity | Status | Fix |
|---|------|--------|-------|----------|--------|-----|
| 1 | Master | Session 1 / SC-1 | Shared DataTable third click does not clear sort state; sort toggles asc/desc but never returns to unsorted state on the super-admin tenants table. | High | Open | Inspect shared table sort-state cycle and clear-on-third-click behavior. |
| 2 | Master | Session 1 / SC-1 | Shared DataTable empty-state fallback was previously broken on the super-admin tenants table; current regression retest now renders `EmptyState` correctly on 0-result filtering. | High | Verified fixed | Keep the tenants-table 0-result filter in the post-deploy regression pack to ensure the shared table stays on the `EmptyState` branch. |
| 3 | Master | Session 1 / SC-2 | Shared status translation leaked raw key `common.inactive` on the super-admin tenants page. | Medium | Fixed locally | Added shared inactive status translation coverage in `StatusBadge`, shared status meanings, and `en`/`ar` locale keys. |
| 4 | Master | Session 1 / SP-1 to SP-5 | Shared page coverage is partially complete: activate, renew, customer create, and reseller payments were validated on live routes, but deeper mutation/invalidation checks still remain for later master sessions. | Low | Open | Continue Session 1 follow-up pass after the first documentation checkpoint. |
| 5 | Master | Session 2 / MW-5 | `ApiLogger` was only applied to external proxy routes, so general API calls and login requests were missing from the Logs pages. | High | Fixed locally | Applied `api.logger` to `POST /api/auth/login` and the main authenticated API group, and added sensitive-field redaction in the middleware. |
| 6 | Master | Session 2 / CRI-1 | Inactive programs remained visible to manager and reseller catalogs through the shared `/api/programs` endpoint. | High | Fixed locally | Restricted manager/reseller program listing and direct program reads to `status=active` in the shared program controller. |
| 7 | Master | Session 3 / SEC-1 | Unauthenticated API requests could explode into `Route [login] not defined` instead of returning a clean `401`, because the framework guest redirect still assumed a web login route. | High | Fixed locally | Added API-aware guest redirect handling and forced JSON exception rendering for `/api/*` in `bootstrap/app.php`. |
| 8 | Master | Session 3 / PERF-2 | Manager dashboard API is borderline against the `< 500ms` target on uncached hits; sampled responses ranged from `451.89ms` to `578.32ms` with a `~499ms` average. | Medium | Open | Review aggregate queries and cache warm-up in `Manager\DashboardController`; customers API is comfortably within budget. |
| 9 | Master | Session 5 / ACT-6 | Activation with URL-unsafe BIOS values containing `/` and `:` is not safe end to end; the external activation path surfaced an external `404 Not Found` response instead of a supported activation or controlled local validation error. | High | Open | Audit the activation contract for BIOS values with reserved characters and verify the upstream external endpoint/username-path handling remains safe for encoded BIOS identifiers. |
| 10 | Master | Session 5 / ACT-7 | `program_id=99999` on `POST /api/licenses/activate` returns a model `404`/exception response instead of a clean validation-style `422`, and in local debug mode it exposes a full stack trace. | Medium | Open | Replace `findOrFail()` on activation program lookup with a tenant/role-aware validated lookup that returns a clean business validation error. |
| 11 | Master | Session 5 / ACT-4 | Scheduled activations currently persist with `status=pending`; the written activation API plan still expects `status=scheduled`. | Low | Open | Decide whether to normalize the implementation to `scheduled` or update the written master plan to the actual lifecycle wording. |

**Severity:**
- 🔴 Critical — security breach, data loss, system outage
- 🟠 High — feature broken, cross-role flow broken
- 🟡 Medium — visual/UX issue, non-blocking
- 🟢 Low — cosmetic

---

---

## PART 9 — Software Activation API: Full Data Flow Tests

> The activation API (`POST /licenses/activate`) is the most critical shared endpoint.
> It is called by reseller, manager, manager-parent, and super-admin.
> This section tests every field, every mode, every role, every edge case, and the
> complete data flow from the frontend form → API → database → visible in all dashboards.

---

### ACT-PAYLOAD: Activation Payload Fields (Full Reference)

```typescript
// ActivateLicenseData — every field tested below
{
  customer_name: string          // required — customer display name
  client_name?: string           // optional — internal reference name
  customer_email?: string        // optional
  customer_phone?: string        // optional
  bios_id: string                // required — unique hardware ID
  program_id: number             // required — must exist in tenant
  preset_id?: number             // optional — use a pre-defined duration preset
  duration_days?: number         // required if no preset_id (except reseller can omit)
  price?: number                 // optional — override program base price
  is_scheduled?: boolean         // optional — if true, schedule for future
  scheduled_date_time?: string   // required if is_scheduled=true (ISO date)
  scheduled_timezone?: string    // optional — IANA timezone string
}
```

---

### ACT-1: Activation — All Roles Can Activate

**Endpoint:** `POST /api/licenses/activate`
**Allowed roles:** `reseller`, `manager`, `manager_parent`, `super_admin`

#### ACT-1-T1: Reseller Activates — Immediate (Duration Mode)
- [ ] Login as reseller → Software catalog → pick program → Activate form
- [ ] Fill: `customer_name`, `bios_id`, `program_id`, `duration_days=30`
- [ ] Submit → HTTP 201 response
- [ ] Response contains: `data.bios_id`, `data.status="active"`, `data.duration_days=30`
- [ ] Customer appears in reseller's customer list
- [ ] **Fix:** 422 → check `duration_days` is a number not a string; `bios_id` not empty

#### ACT-1-T2: Manager Activates — Immediate
- [ ] Login as manager → same form flow
- [ ] Customer appears in manager's customer list AND in reseller's list (if reseller assigned)
- [ ] **Fix:** Customer missing from manager list → check `TenantScope` query scope

#### ACT-1-T3: Manager-Parent Activates — Immediate
- [ ] Customer appears in manager-parent's customer list
- [ ] Also visible to the manager and reseller under that manager-parent
- [ ] **Fix:** Cross-scope visibility not working → check `tenant_id` in activation payload

#### ACT-1-T4: Super-Admin Activates — Cross-Tenant
- [ ] Super-admin selects Tenant A and activates for a reseller in Tenant A
- [ ] Customer appears in super-admin customers list with correct tenant label
- [ ] Log in as that reseller → customer appears in their list too
- [ ] **Fix:** Customer not in correct tenant → check `tenant_id` resolved from reseller in payload

---

### ACT-2: Activation — End Date Mode

#### ACT-2-T1: Future End Date → Correct Duration Calculated
- [ ] Switch to "End Date" mode → set date 30 days from now
- [ ] Submit → verify `duration_days` in response ≈ 30
- [ ] Verify license expiry date matches the selected end date (±1 hour for timezone)
- [ ] **Fix:** Wrong expiry date → check `end_date` to `duration_days` conversion on backend

#### ACT-2-T2: Past End Date → Rejected
- [ ] Set end date to yesterday → submit
- [ ] Expect: validation error "end date must be in the future"
- [ ] **Fix:** Past date accepted → check backend date validation rule

#### ACT-2-T3: End Date With Timezone
- [ ] Set end date with timezone = `America/New_York`
- [ ] Verify expiry stored in UTC correctly (e.g., `2026-03-15 05:00:00 UTC` for midnight NY)
- [ ] **Fix:** Timezone not converted → check `Carbon::parse($date, $tz)->utc()` on backend

---

### ACT-3: Activation — Preset Mode

#### ACT-3-T1: Select a Preset → Duration Auto-Fills
- [ ] Open activation form for a program that has presets
- [ ] Select a preset (e.g., "30 Days - $25")
- [ ] Verify `duration_days` and `price` fields auto-fill from preset
- [ ] Submit → verify `preset_id` sent in payload
- [ ] **Fix:** Preset not populating fields → check `ProgramPresetEditor` + form state update on preset select

#### ACT-3-T2: Preset ID Validated Against Program
- [ ] Manually send `preset_id` belonging to a DIFFERENT program
- [ ] Expect: 422 validation error
- [ ] **Fix:** Wrong preset accepted → check backend rule:
  `Rule::exists('program_duration_presets', 'id')->where('program_id', $request->program_id)`

#### ACT-3-T3: Preset Appears on All Roles' Activation Forms
- [ ] Add presets to a program as manager-parent
- [ ] Login as manager → activate that program → verify presets appear in dropdown
- [ ] Login as reseller → same → presets appear
- [ ] **Fix:** Presets not showing for lower roles → check `GET /programs/:id` returns presets for all roles

---

### ACT-4: Activation — Scheduled Mode (Relative Offset)

#### ACT-4-T1: Relative — Hours Offset
- [ ] Enable schedule → choose "Relative" → set 2 hours
- [ ] Submit → response: `data.status="scheduled"`, `data.is_scheduled=true`
- [ ] `data.scheduled_at` = now + 2 hours (verify approximately)
- [ ] **Fix:** Status not `scheduled` → check `is_scheduled=true` + `scheduled_date_time` set

#### ACT-4-T2: Relative — Days Offset
- [ ] Set 3 days offset → submit → `scheduled_at` ≈ now + 3 days
- [ ] Customer appears in table with `scheduled` badge
- [ ] **Fix:** Wrong `scheduled_at` → check offset calculation: `now()->addDays(3)`

#### ACT-4-T3: Scheduled Activates When Due (Middleware Trigger)
- [ ] Create scheduled license for 1 minute in the future
- [ ] Wait 1 minute → make any API request to system (triggers `ProcessDueScheduledLicenses`)
- [ ] Verify license status changes: `scheduled` → `active`
- [ ] Verify reseller's customer list shows `active` (live query or refresh)
- [ ] **Fix:** Not activating → check `ProcessDueScheduledLicenses` middleware processes past-due licenses

---

### ACT-5: Activation — Scheduled Mode (Custom Date + Timezone)

#### ACT-5-T1: Custom Date in UTC
- [ ] Enable schedule → Custom → set date `2026-04-01 12:00:00` timezone `UTC`
- [ ] Submit → verify `scheduled_at = 2026-04-01T12:00:00Z` in response
- [ ] **Fix:** Wrong storage → check timezone conversion to UTC on backend

#### ACT-5-T2: Custom Date in Non-UTC Timezone
- [ ] Set date `2026-04-01 12:00:00` timezone `Asia/Dubai` (UTC+4)
- [ ] Submit → verify `scheduled_at = 2026-04-01T08:00:00Z` (12:00 Dubai = 08:00 UTC)
- [ ] **Fix:** Timezone not converted → check `Carbon::parse($dt, $tz)->utc()`

#### ACT-5-T3: Invalid Timezone String Rejected
- [ ] Send `scheduled_timezone = "Not/ATimezone"`
- [ ] Expect: 422 validation error
- [ ] **Fix:** Invalid TZ accepted → check `Rule::in(timezone_identifiers_list())`

#### ACT-5-T4: Scheduled Failure Handling
- [ ] If external API is configured and offline, a scheduled activation may fail
- [ ] Verify failed schedule shows `scheduled_failed` status
- [ ] `scheduled_failure_message` appears in customer detail
- [ ] Retry button available for `scheduled_failed` licenses
- [ ] **Fix:** Failure state not shown → check `scheduled_failed_at` + `scheduled_failure_message` fields

---

### ACT-6: Activation — BIOS ID Validation

#### ACT-6-T1: BIOS ID Required
- [ ] Submit activation with empty `bios_id`
- [ ] Expect: 422 `bios_id is required`
- [ ] **Fix:** Missing validation → check `required` rule on `bios_id`

#### ACT-6-T2: Blacklisted BIOS Rejected
- [ ] Add `BIOS-BLOCKED` to blacklist
- [ ] Try to activate with `bios_id = "BIOS-BLOCKED"`
- [ ] Expect: 422 with clear message "BIOS ID is blacklisted"
- [ ] **Fix:** Not rejected → check `BiosBlacklistCheck` middleware on activate route

#### ACT-6-T3: Duplicate BIOS — Same Tenant (Conflict Detection)
- [ ] Activate license for BIOS `DUPLICATE-001` by Reseller A
- [ ] Reseller B in same tenant tries to activate `DUPLICATE-001`
- [ ] Behavior depends on business rules:
  - If conflicts are detected → verify conflict record created in `bios_conflicts`
  - If duplicate is blocked → verify 422 error
  - If allowed → verify both licenses coexist
- [ ] **Fix:** Unexpected behavior → check `BiosConflict` detection logic in `LicenseService`

#### ACT-6-T4: BIOS ID With URL-Unsafe Characters
- [ ] Activate with `bios_id = "TEST/BIOS:001"` (contains `/` and `:`)
- [ ] Verify activation succeeds (stored correctly)
- [ ] Verify customer detail page URL is properly encoded: `/en/customers/5` not broken
- [ ] Verify BIOS detail link uses `encodeURIComponent("TEST/BIOS:001")`
- [ ] **Fix:** URL broken → check `routePaths.*.biosDetail(lang, biosId)` uses `encodeURIComponent`

---

### ACT-7: Activation — Program Validation

#### ACT-7-T1: Non-Existent Program Rejected
- [ ] Send `program_id = 99999` (non-existent)
- [ ] Expect: 422 `program_id does not exist`
- [ ] **Fix:** No validation → check `exists:programs,id` rule

#### ACT-7-T2: Inactive Program Rejected
- [ ] Deactivate a program → try to activate with its `program_id`
- [ ] Expect: 422 or 403 with message "Program is not available"
- [ ] **Fix:** Inactive program accepted → check program `status=active` validation in `LicenseService`

#### ACT-7-T3: Program From Different Tenant Rejected
- [ ] Get a `program_id` from Tenant B
- [ ] While logged into Tenant A, try to activate with that program_id
- [ ] Expect: 422 (tenant scope prevents access)
- [ ] **Fix:** Cross-tenant program accepted → check `TenantScope` on program lookup

---

### ACT-8: Activation — Price Override

#### ACT-8-T1: Custom Price Accepted
- [ ] Send `price = 99.99` with activation
- [ ] Verify `price` is stored on the license
- [ ] Verify it appears in reseller's revenue reports (not program base price)
- [ ] **Fix:** Price ignored → check backend stores `price` field on license

#### ACT-8-T2: Reseller Cannot Override Price (if restricted)
- [ ] If reseller is restricted from changing price, send `price = 0.01`
- [ ] Verify: either ignored (base price used) or 422 error
- [ ] **Fix:** Business rule not enforced → check role-based price permission in `LicenseController`

---

### ACT-9: License Renewal — Full Data Flow

**Endpoint:** `POST /api/licenses/:id/renew`

#### ACT-9-T1: Renewal Payload Fields
```typescript
// RenewLicenseData
{
  duration_days: number    // required, 0.0001–36500
  price: number            // required
  is_scheduled?: boolean
  scheduled_date_time?: string
  scheduled_timezone?: string
}
```
- [ ] Renew an expired license: `duration_days=30, price=25`
- [ ] Response: `status="active"`, new `expires_at` = now + 30 days
- [ ] Verify in ALL role dashboards: status shows `active`
- [ ] **Fix:** Status not updating everywhere → check `LicenseCacheInvalidation.invalidateForLicense()`

#### ACT-9-T2: Renewal Extends From Expiry (Not From Now)
- [ ] License expiry: yesterday (already expired)
- [ ] Renew 30 days → new expiry should be: today + 30 days (not yesterday + 30)
- [ ] **Fix:** Wrong expiry calculation → check renewal logic: `max(now, expires_at) + duration`

#### ACT-9-T3: Scheduled Renewal
- [ ] Renew with `is_scheduled=true`, `scheduled_date_time` = future
- [ ] License stays in current state until scheduled date
- [ ] On scheduled date → auto-renews
- [ ] **Fix:** Scheduled renewal not triggering → check `ProcessDueScheduledLicenses` handles renewals

#### ACT-9-T4: Renewal by Different Role Than Activator
- [ ] Reseller R1 activates a license
- [ ] Manager renews it (different role)
- [ ] Verify renewal recorded correctly
- [ ] Verify BOTH R1 (original activation) and manager renewal appear in license history
- [ ] **Fix:** History incomplete → check license history records all lifecycle events

---

### ACT-10: License Deactivation — Full Data Flow

**Endpoint:** `POST /api/licenses/:id/deactivate`

#### ACT-10-T1: Deactivation Status Updates All Dashboards
- [ ] Deactivate an active license
- [ ] Response: `status="cancelled"` or `"expired"`
- [ ] Verify: reseller customer list → status updated
- [ ] Verify: manager customer list → status updated
- [ ] Verify: manager-parent customers → status updated
- [ ] Verify: super-admin customers → status updated
- [ ] **Fix:** Stale status on one role → check `clearRoleCaches()` in `licenseService.deactivate()`

#### ACT-10-T2: Role Restriction — Reseller Cannot Deactivate Another Reseller's License
- [ ] Reseller R1 has license L1; Reseller R2 tries to deactivate L1
- [ ] Expect: 403 or 404
- [ ] **Fix:** Cross-reseller deactivation allowed → check `resolveActorLicenseQuery()` in `LicenseController`

---

### ACT-11: Pause / Resume License

**Endpoints:** `POST /api/licenses/:id/pause` and `POST /api/licenses/:id/resume`

#### ACT-11-T1: Pause Stops the Timer
- [ ] Pause an active license
- [ ] Verify `status = "pending"` (paused state)
- [ ] Wait a few seconds → verify expiry date has NOT changed (timer stopped)
- [ ] **Fix:** License still expiring → check pause logic freezes `expires_at`

#### ACT-11-T2: Resume Restarts the Timer
- [ ] Resume the paused license
- [ ] Verify status returns to `active`
- [ ] Verify remaining days resume from where paused
- [ ] **Fix:** Days reset on resume → check remaining duration calculation

#### ACT-11-T3: Pause/Resume Visible Across Roles
- [ ] Manager pauses a license → reseller sees `pending` status ✓
- [ ] Super-admin resumes → all roles see `active` ✓
- [ ] **Fix:** Stale status → check `clearRoleCaches()` in pause/resume service methods

---

### ACT-12: Bulk Operations

**Endpoints:** `POST /api/licenses/bulk-renew`, `POST /api/licenses/bulk-deactivate`, `POST /api/licenses/bulk-delete`

#### ACT-12-T1: Bulk Renew — Multiple Licenses
- [ ] Select 3+ licenses (checkboxes in customer table)
- [ ] Click "Bulk Renew" → enter duration → submit
- [ ] Verify all 3 licenses updated to `active`
- [ ] Verify `count` in response matches selected count
- [ ] **Fix:** Partial renewal → check `bulkRenew` processes all IDs in transaction

#### ACT-12-T2: Bulk Deactivate
- [ ] Select 3 active licenses → bulk deactivate
- [ ] All 3 show `cancelled` in table
- [ ] **Fix:** Some not deactivated → check transaction rollback on partial failure

#### ACT-12-T3: Bulk Delete
- [ ] Select 3 licenses → bulk delete → all removed
- [ ] Verify they no longer appear in any role's customer list
- [ ] **Fix:** Cross-role persistence after delete → check `clearRoleCaches()` called after bulk delete

#### ACT-12-T4: Bulk Operations with Mixed Roles (Role Scope Enforced)
- [ ] Reseller R1 tries to bulk-deactivate licenses including one belonging to R2
- [ ] Expect: R2's license NOT deactivated (or whole operation rejected)
- [ ] **Fix:** Cross-reseller bulk operation → check role scope in `LicenseController::bulkDeactivate`

---

### ACT-13: Retry Scheduled License

**Endpoint:** `POST /api/licenses/:id/retry-scheduled`

#### ACT-13-T1: Retry After Failure
- [ ] Find a `scheduled_failed` license
- [ ] Click "Retry" → triggers re-attempt
- [ ] If external API is back online → status becomes `active`
- [ ] If still offline → stays `scheduled_failed` with new attempt timestamp
- [ ] **Fix:** Retry not triggering → check `licenseService.retryScheduled()` + button visibility conditional

---

### ACT-14: External API Check (BIOS Verification)

**Endpoint:** `GET /api/check/:bios`
**Allowed roles:** `reseller`, `manager`, `manager_parent`, `super_admin`

#### ACT-14-T1: Valid BIOS Returns User Data
- [ ] On activation form, if BIOS lookup is triggered → verify response includes user data from external API
- [ ] Verify data populates form fields (e.g., customer_name auto-filled from API response)
- [ ] **Fix:** BIOS lookup failing → check `ExternalApiService.checkUser()` + external API key configured

#### ACT-14-T2: BIOS Not Found in External API
- [ ] Enter a BIOS ID that exists locally but not in external API
- [ ] Verify graceful handling (no crash, activation still possible)
- [ ] **Fix:** 500 error on lookup failure → check `ExternalApiService` catches API errors

#### ACT-14-T3: External API Offline During BIOS Check
- [ ] External API is down
- [ ] BIOS lookup → error handled gracefully (warning shown, not blocking)
- [ ] Activation still possible manually
- [ ] **Fix:** BIOS check failure blocks activation → make check non-blocking

#### ACT-14-T4: External API Users List
**Endpoint:** `GET /api/users` (allowed: `super_admin`, `manager_parent` only)
- [ ] Super-admin calls `/api/users` → gets users list from external API
- [ ] Manager-parent calls same → gets their tenant's users
- [ ] Reseller tries → 403 Forbidden
- [ ] **Fix:** Wrong role access → check `role:super_admin,manager_parent` middleware

---

### ACT-15: Complete Activation Data Flow — End-to-End

This is the single most important test: verifying that one activation touches every part of the system correctly.

```
TRIGGER: Reseller activates a license

DATA FLOW CHECK:
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Reseller fills activation form                              │
│         → customer_name, bios_id, program_id, duration_days=30     │
│                                                                     │
│ STEP 2: POST /api/licenses/activate                                 │
│         → BiosBlacklistCheck middleware fires (not blacklisted ✓)   │
│         → RoleMiddleware confirms role=reseller ✓                   │
│         → TenantScope confirms tenant_id correct ✓                  │
│         → ApiLogger records the API call ✓                          │
│         → IpTracker logs reseller's IP ✓                            │
│         → LicenseController.activateLicense() runs                 │
│         → license created in DB: status=active                     │
│         → customer user created (or found) in DB                   │
│         → ActivityLog entry created                                 │
│         → clearRoleCaches() invalidates: reseller, manager,         │
│           manager-parent, super-admin caches ✓                      │
│                                                                     │
│ STEP 3: Verify in EVERY dashboard:                                  │
│  [Reseller] Customers list → new customer with active badge ✓       │
│  [Reseller] Activations log → new entry ✓                          │
│  [Reseller] Dashboard stats → active license count +1 ✓             │
│  [Manager] Customers list → customer visible ✓                     │
│  [Manager] Reseller Logs → activation event ✓                      │
│  [Manager] Dashboard stats → updated ✓                             │
│  [Manager-Parent] Customers list → customer visible ✓              │
│  [Manager-Parent] Reseller Logs → activation event ✓               │
│  [Manager-Parent] Financial Reports → revenue updated ✓            │
│  [Manager-Parent] Program Logs → this program usage +1 ✓           │
│  [Manager-Parent] Activity Log → event recorded ✓                  │
│  [Super-Admin] Customers list → customer visible (cross-tenant) ✓  │
│  [Super-Admin] Logs page → API call recorded ✓                     │
│  [Super-Admin] Reports → revenue +X ✓                              │
│  [Super-Admin] BIOS History → bios_id activation event ✓           │
└─────────────────────────────────────────────────────────────────────┘
```

- [ ] Execute all steps — open 4 browser tabs (one per role) and verify each dashboard
- [ ] This is the **single most important end-to-end test** in the entire suite
- [ ] **Fix:** Any dashboard not reflecting activation → trace `clearRoleCaches()` + live query intervals

---

### ACT-16: Program Catalog → Activation → Data Flow (UI Flow)

```
STEP 1: Reseller opens Software page (/en/reseller/software)
        → GET /api/programs → list of active programs ✓
        → Programs show: name, description, price (hidden for reseller), activate button ✓

STEP 2: Click "Activate" on Program P
        → navigate(/en/reseller/software/:id/activate, { state: { returnTo: '/software' } })
        → Activation form opens with program_id pre-selected ✓

STEP 3: Load program presets
        → GET /api/programs/:id → presets array loaded ✓
        → Preset dropdown populated ✓

STEP 4: Fill form → submit
        → POST /api/licenses/activate
        → Success toast: "License activated" ✓

STEP 5: Navigate back
        → Click Cancel → returns to /en/reseller/software ✓
        → After success → auto-navigate to /en/reseller/customers OR stay on form ✓

STEP 6: Verify program stats updated
        → GET /api/programs/:id/stats → activation count +1 ✓
```
- [ ] Execute all 6 steps for each role: reseller, manager, manager-parent
- [ ] **Fix per step:** Trace component → service → API → response

---

### ACT-17: Cache Invalidation Completeness

`licenseService` calls `clearRoleCaches()` which clears: `reseller:*`, `manager:*`, `manager-parent:*`, `super-admin:*`

#### ACT-17-T1: All Caches Cleared After Activate
- [ ] Open DevTools Network tab
- [ ] Activate a license
- [ ] Verify the next request to each role's dashboard/customers API goes to network (not served from cache)
- [ ] **Fix:** Stale cache → check `clearRoleCaches()` pattern `/^(reseller|manager|manager-parent|super-admin):/`

#### ACT-17-T2: Live Query Refetch on Cache Clear
- [ ] With a customer list open in a tab
- [ ] From a different tab, activate a license
- [ ] Within 15 seconds (live query interval), the first tab updates
- [ ] **Fix:** No live update → check `liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_LIST)` on customers query

#### ACT-17-T3: React Query Cache vs API Cache
- [ ] The system uses both React Query cache (client) and `apiCache` (service layer)
- [ ] Verify that on activation, BOTH caches are cleared for affected queries
- [ ] **Fix:** Stale React Query cache → check `queryClient.invalidateQueries()` called after activation mutation

---

### ACT-18: `useResolvedTimezone` in Activation Flow

#### ACT-18-T1: Scheduled Date Displayed in User's Timezone
- [ ] User has timezone set to `Asia/Riyadh` (UTC+3)
- [ ] Schedule activation for `2026-04-01 12:00:00 UTC`
- [ ] In customer list, scheduled date shown as `2026-04-01 15:00:00` (Riyadh time)
- [ ] **Fix:** Wrong timezone display → check `formatDate(date, locale, timezone)` uses `useResolvedTimezone`

#### ACT-18-T2: Timezone Priority Chain
- [ ] `useResolvedTimezone` resolves: user preference > browser TZ > server TZ
- [ ] Set user timezone in profile → verify all date displays update
- [ ] Clear user timezone → falls back to browser timezone
- [ ] **Fix:** Wrong fallback → check `useResolvedTimezone` hook priority logic

---

## Summary: What This Master Plan Adds vs Individual Plans

| Coverage | Individual Plans | This Master Plan |
|----------|-----------------|-----------------|
| Per-page feature tests | ✅ | Referenced |
| Shared component depth | ❌ | ✅ SC-1 to SC-15 |
| Shared pages per-role | ❌ | ✅ SP-1 to SP-5 |
| Backend middleware tests | ❌ | ✅ MW-1 to MW-8 |
| Cross-role interaction flows | Partial (some) | ✅ CRI-1 to CRI-12 (exhaustive) |
| Security testing | ❌ | ✅ SEC-1 to SEC-3 |
| Performance testing | ❌ | ✅ PERF-1 to PERF-3 |
| Production deploy checklist | ❌ | ✅ PROD-1 to PROD-11 |
| Regression test list | ❌ | ✅ 8 known fixed bugs |
| **Activation API — all fields** | ❌ | ✅ ACT-1 to ACT-18 |
| **Activation — all roles** | ❌ | ✅ Every role tested |
| **Activation — all modes** | ❌ | ✅ Duration, end date, preset, scheduled (relative + custom) |
| **Activation — BIOS validation** | ❌ | ✅ Blacklist, duplicates, special chars |
| **Activation — scheduling lifecycle** | ❌ | ✅ Create → trigger → activate → retry |
| **Renew/Deactivate/Pause/Resume** | ❌ | ✅ All operations + cross-role visibility |
| **Bulk operations** | ❌ | ✅ Bulk renew, deactivate, delete + scope enforcement |
| **External API (BIOS check)** | ❌ | ✅ Valid, not found, offline, role restriction |
| **End-to-end activation data flow** | ❌ | ✅ ACT-15: single activation → verified in ALL 4 dashboards |
| **Cache invalidation completeness** | ❌ | ✅ API cache + React Query cache + live query |
| **Timezone in activation flow** | ❌ | ✅ useResolvedTimezone priority + display |
| **Program catalog → form → API flow** | ❌ | ✅ ACT-16: full UI flow per role |

---

## Document Index

| File | Sprints | Test Cases | Focus |
|------|---------|-----------|-------|
| `reseller-dashboard-testing-plan.md` | 15 | 80+ | Reseller-specific pages |
| `manager-dashboard-testing-plan.md` | 23 | 130+ | Manager-specific pages |
| `manager-parent-dashboard-testing-plan.md` | 30 | 160+ | Manager-parent pages + cross-role |
| `super-admin-dashboard-testing-plan.md` | 24 | 150+ | Super-admin + cross-tenant |
| **`master-production-testing-plan.md`** (this file) | **9 parts** | **300+** | **Shared + cross-role + activation API + production** |
| **TOTAL** | **101 sprints** | **820+ test cases** | **Full system coverage** |

---

*Last updated: 2026-03-15*
*Master plan — 9 parts, 300+ test cases, 18 activation API flow tests, 12 cross-role flows, 11 production checks*
*Run after all 4 individual role plans pass*
*ACT-15 (end-to-end activation data flow) is the single most important test in the entire suite*

## Latest Role Plan Status

### Reseller Plan

- `docs/reseller-dashboard-testing-plan.md` was executed locally on 2026-03-14 to 2026-03-15.
- Result: reseller Sprints 1-15 completed.
- Core reseller workflows passed:
  - auth
  - customers
  - detail
  - activate
  - renew
  - deactivate
  - reports
  - payment status
  - profile
  - RTL Arabic
  - live refresh
- Open reseller findings were written back into the reseller plan issue tracker.
- Most remaining reseller issues are navigation/UX/documentation mismatches, not core flow blockers.

## Latest Master Session Status

### Overall Readiness Verdict

- Current status: **Not production-ready yet**
- Reason:
  - open `High` master issues still exist in shared components:
    - `SC-1` DataTable third-click sort reset is still open
  - master-plan execution is still incomplete:
    - Session 1 follow-up shared-page mutation checks remain open
    - Session 2 still has pending middleware / cross-role items
    - Session 3 still has performance follow-up items
    - Session 4 still has deployment-only verification items that require the real production host
  - current local environment is not production-shaped:
    - `APP_ENV=local`
    - `APP_DEBUG=true`

### Coverage Snapshot

- Role-plan execution status:
  - Reseller: completed through Sprint `15`
  - Manager: completed through Sprint `23`
  - Manager-Parent: completed through Sprint `25`
  - Super-Admin: completed through Sprint `24`
- Master-plan execution status:
  - Session 1 / Parts `1–2`: partially complete
  - Session 2 / Parts `3–4`: partially complete
  - Session 3 / Parts `5–6`: complete for the first pass, with documented follow-up

  - Session 4 / Parts `7-8`: complete for local pre-production validation, with deployment-only checks still pending on the real server

### Go / No-Go Summary

- `No-Go` for production if the release standard is:
  - all `High` master issues closed
  - master sessions fully completed
  - production environment checklist confirmed on the real deployment target
- `Conditional Go` only if:
  - the remaining shared DataTable sort-cycle issue is accepted as non-blocking for this release
  - the remaining master follow-up items are intentionally deferred
  - production environment values are verified on the actual server:
    - `APP_ENV=production`
    - `APP_DEBUG=false`
    - correct production domains / session / Sanctum settings
    - migrations run successfully
    - post-deploy smoke test completed

### Session 1 - Parts 1 to 2

- Date: 2026-03-15
- Scope started:
  - Shared components
  - Shared pages (activation, renewal, customer create, reseller payments)

### What was verified

- Shared DataTable sticky header is working on the super-admin tenants table.
- Shared DataTable rows-per-page selector is working on the super-admin tenants table.
- Shared status badges render the expected active, scheduled, cancelled, and pending variants on customer tables.
- Super-admin shared create-customer page is working with the role-unique tenant selector.
- Super-admin reseller selector on create-customer now behaves as a dependent field:
  - disabled before tenant selection
  - loads reseller options after tenant selection
  - correctly exposed `Ahmed Reseller (Reseller)` for `OBD2SW Main`
- Shared reseller-payments list/detail pages are working on both manager-parent and manager routes:
  - manager-parent: `/en/reseller-payments` and `/en/reseller-payments/:resellerId`
  - manager: `/en/manager/reseller-payments` and `/en/manager/reseller-payments/:resellerId`
- Shared renew page is reachable and renders role-correct shells on:
  - manager-parent `/en/customers/licenses/26/renew`
  - manager `/en/manager/customers/licenses/29/renew`
  - reseller `/en/reseller/customers/licenses/26/renew`
- Shared activate page is reachable and renders role-correct shells on:
  - manager-parent `/en/software-management/1/activate`
  - manager `/en/manager/software/1/activate`
  - reseller `/en/reseller/software/1/activate`

### Confirmed Session 1 findings so far

- Shared DataTable sort clear is broken:
  - third click on sortable headers does not return to an unsorted state
- Shared DataTable empty-state rendering no longer reproduces:
  - 0-result filtering on the super-admin tenants table now renders `EmptyState` correctly instead of blank rows
- Shared status translation leak for `common.inactive` was fixed locally during this pass and no longer reproduces on the super-admin tenants page
- Super-admin tenant-comparison labels were previously unreadable; the current local frontend change truncates them cleanly, but this still needs final retest after the next push

### Session 1 still pending

- ConfirmDialog deep pass:
  - overlay close
  - Escape close
  - destructive styling
  - loading-state verification
- StatsCard slow-loading/skeleton verification
- EmptyState CTA verification on more than one shared list
- Remaining shared page mutation/invalidation checks beyond route-shell confirmation
- Final post-fix retest of AR status labels and tenant-comparison chart after the next push

### Session 2 - Parts 3 to 4

- Date: 2026-03-15
- Scope started:
  - Backend middleware
  - Cross-role interaction matrix

### What was verified

- `MW-1` RoleMiddleware is enforcing backend API access correctly:
  - manager -> `GET /api/super-admin/tenants` returned `403`
  - reseller -> `POST /api/super-admin/tenants/1/reset` returned `403`
  - reseller -> `GET /api/manager/team` returned `403`
  - reseller -> `GET /api/bios-blacklist` returned `403`
  - manager -> `DELETE /api/bios-blacklist/:id` returned `403`
  - reseller -> `GET /api/bios-conflicts` returned `403`
  - manager -> `POST /api/balances/:user/adjust` returned `403`
- `MW-2` TenantScope is enforcing cross-tenant isolation:
  - reseller from tenant 1 -> tenant 2 customer `90` returned `404`
  - manager from tenant 1 -> tenant 2 customer `90` returned `404`
  - super-admin could read tenant 2 customer `90` in the same session
- `MW-3` ActiveRoleMiddleware is enforcing suspension:
  - manager suspended reseller `3`
  - reseller login was blocked with `account_suspended`
  - reseller active session API call returned `403`
  - manager reactivated reseller `3`
  - reseller login succeeded again
- `MW-4` BiosBlacklistCheck is enforcing activation blocking:
  - manager-parent blacklisted a BIOS
  - reseller activation returned `422`
  - manager activation returned `422`
  - error message was human-readable: `This BIOS ID is blacklisted.`
- `MW-5` ApiLogger now logs general API traffic after the local fix:
  - login and authenticated GET requests increased `api_logs` count
  - latest login log stored password as `[REDACTED]`
- `MW-8` security headers are present on API responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy` present
  - `Referrer-Policy: no-referrer`
  - no `Server` header version disclosure was returned

### Cross-role flows verified

- `CRI-1` Program Lifecycle:
  - manager-parent created a program
  - manager and reseller both saw it while active
  - after deactivation, both still saw it at first
  - this was fixed locally in the shared program controller
  - after the fix, inactive programs disappeared for manager and reseller
- `CRI-2` BIOS Blacklist:
  - manager-parent blacklist add blocked reseller and manager activations
  - both roles activated successfully again with clean BIOS values afterward
- `CRI-4` User Suspension:
  - manager -> reseller suspension path passed end to end
  - super-admin -> manager suspension path passed end to end
  - reseller remained unaffected when the manager account was suspended by super-admin
- `CRI-7` Payment Recording:
  - manager recorded a payment for reseller `3`
  - manager payment detail totals increased from `2.00` to `9.50`
  - reseller payment-status totals also increased from `2.00` to `9.50`
  - reseller outstanding balance recalculated to `1202.18`
- `CRI-12` Tenant Deactivation:
  - super-admin deactivated tenant `2`
  - tenant 2 manager-parent and reseller logins were blocked with `tenant_inactive`
  - super-admin remained unaffected
  - tenant reactivation restored both tenant 2 logins

### Confirmed Session 2 findings so far

- `ApiLogger` was under-scoped before this pass and did not cover the main API surface
- manager/reseller program visibility rules were too loose before this pass and leaked inactive programs into operator catalogs
- tenant-isolation and role-authorization logic are behaving correctly at the backend API level

### Session 2 still pending

- `MW-5` 500-error logging verification
- `MW-6` IP tracking / proxy verification
- `MW-7` scheduled-license processing verification
- remaining cross-role flows:
  - `CRI-3`
  - `CRI-5`
  - `CRI-6`
  - `CRI-8`
  - `CRI-9`
  - `CRI-10`
  - `CRI-11`

### Session 3 - Parts 5 to 6

- Date: 2026-03-15
- Scope started:
  - Security testing
  - Performance testing

### What was verified

- `SEC-1` Authentication Security:
  - brute-force protection triggered after 6 failed attempts on the same account/email
  - lockout escalated through timed locks and eventually to a permanent IP block on repeated abuse
  - super-admin `Security Locks` showed the locked account entry with IP / device context
  - logout invalidated the old bearer token; post-logout API calls returned `401 Unauthenticated`
  - cross-origin preflight to `POST /api/auth/login` from `http://evil.example.com` returned no `Access-Control-Allow-Origin`, so browser-origin abuse is blocked by CORS
- `SEC-2` Input Validation & Injection Prevention:
  - SQL injection probe `'; DROP TABLE users; --` on super-admin customer search returned an empty result set with no SQL error
  - stored XSS probe `<script>alert('xss')</script> QA 20260315` was saved as plain text and rendered inert in the super-admin customers table; no dialog executed in the browser pass
  - BIOS special-character create path accepted a test BIOS containing `/`, `%`, `#`, `'`, and `\` without crashing the save path
  - API key exposure check passed: shared `/api/programs` responses did not expose `external_api_key` or `external_api_key_encrypted`
- `SEC-3` Authorization Bypass Attempts:
  - previously verified `403` / `404` protections from Parts 3 to 4 remain the effective backend result for IDOR, cross-tenant access, and privilege escalation attempts
- `PERF-1` Page Load Times:
  - super-admin dashboard browser navigation timing was fast in the local environment:
    - `responseEnd ~= 35ms`
    - `domContentLoaded ~= 341ms`
    - `loadEvent ~= 343ms`
  - route code-splitting is active: the router uses `lazy(...)` + `Suspense`, and production build output shows many on-demand page chunks rather than one monolithic bundle
- `PERF-2` API Response Times:
  - manager dashboard API sampled at:
    - `578.32ms`
    - `519.68ms`
    - `480.64ms`
    - `468.44ms`
    - `451.89ms`
  - manager customers API sampled at:
    - `568.17ms`
    - `433.72ms`
    - `447.29ms`
    - `455.34ms`
    - `428.93ms`
  - manager customers API is within the `< 800ms` target
  - manager dashboard API is borderline on cold hits against the `< 500ms` target
  - controller inspection shows eager loading on the manager customers path (`customerLicenses` + `program` + `reseller`), so no obvious N+1 pattern was found in code review
- `PERF-3` Frontend Bundle Size:
  - `npm run build` passed
  - the build is chunk-split aggressively; largest gzip chunks observed:
    - `vendor-misc`: `101.44 kB`
    - `vendor-react`: `73.88 kB`
    - `vendor-charts`: `65.69 kB`
    - `vendor-ui`: `43.50 kB`
  - no single gzip JS asset was anywhere near the `1 MB` threshold

### Fixes made during Session 3

- fixed a general API auth failure path in [bootstrap/app.php](/C:/laragon/www/LIcense/backend/bootstrap/app.php)
  - unauthenticated `/api/*` requests now return a clean JSON `401`
  - they no longer trigger `Route [login] not defined`
  - API exceptions are now forced to render as JSON for `/api/*`

### Confirmed Session 3 findings so far

- brute-force, lockout, token invalidation, SQL injection resistance, XSS render escaping, and API key non-exposure all passed in this environment
- the current environment is `APP_ENV=local` with `APP_DEBUG=true`, so raw 500 responses still include local debug detail; that is an environment mismatch against the production checklist, not a production-code conclusion
- the manager dashboard API is the only measured endpoint in this pass that is still borderline against its target

### Session 3 limits / follow-up

- `PERF-1-T2` 100+ row table render was fixture-limited in this pass; the current local dataset does not naturally provide a large enough shared-table page to close that check honestly
- `PERF-2-T3` query-count verification was partially covered by controller inspection and timing samples, but not by a clean automated query-count harness yet

### Session 4 - Parts 7 to 8

- Date: 2026-03-15
- Scope covered:
  - Production checklist
  - Regression tests

### Production checklist results

- Local pre-production checks passed:
  - `php artisan migrate:status` showed all migrations applied, including `tenant_backups` and nullable `commission_id`
  - `php artisan config:cache`, `route:cache`, `view:cache`, and `optimize` all completed successfully
  - `php artisan schedule:run` executed the scheduled license jobs without failure
  - `php artisan storage:link` confirmed the public storage link already exists
  - frontend `npm run build` passed
- Local environment is still not production-shaped:
  - backend `.env` still uses `APP_ENV=local`
  - backend `.env` still uses `APP_DEBUG=true`
  - `APP_URL` and `VITE_API_URL` still point to local/http hosts
  - session / Sanctum domains are still local-only values
- Deployment-only items remain unverified from this machine:
  - real HTTPS certificate / redirect / HSTS behavior
  - web-server file ownership and deploy-user permissions on the actual host
  - production WAF / DDoS / Cloudflare posture
  - off-site automated backup execution
  - monitoring / alerting delivery on the production stack
  - final smoke test on the real production URL
- Additional operational note:
  - `storage/logs/laravel.log` exists locally but is very large, so log rotation should be confirmed before release

### Regression checklist results

- `RG-1` Sticky table headers:
  - retest passed on the super-admin tenants table
  - the shared table header still renders with sticky behavior during scroll
- `RG-2` Filter reset after sidebar navigation:
  - retest passed on the super-admin tenants table
  - applying a search filter, navigating away, and returning via the sidebar restored the unfiltered list
- `RG-3` Manager filter missing from query key:
  - current customer pages include `managerId` in the query key and filter dependency chain on both manager and manager-parent routes
  - no missing-query-key regression is visible in the current code path
- `RG-4` Tenant backup datetime restore error:
  - restore flow was already re-proven in the super-admin tenant reset/restore pass
  - no 500 datetime-format restore failure reproduced
- `RG-5` Missing `tenant_backups` table:
  - retest passed
  - migration status includes the `tenant_backups` table migration, and reset/backup flows are working
- `RG-6` Missing `password` field in user restore:
  - restore flow remains healthy enough to re-enable login for restored tenant users after backup restore
  - no missing-password restore failure reproduced in the current restore path
- `RG-7` Settings `primary_color` default:
  - retest passed
  - frontend build completed successfully and super-admin settings/profile pages load without the old type/default crash
- `RG-8` `setUser` auth export / navbar refresh:
  - retest passed
  - saving the super-admin profile updated the navbar name immediately, then was reverted to the original value

### Confirmed Session 4 findings

- Shared DataTable third-click sort reset is still reproducing on the super-admin tenants table and remains the main open shared-component regression.
- Shared DataTable empty-state fallback no longer reproduces in the live tenants-table regression retest.
- The application can be prepared locally for production, but the real production checklist cannot be honestly closed until the actual deployment host is checked with production env values and HTTPS.

### Session 4 conclusion

- App behavior is close to release-ready from the local validation perspective.
- Release readiness is still blocked by:
  - the open shared DataTable third-click sort regression
  - production-host verification still pending for env, HTTPS, permissions, monitoring, and smoke checks

### Session 5 - Part 9

- Date: 2026-03-15
- Scope started:
  - Software Activation API (`ACT-1` to `ACT-18`)

### Session 5 first-pass coverage

- `ACT-1` Activation by all roles passed on the shared `POST /api/licenses/activate` endpoint:
  - reseller immediate activation succeeded with preset mode
  - manager immediate activation succeeded
  - manager-parent immediate activation succeeded
  - super-admin cross-tenant activation succeeded for tenant `2` via `seller_id=58`
- `ACT-3-T2` preset validation passed:
  - sending preset `15` against program `1` returned clean `422`
- `ACT-5` custom scheduling validation passed:
  - invalid timezone string returned clean `422`
  - `UTC` scheduled date stored exactly as `2026-04-01T12:00:00Z`
  - `Asia/Dubai` scheduled date converted correctly to `2026-04-01T08:00:00Z`
- `ACT-4-T3` scheduled processing passed:
  - scheduled license created in a future minute
  - follow-up API request triggered `ProcessDueScheduledLicenses`
  - license status moved from `pending` to `active`
- `ACT-6` BIOS validation mostly passed:
  - empty BIOS returned clean `422`
  - blacklisted BIOS returned clean `422`
  - duplicate BIOS in the same tenant/program returned clean `422`
- `ACT-7` program validation is partly working:
  - inactive program returned clean `422`
  - cross-tenant program lookup was blocked
- `ACT-8` custom pricing passed for manager:
  - custom `price=99.99` was stored on the created license
  - reseller price override did not win over preset pricing; stored price remained preset-derived (`250`)
- `ACT-9` renewal flow passed on the API:
  - renew response returned `active`
  - future-active license renewal extended from prior expiry, not from now
- `ACT-10` deactivation passed:
  - active license moved cleanly to `cancelled`
- `ACT-11` pause/resume passed:
  - pause moved status to `pending`
  - paused remaining minutes stayed frozen after a short wait
  - resume returned the license to `active`
- `ACT-14` external API role/path checks passed at baseline:
  - manager-parent could call `/api/external/users`
  - reseller received `403`
  - not-found BIOS lookup returned a graceful `exists=false` response, not a crash

### Session 5 first-pass findings

- `ACT-4` status wording drift:
  - scheduled activations are created with `status="pending"`, not `status="scheduled"` as the written plan expects
- `ACT-6-T4` URL-unsafe BIOS activation is not safe end to end:
  - activating BIOS values containing `/` and `:` failed through the external activation path
  - current failure surfaced as an external `404 Not Found` response instead of a safe supported activation path or a controlled local validation message
- `ACT-7-T1` non-existent program handling is not production-clean:
  - `program_id=99999` throws a model `404` / exception response instead of a clean validation-style `422`
  - because the local environment still has `APP_DEBUG=true`, the response includes a full stack trace
- `ACT-2` end-date mode does not match the current backend API contract:
  - the implemented shared endpoint does not accept a dedicated `end_date` field
  - current API shape is duration / preset / absolute scheduled datetime, so the written ACT-2 checklist is now partly plan drift
- `ACT-4` relative scheduling is not a direct backend payload mode:
  - the current shared API accepts absolute `scheduled_date_time`, so any relative-offset scheduling is a frontend transformation concern rather than a first-class API field

### Session 5 still pending

- `ACT-2` end-date flow verification against the current UI implementation
- `ACT-3-T1` and `ACT-3-T3` preset autofill / all-role form visibility checks
- `ACT-5-T4` scheduled failure handling and retry path with a true `scheduled_failed` license
- `ACT-9-T3` scheduled renewal
- `ACT-9-T4` renewal history visibility across different roles
- `ACT-10` and `ACT-11` cross-dashboard visibility checks
- `ACT-12` bulk operations
- `ACT-13` retry scheduled license
- `ACT-15` full 4-role activation data-flow proof
- `ACT-16` full program-catalog UI flow per role
- `ACT-17` cache invalidation / live-query completeness
- `ACT-18` `useResolvedTimezone` display checks
