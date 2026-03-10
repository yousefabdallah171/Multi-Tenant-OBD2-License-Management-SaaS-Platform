import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Banknote, Target } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ExportButtons } from '@/components/shared/ExportButtons'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { resellerService } from '@/services/reseller.service'

export function ReportsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [range, setRange] = useState<DateRangeValue>(() => resolvePresetRange(365))
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

  const totalRevenue = useMemo(() => (revenueQuery.data?.data ?? []).reduce((sum, item) => sum + item.revenue, 0), [revenueQuery.data?.data])
  const totalActivations = useMemo(() => (activationsQuery.data?.data ?? []).reduce((sum, item) => sum + item.count, 0), [activationsQuery.data?.data])
  const avgPrice = totalActivations > 0 ? totalRevenue / totalActivations : 0
  const hasRange = Boolean(range.from && range.to)
  const activationDetailsUrl = `${routePaths.reseller.activations(lang)}?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('roles.reseller')}
        title={t('reseller.pages.reports.title')}
        description={t('reseller.pages.reports.description')}
        actions={<ExportButtons onExportCsv={() => resellerService.exportCsv({ ...range, period })} onExportPdf={() => resellerService.exportPdf({ ...range, period })} />}
      />

      <Card className="border-sky-200/80 dark:border-sky-900/40">
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

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-[1px] dark:from-emerald-950/30 dark:to-emerald-900/20">
          <StatsCard title={t('reseller.pages.reports.totalRevenue')} value={formatCurrency(totalRevenue, 'USD', locale)} icon={Banknote} color="emerald" />
        </div>
        <button type="button" className="rounded-3xl bg-gradient-to-br from-sky-50 to-sky-100/50 p-[1px] text-start dark:from-sky-950/30 dark:to-sky-900/20" onClick={() => navigate(activationDetailsUrl)}>
          <StatsCard title={t('reseller.pages.reports.totalActivations')} value={totalActivations} icon={Activity} color="sky" />
        </button>
        <div className="rounded-3xl bg-gradient-to-br from-amber-50 to-amber-100/50 p-[1px] dark:from-amber-950/30 dark:to-amber-900/20">
          <StatsCard title={t('reseller.pages.reports.avgPrice')} value={formatCurrency(avgPrice, 'USD', locale)} icon={Target} color="amber" />
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-sky-300 to-transparent dark:via-sky-800" />

      {!hasRange ? (
        <Card>
          <CardContent className="p-8">
            <EmptyState title={lang === 'ar' ? 'اختر نطاق تاريخ لعرض الرسوم' : 'Pick a date range to render charts'} description={lang === 'ar' ? 'حدد تاريخ البداية والنهاية ثم اختر الفترة الزمنية.' : 'Select start and end dates, then choose your reporting period.'} icon={Activity} />
          </CardContent>
        </Card>
      ) : null}

      {hasRange ? (
        <>
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
        </>
      ) : null}
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
