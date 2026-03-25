import { routePaths } from '@/router/routes'
import { RenewLicensePage } from '@/pages/shared/RenewLicensePage'
import { useTranslation } from 'react-i18next'

export function RenewLicensePageForManager() {
  const { t } = useTranslation()

  return (
    <RenewLicensePage
      defaultBackPath={routePaths.manager.customers}
      invalidateQueryKey={['manager']}
      eyebrow={t('roles.manager')}
      cachePattern={/^manager:/}
    />
  )
}
