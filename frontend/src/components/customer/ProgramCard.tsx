import { Package2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DownloadButton } from '@/components/customer/DownloadButton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ProgramCardProps {
  licenseId: number
  name: string
  version?: string | null
  description?: string | null
  icon?: string | null
  status: 'active' | 'expired' | 'suspended' | 'pending'
  downloadLink?: string | null
  canDownload: boolean
}

export function ProgramCard({ licenseId, name, version, description, icon, status, downloadLink, canDownload }: ProgramCardProps) {
  const { t } = useTranslation()

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300">
            {icon ? <img src={icon} alt="" className="h-full w-full object-cover" /> : <Package2 className="h-6 w-6" />}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">{name}</CardTitle>
              <StatusBadge status={status} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('customerPortal.software.version')} {version ?? '1.0'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <p className="line-clamp-3 min-h-16 text-sm text-slate-600 dark:text-slate-300">{description || t('customerPortal.software.noDescription')}</p>
        <DownloadButton downloadId={licenseId} downloadLink={downloadLink} disabled={!canDownload} className="w-full" label={t('customerPortal.actions.download')} />
      </CardContent>
    </Card>
  )
}
