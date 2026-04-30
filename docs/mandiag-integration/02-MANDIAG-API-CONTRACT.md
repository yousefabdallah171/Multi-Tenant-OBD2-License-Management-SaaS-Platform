# Mandiag Partner API Contract

**API version:** v1.4.3
**Base URL:** `https://mandiag.com/api/partner/v1`
**Partner:** `engmozaid`
**Sub-reseller suffix:** `-obd2sw` (Mandiag appends this — you only use `sub_id`)

---

## Credentials

Store in `.env` only. Never in docs, never in DB, never in frontend code.
Real values are in `START-HERE.txt` (kept offline / not committed to git).

```env
# Live
MANDIAG_API_KEY=mp_live_...
MANDIAG_SIGNING_SECRET=whsec_...

# Sandbox (for testing only — swap these in during development)
# MANDIAG_API_KEY=mp_test_...
# MANDIAG_SIGNING_SECRET=whsec_...

# Phase 2 only
MANDIAG_WEBHOOK_SECRET=whsec_...
```

---

## Authentication

Every request requires 3 headers:

```
X-Mandiag-Key:       {MANDIAG_API_KEY}
X-Mandiag-Timestamp: {unix_seconds}        ← must be within ±300s of Mandiag clock
X-Mandiag-Signature: {hmac_hex}
```

Every mutating request (POST, PUT, PATCH, DELETE) additionally requires:

```
Idempotency-Key: {fresh_uuid_per_request}
```

### Signature calculation (PHP)

```php
$body      = $isGet ? '' : json_encode($payload, JSON_UNESCAPED_SLASHES);
$timestamp = (string) time();
$signature = hash_hmac('sha256', $timestamp . '.' . $body, $signingSecret);
```

**Critical:** Sign the exact bytes you send. Serialize once, sign that string, send that string.

---

## Response envelope

All responses use:

```json
{ "success": true,  "request_id": "…", "data": { … } }
{ "success": false, "request_id": "…", "error": { "code": "…", "message": "…" } }
```

Use `error.code` (not `error.message`) for logic — messages can change.

---

## Endpoints used by this integration

### POST /resellers
Create a sub-reseller for one of our resellers.

```json
Request:
{
  "sub_id":        "ahmed",
  "realname":      "Ahmed Name",
  "contact_email": "ahmed@example.com"
}

Response 201:
{
  "sub_id":         "ahmed",
  "panel_username": "ahmed-obd2sw",
  "status":         "active"
}
```

Errors: `409 sub_id_collision`, `422 sub_id_invalid`

**sub_id rules:** lowercase `[a-z0-9_-]`, 1–64 chars, must start with alnum.

---

### PUT /resellers/{sub_id}/pricing
Set pricing before the first license. **Required — activation fails without this.**

```json
Request:
{
  "software_pricing": [
    { "software": "topix",       "duration": "1year",  "price": 70.00 },
    { "software": "topix",       "duration": "1month", "price": 9.00  }
  ],
  "ac360_usd_prices": []
}
```

`price` = what the sub-reseller owes you (informational — you bill them off-platform).
`manager_price` = what you owe Mandiag (set by Mandiag on the master `engmozaid` account).

---

### POST /licenses
Create a new license (activation).

```json
Request:
{
  "sub_id":        "ahmed",
  "software":      "topix",
  "duration":      "1year",
  "hwid":          "BIOS-ID-HERE",
  "customer":      "john@example.com",
  "customer_name": "John Auto Repair"
}

Response 201:
{
  "license_id":  152834,
  "expire_date": "2027-04-26 13:00:00",
  "price":       70.00,
  "manager_price": 50.00,
  "status":      ["active"]
}
```

**Store `license_id` as `mandiag_license_id` on the license record.**

Errors: `422 price_lookup_failed` (set pricing first), `422 duration_invalid`

---

### POST /licenses/{id}/renew
Renew a license. Uses `mandiag_license_id`.

```json
Request:  { "duration": "1year" }
Response: { "license_id": 152834, "expire_date": "2028-04-26 13:00:00", ... }
```

Errors: `409 license_disabled` (enable first), `409 license_banned`

---

### POST /licenses/{id}/disable
Deactivate or pause a license.

```json
Request:  { "reason": "customer request" }   ← optional
Response: { "license_id": 152834, "status": ["disabled"] }
```

---

### POST /licenses/{id}/enable
Re-activate a paused/disabled license.

```json
Request:  {}
Response: { "license_id": 152834, "status": ["active"] }
```

---

### PATCH /licenses/{id}/expiration
Set expire date directly. Used after resume to restore remaining time.

```json
Request:  { "expire_date": "2026-05-30 14:00:00" }
Response: { "license_id": 152834, "expire_date": "2026-05-30 14:00:00" }
```

---

## Duration string map

| Platform `duration_days` | Mandiag `duration` | Tolerance |
|---|---|---|
| 1 | `1day` | ±3 days |
| 7 | `1week` | ±3 days |
| 30 | `1month` | ±3 days |
| 90 | `3months` | ±3 days |
| 180 | `6months` | ±3 days |
| 365 | `1year` | ±3 days |
| 730 | `2years` | ±3 days |

If `duration_days` cannot be mapped: throw validation error before calling Mandiag.

---

## sub_id format rules

- Lowercase only: `[a-z0-9_-]`
- 1–64 characters
- Must start with alphanumeric character
- Derived from platform user's `username` field (sanitized)
- On `sub_id_collision (409)`: retry with numeric suffix `username2`, `username3`...

---

## Rate limits

- 100 requests/minute per key
- 5,000 requests/hour per key
- On `429`: read `Retry-After` header

---

## Ford-PTS carve-out (automatic)

For software: `ford-pts`, `ford pts`, `fdrs-motorcraft`, `ford-motorcraft`
→ Mandiag forces `manager_price = 0` automatically.
Sub-reseller still pays their normal price (which you bill them).
No special handling needed in our code.

---

## Sandbox vs Live

- Resources created with `mp_test_…` are NOT visible to `mp_live_…` and vice versa
- The underlying DB is shared but rows are isolated by environment — they are not cross-visible
- Sandbox `manager_price` is always `$0.00` — safe for testing
- Only the API key and signing secret change when going live — all business logic stays identical
- Sub-resellers created in sandbox remain there — they do NOT appear in live
- Sub_ids (e.g. `u123`) will need to be created again under the live key
- Prefix sandbox test sub-resellers with `dev_` for easy cleanup (or just use the `u{id}` format — easy to identify)
- `environment` field in webhook payloads distinguishes sandbox (`"sandbox"`) from live (`"live"`)

---

## Error codes relevant to our integration

| Code | Status | Our handling |
|---|---|---|
| `sub_id_collision` | 409 | Retry with suffix |
| `sub_id_invalid` | 422 | Log + surface as config error |
| `price_lookup_failed` | 422 | Surface: "Pricing not configured. Contact manager." |
| `license_disabled` | 409 | Surface: "License is disabled. Enable it first." |
| `license_banned` | 409 | Surface: "License banned. Contact Mandiag support." |
| `license_not_found` | 404 | Log + surface as internal error |
| `duration_invalid` | 422 | Should never happen if we validate duration_days first |
| `expired_timestamp` | 401 | Server clock drift — check NTP |
| `invalid_signature` | 401 | Signing bug — check body byte-exactness |
| `rate_limited` | 429 | Retry after `Retry-After` header value |
| `server_error` | 500/503 | Surface: "External service unavailable. Try again or schedule." |
| `feature_disabled` | 403 | Partner account suspended. Surface: "Integration disabled. Contact your manager." |
| `rate_limited` | 429 | Surface: "Too many requests. Wait a moment and try again, or schedule." |

---

## Webhook events (Phase 2)

| Event | When | Key fields |
|---|---|---|
| `license.expired` | Hourly cron | `license_id, sub_id, hwid, expire_date` |
| `license.expiring_soon` | Daily, 7 days before | `license_id, sub_id, days_remaining` |
| `license.disabled` | On disable call | `license_id, sub_id` |
| `license.enabled` | On enable call | `license_id, sub_id` |
| `license.created` | On activation | `license_id, sub_id, software, expire_date` |
| `license.renewed` | On renewal | `license_id, sub_id, expire_date` |

Webhook signature verification (same HMAC algorithm, different secret):
```php
$expected = hash_hmac('sha256', $timestamp . '.' . $rawBody, $webhookSecret);
hash_equals($expected, $incomingSignature);
```

---

## Tracking endpoints (Phase 3)

```
GET /balance                          → total partner balance
GET /commission?period=month          → revenue/cost/commission by period
GET /resellers?include_stats=1        → all resellers with stats in one call
GET /resellers/{sub_id}/balance       → one reseller's balance
GET /resellers/{sub_id}/stats?period= → one reseller's stats
GET /licenses?sub_id=…&status=…       → filtered license list
```
