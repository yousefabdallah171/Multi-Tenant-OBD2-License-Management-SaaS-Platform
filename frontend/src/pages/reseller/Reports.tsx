import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Banknote, Target } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { ExportButtons } from '@/components/shared/ExportButtons'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/utils'
import { resellerService } from '@/services/reseller.service'

export function ReportsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')

  const revenueQuery = useQuery({
    queryKey: ['reseller', 'reports', 'revenue', range.from, range.to, period],
    queryFn: () => resellerService.getRevenueReport({ ...range, period }),
  })

  const activationsQuery = useQuery({
    queryKey: ['reseller', 'reports', 'activations', range.from, range.to, period],
    queryFn: () => resellerService.getActivationsReport({ ...range, period }),
  })

  const programsQuery = useQuery({
    queryKey: ['reseller', 'reports', 'top-programs', range.from, range.to],
    queryFn: () => resellerService.getTopPrograms(range),
  })

  const statsQuery = useQuery({
    queryKey: ['reseller', 'reports', 'dashboard-stats'],
    queryFn: () => resellerService.getDashboardStats(),
  })

  const totalRevenue = useMemo(() => (revenueQuery.data?.data ?? []).reduce((sum, item) => sum + item.revenue, 0), [revenueQuery.data?.data])
  const totalActivations = useMemo(() => (activationsQuery.data?.data ?? []).reduce((sum, item) => sum + item.count, 0), [activationsQuery.data?.data])
  const avgPrice = totalActivations > 0 ? totalRevenue / totalActivations : 0
  const successRate = totalActivations > 0 ? ((statsQuery.data?.stats.active_licenses ?? 0) / totalActivations) * 100 : 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('roles.reseller')}
        title={t('reseller.pages.reports.title')}
        description={t('reseller.pages.reports.description')}
        actions={<ExportButtons onExportCsv={() => resellerService.exportCsv({ ...range, period })} onExportPdf={() => resellerService.exportPdf({ ...range, period })} />}
      />

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <DateRangePicker value={range} onChange={setRange} />
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as 'daily' | 'weekly' | 'monthly')}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="daily">{t('reseller.pages.reports.daily')}</option>
            <option value="weekly">{t('reseller.pages.reports.weekly')}</option>
            <option value="monthly">{t('reseller.pages.reports.monthly')}</option>
          </select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatsCard title={t('reseller.pages.reports.totalRevenue')} value={formatCurrency(totalRevenue, 'USD', locale)} icon={Banknote} color="emerald" />
        <StatsCard title={t('reseller.pages.reports.totalActivations')} value={totalActivations} icon={Activity} color="sky" />
        <StatsCard title={t('reseller.pages.reports.avgPrice')} value={formatCurrency(avgPrice, 'USD', locale)} icon={Target} color="amber" />
        <StatsCard title={t('reseller.pages.reports.successRate')} value={`${Math.max(0, Math.min(100, successRate)).toFixed(1)}%`} icon={Target} color="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LineChartWidget
          title={t('common.revenue')}
          data={revenueQuery.data?.data ?? []}
          isLoading={revenueQuery.isLoading}
          xKey="period"
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <BarChartWidget
          title={t('reseller.pages.reports.activationCount')}
          data={activationsQuery.data?.data ?? []}
          isLoading={activationsQuery.isLoading}
          xKey="period"
          series={[{ key: 'count', label: t('reseller.pages.reports.activationCount') }]}
        />
      </div>

      <BarChartWidget
        title={t('reseller.pages.reports.topPrograms')}
        data={programsQuery.data?.data ?? []}
        isLoading={programsQuery.isLoading}
        xKey="program"
        horizontal
        showLabels
        series={[{ key: 'revenue', label: t('common.revenue') }]}
        valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
      />
    </div>
  )
}
