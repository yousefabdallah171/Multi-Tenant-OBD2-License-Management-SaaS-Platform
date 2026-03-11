import { routePaths } from '@/router/routes'
import { RenewLicensePage } from '@/pages/shared/RenewLicensePage'
import { useTranslation } from 'react-i18next'

export function RenewLicensePageForReseller() {
  const { t } = useTranslation()

  return (
    <RenewLicensePage
      defaultBackPath={routePaths.reseller.customers}
      invalidateQueryKey={['reseller']}
      eyebrow={t('roles.reseller')}
      cachePattern={/^reseller:/}
    />
  )
}
