import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Banknote, KeyRound, ShieldCheck, UserRound } from 'lucide-react'
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
import { resellerService } from '@/services/reseller.service'

export function DashboardPage() {
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reseller"
        title="Dashboard"
        description="Track your customers, active licenses, current revenue, and the latest activation work from your personal reseller scope."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => navigate(routePaths.reseller.customers(lang))}>
              Customers
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(routePaths.reseller.licenses(lang))}>
              Licenses
            </Button>
            <Button type="button" onClick={() => navigate(routePaths.reseller.reports(lang))}>
              Reports
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Customers" value={stats?.customers ?? 0} icon={UserRound} color="sky" />
        <StatsCard title="Active Licenses" value={stats?.active_licenses ?? 0} icon={ShieldCheck} color="emerald" />
        <StatsCard title="Revenue" value={formatCurrency(stats?.revenue ?? 0, 'USD', locale)} icon={Banknote} color="rose" />
        <StatsCard title="Monthly Activations" value={stats?.monthly_activations ?? 0} icon={KeyRound} color="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ActivationTimeline title="Activation Trend" data={activationsQuery.data?.data ?? []} isLoading={activationsQuery.isLoading} dataKey="count" xKey="month" />
        <RevenueChart title="Revenue Trend" data={revenueQuery.data?.data ?? []} isLoading={revenueQuery.isLoading} dataKey="revenue" xKey="month" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length === 0 && !activityQuery.isLoading ? (
              <EmptyState title="No activity yet" description="Your recent activation, renewal, and deactivation actions will appear here." />
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
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button type="button" className="w-full justify-between" onClick={() => navigate(routePaths.reseller.customers(lang))}>
              Activate New Customer
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => navigate(routePaths.reseller.licenses(lang))}>
              Manage Licenses
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => navigate(routePaths.reseller.reports(lang))}>
              Export Reports
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
