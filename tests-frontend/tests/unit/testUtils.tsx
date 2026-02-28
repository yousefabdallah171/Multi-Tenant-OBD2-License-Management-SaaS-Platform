import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/user.types'

export function fakeSuperAdmin(): User {
  return {
    id: 1,
    tenant_id: null,
    name: 'Super Admin',
    username: 'super-admin',
    email: 'admin@example.com',
    phone: '+201000000000',
    role: 'super_admin',
    status: 'active',
    created_by: null,
    username_locked: false,
    tenant: null,
  }
}

export async function setLanguage(lang: 'ar' | 'en') {
  await i18n.changeLanguage(lang)
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}

export function setAuthenticatedSuperAdmin() {
  useAuthStore.getState().setSession('test-token', fakeSuperAdmin())
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export async function renderWithProviders(
  ui: ReactElement,
  {
    route = '/en/super-admin/dashboard',
    withAuth = true,
  }: {
    route?: string
    withAuth?: boolean
  } = {},
) {
  const lang = route.startsWith('/ar/') ? 'ar' : 'en'
  await setLanguage(lang)

  if (withAuth) {
    setAuthenticatedSuperAdmin()
  }

  const queryClient = createTestQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/:lang/*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
