# Font Size Fix Tasks — Implementation Plan

Last updated: 2026-03-25

> **DO NOT implement anything until you review and approve each task.**
> Tasks are ordered by impact. Do them in order — each group affects many pages.

---

## Group 1 — Critical: Custom Pixel Sizes (fix first, highest priority)

These are unreadable on any screen. Fix these before anything else.

---

### Task 1.1 — BlockBadge: 10px → 12px (text-xs)
**File:** `frontend/src/components/shared/BlockBadge.tsx`
**Line:** 7
```
BEFORE: text-[10px]
AFTER:  text-xs
```
**Impact:** Affects every customer list row that has a blocked BIOS.

---

### Task 1.2 — LicenseStatusBadges "New" badge: 10px → 12px (text-xs)
**File:** `frontend/src/components/shared/LicenseStatusBadges.tsx`
**Line:** 21
```
BEFORE: text-[10px]
AFTER:  text-xs
```
**Impact:** Affects every customer list row marked as "New".

---

### Task 1.3 — Navbar notification count badge: 9px → 11px (text-[11px])
**File:** `frontend/src/components/layout/Navbar.tsx`
**Line:** 145
```
BEFORE: text-[9px]
AFTER:  text-[11px]
```
**Impact:** The bell icon pending count badge in the top nav.

---

### Task 1.4 — Navbar BCR request timestamp: 10px → 12px (text-xs)
**File:** `frontend/src/components/layout/Navbar.tsx`
**Line:** 184
```
BEFORE: text-[10px]
AFTER:  text-xs
```
**Impact:** Timestamp shown on each BIOS change request in the nav dropdown.

---

### Task 1.5 — Navbar timezone label: 11px → 13px (text-[13px])
**File:** `frontend/src/components/layout/Navbar.tsx`
**Line:** 127
```
BEFORE: text-[11px]
AFTER:  text-[13px]
```
**Impact:** "Timezone: UTC+02:00" label next to the page title.

---

### Task 1.6 — Manager Customers inline status badges: 10px → 12px (text-xs)
**File:** `frontend/src/pages/manager/Customers.tsx`
**Lines:** 407 and 412
```
BEFORE: text-[10px]
AFTER:  text-xs
```
**Impact:** Inline "active elsewhere" and status indicator badges in manager customer table.

---

### Task 1.7 — Manager-Parent Customers inline status badges: 10px → 12px (text-xs)
**File:** `frontend/src/pages/manager-parent/Customers.tsx`
**Lines:** 420 and 425
```
BEFORE: text-[10px]
AFTER:  text-xs
```
**Impact:** Same badges in manager-parent customer table.

---

### Task 1.8 — Reseller Customers inline status badge: 9px → 12px (text-xs)
**File:** `frontend/src/pages/reseller/Customers.tsx`
**Line:** 682 (also check lines 613 and 619 — text-[10px] badges)
```
BEFORE: text-[9px] / text-[10px]
AFTER:  text-xs
```
**Impact:** Status indicator badges in reseller customer table rows.

---

## Group 2 — High Impact: Shared Components (affects all pages)

These components are used everywhere. Fixing them improves every page at once.

---

### Task 2.1 — DataTable column headers: 12px → 14px (text-sm)
**File:** `frontend/src/components/shared/DataTable.tsx`
**Line:** 189
```
BEFORE: text-xs font-semibold uppercase tracking-wide
AFTER:  text-sm font-semibold uppercase tracking-wide
```
**Impact:** EVERY table on the platform — customers, logs, reports, conflicts, blacklist, history, teams.

---

### Task 2.2 — StatusBadge: 12px → 14px (text-sm)
**File:** `frontend/src/components/shared/StatusBadge.tsx`
**Line:** 50
```
BEFORE: text-xs font-semibold
AFTER:  text-sm font-semibold
```
**Impact:** Every license status badge (Active, Suspended, Expired, Pending, Cancelled...) on every page.

---

### Task 2.3 — RoleBadge: 12px → 14px (text-sm)
**File:** `frontend/src/components/shared/RoleBadge.tsx`
**Line:** 16
```
BEFORE: text-xs font-semibold
AFTER:  text-sm font-semibold
```
**Impact:** Role badges (Reseller, Manager, Manager-Parent) in nav and user tables.

---

### Task 2.4 — LockStateBadge: 12px → 14px (text-sm)
**File:** `frontend/src/components/shared/LockStateBadge.tsx`
**Line:** 10
```
BEFORE: text-xs font-semibold
AFTER:  text-sm font-semibold
```
**Impact:** Locked/Unlocked badge on username management pages.

---

### Task 2.5 — StatsCard title label: xs/sm → sm/base (responsive upgrade)
**File:** `frontend/src/components/shared/StatsCard.tsx`
**Line:** 28
```
BEFORE: text-xs font-medium ... sm:text-sm
AFTER:  text-sm font-medium ... sm:text-base
```
**Impact:** All stat card titles on every dashboard (Total Customers, Revenue, Active Licenses...).

---

### Task 2.6 — StatsCard trend badge: 12px → 14px (text-sm)
**File:** `frontend/src/components/shared/StatsCard.tsx`
**Line:** 31
```
BEFORE: text-xs font-medium
AFTER:  text-sm font-medium
```
**Impact:** The % trend badge below stat values on dashboards.

---

### Task 2.7 — StatusFilterCard label: xs/sm → sm/base (responsive upgrade)
**File:** `frontend/src/components/customers/StatusFilterCard.tsx`
**Line:** 50
```
BEFORE: text-xs font-medium sm:text-sm
AFTER:  text-sm font-medium sm:text-base
```
**Impact:** Filter tab labels (All, Active, Expired...) above the customer tables.

---

### Task 2.8 — StatusFilterCard description text: 12px → 14px (text-sm)
**File:** `frontend/src/components/customers/StatusFilterCard.tsx`
**Line:** 59
```
BEFORE: text-xs leading-5
AFTER:  text-sm leading-5
```
**Impact:** Description text on filter tab cards.

---

## Group 3 — Dashboard Pages (timestamps, metadata, labels)

---

### Task 3.1 — Reseller Dashboard activity timestamp
**File:** `frontend/src/pages/reseller/Dashboard.tsx`
**Line:** 151
```
BEFORE: text-xs text-slate-500
AFTER:  text-sm text-slate-500
```

---

### Task 3.2 — Manager Dashboard activity timestamp
**File:** `frontend/src/pages/manager/Dashboard.tsx`
**Line:** 122
```
BEFORE: text-xs text-slate-500
AFTER:  text-sm text-slate-500
```

---

### Task 3.3 — Manager-Parent Dashboard activations count text
**File:** `frontend/src/pages/manager-parent/Dashboard.tsx`
**Line:** 200
```
BEFORE: text-xs text-slate-500
AFTER:  text-sm text-slate-500
```

---

### Task 3.4 — Super-Admin Dashboard activity timestamp
**File:** `frontend/src/pages/super-admin/Dashboard.tsx`
**Line:** 165
```
BEFORE: text-xs text-slate-400
AFTER:  text-sm text-slate-400
```

---

### Task 3.5 — Super-Admin Dashboard activity metadata (user + tenant)
**File:** `frontend/src/pages/super-admin/Dashboard.tsx`
**Line:** 167
```
BEFORE: text-xs text-slate-500
AFTER:  text-sm text-slate-500
```

---

### Task 3.6 — Customer Dashboard progress label
**File:** `frontend/src/pages/customer/Dashboard.tsx`
**Line:** 82
```
BEFORE: text-xs uppercase tracking-wide
AFTER:  text-sm uppercase tracking-wide
```

---

### Task 3.7 — Customer Dashboard days remaining text
**File:** `frontend/src/pages/customer/Dashboard.tsx`
**Line:** 84
```
BEFORE: text-xs text-slate-500
AFTER:  text-sm text-slate-500
```

---

## Group 4 — Navbar User Info

---

### Task 4.1 — Navbar eyebrow branding text: 12px → 14px (text-sm)
**File:** `frontend/src/components/layout/Navbar.tsx`
**Line:** 120
```
BEFORE: text-xs font-semibold uppercase tracking-[0.24em]
AFTER:  text-sm font-semibold uppercase tracking-[0.24em]
```

---

### Task 4.2 — Navbar user email in nav button
**File:** `frontend/src/components/layout/Navbar.tsx`
**Line:** 256
```
BEFORE: text-xs text-slate-500
AFTER:  text-sm text-slate-500
```

---

### Task 4.3 — Navbar user email in dropdown menu
**File:** `frontend/src/components/layout/Navbar.tsx`
**Line:** 269
```
BEFORE: text-xs text-slate-500
AFTER:  text-sm text-slate-500
```

---

### Task 4.4 — Navbar BCR pending count text: 12px → 14px (text-sm)
**File:** `frontend/src/components/layout/Navbar.tsx`
**Lines:** 158 and 162
```
BEFORE: text-xs text-rose-600 / text-xs text-slate-500
AFTER:  text-sm text-rose-600 / text-sm text-slate-500
```

---

### Task 4.5 — Navbar BCR old/new BIOS IDs text
**File:** `frontend/src/components/layout/Navbar.tsx`
**Line:** 188
```
BEFORE: text-xs text-slate-500
AFTER:  text-sm text-slate-500
```

---

### Task 4.6 — Navbar BCR reseller name text
**File:** `frontend/src/components/layout/Navbar.tsx`
**Line:** 194
```
BEFORE: text-xs text-slate-400
AFTER:  text-sm text-slate-400
```

---

### Task 4.7 — Navbar "View all requests" link
**File:** `frontend/src/components/layout/Navbar.tsx`
**Line:** 203
```
BEFORE: text-xs font-medium
AFTER:  text-sm font-medium
```

---

## Group 5 — Customer Detail Pages (field labels, metadata)

---

### Task 5.1 — Reseller CustomerDetail: Info field labels
**File:** `frontend/src/pages/reseller/CustomerDetail.tsx`
**Line:** 193
```
BEFORE: text-xs uppercase tracking-wide text-slate-500
AFTER:  text-sm uppercase tracking-wide text-slate-500
```

---

### Task 5.2 — Reseller CustomerDetail: BCR history metadata
**File:** `frontend/src/pages/reseller/CustomerDetail.tsx`
**Line:** 143
```
BEFORE: text-xs text-slate-500
AFTER:  text-sm text-slate-500
```

---

### Task 5.3 — Reseller CustomerDetail: BCR status label
**File:** `frontend/src/pages/reseller/CustomerDetail.tsx`
**Line:** 135
```
BEFORE: text-xs font-semibold uppercase tracking-wide
AFTER:  text-sm font-semibold uppercase tracking-wide
```

---

### Task 5.4 — Manager CustomerDetail: activations count
**File:** `frontend/src/pages/manager/CustomerDetail.tsx`
**Line:** 152
```
BEFORE: text-xs text-slate-500
AFTER:  text-sm text-slate-500
```

---

### Task 5.5 — Manager CustomerDetail: activity/log timestamps
**File:** `frontend/src/pages/manager/CustomerDetail.tsx`
**Lines:** 168 and 185
```
BEFORE: text-xs text-slate-500
AFTER:  text-sm text-slate-500
```

---

## Group 6 — BIOS Pages

---

### Task 6.1 — BiosHistory username text
**File:** `frontend/src/pages/manager-parent/BiosHistory.tsx`
**Line:** 73
```
BEFORE: text-xs text-slate-500
AFTER:  text-sm text-slate-500
```

---

### Task 6.2 — BiosHistory metadata and timestamps
**File:** `frontend/src/pages/manager-parent/BiosHistory.tsx`
**Lines:** 170 and 176
```
BEFORE: text-xs text-slate-500
AFTER:  text-sm text-slate-500
```

---

### Task 6.3 — BiosDetails field labels (all roles)
**Files:**
- `frontend/src/pages/super-admin/BiosDetails.tsx` — line 136
- `frontend/src/pages/manager/BiosDetails.tsx` — lines 191, 205, 255, 259
- `frontend/src/pages/manager-parent/BiosDetails.tsx` — similar lines
```
BEFORE: text-xs text-slate-500
AFTER:  text-sm text-slate-500
```

---

## Group 7 — Logs Page

---

### Task 7.1 — API Logs endpoint column (code element)
**File:** `frontend/src/pages/super-admin/Logs.tsx`
**Line:** 75
```
BEFORE: <code className="text-xs">
AFTER:  <code className="text-sm">
```
**Note:** Code elements are usually acceptable at text-xs, but this is an important data column — text-sm is better here.

---

## Summary Table

| Group | Tasks | Files | Key Impact |
|---|---|---|---|
| 1 — Critical px sizes | 8 tasks | 5 files | Fixes unreadable 9px/10px badges |
| 2 — Shared components | 8 tasks | 4 files | Improves EVERY page at once |
| 3 — Dashboard pages | 7 tasks | 5 files | All dashboard timestamps/labels |
| 4 — Navbar | 7 tasks | 1 file | Nav dropdown readability |
| 5 — Customer detail | 5 tasks | 2 files | Detail page field labels |
| 6 — BIOS pages | 3 tasks | 3 files | BIOS history/details labels |
| 7 — Logs | 1 task | 1 file | API log endpoint column |
| **Total** | **39 tasks** | **14 files** | |

---

## Implementation Order (recommended)

1. **Group 1** first — critical px fixes, zero visual risk
2. **Group 2** second — biggest bang for fewest file changes
3. **Groups 3–7** — page by page, test after each group

---

*When ready to implement, tell Claude to start with Group 1 or a specific task number.*
