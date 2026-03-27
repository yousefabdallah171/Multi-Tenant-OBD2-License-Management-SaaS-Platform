import { useTranslation } from 'react-i18next'

export function BlockBadge() {
  const { t, i18n } = useTranslation()

  return (
    <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-sm font-semibold uppercase tracking-wide text-rose-700 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
      {t('common.block', { defaultValue: i18n.language === 'ar' ? 'حظر' : 'Block' })}
    </span>
  )
}
