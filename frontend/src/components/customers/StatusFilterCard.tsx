import { useDashboardAppearance } from '@/hooks/useDashboardAppearance'
import { useBranding } from '@/hooks/useBranding'
import { useTheme } from '@/hooks/useTheme'
import { resolveDashboardSurfacePalette } from '@/lib/dashboard-appearance'
import { cn } from '@/lib/utils'

interface StatusFilterCardProps {
  label: string
  count?: number | string
  description?: string
  isActive?: boolean
  onClick?: () => void
  color?: 'emerald' | 'amber' | 'rose' | 'slate' | 'sky'
}

const cardColors = {
  emerald: '#059669',
  amber: '#d97706',
  rose: '#e11d48',
  slate: '#64748b',
  sky: '#4338ca',
} as const

export function StatusFilterCard({
  label,
  count,
  isActive = false,
  onClick,
  color = 'sky',
}: StatusFilterCardProps) {
  const { appearance } = useDashboardAppearance()
  const { primaryColor } = useBranding()
  const { isDark } = useTheme()
  const palette = resolveDashboardSurfacePalette(
    color === 'sky' ? primaryColor : cardColors[color],
    'cards',
    appearance,
    isDark,
  )

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        'group relative rounded-xl border px-3.5 py-3.5 text-start transition-all duration-200',
        isActive
          ? 'shadow-sm ring-1 ring-inset ring-slate-950/5 dark:ring-white/10'
          : 'hover:-translate-y-0.5 hover:shadow-md',
      )}
      style={{
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
        boxShadow: isActive ? `0 0 0 1px ${palette.accentSoftColor}` : undefined,
      }}
    >
      <div className="mb-3 flex items-center gap-1.5">
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-md"
          style={{ backgroundColor: palette.accentSoftColor }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: palette.accentColor }} />
        </span>
        <p
          className="dashboard-text-label truncate font-semibold uppercase tracking-widest leading-none"
          style={{ color: palette.color }}
        >
          {label}
        </p>
      </div>

      {count !== undefined ? (
        <p className="dashboard-text-display tabular-nums font-bold leading-none tracking-tight text-slate-950 dark:text-white">
          {count}
        </p>
      ) : null}

      {isActive ? (
        <span
          className="absolute bottom-0 start-3 end-3 h-[2px] rounded-full"
          style={{ backgroundColor: palette.accentColor }}
        />
      ) : null}
    </button>
  )
}
