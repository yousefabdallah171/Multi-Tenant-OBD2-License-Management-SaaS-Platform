import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { SupportedLanguage } from '@/hooks/useLanguage'
import { DEFAULT_LANGUAGE } from '@/lib/constants'
import { getDashboardPath, routePaths } from '@/router/routes'
import type { UserRole } from '@/types/user.types'

function getLang(value?: string): SupportedLanguage {
  return value === 'en' ? 'en' : DEFAULT_LANGUAGE
}

export function ProtectedRoute() {
  const { lang } = useParams()
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const currentLang = getLang(lang)

  if (!isAuthenticated) {
    return <Navigate to={routePaths.login(currentLang)} replace state={{ from: location }} />
  }

  return <Outlet />
}

export function GuestRoute() {
  const { lang } = useParams()
  const { isAuthenticated, user } = useAuth()
  const currentLang = getLang(lang)

  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPath(user.role, currentLang)} replace />
  }

  return <Outlet />
}

export function RoleGuard({ allowedRoles }: { allowedRoles: UserRole[] }) {
  const { lang } = useParams()
  const { user } = useAuth()
  const currentLang = getLang(lang)

  if (!user) {
    return <Navigate to={routePaths.login(currentLang)} replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getDashboardPath(user.role, currentLang)} replace />
  }

  return <Outlet />
}
