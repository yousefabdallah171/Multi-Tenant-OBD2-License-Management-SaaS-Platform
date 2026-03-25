# Platform Invariants — Manual Tester Guide

Last updated: 2026-03-25

---

## How to Use This Document

This document lists every **hard rule** the platform must enforce at all times.
Each rule is written as a statement that must **always be true**.
If you can break any rule during testing, that is a **bug** — report it immediately.

Rules are grouped by topic. Each rule has:
- **What it means** — plain explanation
- **How to test it** — exact steps
- **If you can break it** — what to report

---

## 1. BIOS ID ↔ Username Permanent Link

### Rule 1.1 — One BIOS ID can only ever be linked to one username
**What it means:** Once a BIOS ID is activated with username `john_doe`, it can never be used with any other username — not even after the license expires or is cancelled.

**How to test:**
1. Activate customer A with BIOS `TEST-001` and username `john`.
2. Wait for the license to expire or cancel it.
3. Try to create a new customer B with the same BIOS `TEST-001` but a different username `jane`.
4. The platform must reject this with an error about a permanent BIOS-username link.

**If you can break it:** Creating customer B succeeds with a different username → **BUG**.

---

### Rule 1.2 — One username can only ever be linked to one BIOS ID
**What it means:** Once username `john_doe` is linked to BIOS `TEST-001`, it can never be used with a different BIOS ID — even if the original license is expired or cancelled.

**How to test:**
1. Activate customer A with BIOS `TEST-001` and username `john`.
2. Try to activate a different customer B (different name) with username `john` and a different BIOS `TEST-002`.
3. The platform must reject this.

**If you can break it:** Creating customer B with a different BIOS and same username succeeds → **BUG**.

---

### Rule 1.3 — Username field auto-locks when BIOS has a prior link
**What it means:** On the customer create/activate form, if you type a BIOS ID that already has a linked username, the username field must auto-fill with the linked username and become read-only (locked).

**How to test:**
1. Find a BIOS ID that was previously activated (has a `BiosUsernameLink`).
2. Open the customer create form and type that BIOS ID.
3. The username field must fill automatically with the linked username.
4. The username field must be locked — you cannot type a different username.

**If you can break it:** Username field stays editable and accepts a different username → **BUG**.

---

### Rule 1.4 — Username rename is blocked for permanently linked users
**What it means:** If a customer has a `BiosUsernameLink`, a manager/manager-parent cannot rename their username — even through the Username Management page.

**How to test:**
1. Find a customer with an active `BiosUsernameLink`.
2. Log in as manager or manager-parent.
3. Go to Username Management for that customer and try to rename the username.
4. The platform must reject with an error mentioning "permanent BIOS-username link".

**If you can break it:** Rename succeeds → **BUG**.

---

### Rule 1.5 — Username unlock is blocked for permanently linked users
**What it means:** If a customer has a `BiosUsernameLink`, a manager/manager-parent cannot unlock their username.

**How to test:**
1. Find a customer with a `BiosUsernameLink`.
2. Log in as manager or manager-parent.
3. Try to unlock the username via Username Management.
4. Must be rejected.

**If you can break it:** Unlock succeeds → **BUG**.

---

## 2. License Activation Rules

### Rule 2.1 — An active BIOS cannot be activated by any other reseller
**What it means:** If BIOS `TEST-001` is currently `active` on any reseller's account in any tenant, no other reseller anywhere on the platform can activate the same BIOS.

**How to test:**
1. Activate BIOS `TEST-001` as reseller A.
2. Log in as reseller B (different tenant or same tenant).
3. Try to activate a new customer with BIOS `TEST-001`.
4. Must be rejected with "BIOS already active".

**If you can break it:** Reseller B can also activate the same BIOS → **BUG**.

---

### Rule 2.2 — A suspended BIOS cannot be activated by anyone
**What it means:** If a license for BIOS `TEST-001` is `suspended`, no one can activate a new license for that BIOS until the original is resumed or cancelled.

**How to test:**
1. Deactivate (suspend) a license for BIOS `TEST-001`.
2. Try to activate a new customer with the same BIOS from any role.
3. Must be rejected.

**If you can break it:** New activation succeeds while original is suspended → **BUG**.

---

### Rule 2.3 — A pending BIOS does NOT block other resellers
**What it means:** A `pending` license means the customer was created but not yet activated via the external API. Any reseller can activate their own customer with the same BIOS — first to call the external API wins.

**How to test:**
1. Create a customer with BIOS `TEST-001` (leave it pending — do not activate).
2. As a different reseller, try to create and activate a customer with BIOS `TEST-001`.
3. Must succeed (activation goes through).

**If you can break it:** Second reseller is blocked by the first reseller's pending license → **BUG**.

---

### Rule 2.4 — A blacklisted BIOS cannot be activated
**What it means:** If a BIOS ID is on the blacklist (status = active), no one on any role can activate a customer with that BIOS.

**How to test:**
1. Add BIOS `TEST-BLACK-001` to the blacklist (super-admin or manager-parent).
2. Try to activate a customer with that BIOS from any role.
3. Must be blocked.
4. Also check: the customer create form must show a blacklist warning and disable the Submit button.

**If you can break it:** Activation succeeds on a blacklisted BIOS → **BUG**.

---

### Rule 2.5 — The "Reactivate" action is hidden for blacklisted licenses
**What it means:** In the customer list, a cancelled/expired license for a blacklisted BIOS must not show a "Reactivate" button. Reactivating would bypass the blacklist.

**How to test:**
1. Find a licence with a BIOS that is currently on the blacklist.
2. Check the Actions dropdown in the customer list.
3. "Reactivate" must not appear.

**If you can break it:** "Reactivate" button appears and works for a blacklisted BIOS → **BUG**.

---

## 3. BIOS Change Request Rules

### Rule 3.1 — BCR requires a submitted request before approval
**What it means:** A BIOS ID change cannot happen directly without going through a BIOS Change Request (BCR) flow. There is no hidden endpoint that lets you change BIOS without a request.

**How to test:**
1. Try to change a BIOS ID directly (e.g. call the API without a pending BCR).
2. Only manager-parent has a "direct change" admin action — all other roles must go through BCR.
3. For reseller and manager: there must be no way to change BIOS without creating a BCR first.

**If you can break it:** Reseller or manager can change a BIOS ID without a BCR → **BUG**.

---

### Rule 3.2 — New BIOS in a BCR cannot be already active or suspended
**What it means:** When submitting a BCR, the target (new) BIOS must not be currently active or suspended on any license.

**How to test:**
1. Find a BIOS that has an `active` license.
2. Try to submit a BCR with that BIOS as the target new BIOS.
3. The form must show an error and the Submit button must be disabled.

**If you can break it:** BCR submits successfully with an already-active target BIOS → **BUG**.

---

### Rule 3.3 — New BIOS in a BCR cannot already be targeted by another pending BCR
**What it means:** Two BCRs cannot target the same new BIOS ID simultaneously.

**How to test:**
1. Submit a BCR targeting BIOS `NEW-001` (leave it in `pending` status — do not approve).
2. Try to submit a second BCR (from any role) also targeting `NEW-001`.
3. Must be rejected.

**If you can break it:** Two pending BCRs exist with the same new BIOS target → **BUG**.

---

### Rule 3.4 — BCR submit button must be disabled until BIOS check completes
**What it means:** On the BCR form, you must not be able to submit before the BIOS availability check has finished loading. The button must stay disabled while the check is running.

**How to test:**
1. Open the BCR page and type a new BIOS ID quickly.
2. Immediately try to click Submit before the availability check finishes.
3. The button must be disabled while the check is loading (spinner visible).

**If you can break it:** You can submit before the check finishes → **BUG**.

---

### Rule 3.5 — BCR submit button must be disabled for blacklisted target BIOS
**What it means:** If the new BIOS you type in the BCR form is on the blacklist, the Submit button must be disabled (not just a toast warning).

**How to test:**
1. Open the BCR form.
2. Type a BIOS ID that is on the blacklist.
3. The form must show a blacklist warning AND the Submit button must be disabled — you cannot click it.

**If you can break it:** Submit button is enabled for a blacklisted BIOS → **BUG**.

---

### Rule 3.6 — BiosUsernameLink only updates after successful external API response
**What it means:** When a BCR is approved, the BIOS-username link in the database only gets updated if the external software API confirms the change was successful. If the API fails, the link stays on the old BIOS and the BCR status becomes `approved_pending_sync`.

**How to test:**
1. Submit and approve a BCR.
2. If the external API call fails, check the BCR status — it must be `approved_pending_sync`.
3. Check the `bios_username_links` table — the old BIOS should still have the link, not the new BIOS.

**If you can break it:** Link is updated to new BIOS even when external API failed → **BUG**.

---

## 4. Role Boundary Rules

### Rule 4.1 — Reseller can only see their own customers
**What it means:** A reseller cannot view, edit, or take actions on customers belonging to another reseller — even within the same tenant.

**How to test:**
1. Log in as reseller A. Note a customer ID that belongs to reseller A.
2. Log in as reseller B. Try to access that customer by its ID (direct URL or API call).
3. Must be rejected with 403 or 404.

**If you can break it:** Reseller B can see or act on reseller A's customer → **BUG**.

---

### Rule 4.2 — Manager can only see their tenant's customers
**What it means:** A manager can see all resellers' customers within their own tenant, but not customers from another tenant.

**How to test:**
1. Note a customer from Tenant A.
2. Log in as manager of Tenant B.
3. Try to access that customer via direct URL or API.
4. Must be 403 or 404.

**If you can break it:** Manager of Tenant B can access Tenant A's customer → **BUG**.

---

### Rule 4.3 — Reseller cannot approve or reject BCRs
**What it means:** Only manager, manager-parent, and super-admin can approve or reject BIOS Change Requests. A reseller can only submit them.

**How to test:**
1. Log in as reseller.
2. Find a pending BCR.
3. Try to call the approve or reject API endpoint.
4. Must be rejected with 403.

**If you can break it:** Reseller can approve or reject a BCR → **BUG**.

---

### Rule 4.4 — Reseller cannot assign a license to another tenant's reseller
**What it means:** When a reseller creates a customer, the `seller_id` must be their own ID. They cannot set a different reseller's ID.

**How to test:**
1. Log in as reseller A.
2. Try to create a customer and set `seller_id` to reseller B's ID (API call).
3. Must be rejected.

**If you can break it:** Reseller A can create a license attributed to reseller B → **BUG**.

---

### Rule 4.5 — Manager-parent cannot assign a license to a reseller from another tenant
**What it means:** Manager-parent can assign licenses to any reseller in their own tenant, but not to resellers in a different tenant.

**How to test:**
1. Log in as manager-parent of Tenant A.
2. Find a reseller ID from Tenant B.
3. Try to create a customer with that reseller's `seller_id`.
4. Must be rejected.

**If you can break it:** Manager-parent creates a license for an out-of-tenant reseller → **BUG**.

---

## 5. Blacklist Rules

### Rule 5.1 — Adding a BIOS to the blacklist cancels all its active licenses immediately
**What it means:** When a BIOS is blacklisted, any `active`, `pending`, or `suspended` licenses for that BIOS must be cancelled immediately on all tenants.

**How to test:**
1. Activate a license for BIOS `TEST-001`.
2. Add `TEST-001` to the blacklist.
3. Immediately check the customer's status — must be `cancelled`.
4. Check the external API — the user must be deactivated.

**If you can break it:** License stays `active` after BIOS is blacklisted → **BUG**.

---

### Rule 5.2 — A removed blacklist entry still shows in history until permanently deleted
**What it means:** "Remove" sets status to `removed` but keeps the record. Only "Delete Permanently" removes it from the database entirely.

**How to test:**
1. Add a BIOS to the blacklist.
2. Click "Remove" — status becomes `removed`, row still visible.
3. Filter by "Removed" — the entry must still appear.
4. Click "Delete Permanently" — entry disappears from all views.

**If you can break it:** Clicking "Remove" makes the entry disappear entirely, or "Delete Permanently" doesn't remove it → **BUG**.

---

### Rule 5.3 — Only "Removed" entries can be permanently deleted
**What it means:** The "Delete Permanently" action is only available on entries with status `removed`. An `active` blacklist entry cannot be permanently deleted without first removing it.

**How to test:**
1. Find an active blacklist entry.
2. Check the actions dropdown — "Delete Permanently" must not appear.
3. Click "Remove" first, then "Delete Permanently" must appear.

**If you can break it:** "Delete Permanently" appears for active entries → **BUG**.

---

## 6. Schedule & Timezone Rules

### Rule 6.1 — Schedule dates default to the logged-in user's profile timezone
**What it means:** When opening the customer create/activate form, the "Starting from" date and timezone must default to the timezone set in the user's profile, NOT the browser's local timezone.

**How to test:**
1. Set your profile timezone to UTC+03:00.
2. Open the customer create form.
3. The timezone shown next to "Starting from" must be UTC+03:00, not your computer's local timezone (e.g. Africa/Cairo or Europe/London).

**If you can break it:** Timezone shown is the browser timezone, not the profile timezone → **BUG**.

---

### Rule 6.2 — Changing profile timezone updates the schedule form on next page load
**What it means:** If you change your profile timezone and then open the schedule form, it must reflect the new timezone.

**How to test:**
1. Change your profile timezone from UTC+02:00 to UTC+05:00.
2. Open the customer create form.
3. The schedule timezone must show UTC+05:00.

**If you can break it:** Old timezone still appears after profile update → **BUG**.

---

## 7. Authentication & Session Security

### Rule 7.1 — Auth token is NOT stored in localStorage or sessionStorage
**What it means:** After login, the raw authentication token must never appear in `localStorage` or `sessionStorage`. Only the user profile (name, email, role) is stored there. The actual token lives in an httpOnly cookie.

**How to test:**
1. Log in with any account.
2. Open browser DevTools → Application → Local Storage.
3. Find the `license-auth` key and expand the value.
4. The value must contain `user` data (name, email, role) but must NOT contain `token`.
5. Check Cookies — there must be an `auth_token` cookie with `HttpOnly` flag checked.

**If you can break it:** `token` key appears in localStorage → **BUG**.

---

### Rule 7.2 — After logout, all session data is cleared
**What it means:** After clicking Logout, both localStorage and sessionStorage must be cleared, and the auth cookie must be deleted.

**How to test:**
1. Log in and verify session data exists in localStorage.
2. Click Logout.
3. Check localStorage — `license-auth` key must be gone.
4. Check sessionStorage — must be empty.
5. Check Cookies — `auth_token` must be gone.
6. Try to access `/api/auth/me` directly — must return 401.

**If you can break it:** Any session data or cookie remains after logout → **BUG**.

---

### Rule 7.3 — Expired or invalid token redirects to login
**What it means:** If the auth token is expired or invalid (e.g. deleted from the server), any API call must return 401 and the frontend must redirect to the login page automatically.

**How to test:**
1. Log in.
2. In the database or via the API, revoke/delete the token.
3. Perform any action in the UI (e.g. load the customers page).
4. Must redirect to `/en/login`.

**If you can break it:** Application stays logged in after token is revoked → **BUG**.

---

## 8. Tenant Reset Rules

### Rule 8.1 — Tenant reset requires typing the exact tenant name
**What it means:** The reset confirmation dialog requires typing the exact tenant name. If the name doesn't match, reset must be rejected.

**How to test:**
1. Go to Tenants → Actions → Reset Tenant.
2. Type a slightly different name (extra space, wrong case).
3. Click Confirm — must be rejected.

**If you can break it:** Reset proceeds with wrong name → **BUG**.

---

### Rule 8.2 — Tenant reset deletes all operational data for that tenant
**What it means:** After reset, the following must be empty for that tenant: customers, licenses, BIOS change requests, BIOS access logs, BIOS conflicts, activity logs, API logs, financial reports, commissions, payments.

**How to test:**
1. Reset a tenant that has customers and licenses.
2. Go to Customers — must be empty.
3. Go to Reports — must be empty.
4. Go to Logs — must be empty.
5. Check BIOS Change Requests — must be empty.

**If you can break it:** Any operational data remains after reset → **BUG**.

---

### Rule 8.3 — Tenant reset creates a backup before deleting
**What it means:** The system always creates a backup snapshot before wiping data. After reset you must be able to see a new backup entry in the tenant's backups list.

**How to test:**
1. Reset a tenant.
2. Go to Tenants → Backups for that tenant.
3. A new backup entry must appear with a timestamp matching the reset time.

**If you can break it:** No backup is created, or backup is empty → **BUG**.

---

### Rule 8.4 — Resellers, managers, and settings are NOT deleted on reset
**What it means:** Reset only deletes operational data (customers, licenses, logs). The tenant's reseller accounts, manager accounts, programs, and settings must remain intact.

**How to test:**
1. Note the resellers and managers in a tenant.
2. Reset the tenant.
3. Go to Team Management — resellers and managers must still be there.
4. Programs must still be listed.

**If you can break it:** Resellers or managers are deleted on reset → **BUG**.

---

## 9. Username Management Rules

### Rule 9.1 — Username change is logged in activity
**What it means:** Every username rename must be recorded in the activity log with the old and new username.

**How to test:**
1. Rename a username via Username Management.
2. Go to the activity log for that customer/reseller.
3. An entry must show "username changed from X to Y".

**If you can break it:** No activity log entry for the rename → **BUG**.

---

### Rule 9.2 — Username change syncs with the external API
**What it means:** When a username is renamed, the external software API must be notified. The old username must be deactivated externally and the new one activated.

**How to test:**
1. Rename a username.
2. Check in the external software API (or check API logs) — old username must be removed, new one must be present.

**If you can break it:** External API still has the old username after rename → **BUG**.

---

## 10. General UI Safety Rules

### Rule 10.1 — Disabled buttons cannot be bypassed via the UI
**What it means:** If a button is disabled (greyed out), clicking it must do nothing. For example: a disabled Submit button on the BCR form must not submit even if clicked multiple times.

**How to test:**
1. Find any disabled button in the platform (e.g. BCR Submit when BIOS check is loading).
2. Click it rapidly multiple times.
3. No action must be triggered.

**If you can break it:** A disabled button triggers an action → **BUG**.

---

### Rule 10.2 — Error messages must not expose internal IDs or system details
**What it means:** Error messages shown to users (resellers, managers) must not contain database IDs, license numbers, or internal system details. For example, a username error must say "username is already active" — NOT "license 85 is active for this username".

**How to test:**
1. Trigger username conflict errors, BIOS conflict errors, and validation errors throughout the platform.
2. Read each error message carefully.
3. No error message should contain `license #XX`, `id: XX`, or raw database field names.

**If you can break it:** Error message shows internal license/database ID → **BUG**.

---

## Quick Bug Report Template

When you find a violation of any rule above, report it using this format:

```
BUG REPORT
Rule: [Rule number and title]
Role tested: [e.g. reseller, manager]
Steps to reproduce:
  1. ...
  2. ...
  3. ...
Expected: [what should happen]
Actual: [what actually happened]
Screenshot/video: [attach if possible]
```

---

*This document covers rules as of 2026-03-25. New rules added in future phases will be appended.*
