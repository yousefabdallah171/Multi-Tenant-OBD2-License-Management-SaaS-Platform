import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import type { User } from '@/types/user.types'

export function fakeUser(role: User['role'] = 'super_admin'): User {
  return {
    id: 1,
    tenant_id: role === 'super_admin' ? null : 10,
    name: 'Test User',
    username: 'test-user',
    email: 'test@example.com',
    phone: null,
    role,
    status: 'active',
    created_by: null,
    username_locked: false,
    tenant: role === 'super_admin' ? null : { id: 10, name: 'Tenant', slug: 'tenant', status: 'active' },
  }
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

export async function setLanguage(lang: 'ar' | 'en') {
  await i18n.changeLanguage(lang)
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}

export async function renderWithProviders(
  ui: ReactElement,
  options: {
    route?: string
    authRole?: User['role'] | null
  } = {},
) {
  const route = options.route ?? '/en/login'
  const lang = route.startsWith('/ar/') ? 'ar' : 'en'
  await setLanguage(lang)

  useThemeStore.setState({ theme: 'light' })
  if (options.authRole) {
    useAuthStore.getState().setSession('test-token', fakeUser(options.authRole))
  } else {
    useAuthStore.getState().clearSession()
  }

  const client = createQueryClient()

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path='/:lang/*' element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

export async function renderRTL(ui: ReactElement, route = '/ar/login') {
  return renderWithProviders(ui, { route })
}
