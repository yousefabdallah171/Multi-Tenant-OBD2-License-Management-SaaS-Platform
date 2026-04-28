import { useTranslation } from 'react-i18next'
import { useDashboardAppearance } from '@/hooks/useDashboardAppearance'
import { useTheme } from '@/hooks/useTheme'
import { resolveDashboardSurfacePalette } from '@/lib/dashboard-appearance'

export function BlockBadge() {
  const { t, i18n } = useTranslation()
  const { appearance } = useDashboardAppearance()
  const { isDark } = useTheme()
  const palette = resolveDashboardSurfacePalette('#e11d48', 'badges', appearance, isDark)

  return (
    <span
      className="dashboard-text-body inline-flex items-center rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide shadow-sm"
      style={{
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
        color: palette.color,
      }}
    >
      {t('common.block', { defaultValue: i18n.language === 'ar' ? 'حظر' : 'Block' })}
    </span>
  )
}
