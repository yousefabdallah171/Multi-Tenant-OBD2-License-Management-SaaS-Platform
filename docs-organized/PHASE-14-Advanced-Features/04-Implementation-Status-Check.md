# PHASE 14: Implementation Status Check (2026-03-03)

This checklist reflects the current codebase status after implementation pass.

## PRIORITY 1: F-1 — Username-BIOS ID Concatenation
- [x] License activation uses concatenated BIOS format (`username-bios_id`) in backend service.
- [x] Concatenated BIOS is persisted to `licenses.bios_id`.
- [x] External username is persisted to `licenses.external_username`.
- [x] Deactivation uses concatenated BIOS identifier.
- [x] Activation form shows concatenation hint in UI.
- [x] Localization keys added (EN/AR).
- [x] Placeholder migration added for concatenation rollout.
- [ ] Dedicated `BiosConflictDetect` middleware implementation/update (not present in project).
- [ ] Backend tests for concatenation flow.
- [ ] Frontend/E2E tests for concatenation flow.

## PRIORITY 2: F-2 — BIOS Details Page
- [x] Backend BiosDetails service created.
- [x] Manager Parent BiosDetails controller created.
- [x] Super Admin BiosDetails controller created.
- [x] BIOS details API routes registered for both roles.
- [x] Manager Parent BIOS Details page created.
- [x] Super Admin BIOS Details page created.
- [x] BIOS details frontend service created.
- [x] BIOS details frontend types created.
- [x] Router and sidebar entries added.
- [x] Localization keys added (EN/AR).
- [ ] Dedicated per-tab reusable UI components (BiosSearchInput/BiosOverviewCard/etc.) not split out yet.
- [ ] Backend/Frontend/E2E tests for BIOS details workflow.

## PRIORITY 3: F-3 — Customer Details Enhancement
- [x] Manager Parent customer detail enhanced with tabs.
- [x] BIOS links to BIOS Details page added.
- [x] IP/activity sections retained within tabbed UI.
- [ ] Super Admin customer detail enhancement equivalent.
- [ ] Frontend tests for enhanced customer detail tabs/links.

## PRIORITY 4: F-4 — License Activation Scheduling
- [x] Scheduling migration added (`scheduled_at`, `scheduled_timezone`, `is_scheduled`, `activated_at_scheduled`).
- [x] License model updated with scheduling fields/casts.
- [x] Controller validation + response updated for scheduled payload.
- [x] License service supports scheduled activation path.
- [x] Scheduler command (`licenses:schedule-activate`) added.
- [x] Scheduled activation event added.
- [x] Command registered in scheduler.
- [x] Activation form supports schedule toggle/date-time/timezone.
- [x] Timezones utility added.
- [x] Activation service payload updated for scheduling.
- [x] Localization keys added (EN/AR).
- [ ] Backend feature tests for scheduling command and flow.
- [ ] Frontend component/E2E tests for scheduling UI.

## PRIORITY 5: F-5 — Timezone Settings (Super Admin)
- [x] Super admin settings payload extended with `general.server_timezone`.
- [x] Backend validation updated for `server_timezone`.
- [x] Settings defaults include `server_timezone`.
- [x] Super Admin settings page includes timezone selector.
- [x] Frontend settings types/service updated.
- [x] Localization keys added (EN/AR).
- [x] Settings table/model scaffolding added (`super_admin_settings`, `Setting` model).
- [ ] Runtime switched to DB-backed `Setting` model (current runtime still uses `SystemSettingsStore` JSON storage).
- [ ] Backend tests for timezone settings CRUD/access.

## PRIORITY 6: F-6 — IP Analytics External API Format Matching
- [x] New `IpAnalyticsService` created (parse + match).
- [x] Manager Parent IP analytics controller rewritten to use service.
- [x] Frontend IP analytics page updated (no required program selector, richer columns, links, filters).
- [x] Types/service updated for external ID/program/bios mapping.
- [x] Localization keys added (EN/AR).
- [ ] Backend tests for parser/matching service.
- [ ] Frontend tests for updated table and filters.

## PRIORITY 7: F-7 — Online Users Widget Fix
- [x] Online widget now shows `last_seen_at`.
- [x] Frontend online service added and widget integrated.
- [x] `TrackOnlineStatus` middleware/model/migration/events scaffolding added.
- [x] Middleware wired into authenticated API group.
- [ ] Full migration from `users.last_seen_at` query to `user_online_status` query not completed.
- [ ] Real-time Pusher event wiring for `UserOnline`/`UserOffline` in widget not completed.
- [ ] Dedicated backend/frontend tests for online status flow.

## Cross-Cutting Tasks
- [x] Core Phase 14 route/page/service wiring completed.
- [x] Frontend production build passes.
- [x] Backend PHP syntax checks pass for modified files.
- [ ] Phase 10 docs update not completed in this pass.
- [ ] README Phase 14 update not completed in this pass.
- [ ] Full Phase 08 test-suite additions for Phase 14 not completed in this pass.

