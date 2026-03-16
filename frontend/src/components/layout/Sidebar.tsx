import type { LucideIcon } from 'lucide-react'
import { Activity, AlertTriangle, BarChart3, Building2, ChevronDown, Download, FileText, History, LayoutDashboard, Package, PackagePlus, ScrollText, Settings, ShieldBan, User, UserRound, Users } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useBranding } from '@/hooks/useBranding'
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
  { key: 'customers', icon: UserRound, href: routePaths.superAdmin.customers, translationKey: 'superAdmin.nav.customers' },
  { key: 'adminManagementGroup', icon: Users, href: routePaths.superAdmin.adminManagement, translationKey: 'superAdmin.nav.adminManagement' },
  { key: 'biosBlacklistGroup', icon: ShieldBan, href: routePaths.superAdmin.biosBlacklist, translationKey: 'superAdmin.nav.biosBlacklist' },
  { key: 'securityLocks', icon: ShieldBan, href: routePaths.superAdmin.securityLocks, translationKey: 'superAdmin.nav.securityLocks' },
  { key: 'reports', icon: BarChart3, href: routePaths.superAdmin.reports, translationKey: 'superAdmin.nav.reports' },
  { key: 'logs', icon: ScrollText, href: routePaths.superAdmin.logs, translationKey: 'superAdmin.nav.logs' },
  { key: 'apiStatus', icon: Activity, href: routePaths.superAdmin.apiStatus, translationKey: 'superAdmin.nav.apiStatus' },
  { key: 'settingsGroup', icon: Settings, href: routePaths.superAdmin.settings, translationKey: 'superAdmin.nav.settings' },
]

const managerParentItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: routePaths.managerParent.dashboard, translationKey: 'managerParent.nav.dashboard' },
  { key: 'teamManagement', icon: Users, href: routePaths.managerParent.teamManagement, translationKey: 'managerParent.nav.teamManagement' },
  { key: 'customers', icon: Users, href: routePaths.managerParent.customers, translationKey: 'managerParent.nav.customers' },
  { key: 'software', icon: Package, href: routePaths.managerParent.software, translationKey: 'managerParent.nav.software' },
  { key: 'softwareManagement', icon: Package, href: routePaths.managerParent.softwareManagement, translationKey: 'managerParent.nav.softwareManagement' },
  { key: 'reports', icon: BarChart3, href: routePaths.managerParent.reports, translationKey: 'managerParent.nav.financialReports' },
  { key: 'programLogs', icon: FileText, href: routePaths.managerParent.programLogs, translationKey: 'managerParent.nav.programLogs' },
  { key: 'biosBlacklistGroup', icon: ShieldBan, href: routePaths.managerParent.biosBlacklist, translationKey: 'managerParent.nav.biosBlacklist' },
  { key: 'resellerPayments', icon: BarChart3, href: routePaths.managerParent.resellerPayments, translationKey: 'managerParent.nav.resellerPayments' },
  { key: 'ipAnalytics', icon: Activity, href: routePaths.managerParent.ipAnalytics, translationKey: 'managerParent.nav.ipAnalytics' },
  { key: 'logsGroup', icon: FileText, href: routePaths.managerParent.logs, translationKey: 'managerParent.nav.logsGroup' },
  { key: 'settingsGroup', icon: Settings, href: routePaths.managerParent.settings, translationKey: 'managerParent.nav.settings' },
]

const managerItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: routePaths.manager.dashboard, translationKey: 'manager.nav.dashboard' },
  { key: 'team', icon: Users, href: routePaths.manager.team, translationKey: 'manager.nav.team' },
  { key: 'customers', icon: UserRound, href: routePaths.manager.customers, translationKey: 'manager.nav.customers' },
  { key: 'software', icon: Package, href: routePaths.manager.software, translationKey: 'manager.nav.software' },
  { key: 'softwareManagement', icon: PackagePlus, href: routePaths.manager.softwareManagement, translationKey: 'manager.nav.softwareManagement' },
  { key: 'biosGroup', icon: History, href: routePaths.manager.biosDetails, translationKey: 'manager.nav.biosDetails' },
  { key: 'resellerPayments', icon: BarChart3, href: routePaths.manager.resellerPayments, translationKey: 'manager.nav.resellerPayments' },
  { key: 'reports', icon: BarChart3, href: routePaths.manager.reports, translationKey: 'manager.nav.reports' },
  { key: 'activity', icon: ScrollText, href: routePaths.manager.activity, translationKey: 'manager.nav.activity' },
  { key: 'resellerLogs', icon: ScrollText, href: routePaths.manager.resellerLogs, translationKey: 'manager.nav.resellerLogs' },
  { key: 'profile', icon: User, href: routePaths.manager.profile, translationKey: 'manager.nav.profile' },
]

const resellerItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: routePaths.reseller.dashboard, translationKey: 'reseller.nav.dashboard' },
  { key: 'customers', icon: Users, href: routePaths.reseller.customers, translationKey: 'reseller.nav.customers' },
  { key: 'software', icon: Package, href: routePaths.reseller.software, translationKey: 'reseller.nav.software' },
  { key: 'paymentStatus', icon: BarChart3, href: routePaths.reseller.paymentStatus, translationKey: 'reseller.nav.paymentStatus' },
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
  const { primaryColor } = useBranding()
  const { lang, isRtl } = useLanguage()
  const { canInstall, isInstalled, promptInstall } = usePwaInstall()
  const location = useLocation()
  const collapsed = useSidebarStore((state) => state.collapsed)
  const setCollapsed = useSidebarStore((state) => state.setCollapsed)
  const [installing, setInstalling] = useState(false)
  const logsChildPaths = useMemo(() => ([
    routePaths.managerParent.activity(lang),
    routePaths.managerParent.resellerLogs(lang),
    routePaths.managerParent.apiStatus(lang),
  ]), [lang])
  const settingsChildPaths = useMemo(() => ([
    routePaths.superAdmin.settings(lang),
    routePaths.superAdmin.profile(lang),
    routePaths.managerParent.settings(lang),
    routePaths.managerParent.profile(lang),
  ]), [lang])
  const managerParentBiosPaths = useMemo(() => ([
    routePaths.managerParent.biosBlacklist(lang),
    routePaths.managerParent.biosHistory(lang),
    routePaths.managerParent.biosDetails(lang),
    routePaths.managerParent.biosChangeRequests(lang),
    routePaths.managerParent.biosConflicts(lang),
  ]), [lang])
  const managerBiosPaths = useMemo(() => ([
    routePaths.manager.biosDetails(lang),
    routePaths.manager.biosChangeRequests(lang),
  ]), [lang])
  const superAdminAdminManagementPaths = useMemo(() => ([
    routePaths.superAdmin.adminManagement(lang),
    routePaths.superAdmin.users(lang),
  ]), [lang])
  const superAdminBiosPaths = useMemo(() => ([
    routePaths.superAdmin.biosBlacklist(lang),
    routePaths.superAdmin.biosHistory(lang),
    routePaths.superAdmin.biosDetails(lang),
    routePaths.superAdmin.biosConflicts(lang),
  ]), [lang])
  const isIos = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return false
    }

    return /iphone|ipad|ipod/i.test(navigator.userAgent)
  }, [])
  const shouldExpandLogs = user?.role === 'manager_parent' && logsChildPaths.some((path) => location.pathname.startsWith(path))
  const [logsOpen, setLogsOpen] = useState(shouldExpandLogs)
  const shouldExpandSettings =
    (user?.role === 'super_admin' || user?.role === 'manager_parent') &&
    settingsChildPaths.some((path) => location.pathname.startsWith(path))
  const [settingsOpen, setSettingsOpen] = useState(shouldExpandSettings)
  const shouldExpandManagerParentBios = user?.role === 'manager_parent' && managerParentBiosPaths.some((path) => location.pathname.startsWith(path))
  const [managerParentBiosOpen, setManagerParentBiosOpen] = useState(shouldExpandManagerParentBios)
  const shouldExpandManagerBios = user?.role === 'manager' && managerBiosPaths.some((path) => location.pathname.startsWith(path))
  const [managerBiosOpen, setManagerBiosOpen] = useState(shouldExpandManagerBios)
  const shouldExpandSuperAdminAdminManagement = user?.role === 'super_admin' && superAdminAdminManagementPaths.some((path) => location.pathname.startsWith(path))
  const [superAdminAdminManagementOpen, setSuperAdminAdminManagementOpen] = useState(shouldExpandSuperAdminAdminManagement)
  const shouldExpandSuperAdminBios = user?.role === 'super_admin' && superAdminBiosPaths.some((path) => location.pathname.startsWith(path))
  const [superAdminBiosOpen, setSuperAdminBiosOpen] = useState(shouldExpandSuperAdminBios)

  useEffect(() => {
    if (shouldExpandLogs) {
      setLogsOpen(true)
    }
  }, [shouldExpandLogs])

  useEffect(() => {
    if (shouldExpandSettings) {
      setSettingsOpen(true)
    }
  }, [shouldExpandSettings])

  useEffect(() => {
    if (shouldExpandManagerParentBios) {
      setManagerParentBiosOpen(true)
    }
  }, [shouldExpandManagerParentBios])

  useEffect(() => {
    if (shouldExpandManagerBios) {
      setManagerBiosOpen(true)
    }
  }, [shouldExpandManagerBios])

  useEffect(() => {
    if (shouldExpandSuperAdminAdminManagement) {
      setSuperAdminAdminManagementOpen(true)
    }
  }, [shouldExpandSuperAdminAdminManagement])

  useEffect(() => {
    if (shouldExpandSuperAdminBios) {
      setSuperAdminBiosOpen(true)
    }
  }, [shouldExpandSuperAdminBios])

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
    { key: 'resellerLogs', icon: ScrollText, href: routePaths.managerParent.resellerLogs, translationKey: 'managerParent.nav.resellerLogs' },
    { key: 'apiStatus', icon: Activity, href: routePaths.managerParent.apiStatus, translationKey: 'managerParent.nav.apiStatus' },
  ]
  const managerParentBiosChildren: NavItem[] = [
    { key: 'biosBlacklist', icon: ShieldBan, href: routePaths.managerParent.biosBlacklist, translationKey: 'managerParent.nav.biosBlacklist' },
    { key: 'biosHistory', icon: History, href: routePaths.managerParent.biosHistory, translationKey: 'managerParent.nav.biosHistory' },
    { key: 'biosDetails', icon: History, href: routePaths.managerParent.biosDetails, translationKey: 'managerParent.nav.biosDetails' },
    { key: 'biosChangeRequests', icon: History, href: routePaths.managerParent.biosChangeRequests, translationKey: 'managerParent.nav.biosChangeRequests' },
    { key: 'biosConflicts', icon: AlertTriangle, href: routePaths.managerParent.biosConflicts, translationKey: 'managerParent.nav.biosConflicts' },
  ]
  const managerBiosChildren: NavItem[] = [
    { key: 'biosDetails', icon: History, href: routePaths.manager.biosDetails, translationKey: 'manager.nav.biosDetails' },
    { key: 'biosChangeRequests', icon: AlertTriangle, href: routePaths.manager.biosChangeRequests, translationKey: 'manager.nav.biosChangeRequests' },
  ]
  const superAdminSettingsChildren: NavItem[] = [
    { key: 'settings', icon: Settings, href: routePaths.superAdmin.settings, translationKey: 'superAdmin.nav.settings' },
    { key: 'profile', icon: User, href: routePaths.superAdmin.profile, translationKey: 'superAdmin.nav.profile' },
  ]
  const superAdminAdminManagementChildren: NavItem[] = [
    { key: 'adminManagement', icon: Users, href: routePaths.superAdmin.adminManagement, translationKey: 'superAdmin.nav.adminManagement' },
    { key: 'users', icon: Users, href: routePaths.superAdmin.users, translationKey: 'superAdmin.nav.users' },
  ]
  const superAdminBiosChildren: NavItem[] = [
    { key: 'biosBlacklist', icon: ShieldBan, href: routePaths.superAdmin.biosBlacklist, translationKey: 'superAdmin.nav.biosBlacklist' },
    { key: 'biosHistory', icon: History, href: routePaths.superAdmin.biosHistory, translationKey: 'superAdmin.nav.biosHistory' },
    { key: 'biosDetails', icon: History, href: routePaths.superAdmin.biosDetails, translationKey: 'superAdmin.nav.biosDetails' },
    { key: 'biosConflicts', icon: AlertTriangle, href: routePaths.superAdmin.biosConflicts, translationKey: 'superAdmin.nav.biosConflicts' },
  ]
  const managerParentSettingsChildren: NavItem[] = [
    { key: 'settings', icon: Settings, href: routePaths.managerParent.settings, translationKey: 'managerParent.nav.settings' },
    { key: 'profile', icon: User, href: routePaths.managerParent.profile, translationKey: 'managerParent.nav.profile' },
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
                        isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
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

        if (user?.role === 'manager_parent' && item.key === 'biosBlacklistGroup') {
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
                onClick={() => setManagerParentBiosOpen((prev) => !prev)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn(collapsed ? 'lg:hidden' : 'inline')}>{label}</span>
                <ChevronDown className={cn('ms-auto h-4 w-4 transition-transform', managerParentBiosOpen && 'rotate-180', collapsed && 'lg:hidden')} />
              </button>
              {managerParentBiosOpen ? managerParentBiosChildren.map((child) => {
                const ChildIcon = child.icon
                const childLabel = t(child.translationKey)

                return (
                  <NavLink
                    key={child.key}
                    to={child.href(lang)}
                    className={({ isActive }) =>
                      cn(
                        'ms-8 flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition',
                        isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
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

        if (user?.role === 'manager' && item.key === 'biosGroup') {
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
                onClick={() => setManagerBiosOpen((prev) => !prev)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn(collapsed ? 'lg:hidden' : 'inline')}>{label}</span>
                <ChevronDown className={cn('ms-auto h-4 w-4 transition-transform', managerBiosOpen && 'rotate-180', collapsed && 'lg:hidden')} />
              </button>
              {managerBiosOpen ? managerBiosChildren.map((child) => {
                const ChildIcon = child.icon
                const childLabel = t(child.translationKey)

                return (
                  <NavLink
                    key={child.key}
                    to={child.href(lang)}
                    className={({ isActive }) =>
                      cn(
                        'ms-8 flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition',
                        isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
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

        if ((user?.role === 'super_admin' || user?.role === 'manager_parent') && item.key === 'settingsGroup') {
          const Icon = item.icon
          const label = t(item.translationKey)
          const settingsChildren = user.role === 'super_admin' ? superAdminSettingsChildren : managerParentSettingsChildren

          return (
            <div key={item.key} className="space-y-1">
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition',
                  'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
                  collapsed && 'justify-center lg:px-0',
                )}
                onClick={() => setSettingsOpen((prev) => !prev)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn(collapsed ? 'lg:hidden' : 'inline')}>{label}</span>
                <ChevronDown className={cn('ms-auto h-4 w-4 transition-transform', settingsOpen && 'rotate-180', collapsed && 'lg:hidden')} />
              </button>
              {settingsOpen ? settingsChildren.map((child) => {
                const ChildIcon = child.icon
                const childLabel = t(child.translationKey)

                return (
                  <NavLink
                    key={child.key}
                    to={child.href(lang)}
                    className={({ isActive }) =>
                      cn(
                        'ms-8 flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition',
                        isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
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

        if (user?.role === 'super_admin' && item.key === 'adminManagementGroup') {
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
                onClick={() => setSuperAdminAdminManagementOpen((prev) => !prev)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn(collapsed ? 'lg:hidden' : 'inline')}>{label}</span>
                <ChevronDown className={cn('ms-auto h-4 w-4 transition-transform', superAdminAdminManagementOpen && 'rotate-180', collapsed && 'lg:hidden')} />
              </button>
              {superAdminAdminManagementOpen ? superAdminAdminManagementChildren.map((child) => {
                const ChildIcon = child.icon
                const childLabel = t(child.translationKey)

                return (
                  <NavLink
                    key={child.key}
                    to={child.href(lang)}
                    className={({ isActive }) =>
                      cn(
                        'ms-8 flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition',
                        isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
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

        if (user?.role === 'super_admin' && item.key === 'biosBlacklistGroup') {
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
                onClick={() => setSuperAdminBiosOpen((prev) => !prev)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn(collapsed ? 'lg:hidden' : 'inline')}>{label}</span>
                <ChevronDown className={cn('ms-auto h-4 w-4 transition-transform', superAdminBiosOpen && 'rotate-180', collapsed && 'lg:hidden')} />
              </button>
              {superAdminBiosOpen ? superAdminBiosChildren.map((child) => {
                const ChildIcon = child.icon
                const childLabel = t(child.translationKey)

                return (
                  <NavLink
                    key={child.key}
                    to={child.href(lang)}
                    className={({ isActive }) =>
                      cn(
                        'ms-8 flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition',
                        isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
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
                isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
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
            'sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto border-l-4 bg-white/95 px-3 py-4 shadow-none backdrop-blur dark:bg-slate-950/95',
            isRtl ? 'border-r-4' : 'border-l-4',
          )}
          style={{ borderColor: primaryColor }}
        >
          {navContent}
        </aside>
      </div>
      <aside
        data-testid="mobile-sidebar"
        className={cn(
          'fixed top-16 z-40 h-[calc(100vh-4rem)] w-72 max-w-[85vw] overflow-y-auto border-l-4 bg-white/95 px-3 py-4 shadow-2xl backdrop-blur dark:bg-slate-950/95 lg:hidden',
          'transition-transform duration-200 ease-out',
          collapsed ? (isRtl ? 'translate-x-full' : '-translate-x-full') : 'translate-x-0',
          isRtl ? 'right-0 border-r-4' : 'left-0 border-l-4',
        )}
        style={{ borderColor: primaryColor }}
      >
        {navContent}
      </aside>
    </>
  )
}

