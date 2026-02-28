import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Banknote, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { PieChartWidget } from '@/components/charts/PieChartWidget'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { ExportButtons } from '@/components/shared/ExportButtons'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { useLanguage } from '@/hooks/useLanguage'
import { localizeMonthLabel } from '@/lib/chart-labels'
import { formatCurrency } from '@/lib/utils'
import { managerParentService } from '@/services/manager-parent.service'

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

  const revenueByResellerQuery = useQuery({
    queryKey: ['manager-parent', 'reports', 'revenue-by-reseller', range.from, range.to],
    queryFn: () => managerParentService.getRevenueByReseller(range),
  })

  const revenueByProgramQuery = useQuery({
    queryKey: ['manager-parent', 'reports', 'revenue-by-program', range.from, range.to],
    queryFn: () => managerParentService.getRevenueByProgram(range),
  })

  const activationRateQuery = useQuery({
    queryKey: ['manager-parent', 'reports', 'activation-rate', range.from, range.to],
    queryFn: () => managerParentService.getActivationRate(range),
  })

  const retentionQuery = useQuery({
    queryKey: ['manager-parent', 'reports', 'retention', range.from, range.to],
    queryFn: () => managerParentService.getRetention(range),
  })

  const totalRevenue = useMemo(() => (revenueByResellerQuery.data?.data ?? []).reduce((sum, item) => sum + item.revenue, 0), [revenueByResellerQuery.data?.data])
  const totalActivations = useMemo(() => (revenueByResellerQuery.data?.data ?? []).reduce((sum, item) => sum + item.activations, 0), [revenueByResellerQuery.data?.data])
  const successRate = activationRateQuery.data?.data.find((item) => item.label === 'Success')?.percentage ?? 0
  const activationRateSeries = (activationRateQuery.data?.data ?? []).map((item) => ({
    ...item,
    label: localizeActivationLabel(item.label, t),
  }))
  const retentionSeries = (retentionQuery.data?.data ?? []).map((item) => ({
    ...item,
    month: item.month ? localizeMonthLabel(item.month, locale) : item.month,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('managerParent.pages.reports.title')}
        description={t('managerParent.pages.reports.description')}
        actions={<ExportButtons onExportCsv={() => managerParentService.exportReportsCsv(range)} onExportPdf={() => managerParentService.exportReportsPdf(range)} />}
      />

      <Card>
        <CardContent className="p-4">
          <DateRangePicker value={range} onChange={setRange} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard title={t('managerParent.pages.reports.totalRevenue')} value={formatCurrency(totalRevenue, 'USD', locale)} icon={Banknote} color="emerald" />
        <StatsCard title={t('managerParent.pages.reports.totalActivations')} value={totalActivations} icon={Activity} color="sky" />
        <StatsCard title={t('managerParent.pages.reports.successRate')} value={`${successRate.toFixed(1)}%`} icon={CheckCircle2} color="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PieChartWidget
          title={t('managerParent.pages.reports.revenueByReseller')}
          description={t('managerParent.pages.reports.revenueByResellerDescription')}
          data={revenueByResellerQuery.data?.data ?? []}
          nameKey="reseller"
          valueKey="revenue"
          isLoading={revenueByResellerQuery.isLoading}
          totalLabel={t('common.revenue')}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <BarChartWidget
          title={t('managerParent.pages.reports.revenueByProgram')}
          data={revenueByProgramQuery.data?.data ?? []}
          isLoading={revenueByProgramQuery.isLoading}
          xKey="program"
          series={[{ key: 'revenue', label: t('common.revenue') }]}
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
    </div>
  )
}
