import { DEFAULT_LANGUAGE, ROLE_DASHBOARD_SEGMENTS } from '@/lib/constants'
import type { SupportedLanguage } from '@/hooks/useLanguage'
import type { UserRole } from '@/types/user.types'

export const routePaths = {
  root: '/',
  login: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/login`,
  forgotPassword: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/forgot-password`,
  errors: {
    notFound: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/not-found`,
    accessDenied: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/access-denied`,
    serverError: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/server-error`,
  },
  managerParent: {
    root: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/dashboard`,
    dashboard: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/dashboard`,
    teamManagement: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/team-management`,
    resellerPricing: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/reseller-pricing`,
    softwareManagement: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/software-management`,
    biosBlacklist: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/bios-blacklist`,
    biosHistory: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/bios-history`,
    ipAnalytics: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/ip-analytics`,
    usernameManagement: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/username-management`,
    financialReports: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/financial-reports`,
    reports: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/reports`,
    activity: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/activity`,
    customers: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/customers`,
    settings: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/settings`,
    profile: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/profile`,
  },
  manager: {
    root: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/manager`,
    dashboard: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/manager/dashboard`,
    team: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/manager/team`,
    usernameManagement: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/manager/username-management`,
    customers: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/manager/customers`,
    software: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/manager/software`,
    reports: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/manager/reports`,
    activity: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/manager/activity`,
    profile: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/manager/profile`,
  },
  reseller: {
    root: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/reseller`,
    dashboard: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/reseller/dashboard`,
    customers: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/reseller/customers`,
    software: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/reseller/software`,
    licenses: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/reseller/licenses`,
    reports: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/reseller/reports`,
    activity: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/reseller/activity`,
    profile: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/reseller/profile`,
  },
  customer: {
    root: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/customer`,
    dashboard: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/customer/dashboard`,
    software: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/customer/software`,
    download: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/customer/download`,
  },
  superAdmin: {
    root: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/super-admin`,
    dashboard: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/super-admin/dashboard`,
    tenants: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/super-admin/tenants`,
    users: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/super-admin/users`,
    adminManagement: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/super-admin/admin-management`,
    biosBlacklist: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/super-admin/bios-blacklist`,
    biosHistory: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/super-admin/bios-history`,
    usernameManagement: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/super-admin/username-management`,
    financialReports: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/super-admin/financial-reports`,
    reports: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/super-admin/reports`,
    logs: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/super-admin/logs`,
    apiStatus: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/super-admin/api-status`,
    settings: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/super-admin/settings`,
    profile: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/super-admin/profile`,
  },
}

export function getDashboardPath(role: UserRole, lang: SupportedLanguage = DEFAULT_LANGUAGE) {
  return `/${lang}/${ROLE_DASHBOARD_SEGMENTS[role]}`
}
