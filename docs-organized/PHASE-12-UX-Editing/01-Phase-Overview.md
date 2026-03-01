# PHASE 12: UX Editing — Best UX Improvements

**Phase Goal:** Fix 9 real UX issues found during live testing.
**Scope:** Backend controllers, frontend pages, sidebar navigation, localization, role permissions.
**Rule:** No new third-party dependencies. Reuse existing shared components where possible.

---

## Implementation Status Update (2026-03-01)

This phase scope was expanded during implementation (UX-10, UX-11, UX-12, UX-14).  
Current code status in this workspace:

### Implemented in code

- UX-1: IP Analytics switched to global logs path and structured tenant data flow.
- UX-2: Program Logs usernames now map to local customer and navigate to customer detail when matched.
- UX-3: Reseller Pricing auto-selects first reseller on initial load.
- UX-5: Manager Parent software management UI aligned with manager experience.
- UX-6: Manager Parent software catalog route/page added.
- UX-7: Manager and Manager Parent licenses pages/routes/services/controllers added.
- UX-8: License action permissions opened for manager + manager parent paths.
- UX-9: External username and customer data UX fixes implemented.
- UX-10: IP Analytics now filters to tenant-matched usernames and defaults newest-first.
- UX-11: GeoIP switched to `ip-api.com` batch enrichment with VPN/hosting signal.
- UX-12: Sidebar now has a dedicated collapsible `Logs` group (not under Settings).
- UX-14: Online users widget implemented (role visibility + Super Admin toggle + last seen tracking).
- Additional reliability fix: deactivate and bulk-deactivate flows now return actionable API errors and handle already-deactivated cases more safely.

### Still pending final closure

- UX-13 responsive hardening pass across all pages/components.
- Full regression and test-coverage pass in Phase 08 for all new UX behaviors.

---

## Summary of Issues

| # | Issue | Page | Root Cause | Impact |
|---|-------|------|------------|--------|
| UX-1 | IP Analytics shows no data | `/ip-analytics` | Calls per-program endpoint (`/apilogs/{id}`) instead of global endpoint (`/getmylogs`) | No data displayed |
| UX-2 | Program Logs username not clickable | `/program-logs` | Backend sends no `customer_id`, frontend renders plain text | Cannot navigate to customer detail |
| UX-3 | Reseller Pricing does not auto-select reseller | `/reseller-pricing` | `selectedResellerId` starts as `null`, no auto-select on mount | Table appears empty on first load |
| UX-4 | Sidebar: Activity/Logs/API Status are top-level | Sidebar | Flat list — no grouping/collapsing under Settings | Cluttered sidebar |
| UX-5 | Software Management layout differs between Manager and Manager Parent | `/manager/software-management` vs `/software-management` | Two separate components with different layouts (cards vs table) | Inconsistent visual experience |
| UX-6 | Manager Parent missing Software Catalog page | Manager Parent | Route and page not created for Manager Parent | Cannot browse programs in catalog view |
| UX-7 | Manager and Manager Parent missing Licenses page | Manager / Manager Parent | No Licenses page, no backend endpoints for global license listing | Cannot see all licenses; cannot bulk-renew |
| UX-8 | Manager and Manager Parent cannot activate/renew/deactivate | Customers page | Backend renew/deactivate routes restricted to `role:reseller` only | Cannot perform license actions for clients |
| UX-9 | External username is BIOS ID instead of Customer Name + "Close dialog" visible text + Name/Phone = BIOS ID in customer table | Activation backend, Activation form, Customer detail dialog, Customers table | Backend passes `bios_id` as username to external API instead of `customer_name`; Dialog close label not sr-only; Old data stores BIOS ID as customer name | Wrong external username registered; Confusing form hint; Broken dialog UI; Dirty customer data |

> **Note:** "Duration 0.25 (6 hr) quick-select" is already implemented in
> `frontend/src/components/activation/ActivateLicenseForm.tsx` (line 210). No action needed.

---

## UX-1: IP Analytics — Wire to Global `/getmylogs` + BIOS ID Matching

### What the user sees
`/en/ip-analytics` shows a program dropdown and a table with no rows — "No data available."
Even when a program is selected, no data appears because the external program logs are empty or
the program has no activity through `/apilogs/{id}`.

### Root cause (confirmed by reading the code)

**Frontend** (`frontend/src/pages/manager-parent/IpAnalytics.tsx`, line 71):
```
managerParentService.getProgramLogs(softwareId)
```
This calls `GET /manager-parent/programs/{softwareId}/logs`
which hits `ExternalApiService::getProgramLogs(softwareId)`
which calls `GET /apilogs/{softwareId}` on the external server (per-program endpoint).

**The page is using the wrong external endpoint.**

The correct external endpoint is:
```
GET /getmylogs    ← returns ALL logs for ALL programs in one call
```
→ `ExternalApiService::getGlobalLogs()` already exists and calls this.

### What `/getmylogs` returns
Raw plain text — one log entry per line:
```
username  2025-01-15 10:30:00  192.168.1.100
username2 2025-01-15 11:00:00  203.0.113.45
```
Format: `{external_username}  {timestamp}  {ip_address}`

The frontend already has `parseLoginRows()` which parses this exact format (line 28–46 of `IpAnalytics.tsx`).
The GeoIP enrichment is already implemented client-side via `ipapi.co` (lines 84–116).

### What needs to change

The key missing piece is: **matching `external_username` from the log to our local `licenses` table to get the `bios_id`**.

Each log line has a `username` (= `external_username`). In the `licenses` table we have:
- `external_username` — the username registered with the external server
- `bios_id` — the BIOS ID of the machine
- `customer_id` — local customer who owns the license

**Backend flow (new):**
1. `IpAnalyticsController::index()` calls `ExternalApiService::getGlobalLogs()`
2. Receives raw text → parse server-side into `[{ username, timestamp, ip_address }]`
3. Collect all unique usernames → query `licenses` table WHERE `external_username IN (...)` within tenant scope
4. Build lookup map: `external_username → { bios_id, customer_id }`
5. Merge into each log row → return structured JSON: `[{ username, bios_id, customer_id, ip_address, timestamp }]`
6. Frontend receives structured data (no raw text parsing needed in the browser)

**Frontend flow (updated):**
1. Remove call to `getProgramLogs(softwareId)` — replace with `getIpAnalytics()` (already exists in service, calls `GET /ip-analytics`)
2. Remove `parseLoginRows()` — backend now returns structured JSON
3. Remove `enabled: softwareId !== ''` guard — global endpoint needs no software filter
4. Remove the program selector dropdown — global endpoint returns all programs
5. Add `bios_id` column to the table
6. GeoIP enrichment stays as-is (working correctly with `ipapi.co`)

### Files involved
```
backend/app/Http/Controllers/ManagerParent/IpAnalyticsController.php
  → Replace UserIpLog query with ExternalApiService::getGlobalLogs()
  → Parse raw text server-side
  → Join licenses table to get bios_id + customer_id per username
  → Return structured JSON array

backend/app/Services/ExternalApiService.php
  → getGlobalLogs() already exists — no change needed, just use it

backend/routes/api.php
  → Route GET /ip-analytics stays unchanged — only controller logic changes

frontend/src/pages/manager-parent/IpAnalytics.tsx
  → Line 71: change getProgramLogs(softwareId) → getIpAnalytics()
  → Remove parseLoginRows() function (backend now parses)
  → Remove enabled: softwareId !== '' guard
  → Remove program selector <select> (lines 222-229)
  → Add bios_id column to the columns array
  → Keep all GeoIP enrichment (ipapi.co, geoCache) — it still works

frontend/src/services/manager-parent.service.ts
  → getIpAnalytics() already exists (line 81) — verify return type matches new backend response

frontend/src/types/manager-parent.types.ts
  → Update IpAnalyticsEntry interface:
    + bios_id: string | null
    + customer_id: number | null
    (keep: username, ip_address, timestamp — now returned directly as structured fields)

frontend/src/locales/en.json
  → Add/verify key for "BIOS ID" column header in the IP Analytics table

frontend/src/locales/ar.json
  → Add/verify Arabic key for "BIOS ID" column header
```

---

## UX-2: Program Logs — Clickable Username → Customer Detail

### What the user sees
On `/program-logs`, the username column shows `@username` as plain text. Clicking does nothing.
The user expects clicking a username to navigate to `/customers/{id}`.

### Root cause (confirmed)
1. **Backend**: `ProgramLogsController.php` returns log entries from the external server.
   Each entry has `external_username` but **no `customer_id`**.
2. **Frontend**: `ProgramLogs.tsx` renders the username as plain text — no `<Link>` component.

### What needs to change
1. **Backend**: After fetching external logs, query `licenses` table for each `external_username`
   to get `customer_id`. Attach to each log row (`null` if not found).
2. **Frontend**: If `customer_id` is present, render username as `<Link to="/{lang}/customers/{customer_id}">`.
   If `null`, render as plain `@username` text.
3. **Router**: Verify `/customers/:id` is registered for manager-parent role.

### Files involved
```
backend/app/Http/Controllers/ManagerParent/ProgramLogsController.php
  → After fetching logs, lookup licenses.customer_id WHERE external_username matches

frontend/src/pages/manager-parent/ProgramLogs.tsx
  → Username column: <Link> if customer_id present, else plain text

frontend/src/router/routes.ts
  → Verify /customers/:id route exists for manager-parent

frontend/src/router/index.tsx
  → Verify CustomerDetail page is imported and mapped to /customers/:id
```

---

## UX-3: Reseller Pricing — Auto-Select First Reseller

### What the user sees
On `/reseller-pricing`, the dropdown shows the placeholder "Reseller" on load.
The pricing table is empty until the user manually selects a reseller.

### Root cause (confirmed)
`ResellerPricing.tsx` initializes `selectedResellerId` as `null`.
No `useEffect` auto-selects the first reseller after the list loads.

### What needs to change
Add a `useEffect` that watches the reseller list — when it first populates and
`selectedResellerId` is still `null`, set it to `resellerList[0].id`.

### Files involved
```
frontend/src/pages/manager-parent/ResellerPricing.tsx
  → Add useEffect to auto-select first reseller on mount
```

---

## UX-4: Sidebar — Group Activity / Logs / API Status Under Settings

### What the user sees
Manager Parent sidebar has 18 items in a flat list.
"Activity", "Platform Logs", and "API Status" are standalone top-level items.

### What the user wants
Move those 3 items to be **sub-items under a collapsible Settings parent**.

### What needs to change
`Sidebar.tsx` — remove `activity`, `logs`, `apiStatus` from top-level array,
add them as children of the `settings` nav item with an expand/collapse toggle.

### Files involved
```
frontend/src/components/layout/Sidebar.tsx
  → Move activity/logs/apiStatus under settings parent with collapsible toggle

frontend/src/locales/en.json
  → Verify nav.settings, nav.activity, nav.logs, nav.apiStatus keys exist

frontend/src/locales/ar.json
  → Same verification for Arabic
```

---

## UX-5: Software Management — Match Card Layout Across Manager and Manager Parent

### What the user sees
- `/en/manager/software-management` → cards layout: each program is a card with Trial Days, Price,
  External Software ID, API Key badge, and Activate / Edit / Delete buttons inline
- `/en/software-management` (Manager Parent) → DataTable layout: programs as table rows with a
  separate full-page create/edit form

Both pages are software management (full CRUD). They should look identical.

### Root cause
Two completely separate components were written:
- `frontend/src/pages/manager/SoftwareManagement.tsx` — card-based, inline Edit dialog, uses `managerService`
- `frontend/src/pages/manager-parent/SoftwareManagement.tsx` — DataTable-based, full-page form, uses `programService`

### What needs to change
Update `manager-parent/SoftwareManagement.tsx` to use the same card-based layout as
`manager/SoftwareManagement.tsx`. The cards should show: name, version, description snippet,
Trial Days, Price, External Software ID, API Key badge, Activate / Edit / Delete buttons.
The Manager Parent version retains full-page navigation for create/edit (those routes already exist).

### Files involved
```
frontend/src/pages/manager-parent/SoftwareManagement.tsx
  → Replace DataTable layout with card grid matching manager/SoftwareManagement.tsx visual style
  → Keep: programService calls, full-page create/edit navigation (routePaths.managerParent.programCreate/Edit)
  → Add: same card layout, same filter bar, same status badge pattern as Manager version
```

---

## UX-6: Manager Parent — Add Software Catalog Page

### What the user sees
Manager has two software views:
1. `/manager/software` — read-only catalog (ProgramCatalogPage): shows programs, Base Price, Trial Days,
   Licenses Sold, Active Licenses, Open Download, Activate buttons
2. `/manager/software-management` — full CRUD management

Manager Parent only has the CRUD management page. They cannot see the catalog view that shows
live stats (Licenses Sold, Active Licenses) per program.

### What needs to change
Create a Software Catalog page for Manager Parent using the existing `ProgramCatalogPage` shared component.
The backend `GET /programs` route already allows `manager_parent` role.

### Files involved
```
frontend/src/pages/manager-parent/Software.tsx        ← NEW FILE — same pattern as manager/Software.tsx
  → Use ProgramCatalogPage component
  → Set translationPrefix to manager-parent catalog keys
  → onActivate → navigate to routePaths.managerParent.activateLicense

frontend/src/router/routes.ts
  → Add: managerParent.software path (e.g. `/${lang}/software`)

frontend/src/router/index.tsx
  → Add <Route> for managerParent.software → Software page component

frontend/src/components/layout/Sidebar.tsx
  → Add "Software" catalog nav item for Manager Parent sidebar
  → This is a new top-level nav item alongside "Software Management"

frontend/src/locales/en.json
  → Add translation keys for Manager Parent software catalog page title/description

frontend/src/locales/ar.json
  → Add Arabic translations for same keys
```

---

## UX-7: Manager and Manager Parent — Add Licenses Page (Global View)

### What the user sees
Reseller has `/reseller/licenses` with:
- Expiry warning stats (Expire in 1 day / 3 days / 7 days)
- Status tabs (All / Active / Expired / Suspended / Pending)
- Search by customer, BIOS ID, or program
- Bulk select → bulk renew / bulk deactivate
- Per-row: View, Renew, Deactivate actions
- Columns: Customer (name+email), BIOS ID + @username subtext, Program, Duration, Price, Activated, Expires, Status

Manager and Manager Parent have NO equivalent Licenses page. The user wants them to have one,
showing data globally (all resellers' licenses) not scoped to one reseller.

### Root cause
No backend endpoints exist for license listing for Manager or Manager Parent roles.
The reseller endpoints (`GET /reseller/licenses`, `POST /reseller/licenses/bulk-renew`, etc.)
are behind `role:reseller` middleware — not accessible to manager/manager_parent.

### What needs to change

**Backend — new endpoints:**
- `GET /api/manager/licenses` → Manager-scoped license list (licenses under their team's resellers)
- `GET /api/manager/licenses/expiring` → Expiring licenses
- `GET /api/manager-parent/licenses` → All licenses in the tenant (global)
- `GET /api/manager-parent/licenses/expiring` → Expiring licenses globally

**Backend — expand renew/deactivate middleware:**
The routes for renew and deactivate currently only allow `role:reseller`. Expand to allow
`role:reseller,manager,manager_parent` so the same `licenseService.renew()` and
`licenseService.deactivate()` calls work from these new pages:
- `POST /licenses/{license}/renew` → add `manager,manager_parent`
- `POST /licenses/{license}/deactivate` → add `manager,manager_parent`
- `GET /licenses/{license}` → add `manager,manager_parent`
- `POST /licenses/bulk-renew` → add `manager,manager_parent`
- `POST /licenses/bulk-deactivate` → add `manager,manager_parent`

**Frontend — new pages:**
- `frontend/src/pages/manager/Licenses.tsx` — same UI as `reseller/Licenses.tsx`,
  calls `managerService.getLicenses()`, shows all licenses scoped to manager's team
- `frontend/src/pages/manager-parent/Licenses.tsx` — same UI, calls global endpoint,
  shows all tenant licenses

**Frontend — routes, router, sidebar:**
```
frontend/src/router/routes.ts
  → Add: manager.licenses = `/${lang}/manager/licenses`
  → Add: managerParent.licenses = `/${lang}/licenses`

frontend/src/router/index.tsx
  → Register both new Licenses page routes

frontend/src/components/layout/Sidebar.tsx
  → Add "Licenses" nav item for Manager sidebar
  → Add "Licenses" nav item for Manager Parent sidebar

frontend/src/services/manager.service.ts
  → Add: getLicenses(params), getLicensesExpiring()

frontend/src/services/manager-parent.service.ts
  → Add: getLicenses(params), getLicensesExpiring()

frontend/src/locales/en.json
  → Add keys for Licenses page title/description for manager and manager-parent

frontend/src/locales/ar.json
  → Add Arabic keys
```

**Backend — new controllers:**
```
backend/app/Http/Controllers/Manager/LicenseController.php     ← NEW
backend/app/Http/Controllers/ManagerParent/LicenseController.php ← NEW
backend/routes/api.php
  → Add GET /manager/licenses, GET /manager/licenses/expiring
  → Add GET /licenses (manager_parent group), GET /licenses/expiring
  → Expand middleware for renew/deactivate/bulk routes
```

---

## UX-8: Manager and Manager Parent Customers — Add Activate / Renew / Deactivate

### What the user sees
**Reseller Customers page** (`/reseller/customers`):
- "Add Customer" button → 4-step wizard (Customer Info → BIOS + Program → Duration + Price → Review)
- Per-row: View, Renew, Deactivate buttons
- Full activation, renewal, and deactivation workflow

**Manager Customers page** (`/manager/customers`) and
**Manager Parent Customers page** (`/customers`):
- Read-only table with search and filter
- Clicking a row opens a detail slide-over panel — NO add/renew/deactivate actions

### What needs to change

**Backend:**
- `POST /licenses/activate` already allows `role:reseller,manager,manager_parent` ✓ (no change)
- Renew, deactivate, bulk, and show-by-id routes are inside `Route::middleware('role:reseller')` → CHANGE to also allow `manager,manager_parent`

**Frontend — Manager Customers** (`frontend/src/pages/manager/Customers.tsx`):
- Add "Add Customer" button → open the same 4-step activation wizard as Reseller
  (wizard component can be extracted from `reseller/Customers.tsx` or copied and adapted)
- Add Renew and Deactivate buttons per row (same pattern as `reseller/Customers.tsx`)
- The underlying service calls use `licenseService` (already imported in the codebase)
- Show data globally (filter by reseller available, no forced reseller scope)

**Frontend — Manager Parent Customers** (`frontend/src/pages/manager-parent/Customers.tsx`):
- Same additions: "Add Customer" button + 4-step wizard + Renew/Deactivate per row
- Show all customers globally (no scoping to one reseller — already the case)

### Files involved
```
backend/routes/api.php
  → Move renew, deactivate, bulk-renew, bulk-deactivate, show-by-id out of role:reseller-only group
  → Add role:manager,manager_parent to those routes

frontend/src/pages/manager/Customers.tsx
  → Add: "Add Customer" button
  → Add: 4-step activation wizard (customer info → BIOS + program → duration + price → review)
  → Add: Renew button per row → renew dialog
  → Add: Deactivate button per row → confirm dialog
  → Uses: licenseService.activate(), licenseService.renew(), licenseService.deactivate()

frontend/src/pages/manager-parent/Customers.tsx
  → Same additions as manager/Customers.tsx

frontend/src/locales/en.json
  → Add translation keys for activation wizard, renew dialog, deactivate dialog for manager/manager-parent

frontend/src/locales/ar.json
  → Add Arabic translations for same keys
```

---

## Acceptance Criteria

| UX Issue | Done When |
|----------|-----------|
| UX-1 IP Analytics | Table shows rows from `/getmylogs`. Each row shows: username, BIOS ID (from local DB), IP, country flag, city, ISP, timestamp. No program selector needed. |
| UX-2 Program Logs | Usernames with a matching local customer render as clickable links → `/customers/{id}`. |
| UX-3 Reseller Pricing | On first load, first reseller is auto-selected and pricing table populates immediately. |
| UX-4 Sidebar | Settings is expandable. Sub-items: Activity, Platform Logs, API Status. Top-level count reduced by 3. |
| UX-5 Software Management | Manager Parent software-management page uses same card layout as Manager's. Cards show: name, version, Trial Days, Price, External ID, API badge, Activate/Edit/Delete buttons. |
| UX-6 Software Catalog (Manager Parent) | Manager Parent has `/software` catalog page showing programs with Licenses Sold, Active Licenses stats. Activate button navigates to activate license page. |
| UX-7 Licenses (Manager + Manager Parent) | Both roles have a Licenses page with expiry stats, status tabs, bulk actions, and per-row renew/deactivate. Data is global (not scoped to one reseller). |
| UX-8 Customers (Manager + Manager Parent) | Both roles can: Add Customer (4-step wizard), Renew license, Deactivate license — same capabilities as Reseller. Data shown globally. |
| UX-9 External Username / Dialog / Customer Data | External server receives `customer_name` as username (not BIOS ID). BIOS ID hint says "Hardware BIOS serial number". Customer Name hint says "Used as external username". Dialog shows only X icon (no "Close dialog" text). Customer table shows `—` for BIOS-like name/phone values. |

---

## UX-9: Fix External Username Field + Dialog Close + Customer Data Display

### 9a — WRONG: BIOS ID is used as external username — should be Customer Name

**The design intent:**
- **Customer Name** → the human-readable identifier sent to the external license server as `username`
- **BIOS ID** → the hardware identifier — sent as `bios_id` — NOT the username

**What is currently broken:**
The backend activation controller calls:
```php
ExternalApiService::activateUser($apiKey, $biosId, $biosId)
```
It passes `bios_id` as BOTH the `username` AND the `biosId` arguments.
This means the external server registers the BIOS serial as the username.

**What it should do:**
```php
ExternalApiService::activateUser($apiKey, $customerName, $biosId)
```
The customer's actual name goes as the username. The BIOS ID goes as the hardware identifier.

**What also needs to change:**
- `licenses.external_username` currently stores the BIOS ID → must store `customer_name` instead
- The BIOS ID hint text "Will be used as username (locked)" in the activation form must be **removed** — the BIOS ID is just a hardware ID
- Add a hint below the **Customer Name** field instead: "Will be used as the external username on the license server."

**Impact on UX-1 and UX-2:**
The IP Analytics and Program Logs pages match log entries (`username` from external server) against `licenses.external_username` to get `bios_id` and `customer_id`. After this fix, `external_username` will store `customer_name` — which IS what the external server logs record. The matching logic in the backend controllers is correct, just the stored value needs to change.

**Files:**
```
backend/app/Services/LicenseService.php  ← actual bug location
  → Line 53: activateUser($apiKey, $biosId, $biosId)
    Change to: activateUser($apiKey, $customerName, $biosId)
  → Line 77: 'external_username' => $biosId
    Change to: 'external_username' => $customerName
  Note: ExternalApiService::activateUser() already accepts (apiKey, username, biosId) separately — only LicenseService is wrong

frontend/src/locales/en.json
  → Remove or change key "activate.biosIdHint" — remove the "used as username" mention
    New value: "Hardware BIOS serial number for this machine."
  → Add key "activate.customerNameHint": "Will be used as the external username on the license server."

frontend/src/locales/ar.json
  → Update "activate.biosIdHint": "الرقم التسلسلي لبيوس الجهاز."
  → Add "activate.customerNameHint": "سيُستخدم كاسم مستخدم خارجي على خادم الترخيص."

frontend/src/components/activation/ActivateLicenseForm.tsx
  → Line 277: remove or replace {t('activate.biosIdHint')} with new BIOS-only hint text
  → After the Customer Name input (around line 255): add
    <p className="text-xs text-slate-500 dark:text-slate-400">{t('activate.customerNameHint')}</p>
```

---

### 9b — Customer Detail Dialog: "Close dialog" Visible Text

**What the user sees:**
When clicking a customer row to open the customer detail slide-over dialog,
there is a visible text element that reads **"Close dialog"** — this is the Radix UI `DialogClose`
button's accessible label being rendered as visible text rather than as an icon-only button.

**Root cause:**
The `DialogContent` component in `frontend/src/components/ui/dialog.tsx` renders a `DialogClose`
button. By default, Radix's `DialogClose` includes a visually-hidden `<span>Close</span>` for
screen readers. If the component renders it as visible text (missing the `sr-only` class or
`VisuallyHidden` wrapper), the text appears on screen.

**What needs to change:**
In `frontend/src/components/ui/dialog.tsx`, the `DialogClose` button within `DialogContent`
should use `<span className="sr-only">Close</span>` (screen-reader only) alongside an `X` icon
— so sighted users see only the icon, while screen readers announce "Close".

**Files:**
```
frontend/src/components/ui/dialog.tsx
  → Inside DialogContent component, find the DialogClose button
  → Wrap the "Close" text in <span className="sr-only"> so it is not visually rendered
  → Ensure the X icon (from lucide-react) is visible alongside it
```

---

### 9c — Customers Table: Name/Phone = BIOS ID (Data Display + Prevention)

**What the user sees:**
In the customers table (Manager, Manager Parent, Reseller), some rows show the customer's
**Name** and **Phone** fields containing the same long hex string as the **BIOS ID** — e.g. `2222222222222222222222222223`.

**Why this happened:**
The old activation path used the BIOS ID as the external username AND stored it as the customer
name (because there was no separate name field). Now that the fix in 9a is in place, this should
never happen again — but existing bad records are still in the database.

**What needs to change:**

1. **Activation form validation** — prevent `customer_name` from being a BIOS-ID-like string.
   Add error: "Enter the customer's full name (e.g. John Smith)."

2. **Customers table display** — when name looks like a BIOS serial (all hex, length > 20, no spaces):
   render `—` instead of the raw hex string.

3. **Phone display** — if phone is also a BIOS-like string (length > 20): render `—`.

**Files:**
```
frontend/src/components/activation/ActivateLicenseForm.tsx
  → In errors useMemo, after length < 2 check for customer_name:
    add check: if name is all hex chars + length > 20 → error: t('validation.nameNotBiosId')

frontend/src/pages/manager/Customers.tsx
  → name column render: if name.length > 20 and /^[0-9a-fA-F\-_]+$/ → show "—"
  → phone column render: if phone.length > 20 → show "—"

frontend/src/pages/manager-parent/Customers.tsx
  → Same display fix

frontend/src/pages/reseller/Customers.tsx
  → Same display fix

frontend/src/locales/en.json
  → Add: "validation.nameNotBiosId": "Enter the customer's full name (e.g. John Smith)"

frontend/src/locales/ar.json
  → Add: "validation.nameNotBiosId": "أدخل الاسم الكامل للعميل (مثال: أحمد محمد)"
```

---

**Phase 12 complete → return to Phase 08 Testing to add UX-1 and UX-2 test coverage.**
