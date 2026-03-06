import { CustomerCreatePage } from '@/pages/shared/CustomerCreatePage'
import { routePaths } from '@/router/routes'
import { customerService } from '@/services/customer.service'

export function CreateCustomerPageForManagerParent() {
  return (
    <CustomerCreatePage
      title="Add Customer"
      description="Create a customer profile or activate a license from the manager parent workspace."
      backPath={routePaths.managerParent.customers}
      createCustomer={customerService.create}
    />
  )
}
