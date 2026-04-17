import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { initI18n, resolveInitialLanguage } from './i18n'
import { primeDashboardAppearanceFromStorage } from './lib/dashboard-appearance'

;(globalThis as { __VITE_API_URL__?: string }).__VITE_API_URL__ = import.meta.env.VITE_API_URL
;(globalThis as { __VITE_DEFAULT_LOCALE__?: string }).__VITE_DEFAULT_LOCALE__ = import.meta.env.VITE_DEFAULT_LOCALE

const VITE_CHUNK_RELOAD_KEY = 'vite:chunk-reload'
const VITE_CACHE_RESET_KEY = 'vite:cache-reset'
const ASSET_URL_PATTERN = /\/assets\/.+\.(css|js)(\?|$)/i

async function clearRuntimeCaches() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(async (registration) => registration.unregister()))
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(async (cacheName) => caches.delete(cacheName)))
    }
  } catch {
    // A best-effort cache reset is enough here.
  }
}

function recoverFromStaleAssets(reason: string) {
  if (typeof window === 'undefined') {
    return
  }

  const reloadKey = `${VITE_CACHE_RESET_KEY}:${window.location.pathname}`

  if (window.sessionStorage.getItem(reloadKey)) {
    return
  }

  window.sessionStorage.setItem(reloadKey, reason)

  void clearRuntimeCaches().finally(() => {
    window.location.reload()
  })
}

function shouldRecoverFromWorkboxRejection(message: string) {
  const urlMatch = message.match(/"url":"([^"]+)"/i)
  const rawUrl = urlMatch?.[1] ?? ''

  if (!rawUrl) {
    return false
  }

  const normalizedUrl = rawUrl.toLowerCase()

  // HTML/app-shell navigations are intentionally not precached in this app.
  if (
    normalizedUrl === 'index.html'
    || normalizedUrl.endsWith('/index.html')
    || normalizedUrl === '/'
  ) {
    return false
  }

  return ASSET_URL_PATTERN.test(rawUrl)
}

function installChunkRecovery() {
  if (typeof window === 'undefined') {
    return
  }

  window.addEventListener('vite:preloadError', (event) => {
    const reloadKey = `${VITE_CHUNK_RELOAD_KEY}:${window.location.pathname}`

    if (window.sessionStorage.getItem(reloadKey)) {
      window.sessionStorage.removeItem(reloadKey)
      return
    }

    event.preventDefault()
    window.sessionStorage.setItem(reloadKey, '1')
    window.location.reload()
  })

  window.addEventListener(
    'error',
    (event) => {
      const target = event.target

      if (!(target instanceof HTMLLinkElement || target instanceof HTMLScriptElement)) {
        return
      }

      const source = target instanceof HTMLLinkElement ? target.href : target.src

      if (!source || !ASSET_URL_PATTERN.test(source)) {
        return
      }

      recoverFromStaleAssets('asset-load-error')
    },
    true,
  )

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = typeof reason === 'string'
      ? reason
      : reason instanceof Error
        ? reason.message
        : String(reason ?? '')

    if (!message.includes('non-precached-url')) {
      return
    }

    // Ignore expected HTML navigation fallbacks; only recover when a real JS/CSS asset is missing.
    event.preventDefault()

    if (!shouldRecoverFromWorkboxRejection(message)) {
      return
    }

    recoverFromStaleAssets('workbox-non-precached-url')
  })
}

installChunkRecovery()

const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    void clearRuntimeCaches().finally(() => {
      updateServiceWorker(true)
      window.location.reload()
    })
  },
})

if (typeof document !== 'undefined') {
  primeDashboardAppearanceFromStorage(document.documentElement)
}

async function bootstrap() {
  const lang = resolveInitialLanguage()
  await initI18n(lang)

  const { default: App } = await import('./App.tsx')

  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(`${VITE_CHUNK_RELOAD_KEY}:${window.location.pathname}`)
    window.sessionStorage.removeItem(`${VITE_CACHE_RESET_KEY}:${window.location.pathname}`)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
