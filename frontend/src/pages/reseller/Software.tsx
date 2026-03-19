import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ProgramCatalogPage } from '@/components/shared/ProgramCatalogPage'
import { useLanguage } from '@/hooks/useLanguage'
import { routePaths } from '@/router/routes'

export function SoftwarePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lang } = useLanguage()

  return (
    <ProgramCatalogPage
      eyebrow={t('roles.reseller')}
      title={t('reseller.pages.software.title')}
      description={t('reseller.pages.software.description')}
      translationPrefix="reseller.pages.software"
      showBasePrice={false}
      showLicensesSold={false}
      onActivate={(program) =>
        navigate(`${routePaths.reseller.customerCreate(lang)}?program_id=${program.id}`)
      }
    />
  )
}
