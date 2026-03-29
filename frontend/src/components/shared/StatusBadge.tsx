import { useTranslation } from 'react-i18next'
import { useDashboardAppearance } from '@/hooks/useDashboardAppearance'
import { useBranding } from '@/hooks/useBranding'
import { useTheme } from '@/hooks/useTheme'
import { resolveDashboardSurfacePalette } from '@/lib/dashboard-appearance'
import { cn, getStatusMeaning } from '@/lib/utils'

type KnownStatus =
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
  | 'open'
  | 'resolved'
  | 'recorded'
  | 'blacklisted'

type Status = KnownStatus | string | null | undefined

const statusColors: Record<KnownStatus, string> = {
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
  open: '#dc2626',
  resolved: '#059669',
  recorded: '#64748b',
  blacklisted: '#dc2626',
}

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation()
  const { appearance } = useDashboardAppearance()
  const { primaryColor } = useBranding()
  const { isDark } = useTheme()

  const normalizedStatus = normalizeStatus(status)
  const labels: Record<KnownStatus, string> = {
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
    open: t('common.open', { defaultValue: 'Open' }),
    resolved: t('common.resolved', { defaultValue: 'Resolved' }),
    recorded: t('common.recorded', { defaultValue: 'Recorded' }),
    blacklisted: t('common.blacklisted', { defaultValue: 'Blacklisted' }),
  }

  const meaning = getStatusMeaning(normalizedStatus, t)
  const label = labels[normalizedStatus] ?? humanizeStatus(status, t)
  const palette = resolveDashboardSurfacePalette(
    normalizedStatus === 'pending' || normalizedStatus === 'no_license' ? primaryColor : statusColors[normalizedStatus],
    'badges',
    appearance,
    isDark,
  )

  return (
    <span
      title={meaning ? `${label}: ${meaning}` : label}
      className={cn('dashboard-text-body inline-flex rounded-full border px-3 py-1 font-semibold')}
      style={{
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
        color: palette.color,
      }}
    >
      {label}
    </span>
  )
}

function normalizeStatus(status: Status): KnownStatus {
  const normalized = typeof status === 'string'
    ? status.trim().toLowerCase().replace(/[\s-]+/g, '_')
    : ''

  if (!normalized) {
    return 'unknown'
  }

  if (normalized in statusColors) {
    return normalized as KnownStatus
  }

  return 'unknown'
}

function humanizeStatus(status: Status, t: ReturnType<typeof useTranslation>['t']) {
  if (typeof status !== 'string' || !status.trim()) {
    return t('common.unknown')
  }

  const normalized = status.trim().replace(/[_-]+/g, ' ')
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}
