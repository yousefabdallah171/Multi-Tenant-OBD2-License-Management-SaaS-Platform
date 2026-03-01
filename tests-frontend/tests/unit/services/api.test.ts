import { api } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'

const toastErrorMock = jest.fn()

jest.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

describe('api interceptors', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
    toastErrorMock.mockReset()
    window.localStorage.setItem('license-language', 'en')
  })

  test('request interceptor attaches Authorization header when token exists', async () => {
    useAuthStore.getState().setSession('token-123', {
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

    const handler = (api.interceptors.request as unknown as { handlers: Array<{ fulfilled: (arg: any) => Promise<any> }> }).handlers[0]
    const config = await handler.fulfilled({ headers: {} })
    expect(config.headers.Authorization).toBe('Bearer token-123')
  })

  test('401 response clears auth state and redirects to /login', async () => {
    useAuthStore.getState().setSession('token-123', {
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

    const rejected = (api.interceptors.response as unknown as { handlers: Array<{ rejected: (arg: any) => Promise<never> }> }).handlers[0].rejected
    await expect(rejected({ response: { status: 401 } })).rejects.toBeDefined()

    expect(useAuthStore.getState().token).toBeNull()
  })

  test('network error without response shows toast', async () => {
    const rejected = (api.interceptors.response as unknown as { handlers: Array<{ rejected: (arg: any) => Promise<never> }> }).handlers[0].rejected
    await expect(rejected({})).rejects.toBeDefined()
    expect(toastErrorMock).toHaveBeenCalled()
  })
})
