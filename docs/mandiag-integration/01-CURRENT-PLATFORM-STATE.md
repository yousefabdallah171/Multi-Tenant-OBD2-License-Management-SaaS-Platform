# Current Platform State

**Last verified:** 2026-04-30

---

## Architecture summary

- **Backend:** Laravel 12, PHP 8.2/8.3
- **Frontend:** React 19 + Vite 6 + TypeScript
- **Database:** MySQL 8.0
- **Auth:** Laravel Sanctum
- **Real-time:** Pusher
- **Cache/Queue:** Redis

---

## How the current external API works

Every program can have an external API configured. When a reseller activates a license,
the platform calls the external API to register the activation.

### Current API format (legacy)

All calls are simple GET requests. Responses are plain text `"true"` or `"false"`.

```
Activate:    GET {baseUrl}/apiuseradd/{apiKey}/{username}/{biosId}
Deactivate:  GET {baseUrl}/apideluser/{apiKey}/{username}
Active users: GET {baseUrl}/apiusers/{softwareId}
Stats:       GET {baseUrl}/showallapi/{softwareId}
Logs:        GET {baseUrl}/{logsEndpoint}/{softwareId}
```

Success detection: `HTTP 200 AND body contains "true"` (case-insensitive).

### Per-program credentials (current)

Stored in `programs` table:
- `external_api_key_encrypted` — AES encrypted via Laravel `encrypt()`
- `external_software_id` — integer software ID
- `external_api_base_url` — base host URL
- `external_logs_endpoint` — custom logs path (default: `apilogs`)
- `has_external_api` — boolean flag

---

## Key files

### Services

| File | Purpose |
|---|---|
| `backend/app/Services/ExternalApiService.php` | HTTP client for legacy external API. All methods accept `$apiKey` and `$baseUrl` per-call. Logs all calls to `api_logs` table. |
| `backend/app/Services/LicenseService.php` | Business logic orchestrator. Runs the full activation pipeline: blacklist → conflict → username lock → IP geo → external API → finalize. |
| `backend/app/Services/BalanceService.php` | Records revenue for resellers. |

### Models

| File | Key fields |
|---|---|
| `backend/app/Models/Program.php` | `external_api_key_encrypted`, `external_software_id`, `external_api_base_url`, `has_external_api`. Methods: `getDecryptedApiKey()`, `setExternalApiKeyAttribute()`. Relationships: `durationPresets()` (all presets), `activeDurationPresets()` (where `is_active=true`, ordered by `sort_order`) |
| `backend/app/Models/License.php` | `bios_id`, `external_username`, `external_activation_response`, `external_deletion_response`, `mandiag_license_id` (added Phase 1), `status`, `is_scheduled`, `paused_at`, `pause_remaining_minutes` |
| `backend/app/Models/User.php` | `mandiag_sub_id` (added Phase 1), `role`, `tenant_id` |

### Controllers

| File | Purpose |
|---|---|
| `backend/app/Http/Controllers/ManagerParent/ProgramController.php` | CRUD for programs. Validates and stores external API fields. `store()` and `update()` methods need new Mandiag fields. |
| `backend/app/Http/Controllers/LicenseController.php` | Delegates all license operations to `LicenseService`. |

### Frontend

| File | Purpose |
|---|---|
| `frontend/src/pages/manager-parent/SoftwareManagement.tsx` | Program list page. No changes needed. |
| `frontend/src/pages/manager-parent/ProgramForm.tsx` | Program create/edit form. Needs `api_type` dropdown and `mandiag_software_key` field. |

---

## LicenseService activation pipeline (current)

```
activate($data)
  1. Resolve actor, reseller, program
  2. Get API key from program
  3. Validate BIOS ID format
  4. assertBiosAvailable() — blacklist + conflict + BiosUsernameLink checks
  5. If not scheduled: externalApiService->activateUser(apiKey, username, biosId, baseUrl)
  6. DB transaction:
     a. Race-condition re-check with lockForUpdate()
     b. upsertCustomer()
     c. resolveActivationPreset()
     d. License::create()
     e. balanceService->recordRevenue()
     f. logActivity()
     g. BiosUsernameLink::updateOrCreate()
     h. customer->update(['username_locked' => true])
     i. dispatchDomainEvent(LicenseActivated)
```

For Mandiag, step 5 is replaced with `MandiagApiService` calls.
Steps 1-4 and 6 are identical — the BIOS security pipeline is unchanged.

---

## LicenseService external API calls (all 5 operations)

| Operation | Current call | Mandiag replacement |
|---|---|---|
| activate | `externalApiService->activateUser(key, username, biosId, url)` | `mandiagApiService->createLicense(subId, softwareKey, duration, hwid, customer, customerName)` |
| renew | `externalApiService->activateUser(key, username, biosId, url)` | `mandiagApiService->renewLicense(mandiagLicenseId, duration)` |
| deactivate | `externalApiService->deactivateUser(key, username, url)` | `mandiagApiService->disableLicense(mandiagLicenseId)` |
| pause | `externalApiService->deactivateUser(key, username, url)` | `mandiagApiService->disableLicense(mandiagLicenseId, reason)` |
| resume | `externalApiService->activateUser(key, username, biosId, url)` | `mandiagApiService->enableLicense(mandiagLicenseId)` + `mandiagApiService->setExpiration(mandiagLicenseId, newExpireDate)` |

---

## Routes (relevant)

```
POST   /api/licenses/activate              → LicenseController@activateLicense
POST   /api/licenses/{license}/renew       → LicenseController@renew
POST   /api/licenses/{license}/pause       → LicenseController@pause
POST   /api/licenses/{license}/resume      → LicenseController@resume
DELETE /api/licenses/{license}             → LicenseController@destroy
GET    /api/programs                       → ManagerParentProgramController@index
POST   /api/programs                       → ManagerParentProgramController@store
PUT    /api/programs/{program}             → ManagerParentProgramController@update
```

---

## program_duration_presets table

Used by `ensureMandiagSubReseller()` to build Mandiag pricing rows.
Relationship on Program: `activeDurationPresets()` — `HasMany(ProgramDurationPreset)` where `is_active = true`, ordered by `sort_order`.

```
id, program_id, label, duration_days (decimal 10,4), price (decimal 10,2),
sort_order (unsigned int), is_active (bool), created_at, updated_at
```

Usage in integration:
```php
$program->activeDurationPresets()->get()
    // returns Collection of ProgramDurationPreset with duration_days and price
```

---

## Current DB schema (relevant tables)

### programs
```
id, tenant_id, name, description, version, download_link, file_size,
system_requirements, installation_guide_url, trial_days, base_price, icon,
external_api_key_encrypted, external_software_id, external_api_base_url,
external_logs_endpoint, has_external_api, status, created_at, updated_at
```
**Adding:** `api_type`, `mandiag_software_key`

### licenses
```
id, tenant_id, customer_id, reseller_id, created_by_reseller_id, program_id,
bios_id, external_username, external_activation_response, external_deletion_response,
duration_days, price, activated_at, expires_at, scheduled_at, scheduled_timezone,
scheduled_last_attempt_at, scheduled_failed_at, scheduled_failure_message,
is_scheduled, activated_at_scheduled, paused_at, pause_remaining_minutes,
pause_reason, paused_by_role, status, created_at, updated_at
```
**Adding:** `mandiag_license_id`

### users
```
id, tenant_id, name, client_name, username, email, phone, country_name,
timezone, password, role, status, created_by, username_locked,
last_seen_at, branding, created_at, updated_at
```
**Adding:** `mandiag_sub_id`
