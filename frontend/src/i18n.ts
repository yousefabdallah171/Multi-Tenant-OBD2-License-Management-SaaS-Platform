import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import ar from '@/locales/ar.json'
import en from '@/locales/en.json'

const runtimeLocale = (globalThis as { __VITE_DEFAULT_LOCALE__?: string }).__VITE_DEFAULT_LOCALE__ || 'ar'

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    lng: runtimeLocale,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
