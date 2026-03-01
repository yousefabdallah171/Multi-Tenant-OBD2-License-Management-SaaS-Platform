import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useLicenses } from '@/hooks/useLicenses'
import { licenseService } from '@/services/license.service'

jest.mock('@/services/license.service', () => ({
  licenseService: {
    getAll: jest.fn(),
    activate: jest.fn(),
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useLicenses', () => {
  beforeEach(() => {
    ;(licenseService.getAll as jest.Mock).mockReset()
    ;(licenseService.activate as jest.Mock).mockReset()
  })

  test('fetches licenses list using filters', async () => {
    ;(licenseService.getAll as jest.Mock).mockResolvedValueOnce({ data: [], meta: { total: 0 } })
    const { result } = renderHook(() => useLicenses({ status: 'active' }), { wrapper })

    await waitFor(() => expect(result.current.licensesQuery.isSuccess).toBe(true))
    expect(licenseService.getAll).toHaveBeenCalledWith({ status: 'active' })
  })

  test('creates license via mutation with float duration_days', async () => {
    ;(licenseService.getAll as jest.Mock).mockResolvedValueOnce({ data: [], meta: { total: 0 } })
    ;(licenseService.activate as jest.Mock).mockResolvedValueOnce({ message: 'ok' })
    const { result } = renderHook(() => useLicenses(), { wrapper })

    await act(async () => {
      await result.current.activateMutation.mutateAsync({
        customer_name: 'Customer',
        customer_email: 'customer@example.com',
        bios_id: 'BIOS-001',
        program_id: 1,
        duration_days: 0.021,
        price: 1.2,
      })
    })

    expect(licenseService.activate).toHaveBeenCalledWith(expect.objectContaining({ duration_days: 0.021 }))
  })
})
