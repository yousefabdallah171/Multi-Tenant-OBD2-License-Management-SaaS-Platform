import { securityService } from '@/services/security.service'
import { api } from '@/services/api'

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}))

describe('securityService', () => {
  const getMock = api.get as jest.Mock
  const postMock = api.post as jest.Mock

  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
  })

  test('getLocks calls GET /super-admin/security/locks', async () => {
    getMock.mockResolvedValueOnce({ data: { data: { locked_accounts: [], blocked_ips: [] } } })
    await securityService.getLocks()
    expect(getMock).toHaveBeenCalledWith('/super-admin/security/locks')
  })

  test('unblockEmail posts payload', async () => {
    postMock.mockResolvedValueOnce({ data: { message: 'ok' } })
    await securityService.unblockEmail('locked@obd2sw.com')
    expect(postMock).toHaveBeenCalledWith('/super-admin/security/unblock-email', { email: 'locked@obd2sw.com' })
  })

  test('unblockIp posts payload', async () => {
    postMock.mockResolvedValueOnce({ data: { message: 'ok' } })
    await securityService.unblockIp('197.55.1.2')
    expect(postMock).toHaveBeenCalledWith('/super-admin/security/unblock-ip', { ip: '197.55.1.2' })
  })

  test('getAuditLog calls GET /super-admin/security/audit-log', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [], meta: {} } })
    await securityService.getAuditLog({ per_page: 50 })
    expect(getMock).toHaveBeenCalledWith('/super-admin/security/audit-log', { params: { per_page: 50 } })
  })
})
