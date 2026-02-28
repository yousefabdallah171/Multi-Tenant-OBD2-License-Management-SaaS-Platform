import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'
import { PageTransition } from '@/components/shared/PageTransition'
import { RouteErrorBoundary } from '@/components/shared/ErrorBoundary'
import { SkipToContent } from '@/components/shared/SkipToContent'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { getDashboardPath } from '@/router/routes'
import { useSidebarStore } from '@/stores/sidebarStore'

export function DashboardLayout() {
  const location = useLocation()
  const { user } = useAuth()
  const { lang } = useLanguage()
  const setCollapsed = useSidebarStore((state) => state.setCollapsed)

  useEffect(() => {
    const syncSidebar = () => {
      setCollapsed(window.innerWidth < 1024)
    }

    syncSidebar()
    window.addEventListener('resize', syncSidebar)

    return () => window.removeEventListener('resize', syncSidebar)
  }, [setCollapsed])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
      <SkipToContent targetId="dashboard-main-content" />
      <Navbar />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="dashboard-main-content" tabIndex={-1} className="flex-1 px-4 py-6 focus:outline-none md:px-6">
            <RouteErrorBoundary dashboardHref={getDashboardPath(user?.role ?? 'super_admin', lang)} resetKey={location.pathname}>
              <PageTransition transitionKey={location.pathname}>
                <Outlet />
              </PageTransition>
            </RouteErrorBoundary>
          </main>
          <Footer />
        </div>
      </div>
    </div>
  )
}
