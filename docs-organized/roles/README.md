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
- super-admin now has a canonical global customer workspace and customer detail routes
- super-admin BIOS blacklist now includes tenant-scoped entries with tenant context
- super-admin BIOS and customer drill-downs now use canonical detail pages consistently
- super-admin account actions now block self-delete, self-deactivate, and last-active-super-admin removal
- super-admin API Status was fixed to avoid api-log memory pressure during page load
- reseller dashboard/runtime polish fixed chart warnings and raw activity/activation labels
- manager-parent, manager, and super-admin dashboard stat cards now deep-link into the matching canonical pages
- manager-parent, manager, and super-admin reports now open with the last-year range preloaded
- manager-parent and manager customer pages now sync filters into the URL for dashboard-driven deep links

