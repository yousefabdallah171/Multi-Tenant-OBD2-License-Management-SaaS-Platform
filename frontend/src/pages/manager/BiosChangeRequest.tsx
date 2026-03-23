import { useTranslation } from 'react-i18next'
import { BiosChangeRequestPage } from '@/pages/shared/BiosChangeRequestPage'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'

export function BiosChangeRequestPageForManager() {
  const { t } = useTranslation()
  return (
    <BiosChangeRequestPage
      eyebrow={t('roles.manager')}
      backPath={routePaths.manager.customers}
      getCustomer={(id) => managerService.getCustomer(id)}
      submitRequest={(payload) => managerService.submitBiosChangeRequest(payload)}
      queryKey="manager"
    />
  )
}
