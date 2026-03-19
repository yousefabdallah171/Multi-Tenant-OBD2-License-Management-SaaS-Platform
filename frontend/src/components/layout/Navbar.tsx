import DOMPurify from 'dompurify'
import { Bell, Download, Globe, LogOut, Menu, MoonStar, SunMedium } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { useAuth } from '@/hooks/useAuth'
import { useBranding } from '@/hooks/useBranding'
import { useLanguage } from '@/hooks/useLanguage'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { useResolvedTimezone } from '@/hooks/useResolvedTimezone'
import { liveQueryOptions } from '@/lib/live-query'
import { formatTimezoneLabel } from '@/lib/timezones'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'
import { useTheme } from '@/hooks/useTheme'
import { useSidebarStore } from '@/stores/sidebarStore'
import { formatDate } from '@/lib/utils'

export function Navbar() {
  const { t } = useTranslation()
  const { lang, switchLanguage } = useLanguage()
  const { toggleTheme, isDark } = useTheme()
  const { canInstall, promptInstall } = usePwaInstall()
  const { user, logout } = useAuth()
  const { logo, primaryColor } = useBranding()
  const { timezone: activeTimezone } = useResolvedTimezone(user?.timezone)
  const toggleSidebar = useSidebarStore((state) => state.toggle)
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'

  const pendingBcrQuery = useQuery({
    queryKey: ['manager-parent', 'bios-change-requests', 'pending-count'],
    queryFn: () => managerParentService.getPendingBiosChangeRequestCount(),
    enabled: user?.role === 'manager_parent',
    ...liveQueryOptions(30_000),
  })
  const pendingBcrCount = pendingBcrQuery.data?.count ?? 0

  const recentBcrQuery = useQuery({
    queryKey: ['manager-parent', 'bios-change-requests', 'recent-panel'],
    queryFn: () => managerParentService.getBiosChangeRequests({ status: 'pending', per_page: 5 }),
    enabled: user?.role === 'manager_parent',
    ...liveQueryOptions(30_000),
  })
  const recentRequests = recentBcrQuery.data?.data ?? []

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
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur dark:bg-slate-950/90" style={{ borderBottomColor: primaryColor }}>
      <div className="h-1 w-full" style={{ backgroundColor: primaryColor }}></div>
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
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            {logo ? (
              logo.startsWith('<svg') ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(logo, {
                      USE_PROFILES: { svg: true, svgFilters: true },
                      FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover'],
                    }),
                  }}
                  className="h-7 w-8 shrink-0"
                />
              ) : (
                <img src={logo} alt="Logo" className="h-7 w-auto shrink-0 object-contain" />
              )
            ) : (
              <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: primaryColor }}>
                {eyebrow}
              </p>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-sm font-semibold text-slate-950 dark:text-white">{title}</h1>
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  {t('common.timezone', { defaultValue: 'Timezone' })}: {formatTimezoneLabel(activeTimezone)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {user?.role === 'manager_parent' ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                  aria-label={lang === 'ar' ? 'طلبات تغيير BIOS المعلقة' : 'Pending BIOS Change Requests'}
                >
                  <Bell className="h-4 w-4" />
                  {pendingBcrCount > 0 ? (
                    <span className="absolute right-1 top-1 flex min-w-[1.1rem] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold leading-none text-white" style={{ height: '1.1rem' }}>
                      {pendingBcrCount > 99 ? '99+' : pendingBcrCount}
                    </span>
                  ) : null}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1rem)] p-0 sm:w-96">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-white">
                      {lang === 'ar' ? 'طلبات تغيير BIOS' : 'BIOS Change Requests'}
                    </p>
                    {pendingBcrCount > 0 ? (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {lang === 'ar' ? `${pendingBcrCount} طلب معلق` : `${pendingBcrCount} pending`}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {lang === 'ar' ? 'لا توجد طلبات معلقة' : 'No pending requests'}
                      </p>
                    )}
                  </div>
                </div>
                {recentRequests.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    {lang === 'ar' ? 'لا توجد طلبات معلقة' : 'No pending requests'}
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {recentRequests.map((req) => (
                      <DropdownMenuItem
                        key={req.id}
                        className="flex-col items-start gap-1 px-4 py-3 cursor-pointer"
                        onClick={() => navigate(routePaths.managerParent.biosChangeRequests(lang))}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <p className="font-medium text-slate-950 dark:text-white text-sm truncate">
                            {req.customer_name ?? '-'}
                          </p>
                          <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                            {req.created_at ? formatDate(req.created_at, locale) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-mono">{req.old_bios_id}</span>
                          {' → '}
                          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{req.new_bios_id}</span>
                        </p>
                        {req.reseller_name ? (
                          <p className="text-xs text-slate-400 dark:text-slate-500">{req.reseller_name}</p>
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
                <div className="border-t border-slate-200 px-4 py-2 dark:border-slate-800">
                  <Link
                    to={routePaths.managerParent.biosChangeRequests(lang)}
                    className="block text-center text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                  >
                    {lang === 'ar' ? 'عرض جميع الطلبات' : 'View all requests'}
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 w-11 px-0 sm:h-10 sm:w-auto sm:px-3"
            onClick={toggleTheme}
            aria-label={t('common.toggleTheme')}
          >
            {isDark ? <SunMedium className="h-4 w-4 sm:me-2" /> : <MoonStar className="h-4 w-4 sm:me-2" />}
            <span className="hidden sm:inline">{isDark ? t('common.lightMode') : t('common.darkMode')}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 w-11 px-0 sm:h-10 sm:w-auto sm:px-3"
            onClick={switchLanguage}
            aria-label={t('common.switchLanguage')}
          >
            <Globe className="h-4 w-4 sm:me-2" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'EN' : 'AR'}</span>
          </Button>
          {canInstall ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 w-11 px-0 sm:h-10 sm:w-auto sm:px-3"
              onClick={() => void promptInstall()}
              aria-label={lang === 'ar' ? 'تثبيت التطبيق' : 'Install app'}
            >
              <Download className="h-4 w-4 sm:me-2" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'تثبيت' : 'Install'}</span>
            </Button>
          ) : null}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('common.userMenu')}
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 px-2 py-2 text-sm sm:gap-3 sm:px-3 dark:border-slate-800"
                >
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
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-w-[calc(100vw-1rem)] p-3 sm:w-64">
                <div className="space-y-1 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <div className="font-semibold text-slate-950 dark:text-white">{user.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                </div>
                <DropdownMenuItem className="mt-3 p-0 focus:bg-transparent dark:focus:bg-transparent">
                  <Button type="button" variant="ghost" className="w-full justify-start" onClick={() => void logout()}>
                    <LogOut className="me-2 h-4 w-4" />
                    {t('auth.logout')}
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </header>
  )
}
