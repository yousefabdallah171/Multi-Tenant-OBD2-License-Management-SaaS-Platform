import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Banknote, ShieldCheck, UserRound, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatsCard } from '@/components/shared/StatsCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { localizeMonthLabel } from '@/lib/chart-labels'
import { formatActivityActionLabel, formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lang, isRtl } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const ActionIcon = isRtl ? ArrowLeft : ArrowRight

  const statsQuery = useQuery({
    queryKey: ['manager', 'dashboard'],
    queryFn: () => managerService.getDashboard(),
  })

  const stats = statsQuery.data?.stats
  const recentActivity = statsQuery.data?.recentActivity ?? []
  const activationSeries = (statsQuery.data?.activationsChart ?? []).map((point) => ({
    ...point,
    month: point.month ? localizeMonthLabel(point.month, locale) : point.month,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('manager.layout.eyebrow')}
        title={t('manager.pages.dashboard.title')}
        description={t('manager.pages.dashboard.description')}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => navigate(routePaths.manager.team(lang))}>
              {t('manager.pages.dashboard.actions.team')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(routePaths.manager.customers(lang))}>
              {t('manager.pages.dashboard.quickActions.customerOverview')}
            </Button>
            <Button type="button" onClick={() => navigate(routePaths.manager.reports(lang))}>
              {t('manager.pages.dashboard.actions.reports')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <button type="button" className="text-start" onClick={() => navigate(routePaths.manager.team(lang))}>
          <StatsCard title={t('manager.pages.dashboard.teamResellers')} value={stats?.team_resellers ?? 0} icon={Users} color="sky" />
        </button>
        <button type="button" className="text-start" onClick={() => navigate(routePaths.manager.customers(lang))}>
          <StatsCard title={t('manager.pages.dashboard.teamCustomers')} value={stats?.team_customers ?? 0} icon={UserRound} color="emerald" />
        </button>
        <button type="button" className="text-start" onClick={() => navigate(`${routePaths.manager.customers(lang)}?status=active`)}>
          <StatsCard title={t('manager.pages.dashboard.activeLicenses')} value={stats?.active_licenses ?? 0} icon={ShieldCheck} color="amber" />
        </button>
        <button type="button" className="text-start" onClick={() => navigate(routePaths.manager.reports(lang))}>
          <StatsCard title={t('manager.pages.dashboard.teamRevenue')} value={formatCurrency(stats?.team_revenue ?? 0, 'USD', locale)} icon={Banknote} color="rose" />
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LineChartWidget
          title={t('manager.pages.dashboard.teamActivations')}
          data={activationSeries}
          isLoading={statsQuery.isLoading}
          xKey="month"
          series={[{ key: 'count', label: t('common.activations') }]}
        />
        <BarChartWidget
          title={t('manager.pages.dashboard.teamRevenue')}
          data={statsQuery.data?.revenueChart ?? []}
          isLoading={statsQuery.isLoading}
          xKey="reseller"
          horizontal
          showLabels
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('manager.pages.dashboard.recentTeamActivity')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length === 0 && !statsQuery.isLoading ? (
              <EmptyState title={t('manager.pages.dashboard.noTeamActivityTitle')} description={t('manager.pages.dashboard.noTeamActivityDescription')} />
            ) : null}
            {recentActivity.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-950 dark:text-white">{entry.user?.name ?? t('manager.pages.dashboard.teamMember')}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{formatActivityActionLabel(entry.action)}</p>
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
            <CardTitle className="text-lg">{t('manager.pages.dashboard.managerActions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button type="button" className="w-full justify-between" onClick={() => navigate(routePaths.manager.team(lang))}>
              {t('manager.pages.dashboard.quickActions.reviewTeamResellers')}
              <ActionIcon className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => navigate(routePaths.manager.customers(lang))}>
              {t('manager.pages.dashboard.quickActions.customerOverview')}
              <ActionIcon className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => navigate(routePaths.manager.reports(lang))}>
              {t('manager.pages.dashboard.actions.reports')}
              <ActionIcon className="h-4 w-4" />
            </Button>
            <button
              type="button"
              className="rounded-3xl bg-slate-50 p-4 text-start text-sm text-slate-600 dark:bg-slate-950/40 dark:text-slate-300"
              onClick={() => navigate(routePaths.manager.resellerLogs(lang))}
            >
              {t('manager.pages.dashboard.monthlyActivations')}
              <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{stats?.monthly_activations ?? 0}</p>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
