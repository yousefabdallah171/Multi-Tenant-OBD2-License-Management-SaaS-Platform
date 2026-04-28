import { useDashboardAppearance } from '@/hooks/useDashboardAppearance'
import { useBranding } from '@/hooks/useBranding'
import { useLanguage } from '@/hooks/useLanguage'
import { useTheme } from '@/hooks/useTheme'
import { resolveDashboardChartColors } from '@/lib/dashboard-appearance'
import { generateColorRamp } from '@/lib/role-branding'
import { NEUTRAL_COLORS, SEMANTIC_COLORS } from '@/lib/colors'

export interface ChartSeries {
  key: string
  label?: string
  color?: string
  stackId?: string
}

// Neutral colors reference NEUTRAL_COLORS / SEMANTIC_COLORS tokens — no raw hex values.
const LIGHT_NEUTRAL = {
  grid: NEUTRAL_COLORS[200],           // slate-200
  axis: NEUTRAL_COLORS[500],           // slate-500
  tooltipBackground: '#ffffff',        // pure white — intentional, not a surface token
  tooltipBorder: NEUTRAL_COLORS[300],  // slate-300
  secondary: '#7c3aed',                // violet-600 — complements indigo brand palette
  tertiary: SEMANTIC_COLORS.warning.main,
  quaternary: '#c026d3',               // fuchsia-600 — semantic chart series color, no token equivalent
  positive: SEMANTIC_COLORS.success.dark,
  negative: SEMANTIC_COLORS.danger.dark,
}

const DARK_NEUTRAL = {
  grid: NEUTRAL_COLORS[700],           // slate-700
  axis: NEUTRAL_COLORS[300],           // slate-300
  tooltipBackground: NEUTRAL_COLORS[900], // slate-900
  tooltipBorder: NEUTRAL_COLORS[700],  // slate-700
  secondary: '#a78bfa',                // violet-400 — lighter for dark bg
  tertiary: '#fbbf24',                 // amber-400 — lighter for dark bg
  quaternary: '#c084fc',               // purple-400 — lighter for dark bg
  positive: '#4ade80',                 // green-400 — lighter for dark bg
  negative: '#fb7185',                 // rose-400 — lighter for dark bg
}

export function useChartTheme() {
  const { isDark } = useTheme()
  const { primaryColor } = useBranding()
  const { appearance } = useDashboardAppearance()
  const { lang, isRtl } = useLanguage()

  const ramp = generateColorRamp(primaryColor)
  const brandPrimary = ramp['--brand-600'] || primaryColor
  const brandSecondary = ramp['--brand-400'] || primaryColor
  const brandTertiary = ramp['--brand-700'] || primaryColor
  const brandLight = ramp['--brand-300'] || primaryColor

  const themeNeutral = isDark ? DARK_NEUTRAL : LIGHT_NEUTRAL

  const seriesColors = resolveDashboardChartColors([
    isDark ? brandLight : brandPrimary,
    isDark ? brandSecondary : brandTertiary,
    themeNeutral.secondary,
    themeNeutral.tertiary,
    themeNeutral.quaternary,
    themeNeutral.negative,
    themeNeutral.positive,
  ], appearance)

  return {
    locale: lang === 'ar' ? 'ar-EG' : 'en-US',
    isRtl,
    palette: {
      ...themeNeutral,
      primary: seriesColors[0],
    },
    seriesColors,
  }
}

export function formatChartNumber(value: number | string, locale: string, options?: Intl.NumberFormatOptions) {
  const normalized = typeof value === 'number' ? value : Number(value)

  if (Number.isNaN(normalized)) {
    return String(value)
  }

  return new Intl.NumberFormat(locale, options).format(normalized)
}

export function resolveSeriesColor(series: ChartSeries, index: number, colors: string[]) {
  return series.color ?? colors[index % colors.length]
}
