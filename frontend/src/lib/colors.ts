/**
 * Centralized color configuration for the application
 * All colors are defined here and can be referenced throughout the app
 * Theme colors respond to brand color changes via CSS variables
 */

/**
 * Semantic colors that don't change with brand
 */
export const SEMANTIC_COLORS = {
  success: {
    light: '#dcfce7',
    main: '#22c55e',
    dark: '#15803d',
  },
  warning: {
    light: '#fef3c7',
    main: '#f59e0b',
    dark: '#b45309',
  },
  danger: {
    light: '#fee2e2',
    main: '#ef4444',
    dark: '#b91c1c',
  },
  info: {
    light: '#e0f2fe',
    main: '#0ea5e9',
    dark: '#0369a1',
  },
} as const

/**
 * Neutral/slate colors for backgrounds, borders, text
 */
export const NEUTRAL_COLORS = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
} as const

/**
 * Brand colors - these are CSS variables that change dynamically
 * Reference them using `var(--brand-XXX)` in CSS or use useChartTheme hook in components
 *
 * Available shades: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
 * Set via useBranding hook which applies generateColorRamp to :root
 */
export const BRAND_CSS_VARS = {
  50: 'var(--brand-50)',
  100: 'var(--brand-100)',
  200: 'var(--brand-200)',
  300: 'var(--brand-300)',
  400: 'var(--brand-400)',
  500: 'var(--brand-500)',
  600: 'var(--brand-600)',
  700: 'var(--brand-700)',
  800: 'var(--brand-800)',
  900: 'var(--brand-900)',
  950: 'var(--brand-950)',
} as const

/**
 * Get computed brand color from CSS variable at runtime
 * Useful when you need the actual hex value instead of the variable reference
 * Only works in browser context
 */
export function getBrandColor(shade: keyof typeof BRAND_CSS_VARS): string {
  if (typeof window === 'undefined') return '#0284c7'
  const varName = shade === '50' ? '--brand-50' : `--brand-${shade}`
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#0284c7'
}

/**
 * Common component color combinations
 * Use these for consistent UI across components
 */
export const COMPONENT_COLORS = {
  button: {
    primary: {
      bg: 'bg-brand-600',
      hoverBg: 'hover:bg-brand-500',
      text: 'text-white',
      ring: 'focus-visible:ring-brand-500',
    },
    secondary: {
      bg: 'bg-slate-100',
      hoverBg: 'hover:bg-slate-200',
      text: 'text-slate-900',
      darkBg: 'dark:bg-slate-800',
      darkHoverBg: 'dark:hover:bg-slate-700',
    },
  },
  input: {
    ring: 'focus-visible:ring-brand-500',
  },
  tab: {
    activeBg: 'data-[state=active]:bg-brand-100',
    activeText: 'data-[state=active]:text-brand-700',
    darkActiveBg: 'dark:data-[state=active]:bg-brand-950/40',
    darkActiveText: 'dark:data-[state=active]:text-brand-300',
  },
  sidebarLink: {
    activeBg: 'bg-brand-100',
    activeText: 'text-brand-700',
    darkActiveBg: 'dark:bg-brand-950/50',
    darkActiveText: 'dark:text-brand-300',
  },
} as const

/**
 * Status colors for badges and indicators
 */
export const STATUS_COLORS = {
  active: { light: '#dcfce7', main: '#16a34a', dark: '#15803d' },
  inactive: { light: '#fee2e2', main: '#dc2626', dark: '#b91c1c' },
  suspended: { light: '#fef3c7', main: '#f59e0b', dark: '#b45309' },
  pending: { light: '#e0f2fe', main: '#0ea5e9', dark: '#0369a1' },
} as const
