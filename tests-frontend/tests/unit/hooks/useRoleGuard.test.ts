import { renderHook } from '@testing-library/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'

const useAuthMock = jest.fn()

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

describe('useRoleGuard', () => {
  test('returns allowed true when role matches', () => {
    useAuthMock.mockReturnValue({ user: { role: 'manager' } })
    const { result } = renderHook(() => useRoleGuard(['manager']))
    expect(result.current.isAllowed).toBe(true)
  })

  test('returns allowed false when role does not match', () => {
    useAuthMock.mockReturnValue({ user: { role: 'reseller' } })
    const { result } = renderHook(() => useRoleGuard(['manager']))
    expect(result.current.isAllowed).toBe(false)
  })

  test('returns role null when no authenticated user', () => {
    useAuthMock.mockReturnValue({ user: null })
    const { result } = renderHook(() => useRoleGuard(['manager']))
    expect(result.current.role).toBeNull()
    expect(result.current.isAllowed).toBe(false)
  })
})
