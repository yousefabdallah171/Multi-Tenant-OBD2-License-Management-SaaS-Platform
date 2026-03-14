import { useBranding } from '@/hooks/useBranding'
import { useLanguage } from '@/hooks/useLanguage'
import { useTheme } from '@/hooks/useTheme'
import { generateColorRamp } from '@/lib/role-branding'

export interface ChartSeries {
  key: string
  label?: string
  color?: string
  stackId?: string
}

const LIGHT_NEUTRAL = {
  grid: '#dbe4ef',
  axis: '#64748b',
  tooltipBackground: '#ffffff',
  tooltipBorder: '#cbd5e1',
  secondary: '#0f766e',
  tertiary: '#f59e0b',
  quaternary: '#c026d3',
  positive: '#16a34a',
  negative: '#dc2626',
}

const DARK_NEUTRAL = {
  grid: '#334155',
  axis: '#cbd5e1',
  tooltipBackground: '#0f172a',
  tooltipBorder: '#334155',
  secondary: '#34d399',
  tertiary: '#fbbf24',
  quaternary: '#c084fc',
  positive: '#4ade80',
  negative: '#fb7185',
}

export function useChartTheme() {
  const { isDark } = useTheme()
  const { primaryColor } = useBranding()
  const { lang, isRtl } = useLanguage()

  const ramp = generateColorRamp(primaryColor)
  const brandPrimary = ramp['--brand-600'] || primaryColor
  const brandSecondary = ramp['--brand-400'] || primaryColor
  const brandTertiary = ramp['--brand-700'] || primaryColor
  const brandLight = ramp['--brand-300'] || primaryColor

  const palette = isDark ? DARK_NEUTRAL : LIGHT_NEUTRAL

  return {
    locale: lang === 'ar' ? 'ar-EG' : 'en-US',
    isRtl,
    palette: {
      ...palette,
      primary: isDark ? brandLight : brandPrimary,
    },
    seriesColors: [
      isDark ? brandLight : brandPrimary,
      isDark ? brandSecondary : brandTertiary,
      LIGHT_NEUTRAL.secondary,
      LIGHT_NEUTRAL.tertiary,
      LIGHT_NEUTRAL.quaternary,
      LIGHT_NEUTRAL.negative,
      LIGHT_NEUTRAL.positive,
    ],
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
