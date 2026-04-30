# Phase 2 — Webhooks

**Goal:** Platform receives real-time events from Mandiag and keeps license
statuses in sync automatically without polling.

**Prerequisite:** Phase 1 complete and deployed to a public HTTPS URL.

**Estimated effort:** 4–6 hours

---

## What Mandiag sends us

| Event | Trigger | Our action |
|---|---|---|
| `license.expired` | Hourly cron when `expire_date` crossed | Mark license `expired` in our DB |
| `license.expiring_soon` | Daily, 7 days before expiry | Fire notification to reseller |
| `license.disabled` | On any disable (ours OR Mandiag admin) | Sync status if our license is still `active` |
| `license.enabled` | On any enable (ours OR Mandiag admin) | Sync status if our license is not `active` |
| `license.banned` | Mandiag admin bans license for fraud/security | Mark license `cancelled`, notify reseller |
| `license.unbanned` | Mandiag admin unbans license | Log only — do not auto-reactivate |
| `license.created` | After our `/licenses` call | Confirm `mandiag_license_id` stored — no-op if already correct |
| `license.renewed` | After our `/renew` call | Sync `expires_at` from Mandiag's returned value |
| `code.redeemed` | Customer redeems code in AC360 app | Log only (codes out of scope) — explicitly a no-op |

---

## Files to CREATE

### 1. Migration
**Path:** `backend/database/migrations/2026_04_30_100003_create_mandiag_webhook_events_table.php`

See `03-DATA-MODEL.md` for schema.

### 2. MandiagWebhookController
**Path:** `backend/app/Http/Controllers/MandiagWebhookController.php`

### 3. ProcessMandiagWebhookEvent job
**Path:** `backend/app/Jobs/ProcessMandiagWebhookEvent.php`

Standard Laravel queued job. Constructor accepts `string $event, array $data`.
All event handler methods live here. See "Event handlers" section below.

### 4. MandiagWebhookEvent model
**Path:** `backend/app/Models/MandiagWebhookEvent.php`

Simple model for the `mandiag_webhook_events` table. No relationships needed.

Responsibilities:
1. Read raw body BEFORE any JSON parsing
2. Verify HMAC signature using `MANDIAG_WEBHOOK_SECRET`
3. Verify timestamp is within ±300 seconds
4. Dedup by `event_id` using `mandiag_webhook_events` table
5. Dispatch to event handler based on `event` type
6. Return `200` on success, `400` on bad signature/timestamp, `200` on duplicate

```php
public function receive(Request $request): JsonResponse
{
    $rawBody = $request->getContent();
    $ts      = $request->header('X-Mandiag-Timestamp', '');
    $sig     = $request->header('X-Mandiag-Signature', '');
    $secret  = config('mandiag.webhook_secret');

    // 1. Timestamp check — reject stale deliveries
    if (!ctype_digit($ts) || abs(time() - (int)$ts) > 300) {
        return response()->json(['error' => 'stale'], 400);
    }

    // 2. Signature check — constant-time compare
    $expected = hash_hmac('sha256', $ts . '.' . $rawBody, $secret);
    if (!hash_equals($expected, $sig)) {
        return response()->json(['error' => 'invalid signature'], 401);
    }

    $payload = json_decode($rawBody, true);
    $eventId = $payload['event_id'] ?? null;

    // 3. Guard: event_id must be a non-empty string
    if (!is_string($eventId) || $eventId === '') {
        return response()->json(['error' => 'missing event_id'], 400);
    }

    // 4. TOCTOU-safe dedup using unique constraint + try/catch
    // Do NOT check exists() then create() — two simultaneous deliveries would both pass the check.
    // Instead, attempt insert and catch the unique constraint violation.
    try {
        MandiagWebhookEvent::create([
            'event_id'    => $eventId,
            'event_type'  => $payload['event'] ?? 'unknown',
            'payload'     => $payload,
            'occurred_at' => $payload['occurred_at'] ?? null,
        ]);
    } catch (\Illuminate\Database\UniqueConstraintViolationException) {
        // Already processed — return 200 to stop Mandiag retrying
        return response()->json(['status' => 'duplicate'], 200);
    }

    // 5. Dispatch async job — return 200 immediately, stay within Mandiag's 15s timeout
    // Processing happens in the queue — never inline in the HTTP cycle
    ProcessMandiagWebhookEvent::dispatch($payload['event'] ?? '', $payload['data'] ?? []);

    return response()->json(['status' => 'ok'], 200);
}
```

### 5. MandiagWebhookEvent model
**Path:** `backend/app/Models/MandiagWebhookEvent.php`

Simple model for the `mandiag_webhook_events` table. No relationships needed.

---

## Files to EDIT

### 4. routes/api.php
Add webhook route — **outside** the Sanctum auth middleware group:

```php
Route::post('/mandiag/webhook', [MandiagWebhookController::class, 'receive'])
    ->middleware('throttle:60,1');
```

URL: `POST /api/mandiag/webhook`

### 5. bootstrap/app.php or VerifyCsrfToken
Exempt `/api/mandiag/webhook` from CSRF (API routes are already exempt in Laravel).

---

## Event handlers (inside ProcessMandiagWebhookEvent job)

**Path:** `backend/app/Jobs/ProcessMandiagWebhookEvent.php`

All event handling runs in a queued job — not in the HTTP controller.
This keeps the webhook endpoint under Mandiag's 15-second timeout always.

```php
public function handle(): void
{
    match($this->event) {
        'license.expired'       => $this->handleExpired($this->data),
        'license.expiring_soon' => $this->handleExpiringSoon($this->data),
        'license.renewed'       => $this->handleRenewed($this->data),
        'license.disabled'      => $this->handleDisabled($this->data),
        'license.enabled'       => $this->handleEnabled($this->data),
        'license.banned'        => $this->handleBanned($this->data),
        'license.unbanned'      => $this->handleUnbanned($this->data),
        default                 => null, // log unknown events, never error
    };
}

private function handleExpired(array $data): void
{
    $license = License::where('mandiag_license_id', $data['license_id'])->first();
    if ($license && $license->status === 'active') {
        $license->forceFill(['status' => 'expired'])->save();
        // TODO: dispatch expiry notification to reseller
    }
}

private function handleExpiringSoon(array $data): void
{
    $license = License::where('mandiag_license_id', $data['license_id'])->first();
    if ($license) {
        // TODO: dispatch expiry-warning notification to reseller with $data['days_remaining']
    }
}

private function handleRenewed(array $data): void
{
    $license = License::where('mandiag_license_id', $data['license_id'])->first();
    if ($license && !empty($data['expire_date'])) {
        $license->forceFill(['expires_at' => $data['expire_date']])->save();
    }
}

private function handleDisabled(array $data): void
{
    // Handles EXTERNAL disables (Mandiag admin, not triggered by our platform)
    $license = License::where('mandiag_license_id', $data['license_id'])->first();
    if ($license && $license->status === 'active') {
        // NOTE: status='pending' is the platform's "paused" state — same status that
        // platform-initiated pause() sets. The UI shows paused licenses as "pending".
        // This is consistent with platform pause behavior and avoids introducing a new status.
        $license->forceFill([
            'status'    => 'pending',
            'paused_at' => now(),
            'pause_reason' => 'Disabled externally by Mandiag.',
        ])->save();
        // TODO: notify reseller — "Your license for [software] was disabled externally."
    }
}

private function handleEnabled(array $data): void
{
    // Handles EXTERNAL enables (Mandiag admin)
    $license = License::where('mandiag_license_id', $data['license_id'])->first();
    if ($license && $license->status === 'pending') {
        $license->forceFill(['status' => 'active'])->save();
    }
}

private function handleBanned(array $data): void
{
    // CRITICAL: Mandiag banned this license — customer cannot use it at all
    $license = License::where('mandiag_license_id', $data['license_id'])->first();
    if ($license) {
        $license->forceFill(['status' => 'cancelled'])->save();
        // TODO: notify reseller urgently — ban_reason in $data['ban_reason']
    }
}

private function handleUnbanned(array $data): void
{
    // Log only — do NOT auto-reactivate. Manager Parent decides what to do next.
    \Log::info('Mandiag license unbanned', ['license_id' => $data['license_id'] ?? null]);
}
```

---

## Registration with Mandiag

After deploying the endpoint, call once:

```bash
PUT /webhooks
{
  "url": "https://panel.obd2sw.com/api/mandiag/webhook",
  "subscribed_events": null,   // null = all events
  "status": "active"
}
```

Save the returned `secret` as `MANDIAG_WEBHOOK_SECRET` in `.env`.

Then test:
```bash
POST /webhooks/test
```

Verify your receiver logs show the synthetic event within ~60 seconds.

---

## .env changes

```env
MANDIAG_WEBHOOK_SECRET=whsec_...   # from PUT /webhooks response
```

---

## Validation checklist

- [ ] `POST /api/mandiag/webhook` with invalid signature returns 401
- [ ] `POST /api/mandiag/webhook` with stale timestamp (>300s) returns 400
- [ ] `POST /api/mandiag/webhook` with missing/null `event_id` returns 400
- [ ] `POST /api/mandiag/webhook` with duplicate `event_id` returns 200 without re-processing
- [ ] Two simultaneous deliveries of same event_id — only one handleEvent fires (TOCTOU test)
- [ ] `license.expired` event → license status changes to `expired`, reseller notification sent
- [ ] `license.expiring_soon` event → reseller notification sent, no status change
- [ ] `license.renewed` event → license `expires_at` updated to Mandiag's returned value
- [ ] `license.disabled` (external) event → license status changes to `pending`, `paused_at` set, reseller notified
- [ ] `license.enabled` (external) event → license status changes to `active` if was `pending`
- [ ] `license.banned` event → license status changes to `cancelled`, reseller urgently notified
- [ ] `license.unbanned` event → logged only, no status change, no auto-reactivation
- [ ] Unknown event type → silently ignored, no error thrown
- [ ] `POST /webhooks/test` delivers synthetic event, receiver processes it within 60 seconds
