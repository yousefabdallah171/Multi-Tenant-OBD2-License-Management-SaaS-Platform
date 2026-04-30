# Mandiag Partner API Integration — Design Spec

**Date:** 2026-04-30
**Branch:** `feature/mandiag-integration`
**Status:** Approved — ready for implementation

---

## Problem

The OBD2SW platform currently supports one external API for license management
(simple GET-based, plain text responses). The client wants to add AutoCore360 /
Mandiag as a second software product. Mandiag uses a completely different API:
HMAC-SHA256 auth, JSON responses, sub-reseller management, and numeric license IDs.

---

## Solution

Adapter pattern alongside the existing API. Add a `MandiagApiService` that handles
all Mandiag-specific HTTP calls. `LicenseService` checks `$program->isMandiag()` and
routes to the correct service. Legacy programs are completely untouched.

---

## Architecture

```
LicenseService.activate()
  ├─ if $program->isMandiag()
  │    ├─ MandiagApiService.ensureSubReseller()  (lazy sync)
  │    ├─ MandiagApiService.createLicense()
  │    └─ store mandiag_license_id on license
  └─ else
       └─ ExternalApiService.activateUser()      (unchanged)
```

Same pattern for renew, deactivate, pause, resume.

---

## Key decisions

| Decision | Choice |
|---|---|
| Credentials | `.env` only — single Mandiag account, no per-program secrets in DB |
| Sub-reseller sync | Lazy on first activation — transparent to users |
| Webhooks | Phase 2 — ship working activation first |
| Tracking page | Phase 3 — not needed for activation to work |
| BIOS changes | Blocked with error — Mandiag v1 has no HWID rebind |
| Pause/Resume sync | After enable, call PATCH /expiration to restore remaining time |

---

## Data model changes

| Table | Change |
|---|---|
| `programs` | +`api_type` varchar(32) default 'legacy', +`mandiag_software_key` varchar(128) nullable |
| `users` | +`mandiag_sub_id` varchar(64) nullable indexed |
| `licenses` | +`mandiag_license_id` bigint unsigned nullable indexed |
| `mandiag_webhook_events` | New table — Phase 2 only |

---

## Files changed

### New files
- `backend/app/Services/MandiagApiService.php`
- `backend/config/mandiag.php`
- `backend/database/migrations/2026_04_30_100000_*` (3 migrations)
- `backend/app/Http/Controllers/MandiagWebhookController.php` (Phase 2)
- `backend/app/Models/MandiagWebhookEvent.php` (Phase 2)
- `backend/app/Http/Controllers/ManagerParent/MandiagTrackingController.php` (Phase 3)
- `frontend/src/pages/manager-parent/MandiagTracking.tsx` (Phase 3)

### Edited files
- `backend/app/Models/Program.php`
- `backend/app/Models/License.php`
- `backend/app/Models/User.php`
- `backend/app/Services/LicenseService.php`
- `backend/app/Http/Controllers/ManagerParent/ProgramController.php`
- `backend/routes/api.php`
- `frontend/src/pages/manager-parent/ProgramForm.tsx`

---

## Full planning documents

See `docs/mandiag-integration/` folder:
- `00-OVERVIEW.md` — summary and key decisions
- `01-CURRENT-PLATFORM-STATE.md` — current codebase state
- `02-MANDIAG-API-CONTRACT.md` — full API reference
- `03-DATA-MODEL.md` — all DB changes
- `04-SCENARIOS-AND-EDGE-CASES.md` — all scenarios
- `05-PHASE-1-PLAN.md` — Phase 1 detailed tasks
- `06-PHASE-2-PLAN.md` — Phase 2 webhooks
- `07-PHASE-3-PLAN.md` — Phase 3 tracking page
- `08-IMPLEMENTATION-TASKS.md` — ordered task checklist
