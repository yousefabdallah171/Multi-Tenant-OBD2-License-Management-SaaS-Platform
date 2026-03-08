import axios from 'axios'
import { toast } from 'sonner'
import type { SupportedLanguage } from '@/hooks/useLanguage'
import i18n from '@/i18n'
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from '@/lib/constants'
import { getDashboardPath, routePaths } from '@/router/routes'
import { useAuthStore } from '@/stores/authStore'
import type { DashboardStats, HealthResponse } from '@/types/api.types'
import type { User } from '@/types/user.types'

function resolveApiBaseUrl() {
  const configuredBaseUrl = (globalThis as { __VITE_API_URL__?: string }).__VITE_API_URL__

  if (configuredBaseUrl) {
    return configuredBaseUrl
  }

  if (typeof window !== 'undefined') {
    return new URL('/api', window.location.origin).toString().replace(/\/$/, '')
  }

  return 'http://127.0.0.1:8000/api'
}

export const api = axios.create({
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

function resolveCurrentLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE
  }

  const pathname = window.location.pathname

  if (pathname === '/en' || pathname.startsWith('/en/')) {
    return 'en'
  }

  if (pathname === '/ar' || pathname.startsWith('/ar/')) {
    return 'ar'
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)

  if (storedLanguage === 'ar' || storedLanguage === 'en') {
    return storedLanguage
  }

  return document.documentElement.lang === 'ar' ? 'ar' : DEFAULT_LANGUAGE
}

async function fetchCurrentUserSnapshot(): Promise<User | null> {
  const token = useAuthStore.getState().token
  if (!token) {
    return null
  }

  const { data } = await axios.get<{ user: User | null }>('/auth/me', {
    baseURL: resolveApiBaseUrl(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Accept-Language': resolveCurrentLanguage(),
    },
  })

  return data.user ?? null
}

api.interceptors.request.use((config) => {
  config.baseURL ??= resolveApiBaseUrl()

  const token = useAuthStore.getState().token
  const lang = resolveCurrentLanguage()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  config.headers['Accept-Language'] = lang

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    const requestUrl = String(error?.config?.url ?? '')
    const isAuthLoginRequest = /\/auth\/login(?:\?.*)?$/.test(requestUrl)

    if (status === 401) {
      useAuthStore.getState().clearSession()

      if (typeof window !== 'undefined' && !isAuthLoginRequest && !window.location.pathname.includes('/login')) {
        window.location.assign(routePaths.login(resolveCurrentLanguage()))
      }
    }

    if (status === 403 && typeof window !== 'undefined' && !window.location.pathname.includes('/access-denied')) {
      const isMeRequest = /\/auth\/me(?:\?.*)?$/.test(requestUrl)

      if (!isMeRequest && useAuthStore.getState().token) {
        try {
          const previousUser = useAuthStore.getState().user
          const currentUser = await fetchCurrentUserSnapshot()

          if (currentUser) {
            useAuthStore.getState().setUser(currentUser)

            if (!previousUser || previousUser.role !== currentUser.role || previousUser.status !== currentUser.status) {
              if (currentUser.status !== 'active') {
                useAuthStore.getState().clearSession()
                window.location.assign(routePaths.login(resolveCurrentLanguage()))
                return Promise.reject(error)
              }

              window.location.assign(getDashboardPath(currentUser.role, resolveCurrentLanguage()))
              return Promise.reject(error)
            }
          }
        } catch {
          // Fall through to the access denied route when the session cannot be refreshed.
        }
      }

      window.location.assign(routePaths.errors.accessDenied(resolveCurrentLanguage()))
    }

    if (status >= 500 && typeof window !== 'undefined' && !isAuthLoginRequest) {
      toast.error(i18n.t('common.errorPages.serverError.description'))
    }

    if (!error?.response && typeof window !== 'undefined') {
      toast.error(i18n.t('common.connectionLost'))
    }

    return Promise.reject(error)
  },
)

export async function healthCheck(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health')
  return data
}

export async function getDashboardStats(): Promise<{ stats: DashboardStats }> {
  const { data } = await api.get<{ stats: DashboardStats }>('/dashboard/stats')
  return data
}
