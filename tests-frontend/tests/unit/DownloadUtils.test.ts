import { api } from '@/services/api'
import { downloadFile } from '@/utils/download'

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
  },
}))

const mockApi = jest.mocked(api)

test('downloadFile requests a blob, clicks a link, and revokes the object URL', async () => {
  const blob = new Blob(['report'])
  const createObjectURL = jest.fn(() => 'blob:report')
  const revokeObjectURL = jest.fn()
  const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  mockApi.get.mockResolvedValue({ data: blob } as never)
  Object.defineProperty(window.URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: createObjectURL,
  })
  Object.defineProperty(window.URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: revokeObjectURL,
  })
  document.documentElement.lang = 'en'

  await downloadFile('/reports/export/csv', 'report.csv', { from: '2026-02-01' })

  expect(mockApi.get).toHaveBeenCalledWith(
    '/reports/export/csv',
    expect.objectContaining({
      params: {
        from: '2026-02-01',
        lang: 'en',
      },
      responseType: 'blob',
    }),
  )
  expect(createObjectURL).toHaveBeenCalledWith(blob)
  expect(clickSpy).toHaveBeenCalled()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:report')

  clickSpy.mockRestore()
})
