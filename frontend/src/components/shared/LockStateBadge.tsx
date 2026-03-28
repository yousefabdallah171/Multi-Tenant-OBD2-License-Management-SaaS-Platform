import { useTranslation } from 'react-i18next'
import { useDashboardAppearance } from '@/hooks/useDashboardAppearance'
import { useTheme } from '@/hooks/useTheme'
import { resolveDashboardSurfacePalette } from '@/lib/dashboard-appearance'
import { cn } from '@/lib/utils'

export function LockStateBadge({ locked }: { locked: boolean }) {
  const { t } = useTranslation()
  const { appearance } = useDashboardAppearance()
  const { isDark } = useTheme()
  const palette = resolveDashboardSurfacePalette(locked ? '#d97706' : '#059669', 'badges', appearance, isDark)

  return (
    <span
      className={cn('dashboard-text-body inline-flex rounded-full border px-3 py-1 font-semibold')}
      style={{
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
        color: palette.color,
      }}
    >
      {locked ? t('common.locked') : t('common.unlocked')}
    </span>
  )
}
