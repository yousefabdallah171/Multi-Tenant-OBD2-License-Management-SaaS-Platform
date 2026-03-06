import { CustomerCreatePage } from '@/pages/shared/CustomerCreatePage'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'

export function CreateCustomerPageForManager() {
  return (
    <CustomerCreatePage
      title="Add Customer"
      description="Create a customer profile or activate a license from the manager workspace."
      backPath={routePaths.manager.customers}
      createCustomer={managerService.createCustomer}
    />
  )
}
