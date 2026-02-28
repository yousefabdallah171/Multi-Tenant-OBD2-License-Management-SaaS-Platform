import type { LucideIcon } from 'lucide-react'
import { Activity, BarChart3, Building2, History, KeyRound, LayoutDashboard, Package, ScrollText, Settings, ShieldBan, User, UserCog, Users, Wallet } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { routePaths } from '@/router/routes'
import { useSidebarStore } from '@/stores/sidebarStore'
import { cn } from '@/lib/utils'

interface NavItem {
  key: string
  icon: LucideIcon
  href: (lang: 'ar' | 'en') => string
  label?: string
  translationKey?: string
}

const superAdminItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: routePaths.superAdmin.dashboard, translationKey: 'superAdmin.nav.dashboard' },
  { key: 'tenants', icon: Building2, href: routePaths.superAdmin.tenants, translationKey: 'superAdmin.nav.tenants' },
  { key: 'users', icon: Users, href: routePaths.superAdmin.users, translationKey: 'superAdmin.nav.users' },
  { key: 'adminManagement', icon: UserCog, href: routePaths.superAdmin.adminManagement, translationKey: 'superAdmin.nav.adminManagement' },
  { key: 'biosBlacklist', icon: ShieldBan, href: routePaths.superAdmin.biosBlacklist, translationKey: 'superAdmin.nav.biosBlacklist' },
  { key: 'biosHistory', icon: History, href: routePaths.superAdmin.biosHistory, translationKey: 'superAdmin.nav.biosHistory' },
  { key: 'usernameManagement', icon: KeyRound, href: routePaths.superAdmin.usernameManagement, translationKey: 'superAdmin.nav.usernameManagement' },
  { key: 'financialReports', icon: BarChart3, href: routePaths.superAdmin.financialReports, translationKey: 'superAdmin.nav.financialReports' },
  { key: 'reports', icon: BarChart3, href: routePaths.superAdmin.reports, translationKey: 'superAdmin.nav.reports' },
  { key: 'logs', icon: ScrollText, href: routePaths.superAdmin.logs, translationKey: 'superAdmin.nav.logs' },
  { key: 'apiStatus', icon: Activity, href: routePaths.superAdmin.apiStatus, translationKey: 'superAdmin.nav.apiStatus' },
  { key: 'settings', icon: Settings, href: routePaths.superAdmin.settings, translationKey: 'superAdmin.nav.settings' },
  { key: 'profile', icon: User, href: routePaths.superAdmin.profile, translationKey: 'superAdmin.nav.profile' },
]

const managerParentItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: routePaths.managerParent.dashboard, label: 'Dashboard' },
  { key: 'teamManagement', icon: Users, href: routePaths.managerParent.teamManagement, label: 'Team Management' },
  { key: 'resellerPricing', icon: Wallet, href: routePaths.managerParent.resellerPricing, label: 'Reseller Pricing' },
  { key: 'softwareManagement', icon: Package, href: routePaths.managerParent.softwareManagement, label: 'Software Management' },
  { key: 'biosBlacklist', icon: ShieldBan, href: routePaths.managerParent.biosBlacklist, label: 'BIOS Blacklist' },
  { key: 'biosHistory', icon: History, href: routePaths.managerParent.biosHistory, label: 'BIOS History' },
  { key: 'ipAnalytics', icon: Activity, href: routePaths.managerParent.ipAnalytics, label: 'IP Analytics' },
  { key: 'usernameManagement', icon: KeyRound, href: routePaths.managerParent.usernameManagement, label: 'Username Management' },
  { key: 'financialReports', icon: BarChart3, href: routePaths.managerParent.financialReports, label: 'Financial Reports' },
  { key: 'reports', icon: ScrollText, href: routePaths.managerParent.reports, label: 'Reports' },
  { key: 'activity', icon: ScrollText, href: routePaths.managerParent.activity, label: 'Activity' },
  { key: 'customers', icon: Users, href: routePaths.managerParent.customers, label: 'Customers' },
  { key: 'settings', icon: Settings, href: routePaths.managerParent.settings, label: 'Settings' },
  { key: 'profile', icon: User, href: routePaths.managerParent.profile, label: 'Profile' },
]

export function Sidebar() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { lang, isRtl } = useLanguage()
  const collapsed = useSidebarStore((state) => state.collapsed)
  const setCollapsed = useSidebarStore((state) => state.setCollapsed)

  const items = user?.role === 'super_admin' ? superAdminItems : user?.role === 'manager_parent' ? managerParentItems : []
  const navContent = (
    <nav className="space-y-2">
      {items.map((item) => {
        const Icon = item.icon
        const label = item.translationKey ? t(item.translationKey) : item.label ?? item.key

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
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed ? 'lg:hidden' : 'inline')}>{label}</span>
          </NavLink>
        )
      })}
    </nav>
  )

  return (
    <>
      <button
        type="button"
        aria-label="Close sidebar overlay"
        className={cn('fixed inset-0 z-30 bg-slate-950/40 transition lg:hidden', collapsed ? 'pointer-events-none opacity-0' : 'opacity-100')}
        onClick={() => setCollapsed(true)}
      />
      <div
        data-testid="desktop-sidebar-shell"
        className={cn(
          'hidden lg:block lg:shrink-0',
          collapsed ? 'lg:w-24' : 'lg:w-72',
          isRtl ? 'lg:order-last' : 'lg:order-first',
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
          collapsed ? (isRtl ? 'translate-x-full' : '-translate-x-full') : 'translate-x-0',
          isRtl ? 'right-0 border-l lg:order-last' : 'left-0 border-r',
        )}
      >
        {navContent}
      </aside>
    </>
  )
}
