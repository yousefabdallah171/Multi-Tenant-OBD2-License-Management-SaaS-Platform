import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useDashboardAppearance } from '@/hooks/useDashboardAppearance'
import { useBranding } from '@/hooks/useBranding'
import { useTheme } from '@/hooks/useTheme'
import { resolveDashboardSurfacePalette } from '@/lib/dashboard-appearance'
import { cn } from '@/lib/utils'

const cardColors = {
  sky: '#4338ca',
  emerald: '#059669',
  amber: '#d97706',
  rose: '#e11d48',
} as const

interface StatsCardProps {
  title: string
  value: string | number
  /** @deprecated icon is no longer rendered â€” pass nothing */
  icon?: unknown
  trend?: number
  color?: keyof typeof cardColors
  helperText?: string
}

export function StatsCard({ title, value, trend, color = 'sky', helperText }: StatsCardProps) {
  const hasTrend = typeof trend === 'number'
  const { appearance } = useDashboardAppearance()
  const { primaryColor } = useBranding()
  const { isDark } = useTheme()
  const palette = resolveDashboardSurfacePalette(
    color === 'sky' ? primaryColor : cardColors[color],
    'cards',
    appearance,
    isDark,
  )
  const trendPalette = resolveDashboardSurfacePalette(
    trend !== undefined && trend < 0 ? '#e11d48' : '#059669',
    'badges',
    appearance,
    isDark,
  )

  return (
    <Card
      data-testid="stats-card"
      className="h-full border-l-4 hover:shadow-md hover:shadow-slate-950/8"
      style={{
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
        borderLeftColor: palette.accentColor,
      }}
    >
      <CardContent className="space-y-1.5 p-4 sm:p-5">
        <p className="dashboard-text-label text-xs font-semibold uppercase tracking-wide" style={{ color: palette.color }}>{title}</p>
        <p className="dashboard-text-display tabular-nums text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">{value}</p>
        {helperText ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
        ) : null}
        {hasTrend ? (
          <div
            className={cn('dashboard-text-helper inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-semibold')}
            style={{
              backgroundColor: trendPalette.backgroundColor,
              borderColor: trendPalette.borderColor,
              color: trendPalette.color,
            }}
          >
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{Math.abs(trend)}%</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
