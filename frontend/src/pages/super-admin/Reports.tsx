import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, CircleDollarSign, Gift, Globe2, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { ExportButtons } from '@/components/shared/ExportButtons'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { useLanguage } from '@/hooks/useLanguage'
import { localizeMonthLabel } from '@/lib/chart-labels'
import { formatCurrency } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { reportService } from '@/services/report.service'
import type { FinancialReportPayload } from '@/types/super-admin.types'

export function ReportsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => resolvePresetRange(365))
  const params = useMemo(
    () => ({
      from: dateRange.from || undefined,
      to: dateRange.to || undefined,
    }),
    [dateRange],
  )

  const financialQuery = useQuery({
    queryKey: ['super-admin', 'financial-reports', params],
    queryFn: () => reportService.getFinancialReports(params),
  })

  const revenueQuery = useQuery({
    queryKey: ['super-admin', 'reports', 'revenue', params],
    queryFn: () => reportService.getRevenue(params),
  })

  const activationsQuery = useQuery({
    queryKey: ['super-admin', 'reports', 'activations', params],
    queryFn: () => reportService.getActivations(params),
  })

  const growthQuery = useQuery({
    queryKey: ['super-admin', 'reports', 'growth', params],
    queryFn: () => reportService.getGrowth(params),
  })

  const topResellersQuery = useQuery({
    queryKey: ['super-admin', 'reports', 'top-resellers', params],
    queryFn: () => reportService.getTopResellers(params),
  })

  const financialData = financialQuery.data?.data
  const breakdownSeries = (financialData?.revenue_breakdown_series ?? []).map((program) => ({ key: program, label: program, stackId: 'revenue' }))
  const monthlyRevenueData = (financialData?.monthly_revenue ?? []).map((item) => ({
    ...item,
    month: item.month ? localizeMonthLabel(item.month, locale) : item.month,
  }))

  const balanceColumns: Array<DataTableColumn<FinancialReportPayload['reseller_balances'][number]>> = [
    { key: 'reseller', label: t('roles.reseller'), sortable: true, sortValue: (row) => row.reseller ?? '', render: (row) => row.reseller ?? '-' },
    { key: 'tenant', label: t('common.tenant'), sortable: true, sortValue: (row) => row.tenant ?? '', render: (row) => row.tenant ?? '-' },
    { key: 'revenue', label: t('common.revenue'), sortable: true, sortValue: (row) => row.total_revenue, render: (row) => formatCurrency(row.total_revenue, 'USD', locale) },
    { key: 'activations', label: t('common.activations'), sortable: true, sortValue: (row) => row.total_activations, render: (row) => row.total_activations },
    { key: 'avg', label: t('superAdmin.pages.financialReports.avgPrice'), sortable: true, sortValue: (row) => row.avg_price, render: (row) => formatCurrency(row.avg_price, 'USD', locale) },
    { key: 'balance', label: t('superAdmin.pages.financialReports.balance'), sortable: true, sortValue: (row) => row.balance, render: (row) => formatCurrency(row.balance, 'USD', locale) },
  ]

  const resellerColumns: Array<DataTableColumn<{ reseller: string; tenant: string; activations: number; revenue: number }>> = [
    { key: 'reseller', label: t('superAdmin.pages.reports.topResellers'), sortable: true, sortValue: (row) => row.reseller, render: (row) => row.reseller },
    { key: 'tenant', label: t('common.tenant'), sortable: true, sortValue: (row) => row.tenant, render: (row) => row.tenant },
    { key: 'activations', label: t('common.activations'), sortable: true, sortValue: (row) => row.activations, render: (row) => row.activations },
    { key: 'revenue', label: t('common.revenue'), sortable: true, sortValue: (row) => row.revenue, render: (row) => formatCurrency(row.revenue, 'USD', locale) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold">{t('superAdmin.pages.reports.title')}</h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.reports.description')}</p>
        </div>
        <ExportButtons onExportCsv={() => reportService.exportFinancialCsv(params)} onExportPdf={() => reportService.exportFinancialPdf(params)} />
      </div>

      <Card>
        <CardContent className="p-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <button type="button" className="w-full text-start" onClick={() => navigate(routePaths.superAdmin.tenants(lang))}><StatsCard title={t('superAdmin.pages.financialReports.totalPlatformRevenue')} value={formatCurrency(financialData?.summary.total_platform_revenue ?? 0, 'USD', locale)} icon={Banknote} color="emerald" /></button>
        <div className="w-full"><StatsCard title={t('superAdmin.pages.financialReports.grantedValue', { defaultValue: 'Granted Value' })} value={formatCurrency(financialData?.summary.granted_value ?? 0, 'USD', locale)} icon={Gift} color="rose" /></div>
        <button type="button" className="w-full text-start" onClick={() => navigate(routePaths.superAdmin.customers(lang))}><StatsCard title={t('superAdmin.pages.financialReports.totalCustomers')} value={financialData?.summary.total_customers ?? 0} icon={Globe2} color="sky" /></button>
        <button type="button" className="w-full text-start" onClick={() => navigate(`${routePaths.superAdmin.customers(lang)}?status=active`)}><StatsCard title={t('superAdmin.pages.financialReports.activeCustomers')} value={financialData?.summary.active_licenses ?? 0} icon={Users} color="amber" /></button>
        <button type="button" className="w-full text-start" onClick={() => navigate(routePaths.superAdmin.tenants(lang))}><StatsCard title={t('superAdmin.pages.financialReports.avgRevenuePerTenant')} value={formatCurrency(financialData?.summary.avg_revenue_per_tenant ?? 0, 'USD', locale)} icon={CircleDollarSign} color="rose" /></button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <BarChartWidget
          title={t('superAdmin.pages.financialReports.revenueBreakdown')}
          description={t('superAdmin.pages.financialReports.revenueBreakdownDescription')}
          data={(financialData?.revenue_breakdown ?? []) as Array<Record<string, string | number | null | undefined>>}
          isLoading={financialQuery.isLoading}
          xKey="tenant"
          series={breakdownSeries}
          showLegend
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <BarChartWidget
          title={t('superAdmin.pages.financialReports.resellerBalancesTitle')}
          description={t('superAdmin.pages.financialReports.resellerBalancesDescription')}
          data={financialData?.reseller_balances ?? []}
          isLoading={financialQuery.isLoading}
          xKey="reseller"
          horizontal
          showLabels
          series={[{ key: 'balance', label: t('superAdmin.pages.financialReports.balance') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <BarChartWidget
          title={t('superAdmin.pages.reports.revenueByTenant')}
          data={revenueQuery.data?.data ?? []}
          isLoading={revenueQuery.isLoading}
          xKey="tenant"
          horizontal
          showLabels
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <BarChartWidget
          title={t('superAdmin.pages.reports.activationsByTenant')}
          data={activationsQuery.data?.data ?? []}
          isLoading={activationsQuery.isLoading}
          xKey="tenant"
          series={[{ key: 'activations', label: t('common.activations') }]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LineChartWidget
          title={t('superAdmin.pages.financialReports.monthlyRevenue')}
          data={monthlyRevenueData}
          isLoading={financialQuery.isLoading}
          xKey="month"
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <LineChartWidget
          title={t('superAdmin.pages.reports.growthTrend')}
          data={growthQuery.data?.data ?? []}
          isLoading={growthQuery.isLoading}
          xKey="month"
          series={[{ key: 'users', label: t('common.users') }]}
        />
      </div>

      <DataTable columns={balanceColumns} data={financialData?.reseller_balances ?? []} rowKey={(row) => row.id} isLoading={financialQuery.isLoading} />
      <DataTable columns={resellerColumns} data={topResellersQuery.data?.data ?? []} rowKey={(row) => `${row.tenant}-${row.reseller}`} isLoading={topResellersQuery.isLoading} />
    </div>
  )
}

function resolvePresetRange(days: number): DateRangeValue {
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - (days - 1))

  return {
    from: formatDateInput(from),
    to: formatDateInput(today),
  }
}

function formatDateInput(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
