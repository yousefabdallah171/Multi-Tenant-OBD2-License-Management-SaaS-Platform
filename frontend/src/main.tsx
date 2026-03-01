import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { initI18n, resolveInitialLanguage } from './i18n'

;(globalThis as { __VITE_API_URL__?: string }).__VITE_API_URL__ = import.meta.env.VITE_API_URL
;(globalThis as { __VITE_DEFAULT_LOCALE__?: string }).__VITE_DEFAULT_LOCALE__ = import.meta.env.VITE_DEFAULT_LOCALE

async function bootstrap() {
  const lang = resolveInitialLanguage()
  await initI18n(lang)

  const { default: App } = await import('./App.tsx')

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

registerSW({ immediate: true })

void bootstrap()
