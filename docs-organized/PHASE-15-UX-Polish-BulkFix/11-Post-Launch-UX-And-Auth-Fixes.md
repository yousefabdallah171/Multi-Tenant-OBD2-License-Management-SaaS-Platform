# Post-Launch UX and Auth Fixes

Updated: 2026-03-13

## Scope
- Customer/status UX consistency
- Renew/edit flow usability
- Disabled-account behavior
- Management detail/edit flow polish

## UX fixes completed
- Replaced duplicated customer filter tabs with filter cards across roles.
- Fixed customer status card counts and default pagination on the main customer pages.
- Clarified status semantics:
  - `Pending` kept for not-yet-active customer/license workflows
  - removed visible `No License` split state from the UI
- Converted renew/edit-schedule from cramped dialogs to full pages with return-to navigation.
- Added top-left back actions and header edit actions to management detail pages.
- Merged username editing into the main edit dialogs.
- Removed visible locked/unlocked badges from management list/detail pages.
- Removed old profile notification-preference UI where it was not needed.
- Reworked the super-admin create-customer flow to match the modern shared create/activate UX.

## Auth and session fixes completed
- Added reset-password option to revoke the target user's sessions, checked by default.
- Enforced inactive/suspended account state on every authenticated request.
- Added the dedicated account-disabled page and redirect flow.
- Added heartbeat-based live session enforcement so a deactivated logged-in user is redirected without manual refresh.

## License/status behavior fixes
- Made expiry minute-accurate on reads and persistence catch-up.
- Immediate renew now syncs with the external software API.
- Added live query refresh/invalidation on status-sensitive pages so status changes appear without manual page reload.

## Validation completed
- Browser verification across the affected flows:
  - renew
  - deactivate/reactivate
  - reset password with forced logout
  - disabled-account redirect
  - management detail edit/back flows

## Outcome
- Role flows are more consistent on desktop and mobile.
- Session/auth behavior now matches administrative actions in real time.
- Customer/license state changes are visible without requiring logout or manual refresh.
