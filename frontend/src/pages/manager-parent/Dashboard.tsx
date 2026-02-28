import { useQuery } from '@tanstack/react-query'
import { Banknote, LayoutDashboard, ShieldCheck, Users, UserSquare2 } from 'lucide-react'
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

export function DashboardPage() {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Tenant-level overview for your team, customer base, activations, and current revenue momentum."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => navigate(routePaths.managerParent.teamManagement(lang))}>
              Team Management
            </Button>
            <Button type="button" onClick={() => navigate(routePaths.managerParent.softwareManagement(lang))}>
              Manage Programs
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Team Members" value={stats?.team_members ?? 0} icon={Users} color="sky" />
        <StatsCard title="Customers" value={stats?.total_customers ?? 0} icon={UserSquare2} color="emerald" />
        <StatsCard title="Active Licenses" value={stats?.active_licenses ?? 0} icon={ShieldCheck} color="amber" />
        <StatsCard title="Monthly Revenue" value={formatCurrency(stats?.monthly_revenue ?? 0, 'USD', locale)} icon={Banknote} color="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ActivationTimeline title="Monthly Revenue" data={revenueQuery.data?.data ?? []} isLoading={revenueQuery.isLoading} dataKey="revenue" xKey="month" />
        <TenantComparisonChart title="License Expiry Forecast" data={expiryQuery.data?.data ?? []} isLoading={expiryQuery.isLoading} dataKey="count" xKey="range" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <TenantComparisonChart
          title="Team Performance"
          data={(performanceQuery.data?.data ?? []).map((member) => ({ name: member.name, revenue: member.revenue }))}
          isLoading={performanceQuery.isLoading}
          dataKey="revenue"
          xKey="name"
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Button type="button" className="justify-start" onClick={() => navigate(routePaths.managerParent.teamManagement(lang))}>
                Invite team member
              </Button>
              <Button type="button" variant="secondary" className="justify-start" onClick={() => navigate(routePaths.managerParent.resellerPricing(lang))}>
                Update reseller pricing
              </Button>
              <Button type="button" variant="secondary" className="justify-start" onClick={() => navigate(routePaths.managerParent.customers(lang))}>
                Review customers
              </Button>
              <Button type="button" variant="secondary" className="justify-start" onClick={() => navigate(routePaths.managerParent.reports(lang))}>
                Open reports
              </Button>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <LayoutDashboard className="h-4 w-4 text-sky-500" />
                Top performers
              </div>
              <div className="space-y-3">
                {topPerformers.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No team activity yet.</p> : null}
                {topPerformers.map((member) => (
                  <div key={member.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950 dark:text-white">{member.name}</p>
                        <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{member.role.replace('_', ' ')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-950 dark:text-white">{formatCurrency(member.revenue, 'USD', locale)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{member.activations} activations</p>
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
