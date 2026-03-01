import { reportService } from '@/services/report.service'
import { api } from '@/services/api'
import { downloadFile } from '@/utils/download'

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
  },
}))

jest.mock('@/utils/download', () => ({
  downloadFile: jest.fn(),
}))

describe('reportService', () => {
  beforeEach(() => {
    ;(api.get as jest.Mock).mockReset()
    ;(downloadFile as jest.Mock).mockReset()
  })

  test('getRevenue uses date range params', async () => {
    ;(api.get as jest.Mock).mockResolvedValueOnce({ data: { data: [] } })
    await reportService.getRevenue({ from: '2026-01-01', to: '2026-01-31' })
    expect(api.get).toHaveBeenCalledWith('/super-admin/reports/revenue', {
      params: { from: '2026-01-01', to: '2026-01-31' },
    })
  })

  test('exportCsv triggers download helper', async () => {
    await reportService.exportCsv({ from: '2026-01-01', to: '2026-01-31' })
    expect(downloadFile).toHaveBeenCalledWith('/super-admin/reports/export/csv', 'super-admin-reports.csv', { from: '2026-01-01', to: '2026-01-31' })
  })

  test('exportPdf triggers download helper', async () => {
    await reportService.exportPdf({ from: '2026-01-01', to: '2026-01-31' })
    expect(downloadFile).toHaveBeenCalledWith('/super-admin/reports/export/pdf', 'super-admin-reports.pdf', { from: '2026-01-01', to: '2026-01-31' })
  })
})
