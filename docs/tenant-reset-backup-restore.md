# Tenant Reset, Backup & Restore

## Overview

Super admins can fully wipe a tenant's operational data and restore it later using a snapshot-based backup system. The feature is hardened for:

- large tenants with heavy log tables
- cross-server backup download/import
- programs linked to an external software API

Backups are:

- stored in the database
- compressed at rest in `tenant_backups.payload`
- downloadable as portable JSON files
- importable on another server

---

## Feature Access

- **Role required:** `super_admin` only
- **Location:** Super Admin -> Tenants -> Actions menu per tenant

---

## Actions Available

| Action | Description |
|---|---|
| **Reset Tenant** | Creates a backup, deactivates externally active software users for that tenant, then deletes local operational data. Managers and resellers are not deleted. |
| **Backups** | View all backups for a tenant. Restore, download, import, or delete individual backups. |
| **Restore** | Wipes current tenant operational data, restores the selected backup, then re-syncs active licenses back to the external software API when needed. |
| **Download** | Downloads the backup as a portable `.json` file. |
| **Import** | Uploads a `.json` backup file and stores it as a backup entry without restoring it immediately. |
| **Delete Backup** | Permanently removes a backup entry. Cannot be undone. |

---

## What Gets Backed Up / Deleted on Reset

| Table | Scoped by |
|---|---|
| `users` (`role=customer` only) | `tenant_id` |
| `licenses` | `tenant_id` |
| `bios_change_requests` | `tenant_id` |
| `bios_access_logs` | `tenant_id` |
| `bios_conflicts` | `tenant_id` |
| `activity_logs` | `tenant_id` |
| `api_logs` | `tenant_id` |
| `user_ip_logs` | customer `user_id` |
| `user_balances` | customer `user_id` |
| `user_online_status` | customer `user_id` |
| `reseller_commissions` | `tenant_id` |
| `reseller_payments` | commission `id` |
| `financial_reports` | `tenant_id` |

**Not deleted:** managers, manager-parents, resellers, programs, tenant settings, and the tenant record itself.

---

## External API Sync Behavior

Programs with external API credentials are synchronized during reset and restore.

### Reset flow

Before local tenant data is deleted, the system:

1. finds licenses that are still effectively active for the tenant
2. resolves each license's external username and program API credentials
3. calls the external delete endpoint for each active external user
4. only then proceeds to wipe the tenant's local operational data

If the local database reset fails after external deactivation, the controller performs a best-effort external rollback by trying to re-activate the same users.

### Restore flow

Before restoring the backup, the system:

1. deactivates any currently active external users for the tenant
2. pre-cleans any usernames that will be restored as active again

After the database restore succeeds, the system:

1. scans restored licenses from the backup
2. re-activates only the licenses that should actually be live externally

### Status rules used for external restore

- `active`: re-activated externally
- expired active rows: not re-activated externally
- `pending`, `cancelled`, `expired`, and other non-active rows: not re-activated externally

### Already-absent external users

If the external delete endpoint fails but `apiusers/{softwareId}` confirms that the username is already absent, the operation is treated as successful and reset/restore continues.

---

## Safety Measures

- Both Reset and Restore require typing the exact tenant name to confirm.
- Reset always creates a backup before deleting local data.
- Local database reset/restore operations run inside a database transaction.
- External API side effects are executed outside the DB transaction and validated separately.
- Restore replaces current operational data; it does not merge.
- Backup generation is streamed to avoid PHP memory exhaustion on large tenants.
- Restore inserts rows in adaptive chunks to avoid MySQL packet-size failures on large payloads.

---

## Backup File Format (v2)

Downloaded backups are exported as plain JSON:

```json
{
  "version": 2,
  "exported_at": "2026-03-14T12:00:00.000000Z",
  "tenant": {
    "id": 1,
    "name": "Acme Corp",
    "slug": "acme-corp"
  },
  "backup": {
    "id": 5,
    "label": "Before Q1 reset",
    "stats": {
      "customers": 10,
      "licenses": 11
    },
    "created_at": "2026-03-14T12:00:00.000000Z",
    "created_by": "Super Admin"
  },
  "data": {
    "customers": [],
    "licenses": [],
    "bios_change_requests": [],
    "bios_access_logs": [],
    "bios_conflicts": [],
    "activity_logs": [],
    "api_logs": [],
    "user_ip_logs": [],
    "user_balances": [],
    "user_online_statuses": [],
    "reseller_commissions": [],
    "reseller_payments": [],
    "financial_reports": []
  }
}
```

The database does not store that raw JSON directly. It stores a compressed envelope in `tenant_backups.payload`.

---

## Cross-Server Import Workflow

1. On Server A: Backups -> Download -> save `backup-tenant-name-YYYYMMDD-HHmmss.json`
2. On Server B: open the tenant -> Backups -> Import -> choose the file
3. The imported backup appears in the backups list
4. Click Restore and type the tenant name to confirm
5. The tenant's operational data is restored on Server B

> Import stores the backup payload as-is. Restore should only be used in the correct tenant context.

---

## API Endpoints

All endpoints require `Authorization: Bearer {token}` and role `super_admin`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/super-admin/tenants/{tenant}/backups` | List all backups without payload data |
| `POST` | `/api/super-admin/tenants/{tenant}/reset` | Reset tenant and create a backup |
| `GET` | `/api/super-admin/tenants/{tenant}/backups/{backup}/download` | Download backup as JSON |
| `POST` | `/api/super-admin/tenants/{tenant}/backups/import` | Import backup from uploaded JSON |
| `POST` | `/api/super-admin/tenants/{tenant}/backups/{backup}/restore` | Restore from a backup |
| `DELETE` | `/api/super-admin/tenants/{tenant}/backups/{backup}` | Delete a backup |

### POST `/reset` body

```json
{
  "confirm_name": "Acme Corp",
  "label": "Optional label for the backup"
}
```

### POST `/restore` body

```json
{
  "confirm_name": "Acme Corp"
}
```

### POST `/import` body

Multipart form data:

```text
file: <backup.json file>
label: Optional custom label
```

---

## Database

Migration: `2026_03_14_100000_create_tenant_backups_table.php`

```text
tenant_backups
  id            bigint unsigned PK
  tenant_id     FK -> tenants.id (cascade delete)
  created_by    FK -> users.id (cascade delete)
  label         varchar(255) nullable
  stats         json
  payload       longtext
  created_at    timestamp
  updated_at    timestamp
```

`payload` stores a compressed JSON envelope similar to:

```json
{
  "encoding": "gzip_base64",
  "data": "H4sIAAAAA..."
}
```

Older uncompressed backups are still supported.

---

## Technical Notes

- Backup collection uses raw `DB::table()` queries instead of Eloquent snapshots.
- Backup JSON is written through a streamed temp-file builder so large tables do not exhaust PHP memory.
- Stored backup payloads are compressed before saving to MySQL.
- Restore normalizes arrays and older ISO 8601 datetime strings automatically.
- Restore inserts are chunked by both row count and approximate payload size.
- Heavy tables such as `api_logs`, `activity_logs`, and `bios_access_logs` use smaller restore chunks than other tables.
- The `payload` column is `longtext` and stores the compressed backup envelope.
- External API error text is sanitized before being returned to the UI, so raw HTML error pages are not shown in dialogs.
