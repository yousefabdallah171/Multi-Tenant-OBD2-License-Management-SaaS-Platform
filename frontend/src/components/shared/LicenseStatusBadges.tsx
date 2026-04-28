import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { BlockBadge } from '@/components/shared/BlockBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useDashboardAppearance } from '@/hooks/useDashboardAppearance'
import { useTheme } from '@/hooks/useTheme'
import { resolveDashboardSurfacePalette } from '@/lib/dashboard-appearance'

type LicenseStatus = ComponentProps<typeof StatusBadge>['status']

interface LicenseStatusBadgesProps {
  status: LicenseStatus
  isBlocked?: boolean
  isNew?: boolean
}

export function LicenseStatusBadges({ status, isBlocked = false, isNew = false }: LicenseStatusBadgesProps) {
  const { t, i18n } = useTranslation()
  const { appearance } = useDashboardAppearance()
  const { isDark } = useTheme()
  const newBadgePalette = resolveDashboardSurfacePalette('#c026d3', 'badges', appearance, isDark)

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <StatusBadge status={status} />
      {isNew ? (
        <span
          className="dashboard-text-body inline-flex items-center rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide shadow-sm"
          style={{
            backgroundColor: newBadgePalette.backgroundColor,
            borderColor: newBadgePalette.borderColor,
            color: newBadgePalette.color,
          }}
        >
          {t('common.new', { defaultValue: i18n.language === 'ar' ? 'جديد' : 'New' })}
        </span>
      ) : null}
      {isBlocked ? <BlockBadge /> : null}
    </div>
  )
}
