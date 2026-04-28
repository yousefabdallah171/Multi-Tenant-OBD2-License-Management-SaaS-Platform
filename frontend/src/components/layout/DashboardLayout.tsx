import { useCallback, useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'
import { PageTransition } from '@/components/shared/PageTransition'
import { RouteErrorBoundary } from '@/components/shared/ErrorBoundary'
import { OnlineUsersWidget } from '@/components/shared/OnlineUsersWidget'
import { SkipToContent } from '@/components/shared/SkipToContent'
import { AppToaster } from '@/components/ui/toast'
import { useAuth } from '@/hooks/useAuth'
import { useBcrNotification } from '@/hooks/useBcrNotification'
import { useLanguage } from '@/hooks/useLanguage'
import { clearImpersonationState, getImpersonationState, isImpersonationActive } from '@/lib/impersonation'
import { getDashboardPath } from '@/router/routes'
import { superAdminPlatformService } from '@/services/super-admin-platform.service'
import { useSidebarStore } from '@/stores/sidebarStore'
import { Button } from '@/components/ui/button'

export function DashboardLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const { user, isAuthenticated, syncCurrentUser } = useAuth()
  const { lang } = useLanguage()
  const setCollapsed = useSidebarStore((state) => state.setCollapsed)
  const syncStateRef = useRef({ inFlight: false, lastRunAt: 0 })
  const impersonationState = isImpersonationActive() ? getImpersonationState() : null

  useBcrNotification(
    user?.role === 'manager_parent' ? 'manager_parent'
    : user?.role === 'manager' ? 'manager'
    : user?.role === 'super_admin' ? 'super_admin'
    : false
  )

  useEffect(() => {
    const syncSidebar = () => {
      setCollapsed(window.innerWidth < 1024)
    }

    syncSidebar()
    window.addEventListener('resize', syncSidebar)

    return () => window.removeEventListener('resize', syncSidebar)
  }, [setCollapsed])

  const refreshCurrentUser = useCallback(
    async (force = false) => {
      if (!isAuthenticated) {
        return
      }

      if (typeof window === 'undefined') {
        return
      }

      const now = Date.now()
      if (!force && (syncStateRef.current.inFlight || now - syncStateRef.current.lastRunAt < 5000)) {
        return
      }

      syncStateRef.current.inFlight = true
      syncStateRef.current.lastRunAt = now

      try {
        await syncCurrentUser()
      } catch {
        // Auth interceptors already handle expired sessions.
      } finally {
        syncStateRef.current.inFlight = false
      }
    },
    [isAuthenticated, syncCurrentUser],
  )

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    void refreshCurrentUser(true)

    const handleFocus = () => {
      void refreshCurrentUser()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshCurrentUser()
      }
    }

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshCurrentUser()
      }
    }, 10000)

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(heartbeat)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, refreshCurrentUser])

  return (
    <div className="dashboard-app min-h-screen bg-surface-100 text-slate-950 dark:bg-surface-950 dark:text-white">
      <SkipToContent targetId="dashboard-main-content" />
      <Navbar />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="dashboard-main-content" tabIndex={-1} className="flex-1 px-4 py-5 focus:outline-none md:px-6 md:py-6">
            {impersonationState ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                <div>
                  {t('superAdmin.pages.impersonation.bannerText', {
                    target: impersonationState.target.name,
                    role: impersonationState.target.role,
                    actor: impersonationState.actor.email,
                  })}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const current = getImpersonationState()
                    clearImpersonationState()
                    void superAdminPlatformService.stopImpersonation({
                      target_user_id: current?.target.id,
                      target_role: current?.target.role,
                    }).catch(() => {
                      // best effort audit logging only
                    }).finally(() => {
                      void syncCurrentUser()
                      toast.success(t('superAdmin.pages.impersonation.stopSuccess'))
                    })
                  }}
                >
                  {t('superAdmin.pages.impersonation.stop')}
                </Button>
              </div>
            ) : null}
            <RouteErrorBoundary dashboardHref={getDashboardPath(user?.role ?? 'super_admin', lang)} resetKey={location.pathname}>
              <PageTransition transitionKey={location.pathname}>
                <Outlet />
              </PageTransition>
            </RouteErrorBoundary>
          </main>
          <Footer />
        </div>
      </div>
      <OnlineUsersWidget />
      <AppToaster />
    </div>
  )
}
