import type { ComponentType } from 'react'
import { DownloadCloud, FileArchive, LaptopMinimalCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DownloadButton } from '@/components/customer/DownloadButton'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { customerPortalService } from '@/services/customer.service'

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function DownloadPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US'
  const downloadsQuery = useQuery({
    queryKey: ['customer', 'downloads'],
    queryFn: () => customerPortalService.getDownloads(),
  })

  const downloads = downloadsQuery.data ?? []

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-400">{t('customerPortal.layout.eyebrow')}</p>
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-white">{t('customerPortal.download.title')}</h1>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('customerPortal.download.description')}</p>
      </section>

      {downloadsQuery.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="space-y-4 p-5">
                <div className="h-6 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-20 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-10 rounded bg-slate-200 dark:bg-slate-800" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!downloadsQuery.isLoading && downloads.length === 0 ? (
        <EmptyState
          icon={DownloadCloud}
          title={t('customerPortal.download.emptyTitle')}
          description={t('customerPortal.download.emptyDescription')}
        />
      ) : null}

      {downloads.length > 0 ? (
        <div className="space-y-4">
          {downloads.map((item) => (
            <Card key={item.id}>
              <CardHeader className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-xl text-slate-950 dark:text-white">
                      {item.program_name ?? t('customerPortal.dashboard.unknownProgram')}
                      {item.version ? <span className="ms-2 text-base font-medium text-slate-500 dark:text-slate-400">v{item.version}</span> : null}
                    </CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('customerPortal.download.lastDownloaded')}: {formatDateTime(item.last_downloaded_at, locale)}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              </CardHeader>
              <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_auto]">
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoTile icon={FileArchive} label={t('customerPortal.download.fileSize')} value={item.file_size ?? t('customerPortal.download.notAvailable')} />
                  <InfoTile icon={LaptopMinimalCheck} label={t('customerPortal.download.systemRequirements')} value={item.system_requirements ?? t('customerPortal.download.notProvided')} />
                  <InfoTile icon={DownloadCloud} label={t('customerPortal.download.daysRemaining')} value={item.days_remaining > 0 ? t('customerPortal.dashboard.daysRemaining', { count: item.days_remaining }) : t('customerPortal.common.expired')} />
                  <InfoTile icon={FileArchive} label={t('customerPortal.download.installationGuide')} value={item.installation_guide_url ? t('customerPortal.download.availableGuide') : t('customerPortal.download.notProvided')} />
                </div>

                <div className="flex min-w-[14rem] flex-col gap-3">
                  <DownloadButton
                    downloadId={item.license_id}
                    downloadLink={item.download_link}
                    disabled={!item.can_download}
                    className="w-full"
                    label={t('customerPortal.download.downloadNow')}
                  />
                  {item.installation_guide_url ? (
                    <a
                      href={item.installation_guide_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                    >
                      {t('customerPortal.download.openGuide')}
                    </a>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">{value}</p>
    </div>
  )
}
