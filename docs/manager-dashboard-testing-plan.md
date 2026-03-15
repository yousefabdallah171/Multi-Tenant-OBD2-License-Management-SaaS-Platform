# Manager Dashboard — Full Testing Plan (Playwright MCP)

> **Role under test:** `manager`
> **Base URL:** `http://localhost:3000`
> **Login route:** `/en/login`
> **Manager base route:** `/en/manager`
> **Test tool:** Playwright MCP (browser automation)
> **Languages to test:** English (`en`) + Arabic (`ar`)
>
> **Shared components covered here (used by manager):**
> - `ProgramCatalogPage`, `ActivateLicensePage`, `RenewLicensePage`
> - `CustomerCreatePage`, `ProfileWorkspace`
> - `RoleResellerPaymentsPage`, `RoleResellerPaymentDetailPage`
> - `DataTable`, `StatusFilterCard`, `EditCustomerDialog`, `RenewLicenseDialog`
> - `ConfirmDialog`, `StatusBadge`, `RoleBadge`, `ExportButtons`

---

## Pre-Test Setup Checklist

- [ ] Laragon (MySQL + PHP) running; backend on port `8000`
- [ ] Vite dev server running on port `3000`
- [ ] Test manager account exists with known credentials
- [ ] At least 2 resellers created under this manager
- [ ] At least 5 customers across resellers (mix of active, expired, pending)
- [ ] At least 1 program created and active for this tenant
- [ ] At least 1 BIOS change request pending
- [ ] At least 1 reseller payment record exists
- [ ] Playwright MCP connected and browser open

## Execution Status

> Latest execution: `2026-03-15`  
> Scope completed so far: `Sprints 1-23`  
> Role/session used: `manager` via `reseller2@obd2sw.com`

### Outcome Summary

- Sprint 1 passed functionally for login, layout, language switch, dark mode, logout, and protected-route enforcement after logout.
- Sprint 2 passed functionally for dashboard stats, charts, quick actions, and AR route rendering.
- Sprint 3 passed for search, filters, create, edit, deactivate, reactivate, delete, and customer-detail navigation, with some plan drift and cache-delay findings.
- Sprint 4 passed for customer info, grouped license history, BIOS deep links, and back navigation.

### Confirmed Findings From Sprints 1-23

- Manager sidebar no longer matches the written plan exactly: `Panel Activity` is used instead of `Activity`, and `BIOS` is a collapsible group instead of two flat links.
- Unauthorized-role redirects while logged in send the manager back to `/en/manager/dashboard` instead of a login or `403` outcome.
- Customer list mutations can update summary cards before the row status refreshes, causing short-lived stale table state after deactivate/reactivate actions.
- Active customer row actions still expose `Delete`, which is risky for live licenses.
- Arabic dashboard chrome is translated and RTL works, but recent activity action labels and descriptions remain in English.
- The customer-create flow is now a dedicated route at `/en/manager/customers/create`, not an inline dialog.
- Team create-reseller dialog no longer exposes a visible `Username` field. Username is auto-generated from the email/name flow in the current UI.
- Team action wording/status strings use `Deactive` instead of `Suspend` or `Inactive`.
- Team member detail pages expose raw/internal action labels such as `team.create`, `team.update`, and `team.status`.
- Software management no longer has a quick-create dialog. `Add Program` routes directly to `/en/manager/software-management/create`.
- Creating a program rejects unresolved external API hosts and surfaces `External API base URL host could not be resolved.`
- Program status toggling is inconsistent: deactivating works, but clicking the `Active` control on an inactive program opened a customer registration dialog instead of simply reactivating the program.
- Manager activate-license form differs from the written plan: no visible program picker, no unscheduled duration/end-date mode switch, and the schedule controls expose `Custom Date` plus `Duration Mode` only after enabling scheduling.
- Manager customer-create page is still the shared activation form. The documented customer-only form without program/license fields does not exist as a separate UI.
- Customer-only manager creation currently requires a program selection and permits duplicate BIOS IDs. Creating a second record for BIOS `EEEE` succeeded instead of surfacing a duplicate-BIOS validation error.
- Manager customers list can briefly render impossible summary states after create flows, for example `All 0` while other status cards still contain non-zero values until a reload.
- Manager renew/increase-duration is inconsistent: the row action for customer `eeee` routes to `/en/manager/customers/licenses/20/renew`, which never loads because `/api/licenses/20` returns `404`, while newer manager-created licenses do open a working renew page.
- BIOS details page exposes a raw translation key in the header description: `biosDetails.description`.
- BIOS details search is unstable. Searching for `MG` triggered repeated `500` responses from `/api/manager/bios/search?query=MG`.
- BIOS detail resolution can bind a BIOS to the wrong current customer when duplicate BIOS values exist. Opening `EEEE` surfaced the pending duplicate record as the active overview context.
- Customer-detail BIOS deep-linking is inconsistent: `/en/manager/bios-details/BIOS-S6-20260315001820` loads the tab shell but leaves overview data blank.
- BIOS change request approval success copy is now `BIOS change approved but external sync is pending.` instead of the simpler approval toast documented in the plan.
- Payment detail dialog is missing a dialog description / `aria-describedby`, and Radix emits accessibility warnings in the console when `Record Payment` opens.
- Reports page works, but the current stat set is `Total Tenant Revenue`, `Total Customers`, `Current Active Customers`, and `Total Activations`; the older `Active Licenses` wording is no longer present.
- Reports deep-linking works from the `Total Activations` card to `/en/manager/reseller-logs?action=license.activated`, but it currently omits the active date range params described in the plan.
- Manager activity log uses raw/internal action keys such as `license.renewed`, `manager.program.create`, and `team.status` instead of fully humanized labels.
- Activity export works and downloads `manager-activity.csv`.
- Reseller logs use simplified action labels in the filter UI (`Activate`, `Renew`, `Deactivate`, `Delete`), but the full log stream still includes raw/internal values like `bios.change_requested` and `bios.change_approved`.
- Clicking a customer link from reseller logs can land on the right customer route while initially rendering only the detail-page shell without the expected data blocks.
- Profile save, password change, timezone persistence, and header/navbar refresh all work.
- Full browser-storage clearing correctly redirects protected manager routes to `/en/login`. Clearing cookies alone was not sufficient to force logout behavior.
- Hard refresh on manager deep URLs works for `/en/manager/customers/61`.
- Mobile manager customer detail remains usable at `375x812`.
- Arabic reports render with RTL layout and Arabic currency formatting, but manager BIOS pages in Arabic still contain untranslated/garbled text including `biosDetails.description` and mixed `????` labels.

### Partial / Not Yet Executed In This Pass

- Sprint 3 pagination stress test could not be fully exercised because the dataset stayed on a single page.
- Sprint 3 renew-from-expired and retry-failed-schedule were not executable because no expired or `scheduled_failed` rows were available in the current dataset.
- Sprint 4 live auto-refresh on the detail page was not revalidated yet in the manager pass.
- Sprint 6 commission override was not testable because no commission override field was present on the team member detail pages I validated.
- Sprint 8 quick-create dialog was not executable because the current app routes directly to the full program form.
- Sprint 9 explicit unscheduled `Duration` vs `End Date` mode switching was not testable because the current unscheduled form only exposed the end-date style field.
- Sprint 10 pure customer-only form could not be tested as documented because the current route is still the shared activation form.
- Sprint 11 end-date-vs-duration renewal parity could only be partially sampled because one seed license route is broken while a newer manager-created license route works.
- Sprint 13 reject-confirm flow was intentionally not completed because only one pending BIOS change request existed and approving it was more valuable for downstream state validation.
- Sprint 13 pagination could not be stress-tested because only one BIOS change request existed.
- Sprint 15 record-payment, edit-payment, and commission-management mutations were blocked by seed data: no commission periods and no payment history rows were available for the validated reseller.
- Sprint 16 PDF export was present but not independently validated beyond the clickable control.
- Sprint 20 explicit sticky-header behavior could not be strongly proven in this headless pass even though the larger data tables remained navigable.
- Sprint 20 confirm-dialog keyboard testing was not explicitly driven with Enter/Escape key events in this pass.
- Sprint 20 date-range-picker min/max constraint enforcement was only partially sampled through direct date entry, not exhaustive invalid-range interaction.
- Sprint 21 network-failure simulation on manager pages was inconclusive in this session because route mocking interacted poorly with the multi-tab `playwright-cli` state.
- Sprint 21 fresh-manager empty-state testing was not possible without a separate clean manager account.
- Sprint 21 special-character BIOS URL encoding was not exhaustively sampled with a newly created encoded BIOS value.
- Sprint 21 double-submit protection was not stress-tested with network instrumentation.
- Sprint 22 live auto-refresh was not fully proven in a clean second authenticated manager session because the auxiliary session could not be stabilized quickly enough under `playwright-cli`.

### QA Test Data Used

- Temporary customer created and removed during Sprint 3:
  - `QA Manager Sprint3 Updated mgr17735371847002`
  - BIOS: `BIOS-MGR17735371847002`
  - Final state: deleted
- Temporary reseller created and removed during Sprint 5-6:
  - `QA Manager Team Detail Updated mgrteam1773531760`
  - Final state: deleted
- Temporary program created and removed during Sprint 8:
  - `QA Manager Program mgrprog1773532146`
  - Final state: deleted
- Temporary license/customer records created during Sprint 9:
  - Active: `QA Manager Activate mgract1773532399`
  - Scheduled custom date: `QA Manager Scheduled mgrsched1773532467`
  - Scheduled duration mode: `QA Manager Relative mgrrel1773532520`
- Additional temporary customer records created during Sprint 10:
  - Pending: `QA Manager Customer mgrcust1773532751`
  - Duplicate BIOS pending: `Duplicate BIOS Manager`

---

## Sprint 1 — Authentication & Layout

### S1-T1: Login as Manager
- [ ] Navigate to `http://localhost:3000/en/login`
- [ ] Enter manager username + password
- [ ] Verify redirect to `/en/manager/dashboard`
- [ ] Verify navbar shows manager name, role badge "Manager"
- [ ] **Fix:** Wrong redirect → check `AuthController` role routing

### S1-T2: Sidebar Links — All Present
- [ ] Verify sidebar contains: Dashboard, Customers, Team, Software, Software Management, BIOS Details, BIOS Change Requests, Reseller Payments, Reports, Activity, Reseller Logs, Profile
- [ ] Click each link → verify URL changes correctly
- [ ] Verify active link highlighted
- [ ] **Fix:** Missing sidebar items → check manager layout/nav config

### S1-T3: Language Switch EN → AR
- [ ] Click AR button in navbar
- [ ] Verify URL prefix changes: `/en/manager/` → `/ar/manager/`
- [ ] Verify all text is Arabic, layout flips RTL
- [ ] Switch back to EN → verify LTR restored
- [ ] **Fix:** RTL layout broken → check `dir="rtl"` on `<html>` and `isRtl` in useLanguage

### S1-T4: Dark Mode Toggle
- [ ] Toggle dark mode → all pages go dark, text readable
- [ ] Check tables, charts, dialogs, badges in dark
- [ ] Toggle back to light
- [ ] **Fix:** Dark mode breaking layout → check Tailwind `dark:` classes on problem elements

### S1-T5: Logout
- [ ] Open user menu → click logout
- [ ] Verify redirect to `/en/login`
- [ ] Try accessing `/en/manager/dashboard` directly → redirected to login
- [ ] **Fix:** Protected routes not blocking → check `ProtectedRoute` role check

### S1-T6: Unauthorized Role Access
- [ ] While logged in as manager, navigate to `/en/reseller/dashboard`
- [ ] Navigate to `/en/super-admin/tenants`
- [ ] Both should redirect to login or show 403
- [ ] **Fix:** Missing role guards → check `ProtectedRoute` allowed roles list

---

## Sprint 2 — Dashboard (`/en/manager/dashboard`)

### S2-T1: Stats Cards Load
- [ ] Verify 4 stats cards render: Total Customers, Active Licenses, Total Resellers (team), Total Revenue
- [ ] Verify values are numeric and non-zero if data exists
- [ ] Verify no skeleton hangs forever
- [ ] **Fix:** Stats missing → check `managerService.getDashboard()` API

### S2-T2: Activations Bar/Line Chart
- [ ] Verify monthly activations chart renders with data
- [ ] Verify month labels are localized (English: Jan/Feb; Arabic: يناير/فبراير)
- [ ] Verify tooltip appears on hover
- [ ] **Fix:** Blank chart → check `statsQuery.data.activationsChart`

### S2-T3: Recent Activity Feed
- [ ] Verify recent activity list shows entries with: icon, action label, actor name, date
- [ ] Verify `formatActivityActionLabel()` produces readable labels (not raw `license.activate`)
- [ ] **Fix:** Raw action labels → check `formatActivityActionLabel()` in `utils.ts`

### S2-T4: Quick Action Buttons
- [ ] Click "Team" button → navigates to `/en/manager/team`
- [ ] Click "Customer Overview" button → navigates to `/en/manager/customers`
- [ ] **Fix:** Navigation broken → check button `onClick` in Dashboard component

### S2-T5: Dashboard in AR Mode
- [ ] Switch to AR, reload dashboard
- [ ] Verify charts show Arabic month labels
- [ ] Verify stat card numbers formatted in Arabic-Gregorian locale
- [ ] **Fix:** Locale not applied → check `locale = lang === 'ar' ? 'ar-EG' : 'en-US'` usage

---

## Sprint 3 — Customers Page (`/en/manager/customers`)

### S3-T1: Customer Table Loads
- [ ] Verify table columns: Name, Username/BIOS, Reseller, Status, Active License, Revenue, Actions
- [ ] Verify status filter cards (All, Active, Scheduled, Expired, Cancelled, Pending) show counts
- [ ] **Fix:** Empty table with existing data → check `managerService.getCustomers()` API

### S3-T2: Search Filter
- [ ] Type customer name → table live-filters
- [ ] Search by BIOS ID → matching rows appear
- [ ] Clear search → all customers return
- [ ] **Fix:** Search ignored → check `search` in queryKey + API call

### S3-T3: Status Filter Cards
- [ ] Click "Active" → only active customers show
- [ ] Click "Expired" → only expired show
- [ ] Click "Scheduled" → only scheduled show
- [ ] Click "All" → resets
- [ ] Verify URL updates with `?status=...`
- [ ] **Fix:** Filter not working → check `status` param in queryKey

### S3-T4: Sidebar Navigation Resets Filters
- [ ] Apply status + search filters
- [ ] Click "Customers" in sidebar
- [ ] Verify URL is clean, all filters reset
- [ ] **Fix:** Stale filters → verify `useEffect` watching `searchParams.toString() === ''`

### S3-T5: Pagination
- [ ] With >10 customers, verify next/prev page works
- [ ] Change rows per page to 25 → more rows load
- [ ] **Fix:** Pagination broken → check `meta.last_page`

### S3-T6: Create Customer / Activate License (inline dialog)
- [ ] Click "+" or "Add Customer" button
- [ ] Dialog opens with fields: Customer Name, BIOS ID, Program, Duration
- [ ] Fill all required fields → submit
- [ ] Verify success toast + new customer appears in table
- [ ] **Fix:** Dialog not opening / 422 → check required fields and API payload

### S3-T7: Edit Customer
- [ ] Click ⋮ actions on a customer row → click "Edit"
- [ ] Change customer name → save
- [ ] Verify name updated in table
- [ ] **Fix:** `EditCustomerDialog` not saving → check mutation + cache invalidation

### S3-T8: Renew License from Table
- [ ] Click ⋮ on expired customer → click "Renew License"
- [ ] Select duration → submit
- [ ] Verify status changes to `active`
- [ ] **Fix:** `RenewLicenseDialog` error → check `licenseService.renew()` + queryKey invalidation

### S3-T9: Deactivate License
- [ ] Click ⋮ on active customer → click "Deactivate"
- [ ] Confirm → verify status changes to `cancelled`/`expired`
- [ ] **Fix:** Deactivate failing → check API call + confirmation dialog flow

### S3-T10: Delete Customer
- [ ] Click ⋮ → click "Delete"
- [ ] Confirm in dialog → customer removed from table
- [ ] Verify success toast
- [ ] **Fix:** Delete failing → check `managerService.deleteCustomer()` + ConfirmDialog

### S3-T11: Reactivate License (if expired)
- [ ] Find a customer whose license `canReactivateLicense()` returns true
- [ ] Click ⋮ → "Reactivate"
- [ ] Verify status returns to `active`
- [ ] **Fix:** Button not showing → check `canReactivateLicense()` utility logic

### S3-T12: Scheduled Activation
- [ ] Create a new activation with "Schedule" toggled on
- [ ] Set future date/time + timezone
- [ ] Submit → verify customer shows as `scheduled`
- [ ] **Fix:** Scheduled not saving → check `is_scheduled`, `scheduled_date_time`, `scheduled_timezone` fields

### S3-T13: Retry Failed Schedule
- [ ] If a `scheduled_failed` customer exists → click ⋮ → "Retry"
- [ ] Verify status updates
- [ ] **Fix:** Retry button missing → check `canRetryScheduledLicense()` logic

### S3-T14: View Customer Detail
- [ ] Click Eye/View icon on any customer row
- [ ] Verify navigation to `/en/manager/customers/:id`
- [ ] **Fix:** Navigation broken → check `Link` href

---

## Sprint 4 — Customer Detail (`/en/manager/customers/:id`)

### S4-T1: Customer Info Section
- [ ] Verify: name, username/BIOS ID, status badge, assigned reseller
- [ ] **Fix:** Missing data → check `managerService.getCustomer(id)`

### S4-T2: License Details
- [ ] Verify: program name, status badge, start date, expiry date, BIOS ID
- [ ] Verify status badge colors match status
- [ ] **Fix:** Wrong badge color → check `getLicenseDisplayStatus()` + `StatusBadge`

### S4-T3: License History by Reseller
- [ ] Verify license history groups by reseller
- [ ] Each group shows: reseller name + list of license periods
- [ ] **Fix:** History missing → check `managerService.getCustomerLicenseHistory(id)`

### S4-T4: IP Location Display
- [ ] If customer has IP login history → verify `IpLocationCell` renders flag + country name
- [ ] **Fix:** Country flag missing → check `IpLocationCell` utility + country data

### S4-T5: Back Button
- [ ] Click back → returns to `/en/manager/customers`
- [ ] **Fix:** Wrong back path → check `navigate(routePaths.manager.customers(lang))`

### S4-T6: Live Auto-Refresh
- [ ] In another tab, change a license status for this customer
- [ ] Verify detail page updates within interval (live query)
- [ ] **Fix:** No refresh → check `liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_DETAIL)`

---

## Sprint 5 — Team Management (`/en/manager/team`)

### S5-T1: Reseller List Loads
- [ ] Verify table shows: Name, Username, Email, Phone, Status, Balance, Actions
- [ ] Verify at least 1 reseller row
- [ ] **Fix:** Empty list → check `managerService.getTeam()` API

### S5-T2: Create Reseller
- [ ] Click "Add Reseller" button
- [ ] Dialog opens with: Name, Email, Password, Phone, Username
- [ ] Fill all fields → submit
- [ ] Verify success toast + new reseller in table
- [ ] **Fix:** 422 on create → check validation: unique email/username, password strength

### S5-T3: Password Visibility Toggle
- [ ] In create dialog, click Eye icon on password field
- [ ] Verify input changes from `type="password"` to `type="text"`
- [ ] Click again → hidden again
- [ ] **Fix:** Toggle broken → check `Eye`/`EyeOff` icon state in Team.tsx

### S5-T4: Edit Reseller
- [ ] Click ⋮ → "Edit" on a reseller row
- [ ] Modify name, phone → save
- [ ] Verify updates reflected in table
- [ ] **Fix:** Edit dialog not persisting → check mutation + cache invalidation

### S5-T5: Suspend Reseller
- [ ] Click ⋮ → "Suspend" on an active reseller
- [ ] Confirm → status changes to `suspended`
- [ ] **Fix:** Suspend failing → check `managerService.suspendTeamMember()` API

### S5-T6: Unsuspend Reseller
- [ ] On a suspended reseller → click ⋮ → "Unsuspend" / "Activate"
- [ ] Verify status returns to `active`
- [ ] **Fix:** Unsuspend option missing → check status-conditional menu item visibility

### S5-T7: Delete Reseller
- [ ] Click ⋮ → "Delete" → confirm
- [ ] Verify reseller removed from table
- [ ] Verify success toast
- [ ] **Fix:** Delete error → check `managerService.deleteTeamMember()` + ConfirmDialog

### S5-T8: View Team Member Detail
- [ ] Click reseller name or Eye icon → navigates to `/en/manager/team/:id`
- [ ] **Fix:** Navigation broken → check `Link` or `navigate()` target

### S5-T9: Phone Validation
- [ ] Enter invalid phone number in create/edit form
- [ ] Verify inline error: "Invalid phone number"
- [ ] Enter valid format (+1234...) → error clears
- [ ] **Fix:** Validation missing → check `isValidPhoneNumber()` + `normalizePhoneInput()`

---

## Sprint 6 — Team Member Detail (`/en/manager/team/:id`)

### S6-T1: Reseller Info Card
- [ ] Verify: name, username, email, phone, role badge, status badge
- [ ] **Fix:** Missing data → check `managerService.getTeamMember(id)`

### S6-T2: Edit Reseller Info
- [ ] Click "Edit" button → dialog opens pre-filled
- [ ] Change name/phone → save
- [ ] Verify updated in page header
- [ ] **Fix:** Edit dialog not pre-filling → check `form` state initialization from `detailQuery.data`

### S6-T3: Commission Override
- [ ] Find commission rate field (if present)
- [ ] Change commission percentage → save
- [ ] **Fix:** Commission not saving → check commission mutation API

### S6-T4: Customer List for Reseller
- [ ] Verify table of customers assigned to this reseller loads
- [ ] Verify: customer name, license status, BIOS ID, activation date
- [ ] Click customer → navigates to customer detail
- [ ] **Fix:** Customer list empty when data exists → check `managerService.getTeamMember()` response shape

### S6-T5: Activity Log for Reseller
- [ ] Verify reseller's recent activity section loads
- [ ] Each entry shows: action label, date, description
- [ ] Verify `isCustomerLicenseHistoryAction()` filters correctly
- [ ] **Fix:** Activity missing → check `formatActivityActionLabel()` and data structure

### S6-T6: Back Navigation
- [ ] Click back → returns to `/en/manager/team` (preserving scroll/state if applicable)
- [ ] **Fix:** Back navigates wrong → check `returnTo` from `location.state`

---

## Sprint 7 — Software Catalog (`/en/manager/software`)

### S7-T1: Program List Loads
- [ ] Verify program cards render with: name, description, version, base price (visible to manager), icon
- [ ] Note: manager can see `base_price` (unlike reseller where it's hidden)
- [ ] **Fix:** Empty list → check `ProgramCatalogPage` with manager prop `showBasePrice={true}` (default)

### S7-T2: Activate Button
- [ ] Click "Activate" on a program → navigate to `/en/manager/software/:id/activate`
- [ ] Verify program pre-selected on activate form
- [ ] **Fix:** Navigation broken → check `onActivate` handler in Software.tsx

### S7-T3: Search/Filter Programs
- [ ] Type program name in search → list filters
- [ ] Clear → all programs show
- [ ] **Fix:** Search not filtering → check `ProgramCatalogPage` filter state

---

## Sprint 8 — Software Management (`/en/manager/software-management`)

### S8-T1: Program List Loads
- [ ] Verify program cards/rows: name, version, base price, status badge (Active/Inactive)
- [ ] **Fix:** Empty list → check `managerService.getPrograms()` or `programService.getAll()`

### S8-T2: Create Program (Quick Dialog)
- [ ] Click "Add Program" button
- [ ] Dialog with fields: Name, Description, Version, Base Price, Download Link, Icon, External API key/ID
- [ ] Fill all → submit
- [ ] Verify success toast + program appears in list
- [ ] **Fix:** 422 on create → check required fields (name, base_price)

### S8-T3: Create Program (Full Form)
- [ ] Click "Create (Full Form)" or "Advanced" link → navigate to `/en/manager/software-management/create`
- [ ] Verify all fields present: Name, Description, Version, Download Link, File Size, System Requirements, Installation Guide URL, Base Price, Status, Icon, External API Key, External Software ID, External API Base URL, External Logs Endpoint
- [ ] Fill and submit → verify success + redirect to software management list
- [ ] **Fix:** Full form missing fields → check `ProgramForm.tsx` FormState

### S8-T4: Preset Editor in Full Form
- [ ] In full form, find "Presets" section
- [ ] Add a preset: duration, price
- [ ] Delete a preset
- [ ] Reorder presets (if drag supported)
- [ ] Submit form → verify presets saved
- [ ] **Fix:** Presets not saving → check `ProgramPresetEditor` + `mapProgramPresetsToEditable()`

### S8-T5: Edit Program (Full Form)
- [ ] Click ⋮ → "Edit (Full Form)" on a program → navigate to `/en/manager/software-management/:id/edit`
- [ ] Verify all fields pre-filled with existing data
- [ ] Modify version → save → verify update in list
- [ ] **Fix:** Form not pre-filling → check `useQuery` for program + `useEffect` setting form state

### S8-T6: Toggle Program Active/Inactive
- [ ] Click ⋮ → "Deactivate" on an active program
- [ ] Verify status badge changes to "Inactive"
- [ ] Click "Activate" on inactive → status returns to Active
- [ ] **Fix:** Toggle failing → check `managerService.toggleProgramStatus()` + Eye/EyeOff icon logic

### S8-T7: Delete Program
- [ ] Click ⋮ → "Delete" → confirm in ConfirmDialog
- [ ] Verify program removed from list
- [ ] **Fix:** Delete failing → check `managerService.deleteProgram()` + invalidation

### S8-T8: External API Key Visibility Toggle
- [ ] In program form, find External API Key field
- [ ] Click Eye → key is revealed
- [ ] Click EyeOff → hidden again
- [ ] **Fix:** Toggle broken → check `Eye`/`EyeOff` state in `ProgramForm.tsx`

---

## Sprint 9 — Activate License (`/en/manager/software/:id/activate`)

### S9-T1: Form Renders Correctly
- [ ] Verify fields: Customer Name, Client Name, BIOS ID, Program (pre-selected), Duration/End Date mode
- [ ] Verify "Schedule" toggle present
- [ ] Verify timezone dropdown (COMMON_TIMEZONES)
- [ ] **Fix:** Missing fields → check `ActivateLicensePage` shared component

### S9-T2: Activate with Duration Mode
- [ ] Fill all fields, set 30 days duration
- [ ] Submit → success toast + customer appears in customers list
- [ ] **Fix:** 422 error → check required field names + BIOS ID format

### S9-T3: Activate with End Date Mode
- [ ] Switch to "End Date" mode → set future date
- [ ] Submit → verify success
- [ ] **Fix:** Date format error → check ISO vs `datetime-local` format

### S9-T4: Scheduled Activation — Relative Offset
- [ ] Enable schedule → choose "Relative" mode
- [ ] Set: starts in 2 hours
- [ ] Submit → customer shows `scheduled`
- [ ] **Fix:** Schedule not saving → check `schedule_mode: 'relative'` + offset fields

### S9-T5: Scheduled Activation — Custom Date
- [ ] Enable schedule → choose "Custom Date" mode
- [ ] Pick future date + timezone
- [ ] Submit → verify `scheduled` status
- [ ] **Fix:** Timezone mismatch → check `formatDateTimeLocalInTimezone()`

### S9-T6: Validation — Empty Form Submit
- [ ] Click Submit with empty form → verify field-level errors appear
- [ ] **Fix:** No validation → check Zod schema or inline validation in `ActivateLicensePage`

### S9-T7: Back Navigation
- [ ] Click Cancel/Back → returns to `/en/manager/software`
- [ ] **Fix:** Wrong back path → check `defaultBackPath={routePaths.manager.software}` prop

---

## Sprint 10 — Create Customer (`/en/manager/customers/create`)

### S10-T1: Form Loads
- [ ] Verify fields: Customer Name, Client Name, Email (optional), Phone (optional), BIOS ID
- [ ] Verify no program/license fields (customer-only create, no activation)
- [ ] **Fix:** Wrong form → check `CustomerCreatePage` shared component

### S10-T2: Create Customer — Valid Data
- [ ] Fill name + BIOS ID → submit
- [ ] Verify success toast + redirect to customers list
- [ ] Verify new customer in table
- [ ] **Fix:** API error → check `managerService.createCustomer()` payload

### S10-T3: Validation Errors
- [ ] Submit with empty name → error shown
- [ ] Enter duplicate BIOS ID → verify API error displayed
- [ ] **Fix:** Error not shown → check `resolveApiErrorMessage()` handling

### S10-T4: Back Button
- [ ] Click back → returns to `/en/manager/customers`
- [ ] **Fix:** Wrong path → check `backPath={routePaths.manager.customers}` prop

---

## Sprint 11 — Renew License (`/en/manager/customers/licenses/:id/renew`)

### S11-T1: Form Pre-fills Data
- [ ] Navigate from expired customer ⋮ menu → Renew
- [ ] Verify: customer name, current status, program name shown
- [ ] **Fix:** Blank form → check `RenewLicensePage` data loading from URL param

### S11-T2: Renew with Duration
- [ ] Enter 30 days → submit
- [ ] Verify toast success + license status → `active`
- [ ] Verify cache invalidated for `['manager']` queryKey
- [ ] **Fix:** Cache not updating → check `invalidateQueryKey={['manager']}` prop

### S11-T3: Renew with End Date
- [ ] Switch to end date mode → pick future date → submit
- [ ] **Fix:** Date format issue → check date serialization

---

## Sprint 12 — BIOS Details (`/en/manager/bios-details`)

### S12-T1: Search BIOS ID
- [ ] Type at least 2 characters in search box
- [ ] Verify dropdown/list of matching BIOS IDs appears
- [ ] Click a result → detail panel loads
- [ ] **Fix:** Search not triggering → check `enabled: search.trim().length >= 2` query condition

### S12-T2: Recent BIOS IDs
- [ ] On page load (no search), verify "Recent" list shows up to 20 BIOS IDs
- [ ] Click one → detail panel loads
- [ ] **Fix:** Recent list empty → check `managerBiosDetailsService.getRecentBiosIds(20)`

### S12-T3: BIOS Overview Tab
- [ ] With a BIOS ID selected, verify Overview tab shows:
  - Customer name, current status, reseller assigned, activation count
- [ ] **Fix:** Overview blank → check `managerBiosDetailsService.getBiosOverview(biosId)`

### S12-T4: Licenses Tab
- [ ] Click "Licenses" tab for selected BIOS ID
- [ ] Verify table of all licenses for this BIOS: program, dates, status
- [ ] Verify status badges correct
- [ ] **Fix:** Licenses empty → check `managerBiosDetailsService.getBiosLicenses(biosId)`

### S12-T5: Resellers Tab
- [ ] Click "Resellers" tab
- [ ] Verify list of resellers who handled this BIOS
- [ ] **Fix:** Empty → check `managerBiosDetailsService.getBiosResellers(biosId)` (check resellers query)

### S12-T6: Deep-link via URL
- [ ] Navigate to `/en/manager/bios-details?bios=DEMO-BIOS-001`
- [ ] Verify BIOS ID auto-populates and detail loads
- [ ] **Fix:** URL param not read → check `const biosId = params.biosId ?? searchParams.get('bios') ?? ''`

### S12-T7: Navigate from Customers → BIOS Details
- [ ] In customer detail, click BIOS ID link (if present)
- [ ] Verify navigates to `/en/manager/bios-details/:biosId` with detail loaded
- [ ] **Fix:** Link broken → check `routePaths.manager.biosDetail()` usage

---

## Sprint 13 — BIOS Change Requests (`/en/manager/bios-change-requests`)

### S13-T1: Page Loads with Pending Requests
- [ ] Default filter is "Pending" — verify pending requests show in table
- [ ] Columns: Date, Reseller, Customer, Old BIOS, New BIOS, Status, Actions
- [ ] **Fix:** Empty when requests exist → check `managerService.getBiosChangeRequests({ status: 'pending' })`

### S13-T2: Filter by Status
- [ ] Switch to "Approved" → only approved requests show
- [ ] Switch to "Rejected" → only rejected
- [ ] Switch to "All" (empty status) → all requests
- [ ] **Fix:** Filter not working → check `status` in queryKey + API param

### S13-T3: Approve Request
- [ ] Click "Approve" on a pending request
- [ ] Verify success toast: "Request approved"
- [ ] Verify row moves out of Pending filter
- [ ] **Fix:** Approve failing → check `managerService.approveBiosChangeRequest(id)`

### S13-T4: Reject Request with Notes
- [ ] Click "Reject" on a pending request
- [ ] Dialog opens with notes textarea
- [ ] Type rejection reason → confirm
- [ ] Verify success toast: "Request rejected"
- [ ] Verify row removed from Pending filter
- [ ] **Fix:** Reject dialog not opening → check `rejectTarget` state; API → check `managerService.rejectBiosChangeRequest(id, notes)`

### S13-T5: Cancel/Close Reject Dialog
- [ ] Open reject dialog → click Cancel
- [ ] Verify dialog closes, no API call made
- [ ] **Fix:** Dialog not closing → check `setRejectTarget(null)` on cancel

### S13-T6: Pagination
- [ ] With >15 requests (default perPage), verify next page works
- [ ] **Fix:** Pagination broken → check `meta.last_page` handling

---

## Sprint 14 — Reseller Payments (`/en/manager/reseller-payments`)

### S14-T1: Reseller List Loads
- [ ] Verify table: Reseller Name, Total Sales, Amount Owed, Amount Paid, Outstanding Balance, Actions
- [ ] **Fix:** Empty list → check `managerService.getResellerPayments()` via `RoleResellerPaymentsPage`

### S14-T2: Click Reseller → Detail Page
- [ ] Click a reseller row or "View" button
- [ ] Verify navigation to `/en/manager/reseller-payments/:resellerId`
- [ ] **Fix:** Navigation broken → check `detailPath` prop in `RoleResellerPaymentsPage`

### S14-T3: Currency Formatting
- [ ] Verify amounts formatted as `$XXX.XX`
- [ ] In AR mode → verify Arabic locale formatting
- [ ] **Fix:** Wrong format → check `formatCurrency(amount, 'USD', locale)`

---

## Sprint 15 — Reseller Payment Detail (`/en/manager/reseller-payments/:id`)

### S15-T1: Page Loads with Reseller Info
- [ ] Verify: reseller name, role badge, total sales, amount owed, total paid, outstanding balance
- [ ] **Fix:** Blank page → check `managerService.getResellerPaymentDetail(id)` via `RoleResellerPaymentDetailPage`

### S15-T2: Record a Payment
- [ ] Click "Record Payment" button
- [ ] Fill: Amount, Date, Method (cash/bank/other), Reference, Notes
- [ ] Submit → verify success toast
- [ ] Verify outstanding balance decreases
- [ ] **Fix:** Payment not recording → check `managerService.recordPayment()` + cache invalidation

### S15-T3: Edit Existing Payment
- [ ] Find a payment row → click "Edit"
- [ ] Change amount → save
- [ ] Verify updated in table
- [ ] **Fix:** Edit not saving → check `managerService.updatePayment()` mutation

### S15-T4: Commission Management
- [ ] Find commission section (per-program commission overrides)
- [ ] Set a custom commission rate for a program
- [ ] Save → verify rate updated
- [ ] **Fix:** Commission not saving → check `managerService.storeCommission()` mutation

### S15-T5: Payment History Table
- [ ] Verify columns: Date, Amount, Method, Reference, Notes
- [ ] Verify dates formatted correctly
- [ ] **Fix:** Date raw ISO showing → check `formatDate(row.payment_date, locale)`

### S15-T6: Back to Payments List
- [ ] Click back → returns to `/en/manager/reseller-payments`
- [ ] **Fix:** Wrong back path → check `listPath` prop

---

## Sprint 16 — Reports (`/en/manager/reports`)

### S16-T1: Default Load (Last Year)
- [ ] Verify 4 stats cards: Total Revenue, Active Customers, Active Licenses, Total Activations
- [ ] Verify monthly revenue line chart renders
- [ ] Verify retention chart renders
- [ ] **Fix:** Blank → check `managerService.getFinancialReports(range)` + `getRetention(range)`

### S16-T2: Date Range Picker
- [ ] Change date range to last 30 days
- [ ] Verify all charts + stats update
- [ ] Clear dates → verify reset to default range
- [ ] **Fix:** Charts not updating → check `range` in all queryKeys

### S16-T3: Monthly Revenue Chart
- [ ] Verify bar/line chart shows months on X-axis
- [ ] Verify Y-axis values are currency
- [ ] In AR mode → verify Arabic month labels
- [ ] **Fix:** Wrong labels → check `localizeMonthLabel(item.month, locale)`

### S16-T4: Retention Chart
- [ ] Verify retention line chart loads data from `getRetention(range)`
- [ ] Verify correct series label in legend
- [ ] **Fix:** Retention chart blank → check `retentionQuery.data?.data`

### S16-T5: Reseller Breakdown Table (if present)
- [ ] Verify table of resellers with: name, activations count, revenue
- [ ] Sort by revenue → rows reorder
- [ ] **Fix:** Table missing → check `report.reseller_breakdown` in data shape

### S16-T6: Export Buttons
- [ ] Click "Export CSV" → file downloads
- [ ] Click "Export PDF" (if present) → PDF downloads
- [ ] **Fix:** Export broken → check `ExportButtons` component handlers

### S16-T7: "View Activations" Link
- [ ] Click "View Activations" → navigates to Reseller Logs with `action=license.activated` + date range in URL
- [ ] **Fix:** Wrong URL → check `activationsDetailsUrl` construction with `buildQueryUrl()`

---

## Sprint 17 — Activity Log (`/en/manager/activity`)

### S17-T1: Activity List Loads
- [ ] Verify entries render with: icon or role badge, action label, actor name, date
- [ ] **Fix:** Empty → check `managerService.getActivity()` API

### S17-T2: Filter by Team Member (User)
- [ ] Select a specific reseller from "Team Member" dropdown
- [ ] Verify only that reseller's actions show
- [ ] Select "All Users" → all entries return
- [ ] **Fix:** User filter ignored → check `user_id` param in queryKey + API call

### S17-T3: Filter by Action Type
- [ ] Action type dropdown builds options dynamically from loaded data
- [ ] Select `license.activate` → only activations show
- [ ] Clear → all actions show
- [ ] **Fix:** Options not building → check `actionOptions` from `useMemo` on `entries`

### S17-T4: Date Range Filter
- [ ] Set From date → entries filtered from that date
- [ ] Set To date → range narrows
- [ ] Click "Clear Dates" button → range resets, all entries load
- [ ] **Fix:** Clear Dates not working → check `setRange({ from: '', to: '' })` on button click

### S17-T5: Export Button
- [ ] Click "Export" (Download icon button)
- [ ] Verify file downloads (CSV/Excel)
- [ ] **Fix:** Export failing → check `managerService.exportActivity(range)`

### S17-T6: Pagination
- [ ] With >12 entries (default perPage=12), verify next page loads
- [ ] **Fix:** Pagination broken → check `meta` pagination data

---

## Sprint 18 — Reseller Logs (`/en/manager/reseller-logs`)

### S18-T1: Table Loads
- [ ] Verify columns: Date, Reseller, Action, Customer, BIOS ID, Status, Revenue
- [ ] Verify status filter cards at top (All / by action type counts)
- [ ] **Fix:** Empty → check `managerService.getResellerLogs()` API

### S18-T2: Filter by Seller
- [ ] Select a specific reseller from seller dropdown
- [ ] Verify only that reseller's log entries show
- [ ] **Fix:** Seller filter ignored → check `sellerId` in queryKey

### S18-T3: Filter by Action Type
- [ ] Select `license.activated` → only activations show
- [ ] Select `license.renewed` → only renewals
- [ ] Select `license.deactivated` → only deactivations
- [ ] **Fix:** Action filter not working → check `action` param in API call

### S18-T4: Date Range Filter
- [ ] Set From/To dates → entries filter to range
- [ ] Clear dates → all entries return
- [ ] **Fix:** Date filter ignored → check `range.from`/`range.to` in queryKey

### S18-T5: Sidebar Navigation Resets Filters
- [ ] Apply seller + action + date filters
- [ ] Click "Reseller Logs" in sidebar
- [ ] Verify URL is clean, all filters reset
- [ ] **Fix:** Stale filters → check `useEffect` on `searchParams.toString() === ''`

### S18-T6: Link to Customer Detail
- [ ] Click a customer name in a log row
- [ ] Verify navigates to `/en/manager/customers/:id`
- [ ] **Fix:** Link broken → check `Link` component href in log table columns

### S18-T7: Pagination
- [ ] With >15 rows (default perPage=15), verify next page works
- [ ] **Fix:** Pagination stuck → check `meta` response handling

### S18-T8: Deep-link from Reports
- [ ] From Reports page, click "View Activations" link
- [ ] Verify Reseller Logs loads with `action=license.activated` pre-applied + date range
- [ ] **Fix:** Params not pre-applied → check URL params reading in `ResellerLogs.tsx` `useState` initializers

---

## Sprint 19 — Profile (`/en/manager/profile`)

### S19-T1: Profile Info Loads
- [ ] Verify: name, email/username, role, timezone displayed
- [ ] **Fix:** Blank → check `ProfileWorkspace` + profile API

### S19-T2: Edit Name and Phone
- [ ] Click "Edit" → change name → save
- [ ] Verify updated name in profile + navbar
- [ ] **Fix:** Navbar not updating → check auth context cache invalidation

### S19-T3: Change Password
- [ ] Fill current + new + confirm password → submit
- [ ] Logout → login with new password → verify works
- [ ] **Fix:** Password change failing → check `AuthController::changePassword` validation

### S19-T4: Timezone Setting
- [ ] Change timezone in dropdown → save
- [ ] Navigate to Reseller Logs → verify date display changes
- [ ] **Fix:** Timezone not persisting → check `useResolvedTimezone()` hook usage

---

## Sprint 20 — Shared Component Deep Tests

### S20-T1: DataTable — Sticky Header
- [ ] On Customers, Team, Reseller Logs pages with many rows
- [ ] Scroll down in table → verify `thead` stays fixed at top
- [ ] **Fix:** Header scrolls away → check `<div className="max-h-[70vh] overflow-auto">` wrapper with `thead sticky top-0`

### S20-T2: DataTable — Client-side Sort
- [ ] Click a sortable column header → rows sort ascending
- [ ] Click again → sort descending
- [ ] Click third time → sort cleared
- [ ] **Fix:** Sort not working → check `sortable: true` + `sortValue` in column definition

### S20-T3: StatusBadge — All Statuses
- [ ] Verify colors: active=green, expired=red, cancelled=red, pending=amber, scheduled=blue, suspended=orange
- [ ] Test in both light and dark mode
- [ ] **Fix:** Wrong color → check `StatusBadge` variant mapping

### S20-T4: ConfirmDialog — Keyboard Accessibility
- [ ] Open a delete confirm dialog
- [ ] Press Escape → dialog closes without action
- [ ] Press Enter on "Confirm" button → action executes
- [ ] **Fix:** Keyboard not working → check Dialog `onKeyDown` handlers

### S20-T5: Toast Notifications
- [ ] Trigger a success action → green toast appears and auto-dismisses
- [ ] Trigger an error action → red toast appears with error message
- [ ] Verify toast shows in correct position (top-right in LTR, top-left in RTL)
- [ ] **Fix:** Toast missing or wrong position → check `sonner` Toaster placement

### S20-T6: ExportButtons Component
- [ ] On Reports page, click CSV export
- [ ] Verify file downloads with correct data
- [ ] Verify filename includes date range
- [ ] **Fix:** Export empty file → check server response for export endpoint

### S20-T7: DateRangePicker Component
- [ ] Open picker → select From date
- [ ] Select To date (must be after From) → verify range saved
- [ ] Try selecting To before From → verify constraint enforced
- [ ] Clear both → verify empty state
- [ ] **Fix:** Invalid range allowed → check DateRangePicker min/max logic

---

## Sprint 21 — Edge Cases & Error Handling

### S21-T1: Network Error on Load
- [ ] Open DevTools → disable network
- [ ] Navigate to Customers → verify error state (not white screen)
- [ ] Re-enable network → verify data reloads
- [ ] **Fix:** White screen → check `isError` + `ErrorBoundary` in each page

### S21-T2: 403 / Unauthorized API Response
- [ ] Manually test with expired token (clear cookie in DevTools)
- [ ] Trigger an API call → verify redirect to login
- [ ] **Fix:** No redirect on 401 → check Axios interceptor in `api.ts`

### S21-T3: Empty States
- [ ] Log in with a fresh manager with 0 data
- [ ] Customers page → empty state shown
- [ ] Team page → empty state shown
- [ ] Reports page → "No data for selected period" shown
- [ ] **Fix:** Blank page without empty state → add `EmptyState` component for each table

### S21-T4: Hard Refresh on Deep URL
- [ ] Navigate to `/en/manager/team/5` → press F5
- [ ] Verify page reloads correctly (not 404)
- [ ] Navigate to `/en/manager/customers/12` → refresh
- [ ] **Fix:** 404 on refresh → check Vite/Nginx SPA fallback config

### S21-T5: Mobile / Responsive
- [ ] Switch to 375px viewport
- [ ] Sidebar collapses to hamburger
- [ ] Tables scroll horizontally
- [ ] Dialogs are usable on mobile
- [ ] **Fix:** Layout broken → add/fix responsive Tailwind breakpoints

### S21-T6: Long BIOS ID / Long Names
- [ ] Customer with 60-char name → table cell truncates, no overflow
- [ ] BIOS ID with special chars (e.g. `/`, `:`) → URL-encoded correctly in links
- [ ] **Fix:** Overflow → add `truncate` class; encoding → check `encodeURIComponent()` in route builder

### S21-T7: Concurrent Mutations / Double Submit
- [ ] On any save button, double-click rapidly
- [ ] Verify only 1 API call made (button disabled after first click)
- [ ] **Fix:** Button not disabled → check `isPending` state on mutation disabling button

---

## Sprint 22 — Live Data / Auto-Refresh

### S22-T1: Customers Live Update
- [ ] Open Customers page in 2 tabs
- [ ] In tab 2, create a new customer
- [ ] Tab 1 should auto-update within the live query interval
- [ ] **Fix:** No auto-update → check `liveQueryOptions(LIVE_QUERY_INTERVAL)` on query

### S22-T2: Customer Detail Status Update
- [ ] Open a customer detail with active license
- [ ] Manually expire the license (via super-admin or DB)
- [ ] Tab should show updated status without refresh
- [ ] **Fix:** Status stale → check `refetchInterval` on customer detail query

---

## Sprint 23 — Internationalization (i18n)

### S23-T1: No Raw Translation Keys (EN)
- [ ] Visit every manager page in English
- [ ] Verify no raw keys visible (e.g., `manager.pages.activity.title` showing as text)
- [ ] **Fix:** Missing key → add to `frontend/src/locales/en.json`

### S23-T2: No Raw Translation Keys (AR)
- [ ] Switch to AR, visit every page
- [ ] Verify complete Arabic text, no English bleed-through
- [ ] **Fix:** Missing Arabic key → add to `frontend/src/locales/ar.json`

### S23-T3: RTL Layout Integrity
- [ ] In AR mode: verify table column order is mirrored
- [ ] Action buttons on correct side (left in RTL)
- [ ] Dropdowns open to correct side
- [ ] Charts rendered correctly (labels readable)
- [ ] **Fix:** RTL layout issues → check `me-` / `ms-` (margin-end/start) vs `mr-` / `ml-` usage

### S23-T4: Numbers and Currency in AR Mode
- [ ] Verify all currency values in AR mode use `ar-EG` locale
- [ ] Verify dates formatted as Gregorian in Arabic script
- [ ] **Fix:** Wrong locale → check all `formatCurrency(val, 'USD', locale)` and `formatDate(val, locale)` calls

---

## Issue Tracker

> Log all issues found during testing here

| # | Sprint | Page | Issue Description | Severity | Status | Fix Applied |
|---|--------|------|-------------------|----------|--------|-------------|
| 1 | 1 | Manager layout / role guards | Unauthorized access while logged in as manager redirects to `/en/manager/dashboard` instead of login or a `403`-style result when visiting reseller or super-admin routes. | High | Open | |
| 2 | 1 | Sidebar navigation | Sidebar structure differs from the written plan: `Panel Activity` replaces `Activity`, and `BIOS` is grouped behind a collapsible menu instead of separate flat links. | Medium | Open | |
| 3 | 2 | Dashboard AR mode | Arabic dashboard keeps recent activity action labels and descriptions in English instead of localized strings. | Medium | Open | |
| 4 | 3 | Customers | Customer create flow is no longer an inline dialog; actual UI uses `/en/manager/customers/create`. The plan is outdated. | Low | Open | |
| 5 | 3 | Customers | Active customer rows still expose a `Delete` action in the overflow menu. | High | Open | |
| 6 | 3 | Customers | After deactivate/reactivate, summary counts can refresh before the affected row status updates, causing a short-lived stale table state. | Medium | Open | |
| 7 | 4 | Customer detail | `Panel Activity` on customer detail still exposes raw/internal-style action text such as `license.activated`. | Medium | Open | |
| 8 | 5 | Team | Create-reseller dialog no longer includes a visible `Username` field even though the plan expects one. Username appears to be auto-generated. | Low | Open | |
| 9 | 5 | Team | Reseller account status/action wording uses `Deactive` instead of expected terms like `Suspend`, `Unsuspend`, or `Inactive`. | Medium | Open | |
| 10 | 6 | Team member detail | Reseller activity feed shows raw action keys such as `team.create`, `team.update`, and `team.status`. | Medium | Open | |
| 11 | 6 | Team member detail | No commission override field was present on validated reseller detail pages, so the documented commission workflow could not be exercised. | Low | Open | |
| 12 | 8 | Software management | `Add Program` routes directly to the full-page form. The documented quick-create dialog is not present in the current UI. | Low | Open | |
| 13 | 8 | Software management | Program creation rejects unresolved hosts with `External API base URL host could not be resolved.` The validation is correct, but the plan does not mention this requirement. | Low | Open | |
| 14 | 8 | Software management | Deactivating a program works, but clicking the `Active` control on an inactive program opens a registration dialog instead of reactivating the program. | High | Open | |
| 15 | 9 | Activate license | Manager activate form no longer matches the documented structure: no visible program picker, no unscheduled duration/end-date mode switch, and schedule options only expand after enabling scheduling. | Medium | Open | |
| 16 | 10 | Create customer | `/en/manager/customers/create` is still the shared activation form and includes program/license controls. The documented customer-only form does not exist separately. | Medium | Open | |
| 17 | 10 | Create customer | Manager customer-only creation still requires a program and allows duplicate BIOS IDs. Creating a second customer with BIOS `EEEE` succeeded instead of surfacing a duplicate-BIOS error. | High | Open | |
| 18 | 10 | Customers | Immediately after manager create flows, the customers list can briefly render impossible summary states such as `All 0` with non-zero status cards until a reload. | Medium | Open | |
| 19 | 11 | Renew license | Manager renew route is inconsistent. Older license route `/en/manager/customers/licenses/20/renew` stays on loading because `/api/licenses/20` returns `404`, while newer manager-created license routes work. | High | Open | |
| 20 | 12 | BIOS details | BIOS details header still shows raw translation key text `biosDetails.description`. | Medium | Open | |
| 21 | 12 | BIOS details | BIOS search endpoint is unstable. Searching `MG` triggered repeated `500` responses from `/api/manager/bios/search?query=MG`. | High | Open | |
| 22 | 12 | BIOS details | BIOS resolution can attach the wrong current customer when duplicate BIOS values exist. Opening `EEEE` surfaced the pending duplicate record as the overview context. | High | Open | |
| 23 | 12 | BIOS details | Navigating from customer detail to `/en/manager/bios-details/BIOS-S6-20260315001820` loads the shell but leaves overview values blank. | High | Open | |
| 24 | 13 | BIOS change requests | Approval success copy now reads `BIOS change approved but external sync is pending.` rather than the simpler success text documented in the plan. | Low | Open | |
| 25 | 15 | Reseller payment detail | `Record Payment` dialog triggers Radix accessibility warnings because `DialogContent` lacks a description / `aria-describedby`. | Low | Open | |
| 26 | 16 | Reports | Reports stat labels no longer match the plan exactly. The UI uses `Current Active Customers` and omits the older `Active Licenses` wording. | Low | Open | |
| 27 | 16 | Reports | Reports deep-link to reseller logs only pre-applies `action=license.activated`; the active date range is not carried in the URL as documented. | Medium | Open | |
| 28 | 17 | Activity log | Activity entries still expose raw/internal action keys such as `license.renewed`, `manager.program.create`, and `team.status`. | Medium | Open | |
| 29 | 18 | Reseller logs | Reseller logs still include raw/internal action values like `bios.change_requested` and `bios.change_approved` in the full log stream. | Medium | Open | |
| 30 | 18 | Reseller logs | Clicking a customer link from reseller logs can land on the correct route while initially rendering only the customer-detail shell without the expected data blocks. | Medium | Open | |
| 31 | 21 | Auth/session | Clearing cookies alone did not invalidate the manager session; full browser storage clearing was required to force redirect to `/en/login`. | Medium | Open | |
| 32 | 23 | Arabic i18n | Arabic BIOS pages still contain untranslated/garbled text, including `biosDetails.description` and mixed `????` labels. | High | Open | |

**Severity:**
- 🔴 Critical — feature broken, data lost, or user blocked
- 🟠 High — feature partially broken, workaround needed
- 🟡 Medium — visual/UX issue, non-blocking
- 🟢 Low — cosmetic or minor

---

## Testing Commands Reference (Playwright MCP)

```javascript
// Navigate to a URL
mcp_playwright_navigate({ url: "http://localhost:3000/en/manager/dashboard" })

// Take a screenshot
mcp_playwright_screenshot({})

// Click an element
mcp_playwright_click({ selector: "button[type=submit]" })
mcp_playwright_click({ selector: "text=Add Reseller" })

// Fill an input field
mcp_playwright_fill({ selector: "input[name=username]", value: "manager1" })
mcp_playwright_fill({ selector: "input[placeholder='Search...']", value: "customer name" })

// Select from dropdown
mcp_playwright_select_option({ selector: "select[name=status]", value: "active" })

// Wait for element to appear
mcp_playwright_wait_for_selector({ selector: ".toast-success" })
mcp_playwright_wait_for_selector({ selector: "table tbody tr" })

// Check if element exists
mcp_playwright_evaluate({ script: "!!document.querySelector('.empty-state')" })

// Get element text
mcp_playwright_evaluate({ script: "document.querySelector('h1').textContent" })

// Check console errors
mcp_playwright_console_messages({})

// Take screenshot of specific element
mcp_playwright_screenshot({ selector: ".data-table" })

// Resize viewport (mobile test)
mcp_playwright_evaluate({
  script: "window.resizeTo(375, 812)"
})
```

---

## Definition of Done per Sprint

- [ ] All test cases in the sprint executed
- [ ] All failures documented in Issue Tracker with severity
- [ ] All 🔴 Critical and 🟠 High issues fixed and re-tested
- [ ] Screenshots captured for any visual issues
- [ ] No new console errors introduced by fixes
- [ ] AR/EN both tested for i18n sprints

---

*Last updated: 2026-03-15 | Manager dashboard QA — 23 sprints, 130+ test cases*

