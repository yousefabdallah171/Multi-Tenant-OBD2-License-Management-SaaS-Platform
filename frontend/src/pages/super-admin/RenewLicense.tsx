import { routePaths } from '@/router/routes'
import { RenewLicensePage } from '@/pages/shared/RenewLicensePage'
import { useTranslation } from 'react-i18next'

export function RenewLicensePageForSuperAdmin() {
  const { t } = useTranslation()

  return (
    <RenewLicensePage
      defaultBackPath={routePaths.superAdmin.customers}
      invalidateQueryKey={['super-admin']}
      eyebrow={t('roles.super_admin')}
      cachePattern={/^super-admin:/}
    />
  )
}
