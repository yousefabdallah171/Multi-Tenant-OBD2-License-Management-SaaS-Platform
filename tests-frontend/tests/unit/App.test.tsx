import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import App from '@/App'
import { LoginPage } from '@/pages/auth/Login'
import { ProtectedRoute, RoleGuard } from '@/router/guards'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/user.types'

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
  },
  Toaster: () => null,
}))

const loginMock = jest.fn()

jest.mock('@/services/auth.service', () => ({
  authService: {
    login: (...args: unknown[]) => loginMock(...args),
    logout: jest.fn(),
    getMe: jest.fn(),
    forgotPassword: jest.fn(),
  },
}))

beforeEach(() => {
  loginMock.mockReset()
})

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

function fakeUser(role: User['role']): User {
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

test('redirects root to /ar/login', async () => {
  window.history.pushState({}, '', '/')

  renderWithQuery(<App />)

  await waitFor(() => expect(window.location.pathname).toBe('/ar/login'))
  expect(await screen.findByText(/تسجيل الدخول/i)).toBeInTheDocument()
})

test('login form renders email and password fields', async () => {
  loginMock.mockResolvedValueOnce({
    token: 'token',
    user: fakeUser('super_admin'),
  })

  renderWithQuery(
    <MemoryRouter initialEntries={['/ar/login']}>
      <Routes>
        <Route path="/:lang/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByLabelText(/البريد الإلكتروني/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/كلمة المرور/i)).toBeInTheDocument()
})

test('login form shows error on invalid credentials', async () => {
  loginMock.mockRejectedValueOnce({
    isAxiosError: true,
    response: {
      status: 401,
    },
  })

  const user = userEvent.setup()

  renderWithQuery(
    <MemoryRouter initialEntries={['/ar/login']}>
      <Routes>
        <Route path="/:lang/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  )

  await user.clear(screen.getByLabelText(/البريد الإلكتروني/i))
  await user.type(screen.getByLabelText(/البريد الإلكتروني/i), 'admin@example.com')
  await user.clear(screen.getByLabelText(/كلمة المرور/i))
  await user.type(screen.getByLabelText(/كلمة المرور/i), 'wrong-password')
  await user.click(screen.getByRole('button', { name: /دخول/i }))

  expect(await screen.findByText(/بيانات الدخول غير صحيحة/i)).toBeInTheDocument()
})

test('auth store persists token in localStorage', () => {
  useAuthStore.getState().setSession('persisted-token', fakeUser('manager'))

  expect(JSON.parse(window.localStorage.getItem('license-auth') ?? '{}')).toMatchObject({
    token: 'persisted-token',
    user: { role: 'manager' },
  })
})

test('protected route redirects unauthenticated users', async () => {
  renderWithQuery(
    <MemoryRouter initialEntries={['/ar/dashboard']}>
      <Routes>
        <Route path="/:lang" element={<ProtectedRoute />}>
          <Route path="dashboard" element={<div>dashboard</div>} />
        </Route>
        <Route path="/:lang/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText(/login page/i)).toBeInTheDocument()
})

test('role guard redirects wrong role users to their own dashboard', async () => {
  useAuthStore.getState().setSession('token', fakeUser('customer'))

  renderWithQuery(
    <MemoryRouter initialEntries={['/ar/manager']}>
      <Routes>
        <Route path="/:lang" element={<ProtectedRoute />}>
          <Route element={<RoleGuard allowedRoles={['manager']} />}>
            <Route path="manager" element={<div>manager page</div>} />
          </Route>
          <Route path="customer" element={<div>customer page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText(/customer page/i)).toBeInTheDocument()
})
