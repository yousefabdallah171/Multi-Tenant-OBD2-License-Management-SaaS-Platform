import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { supportedLanguages, useLanguage } from '@/hooks/useLanguage'

export function LanguageLayout() {
  const { lang } = useParams<{ lang: string }>()
  const location = useLocation()

  useLanguage()

  if (!supportedLanguages.includes((lang ?? '') as 'ar' | 'en')) {
    const segments = location.pathname.split('/').filter(Boolean)
    const rest = segments.slice(1).join('/')
    const nextPath = rest ? `/ar/${rest}` : '/ar'

    return <Navigate to={nextPath} replace />
  }

  return <Outlet />
}

export function LanguageNotFound() {
  const { lang } = useParams<{ lang: string }>()
  const location = useLocation()
  const nextPath = supportedLanguages.includes((lang ?? '') as 'ar' | 'en') ? `/${lang}` : '/ar'

  return <Navigate to={`${nextPath}${location.search}${location.hash}`} replace />
}
