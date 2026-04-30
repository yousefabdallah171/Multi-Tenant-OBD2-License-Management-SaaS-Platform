# Data Model Changes

All changes are additive. No existing columns modified. No existing data affected.

---

## Migration 1 — programs table

**File:** `2026_04_30_100000_add_mandiag_fields_to_programs_table.php`

```php
Schema::table('programs', function (Blueprint $table): void {
    $table->string('api_type', 32)->default('legacy')->after('has_external_api');
    $table->string('mandiag_software_key', 128)->nullable()->after('api_type');
});
```

| Column | Type | Default | Purpose |
|---|---|---|---|
| `api_type` | `varchar(32)` | `'legacy'` | `'legacy'` or `'mandiag'`. All existing rows stay `'legacy'`. |
| `mandiag_software_key` | `varchar(128)` | `null` | Software identifier Mandiag uses: `topix`, `autocore360`, etc. |

**No signing secret in DB.** Credentials live in `.env` only.

---

## Migration 2 — users table

**File:** `2026_04_30_100001_add_mandiag_sub_id_to_users_table.php`

```php
Schema::table('users', function (Blueprint $table): void {
    $table->string('mandiag_sub_id', 64)->nullable()->after('country_name');
    $table->json('mandiag_priced_software_keys')->nullable()->after('mandiag_sub_id');
    $table->index('mandiag_sub_id');
});
```

| Column | Type | Default | Purpose |
|---|---|---|---|
| `mandiag_sub_id` | `varchar(64)` | `null` | Mandiag sub-reseller ID for this user. Null until first Mandiag activation. Set lazily. |
| `mandiag_priced_software_keys` | `json` | `null` | Array of software keys that have had pricing set for this reseller, e.g. `["topix","autocore360"]`. Avoids redundant `PUT /pricing` calls on every activation. |

### Sub_id format — CRITICAL

`username` is unique per-tenant only (`UNIQUE(tenant_id, username)` constraint). Two tenants
can have resellers with the same username. Sub_ids derived from username WILL collide across
tenants at Mandiag (who sees a single global namespace).

**Solution:** Use the platform user's `id` as the sub_id base:

```
sub_id = "u" + users.id
```

Examples: `u123`, `u4507`, `u99`

- Guaranteed globally unique (users.id is a global auto-increment PK)
- Valid format: starts with `u` (alnum), lowercase alphanumeric only
- Short and unambiguous
- No collision possible across tenants or usernames
- buildSubId() simply returns `"u" . $user->id`

Indexed for lookup when syncing on activation.

---

## Migration 3 — licenses table

**File:** `2026_04_30_100002_add_mandiag_license_id_to_licenses_table.php`

```php
Schema::table('licenses', function (Blueprint $table): void {
    $table->unsignedBigInteger('mandiag_license_id')->nullable()->after('external_deletion_response');
    $table->index('mandiag_license_id');
});
```

| Column | Type | Default | Purpose |
|---|---|---|---|
| `mandiag_license_id` | `bigint unsigned` | `null` | Mandiag's numeric license ID. Null for legacy licenses. Required for renew/disable/enable. |

Indexed for webhook event lookup (Phase 2 matches incoming `license_id` to our row).

---

## Migration 4 — mandiag_webhook_events table (Phase 2 only)

**File:** `2026_04_30_100003_create_mandiag_webhook_events_table.php`

```php
Schema::create('mandiag_webhook_events', function (Blueprint $table): void {
    $table->id();
    $table->string('event_id', 128)->unique();   // Mandiag's event_id — dedup key
    $table->string('event_type', 64);
    $table->json('payload')->nullable();
    $table->timestamp('occurred_at')->nullable();
    $table->timestamp('processed_at')->useCurrent();
});
```

Purpose: dedup webhook events by `event_id`. Mandiag delivers at-least-once.

---

## .env keys

```env
# Phase 1
MANDIAG_API_KEY=mp_live_...
MANDIAG_SIGNING_SECRET=whsec_...

# Phase 2
MANDIAG_WEBHOOK_SECRET=whsec_...
```

---

## Program model additions

**File:** `backend/app/Models/Program.php`

New fillable fields:
```php
'api_type',
'mandiag_software_key',
```

New method:
```php
public function isMandiag(): bool
{
    return ($this->api_type ?? 'legacy') === 'mandiag';
}
```

New cast:
```php
'api_type'             => 'string',
'mandiag_software_key' => 'string',
```

---

## User model additions

**File:** `backend/app/Models/User.php`

New fillable fields:
```php
'mandiag_sub_id',
'mandiag_priced_software_keys',
```

New cast:
```php
'mandiag_priced_software_keys' => 'array',
```

---

## License model additions

**File:** `backend/app/Models/License.php`

New fillable field:
```php
'mandiag_license_id',
```

New cast:
```php
'mandiag_license_id' => 'integer',
```

---

## Summary

| Table | Change | Impact on existing data |
|---|---|---|
| `programs` | +2 columns | Existing rows get `api_type='legacy'`, `mandiag_software_key=null` |
| `users` | +2 columns | All rows get `mandiag_sub_id=null`, `mandiag_priced_software_keys=null` |
| `licenses` | +1 column | All rows get `mandiag_license_id=null` |
| `mandiag_webhook_events` | New table | Phase 2 only |
