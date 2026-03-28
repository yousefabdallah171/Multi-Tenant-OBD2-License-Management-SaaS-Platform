import { useTranslation } from 'react-i18next'
import { useDashboardAppearance } from '@/hooks/useDashboardAppearance'
import { useBranding } from '@/hooks/useBranding'
import { useTheme } from '@/hooks/useTheme'
import { resolveDashboardSurfacePalette } from '@/lib/dashboard-appearance'
import { cn, getStatusMeaning } from '@/lib/utils'

type Status =
  | 'active'
  | 'suspended'
  | 'cancelled'
  | 'deactive'
  | 'inactive'
  | 'expired'
  | 'pending'
  | 'scheduled'
  | 'scheduled_failed'
  | 'removed'
  | 'online'
  | 'offline'
  | 'degraded'
  | 'unknown'
  | 'no_license'

const statusColors: Record<Status, string> = {
  active: '#059669',
  suspended: '#d97706',
  cancelled: '#64748b',
  deactive: '#e11d48',
  inactive: '#64748b',
  expired: '#e11d48',
  pending: '#4338ca',
  scheduled: '#7c3aed',
  scheduled_failed: '#ea580c',
  removed: '#64748b',
  online: '#059669',
  offline: '#e11d48',
  degraded: '#d97706',
  unknown: '#64748b',
  no_license: '#4338ca',
}

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation()
  const { appearance } = useDashboardAppearance()
  const { primaryColor } = useBranding()
  const { isDark } = useTheme()

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
  const palette = resolveDashboardSurfacePalette(
    status === 'pending' || status === 'no_license' ? primaryColor : statusColors[status],
    'badges',
    appearance,
    isDark,
  )

  return (
    <span
      title={meaning ? `${labels[status]}: ${meaning}` : labels[status]}
      className={cn('dashboard-text-body inline-flex rounded-full border px-3 py-1 font-semibold')}
      style={{
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
        color: palette.color,
      }}
    >
      {labels[status]}
    </span>
  )
}
