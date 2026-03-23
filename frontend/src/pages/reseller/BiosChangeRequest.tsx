import { useTranslation } from 'react-i18next'
import { BiosChangeRequestPage } from '@/pages/shared/BiosChangeRequestPage'
import { routePaths } from '@/router/routes'
import { resellerService } from '@/services/reseller.service'

export function BiosChangeRequestPageForReseller() {
  const { t } = useTranslation()
  return (
    <BiosChangeRequestPage
      eyebrow={t('roles.reseller')}
      backPath={routePaths.reseller.customers}
      getCustomer={(id) => resellerService.getCustomer(id)}
      submitRequest={(payload) => resellerService.submitBiosChangeRequest(payload)}
      queryKey="reseller"
    />
  )
}
