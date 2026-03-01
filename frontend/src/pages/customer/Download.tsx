import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Download, FileText, PackageOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { StaggerGroup, StaggerItem } from '@/components/shared/PageTransition'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { customerPortalService } from '@/services/customer.service'

export function DownloadPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'

  const downloadsQuery = useQuery({
    queryKey: ['customer', 'downloads'],
    queryFn: () => customerPortalService.getDownloads(),
  })

  const logDownloadMutation = useMutation({
    mutationFn: (id: number) => customerPortalService.logDownload(id),
  })

  const startDownload = async (item: { id: number; download_link: string | null; can_download: boolean }) => {
    if (!item.can_download || !item.download_link) {
      toast.error(t('customerPortal.download.disabledTooltip'))
      return
    }

    window.open(item.download_link, '_blank', 'noopener,noreferrer')

    try {
      await logDownloadMutation.mutateAsync(item.id)
    } catch {
      toast.error(t('customerPortal.download.logFailed'))
    }
  }

  const items = downloadsQuery.data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('customerPortal.download.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('customerPortal.download.description')}</p>
      </div>

      {downloadsQuery.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonCard key={index} lines={4} />
          ))}
        </div>
      ) : null}

      {items.length === 0 && !downloadsQuery.isLoading ? (
        <EmptyState title={t('customerPortal.download.emptyTitle')} description={t('customerPortal.download.emptyDescription')} icon={PackageOpen} />
      ) : null}

      {!downloadsQuery.isLoading ? (
        <StaggerGroup className="space-y-4">
          {items.map((item) => (
            <StaggerItem key={item.id}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{item.program_name ?? t('customerPortal.dashboard.unknownProgram')}</CardTitle>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t('customerPortal.software.version')} {item.version ?? '-'}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('customerPortal.download.lastDownloaded')}</p>
                      <p className="mt-1 text-sm font-medium">{item.last_downloaded_at ? formatDate(item.last_downloaded_at, locale) : t('customerPortal.download.notAvailable')}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('customerPortal.download.fileSize')}</p>
                      <p className="mt-1 text-sm font-medium">{item.file_size ?? t('customerPortal.download.notProvided')}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('customerPortal.download.systemRequirements')}</p>
                      <p className="mt-1 text-sm font-medium">{item.system_requirements ?? t('customerPortal.download.notProvided')}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('customerPortal.download.daysRemaining')}</p>
                      <p className="mt-1 text-sm font-medium">{item.days_remaining}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" className="flex-1 justify-between" disabled={!item.can_download} onClick={() => void startDownload(item)}>
                      <span className="inline-flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        {t('customerPortal.download.downloadNow')}
                      </span>
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!item.installation_guide_url}
                      onClick={() => {
                        if (item.installation_guide_url) {
                          window.open(item.installation_guide_url, '_blank', 'noopener,noreferrer')
                        }
                      }}
                    >
                      <FileText className="me-2 h-4 w-4" />
                      {t('customerPortal.download.openGuide')}
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
