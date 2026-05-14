# Per-Page Selector — Move Outside Screen Options + Fix Broken Pagination Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rows-per-page (10/25/50/100) always visible in the DataTable header bar instead of hidden inside the Screen Options dropdown; simultaneously fix three manager-parent sales-customer pages where the Screen Options pagination buttons do nothing and `per_page` is hardcoded at 25.

**Architecture:** `TableScreenOptions` loses its Pagination section entirely — it only manages column visibility. `DataTable` renders an inline per-page pill-button row in its header bar whenever `onPageSizeChange` is provided. The three broken pages are ported to the same pattern the super-admin equivalents already use (they are the reference implementation).

**Tech Stack:** React 19, TypeScript, Tailwind CSS, TanStack Query v5, localStorage preference cache via `useTablePreferences`

---

## Affected files

| File | Change |
|---|---|
| `frontend/src/components/shared/TableScreenOptions.tsx` | Remove Pagination section + `pageSize`/`pageSizeOptions`/`onPageSizeChange` props |
| `frontend/src/components/shared/DataTable.tsx` | Add inline per-page pill buttons in header bar; stop forwarding those 3 props to TableScreenOptions |
| `frontend/src/pages/manager-parent/ManagerParentSalesCustomers.tsx` | Add `perPage` state; wire `pagination`/`onPageChange`/`onPageSizeChange` to DataTable; remove manual prev/next div |
| `frontend/src/pages/manager-parent/ManagerSalesCustomers.tsx` | Same fix |
| `frontend/src/pages/manager-parent/ResellerSalesCustomers.tsx` | Same fix |

> **Reference implementation (already correct — do not change):**
> `frontend/src/pages/super-admin/ManagerParentSalesCustomers.tsx`
> `frontend/src/pages/super-admin/ManagerSalesCustomers.tsx`
> `frontend/src/pages/super-admin/ResellerSalesCustomers.tsx`

---

## Task 1 — Update `TableScreenOptions`: remove Pagination section

**Files:**
- Modify: `frontend/src/components/shared/TableScreenOptions.tsx`

The Pagination section (the divider + heading + 4 buttons grid) is being deleted. The component will only manage column visibility from now on. Three props disappear from its interface.

- [ ] **Step 1: Remove the 3 pagination props from the interface and function signature**

Open `frontend/src/components/shared/TableScreenOptions.tsx`.

Replace the current `TableScreenOptionsProps` interface (lines 8–20) with:

```tsx
interface TableScreenOptionsProps {
  columns: Array<{
    key: string
    label: string
    locked: boolean
    visible: boolean
  }>
  onToggleColumn: (columnKey: string) => void
  isLoading?: boolean
}
```

Replace the function signature (lines 22–29) with:

```tsx
export function TableScreenOptions({
  columns,
  onToggleColumn,
  isLoading = false,
}: TableScreenOptionsProps) {
```

- [ ] **Step 2: Remove the Pagination section from the panel JSX**

Delete lines 140–167 (the entire `{onPageSizeChange ? (<> ... </>) : null}` block):

```tsx
          {onPageSizeChange ? (
            <>
              <div className="my-3 h-px bg-slate-200 dark:bg-slate-800" />
              <div className="space-y-2">
                <p className="dashboard-text-label text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 md:text-base">
                  {t('common.pagination', { defaultValue: 'Pagination' })}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {pageSizeOptions.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      size="sm"
                      variant={pageSize === option ? 'default' : 'outline'}
                      className="h-10 rounded-lg px-3 text-sm md:h-11 md:px-4 md:text-base"
                      onClick={(e) => {
                        e.stopPropagation()
                        onPageSizeChange(option)
                        setIsOpen(false)
                      }}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          ) : null}
```

After deletion the panel JSX ends right after the closing `</div>` of the columns list.

- [ ] **Step 3: Verify the file compiles — look for unused imports**

After the change, `Button` may no longer be used in this file. Check line 6:
```tsx
import { Button } from '@/components/ui/button'
```
If `Button` is no longer referenced, delete that import line.

The final file should look like this (complete):

```tsx
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Columns3, Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface TableScreenOptionsProps {
  columns: Array<{
    key: string
    label: string
    locked: boolean
    visible: boolean
  }>
  onToggleColumn: (columnKey: string) => void
  isLoading?: boolean
}

export function TableScreenOptions({
  columns,
  onToggleColumn,
  isLoading = false,
}: TableScreenOptionsProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLSpanElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const panelId = useId()

  const recalcPosition = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const isRtl = document.documentElement.dir === 'rtl'
    setPanelStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      ...(isRtl ? { left: rect.left } : { right: window.innerWidth - rect.right }),
    })
  }

  const handleToggle = () => {
    if (!isOpen) recalcPosition()
    setIsOpen((prev) => !prev)
  }

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    const handleScroll = () => {
      if (isOpen) recalcPosition()
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [isOpen])

  const panel = isOpen
    ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={t('common.screenOptions', { defaultValue: 'Screen Options' })}
          style={panelStyle}
          className="z-[9999] w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="space-y-1">
            <p className="dashboard-text-label text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 md:text-base">
              {t('common.columns', { defaultValue: 'Columns' })}
            </p>
            <div className="space-y-1">
              {columns.map((column) => (
                <button
                  key={column.key}
                  type="button"
                  disabled={column.locked}
                  aria-pressed={column.visible}
                  aria-label={column.label}
                  className={cn(
                    'dashboard-text-body flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900/60 md:text-base',
                    column.locked && 'cursor-not-allowed opacity-70',
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!column.locked) {
                      onToggleColumn(column.key)
                    }
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Columns3 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{column.label}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={column.visible}
                      readOnly
                      disabled={column.locked}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="pointer-events-none h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-950"
                    />
                    {column.locked ? (
                      <span className="dashboard-text-label text-sm font-semibold uppercase tracking-wide text-slate-400 md:text-base">
                        {t('common.locked', { defaultValue: 'Locked' })}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <span ref={triggerRef} className="relative inline-block">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-haspopup="dialog"
        className={cn(
          'rounded-xl md:text-base',
          isLoading && 'opacity-100',
        )}
        onClick={handleToggle}
      >
        <Settings2 className="me-2 h-4 w-4" />
        {t('common.screenOptions', { defaultValue: 'Screen Options' })}
      </Button>
      {panel}
    </span>
  )
}
```

> **Wait** — `Button` is still used in the trigger button at the bottom. Keep the import. Only the `Button` import in the panel JSX was removed.
> The correct imports are:
> ```tsx
> import { Button } from '@/components/ui/button'
> ```
> Keep it.

---

## Task 2 — Update `DataTable`: add inline per-page selector in header bar

**Files:**
- Modify: `frontend/src/components/shared/DataTable.tsx`

Two changes:
1. The header bar (shown when `tableKey` is set) changes from `justify-end` to `justify-between` and gets an inline per-page selector on the left.
2. The `<TableScreenOptions>` call loses the 3 pagination props.

- [ ] **Step 1: Replace the entire header block in DataTable**

Find the block that starts at line 163:
```tsx
      {tableKey ? (
        <div className="flex justify-end border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <TableScreenOptions
            columns={screenOptionColumns.map((column) => ({
              key: column.key,
              label: column.label,
              locked: lockedColumns.includes(column.key),
              visible: visibleColumnSet.has(column.key),
            }))}
            pageSize={pagination?.perPage ?? null}
            pageSizeOptions={pageSizeOptions}
            onToggleColumn={toggleColumn}
            onPageSizeChange={handlePageSizeChange}
            isLoading={preferencesLoading}
          />
        </div>
      ) : null}
```

Replace it with:

```tsx
      {tableKey ? (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          {onPageSizeChange ? (
            <div className="flex items-center gap-2">
              <span className="dashboard-text-label text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('common.rowsPerPage')}
              </span>
              <div className="flex gap-1">
                {pageSizeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handlePageSizeChange(option)}
                    className={cn(
                      'h-7 min-w-[2rem] rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                      pagination?.perPage === option
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900',
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ) : <div />}
          <TableScreenOptions
            columns={screenOptionColumns.map((column) => ({
              key: column.key,
              label: column.label,
              locked: lockedColumns.includes(column.key),
              visible: visibleColumnSet.has(column.key),
            }))}
            onToggleColumn={toggleColumn}
            isLoading={preferencesLoading}
          />
        </div>
      ) : null}
```

- [ ] **Step 2: Verify `handlePageSizeChange` is still defined above this block**

It should still be at line 91:
```tsx
  const handlePageSizeChange = (nextPageSize: number) => onPageSizeChange?.(nextPageSize)
```

No change needed — keep it.

- [ ] **Step 3: Check TypeScript compiles — run the build**

```bash
cd C:\laragon\www\Multi-Tenant-OBD2-License-Management-SaaS-Platform
npm run build --workspace=frontend
```

Expected: no TypeScript errors. If you see errors about `pageSize`/`pageSizeOptions`/`onPageSizeChange` being passed to `TableScreenOptions`, those are the props you removed in Task 1 — confirm they're gone from the `<TableScreenOptions>` call.

---

## Task 3 — Fix `ManagerParentSalesCustomers.tsx` (manager-parent role)

**Files:**
- Modify: `frontend/src/pages/manager-parent/ManagerParentSalesCustomers.tsx`

**Root cause:** `per_page` is hardcoded at 25, no `perPage` state, no `pagination`/`onPageChange`/`onPageSizeChange` passed to DataTable. Screen Options 10/25/50/100 buttons do nothing.

**Reference:** `frontend/src/pages/super-admin/ManagerParentSalesCustomers.tsx` — already correct, use it as the template.

- [ ] **Step 1: Add `perPage` state**

Find line 31 (after `const [page, setPage] = useState(1)`):
```tsx
  const [page, setPage] = useState(1)
```

Add `perPage` immediately after:
```tsx
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
```

- [ ] **Step 2: Wire `perPage` into filters and query key**

Find the `filters` useMemo (lines 33–41). Replace:
```tsx
  const filters = useMemo<ManagerParentSalesCustomerFilters>(() => ({
    search: search || undefined,
    program_id: programId || undefined,
    country_name: countryName || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    per_page: 25,
  }), [countryName, from, page, programId, search, to])
```

With:
```tsx
  const filters = useMemo<ManagerParentSalesCustomerFilters>(() => ({
    search: search || undefined,
    program_id: programId || undefined,
    country_name: countryName || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    per_page: perPage,
  }), [countryName, from, page, perPage, programId, search, to])
```

- [ ] **Step 3: Wire pagination props into DataTable**

Find the `<DataTable>` call (line ~201):
```tsx
      <DataTable tableKey="manager_parent_sales_customers" columns={columns} data={rows} rowKey={(row) => `${row.license_id ?? 'no-license'}-${row.sale_date ?? ''}-${row.customer_id ?? 'no-customer'}`} isLoading={salesQuery.isLoading} emptyMessage={t('payments.managerParentCustomers.empty')} />
```

Replace with:
```tsx
      <DataTable
        tableKey="manager_parent_sales_customers"
        columns={columns}
        data={rows}
        rowKey={(row) => `${row.license_id ?? 'no-license'}-${row.sale_date ?? ''}-${row.customer_id ?? 'no-customer'}`}
        isLoading={salesQuery.isLoading}
        emptyMessage={t('payments.managerParentCustomers.empty')}
        pagination={{
          page: meta?.current_page ?? page,
          lastPage: meta?.last_page ?? 1,
          total: meta?.total ?? 0,
          perPage: meta?.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPerPage(newSize)
          setPage(1)
        }}
      />
```

- [ ] **Step 4: Remove the manual prev/next pagination div below DataTable**

Delete the entire manual pagination block (lines ~203–214):
```tsx
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>{t('common.totalCount', { count: meta?.total ?? 0 })}</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!meta || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            {t('common.previous')}
          </Button>
          <span>{meta ? `${meta.current_page} / ${meta.last_page}` : '1 / 1'}</span>
          <Button type="button" variant="outline" size="sm" disabled={!meta || page >= meta.last_page} onClick={() => setPage((current) => current + 1)}>
            {t('common.next')}
          </Button>
        </div>
      </div>
```

The DataTable now handles prev/next internally when `pagination` + `onPageChange` are passed.

- [ ] **Step 5: Check for unused imports after removing the manual pagination**

If `Button` is now only used for the Back button and nowhere else in this file, keep it. It's still used — no change.

---

## Task 4 — Fix `ManagerSalesCustomers.tsx` (manager-parent role)

**Files:**
- Modify: `frontend/src/pages/manager-parent/ManagerSalesCustomers.tsx`

Exact same fix as Task 3. Reference: `frontend/src/pages/super-admin/ManagerSalesCustomers.tsx`.

- [ ] **Step 1: Add `perPage` state after `page`**

```tsx
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
```

- [ ] **Step 2: Wire into filters — change `per_page: 25` to `per_page: perPage` and add `perPage` to deps array**

```tsx
  const filters = useMemo<ManagerParentSalesCustomerFilters>(() => ({
    search: search || undefined,
    program_id: programId || undefined,
    country_name: countryName || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    per_page: perPage,
  }), [countryName, from, page, perPage, programId, search, to])
```

- [ ] **Step 3: Replace DataTable call — add pagination props**

Find:
```tsx
      <DataTable tableKey="manager_parent_manager_sales_customers" columns={columns} data={rows} rowKey={(row) => `${row.license_id ?? 'no-license'}-${row.sale_date ?? ''}-${row.customer_id ?? 'no-customer'}`} isLoading={salesQuery.isLoading} emptyMessage={t('payments.managerParentCustomers.empty')} />
```

Replace with:
```tsx
      <DataTable
        tableKey="manager_parent_manager_sales_customers"
        columns={columns}
        data={rows}
        rowKey={(row) => `${row.license_id ?? 'no-license'}-${row.sale_date ?? ''}-${row.customer_id ?? 'no-customer'}`}
        isLoading={salesQuery.isLoading}
        emptyMessage={t('payments.managerParentCustomers.empty')}
        pagination={{
          page: meta?.current_page ?? page,
          lastPage: meta?.last_page ?? 1,
          total: meta?.total ?? 0,
          perPage: meta?.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPerPage(newSize)
          setPage(1)
        }}
      />
```

- [ ] **Step 4: Delete the manual prev/next div below DataTable**

Delete:
```tsx
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>{t('common.totalCount', { count: meta?.total ?? 0 })}</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!meta || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            {t('common.previous')}
          </Button>
          <span>{meta ? `${meta.current_page} / ${meta.last_page}` : '1 / 1'}</span>
          <Button type="button" variant="outline" size="sm" disabled={!meta || page >= meta.last_page} onClick={() => setPage((current) => current + 1)}>
            {t('common.next')}
          </Button>
        </div>
      </div>
```

---

## Task 5 — Fix `ResellerSalesCustomers.tsx` (manager-parent role)

**Files:**
- Modify: `frontend/src/pages/manager-parent/ResellerSalesCustomers.tsx`

Exact same fix as Tasks 3–4. Reference: `frontend/src/pages/super-admin/ResellerSalesCustomers.tsx`.

- [ ] **Step 1: Add `perPage` state**

```tsx
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
```

- [ ] **Step 2: Wire into filters**

```tsx
  const filters = useMemo<ManagerParentSalesCustomerFilters>(() => ({
    search: search || undefined,
    program_id: programId || undefined,
    country_name: countryName || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    per_page: perPage,
  }), [countryName, from, page, perPage, programId, search, to])
```

- [ ] **Step 3: Replace DataTable call**

Find:
```tsx
      <DataTable tableKey="manager_parent_reseller_sales_customers" columns={columns} data={rows} rowKey={(row) => `${row.license_id ?? 'no-license'}-${row.sale_date ?? ''}-${row.customer_id ?? 'no-customer'}`} isLoading={salesQuery.isLoading} emptyMessage={t('payments.managerParentCustomers.empty')} />
```

Replace with:
```tsx
      <DataTable
        tableKey="manager_parent_reseller_sales_customers"
        columns={columns}
        data={rows}
        rowKey={(row) => `${row.license_id ?? 'no-license'}-${row.sale_date ?? ''}-${row.customer_id ?? 'no-customer'}`}
        isLoading={salesQuery.isLoading}
        emptyMessage={t('payments.managerParentCustomers.empty')}
        pagination={{
          page: meta?.current_page ?? page,
          lastPage: meta?.last_page ?? 1,
          total: meta?.total ?? 0,
          perPage: meta?.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPerPage(newSize)
          setPage(1)
        }}
      />
```

- [ ] **Step 4: Delete manual prev/next div**

Delete the same `<div className="flex items-center justify-between ...">` block below DataTable.

---

## Task 6 — Build and manual verification

- [ ] **Step 1: Run the frontend build**

```bash
cd C:\laragon\www\Multi-Tenant-OBD2-License-Management-SaaS-Platform
npm run build --workspace=frontend
```

Expected: zero TypeScript errors, build succeeds.

- [ ] **Step 2: Start dev server if not running**

```bash
npm run dev --workspace=frontend
```

- [ ] **Step 3: Verify the broken page is fixed**

Navigate to: `http://localhost:3000/en/reseller-payments/manager-parent/142/customers`

Verify:
- [ ] The DataTable header bar shows pill buttons `10 | 25 | 50 | 100` on the left (always visible, not inside dropdown)
- [ ] `25` is highlighted/active by default
- [ ] Clicking `10` reloads the table with 10 rows, resets to page 1
- [ ] Clicking `50` reloads the table with 50 rows
- [ ] The Screen Options button still appears on the right
- [ ] Opening Screen Options shows only the Columns section — no Pagination section
- [ ] Column toggles still work (hiding/showing columns)
- [ ] Prev/Next pagination buttons at the bottom of DataTable work correctly

- [ ] **Step 4: Verify the other two fixed pages**

Navigate to:
- `http://localhost:3000/en/reseller-payments/manager/[any-id]/customers`
- `http://localhost:3000/en/reseller-payments/reseller/[any-id]/customers`

Same checks as Step 3.

- [ ] **Step 5: Spot-check a page that was already working (regression check)**

Navigate to `http://localhost:3000/en/customers` (Manager Parent Customers page).

Verify:
- [ ] Per-page pills still visible in header bar and functional
- [ ] Screen Options only shows Columns
- [ ] Selecting 50 rows changes the page size and persists on reload
- [ ] Column visibility toggle still works

- [ ] **Step 6: Check dark mode**

Toggle dark mode. Verify:
- [ ] Active per-page button uses `bg-brand-600 text-white`
- [ ] Inactive per-page buttons use dark slate border/bg variants
- [ ] Screen Options panel looks correct in dark mode (columns section only)

---

## Self-review checklist

**Spec coverage:**
- [x] Broken page `/en/reseller-payments/manager-parent/:id/customers` — fixed in Task 3
- [x] Same fix for manager and reseller drill-down pages — Tasks 4 & 5
- [x] Per-page selector moved outside Screen Options for ALL DataTable instances — Tasks 1 & 2
- [x] Selection always saved — `useTablePreferences` already writes to localStorage + server, wiring is through `onPageSizeChange` in DataTable which calls `handlePageSizeChange` → `onPageSizeChange?.(nextPageSize)` → the parent's `setPerPage` + `setPage(1)`, and `useTablePreferences` observes `perPage` change and triggers save

**Type consistency:**
- `pagination.perPage` (number) → used as the active-pill check `pagination?.perPage === option` ✓
- `ManagerParentSalesCustomerFilters.per_page` already accepts `number` ✓
- `onPageSizeChange: (pageSize: number) => void` — same signature in DataTable props and TableScreenOptions (now removed from TableScreenOptions) ✓

**Placeholder check:** All code blocks are complete. No "TBD" or "implement later".
