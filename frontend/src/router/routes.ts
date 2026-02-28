import { DEFAULT_LANGUAGE, ROLE_DASHBOARD_SEGMENTS } from '@/lib/constants'
import type { SupportedLanguage } from '@/hooks/useLanguage'
import type { UserRole } from '@/types/user.types'

export const routePaths = {
  root: '/',
  login: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/login`,
  forgotPassword: (lang: SupportedLanguage = DEFAULT_LANGUAGE) => `/${lang}/forgot-password`,
}

export function getDashboardPath(role: UserRole, lang: SupportedLanguage = DEFAULT_LANGUAGE) {
  return `/${lang}/${ROLE_DASHBOARD_SEGMENTS[role]}`
}
