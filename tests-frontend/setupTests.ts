import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'node:util'
import '../frontend/src/i18n'
import { useAuthStore } from '../frontend/src/stores/authStore'

Object.assign(globalThis, {
  TextEncoder,
  TextDecoder,
})

beforeEach(() => {
  window.localStorage.clear()
  useAuthStore.getState().clearSession()
  document.documentElement.lang = 'ar'
  document.documentElement.dir = 'rtl'
})
