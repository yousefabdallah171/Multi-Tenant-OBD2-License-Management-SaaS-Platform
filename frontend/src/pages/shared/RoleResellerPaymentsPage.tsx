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
import { formatCurrency } from '@/lib/utils'
import type { RecordPaymentPayload, ResellerPaymentFilters, ResellerPaymentListData, ResellerPaymentRow } from '@/types/manager-reseller.types'

const todayDate = () => new Date().toISOString().slice(0, 10)
const MAX_PAYMENT_AMOUNT = 99_999_999.99

interface RoleResellerPaymentsPageProps {
  eyebrow: string
  queryKeyPrefix: string
  fetchList: (filters?: ResellerPaymentFilters) => Promise<ResellerPaymentListData>
  recordPayment: (payload: RecordPaymentPayload) => Promise<{ message?: string }>
  detailPath: (lang: 'ar' | 'en', resellerId: number) => string
}

export function RoleResellerPaymentsPage({ eyebrow, queryKeyPrefix, fetchList, recordPayment, detailPath }: RoleResellerPaymentsPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [searchParams, setSearchParams] = useSearchParams()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [period, setPeriod] = useState(searchParams.get('period') || '')
  const managerParentId = parseNumericParam(searchParams.get('manager_parent_id'))
  const managerId = parseNumericParam(searchParams.get('manager_id'))
  const resellerId = parseNumericParam(searchParams.get('reseller_id'))
  const scopeName = searchParams.get('scope_name') || ''
  const scopeRole = normalizeScopeRole(searchParams.get('scope_role'))
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
    if (scopeName) next.set('scope_name', scopeName)
    if (scopeRole) next.set('scope_role', scopeRole)

    setSearchParams(next, { replace: true })
  }, [managerId, managerParentId, period, resellerId, scopeName, scopeRole, setSearchParams])

  const query = useQuery({
    queryKey: [queryKeyPrefix, 'reseller-payments', listFilters],
    queryFn: () => fetchList(listFilters),
  })

  const rows = query.data?.data ?? []
  const summary = query.data?.summary
  const resellerOptions = rows.map((row) => ({
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
      render: (row) => (
        <button type="button" onClick={() => navigate(detailPath(lang, row.reseller_id))} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900">
          {t('payments.actions.view')}
          <ArrowRight className="h-4 w-4" />
        </button>
      ),
    },
  ], [detailPath, lang, locale, navigate, t])

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader eyebrow={eyebrow} title={t('payments.title')} description={t('payments.description')} />
        <Button type="button" onClick={() => { resetPaymentForm(); setPaymentOpen(true) }}>
          {t('payments.actions.recordPayment')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <StatsCard title={t('payments.summary.totalOwed')} value={formatCurrency(summary?.total_owed ?? 0, 'USD', locale)} icon={WalletCards} color="amber" />
        <StatsCard title={t('payments.summary.totalPaid')} value={formatCurrency(summary?.total_paid ?? 0, 'USD', locale)} icon={Banknote} color="emerald" />
        <StatsCard title={t('payments.summary.outstanding')} value={formatCurrency(summary?.total_outstanding ?? 0, 'USD', locale)} icon={Wallet} color="rose" />
        <StatsCard title={t('payments.summary.amountToCollect', { defaultValue: 'Amount To Collect' })} value={formatCurrency(summary?.total_collectible ?? 0, 'USD', locale)} icon={CircleDollarSign} color="sky" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="flex-1 space-y-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('payments.filters.period')}</span>
            <Input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
          </label>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setPeriod('')
              setSearchParams(new URLSearchParams(), { replace: true })
            }}
          >
            {t('common.clear')}
          </Button>
        </div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          {period === ''
            ? t('payments.filters.allTimeHint', { defaultValue: 'Showing all-time reseller balances. Select a month to review a specific commission period.' })
            : t('payments.filters.monthHint', { defaultValue: 'Showing reseller balances for the selected month only.' })}
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {t('payments.filters.reportsDifferenceHint')}
        </p>
        {scopeHint ? (
          <p className="mt-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
            {scopeHint}
          </p>
        ) : null}
      </div>

      <DataTable tableKey={`${queryKeyPrefix}_reseller_payments`} columns={columns} data={rows} rowKey={(row) => row.reseller_id} isLoading={query.isLoading} emptyMessage={t('payments.empty.resellers')} />

      {paymentOpen ? (
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
  const cleaned = value.replace(/[^0-9.]/g, '')
  const [whole = '', ...rest] = cleaned.split('.')
  const fraction = rest.join('').slice(0, 2)
  return fraction.length > 0 ? `${whole}.${fraction}` : whole
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
