import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Banknote, CheckCircle2, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { PieChartWidget } from '@/components/charts/PieChartWidget'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { ExportButtons } from '@/components/shared/ExportButtons'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { useLanguage } from '@/hooks/useLanguage'
import { localizeMonthLabel } from '@/lib/chart-labels'
import { formatCurrency } from '@/lib/utils'
import { managerService } from '@/services/manager.service'
import type { FinancialReportData } from '@/types/manager-parent.types'

function localizeActivationLabel(label: string, t: ReturnType<typeof useTranslation>['t']) {
  if (label === 'Success') {
    return t('managerParent.pages.reports.success')
  }

  if (label === 'Failure') {
    return t('managerParent.pages.reports.failure')
  }

  return label
}

export function ReportsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })

  const reportQuery = useQuery({
    queryKey: ['manager', 'financial-reports', range.from, range.to],
    queryFn: () => managerService.getFinancialReports(range),
  })
  const activationRateQuery = useQuery({
    queryKey: ['manager', 'reports', 'activation-rate', range.from, range.to],
    queryFn: () => managerService.getActivationRate(range),
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
  const activationRateSeries = (activationRateQuery.data?.data ?? []).map((item) => ({
    ...item,
    label: localizeActivationLabel(item.label, t),
  }))
  const retentionSeries = (retentionQuery.data?.data ?? []).map((item) => ({
    ...item,
    month: item.month ? localizeMonthLabel(item.month, locale) : item.month,
  }))
  const successRate = activationRateQuery.data?.data.find((item) => item.label === 'Success')?.percentage ?? 0

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
        <StatsCard title={t('managerParent.pages.financialReports.totalActivations')} value={report?.summary.total_activations ?? 0} icon={Activity} color="sky" />
        <StatsCard title={t('managerParent.pages.financialReports.activeLicenses')} value={report?.summary.active_licenses ?? 0} icon={ShieldCheck} color="amber" />
        <StatsCard title={t('managerParent.pages.reports.successRate')} value={`${successRate.toFixed(1)}%`} icon={CheckCircle2} color="rose" />
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

      <div className="grid gap-6 xl:grid-cols-2">
        <PieChartWidget
          title={t('managerParent.pages.reports.activationQuality')}
          data={activationRateSeries}
          nameKey="label"
          valueKey="count"
          isLoading={activationRateQuery.isLoading}
          totalLabel={t('managerParent.pages.reports.attempts')}
        />
        <LineChartWidget
          title={t('managerParent.pages.reports.customerRetention')}
          data={retentionSeries}
          isLoading={retentionQuery.isLoading}
          xKey="month"
          series={[{ key: 'customers', label: t('managerParent.pages.reports.customersLabel') }]}
        />
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="mb-4 text-lg font-semibold">{t('managerParent.pages.financialReports.resellerBalances')}</h3>
          <DataTable columns={columns} data={report?.reseller_balances ?? []} rowKey={(row) => row.id} isLoading={reportQuery.isLoading} />
        </CardContent>
      </Card>
    </div>
  )
}
