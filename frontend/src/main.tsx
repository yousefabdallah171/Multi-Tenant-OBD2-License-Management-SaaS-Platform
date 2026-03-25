import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initI18n, resolveInitialLanguage } from './i18n'

;(globalThis as { __VITE_API_URL__?: string }).__VITE_API_URL__ = import.meta.env.VITE_API_URL
;(globalThis as { __VITE_DEFAULT_LOCALE__?: string }).__VITE_DEFAULT_LOCALE__ = import.meta.env.VITE_DEFAULT_LOCALE

const VITE_CHUNK_RELOAD_KEY = 'vite:chunk-reload'

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
}

installChunkRecovery()

async function bootstrap() {
  const lang = resolveInitialLanguage()
  await initI18n(lang)

  const { default: App } = await import('./App.tsx')

  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(`${VITE_CHUNK_RELOAD_KEY}:${window.location.pathname}`)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
