import { CustomerCreatePage } from '@/pages/shared/CustomerCreatePage'
import { routePaths } from '@/router/routes'
import { resellerService } from '@/services/reseller.service'
import { useTranslation } from 'react-i18next'

export function CreateCustomerPageForReseller() {
  const { t } = useTranslation()

  return (
    <CustomerCreatePage
      title={t('reseller.pages.customers.addCustomer')}
      description={t('reseller.pages.customers.createDescription')}
      backPath={routePaths.reseller.customers}
      createCustomer={resellerService.createCustomer}
    />
  )
}
