import { authService } from '@/services/auth.service'
import { api } from '@/services/api'

jest.mock('@/services/api', () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
  },
}))

describe('authService', () => {
  const postMock = api.post as jest.Mock
  const getMock = api.get as jest.Mock

  beforeEach(() => {
    postMock.mockReset()
    getMock.mockReset()
  })

  test('login posts to /auth/login with email + password', async () => {
    postMock.mockResolvedValueOnce({ data: { token: 't', user: { id: 1 } } })

    await authService.login({ email: 'admin@obd2sw.com', password: 'password' })

    expect(postMock).toHaveBeenCalledWith('/auth/login', {
      email: 'admin@obd2sw.com',
      password: 'password',
    })
  })

  test('logout posts to /auth/logout', async () => {
    postMock.mockResolvedValueOnce({ data: { message: 'ok' } })
    await authService.logout()
    expect(postMock).toHaveBeenCalledWith('/auth/logout')
  })

  test('getMe calls /auth/me', async () => {
    getMock.mockResolvedValueOnce({ data: { user: { id: 1 } } })
    await authService.getMe()
    expect(getMock).toHaveBeenCalledWith('/auth/me')
  })

  test('forgotPassword method does not exist', () => {
    expect((authService as unknown as { forgotPassword?: unknown }).forgotPassword).toBeUndefined()
  })
})
