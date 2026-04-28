# 2026-04-11 Session Updates

## Summary
This document records the platform changes completed during the April 11, 2026 session across Manager Parent, Team Network, customer ownership, pricing, online users, BIOS audit, and reseller UI behavior.

It is intended as a handoff/reference file for future work, deployment checks, and live-data repair.

## Major Areas Updated

### 1. BIOS Change Audit
- Added a new Manager Parent read-only BIOS change audit page.
- Added backend endpoints for:
  - `GET /bios-change-audit`
  - `GET /bios-change-audit/summary`
- Merged BIOS request history and direct BIOS change history into one audit feed.
- Added summary cards, filters, manual expandable table rows, routing, sidebar entry, and translations.
- Corrected:
  - summary card count to 5
  - status filtering cross-contamination between request rows and direct-change rows
  - manager/reseller team dropdown loading through `teamService.getAll(...)`
  - translation key placement

### 2. Team Network Drill-Down
- Added scoped drill-down links from Team Network to:
  - Reports
  - Team Management
  - Customers
  - Reseller Payments
- Standardized subtree query parameters:
  - `manager_parent_id`
  - `manager_id`
  - `reseller_id`
- Added subtree filtering support to destination pages and backend endpoints.
- Added active-scope behavior to keep destination pages aligned with the clicked node.

### 3. Manager Parent Reports and Dashboard
- Changed the Manager Parent dashboard revenue card to align with Reports totals instead of showing monthly-only revenue.
- Removed stale/misleading revenue labeling mismatch between dashboard and reports.
- Added clearer copy on Reseller Payments to explain why reseller-only balances differ from total reports.

### 4. Super Admin Reports
- Removed the `Granted value` metric from the Super Admin reports UI.
- This metric is no longer intended to appear in the report experience.

### 5. Online Users Visibility by Role
- Updated online-user display logic so:
  - `super_admin` sees real names
  - `manager_parent` sees real names
  - `manager` still sees masked names for others
  - `reseller` still sees masked names for others
- Preserved existing scope rules for who appears online.

### 6. Customer Ownership and Takeover Logic
- Reworked ownership resolution to use current blocking license ownership instead of stale creator relationships.
- Fixed stale-owner visibility across:
  - reseller customer pages
  - manager customer pages
  - manager-parent customer pages
  - super-admin customer pages
- Applied current-owner logic to:
  - status
  - allowed actions
  - current counts
  - displayed seller
- Old owners now remain historical only where appropriate.
- Current owner is determined by current blocking license state, not `created_by`.

### 7. BIOS Blocking / Takeover Safety
- Fixed stale active BIOS blocking scenarios.
- Prevented expired historical ownership from still behaving like a current blocking owner.
- Ensured takeover scenarios move current ownership to the new seller correctly.
- Preserved historical seller rows where intended.

### 8. Pricing Integrity
- Added stronger reasonable-price validation using the shared ownership support layer.
- Normalized display price resolution to prefer valid license price and fall back to valid activity-log price when needed.
- Prevented giant corrupted display values from surfacing as real prices in customer and report views.

### 9. Activation/Post-Activation Error Handling
- Fixed cases where activation succeeded but the frontend still received a `500` because of non-critical side effects after the write.
- Wrapped post-activation cache invalidation and event-like side effects more safely.
- Result:
  - activation can succeed without being misreported as failed because of downstream cleanup issues
  - frontend behavior is more reliable for live usage

### 10. Reseller Customer UI Behavior
- Removed the `Active w/ other reseller` badge from the reseller customer list UI only.
- Kept the actual blocking behavior intact:
  - action restrictions still apply
  - add/activate flows still show BIOS conflict errors
- The backend `bios_active_elsewhere` flag still exists and is still used for enforcement.

## Ownership/Status Rules After This Session

### Current Owner
The current owner is the seller attached to the current blocking license for that BIOS/customer.

Blocking statuses include:
- active and not expired
- suspended
- scheduled pending
- paused pending with remaining pause time

### Historical Owner
Historical owners may still have expired/cancelled records visible where allowed, but:
- they must not look like the current owner
- they must not get current-owner actions
- they must not inflate current customer counts

## `bios_active_elsewhere` Behavior
The backend still computes `bios_active_elsewhere` when the displayed row is not the current blocking owner and another blocking license exists for the same BIOS.

Current reseller UI behavior:
- the orange badge is hidden in the reseller customer list
- actions remain blocked
- create/activate still shows the BIOS conflict message

Manager / Manager Parent behavior:
- the warning badge can still be shown in those views

## Live Data Repair Support

### Repair Command
The owner-repair command was extended to support correcting bad live data:

```bash
php artisan licenses:reassign-current-owner
```

It now supports repairing:
- current owner
- current price
- current start/end dates
- preserved historical owner
- historical price
- historical start/end dates

### Example Use Case
For a BIOS reassigned from a reseller to a manager parent where:
- current active row must belong to the new seller
- historical reseller row must remain expired
- price/date values must be corrected

Use `--dry-run` first, then rerun with `--force`.

## Verification Performed
- `php artisan test --filter=AuthorizationBoundaryTest`
- `php artisan test --filter=FinancialReportAccountingTest`
- `npm run build`

All passed after the final fixes in this session.

## Relevant Commits
- `cca9e8e` Hide reseller active elsewhere badge
- `53a5c01` Support repaired values for reassigned licenses
- `7858819` Prevent post-activation side effects from returning 500
- `93fd189` Preserve history during license owner repair
- `a901bee` Fix stale active BIOS ownership blocking
- `f0a7941` Fix customer ownership takeover and price display
- `15ef1e7` fixing issue in leeak data for cosumter
- `69b9029` makeing the parente manger see parent mange online
- `83bea22` fixing online for this
- `4b06999` Remove granted value from super admin reports
- `d917123` Align manager parent dashboard revenue card with reports
- `755cbff` adding emeail to network team network

## Deployment Notes
- If a change is visible locally but not on the live website, confirm:
  - the commit is pushed to `dev`
  - the live site has pulled the latest `dev`
  - frontend assets were rebuilt/deployed
  - any reverse-proxy/browser cache has been cleared

## Remaining Caution
- Old corrupted rows created before these fixes may still need one-time repair.
- New normal activation/takeover flows should now follow the corrected ownership and pricing rules without manual intervention.
