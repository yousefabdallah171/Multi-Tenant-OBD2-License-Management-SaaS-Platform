import { useQuery } from '@tanstack/react-query'
import { Banknote, LayoutDashboard, ShieldCheck, Users, UserSquare2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { StatsCard } from '@/components/shared/StatsCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { localizeMonthLabel } from '@/lib/chart-labels'
import { formatCurrency } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'

function localizeExpiryRange(range: string, t: ReturnType<typeof useTranslation>['t']) {
  const match = range.match(/^(\d+)-(\d+)\s+days$/i)

  if (!match) {
    return range
  }

  return t('managerParent.pages.dashboard.licenseRangeDays', {
    from: match[1],
    to: match[2],
  })
}

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'

  const statsQuery = useQuery({
    queryKey: ['manager-parent', 'dashboard'],
    queryFn: () => managerParentService.getDashboard(),
  })

  const stats = statsQuery.data?.stats
  const topPerformers = (statsQuery.data?.teamPerformance ?? []).slice(0, 4)
  const revenueSeries = (statsQuery.data?.revenueChart ?? []).map((point) => ({
    ...point,
    month: localizeMonthLabel(point.month, locale),
  }))
  const conflictSeries = (statsQuery.data?.conflictRate ?? []).map((point) => ({
    ...point,
    month: localizeMonthLabel(point.month, locale),
  }))
  const expirySeries = (statsQuery.data?.expiryForecast ?? []).map((point) => ({
    ...point,
    rangeKey: point.range,
    range: localizeExpiryRange(point.range, t),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('managerParent.pages.dashboard.title')}
        description={t('managerParent.pages.dashboard.description')}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => navigate(routePaths.managerParent.teamManagement(lang))}>
              {t('managerParent.pages.dashboard.actions.teamManagement')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(routePaths.managerParent.customers(lang))}>
              {t('managerParent.pages.dashboard.actions.reviewCustomers')}
            </Button>
            <Button type="button" onClick={() => navigate(routePaths.managerParent.reports(lang))}>
              {t('managerParent.pages.dashboard.actions.openReports')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <button type="button" className="text-start" onClick={() => navigate(routePaths.managerParent.teamManagement(lang))}>
          <StatsCard title={t('managerParent.pages.dashboard.teamMembers')} value={stats?.team_members ?? 0} icon={Users} color="sky" />
        </button>
        <button type="button" className="text-start" onClick={() => navigate(routePaths.managerParent.customers(lang))}>
          <StatsCard title={t('managerParent.pages.dashboard.customers')} value={stats?.total_customers ?? 0} icon={UserSquare2} color="emerald" />
        </button>
        <button type="button" className="text-start" onClick={() => navigate(`${routePaths.managerParent.customers(lang)}?status=active`)}>
          <StatsCard title={t('managerParent.pages.dashboard.activeLicenses')} value={stats?.active_licenses ?? 0} icon={ShieldCheck} color="amber" />
        </button>
        <button type="button" className="text-start" onClick={() => navigate(routePaths.managerParent.reports(lang))}>
          <StatsCard title={t('managerParent.pages.dashboard.monthlyRevenue')} value={formatCurrency(stats?.monthly_revenue ?? 0, 'USD', locale)} icon={Banknote} color="rose" />
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LineChartWidget
          title={t('managerParent.pages.dashboard.monthlyRevenue')}
          data={revenueSeries}
          isLoading={statsQuery.isLoading}
          xKey="month"
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <BarChartWidget
          title={t('managerParent.pages.dashboard.licenseExpiryForecast')}
          data={expirySeries}
          isLoading={statsQuery.isLoading}
          xKey="range"
          series={[{ key: 'count', label: t('managerParent.pages.dashboard.licenseCount') }]}
          showLabels
          colorByEntry={(payload) => {
            const range = String(payload.rangeKey ?? '')

            if (range.startsWith('0')) {
              return '#f59e0b'
            }

            if (range.startsWith('31')) {
              return '#fb923c'
            }

            return '#f43f5e'
          }}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <BarChartWidget
          title={t('managerParent.pages.dashboard.teamPerformance')}
          data={(statsQuery.data?.teamPerformance ?? []).map((member) => ({ name: member.name, activations: member.activations }))}
          isLoading={statsQuery.isLoading}
          xKey="name"
          horizontal
          showLabels
          series={[{ key: 'activations', label: t('common.activations') }]}
        />
        <LineChartWidget
          title={t('managerParent.pages.dashboard.conflictRate')}
          description={t('managerParent.pages.dashboard.conflictRateDescription')}
          data={conflictSeries}
          isLoading={statsQuery.isLoading}
          xKey="month"
          series={[{ key: 'count', label: t('managerParent.pages.dashboard.conflicts') }]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('managerParent.pages.dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Button type="button" className="justify-start" onClick={() => navigate(routePaths.managerParent.teamManagement(lang))}>
                {t('managerParent.pages.dashboard.actions.inviteTeamMember')}
              </Button>
              <Button type="button" variant="secondary" className="justify-start" onClick={() => navigate(routePaths.managerParent.customers(lang))}>
                {t('managerParent.pages.dashboard.actions.reviewCustomers')}
              </Button>
              <Button type="button" variant="secondary" className="justify-start" onClick={() => navigate(routePaths.managerParent.reports(lang))}>
                {t('managerParent.pages.dashboard.actions.openReports')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('managerParent.pages.dashboard.topPerformers')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <LayoutDashboard className="h-4 w-4 text-sky-500" />
              {t('managerParent.pages.dashboard.topPerformers')}
            </div>
            {topPerformers.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.dashboard.noTeamActivity')}</p> : null}
            {topPerformers.map((member) => (
              <div key={member.id} className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950 dark:text-white">{member.name}</p>
                    <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{t(`roles.${member.role}`)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-950 dark:text-white">{formatCurrency(member.revenue, 'USD', locale)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('managerParent.pages.dashboard.activationsCount', { count: member.activations })}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

