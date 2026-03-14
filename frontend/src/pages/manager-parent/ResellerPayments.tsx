import { useTranslation } from 'react-i18next'
import { RoleResellerPaymentsPage } from '@/pages/shared/RoleResellerPaymentsPage'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'

export function ResellerPaymentsPage() {
  const { t } = useTranslation()

  return (
    <RoleResellerPaymentsPage
      eyebrow={t('managerParent.layout.eyebrow')}
      queryKeyPrefix="manager-parent"
      fetchList={managerParentService.getResellerPayments}
      detailPath={(lang, resellerId) => routePaths.managerParent.resellerPaymentDetail(lang, resellerId)}
    />
  )
}
