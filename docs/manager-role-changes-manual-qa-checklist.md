# Manager Role Changes â€” Manual QA Checklist

Last updated: 2026-04-09

Execution status:
- Executed on 2026-04-09 in local Chrome/Chromium automation
- Core release-path checks passed
- Verified: Super Admin reseller assignment, Manager Parent Team Network visibility, Manager preset activation behavior, Manager BIOS scoping, Reseller parity, Granted Value drill-down, and tenant 3 legacy reseller backfill visibility
- `main.parent@obd2sw.com` password was rotated after QA
- 2026-04-10 update: Automated re-checks only (no manual Chrome session in this run)
- ✅ Playwright: Manager BIOS direct-change flow (manager2@obd2sw.com) passed

Purpose:
- Final browser QA before live deployment
- Confirm Manager now behaves like Reseller where intended
- Confirm Team Network, Super Admin assignment, and BIOS scoping changes work end to end

Environment notes:
- Frontend: `http://localhost:3000`
- Run these checks in Chrome
- Use fresh login sessions per role when possible

Known validation baseline before starting:
- `npx tsc --noEmit -p tsconfig.app.json` passes
- `npm run lint` exits successfully with warnings only
- `php artisan test --filter=ManagerSoftwareManagementTest` passes

## 1. Super Admin

- [ ] Log in as `admin@obd2sw.com`
- [ ] Open `/en/super-admin/admin-management`
- [ ] Click `Add admin`
- [ ] Choose `Role = Reseller`
- [ ] Choose `Tenant = Test Tenant`
- [ ] Confirm `Assign to manager or manager parent` appears
- [ ] Confirm the dropdown shows tenant-local `manager_parent` and `manager` users only
- [ ] Create a reseller assigned to a `manager`
- [ ] Open `/en/super-admin/users/:id` for the created reseller
- [ ] Confirm `Assigned To` shows the selected owner

Expected:
- Assignment field appears only for reseller creation
- No cross-tenant owners appear
- User detail shows assigned owner correctly

## 2. Manager Parent Team Network

- [ ] Log in as `parent@obd2sw.com`
- [ ] Open `/en/team-network`
- [ ] Confirm the network loads without double-snap
- [ ] Confirm all Manager Parents in the same tenant are visible
- [ ] Confirm other tenants are not visible
- [ ] Click a reseller revenue stat card
- [ ] Confirm it opens the reseller-specific payment detail page, not the unfiltered reseller payments list
- [ ] Drag one or more nodes to new positions
- [ ] Refresh the page
- [ ] Confirm dragged node positions persist in the browser
- [ ] Create or update a team member from Team Management
- [ ] Return to `/en/team-network`
- [ ] Confirm the network updates without pressing Refresh

Expected:
- Same-tenant Manager Parents are visible
- Cross-tenant leakage is blocked
- Revenue click target is reseller-specific
- Node positions persist after refresh
- Team changes appear without manual refresh

## 3. Manager Customers And Activation

- [ ] Log in as `manager@obd2sw.com`
- [ ] Open `/en/manager/customers`
- [ ] Confirm there is no old top-right `Activate` button in the page header
- [ ] Confirm there is no `Filter by Manager` dropdown
- [ ] Confirm customer rows belong only to the manager's team
- [ ] Use the row action to renew an active license
- [ ] Confirm renew flow uses preset-based selection like Reseller
- [ ] Confirm there is no arbitrary manual end-date pricing flow in Manager renew
- [ ] Open `/en/manager/customers/create`
- [ ] Confirm create flow uses `Duration Presets`
- [ ] Confirm price is locked to the selected preset
- [ ] Confirm old manual end-date/duration controls are not shown for Manager create
- [ ] Create-and-activate a test customer if safe in the environment

Expected:
- Manager customer actions match Reseller behavior for activation and renew
- Manager cannot set arbitrary duration/end-date/price in preset-only flows

## 4. Manager Software Catalog

- [ ] While still logged in as Manager, open `/en/manager/software`
- [ ] Confirm software catalog loads
- [ ] Confirm this is catalog/view behavior only, not software management CRUD
- [ ] Confirm removed Manager software-management routes are not reachable from navigation

Expected:
- Manager has catalog access
- Manager no longer has program management UI

## 5. Manager BIOS Scope And Direct Change

- [ ] As Manager, open `/en/manager/bios-details`
- [ ] Search for a known Manager-owned/team BIOS such as `GV-MGR-OWN-001`
- [ ] Confirm it is visible
- [ ] Search for a BIOS outside the Manager's team, such as `GV-PARENT-OWN-001` or `GV-SUPER-OWN-001`
- [ ] Confirm it does not appear in the search list
- [ ] Open a Manager customer row action for BIOS change
- [ ] Confirm the screen is direct BIOS change, not a request-only form
- [ ] Submit a safe test change only if environment rules allow it

Expected:
- BIOS search/details are limited to the manager's own team only
- Manager uses direct BIOS change flow

## 6. Manager Parent Customer Directory

- [ ] Log in as `parent@obd2sw.com`
- [ ] Open `/en/customers`
- [ ] Confirm customer counts load
- [ ] Confirm customer table rows load
- [ ] Filter by Manager Parent, Manager, Reseller, and Program
- [ ] Confirm filtering updates correctly

Expected:
- No empty-state bug on valid seeded data
- Filters behave normally

## 7. Reseller Parity Checks

- [ ] Log in as `reseller@obd2sw.com`
- [ ] Open `/en/reseller/customers/create`
- [ ] Confirm preset-based activation UI still works
- [ ] Open `/en/reseller/software`
- [ ] Confirm software catalog still loads
- [ ] Open `/en/reseller/customers`
- [ ] Confirm core customer actions still render normally

Expected:
- Reseller behavior remains unchanged by Manager-role cleanup

## 8. Super Admin Reports

- [ ] Log in as `admin@obd2sw.com`
- [ ] Open `/en/super-admin/reports`
- [ ] Confirm `Granted Value` card renders
- [ ] Confirm the explanatory help/tooltip text is present
- [ ] Click the card
- [ ] Confirm the granted-activations drill-down opens
- [ ] Apply date filters
- [ ] Confirm the drill-down respects those filters
- [ ] Confirm `total_customers` looks consistent with licensed customers, not removed-role counts

Expected:
- Granted Value is explainable and drillable
- Customer total uses license-backed distinct customers

## 9. Legacy Data Backfill Verification

- [ ] Log in as `main.parent@obd2sw.com`
- [ ] Password should be rotated before production use
- [ ] Open that tenant's Team Network or team pages
- [ ] Confirm legacy resellers `reseller2@obd2sw.com` and `dDDDD@DDASD.DASDAS` now appear under the new Manager Parent

Expected:
- Legacy orphaned reseller rows are no longer orphaned
- `created_by = 62` for reseller ids `9` and `57`

## 10. Release Decision

- [ ] All critical checks above pass
- [ ] No new browser console 500s in tested flows
- [ ] No cross-tenant or cross-team data leakage observed
- [ ] Password for `main.parent@obd2sw.com` is rotated if the account will remain in live data

If all boxes pass, this rollout is ready for deployment.
