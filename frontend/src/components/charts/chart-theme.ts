import { useLanguage } from '@/hooks/useLanguage'
import { useTheme } from '@/hooks/useTheme'

export interface ChartSeries {
  key: string
  label?: string
  color?: string
  stackId?: string
}

const LIGHT_COLORS = {
  grid: '#dbe4ef',
  axis: '#64748b',
  tooltipBackground: '#ffffff',
  tooltipBorder: '#cbd5e1',
  primary: '#0284c7',
  secondary: '#0f766e',
  tertiary: '#f59e0b',
  quaternary: '#c026d3',
  positive: '#16a34a',
  negative: '#dc2626',
}

const DARK_COLORS = {
  grid: '#334155',
  axis: '#cbd5e1',
  tooltipBackground: '#0f172a',
  tooltipBorder: '#334155',
  primary: '#38bdf8',
  secondary: '#34d399',
  tertiary: '#fbbf24',
  quaternary: '#c084fc',
  positive: '#4ade80',
  negative: '#fb7185',
}

const LIGHT_SERIES_COLORS = ['#0284c7', '#0f766e', '#f59e0b', '#c026d3', '#2563eb', '#e11d48', '#7c3aed']
const DARK_SERIES_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#c084fc', '#60a5fa', '#fb7185', '#a78bfa']

export function useChartTheme() {
  const { isDark } = useTheme()
  const { lang, isRtl } = useLanguage()

  return {
    locale: lang === 'ar' ? 'ar-EG' : 'en-US',
    isRtl,
    palette: isDark ? DARK_COLORS : LIGHT_COLORS,
    seriesColors: isDark ? DARK_SERIES_COLORS : LIGHT_SERIES_COLORS,
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
