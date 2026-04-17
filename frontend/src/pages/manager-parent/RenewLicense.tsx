import { routePaths } from '@/router/routes'
import { RenewLicensePage } from '@/pages/shared/RenewLicensePage'
import { useTranslation } from 'react-i18next'

export function RenewLicensePageForManagerParent() {
  const { t } = useTranslation()

  return (
    <RenewLicensePage
      defaultBackPath={routePaths.managerParent.customers}
      invalidateQueryKey={['manager-parent']}
      eyebrow={t('roles.manager_parent')}
      cachePattern={/^manager-parent:/}
      presetOnly
    />
  )
}
