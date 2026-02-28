import axios from 'axios'
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from '@/lib/constants'
import { useAuthStore } from '@/stores/authStore'
import type { DashboardStats, HealthResponse } from '@/types/api.types'

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

api.interceptors.request.use((config) => {
  config.baseURL ??= resolveApiBaseUrl()

  const token = useAuthStore.getState().token

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().clearSession()

      if (typeof window !== 'undefined') {
        const lang = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || document.documentElement.lang || DEFAULT_LANGUAGE
        window.location.assign(`/${lang}/login`)
      }
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
