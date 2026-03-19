import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CheckCircle, Clock, Lock, XCircle } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { availabilityService } from '@/services/availability.service'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BlockBadge } from '@/components/shared/BlockBadge'
import { LicenseStatusBadges } from '@/components/shared/LicenseStatusBadges'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/hooks/useLanguage'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { liveQueryOptions, LIVE_QUERY_INTERVAL } from '@/lib/live-query'
import { formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { resellerService } from '@/services/reseller.service'

export function CustomerDetailPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const queryClient = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const customerId = Number(id)
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const biosParamConsumedRef = useRef(false)
  // Capture the param value at mount time so the effect doesn't re-fire when searchParams changes
  const initialBiosParamRef = useRef(searchParams.get('request-bios') === '1')
  const [newBiosId, setNewBiosId] = useState('')
  const [requestReason, setRequestReason] = useState('')
  const [biosCheckResult, setBiosCheckResult] = useState<{ available: boolean; is_blacklisted: boolean; message: string } | null>(null)
  const debouncedNewBiosId = useDebounce(newBiosId.trim(), 400)

  useEffect(() => {
    if (debouncedNewBiosId.length < 3) {
      setBiosCheckResult(null)
      return
    }
    availabilityService.checkBios(debouncedNewBiosId).then(setBiosCheckResult)
  }, [debouncedNewBiosId])

  const query = useQuery({
    queryKey: ['reseller', 'customer-detail', customerId],
    queryFn: () => resellerService.getCustomer(customerId),
    enabled: Number.isFinite(customerId),
    ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_DETAIL),
  })

  const biosHistoryQuery = useQuery({
    queryKey: ['reseller', 'customer-bios-history', customerId],
    queryFn: () => resellerService.getCustomerBiosChangeHistory(customerId),
    enabled: Number.isFinite(customerId),
  })

  const customer = query.data?.data
  // Pick the most relevant license: prefer active, then expired, then cancelled, then any
  const requestableLicense = customer?.licenses?.find((l) => l.status === 'active')
    ?? customer?.licenses?.find((l) => l.status === 'expired')
    ?? customer?.licenses?.find((l) => l.status === 'cancelled')
    ?? customer?.licenses?.[0]
    ?? null

  useEffect(() => {
    if (biosParamConsumedRef.current || !initialBiosParamRef.current || !requestableLicense) {
      return
    }
    biosParamConsumedRef.current = true
    setRequestDialogOpen(true)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('request-bios')
      return next
    }, { replace: true })
  }, [requestableLicense, setSearchParams])

  const submitRequestMutation = useMutation({
    mutationFn: () => resellerService.submitBiosChangeRequest({
      license_id: requestableLicense?.id ?? 0,
      new_bios_id: newBiosId.trim(),
      reason: requestReason.trim() || undefined,
    }),
    onSuccess: (response) => {
      toast.success(response.message ?? t('biosChangeRequests.submitted'))
      setRequestDialogOpen(false)
      setNewBiosId('')
      setRequestReason('')
      setBiosCheckResult(null)
      void queryClient.invalidateQueries({ queryKey: ['reseller', 'customer-detail', customerId] })
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-start">
        <Button type="button" variant="outline" onClick={() => navigate(routePaths.reseller.customers(lang))}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>
      <PageHeader
        eyebrow={t('roles.reseller')}
        title={customer?.name ?? t('reseller.pages.customers.title')}
        description={resolveCustomerDetailUsername(customer) ?? customer?.phone ?? t('reseller.pages.customers.description')}
        actions={requestableLicense && !requestableLicense.is_blacklisted && !customer?.bios_active_elsewhere ? (
          <Button type="button" onClick={() => setRequestDialogOpen(true)}>
            {t('biosChangeRequests.requestAction')}
          </Button>
        ) : null}
      />

      {customer ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('common.customer')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Info label={t('common.name')} value={customer.name} />
              <Info label={t('common.email')} value={customer.email ?? '-'} />
              <Info label={t('common.phone')} value={customer.phone ?? '-'} />
              <Info
                label={t('common.username')}
                value={resolveCustomerDetailUsername(customer) ?? '-'}
                isLocked={customer.username_locked}
                lockTooltip={t('activate.biosLockedHint')}
              />
              <Info
                label={t('reseller.pages.customers.table.bios')}
                value={customer.bios_id ?? '-'}
                isLocked={customer.username_locked}
                lockTooltip={t('activate.biosLockedHint')}
              />
              <Info
                label={t('common.status')}
                value={<LicenseStatusBadges status={customer.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending' | 'cancelled'} isBlocked={Boolean(customer.is_blacklisted)} />}
              />
              <Info label={t('common.program')} value={customer.program ?? '-'} />
              <Info label={t('common.price')} value={formatCurrency(customer.price, 'USD', locale)} />
              <Info label={t('common.expiry')} value={customer.expiry ? formatDate(customer.expiry, locale) : '-'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('reseller.pages.customers.detail.activationHistory')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(customer.licenses ?? []).map((license) => (
                <div key={license.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="grid gap-4 md:grid-cols-5">
                    <Info label={t('common.program')} value={license.program ?? '-'} />
                    <Info label={t('reseller.pages.customers.detail.bios')} value={license.bios_id} />
                    <Info label={t('common.username')} value={resolveLicenseUsername(customer) ?? '-'} />
                    <Info
                      label={t('common.status')}
                      value={<LicenseStatusBadges status={license.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending' | 'cancelled'} isBlocked={Boolean(license.is_blacklisted)} />}
                    />
                    <Info label={t('common.price')} value={formatCurrency(license.price, 'USD', locale)} />
                    <Info label={t('common.expiry')} value={license.expires_at ? formatDate(license.expires_at, locale) : '-'} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {(biosHistoryQuery.data?.data?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('biosChangeRequests.history')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {biosHistoryQuery.data?.data.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="font-mono text-slate-500 dark:text-slate-400">{item.old_bios_id}</span>
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                        <span className="font-mono">{item.new_bios_id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === 'approved' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                        {item.status === 'pending' && <Clock className="h-4 w-4 text-amber-500" />}
                        {item.status === 'rejected' && <XCircle className="h-4 w-4 text-rose-500" />}
                        <span className={`text-xs font-semibold uppercase tracking-wide ${
                          item.status === 'approved' ? 'text-emerald-600' :
                          item.status === 'pending' ? 'text-amber-600' : 'text-rose-600'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                      {item.reason && <span>{t('biosChangeRequests.reason')}: {item.reason}</span>}
                      {item.reviewer_notes && <span>{t('biosChangeRequests.reviewerNotes')}: {item.reviewer_notes}</span>}
                      <span>{formatDate(item.created_at ?? '', locale)}</span>
                      {item.reviewed_at && <span>{t('biosChangeRequests.reviewedAt')}: {formatDate(item.reviewed_at, locale)}</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('biosChangeRequests.requestAction')}</DialogTitle>
            <DialogDescription>
              {requestableLicense?.bios_id ?? t('biosChangeRequests.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('biosChangeRequests.currentBios')}</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">{requestableLicense?.bios_id ?? '-'}</p>
                {requestableLicense?.is_blacklisted ? <BlockBadge /> : null}
              </div>
            </div>
            <div className="space-y-1">
              <Input
                value={newBiosId}
                onChange={(event) => { setNewBiosId(event.target.value); setBiosCheckResult(null) }}
                placeholder={t('biosChangeRequests.newBiosPlaceholder')}
              />
              {biosCheckResult && (
                <p className={`text-xs ${biosCheckResult.is_blacklisted || !biosCheckResult.available ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {biosCheckResult.is_blacklisted || !biosCheckResult.available ? '✗ ' : '✓ '}{biosCheckResult.message}
                </p>
              )}
            </div>
            <Textarea
              value={requestReason}
              onChange={(event) => setRequestReason(event.target.value)}
              placeholder={t('biosChangeRequests.reasonPlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRequestDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={submitRequestMutation.isPending}
              onClick={() => {
                if (!requestableLicense) {
                  toast.error(t('common.error'))
                  return
                }

                if (newBiosId.trim().length < 5) {
                  toast.error(t('biosChangeRequests.newBiosValidation'))
                  return
                }

                if ((requestableLicense.bios_id ?? '').trim().toLowerCase() === newBiosId.trim().toLowerCase()) {
                  toast.error(t('biosChangeRequests.sameBiosValidation'))
                  return
                }

                if (biosCheckResult?.is_blacklisted) {
                  toast.error(t('customers.biosBlacklisted'))
                  return
                }

                if (biosCheckResult !== null && !biosCheckResult.available) {
                  toast.error(biosCheckResult.message || t('common.error'))
                  return
                }

                submitRequestMutation.mutate()
              }}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function resolveCustomerDetailUsername(customer: { external_username?: string | null; username?: string | null } | undefined) {
  return customer?.external_username || customer?.username || null
}

function resolveLicenseUsername(customer: { name?: string | null; client_name?: string | null; external_username?: string | null; username?: string | null } | undefined) {
  const candidate = customer?.external_username?.trim()
  const storedUsername = customer?.username?.trim()

  if (candidate && candidate !== customer?.name && candidate !== customer?.client_name) {
    return candidate
  }

  return storedUsername || candidate || null
}

function Info({
  label,
  value,
  isLocked,
  lockTooltip,
}: {
  label: string
  value: React.ReactNode
  isLocked?: boolean
  lockTooltip?: string
}) {
  return (
    <div
      className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40"
      title={isLocked ? lockTooltip : undefined}
    >
      <div className="flex items-center gap-1">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        {isLocked && <Lock className="h-3 w-3 text-amber-600" />}
      </div>
      <div className={`mt-1 whitespace-pre-line font-medium ${isLocked ? 'text-slate-400 dark:text-slate-600' : ''}`}>
        {value}
      </div>
    </div>
  )
}
