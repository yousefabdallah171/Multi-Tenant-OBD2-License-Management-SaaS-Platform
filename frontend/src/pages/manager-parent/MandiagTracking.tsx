import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { useLanguage } from '@/hooks/useLanguage'
import { managerParentService } from '@/services/manager-parent.service'
import type { MandiagReseller, MandiagLicenseRow } from '@/types/manager-parent.types'

const PERIODS = ['today', 'week', 'month', 'year', 'all'] as const
type Period = typeof PERIODS[number]

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
  all: 'All Time',
}

export function MandiagTrackingPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [period, setPeriod] = useState<Period>('month')
  const [licensePage, setLicensePage] = useState(1)

  const summaryQuery = useQuery({
    queryKey: ['mandiag', 'summary', period],
    queryFn: () => managerParentService.getMandiagSummary(period),
    refetchInterval: 30_000,
  })

  const resellersQuery = useQuery({
    queryKey: ['mandiag', 'resellers', period],
    queryFn: () => managerParentService.getMandiagResellers(period),
    refetchInterval: 30_000,
  })

  const licensesQuery = useQuery({
    queryKey: ['mandiag', 'licenses', licensePage],
    queryFn: () => managerParentService.getMandiagLicenses(licensePage, 25),
    refetchInterval: 30_000,
  })

  const summary = summaryQuery.data
  const resellers = resellersQuery.data ?? []
  const licensePage_data = licensesQuery.data

  const resellerColumns: DataTableColumn<MandiagReseller>[] = [
    { key: 'sub_id', label: 'Sub ID', alwaysVisible: true, render: (row) => row.sub_id },
    { key: 'realname', label: 'Reseller', render: (row) => row.realname ?? row.panel_username ?? row.sub_id },
    { key: 'status', label: 'Status', render: (row) => row.status ?? '—' },
    { key: 'activations', label: 'Activations', render: (row) => row.stats?.activations_count ?? '—' },
    { key: 'revenue', label: 'Revenue', render: (row) => row.stats?.revenue_total != null ? formatCurrency(row.stats.revenue_total, 'USD', locale) : '—' },
    { key: 'manager_cost', label: 'Mandiag Cost', render: (row) => row.stats?.manager_cost_total != null ? formatCurrency(row.stats.manager_cost_total, 'USD', locale) : '—' },
    { key: 'commission', label: 'Commission', render: (row) => row.stats?.commission != null ? formatCurrency(row.stats.commission, 'USD', locale) : '—' },
  ]

  const licenseColumns: DataTableColumn<MandiagLicenseRow>[] = [
    { key: 'license_id', label: 'ID', alwaysVisible: true, render: (row) => row.license_id },
    { key: 'sub_id', label: 'Reseller', render: (row) => row.sub_id ?? '—' },
    { key: 'software', label: 'Software', render: (row) => row.software ?? '—' },
    { key: 'customer', label: 'Customer', render: (row) => row.customer_name ?? row.customer ?? '—' },
    { key: 'hwid', label: 'HWID', render: (row) => row.hwid ?? '—' },
    { key: 'duration', label: 'Duration', render: (row) => row.duration ?? '—' },
    { key: 'price', label: 'Price', render: (row) => row.price != null ? formatCurrency(row.price as number, 'USD', locale) : '—' },
    { key: 'manager_price', label: 'Mandiag Cost', render: (row) => row.manager_price != null ? formatCurrency(row.manager_price as number, 'USD', locale) : '—' },
    { key: 'status', label: 'Status', render: (row) => Array.isArray(row.status) ? row.status.join(', ') : (row.status ?? '—') },
    { key: 'expire_date', label: 'Expires', render: (row) => row.expire_date ?? '—' },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-3xl font-semibold">{t('managerParent.pages.mandiagTracking.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
          {t('managerParent.pages.mandiagTracking.description')}
        </p>
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={[
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              p === period
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
            ].join(' ')}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatsCard
          title={t('managerParent.pages.mandiagTracking.totalRevenue')}
          value={summaryQuery.isLoading ? '...' : formatCurrency(summary?.total_revenue ?? 0, 'USD', locale)}
          color="emerald"
        />
        <StatsCard
          title={t('managerParent.pages.mandiagTracking.mandiagCost')}
          value={summaryQuery.isLoading ? '...' : formatCurrency(summary?.total_manager_cost ?? 0, 'USD', locale)}
          color="rose"
        />
        <StatsCard
          title={t('managerParent.pages.mandiagTracking.netCommission')}
          value={summaryQuery.isLoading ? '...' : formatCurrency(summary?.net_commission ?? 0, 'USD', locale)}
          color="sky"
        />
        <StatsCard
          title={t('managerParent.pages.mandiagTracking.activeResellers')}
          value={summaryQuery.isLoading ? '...' : (summary?.active_resellers ?? 0)}
          color="amber"
        />
        <StatsCard
          title={t('managerParent.pages.mandiagTracking.totalLicenses')}
          value={summaryQuery.isLoading ? '...' : (summary?.total_licenses ?? 0)}
          color="violet"
        />
        <StatsCard
          title={t('managerParent.pages.mandiagTracking.activationsCount')}
          value={summaryQuery.isLoading ? '...' : (summary?.activations_count ?? 0)}
          color="emerald"
        />
      </div>

      {/* Per-reseller table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('managerParent.pages.mandiagTracking.resellersTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable<MandiagReseller>
            tableKey="mandiag-resellers"
            columns={resellerColumns}
            data={resellers}
            isLoading={resellersQuery.isLoading}
            rowKey={(row) => row.sub_id}
          />
        </CardContent>
      </Card>

      {/* Transactions table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('managerParent.pages.mandiagTracking.licensesTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable<MandiagLicenseRow>
            tableKey="mandiag-licenses"
            columns={licenseColumns}
            data={licensePage_data?.licenses ?? []}
            isLoading={licensesQuery.isLoading}
            rowKey={(row) => String(row.license_id)}
          />
          {(licensePage_data?.last_page ?? 1) > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>
                {t('common.page')} {licensePage_data?.current_page ?? licensePage} / {licensePage_data?.last_page ?? '?'}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={licensePage <= 1}
                  onClick={() => setLicensePage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {t('common.previous')}
                </button>
                <button
                  disabled={licensePage >= (licensePage_data?.last_page ?? 1)}
                  onClick={() => setLicensePage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {t('common.next')}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
