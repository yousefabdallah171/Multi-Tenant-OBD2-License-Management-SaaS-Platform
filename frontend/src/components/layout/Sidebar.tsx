import type { LucideIcon } from 'lucide-react'
import { Activity, AlertTriangle, BarChart3, Building2, ChevronDown, Download, FileText, History, KeyRound, LayoutDashboard, Package, PackagePlus, ScrollText, Settings, ShieldBan, User, UserRound, Users, Wallet } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { queryClient } from '@/lib/queryClient'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'
import { managerParentService } from '@/services/manager-parent.service'
import { useSidebarStore } from '@/stores/sidebarStore'
import { cn } from '@/lib/utils'

interface NavItem {
  key: string
  icon: LucideIcon
  href: (lang: 'ar' | 'en') => string
  translationKey: string
}

const superAdminItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: routePaths.superAdmin.dashboard, translationKey: 'superAdmin.nav.dashboard' },
  { key: 'tenants', icon: Building2, href: routePaths.superAdmin.tenants, translationKey: 'superAdmin.nav.tenants' },
  { key: 'users', icon: Users, href: routePaths.superAdmin.users, translationKey: 'superAdmin.nav.users' },
  { key: 'adminManagement', icon: Users, href: routePaths.superAdmin.adminManagement, translationKey: 'superAdmin.nav.adminManagement' },
  { key: 'biosBlacklist', icon: ShieldBan, href: routePaths.superAdmin.biosBlacklist, translationKey: 'superAdmin.nav.biosBlacklist' },
  { key: 'biosHistory', icon: History, href: routePaths.superAdmin.biosHistory, translationKey: 'superAdmin.nav.biosHistory' },
  { key: 'usernameManagement', icon: KeyRound, href: routePaths.superAdmin.usernameManagement, translationKey: 'superAdmin.nav.usernameManagement' },
  { key: 'securityLocks', icon: ShieldBan, href: routePaths.superAdmin.securityLocks, translationKey: 'superAdmin.nav.securityLocks' },
  { key: 'financialReports', icon: BarChart3, href: routePaths.superAdmin.financialReports, translationKey: 'superAdmin.nav.financialReports' },
  { key: 'reports', icon: BarChart3, href: routePaths.superAdmin.reports, translationKey: 'superAdmin.nav.reports' },
  { key: 'logs', icon: ScrollText, href: routePaths.superAdmin.logs, translationKey: 'superAdmin.nav.logs' },
  { key: 'apiStatus', icon: Activity, href: routePaths.superAdmin.apiStatus, translationKey: 'superAdmin.nav.apiStatus' },
  { key: 'settings', icon: Settings, href: routePaths.superAdmin.settings, translationKey: 'superAdmin.nav.settings' },
  { key: 'profile', icon: User, href: routePaths.superAdmin.profile, translationKey: 'superAdmin.nav.profile' },
]

const managerParentItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: routePaths.managerParent.dashboard, translationKey: 'managerParent.nav.dashboard' },
  { key: 'teamManagement', icon: Users, href: routePaths.managerParent.teamManagement, translationKey: 'managerParent.nav.teamManagement' },
  { key: 'resellerPricing', icon: Wallet, href: routePaths.managerParent.resellerPricing, translationKey: 'managerParent.nav.resellerPricing' },
  { key: 'software', icon: Package, href: routePaths.managerParent.software, translationKey: 'managerParent.nav.software' },
  { key: 'softwareManagement', icon: Package, href: routePaths.managerParent.softwareManagement, translationKey: 'managerParent.nav.softwareManagement' },
  { key: 'biosBlacklist', icon: ShieldBan, href: routePaths.managerParent.biosBlacklist, translationKey: 'managerParent.nav.biosBlacklist' },
  { key: 'biosHistory', icon: History, href: routePaths.managerParent.biosHistory, translationKey: 'managerParent.nav.biosHistory' },
  { key: 'biosConflicts', icon: AlertTriangle, href: routePaths.managerParent.biosConflicts, translationKey: 'managerParent.nav.biosConflicts' },
  { key: 'ipAnalytics', icon: Activity, href: routePaths.managerParent.ipAnalytics, translationKey: 'managerParent.nav.ipAnalytics' },
  { key: 'programLogs', icon: FileText, href: routePaths.managerParent.programLogs, translationKey: 'managerParent.nav.programLogs' },
  { key: 'usernameManagement', icon: KeyRound, href: routePaths.managerParent.usernameManagement, translationKey: 'managerParent.nav.usernameManagement' },
  { key: 'financialReports', icon: BarChart3, href: routePaths.managerParent.financialReports, translationKey: 'managerParent.nav.financialReports' },
  { key: 'reports', icon: ScrollText, href: routePaths.managerParent.reports, translationKey: 'managerParent.nav.reports' },
  { key: 'customers', icon: Users, href: routePaths.managerParent.customers, translationKey: 'managerParent.nav.customers' },
  { key: 'licenses', icon: KeyRound, href: routePaths.managerParent.licenses, translationKey: 'managerParent.nav.licenses' },
  { key: 'logsGroup', icon: FileText, href: routePaths.managerParent.logs, translationKey: 'managerParent.nav.logsGroup' },
  { key: 'settings', icon: Settings, href: routePaths.managerParent.settings, translationKey: 'managerParent.nav.settings' },
  { key: 'profile', icon: User, href: routePaths.managerParent.profile, translationKey: 'managerParent.nav.profile' },
]

const managerItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: routePaths.manager.dashboard, translationKey: 'manager.nav.dashboard' },
  { key: 'team', icon: Users, href: routePaths.manager.team, translationKey: 'manager.nav.team' },
  { key: 'usernameManagement', icon: KeyRound, href: routePaths.manager.usernameManagement, translationKey: 'manager.nav.usernameManagement' },
  { key: 'customers', icon: UserRound, href: routePaths.manager.customers, translationKey: 'manager.nav.customers' },
  { key: 'licenses', icon: KeyRound, href: routePaths.manager.licenses, translationKey: 'manager.nav.licenses' },
  { key: 'software', icon: Package, href: routePaths.manager.software, translationKey: 'manager.nav.software' },
  { key: 'softwareManagement', icon: PackagePlus, href: routePaths.manager.softwareManagement, translationKey: 'manager.nav.softwareManagement' },
  { key: 'reports', icon: BarChart3, href: routePaths.manager.reports, translationKey: 'manager.nav.reports' },
  { key: 'activity', icon: ScrollText, href: routePaths.manager.activity, translationKey: 'manager.nav.activity' },
  { key: 'profile', icon: User, href: routePaths.manager.profile, translationKey: 'manager.nav.profile' },
]

const resellerItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: routePaths.reseller.dashboard, translationKey: 'reseller.nav.dashboard' },
  { key: 'customers', icon: Users, href: routePaths.reseller.customers, translationKey: 'reseller.nav.customers' },
  { key: 'licenses', icon: KeyRound, href: routePaths.reseller.licenses, translationKey: 'reseller.nav.licenses' },
  { key: 'software', icon: Package, href: routePaths.reseller.software, translationKey: 'reseller.nav.software' },
  { key: 'reports', icon: BarChart3, href: routePaths.reseller.reports, translationKey: 'reseller.nav.reports' },
  { key: 'profile', icon: User, href: routePaths.reseller.profile, translationKey: 'reseller.nav.profile' },
]

const customerItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: routePaths.customer.dashboard, translationKey: 'customerPortal.nav.dashboard' },
  { key: 'software', icon: Package, href: routePaths.customer.software, translationKey: 'customerPortal.nav.software' },
  { key: 'download', icon: ScrollText, href: routePaths.customer.download, translationKey: 'customerPortal.nav.download' },
]

export function Sidebar() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { lang, isRtl } = useLanguage()
  const { canInstall, isInstalled, promptInstall } = usePwaInstall()
  const location = useLocation()
  const collapsed = useSidebarStore((state) => state.collapsed)
  const setCollapsed = useSidebarStore((state) => state.setCollapsed)
  const [installing, setInstalling] = useState(false)
  const logsChildPaths = useMemo(() => ([
    routePaths.managerParent.activity(lang),
    routePaths.managerParent.logs(lang),
    routePaths.managerParent.apiStatus(lang),
  ]), [lang])
  const isIos = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return false
    }

    return /iphone|ipad|ipod/i.test(navigator.userAgent)
  }, [])
  const shouldExpandLogs = user?.role === 'manager_parent' && logsChildPaths.some((path) => location.pathname.startsWith(path))
  const [logsOpen, setLogsOpen] = useState(shouldExpandLogs)

  useEffect(() => {
    if (shouldExpandLogs) {
      setLogsOpen(true)
    }
  }, [shouldExpandLogs])

  const items =
    user?.role === 'super_admin'
      ? superAdminItems
      : user?.role === 'manager_parent'
        ? managerParentItems
        : user?.role === 'manager'
          ? managerItems
          : user?.role === 'reseller'
            ? resellerItems
            : user?.role === 'customer'
              ? customerItems
            : []

  const managerParentLogsChildren: NavItem[] = [
    { key: 'activity', icon: ScrollText, href: routePaths.managerParent.activity, translationKey: 'managerParent.nav.activity' },
    { key: 'logs', icon: ScrollText, href: routePaths.managerParent.logs, translationKey: 'managerParent.nav.logs' },
    { key: 'apiStatus', icon: Activity, href: routePaths.managerParent.apiStatus, translationKey: 'managerParent.nav.apiStatus' },
  ]

  const prefetchNavData = (key: string) => {
    if (user?.role === 'manager_parent') {
      if (key === 'dashboard') {
        void queryClient.prefetchQuery({
          queryKey: ['manager-parent', 'dashboard'],
          queryFn: () => managerParentService.getDashboard(),
        })
      }

      if (key === 'programLogs') {
        void queryClient.prefetchQuery({
          queryKey: ['manager-parent', 'programs-with-external-api'],
          queryFn: () => managerParentService.getProgramsWithExternalApi(),
          staleTime: Number.POSITIVE_INFINITY,
          gcTime: 24 * 60 * 60 * 1000,
        })
      }
    }

    if (user?.role === 'manager' && key === 'dashboard') {
      void queryClient.prefetchQuery({
        queryKey: ['manager', 'dashboard'],
        queryFn: () => managerService.getDashboard(),
      })
    }
  }

  const handleInstallClick = async () => {
    if (!canInstall) {
      window.alert(isIos ? t('common.installAppIosHint') : t('common.installAppUnavailable'))
      return
    }

    setInstalling(true)
    try {
      await promptInstall()
    } finally {
      setInstalling(false)
    }
  }

  const showInstallSection = !isInstalled
  const showIosHint = isIos && !canInstall

  const navContent = (
    <nav className="space-y-2">
      {items.map((item) => {
        if (user?.role === 'manager_parent' && item.key === 'logsGroup') {
          const Icon = item.icon
          const label = t(item.translationKey)

          return (
            <div key={item.key} className="space-y-1">
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition',
                  'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
                  collapsed && 'justify-center lg:px-0',
                )}
                onClick={() => setLogsOpen((prev) => !prev)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn(collapsed ? 'lg:hidden' : 'inline')}>{label}</span>
                <ChevronDown className={cn('ms-auto h-4 w-4 transition-transform', logsOpen && 'rotate-180', collapsed && 'lg:hidden')} />
              </button>
              {logsOpen ? managerParentLogsChildren.map((child) => {
                const ChildIcon = child.icon
                const childLabel = t(child.translationKey)

                return (
                  <NavLink
                    key={child.key}
                    to={child.href(lang)}
                    className={({ isActive }) =>
                      cn(
                        'ms-8 flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition',
                        isActive ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
                      )
                    }
                    onClick={() => {
                      if (window.innerWidth < 1024) {
                        setCollapsed(true)
                      }
                    }}
                    onMouseEnter={() => prefetchNavData(child.key)}
                  >
                    <ChildIcon className="h-4 w-4 shrink-0" />
                    <span>{childLabel}</span>
                  </NavLink>
                )
              }) : null}
            </div>
          )
        }

        const Icon = item.icon
        const label = t(item.translationKey)

        return (
          <NavLink
            key={item.key}
            to={item.href(lang)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition',
                isActive ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
                collapsed && 'justify-center lg:px-0',
              )
            }
            title={label}
            onClick={() => {
              if (window.innerWidth < 1024) {
                setCollapsed(true)
              }
            }}
            onMouseEnter={() => prefetchNavData(item.key)}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed ? 'lg:hidden' : 'inline')}>{label}</span>
          </NavLink>
        )
      })}

      {showInstallSection ? (
        <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800 lg:hidden">
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition',
              'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
              collapsed && 'justify-center lg:px-0',
            )}
            title={t('common.installApp')}
            onClick={() => void handleInstallClick()}
            disabled={installing}
          >
            <Download className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed ? 'lg:hidden' : 'inline')}>
              {installing ? t('common.installing') : t('common.installApp')}
            </span>
          </button>
          {showIosHint ? (
            <p className={cn('px-3 pt-1 text-xs text-slate-500 dark:text-slate-400', collapsed && 'lg:hidden')}>
              {t('common.installAppIosHint')}
            </p>
          ) : null}
        </div>
      ) : null}
    </nav>
  )

  return (
    <>
      <button
        type="button"
        aria-label={t('common.closeNavigation')}
        aria-hidden={collapsed}
        className={cn('fixed inset-0 z-30 bg-slate-950/40 transition-opacity duration-200 lg:hidden', collapsed ? 'pointer-events-none opacity-0' : 'opacity-100')}
        onClick={() => setCollapsed(true)}
      />
      <div
        data-testid="desktop-sidebar-shell"
        className={cn(
          'hidden lg:block lg:shrink-0',
          collapsed ? 'lg:w-24' : 'lg:w-72',
        )}
      >
        <aside
          data-testid="desktop-sidebar"
          className={cn(
            'sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto border-slate-200 bg-white/95 px-3 py-4 shadow-none backdrop-blur dark:border-slate-800 dark:bg-slate-950/95',
            isRtl ? 'border-l' : 'border-r',
          )}
        >
          {navContent}
        </aside>
      </div>
      <aside
        data-testid="mobile-sidebar"
        className={cn(
          'fixed top-16 z-40 h-[calc(100vh-4rem)] w-72 max-w-[85vw] overflow-y-auto border-slate-200 bg-white/95 px-3 py-4 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:hidden',
          'transition-transform duration-200 ease-out',
          collapsed ? (isRtl ? 'translate-x-full' : '-translate-x-full') : 'translate-x-0',
          isRtl ? 'right-0 border-l' : 'left-0 border-r',
        )}
      >
        {navContent}
      </aside>
    </>
  )
}
