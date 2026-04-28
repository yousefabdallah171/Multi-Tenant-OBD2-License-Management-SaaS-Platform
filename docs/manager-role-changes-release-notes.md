# Manager Role Changes â€” Release Notes

Release date: 2026-04-09

## Summary

This release completes the Manager-role cleanup rollout, fixes the audited backend issues, improves Team Network freshness/performance, and adds Super Admin reseller assignment plus Granted Value drill-down reporting.

## Shipped Changes

### Manager Role Cleanup

- Removed incorrect Manager software-management capabilities
- Manager now uses catalog/view behavior instead of program CRUD
- Manager activation and renew flows now follow Reseller-style preset behavior where intended
- Removed the useless Manager filter from Manager Customers

### Backend Bug Fixes

- Fixed critical Manager software privilege-escalation risk
- Fixed Manager customer resolution after the removed `customer` role
- Added tenant scoping to Manager activity queries
- Removed dead `manager_id` handling from Manager Customers
- Fixed Super Admin `total_customers` to use distinct licensed customers

### Team Network

- Fixed initial double-fit behavior
- Moved AnimatedEdge keyframes out of per-edge inline style injection
- Added cache invalidation on team mutations
- Improved freshness so updates appear without manual refresh
- Added local browser persistence for dragged node positions
- Expanded Manager Parent Team Network to show same-tenant Manager Parents while still blocking cross-tenant leakage
- Fixed reseller revenue click-through to open reseller-specific detail

### Super Admin Reseller Assignment

- Added assignable manager / manager parent endpoint
- Super Admin reseller creation now requires assignment to a Manager Parent or Manager
- Super Admin user detail now shows who a reseller is assigned to

### Reporting

- Added Granted Value explanatory UI
- Added Granted Value drill-down endpoint and modal

### BIOS Scope And Actions

- Fixed Manager BIOS Details scope to only show the manager's own team data
- Changed Manager BIOS customer action from request-only flow to direct BIOS change flow

## Data Migration / Backfill

To repair historical orphaned live data in tenant `OBD2SW Main`, a new Manager Parent was created:

- Email: `main.parent@obd2sw.com`
- Role: `manager_parent`
- Tenant: `OBD2SW Main`

Backfill command executed:

```bash
php artisan resellers:backfill-assignments
```

Backfill result:

- reseller id `9` assigned to user id `62`
- reseller id `57` assigned to user id `62`

Important post-release action:
- Completed on 2026-04-09: password rotated for `main.parent@obd2sw.com`

## Validation Performed

- `npx tsc --noEmit -p tsconfig.app.json`
- `npm run lint`
  - passes with warnings only
- `php artisan test --filter=ManagerSoftwareManagementTest`
- Chromium/Playwright smoke testing across:
  - Super Admin
  - Manager Parent
  - Manager
  - Reseller
- Focused API/browser verification for:
  - Manager BIOS scoping
  - Super Admin reseller assignment
  - Manager preset activation/create flows
  - Team Network navigation and freshness

## Known Non-Blocking Issues

- Frontend lint still reports warnings in older unrelated files
- Only targeted PHPUnit coverage was executed here; a full suite run is still recommended before production deployment

## Recommended Final Pre-Deploy Steps

1. Run the manual checklist in `docs/manager-role-changes-manual-qa-checklist.md`
2. Run full backend test suite
3. Run frontend production build
