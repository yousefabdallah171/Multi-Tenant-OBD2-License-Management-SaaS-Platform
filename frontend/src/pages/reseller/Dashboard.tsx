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
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const text = lang === 'ar'
    ? {
        eyebrow: 'موزع',
        title: 'لوحة التحكم',
        description: 'تابع العملاء والتراخيص النشطة والإيرادات الحالية وأحدث أعمال التفعيل ضمن نطاقك الشخصي كموزع.',
        customers: 'العملاء',
        activeLicenses: 'التراخيص النشطة',
        licenses: 'التراخيص',
        reports: 'التقارير',
        revenue: 'الإيراد',
        monthlyActivations: 'التفعيلات الشهرية',
        activationTrend: 'اتجاه التفعيل',
        revenueTrend: 'اتجاه الإيراد',
        recentActivity: 'النشاط الأخير',
        noActivityTitle: 'لا يوجد نشاط حتى الآن',
        noActivityDescription: 'ستظهر هنا أحدث عمليات التفعيل والتجديد والإلغاء الخاصة بك.',
        quickActions: 'إجراءات سريعة',
        activateNewCustomer: 'تفعيل عميل جديد',
        manageLicenses: 'إدارة التراخيص',
        exportReports: 'تصدير التقارير',
      }
    : {
        eyebrow: 'Reseller',
        title: 'Dashboard',
        description: 'Track your customers, active licenses, current revenue, and the latest activation work from your personal reseller scope.',
        customers: 'Customers',
        activeLicenses: 'Active Licenses',
        licenses: 'Licenses',
        reports: 'Reports',
        revenue: 'Revenue',
        monthlyActivations: 'Monthly Activations',
        activationTrend: 'Activation Trend',
        revenueTrend: 'Revenue Trend',
        recentActivity: 'Recent Activity',
        noActivityTitle: 'No activity yet',
        noActivityDescription: 'Your recent activation, renewal, and deactivation actions will appear here.',
        quickActions: 'Quick Actions',
        activateNewCustomer: 'Activate New Customer',
        manageLicenses: 'Manage Licenses',
        exportReports: 'Export Reports',
      }

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
    month: localizeMonthLabel(point.month, locale),
  }))
  const revenueSeries = (revenueQuery.data?.data ?? []).map((point) => ({
    ...point,
    month: localizeMonthLabel(point.month, locale),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => navigate(routePaths.reseller.customers(lang))}>
              {text.customers}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(routePaths.reseller.licenses(lang))}>
              {text.licenses}
            </Button>
            <Button type="button" onClick={() => navigate(routePaths.reseller.reports(lang))}>
              {text.reports}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title={text.customers} value={stats?.customers ?? 0} icon={UserRound} color="sky" />
        <StatsCard title={text.activeLicenses} value={stats?.active_licenses ?? 0} icon={ShieldCheck} color="emerald" />
        <StatsCard title={text.revenue} value={formatCurrency(stats?.revenue ?? 0, 'USD', locale)} icon={Banknote} color="rose" />
        <StatsCard title={text.monthlyActivations} value={stats?.monthly_activations ?? 0} icon={KeyRound} color="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ActivationTimeline title={text.activationTrend} data={activationSeries} isLoading={activationsQuery.isLoading} dataKey="count" xKey="month" />
        <RevenueChart title={text.revenueTrend} data={revenueSeries} isLoading={revenueQuery.isLoading} dataKey="revenue" xKey="month" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{text.recentActivity}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length === 0 && !activityQuery.isLoading ? (
              <EmptyState title={text.noActivityTitle} description={text.noActivityDescription} />
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
            <CardTitle className="text-lg">{text.quickActions}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button type="button" className="w-full justify-between" onClick={() => navigate(routePaths.reseller.customers(lang))}>
              {text.activateNewCustomer}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => navigate(routePaths.reseller.licenses(lang))}>
              {text.manageLicenses}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => navigate(routePaths.reseller.reports(lang))}>
              {text.exportReports}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
