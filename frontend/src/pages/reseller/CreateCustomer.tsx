import { CustomerCreatePage } from '@/pages/shared/CustomerCreatePage'
import { routePaths } from '@/router/routes'
import { resellerService } from '@/services/reseller.service'

export function CreateCustomerPageForReseller() {
  return (
    <CustomerCreatePage
      title="Add Customer"
      description="Create a customer profile or activate a license from the reseller workspace."
      backPath={routePaths.reseller.customers}
      createCustomer={resellerService.createCustomer}
    />
  )
}
