import { useQuery } from '@tanstack/react-query'
import { Banknote, LayoutDashboard, ShieldCheck, Users, UserSquare2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ActivationTimeline } from '@/components/charts/ActivationTimeline'
import { TenantComparisonChart } from '@/components/charts/TenantComparisonChart'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { StatsCard } from '@/components/shared/StatsCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
}

function localizeMonthLabel(label: string, locale: string) {
  const [monthToken, yearToken] = label.split(' ')
  const monthIndex = MONTHS[monthToken]

  if (monthIndex === undefined || !yearToken) {
    return label
  }

  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(new Date(Number(yearToken), monthIndex, 1))
}

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'

  const statsQuery = useQuery({
    queryKey: ['manager-parent', 'dashboard', 'stats'],
    queryFn: () => managerParentService.getDashboardStats(),
  })

  const revenueQuery = useQuery({
    queryKey: ['manager-parent', 'dashboard', 'revenue-chart'],
    queryFn: () => managerParentService.getRevenueChart(),
  })

  const expiryQuery = useQuery({
    queryKey: ['manager-parent', 'dashboard', 'expiry-forecast'],
    queryFn: () => managerParentService.getExpiryForecast(),
  })

  const performanceQuery = useQuery({
    queryKey: ['manager-parent', 'dashboard', 'team-performance'],
    queryFn: () => managerParentService.getTeamPerformance(),
  })

  const stats = statsQuery.data?.stats
  const topPerformers = (performanceQuery.data?.data ?? []).slice(0, 4)
  const revenueSeries = (revenueQuery.data?.data ?? []).map((point) => ({
    ...point,
    month: localizeMonthLabel(point.month, locale),
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
            <Button type="button" onClick={() => navigate(routePaths.managerParent.softwareManagement(lang))}>
              {t('managerParent.pages.dashboard.actions.managePrograms')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title={t('managerParent.pages.dashboard.teamMembers')} value={stats?.team_members ?? 0} icon={Users} color="sky" />
        <StatsCard title={t('managerParent.pages.dashboard.customers')} value={stats?.total_customers ?? 0} icon={UserSquare2} color="emerald" />
        <StatsCard title={t('managerParent.pages.dashboard.activeLicenses')} value={stats?.active_licenses ?? 0} icon={ShieldCheck} color="amber" />
        <StatsCard title={t('managerParent.pages.dashboard.monthlyRevenue')} value={formatCurrency(stats?.monthly_revenue ?? 0, 'USD', locale)} icon={Banknote} color="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ActivationTimeline title={t('managerParent.pages.dashboard.monthlyRevenue')} data={revenueSeries} isLoading={revenueQuery.isLoading} dataKey="revenue" xKey="month" />
        <TenantComparisonChart title={t('managerParent.pages.dashboard.licenseExpiryForecast')} data={expiryQuery.data?.data ?? []} isLoading={expiryQuery.isLoading} dataKey="count" xKey="range" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <TenantComparisonChart
          title={t('managerParent.pages.dashboard.teamPerformance')}
          data={(performanceQuery.data?.data ?? []).map((member) => ({ name: member.name, revenue: member.revenue }))}
          isLoading={performanceQuery.isLoading}
          dataKey="revenue"
          xKey="name"
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('managerParent.pages.dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Button type="button" className="justify-start" onClick={() => navigate(routePaths.managerParent.teamManagement(lang))}>
                {t('managerParent.pages.dashboard.actions.inviteTeamMember')}
              </Button>
              <Button type="button" variant="secondary" className="justify-start" onClick={() => navigate(routePaths.managerParent.resellerPricing(lang))}>
                {t('managerParent.pages.dashboard.actions.updateResellerPricing')}
              </Button>
              <Button type="button" variant="secondary" className="justify-start" onClick={() => navigate(routePaths.managerParent.customers(lang))}>
                {t('managerParent.pages.dashboard.actions.reviewCustomers')}
              </Button>
              <Button type="button" variant="secondary" className="justify-start" onClick={() => navigate(routePaths.managerParent.reports(lang))}>
                {t('managerParent.pages.dashboard.actions.openReports')}
              </Button>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <LayoutDashboard className="h-4 w-4 text-sky-500" />
                {t('managerParent.pages.dashboard.topPerformers')}
              </div>
              <div className="space-y-3">
                {topPerformers.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.dashboard.noTeamActivity')}</p> : null}
                {topPerformers.map((member) => (
                  <div key={member.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-slate-900">
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
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
