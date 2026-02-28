import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Banknote, KeyRound, ShieldCheck, UserRound, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ActivationTimeline } from '@/components/charts/ActivationTimeline'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatsCard } from '@/components/shared/StatsCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'

export function DashboardPage() {
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'

  const statsQuery = useQuery({
    queryKey: ['manager', 'dashboard', 'stats'],
    queryFn: () => managerService.getDashboardStats(),
  })

  const activationsQuery = useQuery({
    queryKey: ['manager', 'dashboard', 'activations-chart'],
    queryFn: () => managerService.getActivationsChart(),
  })

  const revenueQuery = useQuery({
    queryKey: ['manager', 'dashboard', 'revenue-chart'],
    queryFn: () => managerService.getRevenueChart(),
  })

  const activityQuery = useQuery({
    queryKey: ['manager', 'dashboard', 'recent-activity'],
    queryFn: () => managerService.getRecentActivity(),
  })

  const stats = statsQuery.data?.stats
  const recentActivity = activityQuery.data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manager"
        title="Dashboard"
        description="Track your reseller team, customer base, active licenses, and revenue without crossing into reseller-only workflows."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => navigate(routePaths.manager.team(lang))}>
              Team
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(routePaths.manager.usernameManagement(lang))}>
              Username Mgmt
            </Button>
            <Button type="button" onClick={() => navigate(routePaths.manager.reports(lang))}>
              Reports
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Team Resellers" value={stats?.team_resellers ?? 0} icon={Users} color="sky" />
        <StatsCard title="Team Customers" value={stats?.team_customers ?? 0} icon={UserRound} color="emerald" />
        <StatsCard title="Active Licenses" value={stats?.active_licenses ?? 0} icon={ShieldCheck} color="amber" />
        <StatsCard title="Team Revenue" value={formatCurrency(stats?.team_revenue ?? 0, 'USD', locale)} icon={Banknote} color="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ActivationTimeline title="Team Activations" data={activationsQuery.data?.data ?? []} isLoading={activationsQuery.isLoading} dataKey="count" xKey="month" />
        <RevenueChart title="Team Revenue" data={revenueQuery.data?.data ?? []} isLoading={revenueQuery.isLoading} dataKey="revenue" xKey="month" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Team Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length === 0 && !activityQuery.isLoading ? (
              <EmptyState title="No team activity yet" description="Recent reseller and manager actions will appear here." />
            ) : null}
            {recentActivity.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-950 dark:text-white">{entry.user?.name ?? 'Team member'}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{entry.action}</p>
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
            <CardTitle className="text-lg">Manager Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button type="button" className="w-full justify-between" onClick={() => navigate(routePaths.manager.team(lang))}>
              Review Team Resellers
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => navigate(routePaths.manager.customers(lang))}>
              Customer Overview
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => navigate(routePaths.manager.usernameManagement(lang))}>
              Unlock Usernames
              <KeyRound className="h-4 w-4" />
            </Button>
            <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-950/40 dark:text-slate-300">
              Monthly activations
              <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{stats?.monthly_activations ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
