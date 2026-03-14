# Tenant Reset, Backup & Restore

## Overview

Super admins can fully wipe a tenant's operational data (customers, licenses, logs) and restore it at any time using a snapshot-based backup system. Backups are stored in the database and can be downloaded as portable JSON files and imported on any server.

---

## Feature Access

- **Role required:** `super_admin` only
- **Location:** Super Admin → Tenants → Actions menu (⋯) per tenant

---

## Actions Available

| Action | Description |
|---|---|
| **Reset Tenant** | Backs up all operational data, then deletes it. Tenant starts fresh. Managers & resellers are NOT deleted. |
| **Backups** | View all backups for a tenant. Restore, download, or delete individual backups. Import a backup file from another server. |
| **Restore** | Re-inserts all backed-up data (customers, licenses, logs) into the tenant. Wipes current data first. |
| **Download** | Downloads the backup as a `.json` file (portable — can be imported on another server). |
| **Import** | Uploads a `.json` file (from Download). Creates a backup entry without restoring — you must then click Restore to apply it. |
| **Delete Backup** | Permanently removes a backup entry. Cannot be undone. |

---

## What Gets Backed Up / Deleted on Reset

| Table | Scoped by |
|---|---|
| `users` (role=customer only) | `tenant_id` |
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

**NOT deleted:** managers, manager-parents, resellers, programs, tenant settings, tenant record itself.

---

## Safety Measures

- Both Reset and Restore require typing the **exact tenant name** to confirm.
- Reset always creates a backup **before** deleting — no data is lost without a snapshot.
- All operations run inside a **database transaction** — partial failures are rolled back automatically.
- Restore wipes current data first, then re-inserts the backup — it replaces, not merges.

---

## Backup File Format (v2)

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
    "stats": { "customers": 10, "licenses": 11, ... },
    "created_at": "2026-03-14T12:00:00.000000Z",
    "created_by": "Super Admin"
  },
  "data": {
    "customers": [ ... ],
    "licenses": [ ... ],
    "bios_change_requests": [ ... ],
    "bios_access_logs": [ ... ],
    "bios_conflicts": [ ... ],
    "activity_logs": [ ... ],
    "api_logs": [ ... ],
    "user_ip_logs": [ ... ],
    "user_balances": [ ... ],
    "user_online_statuses": [ ... ],
    "reseller_commissions": [ ... ],
    "reseller_payments": [ ... ],
    "financial_reports": [ ... ]
  }
}
```

---

## Cross-Server Import Workflow

1. On **Server A**: Backups → Download → saves `backup-tenant-name-YYYYMMDD-HHmmss.json`
2. On **Server B**: Open the same tenant (or a different tenant) → Backups → Import → choose the file
3. The backup appears in the list with the original label (or a custom one you set during import)
4. Click **Restore** on the imported backup and type the tenant name to confirm
5. All data from the original server is now live on Server B

> **Note:** When importing to a different tenant, the `tenant_id` in the restored rows will remain as the original. Make sure the target tenant is the correct one.

---

## API Endpoints

All endpoints require `Authorization: Bearer {token}` and role `super_admin`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/super-admin/tenants/{tenant}/backups` | List all backups (no payload data) |
| `POST` | `/api/super-admin/tenants/{tenant}/reset` | Reset tenant + create backup |
| `GET` | `/api/super-admin/tenants/{tenant}/backups/{backup}/download` | Download backup as JSON file |
| `POST` | `/api/super-admin/tenants/{tenant}/backups/import` | Import backup from uploaded JSON file |
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

### POST `/import` body (multipart/form-data)
```
file: <backup.json file>
label: "Optional custom label"
```

---

## Database

Migration: `2026_03_14_100000_create_tenant_backups_table.php`

```
tenant_backups
  id            bigint unsigned PK
  tenant_id     FK → tenants.id (cascade delete)
  created_by    FK → users.id (cascade delete)
  label         varchar(255) nullable
  stats         json           (row counts per table)
  payload       longtext       (full JSON snapshot of all rows)
  created_at    timestamp
  updated_at    timestamp
```

---

## Technical Notes

- Data collection uses raw `DB::table()` queries (not Eloquent) so datetime values stay in MySQL `Y-m-d H:i:s` format and are directly re-insertable.
- On restore, all values are normalized: PHP arrays are JSON-encoded, ISO 8601 datetimes (from older Eloquent-based backups) are converted to MySQL format automatically.
- Large tenants with thousands of rows are handled by chunked inserts (200 rows/chunk) to stay within `max_allowed_packet` limits.
- The `payload` column is `longtext` — supports up to ~4GB per backup.
