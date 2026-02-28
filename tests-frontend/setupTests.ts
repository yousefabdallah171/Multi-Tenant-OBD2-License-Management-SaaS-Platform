import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'node:util'
import '../frontend/src/i18n'
import { useAuthStore } from '../frontend/src/stores/authStore'
import { useSidebarStore } from '../frontend/src/stores/sidebarStore'
import { useThemeStore } from '../frontend/src/stores/themeStore'

Object.assign(globalThis, {
  TextEncoder,
  TextDecoder,
})

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

beforeEach(() => {
  window.localStorage.clear()
  useAuthStore.getState().clearSession()
  useSidebarStore.setState({ collapsed: false })
  useThemeStore.setState({ theme: 'light' })
  document.documentElement.lang = 'ar'
  document.documentElement.dir = 'rtl'
  document.documentElement.classList.remove('dark')
})
