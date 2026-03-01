import { Download, Globe, LogOut, Menu, MoonStar, SunMedium } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { useTheme } from '@/hooks/useTheme'
import { useSidebarStore } from '@/stores/sidebarStore'

export function Navbar() {
  const { t } = useTranslation()
  const { lang, switchLanguage } = useLanguage()
  const { toggleTheme, isDark } = useTheme()
  const { canInstall, promptInstall } = usePwaInstall()
  const { user, logout } = useAuth()
  const toggleSidebar = useSidebarStore((state) => state.toggle)
  const title = user
    ? user.role === 'super_admin'
      ? t('superAdmin.layout.title')
      : user.role === 'manager_parent'
        ? t('managerParent.layout.title')
        : user.role === 'manager'
          ? t('manager.layout.title')
        : t(`roles.${user.role}`)
    : t('superAdmin.layout.title')
  const eyebrow = user
    ? user.role === 'super_admin'
      ? 'OBD2SW'
      : user.role === 'manager_parent'
        ? t('managerParent.layout.eyebrow')
        : user.role === 'manager'
          ? t('manager.layout.eyebrow')
        : t(`roles.${user.role}`)
    : 'OBD2SW'

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 md:h-16 md:flex-nowrap md:gap-4 md:px-6 md:py-0">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={toggleSidebar}
            aria-label={t('common.openNavigation')}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-400">{eyebrow}</p>
            <h1 className="truncate text-sm font-semibold text-slate-950 dark:text-white">{title}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {canInstall ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 px-0 sm:h-9 sm:w-auto sm:px-3"
              onClick={() => void promptInstall()}
              aria-label={lang === 'ar' ? 'تثبيت التطبيق' : 'Install app'}
            >
              <Download className="h-4 w-4 sm:me-2" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'تثبيت' : 'Install'}</span>
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="h-9 w-9 px-0 sm:h-9 sm:w-auto sm:px-3" onClick={switchLanguage} aria-label={t('common.switchLanguage')}>
            <Globe className="h-4 w-4 sm:me-2" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'EN' : 'AR'}</span>
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-9 w-9 px-0 sm:h-9 sm:w-auto sm:px-3" onClick={toggleTheme} aria-label={t('common.toggleTheme')}>
            {isDark ? <SunMedium className="h-4 w-4 sm:me-2" /> : <MoonStar className="h-4 w-4 sm:me-2" />}
            <span className="hidden sm:inline">{isDark ? t('common.lightMode') : t('common.darkMode')}</span>
          </Button>
          {user ? (
            <details className="relative">
              <summary aria-label={t('common.userMenu')} className="flex cursor-pointer list-none items-center gap-2 rounded-2xl border border-slate-200 px-2 py-2 text-sm sm:gap-3 sm:px-3 dark:border-slate-800">
                <div className="hidden text-start sm:block">
                  <div className="font-medium text-slate-950 dark:text-white">{user.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                </div>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:hidden">
                  {user.name?.charAt(0).toUpperCase()}
                </span>
                <div className="hidden sm:block">
                  <RoleBadge role={user.role} />
                </div>
              </summary>
              <div className="absolute end-0 mt-2 w-56 max-w-[calc(100vw-1rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:w-64 dark:border-slate-800 dark:bg-slate-900">
                <div className="space-y-1 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <div className="font-semibold text-slate-950 dark:text-white">{user.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                </div>
                <Button type="button" variant="ghost" className="mt-3 w-full justify-start" onClick={() => void logout()}>
                  <LogOut className="me-2 h-4 w-4" />
                  {t('auth.logout')}
                </Button>
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </header>
  )
}
