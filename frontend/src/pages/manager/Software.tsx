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
      eyebrow={t('manager.layout.eyebrow')}
      title={t('manager.pages.software.title')}
      description={t('manager.pages.software.description')}
      translationPrefix="manager.pages.software"
      showBasePrice={false}
      showLicensesSold={false}
      onActivate={(program) =>
        navigate(`${routePaths.manager.customerCreate(lang)}?program_id=${program.id}`)
      }
    />
  )
}
