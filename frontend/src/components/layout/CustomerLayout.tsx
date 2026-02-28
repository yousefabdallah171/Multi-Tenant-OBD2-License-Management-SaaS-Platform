import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { CustomerNavbar } from '@/components/layout/CustomerNavbar'

export function CustomerLayout() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
      <CustomerNavbar />
      <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-7xl flex-col px-4 py-6">
        <main className="flex-1">
          <Outlet />
        </main>
        <footer className="mt-8 border-t border-slate-200 px-2 py-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {year} OBD2SW {t('brand.badge')}
        </footer>
      </div>
    </div>
  )
}
