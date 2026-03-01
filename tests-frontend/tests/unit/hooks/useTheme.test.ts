import { act, renderHook } from '@testing-library/react'
import { useTheme } from '@/hooks/useTheme'
import { useThemeStore } from '@/stores/themeStore'

describe('useTheme', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useThemeStore.setState({ theme: 'light' })
    document.documentElement.classList.remove('dark')
  })

  test('returns current theme and toggles it', () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('light')
    act(() => result.current.toggleTheme())
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  test('toggle persists theme to localStorage', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.toggleTheme())
    expect(window.localStorage.getItem('license-theme')).toBe('dark')
  })

  test('applies dark class when theme is dark', () => {
    useThemeStore.setState({ theme: 'dark' })
    renderHook(() => useTheme())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
