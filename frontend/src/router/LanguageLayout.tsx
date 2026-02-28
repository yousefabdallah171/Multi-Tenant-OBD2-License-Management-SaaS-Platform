import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { DEFAULT_LANGUAGE } from '@/lib/constants'
import { routePaths } from '@/router/routes'
import { supportedLanguages, useLanguage } from '@/hooks/useLanguage'

export function LanguageLayout() {
  const { lang } = useParams<{ lang: string }>()
  const location = useLocation()

  useLanguage()

  if (!supportedLanguages.includes((lang ?? '') as 'ar' | 'en')) {
    return <Navigate to={`${routePaths.errors.notFound(DEFAULT_LANGUAGE)}?path=${encodeURIComponent(location.pathname)}`} replace />
  }

  return <Outlet />
}
