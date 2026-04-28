import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Banknote, KeyRound, ShieldCheck, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { StatsCard } from '@/components/shared/StatsCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { localizeMonthLabel } from '@/lib/chart-labels'
import { formatActivityActionLabel, formatCurrency, formatDate } from '@/lib/utils'
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
  const currentMonthRange = useMemo(() => {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), 1)

    return {
      from: formatDateInput(start),
      to: formatDateInput(today),
    }
  }, [])
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
            <Button type="button" onClick={() => navigate(routePaths.reseller.customers(lang))}>
              {t('reseller.pages.dashboard.actions.customers')}
            </Button>
            <Button type="button" onClick={() => navigate(routePaths.reseller.reports(lang))}>
              {t('reseller.pages.dashboard.actions.reports')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {statsQuery.isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard className="xl:col-span-2" />
          </>
        ) : (
          <>
            <button type="button" className="h-full text-start" onClick={() => navigate(routePaths.reseller.customers(lang))}>
              <StatsCard title={t('reseller.pages.dashboard.customers')} value={stats?.customers ?? 0} color="sky" />
            </button>
            <button type="button" className="h-full text-start" onClick={() => navigate(`${routePaths.reseller.customers(lang)}?status=active`)}>
              <StatsCard title={t('reseller.pages.dashboard.activeCustomers')} value={stats?.active_licenses ?? 0} color="emerald" />
            </button>
            <button type="button" className="h-full text-start" onClick={() => navigate(`${routePaths.reseller.activations(lang)}?from=${encodeURIComponent(currentMonthRange.from)}&to=${encodeURIComponent(currentMonthRange.to)}`)}>
              <StatsCard title={t('reseller.pages.dashboard.monthlyActivations')} value={stats?.monthly_activations ?? 0} color="amber" />
            </button>
            <div className="col-span-2 h-full xl:col-span-2">
              <StatsCard title={t('common.revenue')} value={formatCurrency(stats?.revenue ?? 0, 'USD', locale)} color="rose" />
            </div>
          </>
        )}
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
              <div key={entry.id} className={`rounded-2xl border p-4 ${resolveActivityStyles(entry.action).container}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${resolveActivityStyles(entry.action).badge}`}>
                      {resolveActivityStyles(entry.action).icon}
                    </span>
                    <p className="font-medium text-slate-950 dark:text-white">{formatActivityActionLabel(entry.action, t)}</p>
                    {entry.description ? <p className="text-sm text-slate-500 dark:text-slate-400">{entry.description}</p> : null}
                  </div>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-sky-100 bg-gradient-to-r from-sky-100 via-cyan-50 to-blue-100 py-4 dark:border-sky-900/40 dark:from-sky-950/40 dark:via-slate-900 dark:to-sky-950/30">
            <CardTitle className="text-lg">{t('reseller.pages.dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button type="button" className="w-full justify-between transition-shadow hover:shadow-md" onClick={() => navigate(routePaths.reseller.customerCreate(lang))}>
              {t('reseller.pages.dashboard.quickActionsList.activateNewCustomer')}
              <ActionIcon className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-between transition-shadow hover:shadow-md" onClick={() => navigate(routePaths.reseller.reports(lang))}>
              {t('reseller.pages.dashboard.quickActionsList.exportReports')}
              <ActionIcon className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatDateInput(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function resolveActivityStyles(action: string) {
  if (action.includes('activate')) {
    return {
      container: 'border-emerald-200 border-s-4 border-s-emerald-500 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
      icon: <ShieldCheck className="h-4 w-4" />,
    }
  }
  if (action.includes('deactivate')) {
    return {
      container: 'border-rose-200 border-s-4 border-s-rose-500 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20',
      badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
      icon: <KeyRound className="h-4 w-4" />,
    }
  }
  if (action.includes('renew')) {
    return {
      container: 'border-sky-200 border-s-4 border-s-sky-500 bg-sky-50/50 dark:border-sky-900/50 dark:bg-sky-950/20',
      badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
      icon: <Banknote className="h-4 w-4" />,
    }
  }
  return {
    container: 'border-slate-200 border-s-4 border-s-slate-400 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/30',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
    icon: <UserRound className="h-4 w-4" />,
  }
}


