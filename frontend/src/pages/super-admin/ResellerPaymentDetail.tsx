import { useTranslation } from 'react-i18next'
import { RoleResellerPaymentDetailPage } from '@/pages/shared/RoleResellerPaymentDetailPage'
import { routePaths } from '@/router/routes'
import { superAdminPlatformService } from '@/services/super-admin-platform.service'

export function ResellerPaymentDetailPage() {
  const { t } = useTranslation()

  return (
    <RoleResellerPaymentDetailPage
      eyebrow={t('superAdmin.layout.eyebrow')}
      queryKeyPrefix="super-admin"
      listPath={routePaths.superAdmin.resellerPayments}
      fetchDetail={superAdminPlatformService.getResellerPaymentDetail}
      recordPayment={superAdminPlatformService.recordPayment}
      updatePayment={superAdminPlatformService.updatePayment}
      deletePayment={superAdminPlatformService.deletePayment}
      storeCommission={superAdminPlatformService.storeCommission}
    />
  )
}
