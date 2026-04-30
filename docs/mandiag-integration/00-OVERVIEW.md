# Mandiag Partner API Integration — Overview

**Branch:** `feature/mandiag-integration`
**Created:** 2026-04-30
**Status:** Planning complete — ready for implementation

---

## What this is

Adding AutoCore360 / Mandiag software as a new program type in the OBD2SW platform.
Resellers and managers activate, renew, pause, resume, and deactivate Mandiag licenses
through the exact same UI they use today. All Mandiag API complexity is invisible to them.

---

## Folder contents

| File | Purpose |
|---|---|
| `00-OVERVIEW.md` | This file — start here |
| `01-CURRENT-PLATFORM-STATE.md` | Current codebase structure, files, and how the existing API works |
| `02-MANDIAG-API-CONTRACT.md` | Full Mandiag API reference, auth, endpoints, errors |
| `03-DATA-MODEL.md` | All DB changes — columns added, new tables, .env keys |
| `04-SCENARIOS-AND-EDGE-CASES.md` | Every activation/renew/pause/resume/deactivate scenario |
| `05-PHASE-1-PLAN.md` | Phase 1 tasks with files to create/edit |
| `06-PHASE-2-PLAN.md` | Phase 2 — Webhooks |
| `07-PHASE-3-PLAN.md` | Phase 3 — Mandiag tracking page for Manager Parent |
| `08-IMPLEMENTATION-TASKS.md` | Ordered task list with status tracking |

---

## Key decisions

| Decision | Choice | Reason |
|---|---|---|
| Credentials storage | `.env` only | Single Mandiag account — no per-program secrets needed |
| Sub-reseller sync | Lazy on first activation | Zero setup, automatic, transparent to resellers |
| Webhooks | Phase 2 | Ship working integration first, add real-time sync after |
| Tracking page | Phase 3 | Not needed for activation to work |
| BIOS changes | Blocked in Phase 1 | Mandiag v1 has no HWID rebind endpoint |
| Architecture | Adapter pattern | `if ($program->isMandiag())` branch in LicenseService — legacy path untouched |

---

## Zero impact guarantee

- All existing programs keep `api_type = 'legacy'` by default
- Every legacy code path is unchanged — no modifications, only additions
- The new Mandiag branch is only entered when `$program->isMandiag() === true`
- Existing tests continue to pass

---

## Contacts

- Credentials: stored in `.env` only — see `START-HERE.txt` (kept offline, never committed)
- Partner identifier: `engmozaid`
- Sub-reseller suffix: `-obd2sw` (Mandiag adds this automatically)
- Base URL: `https://mandiag.com/api/partner/v1`
