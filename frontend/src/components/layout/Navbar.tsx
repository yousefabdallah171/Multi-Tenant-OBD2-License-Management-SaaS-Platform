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
import { managerService } from '@/services/manager.service'
import { superAdminBcrService } from '@/services/super-admin-bcr.service'
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

  const isBcrRole = user?.role === 'manager_parent' || user?.role === 'manager' || user?.role === 'super_admin'
  const bcrCountKey =
    user?.role === 'manager_parent' ? ['manager-parent', 'bios-change-requests', 'pending-count']
    : user?.role === 'manager' ? ['manager', 'bios-change-requests', 'pending-count']
    : ['super-admin', 'bios-change-requests', 'pending-count']
  const bcrCountFn =
    user?.role === 'manager_parent' ? () => managerParentService.getPendingBiosChangeRequestCount()
    : user?.role === 'manager' ? () => managerService.getPendingBiosChangeRequestCount()
    : () => superAdminBcrService.getPendingBiosChangeRequestCount()
  const bcrRecentFn =
    user?.role === 'manager_parent' ? () => managerParentService.getBiosChangeRequests({ status: 'pending', per_page: 5 })
    : user?.role === 'manager' ? () => managerService.getBiosChangeRequests({ status: 'pending', per_page: 5 })
    : () => superAdminBcrService.getBiosChangeRequests({ status: 'pending', per_page: 5 })
  const bcrPath =
    user?.role === 'manager_parent' ? routePaths.managerParent.biosChangeRequests(lang)
    : user?.role === 'manager' ? routePaths.manager.biosChangeRequests(lang)
    : routePaths.superAdmin.biosChangeRequests(lang)

  const pendingBcrQuery = useQuery({
    queryKey: bcrCountKey,
    queryFn: bcrCountFn,
    enabled: isBcrRole,
    ...liveQueryOptions(5_000),
  })
  const pendingBcrCount = pendingBcrQuery.data?.count ?? 0

  const recentBcrQuery = useQuery({
    queryKey: [...bcrCountKey.slice(0, 2), 'recent-panel'],
    queryFn: bcrRecentFn,
    enabled: isBcrRole,
    ...liveQueryOptions(5_000),
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

  const initials = user?.name
    ? user.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white shadow-sm shadow-slate-950/[0.06] dark:border-slate-800/50 dark:bg-slate-950 dark:shadow-slate-950/40">
      <div className="h-1 w-full bg-red-600" />
      <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-4 md:px-5">

        {/* Left — hamburger + identity */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 lg:hidden"
            onClick={toggleSidebar}
            aria-label={t('common.openNavigation')}
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>

          <div className="flex min-w-0 items-center gap-2.5">
            {logo ? (
              logo.startsWith('<svg') ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(logo, {
                      USE_PROFILES: { svg: true, svgFilters: true },
                      FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover'],
                    }),
                  }}
                  className="h-7 w-7 shrink-0"
                />
              ) : (
                <img src={logo} alt="Logo" className="h-7 w-auto shrink-0 object-contain" />
              )
            ) : (
              <span
                className="dashboard-text-helper shrink-0 text-xs font-bold uppercase tracking-widest"
                style={{ color: primaryColor }}
              >
                {eyebrow}
              </span>
            )}

            <div className="hidden min-w-0 sm:block">
              <p className="dashboard-text-label truncate font-semibold leading-tight text-slate-900 dark:text-white">{title}</p>
              <p className="dashboard-text-helper truncate leading-tight text-slate-400 dark:text-slate-500">{formatTimezoneLabel(activeTimezone)}</p>
            </div>
          </div>
        </div>

        {/* Right — actions + user */}
        <div className="flex shrink-0 items-center">

          {/* Icon strip */}
          <div className="flex items-center">
            {isBcrRole ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label={t('biosChangeRequests.bellLabel')}
                  >
                    <Bell className="h-[17px] w-[17px]" />
                    {pendingBcrCount > 0 ? (
                      <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950" />
                    ) : null}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1rem)] p-0 sm:w-96">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                    <div>
                      <p className="dashboard-text-body text-sm font-semibold text-slate-900 dark:text-white">
                        {t('biosChangeRequests.title')}
                      </p>
                      {pendingBcrCount > 0 ? (
                        <p className="dashboard-text-helper mt-0.5 text-xs text-rose-600 dark:text-rose-400">
                          {t('biosChangeRequests.pendingCount', { count: pendingBcrCount })}
                        </p>
                      ) : (
                        <p className="dashboard-text-helper mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {t('biosChangeRequests.noPending')}
                        </p>
                      )}
                    </div>
                  </div>
                  {recentRequests.length === 0 ? (
                    <div className="dashboard-text-body px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      {t('biosChangeRequests.noPending')}
                    </div>
                  ) : (
                    <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                      {recentRequests.map((req) => (
                        <DropdownMenuItem
                          key={req.id}
                          className="flex-col items-start gap-1 px-4 py-3 cursor-pointer"
                          onClick={() => navigate(bcrPath)}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <p className="dashboard-text-body truncate text-sm font-medium text-slate-900 dark:text-white">
                              {req.customer_name ?? '-'}
                            </p>
                            <span className="dashboard-text-helper shrink-0 text-xs text-slate-400 dark:text-slate-500">
                              {req.created_at ? formatDate(req.created_at, locale) : ''}
                            </span>
                          </div>
                          <p className="dashboard-text-helper text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono">{req.old_bios_id}</span>
                            {' → '}
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{req.new_bios_id}</span>
                          </p>
                          {req.reseller_name ? (
                            <p className="dashboard-text-helper text-xs text-slate-400 dark:text-slate-500">{req.reseller_name}</p>
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-slate-200 px-4 py-2.5 dark:border-slate-800">
                    <Link
                      to={bcrPath}
                      className="dashboard-text-helper block text-center text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                    >
                      {t('biosChangeRequests.viewAll')}
                    </Link>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              onClick={toggleTheme}
              aria-label={t('common.toggleTheme')}
            >
              {isDark ? <SunMedium className="h-[17px] w-[17px]" /> : <MoonStar className="h-[17px] w-[17px]" />}
            </button>

            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              onClick={switchLanguage}
              aria-label={t('common.switchLanguage')}
            >
              <Globe className="h-[17px] w-[17px]" />
            </button>

            {canInstall ? (
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                onClick={() => void promptInstall()}
                aria-label={t('common.installApp')}
              >
                <Download className="h-[17px] w-[17px]" />
              </button>
            ) : null}
          </div>

          {/* Separator */}
          <div className="mx-2 h-5 w-px bg-slate-200 dark:bg-slate-700" />

          {/* User chip */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('common.userMenu')}
                  className="group flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/70"
                >
                  {/* Avatar */}
                  <span
                    className="dashboard-text-helper inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-bold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {initials}
                  </span>

                  {/* Name + role */}
                  <div className="hidden min-w-0 text-start sm:block">
                    <p className="dashboard-text-label truncate font-semibold leading-tight text-slate-900 dark:text-white">{user.name}</p>
                    <p className="dashboard-text-helper truncate leading-tight text-slate-500 dark:text-slate-400">{user.email}</p>
                  </div>

                  <div className="hidden sm:block">
                    <RoleBadge role={user.role} />
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-w-[calc(100vw-1rem)] p-0 sm:w-64">
                <div className="px-4 py-3.5">
                  <p className="dashboard-text-body text-sm font-semibold text-slate-900 dark:text-white">{user.name}</p>
                  <p className="dashboard-text-helper mt-0.5 text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                  <div className="mt-2">
                    <RoleBadge role={user.role} />
                  </div>
                </div>
                <div className="border-t border-slate-100 p-1 dark:border-slate-800">
                  <DropdownMenuItem className="p-0 focus:bg-transparent dark:focus:bg-transparent">
                    <Button type="button" variant="ghost" className="dashboard-text-body h-9 w-full justify-start text-sm" onClick={() => void logout()}>
                      <LogOut className="me-2 h-4 w-4" />
                      {t('auth.logout')}
                    </Button>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </header>
  )
}
