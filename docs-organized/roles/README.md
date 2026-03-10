# Role Files

Last updated: 2026-03-10

This folder contains one Markdown file per role:

- `SUPER-ADMIN.md`
- `MANAGER-PARENT.md`
- `MANAGER.md`
- `RESELLER.md`
- `CUSTOMER.md`

The full combined reference is:

- `../ROLE-PERMISSIONS-AND-DASHBOARD-PAGES.md`

Recent alignment updates:
- duplicate username-management pages were consolidated into canonical team/admin pages
- duplicate license pages were consolidated into canonical customer pages
- duplicate report pages were consolidated into canonical report pages
- manager reports now use the same tenant-wide financial layout as manager-parent reports
- reseller pricing was removed; software now follows the normal base price flow
- manager team now uses canonical detail pages at `/:lang/manager/team/:id`
- manager and manager-parent BIOS links now resolve to canonical BIOS detail pages
- super-admin admin-management now routes consistently into canonical user detail pages
- super-admin API Status was fixed to avoid api-log memory pressure during page load
- reseller dashboard/runtime polish fixed chart warnings and raw activity/activation labels

