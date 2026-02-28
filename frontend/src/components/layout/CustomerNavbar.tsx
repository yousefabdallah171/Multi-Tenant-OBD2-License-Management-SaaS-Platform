import { useState } from 'react'
import { Globe, LogOut, Menu, MoonStar, SunMedium } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { routePaths } from '@/router/routes'

export function CustomerNavbar() {
  const { t } = useTranslation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { lang, switchLanguage } = useLanguage()
  const { isDark, toggleTheme } = useTheme()
  const { user, logout } = useAuth()

  const links = [
    { key: 'dashboard', href: routePaths.customer.dashboard(lang), label: t('customerPortal.nav.dashboard') },
    { key: 'software', href: routePaths.customer.software(lang), label: t('customerPortal.nav.software') },
    { key: 'download', href: routePaths.customer.download(lang), label: t('customerPortal.nav.download') },
  ]

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <Link to={routePaths.customer.dashboard(lang)} className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-400">{t('customerPortal.layout.eyebrow')}</p>
              <p className="text-lg font-semibold text-slate-950 dark:text-white">{t('customerPortal.layout.title')}</p>
            </Link>

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" className="h-11 px-3" onClick={switchLanguage}>
                <Globe className="me-2 h-4 w-4" />
                {lang === 'ar' ? 'EN' : 'AR'}
              </Button>
              <Button type="button" variant="ghost" className="h-11 px-3" onClick={toggleTheme}>
                {isDark ? <SunMedium className="me-2 h-4 w-4" /> : <MoonStar className="me-2 h-4 w-4" />}
                {isDark ? t('common.lightMode') : t('common.darkMode')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-11 px-0 md:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label={t('customerPortal.nav.openMenu')}
              >
                <Menu className="h-5 w-5" />
              </Button>
              {user ? (
                <details className="relative">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-2xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-800">
                    <div className="hidden text-start sm:block">
                      <div className="font-medium text-slate-950 dark:text-white">{user.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 font-semibold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                      {user.name.slice(0, 1).toUpperCase()}
                    </div>
                  </summary>
                  <div className="absolute end-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    <div className="space-y-1 border-b border-slate-200 pb-3 dark:border-slate-800">
                      <div className="font-semibold text-slate-950 dark:text-white">{user.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                    </div>
                    <Button type="button" variant="ghost" className="mt-3 h-11 w-full justify-start" onClick={() => void logout()}>
                      <LogOut className="me-2 h-4 w-4" />
                      {t('auth.logout')}
                    </Button>
                  </div>
                </details>
              ) : null}
            </div>
          </div>

          <nav className="hidden flex-wrap gap-2 pb-4 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.key}
                to={link.href}
                className={({ isActive }) =>
                  cn(
                    'min-h-11 rounded-full px-4 py-3 text-sm font-medium transition',
                    isActive ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('customerPortal.nav.menuTitle')}</DialogTitle>
          </DialogHeader>
          <nav className="flex flex-col gap-2">
            {links.map((link) => (
              <NavLink
                key={link.key}
                to={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-2xl px-4 py-3 text-sm font-medium transition',
                    isActive ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </DialogContent>
      </Dialog>
    </>
  )
}
