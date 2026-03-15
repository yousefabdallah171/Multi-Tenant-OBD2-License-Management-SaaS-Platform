import { useTranslation } from 'react-i18next'
import { cn, getStatusMeaning } from '@/lib/utils'

type Status = 'active' | 'suspended' | 'cancelled' | 'deactive' | 'inactive' | 'expired' | 'pending' | 'scheduled' | 'scheduled_failed' | 'removed' | 'online' | 'offline' | 'degraded' | 'unknown' | 'no_license'

const statusStyles: Record<Status, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  suspended: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  cancelled: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  deactive: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  inactive: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  expired: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  pending: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  scheduled: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  scheduled_failed: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  removed: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  online: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  offline: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  degraded: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  unknown: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  no_license: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
}

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation()

  const labels: Record<Status, string> = {
    active: t('common.active'),
    suspended: t('common.suspended'),
    cancelled: t('common.cancelled'),
    deactive: t('common.deactive'),
    inactive: t('common.inactive'),
    expired: t('common.expired'),
    pending: t('common.pending'),
    scheduled: t('common.scheduled', { defaultValue: 'Scheduled' }),
    scheduled_failed: t('common.scheduledFailed', { defaultValue: 'Scheduled Failed' }),
    removed: t('common.removed'),
    online: t('common.online'),
    offline: t('common.offline'),
    degraded: t('common.degraded'),
    unknown: t('common.unknown'),
    no_license: t('common.pending'),
  }

  const meaning = getStatusMeaning(status, t)

  return (
    <span
      title={meaning ? `${labels[status]}: ${meaning}` : labels[status]}
      className={cn('inline-flex rounded-full px-3 py-1 text-xs font-semibold', statusStyles[status])}
    >
      {labels[status]}
    </span>
  )
}
