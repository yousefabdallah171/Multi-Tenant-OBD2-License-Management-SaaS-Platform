# RTL · Arabic Translation · Mobile Responsive — Full Testing Plan
# Covers ALL roles × ALL pages × ALL shared components

> **This plan is MANDATORY alongside all 4 role plans and the master plan.**
> It is NOT a bolt-on afterthought — run these checks per-page, per-sprint.
>
> **Scope:** Arabic (RTL) layout, Arabic translation completeness,
> and mobile-responsive layout for every single page in the system.
>
> **Tools:** Playwright MCP + browser DevTools (viewport resize + RTL inspection)
>
> **Known RTL bugs found during initial code audit:**
> - `SecurityLocks.tsx` line 78/127/172: hardcoded `text-left` → breaks in RTL
> - `ProgramLogs.tsx` line 428: hardcoded `text-left` → breaks in RTL
> - `Login.tsx` line 119: `ml-2` (not `ms-2`) → pushes icon wrong side in RTL
> - `PieChartWidget.tsx` line 111: hardcoded `text-right` → wrong in LTR
> - `manager-parent/CustomerDetail.tsx` lines 160/183: hardcoded `text-right`
> - `manager-parent/Dashboard.tsx` line 193: hardcoded `text-right`
> - `reseller/Reports.tsx` line 124: hardcoded `text-right`
>
> **RTL implementation:** `useLanguage` sets `document.documentElement.dir = 'rtl'`
> when `lang === 'ar'`. Tailwind uses `me-/ms-/pe-/ps-` for logical margins/padding.
>
> **All 3 tests (RTL layout, Arabic text, Mobile) must be run for EVERY page below.**

---

## How to Use This Plan

### For each page below, run these 3 checks:

#### CHECK A — RTL Layout (AR mode)
Switch to Arabic (`/ar/...` URL), then verify:
1. Text flows **right-to-left** on the page
2. Sidebar is on the **right side**
3. Table columns are **mirrored** (last column in LTR = first column in RTL)
4. Icons appear on the **correct side** of buttons (start-side of text, not end)
5. Dropdowns open to the **correct side** (toward center, not off-screen)
6. Form labels align **right**
7. Cards, stats grids flow **right-to-left**
8. Pagination arrows are **flipped** (← becomes →)
9. Back buttons point **left** in LTR, **right** in RTL
10. Charts render without overlapping Arabic labels

#### CHECK B — Arabic Translation (AR mode)
Switch to Arabic, then verify:
1. **Page title/header** is in Arabic
2. **All button labels** are in Arabic (not English keys)
3. **Table column headers** are in Arabic
4. **Form labels and placeholders** are in Arabic
5. **Status badges** show Arabic text (e.g., "نشط" not "active")
6. **Toast notifications** appear in Arabic
7. **Error messages** appear in Arabic
8. **Empty states** show Arabic message
9. **Dialog titles + buttons** are in Arabic
10. **No raw translation keys** visible (e.g., `reseller.pages.customers.title`)

#### CHECK C — Mobile Responsive (375px viewport)
Switch DevTools to iPhone SE (375×667px), then verify:
1. **Sidebar collapses** to hamburger menu
2. **Hamburger opens** a usable slide-out drawer
3. **Tables scroll horizontally** (not cut off)
4. **Filter cards** stack vertically (not overflow)
5. **Stats cards** stack in single column
6. **Dialogs** fit within viewport (not wider than screen)
7. **Forms** are usable (inputs not too small, no horizontal overflow)
8. **Charts** resize and don't overflow container
9. **Date pickers** open within viewport
10. **Action buttons** (⋮ menus) are tappable (min 44×44px touch target)

---

## Playwright Commands for This Plan

```javascript
// Switch to Arabic
mcp_playwright_navigate({ url: "http://localhost:3000/ar/reseller/customers" })

// Check dir attribute is rtl
mcp_playwright_evaluate({ script: "document.documentElement.dir" })
// Expected: "rtl"

// Check a specific element's text direction
mcp_playwright_evaluate({ script: "getComputedStyle(document.querySelector('h1')).direction" })

// Check sidebar position in RTL
mcp_playwright_evaluate({
  script: "document.querySelector('[data-sidebar]').getBoundingClientRect().left"
})
// In RTL: sidebar should be at the RIGHT (large x value), not left (near 0)

// Set mobile viewport
mcp_playwright_evaluate({
  script: `
    Object.defineProperty(window.screen, 'width', { value: 375 });
    Object.defineProperty(window.screen, 'height', { value: 667 });
  `
})
// Better: use Playwright's viewport setting
mcp_playwright_navigate({ url: "...", viewport: { width: 375, height: 667 } })

// Screenshot for visual review
mcp_playwright_screenshot({})

// Check if hamburger menu is visible (mobile)
mcp_playwright_evaluate({
  script: "!!document.querySelector('[data-hamburger], [aria-label*=menu]')"
})

// Check table horizontal scroll
mcp_playwright_evaluate({
  script: "document.querySelector('table')?.parentElement?.scrollWidth > document.querySelector('table')?.parentElement?.clientWidth"
})

// Check for raw translation keys (text containing dots like "reseller.pages.x")
mcp_playwright_evaluate({
  script: "Array.from(document.querySelectorAll('*')).filter(el => /^[a-z]+\.[a-z]+\.[a-z]/.test(el.textContent?.trim() ?? '')).map(el => el.textContent?.trim()).slice(0,5)"
})
```

---

## SECTION 1 — Shared Layout (All Roles)

### RTL-1: Sidebar

| Check | AR Expected | Fix if failing |
|-------|-------------|---------------|
| Sidebar position | Right side of screen | `useLanguage` sets `dir=rtl`; sidebar uses `right-0` in RTL |
| Active link indicator | Left border → Right border in RTL | Check sidebar `border-s-4` (logical) vs `border-l-4` |
| Sidebar text | Arabic labels | Check `ar.json` nav translation keys |
| Collapse button direction | Arrow flips | Check `isRtl ? ArrowRight : ArrowLeft` |

- [ ] Open each role's dashboard in AR → sidebar is on RIGHT side
- [ ] Active link has border on LEFT (inner) side, not right outer side
- [ ] All nav labels in Arabic
- [ ] **Fix hardcoded:** Check `Sidebar.tsx` for any `left-0`, `ml-`, `pl-` that should be logical

---

### RTL-2: Navbar (All Roles)

- [ ] Logo/title on RIGHT in AR, LEFT in EN
- [ ] User menu on LEFT in AR, RIGHT in EN
- [ ] Language toggle (AR/EN) on correct side
- [ ] Online count badge direction correct
- [ ] Dark mode toggle on correct side
- [ ] **Fix:** `ml-2` in `Login.tsx:119` → change to `ms-2` for RTL safety

---

### RTL-3: Page Header (`PageHeader` component)

- [ ] Title and description text align RIGHT in AR
- [ ] Action buttons (Add, Export, etc.) on LEFT in AR
- [ ] Eyebrow label (role name) aligns RIGHT in AR
- [ ] **Fix:** Check `PageHeader` uses `text-start` not `text-left`

---

### RTL-4: Toast Notifications (Sonner)

- [ ] In AR mode: toast appears at **top-left** (since RTL start = right, but convention for AR is top-left)
- [ ] Toast text is right-aligned in AR
- [ ] **Fix:** Check Sonner `Toaster` component has `dir="auto"` or position set for RTL

---

### MOB-1: Global Mobile Layout

- [ ] **All roles:** Open DevTools 375px → sidebar collapses, hamburger appears
- [ ] Hamburger click → slide-out drawer opens covering 80% of screen
- [ ] Drawer has close button
- [ ] Background dimmed when drawer open
- [ ] **Fix:** Hamburger missing → check mobile breakpoint for sidebar collapse

---

## SECTION 2 — Authentication Pages

### Page: Login (`/en/login`)

#### RTL Checks:
- [ ] Navigate to `/ar/login` → form is RTL
- [ ] Username/password labels align RIGHT
- [ ] Input text typed RIGHT-to-LEFT
- [ ] Login button full width
- [ ] **Bug to fix:** `Login.tsx:119` has `ml-2` → change to `ms-2` (logical margin)
- [ ] Dark mode toggle label on correct side in RTL

#### Arabic Translation Checks:
- [ ] "Username" → "اسم المستخدم"
- [ ] "Password" → "كلمة المرور"
- [ ] "Login" button → "تسجيل الدخول"
- [ ] Error message (wrong password) → Arabic
- [ ] Account locked error → Arabic

#### Mobile Checks:
- [ ] Form centered, no horizontal overflow
- [ ] Inputs full width (no cutoff)
- [ ] Dark mode + language toggle accessible on mobile
- [ ] **Fix:** Any `min-w-` on form wider than 375px → remove or use `max-w-full`

---

## SECTION 3 — Reseller Dashboard Pages

### Page: Dashboard (`/ar/reseller/dashboard`)

#### RTL:
- [ ] Stats cards flow right-to-left (4 cards in RTL grid order)
- [ ] Chart month labels: `يناير, فبراير, مارس` (not Jan, Feb, Mar)
- [ ] Revenue chart Y-axis labels on LEFT (RTL charts mirror axis)
- [ ] Recent activity feed: action icon on LEFT, text on RIGHT in RTL
- [ ] Action arrows: `ArrowLeft` used in RTL (isRtl check in Dashboard component) → **verify this is correct**
- [ ] **Bug to fix:** `reseller/Dashboard.tsx` uses `isRtl ? ArrowLeft : ArrowRight` — verify arrow direction is logical (in RTL, "forward" = ArrowLeft)

#### Arabic:
- [ ] "Total Customers" → "إجمالي العملاء"
- [ ] "Active Licenses" → "التراخيص النشطة"
- [ ] Chart tooltips show Arabic labels
- [ ] Recent activity action labels in Arabic

#### Mobile (375px):
- [ ] Stats cards: 2-column grid → single column on mobile
- [ ] Charts fit within 375px width (no horizontal scroll needed)
- [ ] Recent activity list readable without overflow
- [ ] **Fix:** Charts → verify `ResponsiveContainer width="100%"`

---

### Page: Customers (`/ar/reseller/customers`)

#### RTL:
- [ ] Table columns mirrored: Actions column on LEFT in RTL
- [ ] Search input text direction: RTL
- [ ] Status filter cards: flow RTL (All → Active → Scheduled... from right to left)
- [ ] ⋮ dropdown menu opens to LEFT in RTL (not off-screen right)
- [ ] Pagination: Previous/Next arrows flipped
- [ ] StatusBadge text right-aligned in RTL cells

#### Arabic:
- [ ] Column headers: "الاسم", "المستخدم/BIOS", "الحالة", "الترخيص", "الإجراءات"
- [ ] Status badges: "نشط", "منتهي", "ملغي", "معلق", "مجدول"
- [ ] Filter card labels: "الكل", "نشط", "مجدول", "منتهي"
- [ ] Action menu items: "تعديل", "تجديد", "إلغاء التفعيل", "حذف"
- [ ] Search placeholder: "بحث..."
- [ ] **No raw keys** like `reseller.pages.customers.status` visible

#### Mobile:
- [ ] Status filter cards scroll horizontally on mobile (5 cards)
- [ ] Table has horizontal scroll wrapper
- [ ] ⋮ menu opens above table row (not off-screen below)
- [ ] Add Customer button full width or icon-only on mobile
- [ ] **Fix:** Filter cards overflow → verify `overflow-x-auto` on filter row

---

### Page: Customer Detail (`/ar/reseller/customers/:id`)

#### RTL:
- [ ] Back button arrow points RIGHT (→) in RTL (going "back" = forward direction in RTL)
- [ ] License details card: labels RIGHT, values LEFT
- [ ] BIOS change request dialog: form labels RIGHT-aligned

#### Arabic:
- [ ] "Back" button → "رجوع"
- [ ] License status, dates all in Arabic
- [ ] Dialog labels: "BIOS الجديد", "السبب"
- [ ] Submit button: "إرسال الطلب"

#### Mobile:
- [ ] License details card fits 375px
- [ ] BIOS change request dialog scrollable
- [ ] **Fix:** Dialog wider than viewport → check `max-w-[95vw]` on mobile

---

### Page: Activations (`/ar/reseller/activations`)

#### RTL:
- [ ] Date range picker opens RTL
- [ ] Table columns mirrored

#### Arabic:
- [ ] "From" → "من", "To" → "إلى" on date range picker
- [ ] Status badges in Arabic

#### Mobile:
- [ ] Date range picker is usable on 375px
- [ ] Table scrolls horizontally

---

### Page: Software (`/ar/reseller/software`)

#### RTL:
- [ ] Program cards flow RTL (right-to-left grid)
- [ ] "Activate" button on correct side of card

#### Arabic:
- [ ] Program card: description and labels in Arabic if translated
- [ ] "Activate" → "تفعيل"

#### Mobile:
- [ ] Cards stack to 1 column on 375px
- [ ] Activate button is full width and tappable

---

### Page: Activate License (`/ar/reseller/software/:id/activate`)

#### RTL:
- [ ] Form labels RIGHT-aligned
- [ ] Duration input + unit selector in correct order
- [ ] Schedule section labels RIGHT
- [ ] Timezone dropdown opens correctly

#### Arabic:
- [ ] "Customer Name" → "اسم العميل"
- [ ] "BIOS ID" → (technical, keep or translate)
- [ ] "Duration" → "المدة"
- [ ] "Days/Hours/Minutes" → "أيام/ساعات/دقائق"
- [ ] "Schedule" → "جدولة"
- [ ] Validation errors in Arabic

#### Mobile:
- [ ] Duration value + unit selector on same row without overflow
- [ ] Date/time picker usable at 375px
- [ ] Submit button full width at bottom

---

### Page: Reports (`/ar/reseller/reports`)

#### RTL:
- [ ] Preset filter cards flow RTL
- [ ] **Bug to fix:** `reseller/Reports.tsx:124` has hardcoded `text-right` → should be `text-end` for RTL safety
- [ ] Charts have RTL-aware axis labels

#### Arabic:
- [ ] "Last 7 Days" → "آخر 7 أيام"
- [ ] "Last 30 Days" → "آخر 30 يومًا"
- [ ] Chart month labels in Arabic

#### Mobile:
- [ ] Preset cards scrollable on mobile
- [ ] Both charts fit 375px width
- [ ] Export button accessible

---

### Page: Payment Status (`/ar/reseller/payment-status`)

#### RTL:
- [ ] Summary stat cards flow RTL
- [ ] Payment table columns mirrored

#### Arabic:
- [ ] "Total Sales" → "إجمالي المبيعات"
- [ ] Payment method values translated

#### Mobile:
- [ ] 4 stat cards → 2×2 or single column on mobile
- [ ] Payment table horizontally scrollable

---

### Page: Activity (`/ar/reseller/activity`)

#### RTL:
- [ ] Action filter dropdown RTL
- [ ] Activity entries: icon LEFT, text RIGHT in RTL

#### Arabic:
- [ ] Action filter options in Arabic
- [ ] Activity description text in Arabic

#### Mobile:
- [ ] Activity cards readable on 375px

---

### Page: Profile (`/ar/reseller/profile`)

#### RTL:
- [ ] Form fields RIGHT-aligned
- [ ] Password change fields RTL

#### Arabic:
- [ ] All label text in Arabic
- [ ] Timezone dropdown searchable in Arabic

#### Mobile:
- [ ] Form sections stack correctly
- [ ] Save buttons full width

---

## SECTION 4 — Manager Dashboard Pages

### Page: Dashboard (`/ar/manager/dashboard`)

#### RTL:
- [ ] `manager/Dashboard.tsx` action buttons: ArrowLeft/Right respects `isRtl` — verify
- [ ] Stats cards RTL order
- [ ] Chart axes mirrored

#### Arabic + Mobile: (same pattern as reseller, verify all labels)

---

### Page: Customers (`/ar/manager/customers`)

#### RTL:
- [ ] Manager-specific columns (Reseller column) in correct RTL position
- [ ] All dropdown menus open toward center

#### Arabic:
- [ ] "Reseller" column header → "المورد"
- [ ] All inline form labels in activation dialog → Arabic

#### Mobile:
- [ ] Activation dialog scrollable (it has many fields)
- [ ] Multi-step form usable at 375px

---

### Page: Team (`/ar/manager/team`)

#### RTL:
- [ ] Team table columns mirrored
- [ ] Password show/hide icon on correct side

#### Arabic:
- [ ] "Add Reseller" → "إضافة مورد"
- [ ] Form labels in create/edit dialog → Arabic

#### Mobile:
- [ ] Create reseller dialog fits 375px
- [ ] Password toggle button tappable

---

### Page: BIOS Change Requests (`/ar/manager/bios-change-requests`)

#### RTL:
- [ ] Reject dialog: notes textarea RTL
- [ ] Status filter tabs RTL order

#### Arabic:
- [ ] "Approve" → "قبول", "Reject" → "رفض"
- [ ] Status: "معلق", "مقبول", "مرفوض"
- [ ] Notes label in Arabic

#### Mobile:
- [ ] Approve/reject buttons tappable on mobile
- [ ] Reject dialog with textarea fits 375px

---

### Page: Software Management (`/ar/manager/software-management`)

#### RTL:
- [ ] Program cards RTL layout
- [ ] Edit form: API key field visibility toggle on correct side

#### Arabic:
- [ ] "Add Program" → "إضافة برنامج"
- [ ] Program status badges: "نشط", "غير نشط"
- [ ] Form field labels in Arabic

#### Mobile:
- [ ] Program cards → 1-column stack
- [ ] Full program form scrollable at 375px

---

### Page: BIOS Details (`/ar/manager/bios-details`)

#### RTL:
- [ ] Search input: RTL text entry
- [ ] Recent BIOS list: RTL layout
- [ ] Tabs (Overview/Licenses/Resellers): correct RTL order

#### Arabic:
- [ ] Tab labels in Arabic
- [ ] BIOS overview fields in Arabic

#### Mobile:
- [ ] Tab navigation scrollable on mobile
- [ ] BIOS details cards fit 375px

---

### Page: Reports (`/ar/manager/reports`)

#### RTL:
- [ ] Revenue chart RTL axes
- [ ] Reseller breakdown table mirrored

#### Arabic:
- [ ] All chart labels in Arabic
- [ ] Export button label in Arabic

#### Mobile:
- [ ] Both charts fit 375px
- [ ] Reseller breakdown table scrollable

---

### Page: Activity (`/ar/manager/activity`)

#### RTL:
- [ ] Team member dropdown RTL
- [ ] Action type dropdown RTL
- [ ] Date range picker RTL

#### Arabic:
- [ ] Team member names in Arabic (if applicable)
- [ ] Action type options in Arabic
- [ ] "Clear Dates" → "مسح التواريخ"
- [ ] "Export" → "تصدير"

#### Mobile:
- [ ] All 3 filter controls stack vertically
- [ ] Export button accessible

---

### Page: Reseller Logs (`/ar/manager/reseller-logs`)

#### RTL:
- [ ] Role badges in correct RTL position in table
- [ ] Seller dropdown RTL

#### Arabic:
- [ ] Action filter options: "تفعيل", "تجديد", "إلغاء", "حذف"
- [ ] Role badge text in Arabic

#### Mobile:
- [ ] Status filter cards scroll horizontally
- [ ] Table scrolls horizontally

---

### Pages: Reseller Payments + Detail (`/ar/manager/reseller-payments`)

#### RTL:
- [ ] Payment summary stats RTL
- [ ] Commission table mirrored
- [ ] Record payment dialog labels RIGHT-aligned

#### Arabic:
- [ ] Payment method: "نقدًا", "بنك", "آخر"
- [ ] "Record Payment" → "تسجيل دفعة"
- [ ] Currency amounts formatted in `ar-EG` locale

#### Mobile:
- [ ] Payment history table scrolls horizontally
- [ ] Record payment dialog fits 375px

---

## SECTION 5 — Manager-Parent Dashboard Pages

### Page: Dashboard (`/ar/dashboard`)

#### RTL:
- [ ] `manager-parent/Dashboard.tsx:193` has hardcoded `text-right` → **Bug: fix to `text-end`**
- [ ] Team performance ranking: RTL layout
- [ ] Forecast charts: RTL axis labels

#### Arabic + Mobile: standard checks above

---

### Page: Customers (`/ar/customers`)

#### RTL:
- [ ] Manager column (unique to manager-parent) in correct RTL table position
- [ ] Manager filter dropdown RTL

#### Arabic:
- [ ] "Manager" column header → "المدير"
- [ ] Manager filter options in Arabic

#### Mobile:
- [ ] Manager filter + status filter + search all accessible on 375px

---

### Page: BIOS Blacklist (`/ar/bios-blacklist`)

#### RTL:
- [ ] Table columns mirrored
- [ ] Add form labels RIGHT-aligned

#### Arabic:
- [ ] "Add to Blacklist" → "إضافة إلى القائمة السوداء"
- [ ] "Reason" → "السبب"
- [ ] "Remove" → "إزالة"

#### Mobile:
- [ ] Add form fits 375px
- [ ] Table scrolls horizontally

---

### Page: BIOS Conflicts (`/ar/bios-conflicts`)

#### RTL:
- [ ] Conflict type filter RTL
- [ ] Conflict detail modal RTL

#### Arabic:
- [ ] "Resolved" → "محلول", "Unresolved" → "غير محلول"
- [ ] Conflict detail in Arabic

#### Mobile:
- [ ] Conflict modal fits 375px
- [ ] Filters accessible

---

### Page: IP Analytics (`/ar/ip-analytics`)

#### RTL:
- [ ] **Bug to fix:** `PieChartWidget.tsx:111` has hardcoded `text-right` → breaks in LTR and incorrect in RTL
- [ ] Pie chart legend RTL layout
- [ ] Filter dropdowns RTL

#### Arabic:
- [ ] Country filter options in Arabic
- [ ] "Safe" → "آمن", "Proxy" → "وكيل", "Hosting" → "استضافة"
- [ ] Pie chart legend labels in Arabic

#### Mobile:
- [ ] Pie chart fits 375px
- [ ] IP log table scrolls horizontally

---

### Page: Financial Reports (`/ar/reports`)

#### RTL:
- [ ] Manager breakdown table mirrored
- [ ] Export buttons on correct side

#### Arabic:
- [ ] All chart labels + legends in Arabic
- [ ] Manager names in table

#### Mobile:
- [ ] Revenue + retention charts fit 375px
- [ ] Manager breakdown table scrollable
- [ ] Export buttons accessible

---

### Page: Program Logs (`/ar/program-logs`)

#### RTL:
- [ ] **Bug to fix:** `ProgramLogs.tsx:428` has hardcoded `text-left` on `<tr>` → **Must change to `text-start`**
- [ ] Tabs (Summary/Users): RTL order
- [ ] IP location cell: flag + country RTL layout

#### Arabic:
- [ ] Tab labels in Arabic
- [ ] Program filter in Arabic
- [ ] Action type filter options in Arabic
- [ ] "Export" → "تصدير"

#### Mobile:
- [ ] Summary + Users tabs scrollable
- [ ] Export button accessible
- [ ] Users table scrolls horizontally

---

### Page: Settings (`/ar/settings`)

#### RTL:
- [ ] All form sections RIGHT-aligned
- [ ] Color picker widget RTL
- [ ] Notification toggles RTL

#### Arabic:
- [ ] "Company Name" → "اسم الشركة"
- [ ] "Trial Days" → "أيام التجربة"
- [ ] "Save" → "حفظ"
- [ ] Toggle labels in Arabic

#### Mobile:
- [ ] All settings sections stack and fit 375px
- [ ] Color picker usable on mobile

---

## SECTION 6 — Super Admin Dashboard Pages

### Page: Dashboard (`/ar/super-admin/dashboard`)

#### RTL:
- [ ] Tenant comparison chart: tenant labels RTL
- [ ] Recent activity: all entries RTL

#### Arabic:
- [ ] "Total Tenants" → "إجمالي المستأجرين"
- [ ] All chart axis labels in Arabic

#### Mobile:
- [ ] Multiple charts fit 375px
- [ ] Stats cards 2-col or single-col on mobile

---

### Page: Tenants (`/ar/super-admin/tenants`)

#### RTL:
- [ ] Table columns mirrored (Actions on LEFT in RTL)
- [ ] Reset dialog: confirmation input RTL text entry
- [ ] Backup list dialog: RTL layout
- [ ] Status filter cards RTL order

#### Arabic:
- [ ] "Add Tenant" → "إضافة مستأجر"
- [ ] Status: "نشط", "غير نشط", "معطل"
- [ ] "Reset Tenant" → "إعادة تعيين المستأجر"
- [ ] Reset confirmation dialog warning text in Arabic
- [ ] "Type [name] to confirm" → Arabic instruction
- [ ] "Backup Label" → "تسمية النسخة الاحتياطية"
- [ ] Backup list: date/time + stats in Arabic
- [ ] "Restore Backup" → "استعادة النسخة الاحتياطية"

#### Mobile:
- [ ] Reset dialog confirmation form fits 375px
- [ ] Backup list scrollable at 375px
- [ ] Restore confirmation dialog fits viewport
- [ ] Tenant stats table scrolls horizontally

---

### Page: Users (`/ar/super-admin/users`)

#### RTL:
- [ ] All 4 filter dropdowns (role, tenant, status, search) RTL
- [ ] Table columns mirrored
- [ ] Last Seen column: Arabic date format

#### Arabic:
- [ ] Role filter options: "مدير عام", "مدير رئيسي", "مدير", "موزع", "عميل"
- [ ] Status filter: "نشط", "موقوف", "غير نشط"
- [ ] "Last seen" dates in Arabic locale

#### Mobile:
- [ ] 4 filter controls stack vertically
- [ ] Table scrolls horizontally

---

### Page: User Detail (`/ar/super-admin/users/:id`)

#### RTL:
- [ ] Edit dialog: all fields RTL
- [ ] Role + tenant dropdown RTL

#### Arabic:
- [ ] "Change Role" → "تغيير الدور"
- [ ] "Change Tenant" → "تغيير المستأجر"
- [ ] Role options in Arabic
- [ ] Status options in Arabic

#### Mobile:
- [ ] Edit form fits 375px
- [ ] Role/tenant dropdowns usable on mobile

---

### Page: Admin Management (`/ar/super-admin/admin-management`)

#### RTL:
- [ ] Create form RTL
- [ ] Bulk select checkboxes on correct side in RTL

#### Arabic:
- [ ] "Create Admin" → "إنشاء مسؤول"
- [ ] Role options in Arabic
- [ ] "Reset Password" → "إعادة تعيين كلمة المرور"
- [ ] "Bulk Delete" → "حذف جماعي"

#### Mobile:
- [ ] Create admin dialog fits 375px
- [ ] Checkboxes tappable (44px touch target)

---

### Page: Security Locks (`/ar/super-admin/security-locks`)

#### RTL:
- [ ] **Bug to fix:** `SecurityLocks.tsx` lines 78, 127, 172 have hardcoded `text-left` on `<tr>` → **Must change to `text-start`**
- [ ] Tabs (Locked Accounts/Blocked IPs/Audit Log): RTL order
- [ ] Unblock buttons on correct side

#### Arabic:
- [ ] Tab labels: "الحسابات المقفلة", "IPs المحظورة", "سجل التدقيق"
- [ ] "Unblock" → "رفع الحظر"
- [ ] Lock reason in Arabic (if system-generated message is translatable)
- [ ] Audit log action types in Arabic

#### Mobile:
- [ ] Tabs scrollable on mobile
- [ ] Unblock buttons tappable
- [ ] Audit log table scrolls horizontally

---

### Page: Logs (`/ar/super-admin/logs`)

#### RTL:
- [ ] Filter bar (method, status, tenant, search) RTL layout
- [ ] Log table columns mirrored
- [ ] Auto-refresh toggle RTL

#### Arabic:
- [ ] Method filter: "GET", "POST", "PUT", "DELETE" (keep technical, no translation needed)
- [ ] Status filter labels: "نجاح (2xx)", "خطأ (4xx)", "خطأ خادم (5xx)"
- [ ] "Auto Refresh" toggle → "تحديث تلقائي"
- [ ] Tenant filter in Arabic

#### Mobile:
- [ ] Filter bar wraps correctly on 375px
- [ ] Log table scrolls horizontally
- [ ] Auto-refresh toggle accessible

---

### Page: API Status (`/ar/super-admin/api-status`)

#### RTL:
- [ ] Program cards RTL layout
- [ ] Status badge + uptime % on correct side

#### Arabic:
- [ ] Status: "متصل", "غير متصل", "متدهور", "غير معروف"
- [ ] "Ping" → "فحص"
- [ ] "Not Configured" → "غير مُعد"
- [ ] "Uptime 24h" → "وقت التشغيل 24 ساعة"

#### Mobile:
- [ ] Program API status cards fit 375px
- [ ] Ping button tappable

---

### Page: Settings (`/ar/super-admin/settings`)

#### RTL:
- [ ] Server timezone dropdown RTL
- [ ] Email config form RTL

#### Arabic:
- [ ] "Server Timezone" → "المنطقة الزمنية للخادم"
- [ ] "Email Configuration" → "إعداد البريد الإلكتروني"
- [ ] "Save" → "حفظ"
- [ ] All form labels in Arabic

#### Mobile:
- [ ] All form sections fit 375px
- [ ] Timezone dropdown usable on mobile

---

### Page: Reports (`/ar/super-admin/reports`)

#### RTL:
- [ ] Top resellers table mirrored
- [ ] Revenue + growth charts RTL axes

#### Arabic:
- [ ] "Top Resellers" → "أفضل الموزعين"
- [ ] Table columns in Arabic
- [ ] All chart labels in Arabic
- [ ] "Export" → "تصدير"

#### Mobile:
- [ ] All charts fit 375px
- [ ] Top resellers table scrollable
- [ ] Export button accessible

---

## SECTION 7 — Shared Component RTL/AR/Mobile Details

### SC-RTL-1: DataTable in RTL

| Element | RTL Expected | Fix |
|---------|-------------|-----|
| Column order | Mirrored (last→first) | `dir="rtl"` propagates via HTML root |
| Sort arrows | On start side of header | Check `me-2` not `mr-2` on sort icon |
| Pagination arrows | ← and → flipped | Check `isRtl ? ArrowRight : ArrowLeft` |
| Action cell | On LEFT in RTL | Table direction inherits from parent `dir` |
| Checkboxes (if any) | On RIGHT side in RTL | `logical` margins: `me-` not `mr-` |

- [ ] Verify in ALL role customer tables in AR mode
- [ ] **Fix:** Any `mr-` inside DataTable column defs → change to `me-`

---

### SC-RTL-2: ConfirmDialog in RTL

- [ ] Dialog text RIGHT-aligned in AR
- [ ] Buttons: Cancel on RIGHT, Confirm on LEFT in RTL (logical order)
- [ ] **Fix:** Hardcoded `flex-row` button order → check `flex-row-reverse` not needed if `dir=rtl` handles it

---

### SC-RTL-3: DateRangePicker in RTL

- [ ] Calendar opens on correct side (toward screen center)
- [ ] Day numbers RIGHT-to-LEFT flow
- [ ] Month/year navigation arrows flipped
- [ ] "From" label on RIGHT in RTL
- [ ] **Fix:** Calendar positioning → check `popover` anchor in RTL

---

### SC-RTL-4: StatsCard in RTL

- [ ] Icon on RIGHT (start side) in RTL
- [ ] Value LEFT (end side) in RTL
- [ ] Trend indicator (↑↓) on correct side
- [ ] **Fix:** `flex` layout → ensure uses logical properties or `dir` propagation

---

### SC-RTL-5: Charts in RTL (All Chart Widgets)

- [ ] `LineChartWidget`: Y-axis on RIGHT in RTL (mirrored), month labels RTL
- [ ] `BarChartWidget`: bars flow right-to-left
- [ ] `PieChartWidget`: **Bug fix needed** — `line 111: text-right` → change to `text-end`
- [ ] `TenantComparisonChart`: tenant names RTL
- [ ] All tooltips: text RIGHT-aligned in AR
- [ ] All legend labels in Arabic (when `locale = 'ar-EG'`)

---

### SC-RTL-6: ProfileWorkspace in RTL

- [ ] All form sections RIGHT-aligned in AR
- [ ] Password show/hide toggle icon on correct side
- [ ] Timezone picker text direction RTL
- [ ] Save/Cancel buttons: Save on LEFT (primary action at end in RTL)

---

### SC-MOB-1: DataTable on Mobile (375px)

- [ ] Horizontal scroll wrapper active (no content clipped)
- [ ] Header row sticky still works within scroll container
- [ ] ⋮ dropdown doesn't overflow off-screen
- [ ] Pagination controls fit on one line or wrap cleanly

---

### SC-MOB-2: All Dialogs on Mobile (375px)

- [ ] Max width: `max-w-[95vw]` or similar on mobile
- [ ] Long forms inside dialogs are scrollable (`overflow-y-auto max-h-[80vh]`)
- [ ] Submit/Cancel buttons always visible (not hidden below fold without scroll)
- [ ] Keyboard doesn't cover important content (iOS/Android virtual keyboard)

---

### SC-MOB-3: All Charts on Mobile (375px)

- [ ] `ResponsiveContainer` uses `width="100%"`
- [ ] X-axis labels: rotated or abbreviated on mobile (not overlapping)
- [ ] Tooltip accessible on tap (not just hover)
- [ ] Legend doesn't overflow container

---

## SECTION 8 — Known Bugs to Fix Before Production

These RTL/mobile bugs were found during the code audit of this codebase:

### BUG-1: SecurityLocks.tsx — Hardcoded `text-left` on table rows
**File:** `frontend/src/pages/super-admin/SecurityLocks.tsx`
**Lines:** 78, 127, 172
**Current:** `<tr className="... text-left ...">`
**Fix:** Change `text-left` → `text-start` (logical property, respects RTL)
- [x] Fix applied
- [x] Verified in AR mode: table rows now align correctly

### BUG-2: ProgramLogs.tsx — Hardcoded `text-left` on table row
**File:** `frontend/src/pages/manager-parent/ProgramLogs.tsx`
**Line:** 428
**Current:** `<tr className="... text-left ...">`
**Fix:** Change `text-left` → `text-start`
- [x] Fix applied
- [x] Verified in AR mode

### BUG-3: Login.tsx — `ml-2` (non-logical margin)
**File:** `frontend/src/pages/auth/Login.tsx`
**Line:** 119
**Current:** `<span className="ml-2">`
**Fix:** Change `ml-2` → `ms-2` (logical: "margin-start")
- [x] Fix applied
- [x] In AR mode: icon appears on correct side of label

### BUG-4: PieChartWidget.tsx — Hardcoded `text-right`
**File:** `frontend/src/components/charts/PieChartWidget.tsx`
**Line:** 111
**Current:** `<div className="text-right text-slate-500...">`
**Fix:** Change `text-right` → `text-end`
- [x] Fix applied
- [x] In LTR mode: value now aligns correctly (was wrongly right-aligned)

### BUG-5: manager-parent/CustomerDetail.tsx — Hardcoded `text-right`
**File:** `frontend/src/pages/manager-parent/CustomerDetail.tsx`
**Lines:** 160, 183
**Current:** `<div className="text-right">`
**Fix:** Change `text-right` → `text-end`
- [x] Fix applied

### BUG-6: manager-parent/Dashboard.tsx — Hardcoded `text-right`
**File:** `frontend/src/pages/manager-parent/Dashboard.tsx`
**Line:** 193
**Current:** `<div className="text-right">`
**Fix:** Change `text-right` → `text-end`
- [x] Fix applied

### BUG-7: reseller/Reports.tsx — Hardcoded `text-right`
**File:** `frontend/src/pages/reseller/Reports.tsx`
**Line:** 124
**Current:** `<div className="text-right text-lg font-semibold...">`
**Fix:** Change `text-right` → `text-end`
- [x] Fix applied

### Section 8 Execution Result (2026-03-16)

- [x] All 7 hardcoded directional bugs were fixed in code and rebuilt successfully with `npm run build`
- [x] Re-verified in browser on the affected Arabic routes:
  - `/ar/login`
  - `/ar/dashboard`
  - `/ar/customers/61`
  - `/ar/program-logs`
  - `/ar/reseller/dashboard`
  - `/ar/reseller/reports`
- [x] Representative after-fix screenshots captured:
  - `rtl-section8-manager-parent-dashboard-after-desktop.png`
  - `rtl-section8-manager-parent-customer-detail-after.png` (browser snapshot verification)
  - `rtl-section8-manager-parent-program-logs-after.png` (browser snapshot verification)
  - `rtl-section8-reseller-dashboard-after.png` (browser snapshot verification)
  - `rtl-section8-reseller-reports-after.png` (browser snapshot verification)
  - `rtl-section8-login-after.png` (browser snapshot verification)
- [x] Before baseline remains the earlier Section 3–7 screenshots already captured during the first RTL sweep

---

## SECTION 9 — Arabic Translation Completeness Checklist

### Critical keys that MUST exist in `ar.json`:

#### Status Values
- [x] `status.active` → "نشط"
- [x] `status.expired` → "منتهي"
- [x] `status.cancelled` → "ملغي"
- [x] `status.pending` → "قيد الانتظار/معلق" appears in Arabic in verified tables
- [x] `status.scheduled` → "مجدول"
- [x] `status.suspended` → "موقوف/معلق" appears in Arabic where used
- [x] `status.inactive` → "غير نشط"
- [x] `status.scheduled_failed` → wired in locale file

#### Role Names
- [x] `roles.super_admin` → "المدير العام/مدير النظام" appears translated in verified UI
- [x] `roles.manager_parent` → "مدير رئيسي"
- [x] `roles.manager` → "مدير"
- [x] `roles.reseller` → "موزع"
- [x] `roles.customer` → "العميل"

#### Common Actions
- [x] `common.save` → "حفظ"
- [x] `common.cancel` → "إلغاء"
- [x] `common.confirm` → "تأكيد"
- [x] `common.delete` → "حذف"
- [x] `common.edit` → "تعديل"
- [x] `common.back` → "رجوع"
- [x] `common.search` → "بحث"
- [x] `common.loading` → "جارٍ التحميل"
- [x] `common.error` → "حدث خطأ"
- [x] `common.success` → "تمّ بنجاح"
- [ ] Activity descriptions are still partially English on dashboards/activity feeds (`Activated...`, `Renewed...`, `Scheduled...`)

#### Tenant Reset (Newly Added Feature)
- [x] Reset dialog title → Arabic in locale + component wiring
- [x] Reset warning text → Arabic in locale + component wiring
- [x] "Type [name] to confirm" → Arabic in locale + component wiring
- [x] "Backup Label" → Arabic key added and wired
- [x] "Reset Tenant" button → Arabic key added and wired
- [x] "Restore Backup" → Arabic key added and wired
- [x] Backup stats labels → Arabic keys added and wired
- [ ] Success/error toasts for reset/restore still include some hardcoded English fallback strings in `Tenants.tsx`

#### Date/Time
- [x] Reseller and manager-parent dashboards now show Arabic month names (`مايو`, `يوليو`, `سبتمبر`, `نوفمبر`, `يناير`, `مارس`)
- [ ] Super-admin dashboard still shows English month labels in chart/status output (`May 2025`, `Jul 2025`, `14 Feb`, `15 Mar`)
- [ ] `localizeMonthLabel()` behavior is still inconsistent across all chart widgets/pages

---

## SECTION 10 — Mobile Testing: Per-Breakpoint Targets

| Breakpoint | Width | Test Device Equivalent |
|------------|-------|------------------------|
| `xs` | 375px | iPhone SE / small Android |
| `sm` | 640px | Large phone / small tablet |
| `md` | 768px | iPad portrait |
| `lg` | 1024px | iPad landscape / small laptop |

### For each breakpoint, verify ALL pages don't have:
- [ ] Horizontal scroll on the PAGE itself (only tables should scroll, not the whole page)
- [ ] Text overflow / truncation breaking layout
- [ ] Buttons / inputs smaller than 44×44px (touch target minimum)
- [ ] Fixed-width elements wider than the viewport
- [ ] Overlapping elements (z-index issues)
- [ ] Dialogs wider than viewport (use `max-w-[95vw]`)
- [ ] Forms with side-by-side fields that should stack on mobile

### Section 10 Execution Result (2026-03-16)

Representative rerun pages:
- `/ar/login`
- `/ar/super-admin/tenants`
- `/ar/dashboard`
- `/ar/customers/61`
- `/ar/reseller/dashboard`

Breakpoint verdict:

| Breakpoint | Result | Notes |
|------------|--------|-------|
| 375px | PASS (representative rerun) | No page-level horizontal overflow on the rerun set; touch-target regressions from theme/language/profile buttons were fixed. Remaining exception: skip-link is still smaller than 44×44, which is acceptable because it is keyboard-first UI. |
| 640px | PASS | No layout overflow on rerun pages. |
| 768px | PASS | Layout stable on rerun pages. |
| 1024px | PASS | Layout stable on rerun pages. |

Remaining mobile caution:
- Data-heavy tables still rely on horizontal scroll by design.
- This rerun focused on the patched/shared surfaces, not a second full sweep of every role page.

---

## Issue Tracker — RTL / Arabic / Mobile

| # | Bug ID | File | Line | Issue | Severity | Fixed |
|---|--------|------|------|-------|----------|-------|
| 1 | BUG-1 | SecurityLocks.tsx | 78,127,172 | `text-left` hardcoded | 🟠 High | ☑ |
| 2 | BUG-2 | ProgramLogs.tsx | 428 | `text-left` hardcoded | 🟠 High | ☑ |
| 3 | BUG-3 | Login.tsx | 119 | `ml-2` / RTL-safe login spacing | 🟡 Medium | ☑ |
| 4 | BUG-4 | PieChartWidget.tsx | 111 | `text-right` hardcoded | 🟡 Medium | ☑ |
| 5 | BUG-5 | CustomerDetail.tsx (MP) | 160,183 | directional alignment hardcoded | 🟡 Medium | ☑ |
| 6 | BUG-6 | Dashboard.tsx (MP) | 193 | directional alignment hardcoded | 🟡 Medium | ☑ |
| 7 | BUG-7 | Reports.tsx (reseller) | 124 | `text-right` hardcoded | 🟡 Medium | ☑ |
| 8 | TR-1 | super-admin Dashboard | charts/activity | English month names and English activity descriptions still visible in Arabic | 🟠 High | ☐ |
| 9 | TR-2 | Tenants.tsx | reset/restore toasts | Some English fallback toast strings remain | 🟡 Medium | ☐ |

---

## Execution Order

```
Phase 1: Fix all 7 known bugs (BUG-1 to BUG-7) before testing
Phase 2: Run Section 1–2 (shared layout + auth pages)
Phase 3: Run Section 3 (reseller — all pages, all 3 checks each)
Phase 4: Run Section 4 (manager — all pages)
Phase 5: Run Section 5 (manager-parent — all pages)
Phase 6: Run Section 6 (super-admin — all pages)
Phase 7: Run Section 7 (shared components deep RTL/mobile)
Phase 8: Run Section 9 (Arabic translation completeness)
Phase 9: Run Section 10 (mobile breakpoint sweep across all pages)
```

---

*Last updated: 2026-03-14*
*RTL + Arabic + Mobile plan — 10 sections, 400+ specific checks*
*Fix BUG-1 through BUG-7 before running any RTL tests*
*Every page × every role × 3 checks (RTL layout + Arabic text + Mobile responsive)*
