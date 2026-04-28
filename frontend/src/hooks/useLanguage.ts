import { useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import i18n, { ensureLocaleLoaded } from '@/i18n'
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from '@/lib/constants'

export const supportedLanguages = ['ar', 'en'] as const

export type SupportedLanguage = (typeof supportedLanguages)[number]

function isSupportedLanguage(value: string | undefined): value is SupportedLanguage {
  return value === 'ar' || value === 'en'
}

export function useLanguage() {
  const { lang } = useParams<{ lang: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const currentLanguage: SupportedLanguage = isSupportedLanguage(lang) ? lang : DEFAULT_LANGUAGE

  useEffect(() => {
    void (async () => {
      await ensureLocaleLoaded(currentLanguage)
      await i18n.changeLanguage(currentLanguage)
    })()
    document.documentElement.dir = currentLanguage === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = currentLanguage
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage)
  }, [currentLanguage])

  const switchLanguage = () => {
    const nextLanguage: SupportedLanguage = currentLanguage === 'ar' ? 'en' : 'ar'
    const nextPath = location.pathname.replace(`/${currentLanguage}`, `/${nextLanguage}`)
    navigate(`${nextPath}${location.search}${location.hash}`, { replace: true })
  }

  return {
    lang: currentLanguage,
    switchLanguage,
    isRtl: currentLanguage === 'ar',
  }
}
