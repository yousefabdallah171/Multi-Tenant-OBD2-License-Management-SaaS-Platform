import { useTranslation } from 'react-i18next'
import { RoleResellerPaymentsPage } from '@/pages/shared/RoleResellerPaymentsPage'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'

export function ResellerPaymentsPage() {
  const { t } = useTranslation()

  return (
    <RoleResellerPaymentsPage
      eyebrow={t('manager.layout.eyebrow')}
      queryKeyPrefix="manager"
      fetchList={managerService.getResellerPayments}
      recordPayment={managerService.recordPayment}
      detailPath={(lang, resellerId) => routePaths.manager.resellerPaymentDetail(lang, resellerId)}
      roleSalesRoles={['manager', 'reseller']}
      allowRecordPayment={false}
    />
  )
}
