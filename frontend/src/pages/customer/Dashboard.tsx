import { useQuery } from '@tanstack/react-query'
import { ShieldAlert, ShieldCheck, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { StaggerGroup, StaggerItem } from '@/components/shared/PageTransition'
import { StatsCard } from '@/components/shared/StatsCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { customerPortalService } from '@/services/customer.service'

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'

  const dashboardQuery = useQuery({
    queryKey: ['customer', 'dashboard'],
    queryFn: () => customerPortalService.getDashboard(),
  })

  const summary = dashboardQuery.data?.data.summary
  const licenses = dashboardQuery.data?.data.licenses ?? []

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('customerPortal.dashboard.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('customerPortal.dashboard.description')}</p>
      </div>

      <StaggerGroup className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        <StaggerItem>
          <StatsCard title={t('customerPortal.dashboard.totalLicenses')} value={summary?.total_licenses ?? 0} icon={WalletCards} color="sky" />
        </StaggerItem>
        <StaggerItem>
          <StatsCard title={t('customerPortal.dashboard.activeLicenses')} value={summary?.active_licenses ?? 0} icon={ShieldCheck} color="emerald" />
        </StaggerItem>
        <StaggerItem>
          <StatsCard title={t('customerPortal.dashboard.expiredLicenses')} value={summary?.expired_licenses ?? 0} icon={ShieldAlert} color="rose" />
        </StaggerItem>
      </StaggerGroup>

      {dashboardQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonCard key={index} lines={4} />
          ))}
        </div>
      ) : null}

      {licenses.length === 0 && !dashboardQuery.isLoading ? (
        <EmptyState
          title={t('customerPortal.dashboard.noLicenses')}
          description={t('customerPortal.dashboard.noLicensesDescription')}
          actionLabel={t('customerPortal.nav.software')}
          onAction={() => navigate(routePaths.customer.software(lang))}
        />
      ) : null}

      {!dashboardQuery.isLoading ? (
        <StaggerGroup data-testid="customer-dashboard-grid" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {licenses.map((license) => (
            <StaggerItem key={license.id}>
              <Card className="h-full">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg">{license.program_name ?? t('customerPortal.dashboard.unknownProgram')}</CardTitle>
                    <StatusBadge status={license.status} />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{license.program_description ?? '-'}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('customerPortal.dashboard.progressLabel')}</p>
                    <Progress value={license.percentage_remaining} />
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('customerPortal.dashboard.daysRemaining', { count: Math.max(0, license.days_remaining) })}</p>
                  </div>
                  <dl className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">{t('customerPortal.dashboard.biosId')}</dt>
                      <dd className="font-medium">{license.bios_id}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">{t('customerPortal.dashboard.activatedAt')}</dt>
                      <dd className="font-medium">{license.activated_at ? formatDate(license.activated_at, locale) : '-'}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">{t('customerPortal.dashboard.expiresAt')}</dt>
                      <dd className="font-medium">{license.expires_at ? formatDate(license.expires_at, locale) : '-'}</dd>
                    </div>
                  </dl>
                  <div className="flex gap-2">
                    <Button type="button" className="flex-1" onClick={() => navigate(routePaths.customer.download(lang))}>
                      {t('customerPortal.actions.download')}
                    </Button>
                    <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate(routePaths.customer.software(lang))}>
                      {t('customerPortal.nav.software')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : null}
    </div>
  )
}
