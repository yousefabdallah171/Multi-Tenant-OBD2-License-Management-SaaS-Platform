import { useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { authService } from '@/services/auth.service'
import { getDashboardPath } from '@/router/routes'
import type { User } from '@/types/user.types'
import type { SupportedLanguage } from '@/hooks/useLanguage'
import type { UserRole } from '@/types/user.types'

function hasUserChanged(currentUser: User | null, nextUser: User | null) {
  return JSON.stringify(currentUser) !== JSON.stringify(nextUser)
}

export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const setSession = useAuthStore((state) => state.setSession)
  const setUser = useAuthStore((state) => state.setUser)
  const clearSession = useAuthStore((state) => state.clearSession)

  const isAuthenticated = Boolean(user)

  const login = useCallback(async (email: string, password: string, remember = true) => {
    const result = await authService.login({ email, password })
    setSession(result.user, result.token, remember)
    return result
  }, [setSession])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      clearSession()
    }
  }, [clearSession])

  const syncCurrentUser = useCallback(async () => {
    const startingUser = useAuthStore.getState().user
    const result = await authService.getMe()

    const currentUser = useAuthStore.getState().user
    if (!currentUser || currentUser.id !== startingUser?.id) {
      return currentUser
    }

    if (hasUserChanged(currentUser, result.user)) {
      setUser(result.user)
    }

    return result.user
  }, [setUser])

  const getDefaultRoute = useCallback((lang: SupportedLanguage, role?: UserRole) => {
    const targetRole = role ?? user?.role
    return targetRole ? getDashboardPath(targetRole, lang) : `/${lang}/login`
  }, [user?.role])

  const setAuthenticatedUser = useCallback((nextUser: User | null) => {
    setUser(nextUser)
  }, [setUser])

  return {
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
