import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/pages/auth/Login'
import { GuestRoute } from '@/router/guards'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/user.types'
import { authService } from '@/services/auth.service'
import { setLanguage } from '../../utils/test-utils'

jest.mock('@/services/auth.service', () => ({
  authService: {
    login: jest.fn(),
    logout: jest.fn(),
    getMe: jest.fn(),
  },
}))

function makeUser(role: User['role']): User {
  return {
    id: 1,
    tenant_id: role === 'super_admin' ? null : 1,
    name: 'Test User',
    username: 'test-user',
    email: 'test@obd2sw.com',
    phone: null,
    role,
    status: 'active',
    created_by: null,
    username_locked: false,
    tenant: role === 'super_admin' ? null : { id: 1, name: 'Tenant', slug: 'tenant', status: 'active' },
  }
}

function renderLogin(initialPath = '/en/login') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path='/:lang/login' element={<LoginPage />} />
          <Route path='/:lang/super-admin/dashboard' element={<div>super admin dashboard</div>} />
          <Route path='/:lang/dashboard' element={<div>manager parent dashboard</div>} />
          <Route path='/:lang/manager/dashboard' element={<div>manager dashboard</div>} />
          <Route path='/:lang/reseller/dashboard' element={<div>reseller dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  const loginMock = authService.login as jest.Mock

  beforeEach(async () => {
    await setLanguage('en')
    useAuthStore.getState().clearSession()
    loginMock.mockReset()
    jest.useRealTimers()
  })

  test('renders fields and sign in button; no forgot/register links', () => {
    renderLogin()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/register|create account/i)).not.toBeInTheDocument()
  })

  test('submitting empty form and invalid email show validation alert', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  test('shows loading state and disables submit while request is pending', async () => {
    const user = userEvent.setup()
    loginMock.mockImplementation(() => new Promise(() => {}))
    renderLogin()

    await user.type(screen.getByLabelText(/email/i), 'admin@obd2sw.com')
    await user.type(screen.getByLabelText(/password/i), 'password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
  })

  test('failed login shows 401 API message', async () => {
    const user = userEvent.setup()
    loginMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 401,
        data: { message: 'Invalid credentials.' },
      },
    })
    renderLogin()

    await user.type(screen.getByLabelText(/email/i), 'admin@obd2sw.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials.')
  })

  test('successful login stores token and redirects by role', async () => {
    const user = userEvent.setup()
    loginMock.mockResolvedValueOnce({
      token: 'token-1',
      user: makeUser('reseller'),
    })
    renderLogin()

    await user.type(screen.getByLabelText(/email/i), 'reseller@obd2sw.com')
    await user.type(screen.getByLabelText(/password/i), 'password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/reseller dashboard/i)).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem('license-auth') ?? '{}')).toMatchObject({
      token: 'token-1',
      user: { role: 'reseller' },
    })
  })

  test('already logged in user is redirected away from login route', async () => {
    useAuthStore.getState().setSession('t', makeUser('reseller'))

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/en/login']}>
          <Routes>
            <Route path='/:lang' element={<GuestRoute />}>
              <Route path='login' element={<div>login page</div>} />
            </Route>
            <Route path='/:lang/reseller/dashboard' element={<div>reseller dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText(/reseller dashboard/i)).toBeInTheDocument()
    expect(screen.queryByText(/login page/i)).not.toBeInTheDocument()
  })

  test('language switcher is visible and clickable', async () => {
    const user = userEvent.setup()
    renderLogin('/en/login')

    expect(screen.getByRole('button', { name: /^ar$/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^ar$/i }))
    expect(await screen.findByRole('button', { name: /^en$/i })).toBeInTheDocument()
  })

  test('429 account lock shows countdown banner and disables form', async () => {
    const user = userEvent.setup()
    loginMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 429,
        data: { locked: true, reason: 'account_locked', seconds_remaining: 60 },
      },
    })
    renderLogin()

    const email = screen.getByLabelText(/email/i)
    const password = screen.getByLabelText(/password/i)

    await user.type(email, 'locked@obd2sw.com')
    await user.type(password, 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/1:00/)).toBeInTheDocument()
    expect(email).toBeDisabled()
    expect(password).toBeDisabled()
  })

  test('429 lock with 300 seconds shows 5:00 countdown', async () => {
    const user = userEvent.setup()
    loginMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 429,
        data: { locked: true, reason: 'account_locked', seconds_remaining: 300 },
      },
    })
    renderLogin()

    await user.type(screen.getByLabelText(/email/i), 'locked@obd2sw.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/5:00/)).toBeInTheDocument()
  })

  test('429 with ip_blocked shows permanent block banner and support mail link', async () => {
    const user = userEvent.setup()
    loginMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 429,
        data: { locked: true, reason: 'ip_blocked', unlocks_at: null },
      },
    })
    renderLogin()

    await user.type(screen.getByLabelText(/email/i), 'blocked@obd2sw.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    const link = await screen.findByRole('link', { name: /support@obd2sw\.com/i })
    expect(link).toHaveAttribute('href', 'mailto:support@obd2sw.com')
    expect(screen.queryByText(/\d+:\d{2}/)).not.toBeInTheDocument()
  })

  test('after lockout countdown expires, banner hides and form is re-enabled', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    loginMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 429,
        data: { locked: true, reason: 'account_locked', seconds_remaining: 1 },
      },
    })
    renderLogin()

    const email = screen.getByLabelText(/email/i)
    await user.type(email, 'locked@obd2sw.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/0:01/)).toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => expect(screen.queryByText(/try again in/i)).not.toBeInTheDocument())
    expect(email).not.toBeDisabled()
    jest.useRealTimers()
  })

  test('error alert clears when user starts typing', async () => {
    const user = userEvent.setup()
    loginMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 401,
        data: { message: 'Invalid credentials.' },
      },
    })
    renderLogin()

    await user.type(screen.getByLabelText(/email/i), 'admin@obd2sw.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/email/i), 'a')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
