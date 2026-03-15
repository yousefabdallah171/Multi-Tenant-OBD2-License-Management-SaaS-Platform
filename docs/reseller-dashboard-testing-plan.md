# Reseller Dashboard — Full Testing Plan (Playwright MCP)

> **Role under test:** `reseller`
> **Base URL:** `http://localhost:3000`
> **Login route:** `/en/login`
> **Reseller base route:** `/en/reseller`
> **Test tool:** Playwright MCP (browser automation)
> **Languages to test:** English (`en`) + Arabic (`ar`) for RTL/LTR checks

---

## Execution Status

### Latest QA Run

- **Executed on:** 2026-03-14 to 2026-03-15
- **Environment:** Local Laragon + Vite (`http://localhost:3000`)
- **Role account used:** `reseller1@obd2sw.com`
- **Coverage:** Sprints 1-15 executed

### Outcome Summary

- Core reseller workflows are working:
  - authentication
  - dashboard
  - customers list/detail
  - software catalog
  - activate
  - renew
  - deactivate
  - reports
  - payment status
  - profile
  - RTL Arabic
  - live query refresh
- This file is partially behind the current UI:
  - reseller sidebar does not currently show `Activations` or `Activity`, although both routes still work directly
  - create customer is now a full page, not an inline dialog
  - several labels and workflow details differ from the older expectations in this plan

### Confirmed Findings From This Run

1. Reseller sidebar is missing `Activations` and `Activity` links even though `/en/reseller/activations` and `/en/reseller/activity` are functional.
2. Unauthorized reseller access to `/en/super-admin/tenants` redirects to `/en/reseller/dashboard` instead of a login or 403-style page.
3. Renew success toast is generic `Saved` instead of a renew-specific success message.
4. Activity page still shows some raw/internal event labels such as `bios.change_requested` and `customer.created`.
5. Activate form field targeting/accessibility is brittle enough to make automation less reliable than expected.
6. Broad API failure handling is safe but noisy: the page stays rendered, but duplicate error toasts stack aggressively.
7. Customer create-only flow showed a status-count mismatch during QA:
   - total row count increased
   - `Pending` summary card did not increment in the observed state

### Temporary QA Data Created During This Run

- Customer `60`: `QA Sprint3 Customer Updated 20260314235617` (`cancelled`)
- Customer `61`: `QA Sprint6 Customer 20260315001820` (`active`)
- Customer `62`: `QA Live Customer 20260315005140` (`pending`)

---

## Pre-Test Setup Checklist

- [ ] Laragon (MySQL + PHP) is running
- [ ] `php artisan serve` or Nginx serving backend on port `8000`
- [ ] Vite dev server running on port `3000`
- [ ] Test reseller account exists with known credentials
- [ ] At least 1 customer with an active license exists under reseller
- [ ] At least 1 expired/pending customer exists under reseller
- [ ] At least 1 software/program exists and is assigned to the tenant
- [ ] Playwright MCP connected and browser open

---

## Sprint 1 — Authentication & Layout

### S1-T1: Login as Reseller
- [ ] Navigate to `http://localhost:3000/en/login`
- [ ] Enter reseller username + password
- [ ] Click login → should redirect to `/en/reseller/dashboard`
- [ ] Verify navbar shows reseller name and role badge
- [ ] Verify sidebar shows: Dashboard, Customers, Software, Activations, Activity, Reports, Payment Status, Profile
- [ ] **Fix:** If wrong redirect happens after login, check `AuthController` role routing

### S1-T2: Sidebar Navigation
- [ ] Click each sidebar link one by one
- [ ] Verify URL changes correctly for each
- [ ] Verify active link is highlighted in sidebar
- [ ] Verify page title/header changes
- [ ] **Fix:** Missing routes → check `routes.ts` reseller section

### S1-T3: Language Switch (EN → AR)
- [ ] Click language toggle (AR button in navbar)
- [ ] Verify URL changes from `/en/...` to `/ar/...`
- [ ] Verify text is Arabic and layout is RTL (right-to-left)
- [ ] Switch back to EN → verify layout reverts
- [ ] **Fix:** RTL layout breakage → check `dir` attribute on `<html>` tag

### S1-T4: Dark Mode Toggle
- [ ] Click dark mode toggle
- [ ] Verify page goes dark, all text remains readable
- [ ] Verify cards, tables, badges all have correct dark styles
- [ ] Toggle back to light
- [ ] **Fix:** Broken dark styles → check Tailwind dark: classes

### S1-T5: Logout
- [ ] Open user menu / profile dropdown
- [ ] Click logout
- [ ] Verify redirect to `/en/login`
- [ ] Verify trying to visit `/en/reseller/dashboard` redirects back to login
- [ ] **Fix:** Protected routes not guarding → check `ProtectedRoute` component

---

## Sprint 2 — Dashboard Page (`/en/reseller/dashboard`)

### S2-T1: Stats Cards Load
- [ ] Verify 4 stats cards render: Total Customers, Active Licenses, Total Revenue, Total Activations
- [ ] Verify values are numbers (not NaN or undefined)
- [ ] Verify no loading skeleton hangs indefinitely
- [ ] **Fix:** If stats are 0 or missing → check `resellerService.getDashboardStats()` API

### S2-T2: Activations Chart
- [ ] Verify monthly activations line chart renders with data points
- [ ] Verify X-axis shows month labels
- [ ] Verify chart tooltip shows on hover
- [ ] **Fix:** Blank chart → check `resellerService.getActivationsChart()` API response

### S2-T3: Revenue Chart
- [ ] Verify monthly revenue line chart renders
- [ ] Verify currency values are formatted (e.g., `$320.00`)
- [ ] **Fix:** Flat/empty chart → check `resellerService.getRevenueChart()` response

### S2-T4: Recent Activity Feed
- [ ] Verify recent activity list shows at least 1 entry
- [ ] Verify each entry shows: action type icon, description, date
- [ ] Verify "View All" / link navigates to Activity page
- [ ] **Fix:** Empty activity → seed data or check `resellerService.getRecentActivity()`

### S2-T5: Dashboard Quick Action Links
- [ ] Verify "View Activations" button/link navigates to activations with current month date range prefilled
- [ ] **Fix:** Wrong date range or missing link → check dashboard component button href

---

## Sprint 3 — Customers Page (`/en/reseller/customers`)

### S3-T1: Page Loads with Customer List
- [ ] Verify page shows customer table with columns: Name, Username, Status, Active License, Revenue, Actions
- [ ] Verify status filter cards (All, Active, Scheduled, Expired, Cancelled, Pending) show counts
- [ ] Verify total count matches All filter number
- [ ] **Fix:** Empty table with data existing → check `resellerService.getCustomers()` query

### S3-T2: Search Filter
- [ ] Type a customer name in search box → table filters live
- [ ] Clear search → all customers return
- [ ] Search for non-existent name → empty state shown
- [ ] **Fix:** Search not filtering → check queryKey includes `search` param

### S3-T3: Status Filter Cards
- [ ] Click "Active" card → table shows only active customers
- [ ] Click "Expired" card → table shows only expired
- [ ] Click "All" card → resets to all customers
- [ ] Verify URL updates with `?status=active` etc.
- [ ] **Fix:** Filter not working → check `status` param in API call and queryKey

### S3-T4: Sidebar Navigation Resets Filters
- [ ] Apply a filter (e.g., status=active, search=test)
- [ ] Click "Customers" in sidebar again
- [ ] Verify URL is clean (`/en/reseller/customers` no params)
- [ ] Verify filter cards reset to "All"
- [ ] **Fix:** Stale filters → verify `useEffect` on `searchParams` reset is present

### S3-T5: Pagination
- [ ] If >10 customers, verify pagination controls show
- [ ] Click "Next" → next page loads
- [ ] Change "Rows per page" to 25 → more customers load
- [ ] **Fix:** Pagination broken → check `meta.last_page` in API response

### S3-T6: Create Customer (Quick Activate from Customers page)
- [ ] Click "+" or "New Customer" / activate button in the customers page
- [ ] Fill in: Customer Name, BIOS ID, select Program, set Duration
- [ ] Submit → verify success toast and customer appears in list
- [ ] **Fix:** Form errors → check validation messages and API payload

### S3-T7: Edit Customer
- [ ] Click the ⋮ actions menu on a customer row
- [ ] Click "Edit"
- [ ] Edit the customer name
- [ ] Save → verify name updated in table
- [ ] **Fix:** Edit dialog not opening or saving → check `EditCustomerDialog` mutation

### S3-T8: Renew License from Customers Page
- [ ] Click ⋮ on a customer with an expired license
- [ ] Click "Renew License"
- [ ] Select new duration → submit
- [ ] Verify success toast, license status updates
- [ ] **Fix:** Renew dialog → check `RenewLicenseDialog` mutation

### S3-T9: Deactivate License
- [ ] Click ⋮ on a customer with active license
- [ ] Click "Deactivate"
- [ ] Confirm in dialog → verify status changes to `expired` or `cancelled`
- [ ] **Fix:** Deactivate not updating → check `licenseService.deactivate()` mutation + cache invalidation

### S3-T10: View Customer Detail
- [ ] Click the Eye / View icon on a customer row
- [ ] Verify navigation to `/en/reseller/customers/:id`
- [ ] **Fix:** Navigation broken → check `Link` href or `navigate()` call

### S3-T11: BIOS ID Display
- [ ] Verify BIOS IDs render correctly (not raw `BIOS:xxx` format)
- [ ] Verify masked display if applicable
- [ ] **Fix:** Raw BIOS format showing → check `formatUsername`/`rawBiosId` utility

---

## Sprint 4 — Customer Detail Page (`/en/reseller/customers/:id`)

### S4-T1: Customer Info Loads
- [ ] Verify customer name, email/username, status badge show correctly
- [ ] Verify license details section shows: program name, status, expiry date, BIOS ID
- [ ] **Fix:** Missing data → check `resellerService.getCustomer(id)` API response shape

### S4-T2: License Status Badge
- [ ] Verify badge color matches status (green=active, red=expired, amber=pending, etc.)
- [ ] **Fix:** Wrong color → check `getLicenseDisplayStatus()` + `StatusBadge` component

### S4-T3: Back Button
- [ ] Click back button/arrow
- [ ] Verify returns to `/en/reseller/customers`
- [ ] **Fix:** Back navigates to wrong place → check `navigate(-1)` or back path prop

### S4-T4: BIOS Change Request Dialog
- [ ] Click "Request BIOS Change" button
- [ ] Dialog opens with fields: New BIOS ID, Reason
- [ ] Fill fields → submit
- [ ] Verify success toast "Request submitted"
- [ ] **Fix:** Dialog not opening → check `requestDialogOpen` state; API → check `resellerService.submitBiosChangeRequest()`

### S4-T5: Deep-link BIOS Dialog via URL
- [ ] Navigate to `/en/reseller/customers/:id?request-bios=1`
- [ ] Verify dialog auto-opens
- [ ] **Fix:** Auto-open not working → check `useEffect` watching `searchParams.get('request-bios')`

### S4-T6: License History (if present)
- [ ] Verify multiple licenses show if customer has history
- [ ] Verify each row shows correct dates, status, program name
- [ ] **Fix:** Only 1 license showing → check `customer.licenses` array in API

---

## Sprint 5 — Software / Program Catalog (`/en/reseller/software`)

### S5-T1: Program List Loads
- [ ] Verify program cards/rows render with: name, description, price
- [ ] Verify at least 1 program shows (if programs exist in tenant)
- [ ] **Fix:** Empty list → check `programService.getAll()` or tenant program assignment

### S5-T2: Activate Button per Program
- [ ] Click "Activate" on a program card
- [ ] Verify navigation to `/en/reseller/software/:id/activate`
- [ ] Verify program name is pre-selected on activate form
- [ ] **Fix:** Wrong program pre-selected → check `state` passed via `navigate()`

### S5-T3: Search/Filter Programs (if present)
- [ ] Type program name in search → list filters
- [ ] **Fix:** Search not working → check filter state and query

---

## Sprint 6 — Activate License (`/en/reseller/software/:id/activate`)

### S6-T1: Form Renders Correctly
- [ ] Verify form shows: Customer Name, BIOS ID, Program (pre-selected), Duration fields
- [ ] Verify duration unit dropdown has: Minutes, Hours, Days
- [ ] Verify "Scheduled" toggle exists
- [ ] **Fix:** Form fields missing → check `ActivateLicensePage` shared component

### S6-T2: Activate with Duration Mode
- [ ] Fill customer name, valid BIOS ID, duration = 30 days
- [ ] Submit → verify success toast
- [ ] Navigate to customers → verify new customer appears
- [ ] **Fix:** 422 error → check required fields, BIOS format validation

### S6-T3: Activate with End Date Mode
- [ ] Switch to "End Date" mode
- [ ] Set a future date
- [ ] Submit → verify success
- [ ] **Fix:** Date format error → check ISO vs local format sent to API

### S6-T4: Scheduled Activation
- [ ] Toggle "Schedule" on
- [ ] Set a future date/time with timezone
- [ ] Submit → verify customer shows as `scheduled`
- [ ] **Fix:** Scheduled not saving → check `is_scheduled` + `scheduled_date_time` fields

### S6-T5: Validation Errors
- [ ] Submit empty form → verify field-level errors appear
- [ ] Enter invalid BIOS ID (if format enforced) → verify error
- [ ] Enter past end date → verify error
- [ ] **Fix:** Missing validation → check Zod schema in form

### S6-T6: Back Navigation
- [ ] Click back/cancel → returns to software catalog
- [ ] **Fix:** Back goes to wrong page → check `defaultBackPath` prop

---

## Sprint 7 — Renew License (`/en/reseller/customers/licenses/:id/renew`)

### S7-T1: Form Pre-fills Existing License Info
- [ ] Verify customer name, current license status, program show
- [ ] **Fix:** Blank form → check `RenewLicensePage` data loading

### S7-T2: Renew with Duration
- [ ] Enter new duration (e.g., 30 days)
- [ ] Submit → verify toast and license status updates to `active`
- [ ] **Fix:** 422 error → check API payload

### S7-T3: Back Navigation
- [ ] Cancel → returns to customers list
- [ ] **Fix:** Wrong back path → check `defaultBackPath` prop value

---

## Sprint 8 — Activations Log (`/en/reseller/activations`)

### S8-T1: Table Loads with Activation Rows
- [ ] Verify table shows columns: Date, Customer, BIOS ID, Program, Duration, Status, Revenue
- [ ] Verify at least 1 row loads
- [ ] **Fix:** Empty table → check `licenseService.getAll()` with reseller scope

### S8-T2: Search Filter
- [ ] Type customer name or BIOS ID → table filters
- [ ] Clear → all results return
- [ ] **Fix:** Search not working → check queryKey has `search`

### S8-T3: Date Range Filter
- [ ] Set "From" date → results filter to that range
- [ ] Set "To" date → results narrow further
- [ ] Clear dates → all results return
- [ ] **Fix:** Date range ignored → check `from`/`to` params in API call

### S8-T4: Pagination
- [ ] If >10 rows, verify next page works
- [ ] **Fix:** Pagination broken → check meta response

### S8-T5: Status Badge Colors
- [ ] Verify each status (active, expired, cancelled, pending, scheduled) shows correct colored badge
- [ ] **Fix:** Wrong color → check `getLicenseDisplayStatus()` return value

### S8-T6: Sidebar Reset
- [ ] Apply date range + search
- [ ] Click "Activations" in sidebar
- [ ] Verify URL resets and all filters cleared
- [ ] **Fix:** Filters persist → check `useEffect` reset logic

---

## Sprint 9 — Activity Log (`/en/reseller/activity`)

### S9-T1: Activity List Loads
- [ ] Verify activity cards/rows render with: icon, action label, date, user
- [ ] **Fix:** Empty list → check `resellerService.getActivity()` API

### S9-T2: Filter by Action Type
- [ ] Select "Activation" from dropdown → only `license.activate` entries show
- [ ] Select "Renewal" → only `license.renew` entries
- [ ] Select "Login" → only `auth.login` entries
- [ ] Select "All Actions" → all entries return
- [ ] **Fix:** Filter not narrowing → check `action` param in queryKey + API call

### S9-T3: Pagination
- [ ] If >12 entries (default perPage), verify load more / next page works
- [ ] **Fix:** Pagination stuck → check `meta.last_page` handling

### S9-T4: Action Icons
- [ ] Verify correct icon per action type (KeyRound for BIOS, LogIn for login, etc.)
- [ ] **Fix:** Wrong icon → check icon mapping in Activity component

---

## Sprint 10 — Reports Page (`/en/reseller/reports`)

### S10-T1: Default Date Range Loads (Last Year)
- [ ] Verify page loads with "Last Year" preset selected
- [ ] Verify all 4 stats cards render with values
- [ ] Verify revenue bar/line chart renders
- [ ] Verify activations chart renders
- [ ] **Fix:** Blank charts → check `resellerService.getRevenueReport()` API

### S10-T2: Date Preset Cards
- [ ] Click "Last 7 Days" → charts and stats update
- [ ] Click "Last 30 Days" → update
- [ ] Click "Last 3 Months" → update
- [ ] Click "Last Year" → update
- [ ] Verify each preset highlights the selected card
- [ ] **Fix:** Preset not triggering refetch → check `range` state + queryKey

### S10-T3: Custom Date Range Picker
- [ ] Click custom date range picker
- [ ] Select custom from/to dates
- [ ] Verify charts update to reflect custom range
- [ ] **Fix:** Picker not updating state → check `DateRangePicker` onChange handler

### S10-T4: Stats Cards Accuracy
- [ ] Verify "Total Customers" count matches Customers page
- [ ] Verify "Total Revenue" sum is consistent
- [ ] **Fix:** Discrepancy → check if report API is tenant/reseller scoped correctly

### S10-T5: Top Programs Chart
- [ ] Verify top programs bar chart renders with program names
- [ ] **Fix:** Empty chart → check `resellerService.getTopPrograms()` API

### S10-T6: Export Buttons (if present)
- [ ] Verify CSV export button triggers file download
- [ ] **Fix:** Export broken → check `ExportButtons` component handlers

### S10-T7: "View Activations" Link in Reports
- [ ] Verify "View Activations" button navigates to activations page with correct date range in URL
- [ ] **Fix:** Wrong dates in URL → check `activationDetailsUrl` construction

---

## Sprint 11 — Payment Status (`/en/reseller/payment-status`)

### S11-T1: Stats Cards Load
- [ ] Verify 4 cards show: Total Sales, Amount You Owe, Amount Paid to Manager, Still Not Paid
- [ ] Verify values are currency formatted (e.g., `$0.00`, not undefined)
- [ ] **Fix:** Cards show 0 when data exists → check `resellerService.getPaymentStatus()` summary

### S11-T2: Payment History Table
- [ ] Verify table shows columns: Date, Amount, Method, Reference, Notes
- [ ] Verify at least 1 row if payments exist
- [ ] Verify empty state shows "No payments yet" if no data
- [ ] **Fix:** Table missing columns → check `paymentColumns` definition

### S11-T3: Currency Formatting
- [ ] Verify amounts formatted with `$` and 2 decimal places
- [ ] Verify Arabic locale formats correctly in AR mode
- [ ] **Fix:** Wrong format → check `formatCurrency(amount, 'USD', locale)` call

---

## Sprint 12 — Profile Page (`/en/reseller/profile`)

### S12-T1: Profile Info Loads
- [ ] Verify name, email/username, role badge displayed
- [ ] **Fix:** Blank profile → check `ProfileWorkspace` component + profile API

### S12-T2: Edit Name/Phone
- [ ] Click "Edit" / pencil icon
- [ ] Change name → save
- [ ] Verify updated name shows in profile and navbar
- [ ] **Fix:** Update not reflecting → check profile mutation + cache invalidation

### S12-T3: Change Password
- [ ] Fill current password, new password, confirm
- [ ] Submit → verify success toast
- [ ] Logout and login with new password → confirm it works
- [ ] **Fix:** Password change failing → check `AuthController::changePassword`

### S12-T4: Timezone Setting
- [ ] Change timezone in dropdown
- [ ] Save → verify date/time displays change across the dashboard
- [ ] **Fix:** Timezone not persisting → check profile update API + `useResolvedTimezone` hook

---

## Sprint 13 — Edge Cases & Error Handling

### S13-T1: Network Error Handling
- [ ] Disable network in DevTools
- [ ] Navigate between pages → verify friendly error state (not white screen)
- [ ] Re-enable network → verify data reloads
- [ ] **Fix:** White screen on error → check React Query `isError` states in each page

### S13-T2: Empty State Displays
- [ ] Test with reseller that has 0 customers → customers page shows empty state
- [ ] 0 activations → activations page shows empty state
- [ ] 0 activity → activity shows empty state
- [ ] **Fix:** Missing empty states → add `EmptyState` component when `data.length === 0`

### S13-T3: Unauthorized Access
- [ ] While logged in as reseller, try to access `/en/super-admin/tenants`
- [ ] Verify redirect to login or 403 page
- [ ] Try `/en/manager/dashboard` → should be blocked
- [ ] **Fix:** Role guard missing → check `ProtectedRoute` role checks

### S13-T4: Direct URL Access on Refresh
- [ ] Navigate to a customer detail page
- [ ] Press F5 (hard refresh)
- [ ] Verify page reloads correctly (not 404 or blank)
- [ ] **Fix:** SPA routing issue → check Vite dev server historyApiFallback or Nginx config

### S13-T5: Mobile / Responsive Layout
- [ ] Open browser DevTools → switch to mobile viewport (375px)
- [ ] Verify sidebar collapses to hamburger menu
- [ ] Verify tables scroll horizontally
- [ ] Verify forms are usable on mobile
- [ ] **Fix:** Layout broken on mobile → check responsive Tailwind classes

### S13-T6: Long Data Handling
- [ ] Test with very long customer name (50+ chars)
- [ ] Verify table cell truncates cleanly
- [ ] Test with very long BIOS ID
- [ ] **Fix:** Overflow issues → add `truncate` class to table cells

### S13-T7: Concurrent Mutations
- [ ] Double-click the "Activate" submit button quickly
- [ ] Verify only 1 API call made (button disabled after first click)
- [ ] **Fix:** Duplicate submissions → check `isPending` disabling the button

---

## Sprint 14 — Live Data / Auto-Refresh

### S14-T1: Customers Page Live Update
- [ ] Open customers list in 2 browser tabs
- [ ] In tab 2, create a new customer
- [ ] Verify tab 1 auto-refreshes within ~30 seconds (live query interval)
- [ ] **Fix:** No auto-refresh → check `liveQueryOptions(LIVE_QUERY_INTERVAL)` applied to query

### S14-T2: License Status Live Update
- [ ] Activate a license that is set to expire in 2 minutes
- [ ] Wait for expiry → verify status badge updates without manual refresh
- [ ] **Fix:** Status stale → verify `refetchInterval` on query

---

## Sprint 15 — Internationalization (i18n)

### S15-T1: All Labels Translated (EN)
- [ ] Go through all reseller pages in EN
- [ ] Verify no translation keys leak (e.g., no `reseller.pages.customers.title` raw string showing)
- [ ] **Fix:** Missing key → add to `frontend/src/locales/en.json`

### S15-T2: All Labels Translated (AR)
- [ ] Switch to AR, go through all pages
- [ ] Verify Arabic text is correct and complete
- [ ] Verify no English text leaks into AR mode
- [ ] **Fix:** Missing Arabic key → add to `frontend/src/locales/ar.json`

### S15-T3: Date/Number Format in AR Locale
- [ ] In AR mode, verify dates use Arabic-Gregorian format
- [ ] Verify currency numbers format correctly
- [ ] **Fix:** Wrong locale → check `locale = lang === 'ar' ? 'ar-EG' : 'en-US'` usage

---

## Issue Tracker

| # | Page | Issue Description | Status | Fix Applied |
|---|------|-------------------|--------|-------------|
| 1 | Sprint 1 / Reseller Layout | Sidebar is missing `Activations` and `Activity` links, although both reseller routes work when opened directly. | Open | No |
| 2 | Sprint 2 / Dashboard | Dashboard and quick-action labels no longer match the current plan exactly; plan drift confirmed. | Open | No |
| 3 | Sprint 3 / Customers | Renew success toast is generic `Saved` instead of a renew-specific confirmation. | Open | No |
| 4 | Sprint 3 / Customers | Active customer action menu still exposes `Delete` alongside active-license actions. | Open | No |
| 5 | Sprint 6 / Activate | Activate page field accessibility/targeting is brittle; input targeting required fresh refs/reload for reliable automation. | Open | No |
| 6 | Sprint 8 / Activations | Activations page works, but reseller sidebar does not expose it. | Open | No |
| 7 | Sprint 9 / Activity | Activity page works, but reseller sidebar does not expose it. | Open | No |
| 8 | Sprint 9 / Activity | Some activity entries still show raw/internal action labels such as `bios.change_requested` and `customer.created`. | Open | No |
| 9 | Sprint 11 / Payment Status | Stat naming differs from plan (`Total Owed` vs `Amount You Owe`). | Open | No |
| 10 | Sprint 13 / Unauthorized Access | Unauthorized reseller access redirects to reseller dashboard instead of login or a 403-style page. | Open | No |
| 11 | Sprint 13 / Error Handling | API failure handling does not white-screen, but it floods the UI with duplicate error toasts. | Open | No |
| 12 | Sprint 14 / Live Data | Live customer refresh works across sessions; this check is confirmed passing. | Closed | N/A |
| 13 | Sprint 15 / i18n | Arabic rendering is correct in-browser; earlier mojibake was snapshot encoding only. | Closed | N/A |

---

## Testing Commands Reference (Playwright MCP)

```
// Navigate
mcp_playwright_navigate { url: "http://localhost:3000/en/login" }

// Screenshot
mcp_playwright_screenshot {}

// Click element
mcp_playwright_click { selector: "button[type=submit]" }

// Fill input
mcp_playwright_fill { selector: "input[name=username]", value: "reseller1" }

// Wait for selector
mcp_playwright_wait_for_selector { selector: ".toast-success" }

// Evaluate JS
mcp_playwright_evaluate { script: "document.title" }

// Check console errors
mcp_playwright_console_messages {}
```

---

## Definition of Done per Sprint

- [ ] All test cases in the sprint executed
- [ ] All failures documented in Issue Tracker above
- [ ] All critical/blocking issues fixed and re-tested
- [ ] Screenshots taken for before/after fixes
- [ ] No new console errors introduced

---

*Last updated: 2026-03-15 | Priority: Reseller dashboard QA before next release*
