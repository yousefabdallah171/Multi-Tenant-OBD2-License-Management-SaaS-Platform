import { useTranslation } from 'react-i18next'
import { RoleResellerPaymentsPage } from '@/pages/shared/RoleResellerPaymentsPage'
import { routePaths } from '@/router/routes'
import { superAdminPlatformService } from '@/services/super-admin-platform.service'

export function ResellerPaymentsPage() {
  const { t } = useTranslation()

  return (
    <RoleResellerPaymentsPage
      eyebrow={t('superAdmin.layout.eyebrow')}
      queryKeyPrefix="super-admin"
      fetchList={superAdminPlatformService.getResellerPayments}
      recordPayment={superAdminPlatformService.recordPayment}
      detailPath={(lang, resellerId) => routePaths.superAdmin.resellerPaymentDetail(lang, resellerId)}
    />
  )
}
