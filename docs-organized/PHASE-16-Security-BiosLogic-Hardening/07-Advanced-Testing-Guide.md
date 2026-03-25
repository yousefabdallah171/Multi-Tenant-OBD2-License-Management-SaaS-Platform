# Advanced Testing Guide — Reports, API, Logs, Analytics & Numbers

Last updated: 2026-03-25

---

## How to Use This Document

This guide tells you **exactly what numbers to expect** when you test each part of the platform.
Every section has:
- What the feature does
- What you should do to test it
- What the correct result must be
- What counts as a bug

---

## Part 1 — External Software API Integration

### What It Does
When you activate, renew, deactivate, or change a BIOS on a license, the platform makes a real call to the external software API to add/remove that user from the software system.

### API Actions and When They Are Called

| Platform Action | External API Call |
|---|---|
| Activate license | `apiuseradd` — adds username to software |
| Renew license | `apiuseradd` — re-adds username (refreshes expiry) |
| Deactivate (suspend) license | `apideluser` — removes username from software |
| Cancel license | `apideluser` — removes username from software |
| Approve BIOS change request | First `apideluser` on old BIOS username, then `apiuseradd` on new BIOS |
| Resume paused license | `apiuseradd` — re-adds username |

### Rule 1.1 — Activation must reach the external API

**Test steps:**
1. Create a new customer and activate their license.
2. Go to API Logs (super-admin or manager-parent panel).
3. Find the most recent log entry for that customer's username.
4. The log must show: action = `activate`, status = `success`, response contains `true`.

**If you can break it:** No API log entry appears after activation, or status = `failed` → **BUG**.

---

### Rule 1.2 — Deactivation must remove the user from the external software

**Test steps:**
1. Deactivate an active license.
2. Go to API Logs and find the entry for that username.
3. The log must show: action = `deactivate`, status = `success`.
4. Optionally: check in the external software system — the username must no longer appear there.

**If you can break it:** API log shows success but user is still in external software → **BUG**.

---

### Rule 1.3 — BIOS change: old user removed, new user added

**Test steps:**
1. Approve a BIOS change request.
2. Go to API Logs.
3. You must find TWO entries in sequence:
   - First: `deactivate` for the OLD BIOS username — status `success`
   - Second: `activate` for the NEW BIOS username — status `success`

**If you can break it:** Only one API call is logged, or the order is reversed → **BUG**.

---

### Rule 1.4 — If external API fails, activation is rolled back

**Test steps:**
1. Simulate an API failure (disconnect from internet or use an invalid API key temporarily).
2. Try to activate a license.
3. The platform must show an error message.
4. The license status must remain `pending` — NOT `active`.
5. Check the customer — they must not appear in the external software.

**If you can break it:** License becomes `active` even though the external API call failed → **BUG**.

---

### Rule 1.5 — API Key is never shown in logs or error messages

**Test steps:**
1. Trigger an API error (wrong credentials).
2. Read the error message shown in the UI.
3. Read the API log entry.
4. The actual API key value must not appear anywhere — it must show `[REDACTED]`.

**If you can break it:** Raw API key appears in a log, error message, or UI toast → **BUG**.

---

### Rule 1.6 — API unavailable shows a user-friendly error, not a crash

**Test steps:**
1. Simulate external API being unreachable (e.g. block the domain).
2. Try to activate a license.
3. The UI must show a clear error message like "External API is currently unavailable".
4. The page must not crash or show a raw PHP/server error.

**If you can break it:** Page crashes, shows stack trace, or shows raw HTML error → **BUG**.

---

## Part 2 — Reports: Numbers Must Be Accurate

### How to Test Reports Correctly

Always test reports by **creating known data first**, then checking the numbers.
Example method: "I will activate 3 licenses at price 100, so total_revenue should be exactly 300."

---

### Rule 2.1 — Reseller Report: total_revenue matches sum of license prices

**Test steps:**
1. Log in as a reseller with zero existing data (or note current total).
2. Activate 3 licenses: price 100, price 150, price 50 = total should be 300.
3. Go to Reports → Summary.
4. `total_revenue` must show 300 (or existing total + 300).
5. `total_activations` must increase by 3.

**If you can break it:** Revenue shows a different number than the sum of prices → **BUG**.

---

### Rule 2.2 — Renewals also count toward revenue

**Test steps:**
1. Renew an existing license at price 75.
2. Check the reseller report — revenue must increase by 75.
3. `total_activations` must also increase by 1 (renewals count as activations in reports).

**If you can break it:** Renewal revenue is not counted → **BUG**.

---

### Rule 2.3 — Revenue by Period (monthly/weekly/daily) groups correctly

**Test steps:**
1. Activate 2 licenses on March 1st at price 100 each.
2. Activate 1 license on April 1st at price 200.
3. Go to Reports → Revenue → Monthly view.
4. March must show: revenue = 200.
5. April must show: revenue = 200.
6. They must appear as separate rows/bars.

**If you can break it:** All revenue appears in one month, or months are grouped wrong → **BUG**.

---

### Rule 2.4 — Date filter excludes licenses outside the range

**Test steps:**
1. Activate licenses: 2 in January, 2 in March.
2. Open Reports and filter from March 1 to March 31.
3. Report must show only the 2 March activations.
4. January activations must not appear in the filtered report.

**If you can break it:** Filtered report includes licenses outside the date range → **BUG**.

---

### Rule 2.5 — Manager report: revenue includes ALL team resellers

**Test steps:**
1. Log in as manager.
2. Reseller A (under your team) activates 2 licenses at 100 each = 200.
3. Reseller B (under your team) activates 1 license at 150 = 150.
4. Go to Manager Reports → Summary.
5. `total_revenue` must be 350 (200 + 150).
6. Revenue by Reseller must show: Reseller A = 200, Reseller B = 150.

**If you can break it:** Manager report shows only one reseller's revenue → **BUG**.

---

### Rule 2.6 — Manager cannot see resellers from another tenant

**Test steps:**
1. Log in as Manager of Tenant A.
2. Note total revenue in Tenant A's reports.
3. Log in as manager of Tenant B and activate some licenses.
4. Log back into Tenant A manager — their report must NOT include Tenant B data.

**If you can break it:** Tenant A manager's report shows Tenant B revenue → **BUG**.

---

### Rule 2.7 — Manager-parent report: revenue includes ALL resellers in tenant

**Test steps:**
1. Have multiple managers/resellers all activate licenses in the same tenant.
2. Log in as manager-parent.
3. Reports → Revenue by Reseller must list ALL resellers (including those under sub-managers).
4. The total must equal the sum of all individual reseller revenues.

**If you can break it:** Manager-parent report misses some resellers or shows wrong total → **BUG**.

---

### Rule 2.8 — Super-admin report: revenue grouped by tenant

**Test steps:**
1. Activate licenses in Tenant A (total 500) and Tenant B (total 1200).
2. Log in as super-admin.
3. Go to Reports → Revenue by Tenant.
4. Tenant A must show 500, Tenant B must show 1200.

**If you can break it:** Tenant revenues are mixed up or wrong → **BUG**.

---

### Rule 2.9 — CSV export includes all data, not just the current page

**Test steps:**
1. Create 30+ license records.
2. The table shows 25 per page (so 2 pages).
3. Click Export CSV.
4. Open the downloaded file — it must contain ALL 30+ records, not just the 25 on the first page.

**If you can break it:** CSV only contains the current page's data → **BUG**.

---

### Rule 2.10 — Top Programs report sorts by revenue (highest first)

**Test steps:**
1. Activate 3 licenses for Program A at 100 each = 300.
2. Activate 5 licenses for Program B at 50 each = 250.
3. Go to Reports → Top Programs.
4. Program A must appear FIRST (300 > 250).

**If you can break it:** Programs appear in wrong order → **BUG**.

---

### Rule 2.11 — active_customers count matches actual active licenses

**Test steps:**
1. Note the current `active_customers` count in your reseller report.
2. Activate 2 more licenses.
3. Refresh the report — `active_customers` must increase by exactly 2.
4. Deactivate 1 of those licenses.
5. Refresh the report — `active_customers` must decrease by exactly 1.

**If you can break it:** Count does not change, or changes by wrong amount → **BUG**.

---

## Part 3 — Reseller Logs

### What Reseller Logs Track

Reseller logs show every action a reseller has taken: activations, renewals, deactivations, deletions — with the price and customer info for each.

### Rule 3.1 — Reseller logs revenue matches sum of activation + renewal prices

**Test steps:**
1. As a reseller: activate 2 licenses at price 50 each, then renew 1 at price 30.
2. Manager or manager-parent logs in.
3. Go to Reseller Logs → find that reseller.
4. Summary must show:
   - `activations` = 2
   - `renewals` = 1
   - `revenue` = 50 + 50 + 30 = **130**

**If you can break it:** Revenue is different from sum of activation + renewal prices → **BUG**.

---

### Rule 3.2 — Deactivations and deletions are counted separately from revenue

**Test steps:**
1. Reseller deactivates 2 licenses and deletes 1 license.
2. Go to Reseller Logs for that reseller.
3. `deactivations` = 2, `deletions` = 1.
4. These actions must NOT add to `revenue` (deactivations don't earn money).

**If you can break it:** Revenue increases when a license is deactivated or deleted → **BUG**.

---

### Rule 3.3 — Reseller can only see their own logs

**Test steps:**
1. Log in as reseller A and check the Reseller Logs/Panel Activity page.
2. All entries must only be actions performed by reseller A.
3. Log in as reseller B — their logs must only show their own actions.

**If you can break it:** Reseller A can see reseller B's log entries → **BUG**.

---

### Rule 3.4 — Manager can see all team resellers' logs

**Test steps:**
1. Resellers A and B are both under Manager M.
2. Log in as Manager M.
3. Go to Reseller Logs — must be able to filter by reseller A or reseller B.
4. Must be able to see logs for both.

**If you can break it:** Manager can only see one reseller's logs, or sees no logs for team members → **BUG**.

---

### Rule 3.5 — Date filter in reseller logs works correctly

**Test steps:**
1. Reseller activates 2 licenses on March 1st and 2 licenses on April 5th.
2. Filter logs from March 1 to March 31.
3. Only the 2 March entries must appear — April entries must be excluded.

**If you can break it:** Logs outside the date range appear → **BUG**.

---

## Part 4 — Activity Logs / Panel Activity

### What Activity Logs Track

Every significant action in the platform creates an activity log entry:
- License activated, renewed, deactivated, cancelled, deleted
- BIOS change requested, approved, rejected
- Customer created, updated
- Blacklist additions/removals
- Username changes
- BCR direct BIOS changes (manager-parent)

### Rule 4.1 — Every license activation creates an activity log entry

**Test steps:**
1. Activate a license for customer X.
2. Go to Panel Activity (manager) or Activity Logs (super-admin).
3. Find the entry for that activation.
4. The entry must show:
   - Action: `license.activated` (or similar activation action)
   - Customer name / BIOS ID
   - Timestamp matching when you activated

**If you can break it:** No activity log entry exists after activation → **BUG**.

---

### Rule 4.2 — Activity log entries contain correct metadata

**Test steps:**
1. Activate a license.
2. Find its activity log entry.
3. Open/expand the metadata.
4. Must contain: `bios_id`, `customer_id`, `program_id`, `price` (if applicable).

**If you can break it:** Metadata is empty or missing key fields → **BUG**.

---

### Rule 4.3 — Activity log is scoped correctly by role

**Test steps:**
1. Log in as reseller — Panel Activity should only show that reseller's own actions.
2. Log in as manager — Panel Activity shows all resellers under the manager.
3. Log in as manager-parent — shows all activity for the entire tenant.
4. Log in as super-admin — shows all activity across all tenants.

**If you can break it:** Reseller sees another reseller's activity, or manager sees another tenant's activity → **BUG**.

---

### Rule 4.4 — Blacklist action is logged

**Test steps:**
1. Add a BIOS to the blacklist.
2. Check Activity Logs.
3. Must find an entry: action = `bios.blacklist.add`, description mentions the BIOS ID.
4. Remove the BIOS from the blacklist.
5. Must find another entry: action = `bios.blacklist.remove`.

**If you can break it:** No log entry after blacklist add or remove → **BUG**.

---

### Rule 4.5 — BCR actions are all logged

**Test steps:**
1. Submit a BCR → activity log must show `bios.change_requested`.
2. Approve the BCR → activity log must show `bios.change_approved`.
3. Test with reject: Reject a BCR → activity log must show `bios.change_rejected`.

**If you can break it:** Any of these three BCR actions has no log entry → **BUG**.

---

## Part 5 — BIOS Conflicts

### What a BIOS Conflict Is

A BIOS conflict is recorded when two or more parties try to use the same BIOS ID simultaneously, or when there is an ambiguous/conflicting activation state for a BIOS ID across resellers.

### Rule 5.1 — BIOS conflicts list shows correct counts

**Test steps:**
1. Go to BIOS Conflicts page (super-admin or manager-parent).
2. Note the total count shown.
3. Note how many are "Open" vs "Resolved".
4. Count the actual rows on the page (accounting for pagination).
5. Open count + Resolved count must equal Total count.

**If you can break it:** The sum of Open + Resolved ≠ Total → **BUG**.

---

### Rule 5.2 — Resolving a conflict marks it resolved

**Test steps:**
1. Find an open (unresolved) BIOS conflict.
2. Click Resolve and add resolution notes.
3. Submit.
4. The conflict must now show as `Resolved` status.
5. The "Open" count must decrease by 1.
6. The "Resolved" count must increase by 1.
7. The total count must remain the same.

**If you can break it:** Conflict still shows as open after resolving, or counts don't update → **BUG**.

---

### Rule 5.3 — Manager cannot resolve another tenant's conflicts

**Test steps:**
1. Find a BIOS conflict that belongs to Tenant B.
2. Log in as manager of Tenant A.
3. Try to resolve that conflict via the API.
4. Must receive 403 or 404.

**If you can break it:** Manager of Tenant A can resolve Tenant B's conflicts → **BUG**.

---

### Rule 5.4 — Filter by status works correctly

**Test steps:**
1. On the BIOS Conflicts page, filter by "Open".
2. Every row shown must have status = `open`.
3. Change filter to "Resolved".
4. Every row shown must have status = `resolved`.

**If you can break it:** Filtering by "Open" shows resolved entries → **BUG**.

---

## Part 6 — IP Analytics

### What IP Analytics Shows

IP analytics tracks which IP addresses are being used to access the external software, and maps them to customers and resellers. It also shows if an IP is a proxy or hosting provider.

### Rule 6.1 — IP analytics shows data for the correct reseller only

**Test steps:**
1. Log in as reseller A.
2. Check IP Analytics — must only show IP data for reseller A's customers.
3. Log in as reseller B.
4. Check IP Analytics — must only show reseller B's customers.
5. No cross-reseller data must appear.

**If you can break it:** Reseller A's IP analytics shows data from reseller B's customers → **BUG**.

---

### Rule 6.2 — Manager-parent IP analytics shows all tenant data

**Test steps:**
1. Multiple resellers in the tenant have customer IP activity.
2. Log in as manager-parent.
3. IP Analytics must show data from ALL resellers in the tenant — not just one.

**If you can break it:** Manager-parent only sees one reseller's IP data → **BUG**.

---

### Rule 6.3 — Proxy/Hosting filter works correctly

**Test steps:**
1. Open IP Analytics.
2. Select filter: "Proxy / Hosting".
3. Every row shown must have `proxy = true` OR `hosting = true`.
4. Select filter: "Safe".
5. Every row shown must have `proxy = false` AND `hosting = false`.

**If you can break it:** "Safe" filter shows entries with proxy or hosting flags → **BUG**.

---

### Rule 6.4 — IP geolocation data is populated

**Test steps:**
1. Open IP Analytics.
2. Check the country and ISP columns.
3. For real IP addresses (not localhost), the country and ISP must be filled — not blank or "Unknown".
4. For local/private IPs (192.168.x.x), "Unknown" is acceptable.

**If you can break it:** Country and ISP are always blank even for real public IPs → **BUG**.

---

### Rule 6.5 — Search works across username, BIOS ID, IP address, program name

**Test steps:**
1. In IP Analytics, type a known BIOS ID in the search box.
2. Only rows matching that BIOS ID must appear.
3. Clear search, type a known IP address.
4. Only rows with that IP must appear.
5. Clear search, type a known username.
6. Only rows with that username must appear.

**If you can break it:** Search returns no results for known data, or returns wrong results → **BUG**.

---

## Part 7 — BIOS History

### What BIOS History Shows

BIOS History is a global timeline of all events related to BIOS IDs: activations, blacklistings, conflicts. It's a cross-reference tool for super-admin to investigate a BIOS ID's history.

### Rule 7.1 — Every blacklisted BIOS appears in BIOS History

**Test steps:**
1. Add BIOS `TEST-HIST-001` to the blacklist.
2. Go to BIOS History.
3. Search for or scroll to `TEST-HIST-001`.
4. An entry must appear with action = `Blacklist`.

**If you can break it:** Blacklisted BIOS does not appear in BIOS History → **BUG**.

---

### Rule 7.2 — Permanently deleted blacklist entries disappear from BIOS History

**Test steps:**
1. Add BIOS `TEST-HIST-002` to the blacklist.
2. Remove it (status → removed).
3. Permanently delete it.
4. Go to BIOS History — `TEST-HIST-002` must no longer appear.

**If you can break it:** Permanently deleted BIOS still appears in BIOS History → **BUG**.

---

### Rule 7.3 — Filter by date range excludes entries outside the range

**Test steps:**
1. Add BIOS entries on two different dates.
2. Filter BIOS History from Date A to Date B.
3. Only entries within that date range must appear.

**If you can break it:** Entries outside the date range appear → **BUG**.

---

## Part 8 — BIOS Details Page

### What BIOS Details Shows

The BIOS Details page gives a full picture of one specific BIOS ID: all its licenses, which resellers used it, its IP activity, and its full activity log.

### Rule 8.1 — BIOS Details "Total Activations" matches actual license count

**Test steps:**
1. Activate 3 licenses for the same BIOS ID over time (using renew).
2. Open BIOS Details for that BIOS ID.
3. `Total Activations` must equal 3.

**If you can break it:** Total activations count is wrong → **BUG**.

---

### Rule 8.2 — BIOS Details Activity Log only shows events for THAT BIOS

**Test steps:**
1. Open BIOS Details for BIOS `TEST-001`.
2. Read every entry in the Activity Log tab.
3. Every entry must mention `TEST-001` — not a different BIOS ID.
4. No entries from other BIOS IDs must appear.

**This was a known bug (substring match)** — if you see activity from a different BIOS ID in this log → **BUG**.

---

### Rule 8.3 — Blacklist Status tab reflects current blacklist state

**Test steps:**
1. Open BIOS Details for a BIOS that is on the blacklist.
2. Go to "Blacklist Status" tab.
3. Must show: Status = Active, who added it, when, and the reason.
4. Remove the BIOS from the blacklist.
5. Refresh — Blacklist Status must now show: Status = Removed (or Not Blacklisted).

**If you can break it:** Blacklist Status tab shows incorrect status → **BUG**.

---

### Rule 8.4 — Resellers tab shows each reseller who activated this BIOS

**Test steps:**
1. Have two different resellers activate the same BIOS at different times.
2. Open BIOS Details for that BIOS.
3. The Resellers tab must list both resellers.

**If you can break it:** Only one reseller appears when two have used the same BIOS → **BUG**.

---

## Part 9 — Recent BIOS Suggestions (Search Bar)

### Rule 9.1 — Recent BIOS list should only show BIOS IDs with real history

**Test steps:**
1. Open BIOS Details page (any role).
2. Look at the list of recent BIOS IDs shown below the search bar.
3. Every BIOS ID shown must have actual license or access log history in the system.
4. BIOS IDs that were permanently deleted from the blacklist (and have no licenses) must NOT appear.

**If you can break it:** A permanently deleted BIOS ID still appears in the recent list → **BUG**.

---

### Rule 9.2 — Manager's recent BIOS list is scoped to their tenant

**Test steps:**
1. Log in as manager.
2. Check the BIOS Details recent BIOS list.
3. Every BIOS ID shown must belong to licenses within that manager's tenant.
4. Global blacklist-only BIOS IDs (with no tenant-scoped licenses) must NOT appear.

**If you can break it:** Manager sees BIOS IDs from another tenant → **BUG**.

---

## Part 10 — Customer Count Accuracy

### Rule 10.1 — Customer count on dashboard matches actual records

**Test steps:**
1. Note the current customer count on the dashboard or customer list page.
2. Create 3 new customers.
3. Refresh — the count must increase by exactly 3.
4. Delete 1 customer.
5. Refresh — the count must decrease by exactly 1.

**If you can break it:** Count does not match actual number of customer records → **BUG**.

---

### Rule 10.2 — Status tabs on customer list match filtered counts

**Test steps:**
1. On the customers page, note the number shown on each status tab:
   - All: X
   - Active: A
   - Expired: E
   - Cancelled: C
   - Pending: P
2. The sum: A + E + C + P + Scheduled + Deactive must equal X (All).
   *(Note: a customer with licenses in multiple statuses counts once in "All" but can appear in multiple status views — see known behavior below.)*
3. Click each status tab and count the rows — the row count must match the tab number.

**Known behavior:** If a customer has licenses under two different resellers, they may count once in "All" but appear in per-reseller filtered views for both. This is correct, not a bug.

**If you can break it:** Active + Expired + Cancelled + Pending ≠ All total → **BUG** (unless explained by the known behavior above).

---

### Rule 10.3 — Reseller filter on customer list shows only that reseller's customers

**Test steps:**
1. On the customers page (manager/manager-parent/super-admin view), select a specific reseller from the filter.
2. Every customer shown must belong to that reseller.
3. Select a different reseller — must show completely different set of customers (unless shared).

**If you can break it:** Filtering by reseller A shows customers from reseller B → **BUG**.

---

## Quick Reference — Numbers That Must Always Match

| What | Must Equal |
|---|---|
| Report total_revenue | Sum of all license prices (activated_at is not null) |
| Report total_activations | Count of licenses created (including renewals) |
| Report active_customers | Count of licenses with status = `active` |
| Reseller log revenue | Sum of `license.activated` + `license.renewed` prices |
| BIOS Details total_activations | Count of licenses for that BIOS ID |
| Conflict counts | Open + Resolved = Total |
| Customer tab counts | Each tab count = rows visible in that tab |
| API log entries | One entry per external API call |
| Activity log entries | One entry per action performed |

---

## Bug Report Template

```
BUG REPORT
Category: [Report / API / Logs / IP Analytics / Conflicts / History / Counts]
Rule: [Rule number from this document]
Role tested: [reseller / manager / manager-parent / super-admin]
Steps to reproduce:
  1. ...
  2. ...
  3. ...
Expected: [exact number or behavior]
Actual: [what you saw]
Screenshot: [attach]
```

---

*This document covers advanced testing as of 2026-03-25. See 06-Platform-Invariants-For-Testers.md for BIOS lock, auth, and role boundary rules.*
