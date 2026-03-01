import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { ProgramCatalogPage } from '@/components/shared/ProgramCatalogPage'
import { useLanguage } from '@/hooks/useLanguage'
import { routePaths } from '@/router/routes'

export function SoftwarePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { lang } = useLanguage()

  return (
    <ProgramCatalogPage
      eyebrow={t('managerParent.layout.eyebrow')}
      title={t('managerParent.pages.software.title')}
      description={t('managerParent.pages.software.description')}
      translationPrefix="managerParent.pages.software"
      onActivate={(program) =>
        navigate(routePaths.managerParent.activateLicense(lang, program.id), {
          state: { returnTo: location.pathname },
        })
      }
    />
  )
}

