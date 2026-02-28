import type { ComponentType } from 'react'
import { CalendarClock, Computer, KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DownloadButton } from '@/components/customer/DownloadButton'
import { LicenseProgress } from '@/components/customer/LicenseProgress'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface LicenseCardProps {
  licenseId: number
  programName: string
  programVersion?: string | null
  biosId: string
  status: 'active' | 'expired' | 'suspended' | 'pending'
  activatedAt?: string | null
  expiresAt?: string | null
  daysRemaining: number
  percentageRemaining: number
  downloadLink?: string | null
  onRequestRenewal: () => void
}

function formatDateOnly(value: string | null | undefined, locale: string) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
}

export function LicenseCard({
  licenseId,
  programName,
  programVersion,
  biosId,
  status,
  activatedAt,
  expiresAt,
  daysRemaining,
  percentageRemaining,
  downloadLink,
  onRequestRenewal,
}: LicenseCardProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US'
  const expired = status === 'expired'
  const accentClass =
    status === 'active'
      ? 'border-emerald-200 dark:border-emerald-900/70'
      : status === 'expired'
        ? 'border-rose-200 dark:border-rose-900/70'
        : 'border-amber-200 dark:border-amber-900/70'

  return (
    <Card data-testid="license-card" className={cn('overflow-hidden border-2 shadow-sm', accentClass)}>
      <CardHeader className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">{t('customerPortal.dashboard.licenseCard')}</p>
            <CardTitle className="text-xl text-slate-950 dark:text-white">
              {programName}
              {programVersion ? <span className="ms-2 text-base font-medium text-slate-500 dark:text-slate-400">v{programVersion}</span> : null}
            </CardTitle>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <InfoRow icon={Computer} label={t('customerPortal.dashboard.biosId')} value={biosId} />
          <InfoRow icon={CalendarClock} label={t('customerPortal.dashboard.activatedAt')} value={formatDateOnly(activatedAt, locale)} />
          <InfoRow icon={KeyRound} label={t('common.status')} value={t(`customerPortal.status.${status}`)} />
          <InfoRow icon={CalendarClock} label={t('customerPortal.dashboard.expiresAt')} value={formatDateOnly(expiresAt, locale)} />
        </div>

        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/40">
          <LicenseProgress percentage={percentageRemaining} daysRemaining={daysRemaining} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <DownloadButton
            downloadId={licenseId}
            downloadLink={downloadLink}
            disabled={status !== 'active'}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            className={cn('flex-1', expired && 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-950')}
            onClick={onRequestRenewal}
          >
            {expired ? t('customerPortal.actions.contactReseller') : t('customerPortal.actions.requestRenewal')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-2 font-medium text-slate-950 dark:text-white">{value}</p>
    </div>
  )
}
