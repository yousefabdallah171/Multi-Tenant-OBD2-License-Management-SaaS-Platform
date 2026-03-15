import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Banknote, ShieldCheck, Target, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { StatusFilterCard } from '@/components/customers/StatusFilterCard'
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
  const period = 'monthly'

  const revenueQuery = useQuery({
    queryKey: ['reseller', 'reports', 'revenue', range.from, range.to, period],
    queryFn: () => resellerService.getRevenueReport({ ...range, period }),
  })
  const summaryQuery = useQuery({
    queryKey: ['reseller', 'reports', 'summary', range.from, range.to, period],
    queryFn: () => resellerService.getReportSummary({ ...range, period }),
  })

  const activationsQuery = useQuery({
    queryKey: ['reseller', 'reports', 'activations', range.from, range.to, period],
    queryFn: () => resellerService.getActivationsReport({ ...range, period }),
  })

  const programsQuery = useQuery({
    queryKey: ['reseller', 'reports', 'top-programs', range.from, range.to],
    queryFn: () => resellerService.getTopPrograms(range),
  })

  const summary = summaryQuery.data?.data
  const hasRange = Boolean(range.from && range.to)
  const activationDetailsUrl = `${routePaths.reseller.activations(lang)}?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
  const presetCards = useMemo(() => {
    const last7 = resolvePresetRange(7)
    const last30 = resolvePresetRange(30)
    const last90 = resolvePresetRange(90)
    const last365 = resolvePresetRange(365)

    return [
      { key: 'last7', label: t('dateRange.last7Days', { defaultValue: 'Last 7 Days' }), value: last7, color: 'sky' as const },
      { key: 'last30', label: t('dateRange.last30Days', { defaultValue: 'Last 30 Days' }), value: last30, color: 'emerald' as const },
      { key: 'last90', label: t('dateRange.last3Months', { defaultValue: 'Last 3 Months' }), value: last90, color: 'amber' as const },
      { key: 'last365', label: t('dateRange.lastYear', { defaultValue: 'Last Year' }), value: last365, color: 'rose' as const },
    ]
  }, [t])
  const activePresetKey = presetCards.find((preset) => preset.value.from === range.from && preset.value.to === range.to)?.key ?? 'custom'

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('roles.reseller')}
        title={t('reseller.pages.reports.title')}
        description={t('reseller.pages.reports.description')}
        actions={<ExportButtons onExportCsv={() => resellerService.exportCsv({ ...range, period })} onExportPdf={() => resellerService.exportPdf({ ...range, period })} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {presetCards.map((preset) => (
          <StatusFilterCard
            key={preset.key}
            label={preset.label}
            isActive={activePresetKey === preset.key}
            onClick={() => setRange(preset.value)}
            color={preset.color}
          />
        ))}
        <StatusFilterCard
          label={t('common.custom', { defaultValue: 'Custom' })}
          isActive={activePresetKey === 'custom'}
          onClick={() => setRange((current) => current)}
          color="slate"
        />
      </div>

      <Card className="border-sky-200/80 dark:border-sky-900/40">
        <CardContent className="p-4">
          <DateRangePicker value={range} onChange={setRange} showPresets={false} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-[1px] dark:from-emerald-950/30 dark:to-emerald-900/20">
          <StatsCard title={t('reseller.pages.reports.totalRevenue')} value={formatCurrency(summary?.total_revenue ?? 0, 'USD', locale)} icon={Banknote} color="emerald" />
        </div>
        <button type="button" className="rounded-3xl bg-gradient-to-br from-cyan-50 to-sky-100/50 p-[1px] text-start dark:from-cyan-950/30 dark:to-sky-900/20" onClick={() => navigate(routePaths.reseller.customers(lang))}>
          <StatsCard title={t('reseller.pages.reports.totalCustomers')} value={summary?.total_customers ?? 0} icon={Users} color="sky" />
        </button>
        <button type="button" className="rounded-3xl bg-gradient-to-br from-amber-50 to-amber-100/50 p-[1px] text-start dark:from-amber-950/30 dark:to-amber-900/20" onClick={() => navigate(`${routePaths.reseller.customers(lang)}?status=active`)}>
          <StatsCard title={t('reseller.pages.reports.activeCustomers')} value={summary?.active_customers ?? summary?.active_licenses ?? 0} icon={ShieldCheck} color="amber" />
        </button>
        <button type="button" className="rounded-3xl bg-gradient-to-br from-sky-50 to-sky-100/50 p-[1px] text-start dark:from-sky-950/30 dark:to-sky-900/20" onClick={() => navigate(activationDetailsUrl)}>
          <StatsCard title={t('reseller.pages.reports.totalActivations')} value={summary?.total_activations ?? 0} icon={Activity} color="rose" />
        </button>
      </div>

      <Card className="border-dashed border-slate-200/80 dark:border-slate-800">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Target className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-950 dark:text-white">{t('reseller.pages.reports.avgPrice')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('reseller.pages.reports.avgPriceHint', { defaultValue: 'Activation revenue divided by activation volume in the selected range.' })}</p>
            </div>
          </div>
          <div className="text-end text-lg font-semibold text-slate-950 dark:text-white">{formatCurrency(summary?.avg_price ?? 0, 'USD', locale)}</div>
        </CardContent>
      </Card>

      <div className="h-px bg-gradient-to-r from-transparent via-sky-300 to-transparent dark:via-sky-800" />

      {!hasRange ? (
        <Card>
          <CardContent className="p-8">
            <EmptyState title={lang === 'ar' ? 'اختر نطاق تاريخ لعرض الرسوم' : 'Pick a date range to render charts'} description={lang === 'ar' ? 'حدد تاريخ البداية والنهاية لعرض بيانات التقارير.' : 'Select a start and end date to render the report data.'} icon={Activity} />
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
