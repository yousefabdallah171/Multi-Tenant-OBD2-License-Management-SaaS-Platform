import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import './i18n'

;(globalThis as { __VITE_API_URL__?: string }).__VITE_API_URL__ = import.meta.env.VITE_API_URL
;(globalThis as { __VITE_DEFAULT_LOCALE__?: string }).__VITE_DEFAULT_LOCALE__ = import.meta.env.VITE_DEFAULT_LOCALE

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
