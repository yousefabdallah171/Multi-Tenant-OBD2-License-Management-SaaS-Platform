import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from '@/lib/constants'

type SupportedLanguage = 'ar' | 'en'

const runtimeLocale = (globalThis as { __VITE_DEFAULT_LOCALE__?: string }).__VITE_DEFAULT_LOCALE__ || DEFAULT_LANGUAGE

const localeLoaders: Record<SupportedLanguage, () => Promise<{ default: Record<string, unknown> }>> = {
  ar: () => import('@/locales/ar.json'),
  en: () => import('@/locales/en.json'),
}

const loadedLanguages = new Set<SupportedLanguage>()
let initPromise: Promise<void> | null = null

function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return value === 'ar' || value === 'en'
}

function getPathLanguage(): SupportedLanguage | null {
  if (typeof window === 'undefined') {
    return null
  }
  const match = window.location.pathname.match(/^\/(ar|en)(?:\/|$)/)
  return match?.[1] === 'en' ? 'en' : match?.[1] === 'ar' ? 'ar' : null
}

export function resolveInitialLanguage(): SupportedLanguage {
  const fromPath = getPathLanguage()
  if (fromPath) {
    return fromPath
  }

  const fromStorage = typeof window !== 'undefined' ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY) : null
  if (isSupportedLanguage(fromStorage)) {
    return fromStorage
  }

  return isSupportedLanguage(runtimeLocale) ? runtimeLocale : DEFAULT_LANGUAGE
}

export async function ensureLocaleLoaded(lang: SupportedLanguage): Promise<void> {
  if (loadedLanguages.has(lang)) {
    return
  }

  const module = await localeLoaders[lang]()
  i18n.addResourceBundle(lang, 'translation', module.default, true, true)
  loadedLanguages.add(lang)
}

export async function initI18n(initialLang: SupportedLanguage = resolveInitialLanguage()): Promise<void> {
  if (i18n.isInitialized) {
    await ensureLocaleLoaded(initialLang)
    await i18n.changeLanguage(initialLang)
    return
  }

  if (initPromise) {
    await initPromise
    await ensureLocaleLoaded(initialLang)
    await i18n.changeLanguage(initialLang)
    return
  }

  initPromise = (async () => {
    const module = await localeLoaders[initialLang]()
    loadedLanguages.add(initialLang)

    await i18n
      .use(initReactI18next)
      .init({
        resources: {
          [initialLang]: { translation: module.default },
        },
        lng: initialLang,
        fallbackLng: 'en',
        interpolation: {
          escapeValue: false,
        },
        react: {
          useSuspense: false,
        },
      })

    if (initialLang !== 'en') {
      void ensureLocaleLoaded('en')
    }
  })()

  await initPromise
}

export default i18n
