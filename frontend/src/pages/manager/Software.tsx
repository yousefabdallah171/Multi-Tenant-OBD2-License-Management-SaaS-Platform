import { useTranslation } from 'react-i18next'
import { ProgramCatalogPage } from '@/components/shared/ProgramCatalogPage'

export function SoftwarePage() {
  const { t } = useTranslation()

  return (
    <ProgramCatalogPage
      eyebrow={t('manager.layout.eyebrow')}
      title={t('manager.pages.software.title')}
      description={t('manager.pages.software.description')}
      translationPrefix="manager.pages.software"
    />
  )
}
