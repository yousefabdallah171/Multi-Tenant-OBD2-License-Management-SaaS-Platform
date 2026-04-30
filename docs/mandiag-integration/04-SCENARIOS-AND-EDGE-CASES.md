# All Scenarios & Edge Cases

---

## Activation

### Happy path
1. Reseller fills activation form (BIOS ID, customer name, program, duration)
2. Platform runs BIOS security checks (blacklist, conflict, BiosUsernameLink) — identical to legacy
3. Platform checks if reseller has `mandiag_sub_id`:
   - If null → create sub-reseller in Mandiag → set pricing → store `mandiag_sub_id`
4. Map `duration_days` → Mandiag duration string
5. Call `POST /licenses` with sub_id, software_key, duration, hwid=biosId, customer, customer_name
6. Store returned `mandiag_license_id` on license row
7. License created, revenue recorded — same as legacy

### Sub-reseller creation fails — `sub_id_collision` (409)
- Should never happen: `sub_id = "u" + users.id` is a globally unique integer PK
- Defensive retry: append `x` once (`u123` → `u123x`) in case of unexpected state
- If both fail: surface error — *"Could not register your account with the external service. Contact your manager."*
- No license created, no BIOS locked

### Sub-reseller creation fails — `sub_id_invalid` (422)
- Username has characters that can't be sanitized to valid sub_id
- Surface: *"Account configuration error. Contact your manager."*
- Log full error for Manager Parent to debug

### `price_lookup_failed` (422) on license creation
- Means pricing was not set for this reseller+software
- Should not happen if lazy sync sets pricing correctly
- Surface: *"Mandiag pricing not configured for this software. Contact your manager."*

### `duration_days` cannot map to Mandiag duration
- Checked before any API call
- Surface: *"This preset duration is not compatible with this software. Use 1, 7, 30, 90, 180, 365, or 730 days."*
- No API call made

### Mandiag API timeout during activation
- Same handling as legacy: surface as validation error
- Suggest scheduled activation: *"The service is not responding. Try scheduling for later."*

### Mandiag API down (503)
- Surface as validation error, activation fails cleanly
- BIOS not locked, no license created

### Scheduled activation
- No Mandiag call at schedule time
- When `executeScheduledActivation()` fires, it calls `activate()` internally
- The Mandiag call happens at execution time — same as above

---

## Renewal

### Happy path
1. Call `POST /licenses/{mandiag_license_id}/renew` with duration string
2. Update `expires_at` locally from Mandiag's returned `expire_date`

### `mandiag_license_id` is null
- License was created before this feature, or is a legacy program
- Skip Mandiag call entirely — renew locally or use legacy API
- No error

### `license_disabled` (409)
- Surface: *"This license is currently disabled. Re-enable it before renewing."*

### `license_banned` (409)
- Surface: *"This license has been banned. Contact Mandiag support."*

### Scheduled renewal
- Mandiag call happens at execution time, same as activation

---

## Deactivation

### Happy path
1. Call `POST /licenses/{mandiag_license_id}/disable`
2. Mark license `cancelled` locally

### `mandiag_license_id` is null
- Skip Mandiag call, mark cancelled locally

### Mandiag returns error on disable
- Log the error with `request_id`
- Still mark cancelled locally — deactivation is not blocked by external failure
- Manager Parent can see the discrepancy in api_logs

---

## Pause

### Happy path
1. Call `POST /licenses/{mandiag_license_id}/disable` with optional reason
2. If Mandiag call fails → throw error, do NOT proceed
3. Calculate `pause_remaining_minutes` = time until expiry
4. Store `paused_at`, `pause_remaining_minutes`, `pause_reason`
5. Set status = `pending`

### Mandiag disable fails on pause
- Block pause entirely — no partial state stored
- Surface error to user

### `mandiag_license_id` is null
- Skip Mandiag call — pause locally only

---

## Resume

### Happy path
1. Call `POST /licenses/{mandiag_license_id}/enable`
2. Calculate new `expires_at` = `now() + pause_remaining_minutes`
3. Call `PATCH /licenses/{mandiag_license_id}/expiration` with new expire date
4. Clear pause fields, set status = `active`

### Mandiag enable fails on resume
- Block resume entirely
- Surface error to user

### Mandiag enable succeeds but expiration patch fails
- Log warning — license is active in both systems but Mandiag's expiry may be wrong
- Resume proceeds (don't block the user)
- Manager Parent can see warning in api_logs

### `mandiag_license_id` is null
- Skip both Mandiag calls — resume locally only

---

## BIOS Change Request

### BCR approved for Mandiag license
- Detect: `$license->mandiag_license_id !== null`
- Return clear error: *"BIOS ID changes are not supported for this software type in the current version."*
- BCR stays in pending state — no silent failure
- Mandiag v1 has no HWID rebind endpoint (documented limitation)

### BCR approved for legacy license on Mandiag program (mandiag_license_id is null)
- Treat as legacy — no Mandiag call needed

---

## Sub-reseller lazy sync

### First activation for a reseller on any Mandiag program
1. Check `$reseller->mandiag_sub_id` — null
2. Build `sub_id = "u" + $reseller->id` (e.g. `u123`, `u4507`)
   - Uses platform user's auto-increment PK — guaranteed globally unique across all tenants
   - Username-based derivation was rejected: `(tenant_id, username)` is unique per-tenant only, two tenants can have identical usernames, causing Mandiag collisions
3. `POST /resellers` with sub_id (`u123`), realname, contact_email
4. On `sub_id_collision` (409): append `x` and retry once (defensive only — should never happen with u+id)
5. `PUT /resellers/{sub_id}/pricing` — iterate `$program->activeDurationPresets()->get()`, map each `duration_days` → Mandiag duration string, set `price` from preset. Skip presets whose `duration_days` cannot be mapped (unmappable durations don't block activation)
6. Store `mandiag_sub_id` on the user record, store `mandiag_software_key` in `mandiag_priced_software_keys` array

### Same reseller activates a second Mandiag program (different software_key)
- `mandiag_sub_id` already set — skip reseller creation
- Still call `PUT /resellers/{sub_id}/pricing` for the new software_key + durations
- Pricing call is idempotent — safe to call again

### Pricing already set (PUT /resellers/{sub_id}/pricing idempotency)
- Mandiag accepts the call and overwrites — no error
- Safe to call on every first-activation-per-software

---

## Program configuration

### `mandiag_software_key` left empty when api_type = mandiag
- Validation error on program save: *"Software key is required for Mandiag programs."*
- Program not saved

### Manager Parent changes `api_type` from legacy to mandiag on existing program
- Existing licenses: `mandiag_license_id` is null → legacy code path used for those licenses
- New activations: Mandiag path used
- No data migration needed

### Manager Parent changes `mandiag_software_key` after some licenses exist
- Existing licenses use stored `mandiag_license_id` — unaffected by software_key change
- New activations use the new software_key
- No issue

### Program deleted while Mandiag licenses are active
- Standard cascade: licenses remain but program_id FK may cascade depending on configuration
- Mandiag side: licenses remain active there — Mandiag is source of truth
- Out of scope for this integration

---

## Tenant / multi-tenant

### Multiple tenants both use the same Mandiag integration
- Mandiag is a single partner account (`engmozaid`)
- All sub-resellers from all tenants share the same Mandiag partner
- `mandiag_sub_id` is `"u" + users.id` — globally unique by definition (auto-increment PK)
- No collision risk across tenants — user IDs are never repeated regardless of tenant

---

## Sandbox vs Live

### Developer testing on sandbox
- Use `mp_test_…` keys in `.env`
- Prefix test sub-resellers with `dev_` for easy cleanup
- All `manager_price` values are $0 on sandbox
- Switch to live by changing `.env` keys — no code changes
