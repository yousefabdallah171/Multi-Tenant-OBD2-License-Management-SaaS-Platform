import { useQuery } from '@tanstack/react-query'
import { Banknote, Building2, Globe2, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ActivationTimeline } from '@/components/charts/ActivationTimeline'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { TenantComparisonChart } from '@/components/charts/TenantComparisonChart'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { reportService } from '@/services/report.service'

function SkeletonCard() {
  return <div className="h-32 animate-pulse rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
}

function SkeletonPanel({ height = 'h-80' }: { height?: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className={`animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800 ${height}`} />
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'

  const statsQuery = useQuery({
    queryKey: ['super-admin', 'dashboard', 'stats'],
    queryFn: () => reportService.getDashboardStats(),
  })

  const revenueTrendQuery = useQuery({
    queryKey: ['super-admin', 'dashboard', 'revenue-trend'],
    queryFn: () => reportService.getRevenueTrend(),
  })

  const comparisonQuery = useQuery({
    queryKey: ['super-admin', 'dashboard', 'tenant-comparison'],
    queryFn: () => reportService.getTenantComparison(),
  })

  const activityQuery = useQuery({
    queryKey: ['super-admin', 'dashboard', 'activity'],
    queryFn: () => reportService.getRecentActivity(),
  })

  const stats = statsQuery.data?.data.stats
  const statsLoading = statsQuery.isLoading && !stats
  const activityLoading = activityQuery.isLoading && !activityQuery.data
  const revenueLoading = revenueTrendQuery.isLoading && !revenueTrendQuery.data
  const comparisonLoading = comparisonQuery.isLoading && !comparisonQuery.data

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.24em] text-sky-600 dark:text-sky-400">{t('superAdmin.pages.dashboard.eyebrow')}</p>
        <h2 className="text-3xl font-semibold">{t('superAdmin.pages.dashboard.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.dashboard.description')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, index) => <SkeletonCard key={index} />)
        ) : (
          <>
            <StatsCard title={t('superAdmin.cards.totalTenants')} value={stats?.total_tenants ?? 0} icon={Building2} color="sky" />
            <StatsCard title={t('superAdmin.cards.totalRevenue')} value={formatCurrency(stats?.total_revenue ?? 0, 'USD', locale)} icon={Banknote} color="emerald" />
            <StatsCard title={t('superAdmin.cards.activeLicenses')} value={stats?.active_licenses ?? 0} icon={Globe2} color="amber" />
            <StatsCard title={t('superAdmin.cards.totalUsers')} value={stats?.total_users ?? 0} icon={Users} color="rose" />
            <StatsCard title={t('superAdmin.cards.countryCoverage')} value={stats?.ip_country_map.length ?? 0} icon={Globe2} color="sky" />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {revenueLoading ? <SkeletonPanel /> : <RevenueChart title={t('superAdmin.pages.dashboard.revenueTrend')} data={revenueTrendQuery.data?.data ?? []} isLoading={revenueTrendQuery.isLoading} />}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('superAdmin.pages.dashboard.recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activityLoading
              ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />)
              : null}
            {!activityQuery.isLoading && (activityQuery.data?.data.length ?? 0) === 0 ? <EmptyState title={t('common.noData')} description={t('superAdmin.pages.dashboard.noActivity')} /> : null}
            {activityQuery.data?.data.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950 dark:text-white">{item.action}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
                  </div>
                  <span className="text-xs text-slate-400">{item.created_at ? formatDate(item.created_at, locale) : '-'}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{[item.user, item.tenant].filter(Boolean).join(' - ')}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {comparisonLoading ? (
          <SkeletonPanel />
        ) : (
          <TenantComparisonChart
            title={t('superAdmin.pages.dashboard.tenantComparison')}
            data={(comparisonQuery.data?.data ?? []).map((item) => ({ tenant: item.name, revenue: item.revenue }))}
            isLoading={comparisonQuery.isLoading}
          />
        )}
        {revenueLoading ? <SkeletonPanel /> : <ActivationTimeline title={t('superAdmin.pages.dashboard.revenueTrend')} data={revenueTrendQuery.data?.data ?? []} isLoading={revenueTrendQuery.isLoading} dataKey="revenue" />}
      </div>
    </div>
  )
}
