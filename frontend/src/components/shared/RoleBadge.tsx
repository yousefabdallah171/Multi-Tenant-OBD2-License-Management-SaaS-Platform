import type { UserRole } from '@/types/user.types'
import { useTranslation } from 'react-i18next'
import { useDashboardAppearance } from '@/hooks/useDashboardAppearance'
import { useBranding } from '@/hooks/useBranding'
import { useTheme } from '@/hooks/useTheme'
import { resolveDashboardSurfacePalette } from '@/lib/dashboard-appearance'
import { cn } from '@/lib/utils'

const roleColors: Record<UserRole, string> = {
  super_admin: '#e11d48',
  manager_parent: '#4338ca',
  manager: '#7c3aed',
  reseller: '#059669',
  customer: '#64748b',
}

export function RoleBadge({ role }: { role: UserRole }) {
  const { t } = useTranslation()
  const { appearance } = useDashboardAppearance()
  const { primaryColor } = useBranding()
  const { isDark } = useTheme()
  const palette = resolveDashboardSurfacePalette(
    role === 'manager_parent' ? primaryColor : roleColors[role],
    'badges',
    appearance,
    isDark,
  )

  return (
    <span
      className={cn('dashboard-text-helper inline-flex items-center rounded-md border px-2 py-0.5 font-semibold tracking-wide')}
      style={{
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
        color: palette.color,
      }}
    >
      {t(`roles.${role}`)}
    </span>
  )
}
