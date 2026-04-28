import type { UserRole } from '@/types/user.types'

/**
 * Default primary colors for each role
 * Used when no tenant-specific branding color is set
 */
export const ROLE_DEFAULT_COLORS: Record<UserRole, string> = {
  super_admin: '#dc2626',    // rose-600
  manager_parent: '#4338ca', // indigo-700
  manager: '#7c3aed',        // violet-600
  reseller: '#059669',       // emerald-600
  customer: '#64748b',       // slate-500
}

/**
 * Pre-made SVG logos for each role
 * Displayed in Navbar when no custom logo is uploaded
 */
export const ROLE_LOGOS: Record<UserRole, string> = {
  super_admin: `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="36" rx="8" fill="#fee2e2"/>
    <path d="M18 8L20 12H16L18 8M10 18H26V26H10Z" fill="#dc2626" opacity="0.9"/>
    <path d="M13 14L14 16H22L23 14" fill="#dc2626"/>
  </svg>`,

  manager_parent: `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="36" rx="8" fill="#e0e7ff"/>
    <rect x="9" y="10" width="4" height="8" fill="#4338ca"/>
    <rect x="15" y="8" width="4" height="10" fill="#4338ca"/>
    <rect x="21" y="10" width="4" height="8" fill="#4338ca"/>
    <rect x="8" y="18" width="20" height="10" fill="#4338ca" opacity="0.7"/>
    <rect x="10" y="20" width="2" height="6" fill="#e0e7ff"/>
    <rect x="14" y="20" width="2" height="6" fill="#e0e7ff"/>
    <rect x="18" y="20" width="2" height="6" fill="#e0e7ff"/>
    <rect x="22" y="20" width="2" height="6" fill="#e0e7ff"/>
  </svg>`,

  manager: `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="36" rx="8" fill="#f5f3ff"/>
    <circle cx="18" cy="12" r="3.5" fill="#7c3aed"/>
    <path d="M 18 16 C 15 16 12 17.5 12 19 L 12 25 L 24 25 L 24 19 C 24 17.5 21 16 18 16 Z" fill="#7c3aed" opacity="0.8"/>
    <rect x="9" y="22" width="4" height="6" fill="#7c3aed" opacity="0.5"/>
    <rect x="23" y="22" width="4" height="6" fill="#7c3aed" opacity="0.5"/>
  </svg>`,

  reseller: `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="36" rx="8" fill="#dcfce7"/>
    <path d="M 10 15 L 12 9 L 18 8 L 24 9 L 26 15 Z" fill="#059669"/>
    <rect x="9" y="15" width="18" height="12" fill="#059669" opacity="0.7" rx="1"/>
    <circle cx="15" cy="27" r="1.5" fill="#059669"/>
    <circle cx="21" cy="27" r="1.5" fill="#059669"/>
    <line x1="12" y1="19" x2="24" y2="19" stroke="#dcfce7" stroke-width="1"/>
  </svg>`,

  customer: `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="36" rx="8" fill="#f1f5f9"/>
    <circle cx="18" cy="12" r="3" fill="#64748b"/>
    <path d="M 18 16 C 15.5 16 13 17 13 18.5 L 13 24 L 23 24 L 23 18.5 C 23 17 20.5 16 18 16 Z" fill="#64748b" opacity="0.8"/>
  </svg>`,
}

/**
 * Convert hex color to HSL
 * Returns [hue (0-360), saturation (0-100), lightness (0-100)]
 */
function hexToHsl(hex: string): [number, number, number] {
  const hex_cleaned = hex.replace('#', '')
  const r = parseInt(hex_cleaned.substring(0, 2), 16) / 255
  const g = parseInt(hex_cleaned.substring(2, 4), 16) / 255
  const b = parseInt(hex_cleaned.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return [h * 360, s * 100, l * 100]
}

/**
 * Convert HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  h = h / 360
  s = s / 100
  l = l / 100

  let r: number
  let g: number
  let b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Generate a full color ramp (50-950) from a single hex color
 * Returns CSS variable assignments to apply to :root
 */
export function generateColorRamp(hex: string): Record<string, string> {
  const [h, s] = hexToHsl(hex)

  const lightnesses = {
    '50': 97,
    '100': 94,
    '200': 87,
    '300': 76,
    '400': 62,
    '500': 49,
    '600': 37,
    '700': 27,
    '800': 20,
    '900': 13,
    '950': 8,
  }

  const ramp: Record<string, string> = {}

  for (const [shade, lightness] of Object.entries(lightnesses)) {
    ramp[`--brand-${shade}`] = hslToHex(h, s, lightness)
  }

  return ramp
}
