import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Banknote, KeyRound, ShieldCheck, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatsCard } from '@/components/shared/StatsCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { localizeMonthLabel } from '@/lib/chart-labels'
import { formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { resellerService } from '@/services/reseller.service'

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lang, isRtl } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const ActionIcon = isRtl ? ArrowLeft : ArrowRight

  const statsQuery = useQuery({
    queryKey: ['reseller', 'dashboard', 'stats'],
    queryFn: () => resellerService.getDashboardStats(),
  })

  const activationsQuery = useQuery({
    queryKey: ['reseller', 'dashboard', 'activations-chart'],
    queryFn: () => resellerService.getActivationsChart(),
  })

  const revenueQuery = useQuery({
    queryKey: ['reseller', 'dashboard', 'revenue-chart'],
    queryFn: () => resellerService.getRevenueChart(),
  })

  const activityQuery = useQuery({
    queryKey: ['reseller', 'dashboard', 'recent-activity'],
    queryFn: () => resellerService.getRecentActivity(),
  })

  const stats = statsQuery.data?.stats
  const recentActivity = activityQuery.data?.data ?? []
  const activationSeries = (activationsQuery.data?.data ?? []).map((point) => ({
    ...point,
    month: point.month ? localizeMonthLabel(point.month, locale) : point.month,
  }))
  const revenueSeries = (revenueQuery.data?.data ?? []).map((point) => ({
    ...point,
    month: point.month ? localizeMonthLabel(point.month, locale) : point.month,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('roles.reseller')}
        title={t('reseller.pages.dashboard.title')}
        description={t('reseller.pages.dashboard.description')}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => navigate(routePaths.reseller.customers(lang))}>
              {t('reseller.pages.dashboard.actions.customers')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(routePaths.reseller.licenses(lang))}>
              {t('reseller.pages.dashboard.actions.licenses')}
            </Button>
            <Button type="button" onClick={() => navigate(routePaths.reseller.reports(lang))}>
              {t('reseller.pages.dashboard.actions.reports')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title={t('reseller.pages.dashboard.customers')} value={stats?.customers ?? 0} icon={UserRound} color="sky" />
        <StatsCard title={t('reseller.pages.dashboard.activeLicenses')} value={stats?.active_licenses ?? 0} icon={ShieldCheck} color="emerald" />
        <StatsCard title={t('common.revenue')} value={formatCurrency(stats?.revenue ?? 0, 'USD', locale)} icon={Banknote} color="rose" />
        <StatsCard title={t('reseller.pages.dashboard.monthlyActivations')} value={stats?.monthly_activations ?? 0} icon={KeyRound} color="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LineChartWidget
          title={t('reseller.pages.dashboard.activationTrend')}
          data={activationSeries}
          isLoading={activationsQuery.isLoading}
          xKey="month"
          series={[{ key: 'count', label: t('common.activations') }]}
        />
        <LineChartWidget
          title={t('reseller.pages.dashboard.revenueTrend')}
          data={revenueSeries}
          isLoading={revenueQuery.isLoading}
          xKey="month"
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('reseller.pages.dashboard.recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length === 0 && !activityQuery.isLoading ? (
              <EmptyState title={t('reseller.pages.dashboard.noActivityTitle')} description={t('reseller.pages.dashboard.noActivityDescription')} />
            ) : null}
            {recentActivity.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-950 dark:text-white">{entry.action}</p>
                    {entry.description ? <p className="text-sm text-slate-500 dark:text-slate-400">{entry.description}</p> : null}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('reseller.pages.dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button type="button" className="w-full justify-between" onClick={() => navigate(routePaths.reseller.customers(lang))}>
              {t('reseller.pages.dashboard.quickActionsList.activateNewCustomer')}
              <ActionIcon className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => navigate(routePaths.reseller.licenses(lang))}>
              {t('reseller.pages.dashboard.quickActionsList.manageLicenses')}
              <ActionIcon className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => navigate(routePaths.reseller.reports(lang))}>
              {t('reseller.pages.dashboard.quickActionsList.exportReports')}
              <ActionIcon className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
