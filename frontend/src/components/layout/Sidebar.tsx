import type { LucideIcon } from 'lucide-react'
import { Activity, BarChart3, Building2, History, KeyRound, LayoutDashboard, Package, ScrollText, Settings, ShieldBan, User, UserCog, UserRound, Users, Wallet } from 'lucide-react'
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
  labelAr?: string
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
  { key: 'dashboard', icon: LayoutDashboard, href: routePaths.managerParent.dashboard, translationKey: 'managerParent.nav.dashboard' },
  { key: 'teamManagement', icon: Users, href: routePaths.managerParent.teamManagement, translationKey: 'managerParent.nav.teamManagement' },
  { key: 'resellerPricing', icon: Wallet, href: routePaths.managerParent.resellerPricing, translationKey: 'managerParent.nav.resellerPricing' },
  { key: 'softwareManagement', icon: Package, href: routePaths.managerParent.softwareManagement, translationKey: 'managerParent.nav.softwareManagement' },
  { key: 'biosBlacklist', icon: ShieldBan, href: routePaths.managerParent.biosBlacklist, translationKey: 'managerParent.nav.biosBlacklist' },
  { key: 'biosHistory', icon: History, href: routePaths.managerParent.biosHistory, translationKey: 'managerParent.nav.biosHistory' },
  { key: 'ipAnalytics', icon: Activity, href: routePaths.managerParent.ipAnalytics, translationKey: 'managerParent.nav.ipAnalytics' },
  { key: 'usernameManagement', icon: KeyRound, href: routePaths.managerParent.usernameManagement, translationKey: 'managerParent.nav.usernameManagement' },
  { key: 'financialReports', icon: BarChart3, href: routePaths.managerParent.financialReports, translationKey: 'managerParent.nav.financialReports' },
  { key: 'reports', icon: ScrollText, href: routePaths.managerParent.reports, translationKey: 'managerParent.nav.reports' },
  { key: 'activity', icon: ScrollText, href: routePaths.managerParent.activity, translationKey: 'managerParent.nav.activity' },
  { key: 'customers', icon: Users, href: routePaths.managerParent.customers, translationKey: 'managerParent.nav.customers' },
  { key: 'settings', icon: Settings, href: routePaths.managerParent.settings, translationKey: 'managerParent.nav.settings' },
  { key: 'profile', icon: User, href: routePaths.managerParent.profile, translationKey: 'managerParent.nav.profile' },
]

const managerItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: routePaths.manager.dashboard, translationKey: 'manager.nav.dashboard' },
  { key: 'team', icon: Users, href: routePaths.manager.team, translationKey: 'manager.nav.team' },
  { key: 'usernameManagement', icon: KeyRound, href: routePaths.manager.usernameManagement, translationKey: 'manager.nav.usernameManagement' },
  { key: 'customers', icon: UserRound, href: routePaths.manager.customers, translationKey: 'manager.nav.customers' },
  { key: 'software', icon: Package, href: routePaths.manager.software, translationKey: 'manager.nav.software' },
  { key: 'reports', icon: BarChart3, href: routePaths.manager.reports, translationKey: 'manager.nav.reports' },
  { key: 'activity', icon: ScrollText, href: routePaths.manager.activity, translationKey: 'manager.nav.activity' },
  { key: 'profile', icon: User, href: routePaths.manager.profile, translationKey: 'manager.nav.profile' },
]

const resellerItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, href: routePaths.reseller.dashboard, label: 'Dashboard', labelAr: 'لوحة التحكم' },
  { key: 'customers', icon: Users, href: routePaths.reseller.customers, label: 'Customers', labelAr: 'العملاء' },
  { key: 'software', icon: Package, href: routePaths.reseller.software, label: 'Software', labelAr: 'البرامج' },
  { key: 'licenses', icon: KeyRound, href: routePaths.reseller.licenses, label: 'Licenses', labelAr: 'التراخيص' },
  { key: 'reports', icon: BarChart3, href: routePaths.reseller.reports, label: 'Reports', labelAr: 'التقارير' },
  { key: 'activity', icon: Activity, href: routePaths.reseller.activity, label: 'Activity', labelAr: 'النشاط' },
  { key: 'profile', icon: User, href: routePaths.reseller.profile, label: 'Profile', labelAr: 'الملف الشخصي' },
]

export function Sidebar() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { lang, isRtl } = useLanguage()
  const collapsed = useSidebarStore((state) => state.collapsed)
  const setCollapsed = useSidebarStore((state) => state.setCollapsed)

  const items =
    user?.role === 'super_admin'
      ? superAdminItems
      : user?.role === 'manager_parent'
        ? managerParentItems
        : user?.role === 'manager'
          ? managerItems
          : user?.role === 'reseller'
            ? resellerItems
            : []
  const navContent = (
    <nav className="space-y-2">
      {items.map((item) => {
        const Icon = item.icon
        const label = item.translationKey ? t(item.translationKey) : lang === 'ar' && item.labelAr ? item.labelAr : item.label ?? item.key

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
