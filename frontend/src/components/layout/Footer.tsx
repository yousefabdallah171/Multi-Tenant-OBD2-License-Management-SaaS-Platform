import { useTranslation } from 'react-i18next'

export function Footer() {
  const { t } = useTranslation()

  return <footer className="border-t border-slate-200 px-4 py-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">{t('superAdmin.layout.copyright')}</footer>
}
