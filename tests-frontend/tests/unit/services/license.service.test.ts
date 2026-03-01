import { licenseService } from '@/services/license.service'
import { api } from '@/services/api'

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}))

describe('licenseService', () => {
  const getMock = api.get as jest.Mock
  const postMock = api.post as jest.Mock

  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
  })

  test('activate posts float duration_days', async () => {
    postMock.mockResolvedValueOnce({ data: { message: 'ok', data: {} } })
    await licenseService.activate({
      customer_name: 'Customer',
      customer_email: 'customer@obd2sw.com',
      program_id: 1,
      bios_id: 'BIOS-001',
      duration_days: 0.021,
      price: 1.2,
    })

    expect(postMock).toHaveBeenCalledWith('/licenses/activate', expect.objectContaining({ duration_days: 0.021 }))
  })

  test('renew posts /licenses/{id}/renew', async () => {
    postMock.mockResolvedValueOnce({ data: { message: 'ok', data: {} } })
    await licenseService.renew(10, { duration_days: 7, price: 20 })
    expect(postMock).toHaveBeenCalledWith('/licenses/10/renew', { duration_days: 7, price: 20 })
  })

  test('deactivate posts /licenses/{id}/deactivate', async () => {
    postMock.mockResolvedValueOnce({ data: { message: 'ok', data: {} } })
    await licenseService.deactivate(10)
    expect(postMock).toHaveBeenCalledWith('/licenses/10/deactivate')
  })

  test('getAll calls /reseller/licenses with params', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [], meta: {} } })
    await licenseService.getAll({ status: 'active', search: 'BIOS-001', page: 1, per_page: 10 })
    expect(getMock).toHaveBeenCalledWith('/reseller/licenses', { params: { status: 'active', search: 'BIOS-001', page: 1, per_page: 10 } })
  })

  test('getExpiring sends days param', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [] } })
    await licenseService.getExpiring(7)
    expect(getMock).toHaveBeenCalledWith('/reseller/licenses/expiring', { params: { days: 7 } })
  })
})
