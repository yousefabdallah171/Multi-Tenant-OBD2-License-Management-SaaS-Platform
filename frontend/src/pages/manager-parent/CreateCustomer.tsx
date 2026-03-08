import { CustomerCreatePage } from '@/pages/shared/CustomerCreatePage'
import { routePaths } from '@/router/routes'
import { customerService } from '@/services/customer.service'
import { useTranslation } from 'react-i18next'

export function CreateCustomerPageForManagerParent() {
  const { t } = useTranslation()

  return (
    <CustomerCreatePage
      title={t('managerParent.pages.customers.addCustomer', { defaultValue: 'Add Customer' })}
      description={t('managerParent.pages.customers.createDescription', { defaultValue: 'Create a customer profile or activate a license from the manager parent workspace.' })}
      backPath={routePaths.managerParent.customers}
      createCustomer={customerService.create}
    />
  )
}
