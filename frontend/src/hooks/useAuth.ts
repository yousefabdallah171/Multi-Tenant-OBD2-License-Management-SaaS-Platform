import { useAuthStore } from '@/stores/authStore'
import { authService } from '@/services/auth.service'
import { getDashboardPath } from '@/router/routes'
import type { User } from '@/types/user.types'
import type { SupportedLanguage } from '@/hooks/useLanguage'
import type { UserRole } from '@/types/user.types'

export function useAuth() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const setSession = useAuthStore((state) => state.setSession)
  const setUser = useAuthStore((state) => state.setUser)
  const clearSession = useAuthStore((state) => state.clearSession)

  const isAuthenticated = Boolean(token && user)

  const login = async (email: string, password: string) => {
    const result = await authService.login({ email, password })
    setSession(result.token, result.user)
    return result
  }

  const logout = async () => {
    try {
      await authService.logout()
    } finally {
      clearSession()
    }
  }

  const syncCurrentUser = async () => {
    const result = await authService.getMe()
    setUser(result.user)
    return result.user
  }

  const getDefaultRoute = (lang: SupportedLanguage, role?: UserRole) => {
    const targetRole = role ?? user?.role
    return targetRole ? getDashboardPath(targetRole, lang) : `/${lang}/login`
  }

  const setAuthenticatedUser = (nextUser: User | null) => {
    setUser(nextUser)
  }

  return {
    token,
    user,
    isAuthenticated,
    login,
    logout,
    syncCurrentUser,
    getDefaultRoute,
    setAuthenticatedUser,
    clearSession,
  }
}
