import { Globe, LogOut, Menu, MoonStar, SunMedium } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { useTheme } from '@/hooks/useTheme'
import { useSidebarStore } from '@/stores/sidebarStore'

export function Navbar() {
  const { t } = useTranslation()
  const { lang, switchLanguage } = useLanguage()
  const { toggleTheme, isDark } = useTheme()
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
      <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-3">
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
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-400">{eyebrow}</p>
            <h1 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={switchLanguage} aria-label={t('common.switchLanguage')}>
            <Globe className="me-2 h-4 w-4" />
            {lang === 'ar' ? 'EN' : 'AR'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={toggleTheme} aria-label={t('common.toggleTheme')}>
            {isDark ? <SunMedium className="me-2 h-4 w-4" /> : <MoonStar className="me-2 h-4 w-4" />}
            {isDark ? t('common.lightMode') : t('common.darkMode')}
          </Button>
          {user ? (
            <details className="relative">
              <summary aria-label={t('common.userMenu')} className="flex cursor-pointer list-none items-center gap-3 rounded-2xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                <div className="hidden text-start sm:block">
                  <div className="font-medium text-slate-950 dark:text-white">{user.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                </div>
                <RoleBadge role={user.role} />
              </summary>
              <div className="absolute end-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900">
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
