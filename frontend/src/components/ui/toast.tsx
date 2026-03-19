import { useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'

export function AppToaster() {
  const location = useLocation()
  const isRtl = location.pathname === '/ar' || location.pathname.startsWith('/ar/')

  return (
    <div aria-live="polite">
      <Toaster richColors closeButton position={isRtl ? 'top-left' : 'top-right'} />
    </div>
  )
}
