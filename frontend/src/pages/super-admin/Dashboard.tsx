import { useQuery } from '@tanstack/react-query'
import { Banknote, Building2, Globe2, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AreaChartWidget } from '@/components/charts/AreaChartWidget'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { PieChartWidget } from '@/components/charts/PieChartWidget'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { StaggerGroup, StaggerItem } from '@/components/shared/PageTransition'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { localizeMonthLabel } from '@/lib/chart-labels'
import { formatCurrency, formatDate } from '@/lib/utils'
import { reportService } from '@/services/report.service'

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

  const timelineQuery = useQuery({
    queryKey: ['super-admin', 'dashboard', 'license-timeline'],
    queryFn: () => reportService.getLicenseTimeline(),
  })

  const activityQuery = useQuery({
    queryKey: ['super-admin', 'dashboard', 'activity'],
    queryFn: () => reportService.getRecentActivity(),
  })

  const stats = statsQuery.data?.data.stats
  const statsLoading = statsQuery.isLoading && !stats
  const countryData = stats?.ip_country_map ?? []
  const timelineData = (timelineQuery.data?.data ?? []).map((item) => ({
    ...item,
    label: item.label ? localizeMonthLabel(item.label, locale) : item.label,
  }))

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.24em] text-sky-600 dark:text-sky-400">{t('superAdmin.pages.dashboard.eyebrow')}</p>
        <h2 className="text-3xl font-semibold">{t('superAdmin.pages.dashboard.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.dashboard.description')}</p>
      </div>

      <StaggerGroup className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, index) => <SkeletonCard key={index} className="h-full" lines={2} />)
        ) : (
          <>
            <StaggerItem>
              <StatsCard title={t('superAdmin.cards.totalTenants')} value={stats?.total_tenants ?? 0} icon={Building2} color="sky" />
            </StaggerItem>
            <StaggerItem>
              <StatsCard title={t('superAdmin.cards.totalRevenue')} value={formatCurrency(stats?.total_revenue ?? 0, 'USD', locale)} icon={Banknote} color="emerald" />
            </StaggerItem>
            <StaggerItem>
              <StatsCard title={t('superAdmin.cards.activeLicenses')} value={stats?.active_licenses ?? 0} icon={Globe2} color="amber" />
            </StaggerItem>
            <StaggerItem>
              <StatsCard title={t('superAdmin.cards.totalUsers')} value={stats?.total_users ?? 0} icon={Users} color="rose" />
            </StaggerItem>
            <StaggerItem>
              <StatsCard title={t('superAdmin.cards.countryCoverage')} value={countryData.length} icon={Globe2} color="sky" />
            </StaggerItem>
          </>
        )}
      </StaggerGroup>

      <div className="grid gap-6 xl:grid-cols-2">
        <LineChartWidget
          title={t('superAdmin.pages.dashboard.revenueTrend')}
          data={revenueTrendQuery.data?.data ?? []}
          isLoading={revenueTrendQuery.isLoading}
          xKey="month"
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <BarChartWidget
          title={t('superAdmin.pages.dashboard.tenantComparison')}
          data={(comparisonQuery.data?.data ?? []).map((item) => ({ tenant: item.name, revenue: item.revenue }))}
          isLoading={comparisonQuery.isLoading}
          xKey="tenant"
          horizontal
          showLabels
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AreaChartWidget
          title={t('superAdmin.pages.dashboard.licenseTimeline')}
          description={t('superAdmin.pages.dashboard.licenseTimelineDescription')}
          data={timelineData}
          isLoading={timelineQuery.isLoading}
          xKey="label"
          series={[{ key: 'count', label: t('common.activations') }]}
          tooltipLabelFormatter={(label) => String(timelineData.find((item) => item.label === label)?.date ?? label)}
        />
        <PieChartWidget
          title={t('superAdmin.pages.dashboard.ipCountryDistribution')}
          description={t('superAdmin.pages.dashboard.ipCountryDistributionDescription')}
          data={countryData}
          isLoading={statsQuery.isLoading}
          nameKey="country"
          valueKey="count"
          totalLabel={t('superAdmin.cards.countryCoverage')}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('superAdmin.pages.dashboard.recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
  )
}
