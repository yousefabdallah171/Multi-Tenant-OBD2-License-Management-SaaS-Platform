import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { availabilityService } from '@/services/availability.service'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { BlockBadge } from '@/components/shared/BlockBadge'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'

export function BiosChangeRequestPageForManager() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const customerId = Number(id)
  const [newBiosId, setNewBiosId] = useState('')
  const [biosCheckResult, setBiosCheckResult] = useState<{ available: boolean; is_blacklisted: boolean; message: string; linked_username: string | null } | null>(null)
  const debouncedNewBiosId = useDebounce(newBiosId.trim(), 400)

  useEffect(() => {
    if (debouncedNewBiosId.length < 3) {
      setBiosCheckResult(null)
      return
    }

    availabilityService.checkBios(debouncedNewBiosId).then(setBiosCheckResult)
  }, [debouncedNewBiosId])

  const query = useQuery({
    queryKey: ['manager', 'customer-detail', customerId],
    queryFn: () => managerService.getCustomer(customerId),
    enabled: Number.isFinite(customerId),
  })

  const customer = query.data?.data
  const customerUsername = resolveCustomerDetailUsername(customer)?.trim().toLowerCase() ?? ''
  const changeableLicense = customer?.licenses?.find((license) => license.status === 'active')
    ?? customer?.licenses?.find((license) => license.status === 'expired')
    ?? customer?.licenses?.find((license) => license.status === 'cancelled')
    ?? customer?.licenses?.[0]
    ?? null

  const directChangeMutation = useMutation({
    mutationFn: () => managerService.directChangeBiosId(changeableLicense?.id ?? 0, newBiosId.trim()),
    onSuccess: (response) => {
      toast.success(response.message ?? t('biosChangeRequests.directSuccess'))
      void queryClient.invalidateQueries({ queryKey: ['manager', 'customer-detail', customerId] })
      void queryClient.invalidateQueries({ queryKey: ['manager', 'customer-license-history', customerId] })
      void queryClient.invalidateQueries({ queryKey: ['manager', 'customer-bios-change-history', customerId] })
      void queryClient.invalidateQueries({ queryKey: ['manager', 'customers'] })
      navigate(routePaths.manager.customerDetail(lang, customerId))
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-start">
        <Button type="button" variant="outline" onClick={() => navigate(routePaths.manager.customerDetail(lang, customerId))}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>

      <PageHeader
        eyebrow={t('roles.manager')}
        title={t('biosChangeRequests.directAction', { defaultValue: 'Change BIOS ID' })}
        description={customer?.name ?? t('manager.pages.customers.customerDetails')}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('biosChangeRequests.directTitle', { defaultValue: 'Change BIOS ID Directly' })}</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('biosChangeRequests.directDescription', { defaultValue: 'This change is applied immediately without creating a request.' })}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {changeableLicense ? (
            <>
              <div className="space-y-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('biosChangeRequests.currentBios')}</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono font-medium">{changeableLicense.bios_id ?? '-'}</p>
                  {changeableLicense.is_blacklisted ? <BlockBadge /> : null}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-950 dark:text-white">{t('biosChangeRequests.newBiosPlaceholder')}</label>
                <Input
                  value={newBiosId}
                  maxLength={10}
                  onChange={(event) => {
                    setNewBiosId(event.target.value)
                    setBiosCheckResult(null)
                  }}
                  placeholder={t('biosChangeRequests.newBiosPlaceholder')}
                />
                {biosCheckResult ? (
                  <div className="space-y-1">
                    <p className={`text-sm ${biosCheckResult.is_blacklisted || !biosCheckResult.available ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {(biosCheckResult.is_blacklisted || !biosCheckResult.available ? 'x ' : 'ok ') + biosCheckResult.message}
                    </p>
                    {biosCheckResult.linked_username && biosCheckResult.linked_username.trim().toLowerCase() !== customerUsername ? (
                      <p className="text-sm text-rose-600">
                        {lang === 'ar'
                          ? `هذا الـ BIOS مرتبط باسم المستخدم ${biosCheckResult.linked_username} وليس بهذا العميل.`
                          : `This BIOS ID is linked to username "${biosCheckResult.linked_username}" and not this customer.`}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => navigate(routePaths.manager.customerDetail(lang, customerId))}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  disabled={directChangeMutation.isPending}
                  onClick={() => {
                    if (!changeableLicense) {
                      toast.error(t('common.error'))
                      return
                    }
                    if (newBiosId.trim().length < 3 || newBiosId.trim().length > 10) {
                      toast.error(t('biosChangeRequests.newBiosValidation'))
                      return
                    }
                    if ((changeableLicense.bios_id ?? '').trim().toLowerCase() === newBiosId.trim().toLowerCase()) {
                      toast.error(t('biosChangeRequests.sameBiosValidation'))
                      return
                    }
                    if (biosCheckResult?.is_blacklisted) {
                      toast.error(t('customers.biosBlacklisted'))
                      return
                    }
                    if (
                      biosCheckResult?.linked_username
                      && biosCheckResult.linked_username.trim().toLowerCase() !== customerUsername
                    ) {
                      toast.error(
                        lang === 'ar'
                          ? `هذا الـ BIOS مرتبط باسم المستخدم ${biosCheckResult.linked_username} وليس بهذا العميل.`
                          : `This BIOS ID is linked to username "${biosCheckResult.linked_username}" and not this customer.`,
                      )
                      return
                    }
                    if (biosCheckResult !== null && !biosCheckResult.available) {
                      toast.error(biosCheckResult.message || t('common.error'))
                      return
                    }

                    directChangeMutation.mutate()
                  }}
                >
                  {t('biosChangeRequests.applyChange', { defaultValue: 'Apply Change' })}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-rose-600">{t('biosChangeRequests.noLicense', { defaultValue: 'No license found for this customer.' })}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function resolveCustomerDetailUsername(customer: { external_username?: string | null; username?: string | null; licenses?: Array<{ external_username?: string | null }> } | undefined) {
  return customer?.licenses?.find((license) => license.external_username)?.external_username || customer?.external_username || customer?.username || null
}
