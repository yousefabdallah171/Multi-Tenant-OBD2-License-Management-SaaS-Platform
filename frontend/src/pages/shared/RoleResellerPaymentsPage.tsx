import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Banknote, CircleDollarSign, Wallet, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { RoleOptionPicker } from '@/components/shared/RoleOptionPicker'
import { StatsCard } from '@/components/shared/StatsCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/hooks/useLanguage'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { cn, formatCurrency } from '@/lib/utils'
import type { RecordPaymentPayload, ResellerPaymentFilters, ResellerPaymentListData, ResellerPaymentRow } from '@/types/manager-reseller.types'

const todayDate = () => new Date().toISOString().slice(0, 10)
const MAX_PAYMENT_AMOUNT = 99_999_999.99

interface RoleResellerPaymentsPageProps {
  eyebrow: string
  queryKeyPrefix: string
  fetchList: (filters?: ResellerPaymentFilters) => Promise<ResellerPaymentListData>
  recordPayment: (payload: RecordPaymentPayload) => Promise<{ message?: string }>
  detailPath: (lang: 'ar' | 'en', resellerId: number) => string
  managerParentDetailPath?: (lang: 'ar' | 'en', managerParentId: number) => string
  roleSalesRoles?: Array<'manager_parent' | 'manager' | 'reseller'>
  allowRecordPayment?: boolean
}

export function RoleResellerPaymentsPage({
  eyebrow,
  queryKeyPrefix,
  fetchList,
  recordPayment,
  detailPath,
  managerParentDetailPath,
  roleSalesRoles,
  allowRecordPayment = true,
}: RoleResellerPaymentsPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [searchParams, setSearchParams] = useSearchParams()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [period, setPeriod] = useState(searchParams.get('period') || '')
  const balanceFilter = normalizeBalanceFilter(searchParams.get('balance'))
  const managerParentId = parseNumericParam(searchParams.get('manager_parent_id'))
  const managerId = parseNumericParam(searchParams.get('manager_id'))
  const resellerId = parseNumericParam(searchParams.get('reseller_id'))
  const scopeName = searchParams.get('scope_name') || ''
  const scopeRole = normalizeScopeRole(searchParams.get('scope_role'))
  const roleFilter = normalizeRoleFilter(searchParams.get('role'))
  const allowedRoleSales = roleSalesRoles ?? ['manager_parent', 'manager', 'reseller']
  const [paymentForm, setPaymentForm] = useState({
    reseller_id: 0,
    amount: '',
    payment_date: todayDate(),
    notes: '',
  })

  const listFilters = useMemo<ResellerPaymentFilters>(() => ({
    period: period || undefined,
    manager_parent_id: managerParentId || undefined,
    manager_id: managerId || undefined,
    reseller_id: resellerId || undefined,
  }), [managerId, managerParentId, period, resellerId])

  useEffect(() => {
    const next = new URLSearchParams()
    if (period) next.set('period', period)
    if (managerParentId) next.set('manager_parent_id', String(managerParentId))
    if (managerId) next.set('manager_id', String(managerId))
    if (resellerId) next.set('reseller_id', String(resellerId))
    if (balanceFilter) next.set('balance', balanceFilter)
    if (roleFilter) next.set('role', roleFilter)
    if (scopeName) next.set('scope_name', scopeName)
    if (scopeRole) next.set('scope_role', scopeRole)

    setSearchParams(next, { replace: true })
  }, [managerId, managerParentId, period, resellerId, balanceFilter, roleFilter, scopeName, scopeRole, setSearchParams])

  useEffect(() => {
    if (roleFilter && !allowedRoleSales.includes(roleFilter)) {
      setSearchParams((current) => updateSummaryFilter(current, { role: '', balance: balanceFilter }), { replace: true })
    }
  }, [allowedRoleSales, balanceFilter, roleFilter, setSearchParams])

  const query = useQuery({
    queryKey: [queryKeyPrefix, 'reseller-payments', listFilters],
    queryFn: () => fetchList(listFilters),
  })

  const rows = query.data?.data ?? []
  const filteredRows = useMemo(() => {
    if (balanceFilter === 'negative') {
      return rows.filter((row) => row.outstanding < 0)
    }
    if (balanceFilter === 'positive') {
      return rows.filter((row) => row.outstanding > 0)
    }
    if (balanceFilter === 'collected') {
      return rows.filter((row) => {
        const commissionOwed = row.commission_owed ?? 0
        const outstanding = Math.max(row.outstanding ?? 0, 0)
        return commissionOwed > 0 && commissionOwed - outstanding > 0
      })
    }
    return rows
  }, [balanceFilter, rows])
  const summary = query.data?.summary
  const totalsByRole = useMemo(() => {
    if (summary?.sales_by_role) {
      return {
        reseller: summary.sales_by_role.reseller ?? 0,
        manager: summary.sales_by_role.manager ?? 0,
        manager_parent: summary.sales_by_role.manager_parent ?? 0,
      }
    }

    const initial = {
      reseller: 0,
      manager: 0,
      manager_parent: 0,
    }

      return rows.reduce((acc, row) => {
      if (row.reseller_role === 'reseller') {
        acc.reseller += row.total_sales ?? 0
      } else if (row.reseller_role === 'manager') {
        acc.manager += row.total_sales ?? 0
      } else if (row.reseller_role === 'manager_parent') {
        acc.manager_parent += row.total_sales ?? 0
      }
      return acc
    }, initial)
  }, [rows, summary?.sales_by_role])
  const totalSales = useMemo(() => {
    if (summary?.sales_by_role) {
      return (summary.sales_by_role.manager_parent ?? 0)
        + (summary.sales_by_role.manager ?? 0)
        + (summary.sales_by_role.reseller ?? 0)
    }

    return rows.reduce((total, row) => total + (row.total_sales ?? 0), 0)
  }, [rows, summary?.sales_by_role])
  const balanceAvailability = useMemo(() => ({
    positive: rows.some((row) => row.outstanding > 0),
    negative: rows.some((row) => row.outstanding < 0),
    collected: rows.some((row) => {
      const commissionOwed = row.commission_owed ?? 0
      const outstanding = Math.max(row.outstanding ?? 0, 0)
      return commissionOwed > 0 && commissionOwed - outstanding > 0
    }),
  }), [rows])
  const resellerOptions = rows.map((row) => ({
    id: row.reseller_id,
    name: row.reseller_name,
    role: row.reseller_role ?? null,
    secondary: row.reseller_email,
  })).filter((row) => row.role !== 'manager_parent')

  const paymentMutation = useMutation({
    mutationFn: (payload: RecordPaymentPayload) => recordPayment(payload),
    onSuccess: (response) => {
      toast.success(response.message ?? t('payments.messages.paymentSaved'))
      setPaymentOpen(false)
      resetPaymentForm()
      void queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, 'reseller-payments'] })
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  const columns = useMemo<Array<DataTableColumn<ResellerPaymentRow>>>(() => [
    {
      key: 'reseller_name',
      label: t('payments.columns.reseller'),
      sortable: true,
      sortValue: (row) => row.reseller_name,
      render: (row) => (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{row.reseller_name}</span>
            {row.reseller_role ? <RoleBadge role={row.reseller_role} /> : null}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{row.reseller_email}</p>
        </div>
      ),
    },
    {
      key: 'total_sales',
      label: t('payments.columns.sales'),
      sortable: true,
      sortValue: (row) => row.total_sales,
      render: (row) => formatCurrency(row.total_sales, 'USD', locale),
    },
    {
      key: 'commission_owed',
      label: t('payments.columns.owed'),
      sortable: true,
      sortValue: (row) => row.commission_owed,
      render: (row) => formatCurrency(row.commission_owed, 'USD', locale),
    },
    {
      key: 'amount_paid',
      label: t('payments.columns.paid'),
      sortable: true,
      sortValue: (row) => row.amount_paid,
      render: (row) => formatCurrency(row.amount_paid, 'USD', locale),
    },
    {
      key: 'outstanding',
      label: t('payments.columns.outstanding'),
      sortable: true,
      sortValue: (row) => row.outstanding,
      render: (row) => formatCurrency(row.outstanding, 'USD', locale),
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (row) => {
        if (row.reseller_role === 'manager_parent') {
          if (!managerParentDetailPath) {
            return <span className="text-sm text-slate-500 dark:text-slate-400">-</span>
          }

          return (
            <button type="button" onClick={() => navigate(managerParentDetailPath(lang, row.reseller_id))} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900">
              {t('payments.actions.viewSalesCustomers', { defaultValue: 'View Sales Customers' })}
              <ArrowRight className="h-4 w-4" />
            </button>
          )
        }

        return (
          <button type="button" onClick={() => navigate(detailPath(lang, row.reseller_id))} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900">
            {t('payments.actions.viewDetails', { defaultValue: 'View Details' })}
            <ArrowRight className="h-4 w-4" />
          </button>
        )
      },
    },
  ], [detailPath, lang, locale, managerParentDetailPath, navigate, t])

  const displayedRows = useMemo(() => {
    if (roleFilter) {
      return filteredRows.filter((row) => row.reseller_role === roleFilter)
    }
    return filteredRows
  }, [filteredRows, roleFilter])

  function resetPaymentForm() {
    setPaymentForm({
      reseller_id: rows[0]?.reseller_id ?? 0,
      amount: '',
      payment_date: todayDate(),
      notes: '',
    })
  }

  const scopeHint = scopeRole
    ? t('payments.scopeHint', {
      name: scopeName || t(`payments.scopeRoles.${scopeRole}`),
    })
    : ''
  const hasSummaryFilter = balanceFilter !== '' || roleFilter !== ''
  const activeSummaryFilterLabel = roleFilter
    ? roleSummaryLabel(roleFilter, t)
    : balanceFilter
      ? balanceSummaryLabel(balanceFilter, t)
      : ''

  const handleRoleToggle = (role: 'manager_parent' | 'manager' | 'reseller') => {
    const nextRole = roleFilter === role ? '' : role
    setSearchParams((current) => updateSummaryFilter(current, { role: nextRole, balance: '' }), { replace: true })
  }

  const handleBalanceToggle = (nextValue: '' | 'negative' | 'positive' | 'collected') => {
    if (nextValue === '') {
      setSearchParams((current) => updateSummaryFilter(current, { balance: '', role: '' }), { replace: true })
      return
    }

    const isActive = balanceFilter === nextValue
    const hasRows = balanceAvailability[nextValue]
    const nextFilter = isActive || !hasRows ? '' : nextValue
    setSearchParams((current) => updateSummaryFilter(current, { balance: nextFilter, role: '' }), { replace: true })
  }

  const handleSummaryReset = () => {
    setSearchParams((current) => updateSummaryFilter(current, { balance: '', role: '' }), { replace: true })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader eyebrow={eyebrow} title={t('payments.title')} description={t('payments.description')} />
        {allowRecordPayment ? (
          <Button type="button" onClick={() => { resetPaymentForm(); setPaymentOpen(true) }}>
            {t('payments.actions.recordPayment')}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.28fr)]">
        <div className="order-2 flex flex-col gap-4 xl:order-1">
          <SummaryFilterCard
            active={balanceFilter === 'collected'}
            title={t('payments.summary.totalCollected', { defaultValue: 'Collected From Sales' })}
            value={formatCurrency(
              summary?.total_collected
                ?? Math.max(0, (summary?.total_owed ?? 0) - (summary?.total_collectible ?? 0)),
              'USD',
              locale
            )}
            helperText={t('payments.summary.totalCollectedHint')}
            color="emerald"
            onClick={() => handleBalanceToggle('collected')}
          />
          <SummaryFilterCard
            active={balanceFilter === 'positive'}
            title={t('payments.summary.amountToCollect', { defaultValue: 'Amount To Collect' })}
            value={formatCurrency(summary?.total_collectible ?? 0, 'USD', locale)}
            helperText={t('payments.summary.amountToCollectHint')}
            color="sky"
            onClick={() => handleBalanceToggle('positive')}
          />
          <SummaryFilterCard
            active={balanceFilter === 'negative'}
            title={t('payments.summary.outstanding', { defaultValue: 'Advance Payments' })}
            value={formatCurrency(summary?.total_outstanding ?? 0, 'USD', locale)}
            helperText={t('payments.summary.outstandingHint')}
            color="rose"
            onClick={() => handleBalanceToggle('negative')}
          />
        </div>

        <div className="order-1 flex flex-col gap-4 xl:order-2">
          <SummaryFilterCard
            active={!hasSummaryFilter}
            title={t('payments.summary.totalSales', { defaultValue: 'Total Sales' })}
            value={formatCurrency(totalSales, 'USD', locale)}
            helperText={t('payments.summary.totalSalesHint', { defaultValue: 'Default view. Click to show all rows and clear any active card filter.' })}
            color="amber"
            density="normal"
            onClick={handleSummaryReset}
          />

          {allowedRoleSales.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {allowedRoleSales.includes('manager_parent') ? (
                <SummaryFilterCard
                  active={roleFilter === 'manager_parent'}
                  title={t('payments.summary.totalSalesManagerParent')}
                  value={formatCurrency(totalsByRole.manager_parent, 'USD', locale)}
                  helperText={t('payments.summary.totalSalesManagerParentHint')}
                  color="sky"
                  density="compact"
                  onClick={() => handleRoleToggle('manager_parent')}
                />
              ) : null}
              {allowedRoleSales.includes('manager') ? (
                <SummaryFilterCard
                  active={roleFilter === 'manager'}
                  title={t('payments.summary.totalSalesManager')}
                  value={formatCurrency(totalsByRole.manager, 'USD', locale)}
                  helperText={t('payments.summary.totalSalesManagerHint')}
                  color="emerald"
                  density="compact"
                  onClick={() => handleRoleToggle('manager')}
                />
              ) : null}
              {allowedRoleSales.includes('reseller') ? (
                <SummaryFilterCard
                  active={roleFilter === 'reseller'}
                  title={t('payments.summary.totalSalesReseller')}
                  value={formatCurrency(totalsByRole.reseller, 'USD', locale)}
                  helperText={t('payments.summary.totalSalesResellerHint')}
                  color="amber"
                  density="compact"
                  onClick={() => handleRoleToggle('reseller')}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1 space-y-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-950 dark:text-white">{t('payments.filters.period')}</span>
              <Input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
            </label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {period === ''
                ? t('payments.filters.allTimeHint', { defaultValue: 'Showing all-time reseller balances. Select a month to review a specific commission period.' })
                : t('payments.filters.monthHint', { defaultValue: 'Showing reseller balances for the selected month only.' })}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('payments.filters.reportsDifferenceHint')}
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={hasSummaryFilter ? 'outline' : 'default'} onClick={handleSummaryReset}>
                {t('payments.filters.showAll', { defaultValue: 'Show All Sales' })}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPeriod('')
                  setSearchParams((current) => {
                    const next = new URLSearchParams(current)
                    next.delete('period')
                    return next
                  }, { replace: true })
                }}
              >
                {t('common.clear')}
              </Button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <span className="font-medium text-slate-950 dark:text-white">
                {t('payments.filters.activeFilter', { defaultValue: 'Active filter:' })}
              </span>{' '}
              {activeSummaryFilterLabel || t('payments.filters.none', { defaultValue: 'All sales' })}
            </div>
          </div>
        </div>
        {scopeHint ? (
          <p className="mt-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
            {scopeHint}
          </p>
        ) : null}
      </div>

      <DataTable tableKey={`${queryKeyPrefix}_reseller_payments`} columns={columns} data={displayedRows} rowKey={(row) => row.reseller_id} isLoading={query.isLoading} emptyMessage={t('payments.empty.resellers')} />

      {paymentOpen && allowRecordPayment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="record-payment-title" aria-describedby="record-payment-description">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="space-y-2 pe-8">
              <h2 id="record-payment-title" className="text-xl font-semibold text-slate-950 dark:text-white">{t('payments.dialogs.recordPayment')}</h2>
              <p id="record-payment-description" className="text-sm text-slate-500 dark:text-slate-400">{t('payments.description')}</p>
            </div>
            <div className="mt-4 grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-medium">{t('payments.columns.reseller', { defaultValue: 'Reseller' })}</span>
                <RoleOptionPicker
                  value={paymentForm.reseller_id === 0 ? '' : paymentForm.reseller_id}
                  onChange={(value) => setPaymentForm((current) => ({ ...current, reseller_id: value === '' ? 0 : value }))}
                  options={resellerOptions}
                  placeholder={t('common.selectOption', { defaultValue: 'Select an option' })}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">{t('payments.fields.amount')}</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={paymentForm.amount}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, amount: sanitizeMoneyInput(event.target.value) }))}
                  placeholder={t('payments.fields.amount')}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">{t('common.date')}</span>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, payment_date: event.target.value }))}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">{t('payments.fields.notes', { defaultValue: 'Note' })}</span>
                <Textarea
                  value={paymentForm.notes}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder={t('payments.fields.notes', { defaultValue: 'Note' })}
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => { setPaymentOpen(false); resetPaymentForm() }}>{t('common.cancel')}</Button>
              <Button
                type="button"
                disabled={paymentMutation.isPending}
                onClick={() => {
                  const amount = Number(paymentForm.amount)

                  if (paymentForm.reseller_id <= 0 || !Number.isFinite(amount) || amount <= 0 || amount > MAX_PAYMENT_AMOUNT) {
                    toast.error(t('payments.validation.amountOnly', { defaultValue: 'Enter a valid payment amount.' }))
                    return
                  }

                  paymentMutation.mutate({
                    reseller_id: paymentForm.reseller_id,
                    amount,
                    payment_date: paymentForm.payment_date || undefined,
                    notes: paymentForm.notes.trim() || undefined,
                  })
                }}
              >
                {t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function sanitizeMoneyInput(value: string) {
  const normalized = value
    .replace(/٬/g, '')
    .replace(/٫/g, '.')
    .replace(/[>,]/g, '.')
  const cleaned = normalized.replace(/[^0-9.]/g, '')
  const [whole = '', ...rest] = cleaned.split('.')
  const fraction = rest.join('').slice(0, 2)
  const hasTrailingDot = cleaned.endsWith('.')
  if (whole === '' && fraction.length > 0) {
    return `0.${fraction}`
  }
  if (fraction.length > 0) {
    return `${whole}.${fraction}`
  }
  if (hasTrailingDot && whole.length > 0) {
    return `${whole}.`
  }
  return whole
}

function parseNumericParam(value: string | null): number | '' {
  if (!value) {
    return ''
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : ''
}

function normalizeScopeRole(value: string | null): 'manager_parent' | 'manager' | 'reseller' | '' {
  if (value === 'manager_parent' || value === 'manager' || value === 'reseller') {
    return value
  }

  return ''
}

function normalizeBalanceFilter(value: string | null): '' | 'negative' | 'positive' | 'collected' {
  if (value === 'negative' || value === 'positive' || value === 'collected') {
    return value
  }

  return ''
}

function normalizeRoleFilter(value: string | null): '' | 'manager_parent' | 'manager' | 'reseller' {
  if (value === 'manager_parent' || value === 'manager' || value === 'reseller') {
    return value
  }
  return ''
}

function updateSummaryFilter(
  current: URLSearchParams,
  nextValue: {
    balance: '' | 'negative' | 'positive' | 'collected'
    role: '' | 'manager_parent' | 'manager' | 'reseller'
  }
) {
  const next = new URLSearchParams(current)

  if (nextValue.balance) {
    next.set('balance', nextValue.balance)
  } else {
    next.delete('balance')
  }

  if (nextValue.role) {
    next.set('role', nextValue.role)
  } else {
    next.delete('role')
  }

  return next
}

function roleSummaryLabel(
  role: 'manager_parent' | 'manager' | 'reseller',
  t: (key: string, options?: Record<string, unknown>) => string
) {
  if (role === 'manager_parent') {
    return t('payments.summary.totalSalesManagerParent')
  }
  if (role === 'manager') {
    return t('payments.summary.totalSalesManager')
  }
  return t('payments.summary.totalSalesReseller')
}

function balanceSummaryLabel(
  balance: 'negative' | 'positive' | 'collected',
  t: (key: string, options?: Record<string, unknown>) => string
) {
  if (balance === 'negative') {
    return t('payments.summary.outstanding', { defaultValue: 'Advance Payments' })
  }
  if (balance === 'collected') {
    return t('payments.summary.totalCollected', { defaultValue: 'Collected From Sales' })
  }
  return t('payments.summary.amountToCollect', { defaultValue: 'Amount To Collect' })
}

interface SummaryFilterCardProps {
  title: string
  value: string
  helperText?: string
  color: 'sky' | 'emerald' | 'amber' | 'rose'
  active: boolean
  density?: 'normal' | 'compact'
  onClick: () => void
}

function SummaryFilterCard({
  title,
  value,
  helperText,
  color,
  active,
  density = 'normal',
  onClick,
}: SummaryFilterCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('h-full text-start transition-colors', active ? 'rounded-3xl' : undefined)}
      aria-pressed={active}
    >
      <StatsCard
        title={title}
        value={value}
        icon={color === 'emerald' ? Banknote : color === 'rose' ? Wallet : color === 'sky' ? CircleDollarSign : WalletCards}
        color={color}
        helperText={helperText}
        density={density}
        className={cn(active ? 'ring-2 ring-slate-900/15 dark:ring-white/20' : 'ring-1 ring-transparent')}
      />
    </button>
  )
}
