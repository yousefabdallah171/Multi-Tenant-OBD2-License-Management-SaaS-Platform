import type { SupportedLanguage } from '@/hooks/useLanguage'
import type { UserRole } from '@/types/user.types'

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'
export const AUTH_STORAGE_KEY = 'license-auth'
export const AUTH_SESSION_STORAGE_KEY = 'license-auth-session'
export const ACCOUNT_DISABLED_STORAGE_KEY = 'license-account-disabled'
export const THEME_STORAGE_KEY = 'license-theme'
export const LANGUAGE_STORAGE_KEY = 'license-language'

export const USER_ROLES: UserRole[] = ['super_admin', 'manager_parent', 'manager', 'reseller', 'customer']

type ActiveDashboardRole = Exclude<UserRole, 'customer'>

export const ROLE_DASHBOARD_SEGMENTS: Record<ActiveDashboardRole, string> = {
  super_admin: 'super-admin/dashboard',
  manager_parent: 'dashboard',
  manager: 'manager/dashboard',
  reseller: 'reseller/dashboard',
}
