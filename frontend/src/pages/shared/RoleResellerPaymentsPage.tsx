import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Banknote, CircleDollarSign, Wallet, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { RoleOptionPicker } from '@/components/shared/RoleOptionPicker'
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
  const summaryMode = roleFilter || balanceFilter || 'all'
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
      setSearchParams((current) => updateSummaryMode(current, 'all'), { replace: true })
    }
  }, [allowedRoleSales, roleFilter, setSearchParams])

  const query = useQuery({
    queryKey: [queryKeyPrefix, 'reseller-payments', listFilters],
    queryFn: () => fetchList(listFilters),
  })

  const rows = query.data?.data ?? []
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
  const sellerOptions = rows.map((row) => ({
    id: row.reseller_id,
    name: row.reseller_name,
    role: row.reseller_role ?? null,
    secondary: row.reseller_email,
  }))

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
          return (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => navigate(detailPath(lang, row.reseller_id))} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900">
                {t('payments.actions.viewDetails', { defaultValue: 'View Details' })}
                <ArrowRight className="h-4 w-4" />
              </button>
              {managerParentDetailPath ? (
                <button type="button" onClick={() => navigate(managerParentDetailPath(lang, row.reseller_id))} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900">
                  {t('payments.actions.viewSalesCustomers', { defaultValue: 'View Sales Customers' })}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
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
    if (summaryMode === 'manager_parent' || summaryMode === 'manager' || summaryMode === 'reseller') {
      return rows.filter((row) => row.reseller_role === summaryMode)
    }

    if (summaryMode === 'negative') {
      return rows.filter((row) => row.outstanding < 0)
    }

    if (summaryMode === 'positive') {
      return rows.filter((row) => row.outstanding > 0)
    }

    if (summaryMode === 'collected') {
      return rows.filter((row) => {
        const commissionOwed = row.commission_owed ?? 0
        const outstanding = Math.max(row.outstanding ?? 0, 0)
        return commissionOwed > 0 && commissionOwed - outstanding > 0
      })
    }

    return rows
  }, [rows, summaryMode])

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
  const hasSummaryFilter = summaryMode !== 'all'
  const activeSummaryFilterLabel = summaryModeLabel(summaryMode, t)
  const totalCollected = summary?.total_collected
    ?? Math.max(0, (summary?.total_owed ?? 0) - (summary?.total_collectible ?? 0))

  const handleSummaryReset = () => {
    setSearchParams((current) => updateSummaryMode(current, 'all'), { replace: true })
  }

  const handleRoleSelect = (role: 'manager_parent' | 'manager' | 'reseller') => {
    setSearchParams((current) => updateSummaryMode(current, role), { replace: true })
  }

  const handleBalanceSelect = (mode: 'negative' | 'positive' | 'collected') => {
    if (!balanceAvailability[mode]) {
      return
    }

    setSearchParams((current) => updateSummaryMode(current, mode), { replace: true })
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

      <section className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-4 xl:grid-cols-2">
          {allowedRoleSales.length > 0 ? (
            <div className="space-y-2.5 rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
              <button
                type="button"
                onClick={handleSummaryReset}
                className={cn(
                  'w-full rounded-[1.5rem] border p-3.5 text-start transition-all duration-200',
                  !hasSummaryFilter
                    ? 'border-amber-300 bg-gradient-to-br from-amber-100 via-white to-orange-100 shadow-lg shadow-amber-500/10 dark:border-amber-700 dark:from-amber-950/60 dark:via-slate-950 dark:to-orange-950/40'
                    : 'border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50 hover:border-amber-300 hover:shadow-md dark:border-amber-900/50 dark:from-amber-950/30 dark:via-slate-950 dark:to-orange-950/20'
                )}
                aria-pressed={!hasSummaryFilter}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                      {t('payments.summary.totalSales', { defaultValue: 'Total Sales' })}
                    </p>
                    {!hasSummaryFilter ? (
                      <span className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white dark:bg-amber-400 dark:text-slate-950">
                        {t('payments.filters.defaultView', { defaultValue: 'Default View' })}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[1.7rem]">
                    {formatCurrency(totalSales, 'USD', locale)}
                  </p>
                  <p className="text-[11px] leading-5 text-balance text-slate-600 dark:text-slate-300">
                    {t('payments.summary.heroHint', { defaultValue: 'Click this card any time to reset the table and show all rows.' })}
                  </p>
                </div>
              </button>

              <div className="relative hidden xl:block">
                <div className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-slate-300 dark:bg-slate-700" />
                <div className="absolute left-[16.666%] right-[16.666%] top-3 h-px bg-slate-300 dark:bg-slate-700" />
                <div className="absolute left-[16.666%] top-3 h-3 w-px bg-slate-300 dark:bg-slate-700" />
                <div className="absolute left-1/2 top-3 h-3 w-px -translate-x-1/2 bg-slate-300 dark:bg-slate-700" />
                <div className="absolute right-[16.666%] top-3 h-3 w-px bg-slate-300 dark:bg-slate-700" />
                <div className="grid gap-3 pt-6 xl:grid-cols-3">
                  {allowedRoleSales.includes('manager_parent') ? (
                    <SummaryFilterCard
                      active={summaryMode === 'manager_parent'}
                      title={t('payments.summary.totalSalesManagerParent', { defaultValue: 'Manager Parent Sales' })}
                      value={formatCurrency(totalsByRole.manager_parent, 'USD', locale)}
                      helperText={t('payments.summary.totalSalesManagerParentShortHint', { defaultValue: 'Only manager parent rows.' })}
                      color="sky"
                      density="compact"
                      compactContent
                      onClick={() => handleRoleSelect('manager_parent')}
                    />
                  ) : <div />}
                  {allowedRoleSales.includes('manager') ? (
                    <SummaryFilterCard
                      active={summaryMode === 'manager'}
                      title={t('payments.summary.totalSalesManager', { defaultValue: 'Manager Sales' })}
                      value={formatCurrency(totalsByRole.manager, 'USD', locale)}
                      helperText={t('payments.summary.totalSalesManagerShortHint', { defaultValue: 'Only manager rows.' })}
                      color="emerald"
                      density="compact"
                      compactContent
                      onClick={() => handleRoleSelect('manager')}
                    />
                  ) : <div />}
                  {allowedRoleSales.includes('reseller') ? (
                    <SummaryFilterCard
                      active={summaryMode === 'reseller'}
                      title={t('payments.summary.totalSalesReseller', { defaultValue: 'Reseller Sales' })}
                      value={formatCurrency(totalsByRole.reseller, 'USD', locale)}
                      helperText={t('payments.summary.totalSalesResellerShortHint', { defaultValue: 'Only reseller rows.' })}
                      color="amber"
                      density="compact"
                      compactContent
                      onClick={() => handleRoleSelect('reseller')}
                    />
                  ) : <div />}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:hidden">
                {allowedRoleSales.includes('manager_parent') ? (
                  <SummaryFilterCard
                    active={summaryMode === 'manager_parent'}
                    title={t('payments.summary.totalSalesManagerParent', { defaultValue: 'Manager Parent Sales' })}
                    value={formatCurrency(totalsByRole.manager_parent, 'USD', locale)}
                    helperText={t('payments.summary.totalSalesManagerParentShortHint', { defaultValue: 'Only manager parent rows.' })}
                    color="sky"
                    density="compact"
                    compactContent
                    onClick={() => handleRoleSelect('manager_parent')}
                  />
                ) : null}
                {allowedRoleSales.includes('manager') ? (
                  <SummaryFilterCard
                    active={summaryMode === 'manager'}
                    title={t('payments.summary.totalSalesManager', { defaultValue: 'Manager Sales' })}
                    value={formatCurrency(totalsByRole.manager, 'USD', locale)}
                    helperText={t('payments.summary.totalSalesManagerShortHint', { defaultValue: 'Only manager rows.' })}
                    color="emerald"
                    density="compact"
                    compactContent
                    onClick={() => handleRoleSelect('manager')}
                  />
                ) : null}
                {allowedRoleSales.includes('reseller') ? (
                  <SummaryFilterCard
                    active={summaryMode === 'reseller'}
                    title={t('payments.summary.totalSalesReseller', { defaultValue: 'Reseller Sales' })}
                    value={formatCurrency(totalsByRole.reseller, 'USD', locale)}
                    helperText={t('payments.summary.totalSalesResellerShortHint', { defaultValue: 'Only reseller rows.' })}
                    color="amber"
                    density="compact"
                    compactContent
                    onClick={() => handleRoleSelect('reseller')}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex h-full flex-col justify-center rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="space-y-0.5 text-center">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">
                {t('payments.summary.collectionView', { defaultValue: 'Collection Status' })}
              </p>
              <p className="text-xs text-pretty text-slate-500 dark:text-slate-400">
                {t('payments.summary.collectionViewHint', { defaultValue: 'Choose one money status to focus the table.' })}
              </p>
            </div>
            <div className="mt-3 grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryFilterCard
                active={summaryMode === 'collected'}
                title={t('payments.summary.totalCollected', { defaultValue: 'Collected From Sales' })}
                value={formatCurrency(totalCollected, 'USD', locale)}
                helperText={t('payments.summary.totalCollectedShortHint', { defaultValue: 'Amounts already received.' })}
                color="emerald"
                compactContent
                onClick={() => handleBalanceSelect('collected')}
              />
              <SummaryFilterCard
                active={summaryMode === 'positive'}
                title={t('payments.summary.amountToCollect', { defaultValue: 'Amount To Collect' })}
                value={formatCurrency(summary?.total_collectible ?? 0, 'USD', locale)}
                helperText={t('payments.summary.amountToCollectShortHint', { defaultValue: 'Positive balances still due.' })}
                color="sky"
                compactContent
                onClick={() => handleBalanceSelect('positive')}
              />
              <SummaryFilterCard
                active={summaryMode === 'negative'}
                title={t('payments.summary.outstanding', { defaultValue: 'Net Outstanding Balance' })}
                value={formatCurrency(summary?.total_outstanding ?? 0, 'USD', locale)}
                helperText={t('payments.summary.outstandingShortHint', { defaultValue: 'Credit paid before matching sales.' })}
                color="rose"
                compactContent
                onClick={() => handleBalanceSelect('negative')}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1 space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(220px,280px)_1fr]">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-950 dark:text-white">{t('payments.filters.period')}</span>
                <Input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
              </label>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-slate-950 dark:text-white">
                    {t('payments.filters.quickFilters', { defaultValue: 'Quick Filters' })}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('payments.filters.quickFiltersHint', { defaultValue: 'Choose one filter. Use the Total Sales card above to reset to the default view.' })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allowedRoleSales.includes('manager_parent') ? (
                    <FilterChip active={summaryMode === 'manager_parent'} onClick={() => handleRoleSelect('manager_parent')}>
                      {t('payments.summary.totalSalesManagerParent', { defaultValue: 'Manager Parent Sales' })}
                    </FilterChip>
                  ) : null}
                  {allowedRoleSales.includes('manager') ? (
                    <FilterChip active={summaryMode === 'manager'} onClick={() => handleRoleSelect('manager')}>
                      {t('payments.summary.totalSalesManager', { defaultValue: 'Manager Sales' })}
                    </FilterChip>
                  ) : null}
                  {allowedRoleSales.includes('reseller') ? (
                    <FilterChip active={summaryMode === 'reseller'} onClick={() => handleRoleSelect('reseller')}>
                      {t('payments.summary.totalSalesReseller', { defaultValue: 'Reseller Sales' })}
                    </FilterChip>
                  ) : null}
                  <FilterChip active={summaryMode === 'collected'} onClick={() => handleBalanceSelect('collected')} disabled={!balanceAvailability.collected}>
                    {t('payments.summary.totalCollected', { defaultValue: 'Collected From Sales' })}
                  </FilterChip>
                  <FilterChip active={summaryMode === 'positive'} onClick={() => handleBalanceSelect('positive')} disabled={!balanceAvailability.positive}>
                    {t('payments.summary.amountToCollect', { defaultValue: 'Amount To Collect' })}
                  </FilterChip>
                  <FilterChip active={summaryMode === 'negative'} onClick={() => handleBalanceSelect('negative')} disabled={!balanceAvailability.negative}>
                    {t('payments.summary.outstanding', { defaultValue: 'Net Outstanding Balance' })}
                  </FilterChip>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <span className="font-medium text-slate-950 dark:text-white">
                {t('payments.filters.activeFilter', { defaultValue: 'Viewing:' })}
              </span>{' '}
              {activeSummaryFilterLabel}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPeriod('')
                  setSearchParams((current) => {
                    const next = new URLSearchParams(current)
                    next.delete('period')
                    return updateSummaryMode(next, 'all')
                  }, { replace: true })
                }}
              >
                {t('common.clear')}
              </Button>
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
                <span className="text-sm font-medium">{t('payments.columns.seller', { defaultValue: 'Seller' })}</span>
                <RoleOptionPicker
                  value={paymentForm.reseller_id === 0 ? '' : paymentForm.reseller_id}
                  onChange={(value) => setPaymentForm((current) => ({ ...current, reseller_id: value === '' ? 0 : value }))}
                  options={sellerOptions}
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

function updateSummaryMode(
  current: URLSearchParams,
  nextMode: 'all' | 'manager_parent' | 'manager' | 'reseller' | 'negative' | 'positive' | 'collected'
) {
  if (nextMode === 'all') {
    return updateSummaryFilter(current, { role: '', balance: '' })
  }

  if (nextMode === 'manager_parent' || nextMode === 'manager' || nextMode === 'reseller') {
    return updateSummaryFilter(current, { role: nextMode, balance: '' })
  }

  return updateSummaryFilter(current, { role: '', balance: nextMode })
}

function summaryModeLabel(
  mode: 'all' | 'manager_parent' | 'manager' | 'reseller' | 'negative' | 'positive' | 'collected',
  t: (key: string, options?: Record<string, unknown>) => string
) {
  if (mode === 'all') {
    return t('payments.summary.totalSales', { defaultValue: 'Total Sales' })
  }
  if (mode === 'manager_parent') {
    return t('payments.summary.totalSalesManagerParent', { defaultValue: 'Manager Parent Sales' })
  }
  if (mode === 'manager') {
    return t('payments.summary.totalSalesManager', { defaultValue: 'Manager Sales' })
  }
  if (mode === 'reseller') {
    return t('payments.summary.totalSalesReseller', { defaultValue: 'Reseller Sales' })
  }
  if (mode === 'negative') {
    return t('payments.summary.outstanding', { defaultValue: 'Net Outstanding Balance' })
  }
  if (mode === 'collected') {
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
  compactContent?: boolean
  onClick: () => void
}

function SummaryFilterCard({
  title,
  value,
  helperText,
  color,
  active,
  density = 'normal',
  compactContent = false,
  onClick,
}: SummaryFilterCardProps) {
  const Icon = color === 'emerald' ? Banknote : color === 'rose' ? Wallet : color === 'sky' ? CircleDollarSign : WalletCards

  const palette = {
    sky: {
      active: 'border-sky-400 bg-sky-100 text-sky-950 shadow-lg shadow-sky-500/15 dark:border-sky-500 dark:bg-sky-950/60 dark:text-sky-50',
      muted: 'border-slate-200 bg-white text-slate-950 hover:border-sky-200 hover:bg-sky-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:hover:border-sky-900 dark:hover:bg-sky-950/20',
      icon: 'bg-sky-600 text-white dark:bg-sky-500 dark:text-sky-950',
      label: 'text-sky-700 dark:text-sky-300',
      hint: 'text-sky-800/80 dark:text-sky-100/80',
    },
    emerald: {
      active: 'border-emerald-400 bg-emerald-100 text-emerald-950 shadow-lg shadow-emerald-500/15 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-50',
      muted: 'border-slate-200 bg-white text-slate-950 hover:border-emerald-200 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:hover:border-emerald-900 dark:hover:bg-emerald-950/20',
      icon: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950',
      label: 'text-emerald-700 dark:text-emerald-300',
      hint: 'text-emerald-800/80 dark:text-emerald-100/80',
    },
    amber: {
      active: 'border-amber-400 bg-amber-100 text-amber-950 shadow-lg shadow-amber-500/15 dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-50',
      muted: 'border-slate-200 bg-white text-slate-950 hover:border-amber-200 hover:bg-amber-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:hover:border-amber-900 dark:hover:bg-amber-950/20',
      icon: 'bg-amber-600 text-white dark:bg-amber-500 dark:text-amber-950',
      label: 'text-amber-700 dark:text-amber-300',
      hint: 'text-amber-800/80 dark:text-amber-100/80',
    },
    rose: {
      active: 'border-rose-400 bg-rose-100 text-rose-950 shadow-lg shadow-rose-500/15 dark:border-rose-500 dark:bg-rose-950/60 dark:text-rose-50',
      muted: 'border-slate-200 bg-white text-slate-950 hover:border-rose-200 hover:bg-rose-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:hover:border-rose-900 dark:hover:bg-rose-950/20',
      icon: 'bg-rose-600 text-white dark:bg-rose-500 dark:text-rose-950',
      label: 'text-rose-700 dark:text-rose-300',
      hint: 'text-rose-800/80 dark:text-rose-100/80',
    },
  }[color]

  return (
    <button
      type="button"
      onClick={onClick}
      className="h-full text-start"
      aria-pressed={active}
    >
      <div
        className={cn(
          'flex h-full flex-col rounded-[1.5rem] border text-start transition-all duration-200',
          compactContent ? 'min-h-[112px] gap-2 p-3.5' : density === 'compact' ? 'min-h-[168px] gap-3 p-4' : 'min-h-[182px] gap-3 p-4',
          active ? `scale-[1.01] ${palette.active}` : palette.muted
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className={cn('flex items-center justify-center rounded-2xl', compactContent ? 'h-9 w-9' : 'h-11 w-11', palette.icon)}>
            <Icon className={cn(compactContent ? 'h-4 w-4' : 'h-5 w-5')} />
          </div>
          {active ? (
            <span className={cn('rounded-full bg-slate-950 font-semibold uppercase tracking-wide text-white dark:bg-white dark:text-slate-950', compactContent ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]')}>
              Active
            </span>
          ) : null}
        </div>
        <div className={cn('space-y-1.5', compactContent && 'space-y-1')}>
          <p className={cn('text-xs font-semibold uppercase tracking-[0.18em]', active ? '' : palette.label)}>{title}</p>
          <p className={cn('tabular-nums font-bold tracking-tight', compactContent ? 'text-xl' : density === 'compact' ? 'text-2xl' : 'text-3xl')}>
            {value}
          </p>
          {helperText ? (
            <p className={cn(compactContent ? 'text-xs leading-5' : 'text-sm leading-6', active ? 'text-current/85' : palette.hint)}>{helperText}</p>
          ) : null}
        </div>
      </div>
    </button>
  )
}

interface FilterChipProps {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

function FilterChip({ active, disabled = false, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900',
        disabled && 'cursor-not-allowed opacity-45 hover:border-slate-200 hover:bg-white dark:hover:border-slate-800 dark:hover:bg-slate-950'
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}
