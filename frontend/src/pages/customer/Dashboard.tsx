import type { CustomerDashboardLicense } from '@/types/customer.types'
import { KeyRound, ShieldAlert, ShieldCheck, WalletCards } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { LicenseCard } from '@/components/customer/LicenseCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { StaggerGroup, StaggerItem } from '@/components/shared/PageTransition'
import { StatsCard } from '@/components/shared/StatsCard'
import { customerPortalService } from '@/services/customer.service'

export function DashboardPage() {
  const { t } = useTranslation()
  const dashboardQuery = useQuery({
    queryKey: ['customer', 'dashboard'],
    queryFn: () => customerPortalService.getDashboard(),
  })

  const summary = dashboardQuery.data?.summary
  const licenses = dashboardQuery.data?.licenses ?? []

  const handleRenewalRequest = (license: CustomerDashboardLicense) => {
    const subject = encodeURIComponent(`${t('customerPortal.actions.requestRenewal')} - ${license.program_name ?? 'License'}`)
    const body = encodeURIComponent(
      `${t('customerPortal.actions.renewalEmailBody')}\n\n${t('customerPortal.dashboard.biosId')}: ${license.bios_id}\n${t('customerPortal.dashboard.programName')}: ${license.program_name ?? '-'}`,
    )

    const recipient = license.reseller_email ? encodeURIComponent(license.reseller_email) : ''

    window.location.assign(`mailto:${recipient}?subject=${subject}&body=${body}`)
    toast.success(t('customerPortal.actions.renewalStarted'))
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-400">{t('customerPortal.layout.eyebrow')}</p>
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-white">{t('customerPortal.dashboard.title')}</h1>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('customerPortal.dashboard.description')}</p>
      </section>

      <StaggerGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} lines={4} />)}
        </div>
      ) : null}

      {!dashboardQuery.isLoading && licenses.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title={t('customerPortal.dashboard.noLicenses')}
          description={t('customerPortal.dashboard.noLicensesDescription')}
        />
      ) : null}

      {licenses.length > 0 ? (
        <StaggerGroup data-testid="customer-dashboard-grid" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {licenses.map((license) => (
            <StaggerItem key={license.id}>
              <LicenseCard
                licenseId={license.id}
                programName={license.program_name ?? t('customerPortal.dashboard.unknownProgram')}
                programVersion={license.program_version}
                biosId={license.bios_id}
                status={license.status}
                activatedAt={license.activated_at}
                expiresAt={license.expires_at}
                daysRemaining={license.days_remaining}
                percentageRemaining={license.percentage_remaining}
                downloadLink={license.download_link}
                onRequestRenewal={() => handleRenewalRequest(license)}
              />
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : null}
    </div>
  )
}
