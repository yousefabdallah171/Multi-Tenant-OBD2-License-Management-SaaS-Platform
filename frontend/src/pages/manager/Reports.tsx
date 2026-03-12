import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Banknote, ShieldCheck, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { ExportButtons } from '@/components/shared/ExportButtons'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { useLanguage } from '@/hooks/useLanguage'
import { localizeMonthLabel } from '@/lib/chart-labels'
import { formatCurrency } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'
import type { FinancialReportData } from '@/types/manager-parent.types'

export function ReportsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [range, setRange] = useState<DateRangeValue>(() => resolvePresetRange(365))

  const reportQuery = useQuery({
    queryKey: ['manager', 'financial-reports', range.from, range.to],
    queryFn: () => managerService.getFinancialReports(range),
  })
  const retentionQuery = useQuery({
    queryKey: ['manager', 'reports', 'retention', range.from, range.to],
    queryFn: () => managerService.getRetention(range),
  })

  const report = reportQuery.data?.data
  const monthlyRevenueSeries = (report?.monthly_revenue ?? []).map((item) => ({
    ...item,
    month: item.month ? localizeMonthLabel(item.month, locale) : item.month,
  }))
  const retentionSeries = (retentionQuery.data?.data ?? []).map((item) => ({
    ...item,
    month: item.month ? localizeMonthLabel(item.month, locale) : item.month,
  }))
  const activationsDetailsUrl = buildQueryUrl(routePaths.manager.resellerLogs(lang), {
    action: 'license.activated',
    from: range.from,
    to: range.to,
  })

  const columns = useMemo<Array<DataTableColumn<FinancialReportData['reseller_balances'][number]>>>(
    () => [
      { key: 'reseller', label: t('managerParent.pages.financialReports.columns.reseller'), sortable: true, sortValue: (row) => row.reseller, render: (row) => row.reseller },
      { key: 'revenue', label: t('managerParent.pages.financialReports.columns.totalRevenue'), sortable: true, sortValue: (row) => row.total_revenue, render: (row) => formatCurrency(row.total_revenue, 'USD', locale) },
      { key: 'activations', label: t('common.activations'), sortable: true, sortValue: (row) => row.total_activations, render: (row) => row.total_activations },
      { key: 'avgPrice', label: t('managerParent.pages.financialReports.columns.avgPrice'), sortable: true, sortValue: (row) => row.avg_price, render: (row) => formatCurrency(row.avg_price, 'USD', locale) },
      { key: 'commission', label: t('managerParent.pages.financialReports.columns.commission'), sortable: true, sortValue: (row) => row.commission, render: (row) => formatCurrency(row.commission, 'USD', locale) },
    ],
    [locale, t],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('manager.layout.eyebrow')}
        title={t('managerParent.pages.financialReports.title')}
        description={t('managerParent.pages.financialReports.description')}
        actions={<ExportButtons onExportCsv={() => managerService.exportFinancialCsv(range)} onExportPdf={() => managerService.exportFinancialPdf(range)} />}
      />

      <Card>
        <CardContent className="p-4">
          <DateRangePicker value={range} onChange={setRange} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatsCard title={t('managerParent.pages.financialReports.totalTenantRevenue')} value={formatCurrency(report?.summary.total_revenue ?? 0, 'USD', locale)} icon={Banknote} color="emerald" />
        <button type="button" className="w-full text-start" onClick={() => navigate(routePaths.manager.customers(lang))}>
          <StatsCard title={t('managerParent.pages.financialReports.totalCustomers')} value={report?.summary.total_customers ?? 0} icon={Users} color="sky" />
        </button>
        <button type="button" className="w-full text-start" onClick={() => navigate(`${routePaths.manager.customers(lang)}?status=active`)}>
          <StatsCard title={t('managerParent.pages.financialReports.activeCustomers')} value={report?.summary.active_customers ?? report?.summary.active_licenses ?? 0} icon={ShieldCheck} color="amber" />
        </button>
        <button type="button" className="w-full text-start" onClick={() => navigate(activationsDetailsUrl)}>
          <StatsCard title={t('managerParent.pages.financialReports.totalActivations')} value={report?.summary.total_activations ?? 0} icon={Activity} color="rose" />
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <BarChartWidget
          title={t('managerParent.pages.financialReports.revenueByReseller')}
          data={report?.revenue_by_reseller ?? []}
          isLoading={reportQuery.isLoading}
          xKey="reseller"
          horizontal
          showLabels
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <BarChartWidget
          title={t('managerParent.pages.financialReports.revenueByProgram')}
          data={report?.revenue_by_program ?? []}
          isLoading={reportQuery.isLoading}
          xKey="program"
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LineChartWidget
          title={t('managerParent.pages.financialReports.monthlyRevenueTrend')}
          data={monthlyRevenueSeries}
          isLoading={reportQuery.isLoading}
          xKey="month"
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <BarChartWidget
          title={t('managerParent.pages.financialReports.resellerBalances')}
          data={report?.reseller_balances ?? []}
          isLoading={reportQuery.isLoading}
          xKey="reseller"
          horizontal
          showLabels
          series={[{ key: 'total_revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
      </div>

      <LineChartWidget
        title={t('managerParent.pages.reports.customerRetention')}
        data={retentionSeries}
        isLoading={retentionQuery.isLoading}
        xKey="month"
        series={[{ key: 'customers', label: t('managerParent.pages.reports.customersLabel') }]}
      />

      <Card>
        <CardContent className="p-6">
          <h3 className="mb-4 text-lg font-semibold">{t('managerParent.pages.financialReports.resellerBalances')}</h3>
          <DataTable columns={columns} data={report?.reseller_balances ?? []} rowKey={(row) => row.id} isLoading={reportQuery.isLoading} />
        </CardContent>
      </Card>
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

function buildQueryUrl(basePath: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value)
    }
  })

  const query = search.toString()
  return query === '' ? basePath : `${basePath}?${query}`
}
