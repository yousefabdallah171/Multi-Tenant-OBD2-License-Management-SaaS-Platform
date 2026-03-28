import { useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_DEFAULT_COLORS, ROLE_LOGOS, generateColorRamp } from '@/lib/role-branding'

export function useBranding() {
  const { user } = useAuth()

  const branding = useMemo(() => {
    if (!user) {
      return {
        logo: null,
        primaryColor: '#4338ca',
        isCustomLogo: false,
      }
    }

    // Color hierarchy: User > Tenant > Role Default > Indigo
    const userColor = user.branding?.primary_color
    const tenantColor = user.tenant?.settings?.branding?.primary_color
    const roleDefaultColor = ROLE_DEFAULT_COLORS[user.role]
    const primaryColor = userColor ?? tenantColor ?? roleDefaultColor ?? '#4338ca'

    // Logo hierarchy: Tenant Custom > Role SVG > None
    const customLogo = user.tenant?.settings?.branding?.logo
    const roleSvgLogo = ROLE_LOGOS[user.role]
    const logo = customLogo ?? roleSvgLogo ?? null
    const isCustomLogo = Boolean(customLogo)

    return {
      logo,
      primaryColor,
      isCustomLogo,
    }
  }, [user?.tenant?.settings, user?.role, user?.branding?.primary_color])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const ramp = generateColorRamp(branding.primaryColor)
    Object.entries(ramp).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value)
    })
  }, [branding.primaryColor])

  return branding
}
