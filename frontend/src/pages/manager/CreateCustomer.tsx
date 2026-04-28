import { CustomerCreatePage } from '@/pages/shared/CustomerCreatePage'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'
import { useTranslation } from 'react-i18next'

export function CreateCustomerPageForManager() {
  const { t } = useTranslation()

  return (
    <CustomerCreatePage
      title={t('manager.pages.customers.addCustomer', { defaultValue: 'Add Customer' })}
      description={t('manager.pages.customers.createDescription', { defaultValue: 'Create a customer profile or activate a license from the manager workspace.' })}
      backPath={routePaths.manager.customers}
      createCustomer={managerService.createCustomer}
    />
  )
}
