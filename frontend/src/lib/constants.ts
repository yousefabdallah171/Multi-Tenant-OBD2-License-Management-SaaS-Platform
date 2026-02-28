import type { SupportedLanguage } from '@/hooks/useLanguage'
import type { UserRole } from '@/types/user.types'

export const DEFAULT_LANGUAGE: SupportedLanguage = 'ar'
export const AUTH_STORAGE_KEY = 'license-auth'
export const THEME_STORAGE_KEY = 'license-theme'
export const LANGUAGE_STORAGE_KEY = 'license-language'

export const USER_ROLES: UserRole[] = ['super_admin', 'manager_parent', 'manager', 'reseller', 'customer']

export const ROLE_DASHBOARD_SEGMENTS: Record<UserRole, string> = {
  super_admin: 'super-admin/dashboard',
  manager_parent: 'dashboard',
  manager: 'manager/dashboard',
  reseller: 'reseller/dashboard',
  customer: 'customer/dashboard',
}
