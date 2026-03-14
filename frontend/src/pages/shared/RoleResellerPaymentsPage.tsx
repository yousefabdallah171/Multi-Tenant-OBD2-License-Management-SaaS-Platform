import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Banknote, CirclePercent, Wallet, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/utils'
import type { ResellerPaymentFilters, ResellerPaymentListData, ResellerPaymentRow } from '@/types/manager-reseller.types'

interface RoleResellerPaymentsPageProps {
  eyebrow: string
  queryKeyPrefix: string
  fetchList: (filters?: ResellerPaymentFilters) => Promise<ResellerPaymentListData>
  detailPath: (lang: 'ar' | 'en', resellerId: number) => string
}

export function RoleResellerPaymentsPage({ eyebrow, queryKeyPrefix, fetchList, detailPath }: RoleResellerPaymentsPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))
  const [status, setStatus] = useState<ResellerPaymentFilters['status']>('')

  const query = useQuery({
    queryKey: [queryKeyPrefix, 'reseller-payments', period, status],
    queryFn: () => fetchList({ period, status }),
  })

  const rows = query.data?.data ?? []
  const summary = query.data?.summary

  const columns = useMemo<Array<DataTableColumn<ResellerPaymentRow>>>(() => [
    {
      key: 'reseller_name',
      label: t('payments.columns.reseller'),
      sortable: true,
      sortValue: (row) => row.reseller_name,
      render: (row) => (
        <div>
          <p className="font-medium">{row.reseller_name}</p>
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
      key: 'commission_rate',
      label: t('payments.columns.rate'),
      sortable: true,
      sortValue: (row) => row.commission_rate,
      render: (row) => `${row.commission_rate}%`,
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
      key: 'status',
      label: t('common.status'),
      sortable: true,
      sortValue: (row) => row.status,
      render: (row) => <PaymentStatusPill status={row.status} />,
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (row) => (
        <button
          type="button"
          onClick={() => navigate(detailPath(lang, row.reseller_id))}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          {t('payments.actions.view')}
          <ArrowRight className="h-4 w-4" />
        </button>
      ),
    },
  ], [detailPath, lang, locale, navigate, t])

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={t('payments.title')} description={t('payments.description')} />

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('payments.filters.period')}</span>
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('common.status')}</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ResellerPaymentFilters['status'])}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('common.allStatuses')}</option>
              <option value="unpaid">{t('payments.status.unpaid')}</option>
              <option value="partial">{t('payments.status.partial')}</option>
              <option value="paid">{t('payments.status.paid')}</option>
            </select>
          </label>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <StatsCard title={t('payments.summary.totalOwed')} value={formatCurrency(summary?.total_owed ?? 0, 'USD', locale)} icon={WalletCards} color="amber" />
        <StatsCard title={t('payments.summary.totalPaid')} value={formatCurrency(summary?.total_paid ?? 0, 'USD', locale)} icon={Banknote} color="emerald" />
        <StatsCard title={t('payments.summary.outstanding')} value={formatCurrency(summary?.total_outstanding ?? 0, 'USD', locale)} icon={Wallet} color="rose" />
        <StatsCard title={t('payments.filters.period')} value={summary?.period ?? period} icon={CirclePercent} color="sky" />
      </div>

      <DataTable columns={columns} data={rows} rowKey={(row) => row.reseller_id} isLoading={query.isLoading} emptyMessage={t('payments.empty.resellers')} />
    </div>
  )
}

function PaymentStatusPill({ status }: { status: ResellerPaymentRow['status'] }) {
  const { t } = useTranslation()

  const tone = {
    unpaid: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    partial: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  }[status]

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{t(`payments.status.${status}`)}</span>
}
