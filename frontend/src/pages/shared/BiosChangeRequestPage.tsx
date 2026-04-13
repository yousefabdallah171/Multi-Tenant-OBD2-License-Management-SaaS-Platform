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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/hooks/useLanguage'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { liveQueryOptions, LIVE_QUERY_INTERVAL } from '@/lib/live-query'
import type { SupportedLanguage } from '@/hooks/useLanguage'

interface BiosChangeRequestPageProps {
  eyebrow: string
  backPath: (lang: SupportedLanguage) => string
  getCustomer: (id: number) => Promise<{ data: { name?: string | null; external_username?: string | null; username?: string | null; licenses?: Array<{ id: number; bios_id?: string | null; status: string; is_blacklisted?: boolean }> } }>
  submitRequest: (payload: { license_id: number; new_bios_id: string; reason?: string }) => Promise<{ message?: string }>
  queryKey: string
}

export function BiosChangeRequestPage({ eyebrow, backPath, getCustomer, submitRequest, queryKey }: BiosChangeRequestPageProps) {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const customerId = Number(id)

  const [newBiosId, setNewBiosId] = useState('')
  const [requestReason, setRequestReason] = useState('')
  const [biosCheckResult, setBiosCheckResult] = useState<{ available: boolean; is_blacklisted: boolean; message: string; linked_username?: string | null } | null>(null)
  const debouncedNewBiosId = useDebounce(newBiosId.trim(), 400)

  const query = useQuery({
    queryKey: [queryKey, 'customer-detail', customerId],
    queryFn: () => getCustomer(customerId),
    enabled: Number.isFinite(customerId),
    ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_DETAIL),
  })

  const customer = query.data?.data
  const requestableLicense = customer?.licenses?.find((l) => l.status === 'active')
    ?? customer?.licenses?.find((l) => l.status === 'expired')
    ?? customer?.licenses?.find((l) => l.status === 'cancelled')
    ?? customer?.licenses?.[0]
    ?? null

  useEffect(() => {
    if (debouncedNewBiosId.length < 3) {
      setBiosCheckResult(null)
      return
    }
    availabilityService.checkBios(debouncedNewBiosId).then(setBiosCheckResult)
  }, [debouncedNewBiosId])

  const submitMutation = useMutation({
    mutationFn: () => submitRequest({
      license_id: requestableLicense?.id ?? 0,
      new_bios_id: newBiosId.trim(),
      reason: requestReason.trim() || undefined,
    }),
    onSuccess: (response) => {
      toast.success(response.message ?? t('biosChangeRequests.submitted'))
      void queryClient.invalidateQueries({ queryKey: [queryKey, 'customer-detail', customerId] })
      navigate(backPath(lang))
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  const customerUsername = (customer?.external_username || customer?.username || '').trim().toLowerCase()
  const linkedUsername = (biosCheckResult?.linked_username ?? '').trim().toLowerCase()
  const usernameMismatch = linkedUsername !== '' && customerUsername !== '' && linkedUsername !== customerUsername

  const isSavDisabled = (() => {
    if (submitMutation.isPending) return true
    if (newBiosId.trim().length < 5) return true
    if (newBiosId.trim().length >= 5 && biosCheckResult === null) return true
    if (biosCheckResult?.is_blacklisted) return true
    if (biosCheckResult !== null && !biosCheckResult.available) return true
    if (usernameMismatch) return true
    return false
  })()

  const handleSubmit = () => {
    if (!requestableLicense) { toast.error(t('common.error')); return }
    if (newBiosId.trim().length < 5) { toast.error(t('biosChangeRequests.newBiosValidation')); return }
    if ((requestableLicense.bios_id ?? '').trim().toLowerCase() === newBiosId.trim().toLowerCase()) {
      toast.error(t('biosChangeRequests.sameBiosValidation'))
      return
    }
    submitMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-start">
        <Button type="button" variant="outline" onClick={() => navigate(backPath(lang))}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>

      <PageHeader
        eyebrow={eyebrow}
        title={t('biosChangeRequests.requestAction')}
        description={customer?.name ?? ''}
      />

      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>{t('biosChangeRequests.requestAction')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {query.isLoading ? (
            <p className="text-sm text-slate-500">{t('common.loading', { defaultValue: 'Loading…' })}</p>
          ) : !requestableLicense ? (
            <p className="text-sm text-rose-600">{t('biosChangeRequests.noLicense', { defaultValue: 'No license found for this customer.' })}</p>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('biosChangeRequests.currentBios')}</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{requestableLicense.bios_id ?? '-'}</p>
                  {requestableLicense.is_blacklisted ? <BlockBadge /> : null}
                </div>
              </div>

              <div className="space-y-1">
                <Label>{t('biosChangeRequests.newBiosPlaceholder')}</Label>
                <Input
                  value={newBiosId}
                  onChange={(event) => { setNewBiosId(event.target.value); setBiosCheckResult(null) }}
                  placeholder={t('biosChangeRequests.newBiosPlaceholder')}
                  
                />
                {biosCheckResult && (
                  <p className={`text-sm ${biosCheckResult.is_blacklisted || !biosCheckResult.available || usernameMismatch ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {biosCheckResult.is_blacklisted || !biosCheckResult.available || usernameMismatch ? '✗ ' : '✓ '}
                    {usernameMismatch
                      ? `This BIOS ID is linked to username "${biosCheckResult.linked_username}" — not this customer`
                      : biosCheckResult.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label>{t('biosChangeRequests.reasonPlaceholder')}</Label>
                <Textarea
                  value={requestReason}
                  onChange={(event) => setRequestReason(event.target.value)}
                  placeholder={t('biosChangeRequests.reasonPlaceholder')}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => navigate(backPath(lang))}>
                  {t('common.cancel')}
                </Button>
                <Button type="button" disabled={isSavDisabled} onClick={handleSubmit}>
                  {submitMutation.isPending ? t('common.saving', { defaultValue: 'Saving…' }) : t('common.save')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
