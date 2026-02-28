import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router-dom'
import { CustomerNavbar } from '@/components/layout/CustomerNavbar'
import { PageTransition } from '@/components/shared/PageTransition'
import { RouteErrorBoundary } from '@/components/shared/ErrorBoundary'
import { SkipToContent } from '@/components/shared/SkipToContent'
import { useLanguage } from '@/hooks/useLanguage'
import { routePaths } from '@/router/routes'

export function CustomerLayout() {
  const location = useLocation()
  const { lang } = useLanguage()
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
      <SkipToContent targetId="customer-main-content" />
      <CustomerNavbar />
      <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-7xl flex-col px-4 py-6">
        <main id="customer-main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          <RouteErrorBoundary dashboardHref={routePaths.customer.dashboard(lang)} resetKey={location.pathname}>
            <PageTransition transitionKey={location.pathname}>
              <Outlet />
            </PageTransition>
          </RouteErrorBoundary>
        </main>
        <footer className="mt-8 border-t border-slate-200 px-2 py-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {year} OBD2SW {t('brand.badge')}
        </footer>
      </div>
    </div>
  )
}
