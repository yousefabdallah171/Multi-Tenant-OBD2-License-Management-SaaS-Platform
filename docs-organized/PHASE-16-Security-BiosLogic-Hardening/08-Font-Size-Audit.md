# Font Size Audit — Small Text Review

Last updated: 2026-03-25
Audited: 163 .tsx files across all roles and screens

---

## Summary

| Size Class | What It Maps To | Instances Found | Priority |
|---|---|---|---|
| `text-[9px]` | 9px — unreadable on any screen | 3 | 🔴 Critical |
| `text-[10px]` | 10px — very hard to read | 8 | 🔴 Critical |
| `text-[11px]` | 11px — hard to read on small screens | 2 | 🟠 High |
| `text-xs` | 12px — readable on desktop, too small on tablet | ~244 | 🟡 Medium |

**Tailwind reference:**
- `text-xs` = 12px / line-height 16px
- `text-sm` = 14px / line-height 20px
- `text-base` = 16px / line-height 24px

---

## 1. Critical — Custom Pixel Sizes Below 12px

These must be fixed. 9px and 10px are unacceptable on any screen.

### `text-[9px]` — 3 instances

| File | Line | Element | Recommended Fix |
|---|---|---|---|
| `components/layout/Navbar.tsx` | 145 | Notification dot badge | `text-[11px]` or `text-xs` |
| `components/layout/Sidebar.tsx` | 629 | Notification dot badge | `text-[11px]` or `text-xs` |
| `pages/reseller/Customers.tsx` | 682 | Inline status indicator badge | `text-xs` |

### `text-[10px]` — 8 instances

| File | Line | Element | Recommended Fix |
|---|---|---|---|
| `components/layout/Navbar.tsx` | 184 | Timestamp text in notification dropdown | `text-xs` |
| `components/layout/Sidebar.tsx` | 636 | Sidebar badge (count) | `text-xs` |
| `components/shared/BlockBadge.tsx` | 7 | Block status badge label | `text-xs` |
| `components/shared/LicenseStatusBadges.tsx` | 21 | License status badge label | `text-xs` |
| `pages/manager/Customers.tsx` | 407 | Inline status indicator | `text-xs` |
| `pages/manager/Customers.tsx` | 412 | Inline status indicator | `text-xs` |
| `pages/manager-parent/Customers.tsx` | 420 | Inline status indicator | `text-xs` |
| `pages/manager-parent/Customers.tsx` | 425 | Inline status indicator | `text-xs` |

### `text-[11px]` — 2 instances

| File | Line | Element | Recommended Fix |
|---|---|---|---|
| `components/layout/Navbar.tsx` | 127 | Role label badge in nav | `text-xs` |
| `pages/super-admin/UserDetail.tsx` | 310 | Field label (responsive) | `text-xs` |

---

## 2. High Priority — `text-xs` on Important Readable Elements

These are elements a user actively reads to understand information. `text-xs` (12px) is too small for them, especially on a small desktop or tablet (1280px–1440px width).

### Table Headers

| File | Line | Element | Current | Recommended |
|---|---|---|---|---|
| `components/shared/DataTable.tsx` | 136 | All table column headers | `text-xs` | `text-sm` |

**Impact:** Affects EVERY table on the platform — customers, logs, reports, conflicts, blacklist. This single change improves readability everywhere.

---

### Stats Cards / Dashboard Numbers

| File | Line | Element | Current | Recommended |
|---|---|---|---|---|
| `components/shared/StatsCard.tsx` | 28 | Card title/label | `text-xs sm:text-sm` | `text-sm sm:text-base` |
| `components/shared/StatsCard.tsx` | 31 | Trend indicator badge | `text-xs` | `text-sm` |
| `components/customers/StatusFilterCard.tsx` | 50 | Filter card label | `text-xs sm:text-sm` | `text-sm sm:text-base` |
| `components/customers/StatusFilterCard.tsx` | 59 | Description text | `text-xs` | `text-sm` |

---

### Status Badges (Role, Status, Lock)

| File | Line | Element | Current | Recommended |
|---|---|---|---|---|
| `components/shared/StatusBadge.tsx` | 50 | License status label | `text-xs` | `text-sm` |
| `components/shared/RoleBadge.tsx` | 16 | Role label (Reseller, Manager…) | `text-xs` | `text-sm` |
| `components/shared/LockStateBadge.tsx` | 10 | Lock state label | `text-xs` | `text-sm` |

---

### Dashboard Timestamps and Metadata

| File | Line | Element | Current | Recommended |
|---|---|---|---|---|
| `pages/reseller/Dashboard.tsx` | 151 | Last activity timestamp | `text-xs` | `text-sm` |
| `pages/manager/Dashboard.tsx` | 122 | Timestamp text | `text-xs` | `text-sm` |
| `pages/super-admin/Dashboard.tsx` | 165 | Timestamp text | `text-xs` | `text-sm` |
| `pages/super-admin/Dashboard.tsx` | 167 | Metadata text | `text-xs` | `text-sm` |
| `pages/manager-parent/Dashboard.tsx` | 191 | Role label | `text-xs` | `text-sm` |
| `pages/manager-parent/Dashboard.tsx` | 195 | Activation count text | `text-xs` | `text-sm` |

---

### Customer Detail / Field Labels

| File | Line | Element | Current | Recommended |
|---|---|---|---|---|
| `pages/reseller/CustomerDetail.tsx` | 135 | Status label (uppercase) | `text-xs` | `text-sm` |
| `pages/reseller/CustomerDetail.tsx` | 143 | Metadata text | `text-xs` | `text-sm` |
| `pages/reseller/CustomerDetail.tsx` | 193 | Field label (uppercase) | `text-xs` | `text-sm` |
| `pages/customer/Dashboard.tsx` | 82 | Field label (uppercase) | `text-xs` | `text-sm` |
| `pages/customer/Dashboard.tsx` | 84 | Metadata text | `text-xs` | `text-sm` |
| `pages/customer/Download.tsx` | 84–96 | Multiple field labels (uppercase) | `text-xs` | `text-sm` |

---

### Navbar User Info

| File | Line | Element | Current | Recommended |
|---|---|---|---|---|
| `components/layout/Navbar.tsx` | 120 | Role/branding label | `text-xs` | `text-sm` |
| `components/layout/Navbar.tsx` | 188 | Email in dropdown | `text-xs` | `text-sm` |
| `components/layout/Navbar.tsx` | 194 | Reseller name | `text-xs` | `text-sm` |
| `components/layout/Navbar.tsx` | 256 | User email display | `text-xs` | `text-sm` |
| `components/layout/Navbar.tsx` | 269 | User email in profile section | `text-xs` | `text-sm` |

---

### BIOS Details Page — Field Labels

| File | Lines | Element | Current | Recommended |
|---|---|---|---|---|
| `pages/super-admin/BiosDetails.tsx` | ~12 instances | All field labels | `text-xs` | `text-sm` |
| `pages/manager/BiosDetails.tsx` | 191, 205, 255, 259 | Field labels and metadata | `text-xs` | `text-sm` |
| `pages/manager-parent/BiosDetails.tsx` | multiple | Field labels and metadata | `text-xs` | `text-sm` |

---

### Logs / API Logs Pages

| File | Line | Element | Current | Recommended |
|---|---|---|---|---|
| `pages/super-admin/Logs.tsx` | 75 | API endpoint display | `text-xs` | `text-sm` |
| `pages/super-admin/Logs.tsx` | 209–210 | JSON output in `<pre>` | `text-xs` | `text-xs` (keep — code blocks are fine small) |

---

### Program Catalog

| File | Line | Element | Current | Recommended |
|---|---|---|---|---|
| `components/shared/ProgramCatalogPage.tsx` | 100, 109 | Icon labels | `text-xs` | `text-sm` |
| `components/shared/ProgramCatalogPage.tsx` | 141 | Tag/category text | `text-xs` | `text-sm` |

---

### Reseller Logs

| File | Line | Element | Current | Recommended |
|---|---|---|---|---|
| `pages/reseller/ResellerLogs.tsx` | 262 | Action label badge | `text-xs` | `text-sm` |
| `pages/reseller/ResellerLogs.tsx` | 269 | Field label | `text-xs` | `text-sm` |
| `pages/shared/RoleResellerPaymentsPage.tsx` | 76 | Email text | `text-xs` | `text-sm` |

---

## 3. Medium Priority — `text-xs` for Form Helper Texts and Errors

These are acceptable at `text-xs` but would be improved at `text-sm`. Validation errors and hints should be readable without squinting.

### Activation Form (affects all roles)

| File | Lines | Element | Current | Recommended |
|---|---|---|---|---|
| `components/activation/ActivateLicenseForm.tsx` | 526–819 (~20 instances) | Validation errors, BIOS check status, hints, preset description | `text-xs` | `text-sm` |
| `components/licenses/RenewLicenseForm.tsx` | 328–521 (~10 instances) | Validation errors, hints, preset description | `text-xs` | `text-sm` |
| `pages/shared/CustomerCreatePage.tsx` | multiple | Hints, errors, status indicators | `text-xs` | `text-sm` |

### Settings & Profile

| File | Lines | Element | Current | Recommended |
|---|---|---|---|---|
| `pages/manager-parent/Settings.tsx` | 262, 267, 302 | Helper text and labels | `text-xs` | `text-sm` |
| `pages/super-admin/Settings.tsx` | multiple | Hints and error messages | `text-xs` | `text-sm` |
| `pages/super-admin/Profile.tsx` | 139 | Validation error | `text-xs` | `text-sm` |
| `components/shared/ProfileWorkspace.tsx` | 164, 183, 189 | Error messages, hints | `text-xs` | `text-sm` |

---

## 4. Keep As-Is (Acceptable Small Sizes)

These elements are intentionally small and changing them would harm the design:

| Element | Reason to Keep Small |
|---|---|
| Notification dot badges (red dot) | Pure visual indicator — no text content to read |
| JSON / `<pre>` code blocks in logs | Technical content — monospace, small is standard |
| Pagination info (page 1 of 10) | Secondary navigation, compact is appropriate |
| Chart axis labels | Chart library constraints |
| Login page footer | Legal/footer text, standard to be small |

---

## Recommended Global Changes (Highest Impact)

These 5 changes will fix the most visible readability problems across the whole platform:

### Change 1 — Table Headers (affects every table)
**File:** `components/shared/DataTable.tsx` line 136
```
Before: text-xs uppercase tracking-wider
After:  text-sm uppercase tracking-wider
```

### Change 2 — Status Badges (affects every list and customer page)
**File:** `components/shared/StatusBadge.tsx` line 50
```
Before: text-xs
After:  text-sm
```

### Change 3 — Stats Card Labels (affects all dashboards)
**File:** `components/shared/StatsCard.tsx` line 28
```
Before: text-xs sm:text-sm
After:  text-sm sm:text-base
```

### Change 4 — BlockBadge and LicenseStatusBadges (many pages)
**Files:** `components/shared/BlockBadge.tsx:7`, `components/shared/LicenseStatusBadges.tsx:21`
```
Before: text-[10px]
After:  text-xs
```

### Change 5 — Inline status indicators in Customers tables
**Files:** `pages/manager/Customers.tsx:407,412`, `pages/manager-parent/Customers.tsx:420,425`, `pages/reseller/Customers.tsx:682`
```
Before: text-[10px] / text-[9px]
After:  text-xs
```

---

## Screen Breakpoint Context

| Screen | Width | text-xs renders as | text-sm renders as |
|---|---|---|---|
| Large desktop | 1920px+ | readable | comfortable |
| Desktop | 1440px | readable | comfortable |
| Small desktop | 1280px | slightly small | readable |
| Laptop | 1024px | too small for details | readable |
| Tablet | 768px | hard to read | acceptable |

**Conclusion:** `text-sm` (14px) should be the minimum for any content the user needs to read. `text-xs` (12px) is acceptable only for badges, dots, and code blocks.

---

*See 06-Platform-Invariants-For-Testers.md and 07-Advanced-Testing-Guide.md for functional test rules.*
