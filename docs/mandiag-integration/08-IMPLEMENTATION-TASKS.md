# Implementation Tasks

Branch: `feature/mandiag-integration`
Last updated: 2026-04-30

Status legend: `[ ]` Not started · `[~]` In progress · `[x]` Done

---

## Phase 1 — Core Integration

### Infrastructure
- [ ] Create `backend/config/mandiag.php`
- [ ] Add `MANDIAG_API_KEY` and `MANDIAG_SIGNING_SECRET` to `.env` and `.env.example`
- [ ] Run `GET /ping` with sandbox credentials to verify connectivity

### Database
- [ ] Create migration: `add_mandiag_fields_to_programs_table` (api_type, mandiag_software_key)
- [ ] Create migration: `add_mandiag_sub_id_to_users_table`
- [ ] Create migration: `add_mandiag_license_id_to_licenses_table`
- [ ] Run migrations: `php artisan migrate`

### Backend — New files
- [ ] Create `backend/app/Services/MandiagApiService.php`
  - [ ] HMAC signing: `hash_hmac('sha256', $ts . '.' . $body, $secret)` — sign and send SAME $body
  - [ ] `Content-Type: application/json` + `Accept: application/json` on every request
  - [ ] `Idempotency-Key: bin2hex(random_bytes(16))` on every POST/PUT/PATCH/DELETE
  - [ ] HTTP timeout: 8s total, 3s connect, SSL verify true
  - [ ] `createReseller()` — no retry needed (buildSubId uses user ID, guaranteed unique)
  - [ ] `setPricing()` — accepts `[['duration' => '1year', 'price' => 70.00], ...]`
  - [ ] `createLicense()`
  - [ ] `renewLicense()`
  - [ ] `disableLicense()`
  - [ ] `enableLicense()`
  - [ ] `setExpiration()`
  - [ ] `durationDaysToKey(int $days): string` — accepts INT, ±3 day tolerance map
  - [ ] `buildSubId(int $userId): string` — returns `"u" . $userId` (globally unique)
  - [ ] `api_logs` logging on every call with `mandiag:` endpoint prefix

### Backend — Model updates
- [ ] `Program.php` — add api_type, mandiag_software_key to fillable, casts, `isMandiag()` method
- [ ] `License.php` — add mandiag_license_id to fillable and casts (`'integer'`)
- [ ] `User.php` — add mandiag_sub_id, mandiag_priced_software_keys to fillable; add `'array'` cast for priced_software_keys

### Backend — LicenseService
- [ ] Inject `MandiagApiService` in constructor alongside existing services
- [ ] `activate()` — add mandiag_software_key null guard at top of Mandiag branch
- [ ] `activate()` — add durationDaysToKey() call with try/catch BEFORE any API call
- [ ] `activate()` — add `ensureMandiagSubReseller()` private method with DB lock (race-safe)
- [ ] `activate()` — `ensureMandiagSubReseller()` uses `lockForUpdate()` on user row inside own DB transaction
- [ ] `activate()` — `ensureMandiagSubReseller()` creates sub-reseller using `buildSubId($reseller->id)`
- [ ] `activate()` — `ensureMandiagSubReseller()` sets pricing from program's active presets, stores key in `mandiag_priced_software_keys`
- [ ] `activate()` — customer field: use `$customer->email ?? $customer->username ?? $biosId`
- [ ] `activate()` — store `mandiag_license_id` from `$apiResponse['data']['license_id']` in License::create()
- [ ] `activate()` — store `activation_key` in `external_activation_response` if present
- [ ] `renew()` — add Mandiag branch: use mandiag_license_id, call renewLicense()
- [ ] `renew()` — if `mandiag_license_id` is null, fall through to legacy/local path
- [ ] `deactivate()` — add Mandiag branch: call disableLicense(), log on failure but don't block
- [ ] `pause()` — add Mandiag branch: call disableLicense(), BLOCK if call fails
- [ ] `resume()` — add Mandiag branch: call enableLicense(), then setExpiration(), log warning if setExpiration fails but don't block
- [ ] `changeBiosId()` — add early block for active Mandiag licenses (line ~998, before existing `apiKey === null` check)

### Backend — ProgramController
- [ ] Add validation for `api_type` (`nullable, in:legacy,mandiag`)
- [ ] Add conditional validation: `mandiag_software_key` required when `api_type=mandiag`
- [ ] Add fields to `store()` Program::create()
- [ ] Add fields to `update()` $program->update()
- [ ] Add fields to `serializeProgram()` response (api_type, mandiag_software_key)

### Frontend — ProgramForm
- [ ] Add `api_type` to form state (default: `'legacy'`)
- [ ] Add `mandiag_software_key` to form state
- [ ] Add API Type dropdown: "Legacy API" / "Mandiag Partner API"
- [ ] When `api_type === 'mandiag'`: show `mandiag_software_key` input, hide legacy API fields
- [ ] When `api_type === 'legacy'`: show legacy fields as before
- [ ] Add both fields to submit payload
- [ ] Add TypeScript types for new fields

### Testing — Phase 1
- [ ] Verify `GET /ping` works with sandbox key and correct HMAC
- [ ] Create Mandiag program in Manager Parent UI — check api_type and software_key saved
- [ ] First activation: check `mandiag_sub_id` set on user, `mandiag_license_id` set on license
- [ ] Check `mandiag_priced_software_keys` updated after first activation
- [ ] Second activation (different reseller, same software): check new sub_id, pricing set independently
- [ ] Second activation (same reseller, same software): check sub_id reused, no duplicate pricing call
- [ ] Renew → check Mandiag expire_date updated
- [ ] Pause → check Mandiag shows disabled
- [ ] Resume → check Mandiag shows active, expire_date correct with remaining time
- [ ] Deactivate → check Mandiag shows disabled, local license shows cancelled
- [ ] Legacy program activation still works exactly as before — zero regression
- [ ] BCR approval for active Mandiag license → clear error, BCR stays pending
- [ ] BCR approval for inactive Mandiag license → succeeds locally (no Mandiag API call)
- [ ] Invalid duration (e.g. 45 days) on Mandiag program → clear error BEFORE any API call
- [ ] Missing mandiag_software_key on program → clear error BEFORE any API call
- [ ] Two concurrent activations for same reseller → only one sub-reseller created at Mandiag

---

## Phase 2 — Webhooks

- [ ] Create migration: `create_mandiag_webhook_events_table`
- [ ] Create `backend/app/Models/MandiagWebhookEvent.php`
- [ ] Create `backend/app/Http/Controllers/MandiagWebhookController.php` — signature verify, timestamp check, event_id null guard, TOCTOU-safe dedup via try/catch UniqueConstraintViolationException, dispatches job
- [ ] Create `backend/app/Jobs/ProcessMandiagWebhookEvent.php` — all event handlers live here
- [ ] Job: `license.expired` handler — mark expired, notify reseller
- [ ] Job: `license.expiring_soon` handler — notify reseller
- [ ] Job: `license.renewed` handler — sync expires_at
- [ ] Job: `license.disabled` handler — sync status if externally disabled
- [ ] Job: `license.enabled` handler — sync status if externally enabled
- [ ] Job: `license.banned` handler — mark cancelled, notify reseller urgently
- [ ] Job: `license.unbanned` handler — log only, no auto-reactivate
- [ ] Job: all other events → default null (no error, just skip)
- [ ] Add route `POST /api/mandiag/webhook` outside Sanctum auth group
- [ ] Add `MANDIAG_WEBHOOK_SECRET` to `.env` and `.env.example`
- [ ] Register webhook with Mandiag via `PUT /webhooks`
- [ ] Test with `POST /webhooks/test`
- [ ] Verify duplicate event returns 200 without re-processing
- [ ] Verify stale timestamp returns 400
- [ ] Verify invalid signature returns 401
- [ ] Verify missing event_id returns 400
- [ ] Run one-time backfill: `GET /licenses?status=expired` → sync any Mandiag-expired licenses that missed Phase 1 coverage

---

## Phase 3 — Tracking Page

- [ ] Create `MandiagTrackingController` (summary, resellers, licenses endpoints)
- [ ] Add 5-minute caching on all Mandiag API calls
- [ ] Add routes inside manager_parent middleware group
- [ ] Create `MandiagTracking.tsx` page component
- [ ] Add summary cards with period filter
- [ ] Add per-reseller data table
- [ ] Add transactions list with pagination
- [ ] Add route to Manager Parent router
- [ ] Add nav link to Manager Parent sidebar
- [ ] Verify page only visible to manager_parent role
- [ ] Verify data matches Mandiag panel

---

## Known limitations (documented, not bugs)

- BIOS changes not supported for Mandiag licenses (Mandiag v1 has no HWID rebind endpoint)
- Webhook replay not available if events missed before Phase 2 deployment (use `GET /licenses` backfill if needed)
- Token codes / bundle codes / AC360 product management not in scope for any phase
