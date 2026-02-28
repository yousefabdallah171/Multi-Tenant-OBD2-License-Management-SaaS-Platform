# PHASE 04: Manager/Reseller - Completion Checklist

**Status:** Complete  
**Validated On:** 2026-02-28  
**Scope Basis:** `01-Phase-Overview.md` + `02-TODO-List.md`

---

## Backend

- [x] `app/Services/LicenseService.php` with activate, renew, and deactivate flows
- [x] BIOS validation, duplicate active-license protection, blacklist checks, and customer upsert flow
- [x] External API activation, renewal, and deactivation calls wired through `ExternalApiService`
- [x] Revenue recording and activity logging wired through `BalanceService` and `activity_logs`
- [x] License broadcast events added: `LicenseActivated`, `LicenseRenewed`, `LicenseDeactivated`
- [x] Manager controllers added: Dashboard, Team, Username Management, Customer, Report, Activity
- [x] Reseller controllers added: Dashboard, Customer, License, Report, Activity
- [x] Form requests added: `ActivateLicenseRequest.php`, `RenewLicenseRequest.php`
- [x] Manager and reseller route groups added to `routes/api.php`
- [x] Broadcasting config and channel registration added for real-time license events

## Frontend Pages

- [x] Manager pages: Dashboard, Team, Username Management, Customers, Software, Reports, Activity, Profile
- [x] Reseller pages: Dashboard, Customers, Software, Licenses, Reports, Activity, Profile

## Frontend Features

- [x] Separate manager dashboard and reseller dashboard routing
- [x] Separate sidebar navigation for manager vs reseller
- [x] Manager team-scoped stats, reseller oversight, customer overview, and activity views
- [x] Manager username unlock, username change, and password reset flows with audit reasons
- [x] Reseller multi-step activation flow: customer info, BIOS/program, pricing/duration, review/confirm
- [x] Reseller renew and deactivate actions from the customers flow
- [x] Reseller license filters, expiry warnings, bulk renew, and bulk deactivate actions
- [x] Read-only software catalog for manager and reseller roles
- [x] CSV and PDF export actions for manager and reseller reports
- [x] Shared profile workspace reused for manager and reseller profile pages
- [x] Reseller has no username/password management navigation or route access

## Services And Routing

- [x] `frontend/src/services/license.service.ts`
- [x] `frontend/src/services/manager.service.ts`
- [x] `frontend/src/services/reseller.service.ts`
- [x] `frontend/src/types/manager-reseller.types.ts`
- [x] Manager and reseller route trees added under `/:lang`
- [x] Role redirects updated so manager lands on `/manager/dashboard` and reseller lands on `/reseller/dashboard`
- [x] Shared route constants updated for manager and reseller navigation

## Testing

- [x] 25 Phase 4 Cypress specs added for manager and reseller flows
- [x] Frontend lint passing
- [x] Frontend TypeScript build passing
- [x] Frontend production build passing
- [x] Frontend unit workspace passing: 101 tests
- [x] Backend PHPUnit passing: 17 tests
- [x] Cypress spec TypeScript validation passing
- [ ] Local Cypress runtime execution is blocked on this workstation by a broken Windows Cypress binary verification step (`Cypress.exe: bad option: --smoke-test`)

## Verification Summary

- [x] Manager and reseller dashboards are separated at both router and layout levels
- [x] Reseller activation, renewal, deactivation, and bulk license actions are wired end to end
- [x] Manager permissions remain team-scoped and reseller permissions remain personal-scoped
- [x] License lifecycle events now broadcast in real time with `ShouldBroadcastNow`
- [x] README status has been updated to reflect Phase 4 completion

## Remaining Follow-Up

- [ ] Repair the local Cypress Windows binary/cache so the 25 Phase 4 E2E specs can be executed on this machine
- [ ] Upgrade local Node.js from `22.11.0` to `22.12+` or `20.19+` to remove the Vite engine warning during local builds

## Notes

- [x] All actionable implementation items from `02-TODO-List.md` are complete
- [x] The only incomplete verification item is Cypress execution on this Windows workstation; the specs themselves are implemented and type-checked
