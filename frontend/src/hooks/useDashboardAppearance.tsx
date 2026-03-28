import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import {
  activateDashboardAppearanceRoot,
  DASHBOARD_APPEARANCE_DEFAULTS,
  applyDashboardAppearanceVars,
  clearDashboardAppearanceVars,
  deactivateDashboardAppearanceRoot,
  ensureDashboardFontLoaded,
  normalizeDashboardAppearance,
  readCachedDashboardAppearance,
  writeCachedDashboardAppearance,
} from '@/lib/dashboard-appearance'
import { settingsService } from '@/services/settings.service'
import type { DashboardAppearanceSettings } from '@/types/super-admin.types'

interface DashboardAppearanceContextValue {
  appearance: DashboardAppearanceSettings
  isLoading: boolean
}

const DashboardAppearanceContext = createContext<DashboardAppearanceContextValue>({
  appearance: DASHBOARD_APPEARANCE_DEFAULTS,
  isLoading: false,
})

export function DashboardAppearanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const cachedAppearance = useMemo(() => readCachedDashboardAppearance(), [])
  const appearanceQuery = useQuery({
    queryKey: ['settings', 'dashboard-appearance'],
    queryFn: () => settingsService.getDashboardAppearance(),
    enabled: Boolean(user),
    initialData: cachedAppearance ? { data: cachedAppearance } : undefined,
    initialDataUpdatedAt: cachedAppearance ? 0 : undefined,
    staleTime: 5 * 60 * 1000,
  })

  const serverAppearance = useMemo(
    () => (appearanceQuery.data?.data ? normalizeDashboardAppearance(appearanceQuery.data.data) : null),
    [appearanceQuery.data?.data],
  )

  const appearance = useMemo(
    () => normalizeDashboardAppearance(serverAppearance ?? cachedAppearance ?? DASHBOARD_APPEARANCE_DEFAULTS),
    [cachedAppearance, serverAppearance],
  )

  const shouldHoldProtectedRender = Boolean(user) && !cachedAppearance && !serverAppearance && appearanceQuery.isLoading

  useLayoutEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    if (!user) {
      deactivateDashboardAppearanceRoot(document)
      clearDashboardAppearanceVars(document.documentElement)
      return
    }

    ensureDashboardFontLoaded(appearance.font_family, document)
    activateDashboardAppearanceRoot(document)
    applyDashboardAppearanceVars(document.documentElement, appearance)

    if (serverAppearance || cachedAppearance) {
      writeCachedDashboardAppearance(appearance)
    }
  }, [appearance, cachedAppearance, serverAppearance, user?.id])

  const value = useMemo(
    () => ({
      appearance,
      isLoading: appearanceQuery.isLoading,
    }),
    [appearance, appearanceQuery.isLoading],
  )

  if (shouldHoldProtectedRender) {
    return <div className="min-h-screen bg-surface-100 dark:bg-surface-950" aria-hidden="true" />
  }

  return (
    <DashboardAppearanceContext.Provider value={value}>
      {children}
    </DashboardAppearanceContext.Provider>
  )
}

export function DashboardAppearanceOverrideProvider({
  appearance,
  children,
}: {
  appearance: DashboardAppearanceSettings
  children: ReactNode
}) {
  const value = useMemo(
    () => ({
      appearance: normalizeDashboardAppearance(appearance),
      isLoading: false,
    }),
    [appearance],
  )

  return (
    <DashboardAppearanceContext.Provider value={value}>
      {children}
    </DashboardAppearanceContext.Provider>
  )
}

export function useDashboardAppearance() {
  return useContext(DashboardAppearanceContext)
}
