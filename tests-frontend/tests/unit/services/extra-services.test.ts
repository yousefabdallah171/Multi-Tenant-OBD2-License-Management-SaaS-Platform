import { apiStatusService } from '@/services/api-status.service'
import { pricingService } from '@/services/pricing.service'
import { programService } from '@/services/program.service'
import { settingsService } from '@/services/settings.service'
import { teamService } from '@/services/team.service'
import { api } from '@/services/api'

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}))

describe('extra service contracts', () => {
  const getMock = api.get as jest.Mock
  const postMock = api.post as jest.Mock
  const putMock = api.put as jest.Mock
  const deleteMock = api.delete as jest.Mock

  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
    putMock.mockReset()
    deleteMock.mockReset()
  })

  describe('apiStatusService', () => {
    test('getStatus calls /super-admin/api-status', async () => {
      getMock.mockResolvedValueOnce({ data: { data: { status: 'online' } } })
      await apiStatusService.getStatus()
      expect(getMock).toHaveBeenCalledWith('/super-admin/api-status')
    })

    test('getHistory calls /super-admin/api-status/history', async () => {
      getMock.mockResolvedValueOnce({ data: { data: [] } })
      await apiStatusService.getHistory()
      expect(getMock).toHaveBeenCalledWith('/super-admin/api-status/history')
    })

    test('ping posts to /super-admin/api-status/ping', async () => {
      postMock.mockResolvedValueOnce({ data: { data: { status: 'online' } } })
      await apiStatusService.ping()
      expect(postMock).toHaveBeenCalledWith('/super-admin/api-status/ping')
    })
  })

  describe('pricingService', () => {
    test('getAll without reseller calls /pricing without params', async () => {
      getMock.mockResolvedValueOnce({ data: { data: {} } })
      await pricingService.getAll()
      expect(getMock).toHaveBeenCalledWith('/pricing', { params: undefined })
    })

    test('getAll with reseller sends reseller_id param', async () => {
      getMock.mockResolvedValueOnce({ data: { data: {} } })
      await pricingService.getAll(12)
      expect(getMock).toHaveBeenCalledWith('/pricing', { params: { reseller_id: 12 } })
    })

    test('update calls /pricing/{programId}', async () => {
      putMock.mockResolvedValueOnce({ data: { data: {} } })
      await pricingService.update(8, { reseller_id: 12, reseller_price: 120, commission_rate: 10 })
      expect(putMock).toHaveBeenCalledWith('/pricing/8', { reseller_id: 12, reseller_price: 120, commission_rate: 10 })
    })

    test('bulk posts to /pricing/bulk', async () => {
      postMock.mockResolvedValueOnce({ data: { message: 'ok', updated: 2 } })
      await pricingService.bulk({ reseller_ids: [1, 2], mode: 'fixed', value: 99 })
      expect(postMock).toHaveBeenCalledWith('/pricing/bulk', { reseller_ids: [1, 2], mode: 'fixed', value: 99 })
    })

    test('history passes query params', async () => {
      getMock.mockResolvedValueOnce({ data: { data: [] } })
      await pricingService.history({ reseller_id: 1, limit: 10 })
      expect(getMock).toHaveBeenCalledWith('/pricing/history', { params: { reseller_id: 1, limit: 10 } })
    })
  })

  describe('settingsService', () => {
    test('get requests /super-admin/settings', async () => {
      getMock.mockResolvedValueOnce({ data: { data: {} } })
      await settingsService.get()
      expect(getMock).toHaveBeenCalledWith('/super-admin/settings')
    })

    test('update puts /super-admin/settings payload', async () => {
      putMock.mockResolvedValueOnce({ data: { data: {}, message: 'ok' } })
      await settingsService.update({ security: { min_password_length: 8 } } as never)
      expect(putMock).toHaveBeenCalledWith('/super-admin/settings', { security: { min_password_length: 8 } })
    })

    test('getOnlineWidgetSettings requests /online-widget/settings', async () => {
      getMock.mockResolvedValueOnce({ data: { data: { show_online_widget_to_resellers: true } } })
      await settingsService.getOnlineWidgetSettings()
      expect(getMock).toHaveBeenCalledWith('/online-widget/settings')
    })
  })

  describe('teamService', () => {
    test('getAll passes params to /team', async () => {
      getMock.mockResolvedValueOnce({ data: { data: [], meta: {} } })
      await teamService.getAll({ page: 1, per_page: 10, role: 'reseller' })
      expect(getMock).toHaveBeenCalledWith('/team', { params: { page: 1, per_page: 10, role: 'reseller' } })
    })

    test('create posts /team payload', async () => {
      postMock.mockResolvedValueOnce({ data: { data: {} } })
      await teamService.create({ name: 'R', email: 'r@example.com', role: 'reseller', password: 'secret123' })
      expect(postMock).toHaveBeenCalledWith('/team', { name: 'R', email: 'r@example.com', role: 'reseller', password: 'secret123' })
    })

    test('update puts /team/{id}', async () => {
      putMock.mockResolvedValueOnce({ data: { data: {} } })
      await teamService.update(12, { name: 'Updated' })
      expect(putMock).toHaveBeenCalledWith('/team/12', { name: 'Updated' })
    })

    test('delete calls /team/{id}', async () => {
      deleteMock.mockResolvedValueOnce({ data: { message: 'ok' } })
      await teamService.delete(12)
      expect(deleteMock).toHaveBeenCalledWith('/team/12')
    })

    test('updateStatus calls /team/{id}/status', async () => {
      putMock.mockResolvedValueOnce({ data: { data: {} } })
      await teamService.updateStatus(12, 'suspended')
      expect(putMock).toHaveBeenCalledWith('/team/12/status', { status: 'suspended' })
    })

    test('getStats calls /team/{id}/stats', async () => {
      getMock.mockResolvedValueOnce({ data: { data: {} } })
      await teamService.getStats(12)
      expect(getMock).toHaveBeenCalledWith('/team/12/stats')
    })
  })

  describe('programService', () => {
    test('getAll requests /programs with params', async () => {
      getMock.mockResolvedValueOnce({ data: { data: [], meta: {} } })
      await programService.getAll({ page: 1, per_page: 50, status: 'active', search: 'obd' })
      expect(getMock).toHaveBeenCalledWith('/programs', { params: { page: 1, per_page: 50, status: 'active', search: 'obd' } })
    })

    test('create posts multipart form data to /programs', async () => {
      postMock.mockResolvedValueOnce({ data: { data: {} } })
      await programService.create({
        name: 'P',
        download_link: 'https://example.com',
        base_price: 99,
      })
      expect(postMock.mock.calls[0][0]).toBe('/programs')
      expect(postMock.mock.calls[0][2]).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } })
    })

    test('update posts multipart with _method=PUT', async () => {
      postMock.mockResolvedValueOnce({ data: { data: {} } })
      await programService.update(9, { name: 'Edited' })
      expect(postMock.mock.calls[0][0]).toBe('/programs/9')
      expect(postMock.mock.calls[0][2]).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } })
    })

    test('delete calls /programs/{id}', async () => {
      deleteMock.mockResolvedValueOnce({ data: { message: 'ok' } })
      await programService.delete(9)
      expect(deleteMock).toHaveBeenCalledWith('/programs/9')
    })

    test('getStats calls /programs/{id}/stats', async () => {
      getMock.mockResolvedValueOnce({ data: { data: {} } })
      await programService.getStats(9)
      expect(getMock).toHaveBeenCalledWith('/programs/9/stats')
    })

    test('getById calls /programs/{id}', async () => {
      getMock.mockResolvedValueOnce({ data: { data: {} } })
      await programService.getById(9)
      expect(getMock).toHaveBeenCalledWith('/programs/9')
    })
  })
})

