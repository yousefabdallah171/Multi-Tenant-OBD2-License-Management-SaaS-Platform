import type { CSSProperties } from 'react'
import type { DashboardAppearanceSettings } from '@/types/super-admin.types'
import { AUTH_SESSION_STORAGE_KEY, AUTH_STORAGE_KEY } from '@/lib/constants'
import { generateColorRamp } from '@/lib/role-branding'

export type DashboardSurfaceGroup = keyof DashboardAppearanceSettings['surfaces']
export interface DashboardFontOption {
  id: string
  label: string
  fontFamily: string
  googleFamilies: string[]
}

export const DASHBOARD_FONT_FALLBACK = 'ui-sans-serif, system-ui, -apple-system, sans-serif'
export const DASHBOARD_APPEARANCE_STORAGE_KEY = 'dashboard-appearance:v1'
export const DASHBOARD_CUSTOM_FONT_OPTION_ID = 'custom'
const DASHBOARD_FONT_LINK_ID = 'dashboard-appearance-font-link'
const DASHBOARD_APPEARANCE_ACTIVE_ATTRIBUTE = 'data-dashboard-appearance'
const DASHBOARD_ACTIVE_ROLES = new Set(['super_admin', 'manager_parent', 'manager', 'reseller'])

export const DASHBOARD_APPEARANCE_DEFAULTS: DashboardAppearanceSettings = {
  font_family: `'Cairo', ${DASHBOARD_FONT_FALLBACK}`,
  font_sizes: {
    display_px: 28,
    heading_px: 18,
    body_px: 14,
    label_px: 13,
    table_header_px: 14,
    table_cell_px: 14,
    helper_px: 12,
  },
  font_weights: {
    display: 800,
    heading: 700,
    body: 500,
    label: 600,
    table_header: 700,
  },
  surfaces: {
    cards: { opacity_percent: 100, brightness_percent: 100 },
    charts: { opacity_percent: 100, brightness_percent: 100 },
    badges: { opacity_percent: 100, brightness_percent: 100 },
  },
}

export const DASHBOARD_FONT_OPTIONS: DashboardFontOption[] = [
  {
    id: 'cairo',
    label: 'Cairo',
    fontFamily: `'Cairo', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['Cairo:wght@400;500;600;700;800'],
  },
  {
    id: 'alexandria',
    label: 'Alexandria',
    fontFamily: `'Alexandria', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['Alexandria:wght@400;500;600;700;800'],
  },
  {
    id: 'tajawal',
    label: 'Tajawal',
    fontFamily: `'Tajawal', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['Tajawal:wght@400;500;700;800'],
  },
  {
    id: 'noto-sans-arabic',
    label: 'Noto Sans Arabic',
    fontFamily: `'Noto Sans Arabic', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['Noto+Sans+Arabic:wght@400;500;600;700;800'],
  },
  {
    id: 'readex-pro',
    label: 'Readex Pro',
    fontFamily: `'Readex Pro', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['Readex+Pro:wght@400;500;600;700'],
  },
  {
    id: 'ibm-plex-sans-arabic',
    label: 'IBM Plex Sans Arabic',
    fontFamily: `'IBM Plex Sans Arabic', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['IBM+Plex+Sans+Arabic:wght@400;500;600;700'],
  },
  {
    id: 'almarai',
    label: 'Almarai',
    fontFamily: `'Almarai', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['Almarai:wght@300;400;700;800'],
  },
  {
    id: 'mada',
    label: 'Mada',
    fontFamily: `'Mada', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['Mada:wght@400;500;600;700;800;900'],
  },
  {
    id: 'changa',
    label: 'Changa',
    fontFamily: `'Changa', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['Changa:wght@400;500;600;700;800'],
  },
  {
    id: 'el-messiri',
    label: 'El Messiri',
    fontFamily: `'El Messiri', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['El+Messiri:wght@400;500;600;700'],
  },
  {
    id: 'harmattan',
    label: 'Harmattan',
    fontFamily: `'Harmattan', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['Harmattan:wght@400;500;600;700'],
  },
  {
    id: 'amiri',
    label: 'Amiri',
    fontFamily: `'Amiri', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['Amiri:wght@400;700'],
  },
  {
    id: 'lemonada',
    label: 'Lemonada',
    fontFamily: `'Lemonada', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['Lemonada:wght@400;500;600;700'],
  },
  {
    id: 'marhey',
    label: 'Marhey',
    fontFamily: `'Marhey', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['Marhey:wght@400;500;600;700'],
  },
  {
    id: 'zain',
    label: 'Zain',
    fontFamily: `'Zain', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['Zain:wght@300;400;700;800;900'],
  },
  {
    id: 'noto-kufi-arabic',
    label: 'Noto Kufi Arabic',
    fontFamily: `'Noto Kufi Arabic', ${DASHBOARD_FONT_FALLBACK}`,
    googleFamilies: ['Noto+Kufi+Arabic:wght@400;500;600;700;800'],
  },
]

const dashboardAppearanceVars = [
  '--dashboard-font-family',
  '--dashboard-font-size-display',
  '--dashboard-font-size-heading',
  '--dashboard-font-size-body',
  '--dashboard-font-size-label',
  '--dashboard-font-size-table-header',
  '--dashboard-font-size-table-cell',
  '--dashboard-font-size-helper',
  '--dashboard-font-weight-display',
  '--dashboard-font-weight-heading',
  '--dashboard-font-weight-body',
  '--dashboard-font-weight-label',
  '--dashboard-font-weight-table-header',
  '--dashboard-cards-opacity',
  '--dashboard-cards-brightness',
  '--dashboard-charts-opacity',
  '--dashboard-charts-brightness',
  '--dashboard-badges-opacity',
  '--dashboard-badges-brightness',
] as const

function buildGoogleFontsUrl(fontOption: DashboardFontOption) {
  const params = new URLSearchParams()

  fontOption.googleFamilies.forEach((family) => {
    params.append('family', family)
  })
  params.set('display', 'swap')

  return `https://fonts.googleapis.com/css2?${params.toString()}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeWeight(value: number, fallback: 400 | 500 | 600 | 700 | 800 | 900) {
  return [400, 500, 600, 700, 800, 900].includes(value) ? value as 400 | 500 | 600 | 700 | 800 | 900 : fallback
}

export function isSafeDashboardFontFamily(value: string) {
  const normalized = value.toLowerCase()

  return !(
    normalized.includes('url(')
    || normalized.includes('expression')
    || normalized.includes('@import')
    || normalized.includes('{')
    || normalized.includes('}')
    || normalized.includes(';')
  )
}

export function normalizeDashboardFontFamily(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed || !isSafeDashboardFontFamily(trimmed)) {
    return DASHBOARD_APPEARANCE_DEFAULTS.font_family
  }

  const hasGenericFamily = /(sans-serif|serif|monospace|system-ui|cursive|fantasy)/i.test(trimmed)
  return hasGenericFamily ? trimmed : `${trimmed}, ${DASHBOARD_FONT_FALLBACK}`
}

export function getDashboardFontOptionByFamily(value?: string | null) {
  const normalized = normalizeDashboardFontFamily(value)

  return DASHBOARD_FONT_OPTIONS.find((option) => normalizeDashboardFontFamily(option.fontFamily) === normalized) ?? null
}

function hasStoredDashboardSession() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const storedAuth = window.localStorage.getItem(AUTH_STORAGE_KEY) ?? window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)
    if (!storedAuth) {
      return false
    }

    const parsed = JSON.parse(storedAuth) as { user?: { role?: string | null } | null }
    return DASHBOARD_ACTIVE_ROLES.has(parsed.user?.role ?? '')
  } catch {
    return false
  }
}

export function normalizeDashboardAppearance(payload?: Partial<DashboardAppearanceSettings> | null): DashboardAppearanceSettings {
  const merged: DashboardAppearanceSettings = {
    font_family: normalizeDashboardFontFamily(payload?.font_family),
    font_sizes: {
      ...DASHBOARD_APPEARANCE_DEFAULTS.font_sizes,
      ...(payload?.font_sizes ?? {}),
    },
    font_weights: {
      ...DASHBOARD_APPEARANCE_DEFAULTS.font_weights,
      ...(payload?.font_weights ?? {}),
    },
    surfaces: {
      cards: { ...DASHBOARD_APPEARANCE_DEFAULTS.surfaces.cards, ...(payload?.surfaces?.cards ?? {}) },
      charts: { ...DASHBOARD_APPEARANCE_DEFAULTS.surfaces.charts, ...(payload?.surfaces?.charts ?? {}) },
      badges: { ...DASHBOARD_APPEARANCE_DEFAULTS.surfaces.badges, ...(payload?.surfaces?.badges ?? {}) },
    },
  }

  return {
    font_family: merged.font_family,
    font_sizes: {
      display_px: clamp(Number(merged.font_sizes.display_px) || DASHBOARD_APPEARANCE_DEFAULTS.font_sizes.display_px, 16, 56),
      heading_px: clamp(Number(merged.font_sizes.heading_px) || DASHBOARD_APPEARANCE_DEFAULTS.font_sizes.heading_px, 10, 48),
      body_px: clamp(Number(merged.font_sizes.body_px) || DASHBOARD_APPEARANCE_DEFAULTS.font_sizes.body_px, 10, 48),
      label_px: clamp(Number(merged.font_sizes.label_px) || DASHBOARD_APPEARANCE_DEFAULTS.font_sizes.label_px, 10, 48),
      table_header_px: clamp(Number(merged.font_sizes.table_header_px) || DASHBOARD_APPEARANCE_DEFAULTS.font_sizes.table_header_px, 10, 48),
      table_cell_px: clamp(Number(merged.font_sizes.table_cell_px) || DASHBOARD_APPEARANCE_DEFAULTS.font_sizes.table_cell_px, 10, 48),
      helper_px: clamp(Number(merged.font_sizes.helper_px) || DASHBOARD_APPEARANCE_DEFAULTS.font_sizes.helper_px, 10, 48),
    },
    font_weights: {
      display: normalizeWeight(Number(merged.font_weights.display), DASHBOARD_APPEARANCE_DEFAULTS.font_weights.display),
      heading: normalizeWeight(Number(merged.font_weights.heading), DASHBOARD_APPEARANCE_DEFAULTS.font_weights.heading),
      body: normalizeWeight(Number(merged.font_weights.body), DASHBOARD_APPEARANCE_DEFAULTS.font_weights.body),
      label: normalizeWeight(Number(merged.font_weights.label), DASHBOARD_APPEARANCE_DEFAULTS.font_weights.label),
      table_header: normalizeWeight(Number(merged.font_weights.table_header), DASHBOARD_APPEARANCE_DEFAULTS.font_weights.table_header),
    },
    surfaces: {
      cards: {
        opacity_percent: clamp(Number(merged.surfaces.cards.opacity_percent) || DASHBOARD_APPEARANCE_DEFAULTS.surfaces.cards.opacity_percent, 35, 100),
        brightness_percent: clamp(Number(merged.surfaces.cards.brightness_percent) || DASHBOARD_APPEARANCE_DEFAULTS.surfaces.cards.brightness_percent, 80, 120),
      },
      charts: {
        opacity_percent: clamp(Number(merged.surfaces.charts.opacity_percent) || DASHBOARD_APPEARANCE_DEFAULTS.surfaces.charts.opacity_percent, 35, 100),
        brightness_percent: clamp(Number(merged.surfaces.charts.brightness_percent) || DASHBOARD_APPEARANCE_DEFAULTS.surfaces.charts.brightness_percent, 80, 120),
      },
      badges: {
        opacity_percent: clamp(Number(merged.surfaces.badges.opacity_percent) || DASHBOARD_APPEARANCE_DEFAULTS.surfaces.badges.opacity_percent, 35, 100),
        brightness_percent: clamp(Number(merged.surfaces.badges.brightness_percent) || DASHBOARD_APPEARANCE_DEFAULTS.surfaces.badges.brightness_percent, 80, 120),
      },
    },
  }
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').trim()
  const fullHex = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized

  const value = Number.parseInt(fullHex, 16)

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`
}

function adjustHexBrightness(hex: string, brightnessPercent: number) {
  const factor = brightnessPercent / 100
  const { r, g, b } = hexToRgb(hex)

  return rgbToHex(r * factor, g * factor, b * factor)
}

function toRgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`
}

export function applyDashboardAppearanceVars(target: HTMLElement, appearance: DashboardAppearanceSettings) {
  const next = normalizeDashboardAppearance(appearance)

  Object.entries(getDashboardAppearanceCssVariables(next)).forEach(([key, value]) => {
    target.style.setProperty(key, value)
  })
}

export function ensureDashboardFontLoaded(fontFamily: string, doc: Document = document) {
  const fontOption = getDashboardFontOptionByFamily(fontFamily)
  const existingLink = doc.getElementById(DASHBOARD_FONT_LINK_ID) as HTMLLinkElement | null

  if (!fontOption) {
    existingLink?.remove()
    return
  }

  const href = buildGoogleFontsUrl(fontOption)

  if (existingLink) {
    if (existingLink.href !== href) {
      existingLink.href = href
    }
    return
  }

  const link = doc.createElement('link')
  link.id = DASHBOARD_FONT_LINK_ID
  link.rel = 'stylesheet'
  link.href = href
  doc.head.appendChild(link)
}

export function activateDashboardAppearanceRoot(doc: Document = document) {
  doc.documentElement.setAttribute(DASHBOARD_APPEARANCE_ACTIVE_ATTRIBUTE, 'active')
}

export function deactivateDashboardAppearanceRoot(doc: Document = document) {
  doc.documentElement.removeAttribute(DASHBOARD_APPEARANCE_ACTIVE_ATTRIBUTE)
}

export function readCachedDashboardAppearance(): DashboardAppearanceSettings | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(DASHBOARD_APPEARANCE_STORAGE_KEY)
    if (!raw) {
      return null
    }

    return normalizeDashboardAppearance(JSON.parse(raw) as Partial<DashboardAppearanceSettings>)
  } catch {
    window.localStorage.removeItem(DASHBOARD_APPEARANCE_STORAGE_KEY)
    return null
  }
}

export function writeCachedDashboardAppearance(appearance: DashboardAppearanceSettings) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    DASHBOARD_APPEARANCE_STORAGE_KEY,
    JSON.stringify(normalizeDashboardAppearance(appearance)),
  )
}

export function primeDashboardAppearanceFromStorage(target: HTMLElement = document.documentElement) {
  const cachedAppearance = readCachedDashboardAppearance()

  if (!hasStoredDashboardSession()) {
    return null
  }

  const appearance = cachedAppearance ?? DASHBOARD_APPEARANCE_DEFAULTS

  ensureDashboardFontLoaded(appearance.font_family, target.ownerDocument)
  activateDashboardAppearanceRoot(target.ownerDocument)
  applyDashboardAppearanceVars(target, appearance)
  return appearance
}

export function getDashboardAppearanceCssVariables(appearance: DashboardAppearanceSettings): Record<string, string> {
  const next = normalizeDashboardAppearance(appearance)

  return {
    '--dashboard-font-family': next.font_family,
    '--dashboard-font-size-display': `${next.font_sizes.display_px}px`,
    '--dashboard-font-size-heading': `${next.font_sizes.heading_px}px`,
    '--dashboard-font-size-body': `${next.font_sizes.body_px}px`,
    '--dashboard-font-size-label': `${next.font_sizes.label_px}px`,
    '--dashboard-font-size-table-header': `${next.font_sizes.table_header_px}px`,
    '--dashboard-font-size-table-cell': `${next.font_sizes.table_cell_px}px`,
    '--dashboard-font-size-helper': `${next.font_sizes.helper_px}px`,
    '--dashboard-font-weight-display': String(next.font_weights.display),
    '--dashboard-font-weight-heading': String(next.font_weights.heading),
    '--dashboard-font-weight-body': String(next.font_weights.body),
    '--dashboard-font-weight-label': String(next.font_weights.label),
    '--dashboard-font-weight-table-header': String(next.font_weights.table_header),
    '--dashboard-cards-opacity': String(next.surfaces.cards.opacity_percent),
    '--dashboard-cards-brightness': String(next.surfaces.cards.brightness_percent),
    '--dashboard-charts-opacity': String(next.surfaces.charts.opacity_percent),
    '--dashboard-charts-brightness': String(next.surfaces.charts.brightness_percent),
    '--dashboard-badges-opacity': String(next.surfaces.badges.opacity_percent),
    '--dashboard-badges-brightness': String(next.surfaces.badges.brightness_percent),
  }
}

export function getDashboardAppearanceInlineVars(appearance: DashboardAppearanceSettings): CSSProperties {
  return getDashboardAppearanceCssVariables(appearance)
}

export function clearDashboardAppearanceVars(target: HTMLElement) {
  dashboardAppearanceVars.forEach((variable) => target.style.removeProperty(variable))
}

export function resolveDashboardSurfacePalette(
  baseColor: string,
  group: DashboardSurfaceGroup,
  appearance: DashboardAppearanceSettings,
  isDark: boolean,
) {
  const ramp = generateColorRamp(baseColor)
  const control = appearance.surfaces[group]
  const opacityFactor = control.opacity_percent / 100
  const brightness = control.brightness_percent

  const background = adjustHexBrightness(ramp[isDark ? '--brand-900' : '--brand-100'], brightness)
  const border = adjustHexBrightness(ramp[isDark ? '--brand-800' : '--brand-200'], brightness)
  const accent = adjustHexBrightness(ramp[isDark ? '--brand-400' : '--brand-500'], brightness)
  const text = adjustHexBrightness(ramp[isDark ? '--brand-300' : '--brand-700'], clamp(brightness, 90, 115))

  return {
    backgroundColor: toRgba(background, (isDark ? 0.36 : 0.84) * opacityFactor),
    borderColor: toRgba(border, (isDark ? 0.9 : 1) * opacityFactor),
    color: text,
    accentColor: accent,
    accentSoftColor: toRgba(accent, (isDark ? 0.22 : 0.18) * opacityFactor),
  }
}

export function resolveDashboardSurfaceStyle(
  baseColor: string,
  group: DashboardSurfaceGroup,
  appearance: DashboardAppearanceSettings,
  isDark: boolean,
): CSSProperties {
  const palette = resolveDashboardSurfacePalette(baseColor, group, appearance, isDark)

  return {
    backgroundColor: palette.backgroundColor,
    borderColor: palette.borderColor,
  }
}

export function resolveDashboardChartColors(
  baseColors: string[],
  appearance: DashboardAppearanceSettings,
) {
  const brightness = appearance.surfaces.charts.brightness_percent
  const opacity = appearance.surfaces.charts.opacity_percent / 100

  return baseColors.map((color) => toRgba(adjustHexBrightness(color, brightness), opacity))
}
