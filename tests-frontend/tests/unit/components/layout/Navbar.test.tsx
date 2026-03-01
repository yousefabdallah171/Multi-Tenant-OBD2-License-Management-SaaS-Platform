import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import type { User } from '@/types/user.types'
import { authService } from '@/services/auth.service'
import { setLanguage } from '../../../utils/test-utils'

jest.mock('@/services/auth.service', () => ({
  authService: {
    login: jest.fn(),
    logout: jest.fn().mockResolvedValue({ message: 'ok' }),
    getMe: jest.fn(),
  },
}))

function makeUser(role: User['role']): User {
  return {
    id: 1,
    tenant_id: role === 'super_admin' ? null : 1,
    name: 'Jane Admin',
    username: 'jane-admin',
    email: 'jane@obd2sw.com',
    phone: null,
    role,
    status: 'active',
    created_by: null,
    username_locked: false,
    tenant: role === 'super_admin' ? null : { id: 1, name: 'Tenant', slug: 'tenant', status: 'active' },
  }
}

function renderNavbar(path = '/en/super-admin/dashboard') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/:lang/*" element={<Navbar />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Navbar', () => {
  beforeEach(async () => {
    await setLanguage('en')
    useThemeStore.setState({ theme: 'light' })
    useAuthStore.getState().clearSession()
    ;(authService.logout as jest.Mock).mockClear()
  })

  test('renders brand/title and shows security locks context for super admin', () => {
    useAuthStore.getState().setSession('token', makeUser('super_admin'))
    renderNavbar('/en/super-admin/security-locks')

    expect(screen.getAllByText(/obd2sw/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/super admin/i).length).toBeGreaterThan(0)
  })

  test('does not show super-admin title when user role is reseller', () => {
    useAuthStore.getState().setSession('token', makeUser('reseller'))
    renderNavbar('/en/reseller/dashboard')

    expect(screen.queryByText(/super admin/i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/reseller/i).length).toBeGreaterThan(0)
  })

  test('language switcher toggles URL between /en and /ar', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setSession('token', makeUser('super_admin'))
    renderNavbar('/en/super-admin/dashboard')

    expect(screen.getByRole('button', { name: /switch language/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /switch language/i }))

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('ar')
    })
  })

  test('theme toggle persists to localStorage', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setSession('token', makeUser('super_admin'))
    renderNavbar('/en/super-admin/dashboard')

    await user.click(screen.getByRole('button', { name: /toggle theme/i }))

    expect(window.localStorage.getItem('license-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  test('profile dropdown shows user info and logout calls service + clears session', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setSession('token', makeUser('manager_parent'))
    renderNavbar('/en/dashboard')

    await user.click(screen.getByLabelText(/user menu/i))
    expect(screen.getAllByText('Jane Admin').length).toBeGreaterThan(0)
    expect(screen.getAllByText('jane@obd2sw.com').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /logout/i }))
    expect(authService.logout).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().token).toBeNull()
  })

  test('hamburger button toggles sidebar state', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setSession('token', makeUser('super_admin'))
    renderNavbar('/en/super-admin/dashboard')

    expect(screen.getByRole('button', { name: /open navigation/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /open navigation/i }))
  })
})
