import { useTranslation } from 'react-i18next'
import { RoleResellerPaymentDetailPage } from '@/pages/shared/RoleResellerPaymentDetailPage'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'

export function ResellerPaymentDetailPage() {
  const { t } = useTranslation()

  return (
    <RoleResellerPaymentDetailPage
      eyebrow={t('manager.layout.eyebrow')}
      queryKeyPrefix="manager"
      listPath={routePaths.manager.resellerPayments}
      fetchDetail={managerService.getResellerPaymentDetail}
      recordPayment={managerService.recordPayment}
      updatePayment={managerService.updatePayment}
      storeCommission={managerService.storeCommission}
      allowPaymentActions={false}
      showPaymentHistory={false}
    />
  )
}
