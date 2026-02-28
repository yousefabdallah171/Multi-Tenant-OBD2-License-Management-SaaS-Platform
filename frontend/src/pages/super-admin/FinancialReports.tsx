import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, CircleDollarSign, Globe2, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { ExportButtons } from '@/components/shared/ExportButtons'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { useLanguage } from '@/hooks/useLanguage'
import { localizeMonthLabel } from '@/lib/chart-labels'
import { formatCurrency } from '@/lib/utils'
import { reportService } from '@/services/report.service'
import type { FinancialReportPayload } from '@/types/super-admin.types'

export function FinancialReportsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const params = { from: dateRange.from || undefined, to: dateRange.to || undefined }

  const financialQuery = useQuery({
    queryKey: ['super-admin', 'financial-reports', params],
    queryFn: () => reportService.getFinancialReports(params),
  })

  const balancesColumns: Array<DataTableColumn<FinancialReportPayload['reseller_balances'][number]>> = [
    { key: 'reseller', label: t('roles.reseller'), sortable: true, sortValue: (row) => row.reseller ?? '', render: (row) => row.reseller ?? '-' },
    { key: 'tenant', label: t('common.tenant'), sortable: true, sortValue: (row) => row.tenant ?? '', render: (row) => row.tenant ?? '-' },
    { key: 'revenue', label: t('common.revenue'), sortable: true, sortValue: (row) => row.total_revenue, render: (row) => formatCurrency(row.total_revenue, 'USD', locale) },
    { key: 'activations', label: t('common.activations'), sortable: true, sortValue: (row) => row.total_activations, render: (row) => row.total_activations },
    { key: 'avg', label: t('superAdmin.pages.financialReports.avgPrice'), sortable: true, sortValue: (row) => row.avg_price, render: (row) => formatCurrency(row.avg_price, 'USD', locale) },
    { key: 'balance', label: t('superAdmin.pages.financialReports.balance'), sortable: true, sortValue: (row) => row.balance, render: (row) => formatCurrency(row.balance, 'USD', locale) },
  ]

  const data = financialQuery.data?.data
  const breakdownSeries = (data?.revenue_breakdown_series ?? []).map((program) => ({ key: program, label: program, stackId: 'revenue' }))
  const monthlyRevenueData = (data?.monthly_revenue ?? []).map((item) => ({
    ...item,
    month: item.month ? localizeMonthLabel(item.month, locale) : item.month,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold">{t('superAdmin.pages.financialReports.title')}</h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.financialReports.description')}</p>
        </div>
        <ExportButtons onExportCsv={() => reportService.exportFinancialCsv(params)} onExportPdf={() => reportService.exportFinancialPdf(params)} />
      </div>

      <Card>
        <CardContent className="p-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title={t('superAdmin.pages.financialReports.totalPlatformRevenue')} value={formatCurrency(data?.summary.total_platform_revenue ?? 0, 'USD', locale)} icon={Banknote} color="emerald" />
        <StatsCard title={t('superAdmin.pages.financialReports.totalActivations')} value={data?.summary.total_activations ?? 0} icon={Globe2} color="sky" />
        <StatsCard title={t('superAdmin.pages.financialReports.activeLicenses')} value={data?.summary.active_licenses ?? 0} icon={Users} color="amber" />
        <StatsCard title={t('superAdmin.pages.financialReports.avgRevenuePerTenant')} value={formatCurrency(data?.summary.avg_revenue_per_tenant ?? 0, 'USD', locale)} icon={CircleDollarSign} color="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <BarChartWidget
          title={t('superAdmin.pages.financialReports.revenueBreakdown')}
          description={t('superAdmin.pages.financialReports.revenueBreakdownDescription')}
          data={(data?.revenue_breakdown ?? []) as Array<Record<string, string | number | null | undefined>>}
          isLoading={financialQuery.isLoading}
          xKey="tenant"
          series={breakdownSeries}
          showLegend
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <BarChartWidget
          title={t('superAdmin.pages.financialReports.resellerBalancesTitle')}
          description={t('superAdmin.pages.financialReports.resellerBalancesDescription')}
          data={data?.reseller_balances ?? []}
          isLoading={financialQuery.isLoading}
          xKey="reseller"
          horizontal
          showLabels
          series={[{ key: 'balance', label: t('superAdmin.pages.financialReports.balance') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
      </div>

      <LineChartWidget
        title={t('superAdmin.pages.financialReports.monthlyRevenue')}
        data={monthlyRevenueData}
        isLoading={financialQuery.isLoading}
        xKey="month"
        series={[{ key: 'revenue', label: t('common.revenue') }]}
        valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
      />

      <DataTable columns={balancesColumns} data={data?.reseller_balances ?? []} rowKey={(row) => row.id} isLoading={financialQuery.isLoading} />
    </div>
  )
}
