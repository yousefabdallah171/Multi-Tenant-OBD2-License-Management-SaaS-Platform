import { useTranslation } from 'react-i18next'
import { ProgramCatalogPage } from '@/components/shared/ProgramCatalogPage'

export function SoftwarePage() {
  const { t } = useTranslation()

  return (
    <ProgramCatalogPage
      eyebrow={t('roles.reseller')}
      title={t('reseller.pages.software.title')}
      description={t('reseller.pages.software.description')}
      translationPrefix="reseller.pages.software"
    />
  )
}
