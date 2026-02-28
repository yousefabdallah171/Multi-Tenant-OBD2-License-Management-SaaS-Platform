import { useTranslation } from 'react-i18next'

interface SkipToContentProps {
  targetId: string
}

export function SkipToContent({ targetId }: SkipToContentProps) {
  const { t } = useTranslation()

  return (
    <a
      href={`#${targetId}`}
      className="sr-only z-[60] rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      {t('common.skipToContent')}
    </a>
  )
}
