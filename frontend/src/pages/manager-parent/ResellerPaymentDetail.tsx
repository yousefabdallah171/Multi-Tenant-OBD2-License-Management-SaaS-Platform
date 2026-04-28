import { useTranslation } from 'react-i18next'
import { RoleResellerPaymentDetailPage } from '@/pages/shared/RoleResellerPaymentDetailPage'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'

export function ResellerPaymentDetailPage() {
  const { t } = useTranslation()

  return (
    <RoleResellerPaymentDetailPage
      eyebrow={t('managerParent.layout.eyebrow')}
      queryKeyPrefix="manager-parent"
      listPath={routePaths.managerParent.resellerPayments}
      fetchDetail={managerParentService.getResellerPaymentDetail}
      recordPayment={managerParentService.recordPayment}
      updatePayment={managerParentService.updatePayment}
      deletePayment={managerParentService.deletePayment}
      storeCommission={managerParentService.storeCommission}
    />
  )
}
