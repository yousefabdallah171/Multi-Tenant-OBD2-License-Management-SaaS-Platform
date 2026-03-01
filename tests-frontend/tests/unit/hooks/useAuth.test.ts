import { act, renderHook } from '@testing-library/react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { authService } from '@/services/auth.service'

jest.mock('@/services/auth.service', () => ({
  authService: {
    login: jest.fn(),
    logout: jest.fn(),
    getMe: jest.fn(),
  },
}))

describe('useAuth', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
    ;(authService.login as jest.Mock).mockReset()
    ;(authService.logout as jest.Mock).mockReset()
  })

  test('returns user when authenticated session exists', () => {
    useAuthStore.getState().setSession('token', {
      id: 1,
      tenant_id: 1,
      name: 'User',
      username: 'user',
      email: 'user@example.com',
      phone: null,
      role: 'manager',
      status: 'active',
      created_by: null,
      username_locked: false,
      tenant: { id: 1, name: 'Tenant', slug: 'tenant', status: 'active' },
    })

    const { result } = renderHook(() => useAuth())
    expect(result.current.user?.email).toBe('user@example.com')
    expect(result.current.isAuthenticated).toBe(true)
  })

  test('login stores token and user in localStorage', async () => {
    ;(authService.login as jest.Mock).mockResolvedValueOnce({
      token: 'new-token',
      user: {
        id: 2,
        tenant_id: 1,
        name: 'Admin',
        username: 'admin',
        email: 'admin@example.com',
        phone: null,
        role: 'super_admin',
        status: 'active',
        created_by: null,
        username_locked: false,
        tenant: null,
      },
    })

    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.login('admin@example.com', 'password')
    })

    expect(useAuthStore.getState().token).toBe('new-token')
    expect(JSON.parse(window.localStorage.getItem('license-auth') ?? '{}').token).toBe('new-token')
  })

  test('logout clears session', async () => {
    useAuthStore.getState().setSession('token', {
      id: 1,
      tenant_id: 1,
      name: 'User',
      username: 'user',
      email: 'user@example.com',
      phone: null,
      role: 'manager',
      status: 'active',
      created_by: null,
      username_locked: false,
      tenant: { id: 1, name: 'Tenant', slug: 'tenant', status: 'active' },
    })
    ;(authService.logout as jest.Mock).mockResolvedValueOnce({ message: 'ok' })

    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.logout()
    })

    expect(useAuthStore.getState().token).toBeNull()
    expect(window.localStorage.getItem('license-auth')).toBeNull()
  })
})
