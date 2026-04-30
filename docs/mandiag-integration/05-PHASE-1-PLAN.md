# Phase 1 — Core Integration

**Goal:** Resellers and managers can activate, renew, pause, resume, and deactivate
Mandiag licenses through the existing UI with zero UX change.

**Estimated effort:** 1 developer day (backend) + 2–3 hours (frontend form)

---

## Files to CREATE (new files only)

### 1. MandiagApiService
**Path:** `backend/app/Services/MandiagApiService.php`

Responsibilities:
- HMAC-SHA256 request signing on every request
- `Content-Type: application/json` + `Accept: application/json` on every request
- Fresh `Idempotency-Key: bin2hex(random_bytes(16))` on every POST/PUT/PATCH/DELETE
- HTTP timeout: 8s total, 3s connect (matches fast-fail approach in ExternalApiService)
- SSL verify: true always
- Parse JSON responses into standard `['success', 'data', 'status_code', 'error_code?', 'error_message?']` array
- Log all calls to `api_logs` table (endpoint prefixed with `mandiag:`)

Methods to implement:
```php
createReseller(string $subId, string $realname, ?string $email): array
setPricing(string $subId, string $softwareKey, array $pricingRows): array
  // $pricingRows = [['duration' => '1year', 'price' => 70.00], ...]
createLicense(string $subId, string $softwareKey, string $duration, string $hwid, string $customer, string $customerName): array
renewLicense(int $mandiagLicenseId, string $duration): array
disableLicense(int $mandiagLicenseId, ?string $reason = null): array
enableLicense(int $mandiagLicenseId): array
setExpiration(int $mandiagLicenseId, string $expireDate): array

// Static helpers
static durationDaysToKey(int $durationDays): string
  // Accepts int only — no float precision bugs
  // Map with ±3 day tolerance: 1→1day, 7→1week, 30→1month, 90→3months, 180→6months, 365→1year, 730→2years
  // Throws \InvalidArgumentException if no match — caught in LicenseService before any API call

static buildSubId(int $userId): string
  // Returns "u" . $userId  (e.g. "u123", "u4507")
  // Uses platform user's id — guaranteed globally unique across all tenants
  // No collision possible — avoids username-based approach which is only unique per tenant
```

### HMAC signing algorithm (implemented inside private sendJson())
```php
$body      = in_array($method, ['GET']) ? '' : json_encode($payload, JSON_UNESCAPED_SLASHES);
$timestamp = (string) time();
$signature = hash_hmac('sha256', $timestamp . '.' . $body, config('mandiag.signing_secret'));
// Sign and send the SAME $body string — never re-serialize
```

Reads from config:
```php
config('mandiag.api_key')        // from MANDIAG_API_KEY
config('mandiag.signing_secret') // from MANDIAG_SIGNING_SECRET
config('mandiag.base_url')       // default: https://mandiag.com/api/partner/v1
```

### Retry strategy for 429 / 500 / 503

MandiagApiService does NOT implement internal retries on synchronous activation calls.
Reason: a slow retry inside a real-time HTTP request cycle blocks the user for seconds.

Instead, these errors surface as a clear message and the user is offered scheduled activation:

| Error | HTTP status | Message shown |
|---|---|---|
| 429 rate_limited | 429 | "Too many requests to the external service. Wait a moment and try again, or schedule for later." |
| 500/503 server_error | 500/503 | "The external service is unavailable. Try again or schedule the activation for later." |
| 403 feature_disabled | 403 | "The external service integration is currently disabled. Contact your manager." |
| Connection timeout | — | "The external service is not responding. Try again or schedule for later." |

This is consistent with how `ExternalApiService` already handles timeouts in the platform.
All errors above result in a `ValidationException` — no license created, no BIOS locked.

### 2. Mandiag config file
**Path:** `backend/config/mandiag.php`

```php
return [
    'api_key'        => env('MANDIAG_API_KEY'),
    'signing_secret' => env('MANDIAG_SIGNING_SECRET'),
    'base_url'       => env('MANDIAG_BASE_URL', 'https://mandiag.com/api/partner/v1'),
    'webhook_secret' => env('MANDIAG_WEBHOOK_SECRET'),
];
```

### 3. DB Migrations (3 files)
- `2026_04_30_100000_add_mandiag_fields_to_programs_table.php`
- `2026_04_30_100001_add_mandiag_sub_id_to_users_table.php` — adds BOTH `mandiag_sub_id` AND `mandiag_priced_software_keys`
- `2026_04_30_100002_add_mandiag_license_id_to_licenses_table.php`

See `03-DATA-MODEL.md` for exact column definitions.

---

## Files to EDIT (modifications to existing files)

### 4. Program model
**Path:** `backend/app/Models/Program.php`

Changes:
- Add `'api_type'` and `'mandiag_software_key'` to `$fillable`
- Add casts for both fields
- Add `isMandiag(): bool` method

### 5. License model
**Path:** `backend/app/Models/License.php`

Changes:
- Add `'mandiag_license_id'` to `$fillable`
- Add cast: `'mandiag_license_id' => 'integer'`

### 6. User model
**Path:** `backend/app/Models/User.php`

Changes:
- Add `'mandiag_sub_id'` to `$fillable`
- Add `'mandiag_priced_software_keys'` to `$fillable`
- Add cast: `'mandiag_priced_software_keys' => 'array'`

### 7. LicenseService — activate()
**Path:** `backend/app/Services/LicenseService.php`

Inject `MandiagApiService` in constructor alongside existing `ExternalApiService`.

In `activate()`, replace the single `externalApiService->activateUser()` call with:

```php
if ($program->isMandiag()) {
    // 1. Guard: software key must be configured
    throw_unless(
        $program->mandiag_software_key,
        ValidationException::withMessages(['program_id' => 'Mandiag software key not configured. Contact your manager.'])
    );

    // 2. Validate duration is mappable BEFORE any API call
    try {
        $duration = MandiagApiService::durationDaysToKey((int) round($durationDays));
    } catch (\InvalidArgumentException $e) {
        throw ValidationException::withMessages(['bios_id' => $e->getMessage()]);
    }

    // 3. Lazy sub-reseller sync (inside transaction later, but sub-reseller creation is outside DB tx)
    $this->ensureMandiagSubReseller($reseller, $program);

    // 4. Determine customer identifier: use email if available, else username, else bios_id
    $customerIdentifier = $customer->email ?? $customer->username ?? $biosId;

    // 5. Create license at Mandiag
    $apiResponse = $this->mandiagApiService->createLicense(
        $reseller->fresh()->mandiag_sub_id,  // re-read after ensureMandiagSubReseller saved it
        $program->mandiag_software_key,
        $duration,
        $biosId,                              // hwid = our bios_id
        $customerIdentifier,
        $customerName,
    );
} else {
    $apiResponse = $this->externalApiService->activateUser($apiKey, $externalUsername, $biosId, $program->external_api_base_url);
}
```

**CRITICAL: If `$apiResponse['success']` is false, the existing `if (! $apiResponse['success'])` check
at line ~93 throws `ValidationException` BEFORE `DB::transaction()` is entered.
No license record is created. The BIOS is not locked. This is already correct in the current flow.**

Store `mandiag_license_id` in `License::create()` array inside the transaction:
```php
'mandiag_license_id' => $program->isMandiag()
    ? ($apiResponse['data']['license_id'] ?? null)
    : null,
```

Also store `activation_key` if present (Mandiag returns this for some software):
```php
'external_activation_response' => $program->isMandiag()
    ? ($apiResponse['data']['activation_key'] ?? json_encode($apiResponse['data']))
    : (string) ($apiResponse['data']['response'] ?? ''),
```

### ensureMandiagSubReseller() private method

```php
private function ensureMandiagSubReseller(User $reseller, Program $program): void
{
    // RACE CONDITION FIX: lock the user row before reading/writing mandiag_sub_id
    // This must happen OUTSIDE the license DB transaction (which starts later)
    // Use a short DB lock on the user row
    DB::transaction(function () use ($reseller, $program): void {
        $locked = User::where('id', $reseller->id)->lockForUpdate()->first();

        // Step 1: Create sub-reseller in Mandiag if not yet done
        if (! $locked->mandiag_sub_id) {
            $subId = MandiagApiService::buildSubId($reseller->id); // "u123"
            $response = $this->mandiagApiService->createReseller(
                $subId,
                $reseller->name,
                $reseller->email,
            );

            // Handle collision (409): append suffix
            if (! $response['success'] && ($response['error_code'] ?? '') === 'sub_id_collision') {
                $subId = $subId . 'x';
                $response = $this->mandiagApiService->createReseller($subId, $reseller->name, $reseller->email);
            }

            if (! $response['success']) {
                throw ValidationException::withMessages([
                    'bios_id' => 'Could not register your account with the external service. Contact your manager.',
                ]);
            }

            $locked->forceFill(['mandiag_sub_id' => $response['sub_id']])->save();
            $reseller->mandiag_sub_id = $response['sub_id'];
        }

        // Step 2: Set pricing for this software key if not already done
        $pricedKeys = $locked->mandiag_priced_software_keys ?? [];
        $softwareKey = $program->mandiag_software_key;

        if (! in_array($softwareKey, $pricedKeys, true)) {
            // Build pricing rows from all active presets of this program
            $pricingRows = $program->activeDurationPresets
                ->map(function ($preset) {
                    try {
                        $duration = MandiagApiService::durationDaysToKey((int) round($preset->duration_days));
                        return ['duration' => $duration, 'price' => (float) $preset->price];
                    } catch (\InvalidArgumentException) {
                        return null; // skip unmappable presets
                    }
                })
                ->filter()
                ->unique('duration')
                ->values()
                ->all();

            if (! empty($pricingRows)) {
                $this->mandiagApiService->setPricing($locked->mandiag_sub_id, $softwareKey, $pricingRows);
                // Don't throw on pricing failure — Mandiag may already have partner-level pricing.
                // If it fails, the activation call will return price_lookup_failed and surface a clear error.
            }

            $locked->forceFill([
                'mandiag_priced_software_keys' => array_unique(array_merge($pricedKeys, [$softwareKey])),
            ])->save();
        }
    });
}

### 8. LicenseService — renew()
Replace `externalApiService->activateUser()` call:

```php
if ($program->isMandiag() && $license->mandiag_license_id) {
    $duration = MandiagApiService::durationDaysToKey($durationDays);
    $apiResponse = $this->mandiagApiService->renewLicense(
        $license->mandiag_license_id,
        $duration,
    );
} elseif ($apiKey !== null) {
    $apiResponse = $this->externalApiService->activateUser(...);
}
```

### 9. LicenseService — deactivate()
Replace `externalApiService->deactivateUser()` call:

```php
if ($program->isMandiag() && $license->mandiag_license_id) {
    $apiResponse = $this->mandiagApiService->disableLicense($license->mandiag_license_id);
    // Don't block deactivation on Mandiag failure — log and proceed
} elseif ($apiKey !== null) {
    $apiResponse = $this->externalApiService->deactivateUser(...);
}
```

### 10. LicenseService — pause()
Replace `externalApiService->deactivateUser()` call:

```php
if ($program->isMandiag() && $license->mandiag_license_id) {
    $apiResponse = $this->mandiagApiService->disableLicense(
        $license->mandiag_license_id,
        $data['pause_reason'] ?? null,
    );
    // DO block on failure — don't pause if Mandiag can't be updated
    if (!$apiResponse['success']) { throw ValidationException... }
} elseif ($apiKey !== null) {
    $apiResponse = $this->externalApiService->deactivateUser(...);
}
```

### 11. LicenseService — resume()
Replace `externalApiService->activateUser()` call:

```php
if ($program->isMandiag() && $license->mandiag_license_id) {
    // Step 1: enable
    $apiResponse = $this->mandiagApiService->enableLicense($license->mandiag_license_id);
    if (!$apiResponse['success']) { throw ValidationException... }

    // Step 2: fix expiry (Mandiag restores to original expire_date, not remaining time)
    $newExpiry = now()->addMinutes($license->pause_remaining_minutes ?? 0);
    $this->mandiagApiService->setExpiration(
        $license->mandiag_license_id,
        $newExpiry->format('Y-m-d H:i:s'),
    );
    // Step 2 failure: log warning, don't block resume
} elseif ($apiKey !== null) {
    $apiResponse = $this->externalApiService->activateUser(...);
}
```

### 12. BiosChangeRequest — block for active Mandiag licenses
**Path:** `backend/app/Services/LicenseService.php` — `changeBiosId()` method, around line 937

BCR approval flows through `ManagerParent/BiosChangeRequestController::approve()` → calls
`$this->licenseService->changeBiosId($biosChangeRequest->license, $biosChangeRequest->new_bios_id)`.

The block goes inside `LicenseService::changeBiosId()`, AFTER the existing conflict checks
and BEFORE the `if ($apiKey === null || $license->status !== 'active')` branch at line ~998:

```php
// Block BIOS change for ACTIVE Mandiag licenses (Mandiag v1 has no HWID rebind endpoint)
if ($license->mandiag_license_id !== null && $license->status === 'active') {
    throw ValidationException::withMessages([
        'new_bios_id' => 'BIOS ID changes are not supported for active Mandiag licenses. Contact Mandiag support.',
    ]);
}
// For inactive/paused Mandiag licenses: fall through to local-only update (existing logic handles it)
```

This means:
- Active Mandiag license → blocked with clear message
- Inactive/paused/cancelled Mandiag license → allowed locally (no Mandiag API call, same as legacy inactive)
- Also blocks `directChange()` in the controller since it also calls `licenseService->changeBiosId()`

### 13. ProgramController — store() and update()
**Path:** `backend/app/Http/Controllers/ManagerParent/ProgramController.php`

Add validation rules:
```php
'api_type'             => ['nullable', 'in:legacy,mandiag'],
'mandiag_software_key' => ['nullable', 'string', 'max:128'],
```

Add validation rule (conditional):
```php
'mandiag_software_key' => [
    Rule::requiredIf(fn() => $request->input('api_type') === 'mandiag'),
    'nullable', 'string', 'max:128',
],
```

Add to `Program::create()` and `$program->update()`:
```php
'api_type'             => $validated['api_type'] ?? 'legacy',
'mandiag_software_key' => $validated['mandiag_software_key'] ?? null,
```

Add to `serializeProgram()` response:
```php
'api_type'             => $program->api_type ?? 'legacy',
'mandiag_software_key' => $program->mandiag_software_key,
```

### 14. ProgramForm.tsx (frontend)
**Path:** `frontend/src/pages/manager-parent/ProgramForm.tsx`

Changes:
- Add `api_type` field to form state (default: `'legacy'`)
- Add `mandiag_software_key` field to form state
- Add `api_type` dropdown after existing fields: `Legacy API` / `Mandiag Partner API`
- When `api_type === 'mandiag'`:
  - Show `mandiag_software_key` text input (label: "Mandiag Software Key", placeholder: "topix")
  - Hide legacy API fields (External Software ID, External API Base URL, External Logs Endpoint, External API Key)
- When `api_type === 'legacy'`: show legacy fields as before
- Add both fields to form submit payload

---

## .env changes

Add to `.env` and `.env.example`:
```env
MANDIAG_API_KEY=
MANDIAG_SIGNING_SECRET=
```

---

## Validation checklist before marking Phase 1 complete

- [ ] `GET /ping` returns `pong: true` with sandbox credentials
- [ ] Create a Mandiag program in Manager Parent — form saves correctly
- [ ] Reseller activates Mandiag license → `mandiag_sub_id` appears on user, `mandiag_license_id` appears on license
- [ ] Renew Mandiag license → Mandiag expire_date updated
- [ ] Pause Mandiag license → Mandiag shows disabled
- [ ] Resume Mandiag license → Mandiag shows active, expire_date restored with remaining time
- [ ] Deactivate Mandiag license → Mandiag shows disabled, our license shows cancelled
- [ ] Legacy program activation still works exactly as before
- [ ] BCR approval for Mandiag license returns clear error
- [ ] Invalid duration_days on Mandiag program returns clear error before any API call
