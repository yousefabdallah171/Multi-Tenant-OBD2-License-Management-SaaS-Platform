import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CheckCircle, Clock, Lock, XCircle } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { availabilityService } from '@/services/availability.service'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BlockBadge } from '@/components/shared/BlockBadge'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { LicenseStatusBadges } from '@/components/shared/LicenseStatusBadges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/hooks/useLanguage'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { liveQueryOptions, LIVE_QUERY_INTERVAL } from '@/lib/live-query'
import { formatActivityActionLabel, formatDate, formatReadableActivityDescription } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'
import type { LicenseHistoryEntry } from '@/types/manager-reseller.types'
import { IpLocationCell } from '@/utils/countryFlag'

export function CustomerDetailPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const queryClient = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const customerId = Number(id)
  const [searchParams, setSearchParams] = useSearchParams()
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const biosParamConsumedRef = useRef(false)
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
    queryKey: ['manager', 'customer-detail', customerId],
    queryFn: () => managerService.getCustomer(customerId),
    enabled: Number.isFinite(customerId),
    ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_DETAIL),
  })

  const licenseHistoryQuery = useQuery({
    queryKey: ['manager', 'customer-license-history', customerId],
    queryFn: () => managerService.getCustomerLicenseHistory(customerId),
    enabled: Number.isFinite(customerId),
  })

  const biosHistoryQuery = useQuery({
    queryKey: ['manager', 'customer-bios-change-history', customerId],
    queryFn: () => managerService.getCustomerBiosChangeHistory(customerId),
    enabled: Number.isFinite(customerId),
  })

  const customer = query.data?.data
  const licenseHistoryGroups = groupLicenseHistoryByReseller(licenseHistoryQuery.data?.data ?? [])

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
    mutationFn: () => managerService.submitBiosChangeRequest({
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
      void queryClient.invalidateQueries({ queryKey: ['manager', 'customer-detail', customerId] })
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-start">
        <Button type="button" variant="outline" onClick={() => navigate(routePaths.manager.customers(lang))}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>
      <PageHeader
        eyebrow={t('manager.layout.eyebrow')}
        title={customer?.name ?? t('manager.pages.customers.customerDetails')}
        description={resolveCustomerDetailUsername(customer) ?? t('manager.pages.customers.customerDetailsDescription')}
        actions={requestableLicense && !requestableLicense.is_blacklisted ? (
          <Button type="button" onClick={() => setRequestDialogOpen(true)}>
            {t('biosChangeRequests.requestAction')}
          </Button>
        ) : null}
      />

      {customer ? (
        <>
          <Card>
            <CardHeader><CardTitle>{t('manager.pages.customers.customerDetails')}</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Info label={t('common.name')} value={customer.name} />
              <Info label={t('common.email')} value={customer.email} />
              <Info
                label={t('common.username')}
                value={resolveCustomerDetailUsername(customer) ?? '-'}
                isLocked={customer.username_locked}
                lockTooltip={t('activate.biosLockedHint')}
              />
              <Info label={t('common.phone')} value={customer.phone ?? '-'} />
              <Info label={t('common.status')} value={customer.status ? <LicenseStatusBadges status={customer.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending' | 'cancelled'} isBlocked={Boolean(customer.is_blacklisted)} /> : '-'} />
              <Info label={t('common.createdAt')} value={customer.created_at ? formatDate(customer.created_at, locale) : '-'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('manager.pages.customers.licenseHistory')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {licenseHistoryGroups.map((group) => (
                <details key={group.key} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800" open>
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{t('customerDetail.resellerTimeline')}: {group.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {group.items.length} {t('common.activations')} | {group.period}
                        </p>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{group.email}</p>
                    </div>
                  </summary>
                  <div className="mt-4 space-y-3">
                    {group.items.map((license) => (
                      <div key={license.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/40">
                        <div className="grid gap-3 md:grid-cols-5">
                          <Info label={t('common.program')} value={license.program_name ?? '-'} />
                          <Info label={t('customerDetail.soldBy')} value={group.name} />
                          <Info label={t('customerDetail.period')} value={formatLicensePeriod(license, locale)} />
                          <Info label={t('common.price')} value={`$${Number(license.price).toFixed(2)}`} />
                          <Info label={t('common.status')} value={<LicenseStatusBadges status={license.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending' | 'cancelled'} isBlocked={Boolean(license.is_blacklisted)} />} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                          <span>{t('manager.pages.customers.biosId')}: <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.manager.biosDetail(lang, license.bios_id)}>{license.bios_id}</Link></span>
                          <span>{t('common.username')}: {resolveLicenseUsername(customer, license.external_username) ?? '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('common.reseller')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(customer.resellers_summary ?? []).map((reseller) => (
                <div key={`${reseller.reseller_id}-${reseller.reseller_email}`} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                  <p className="font-medium">{reseller.reseller_name ?? '-'}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{reseller.reseller_email ?? '-'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{reseller.activations_count} activations</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('managerParent.pages.ipAnalytics.title')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(customer.ip_logs ?? []).length === 0 ? (
                <EmptyState title={t('common.noData')} description={t('common.adjustFilters')} />
              ) : (
                (customer.ip_logs ?? []).map((log) => (
                  <div key={log.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                    <p className="font-medium">{log.ip_address}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400"><IpLocationCell country={log.country ?? 'Unknown'} city={log.city ?? ''} countryCode={log.country_code ?? ''} /></p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{log.created_at ? formatDate(log.created_at, locale) : '-'}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('manager.nav.activity')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(customer.activity ?? []).length === 0 ? (
                <EmptyState title={t('common.noData')} description={t('manager.pages.activity.noMatches')} />
              ) : (
                (customer.activity ?? []).map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                    <p className="font-medium">{formatActivityActionLabel(entry.action, t)}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{formatReadableActivityDescription(entry.description, locale)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</p>
                  </div>
                ))
              )}
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
                        <span className={`text-xs font-semibold uppercase tracking-wide ${item.status === 'approved' ? 'text-emerald-600' : item.status === 'pending' ? 'text-amber-600' : 'text-rose-600'}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                      {item.reason && <span>{t('biosChangeRequests.reason')}: {item.reason}</span>}
                      {item.requested_by && <span>{t('common.reseller')}: {item.requested_by}</span>}
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
              disabled={
                submitRequestMutation.isPending ||
                newBiosId.trim().length < 5 ||
                Boolean(biosCheckResult?.is_blacklisted) ||
                (biosCheckResult !== null && !biosCheckResult.available) ||
                (newBiosId.trim().length >= 5 && biosCheckResult === null)
              }
              onClick={() => {
                if (!requestableLicense) { toast.error(t('common.error')); return }
                if (newBiosId.trim().length < 5) { toast.error(t('biosChangeRequests.newBiosValidation')); return }
                if ((requestableLicense.bios_id ?? '').trim().toLowerCase() === newBiosId.trim().toLowerCase()) {
                  toast.error(t('biosChangeRequests.sameBiosValidation')); return
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

function resolveCustomerDetailUsername(customer: { external_username?: string | null; username?: string | null; licenses?: Array<{ external_username?: string | null }> } | undefined) {
  return customer?.licenses?.find((license) => license.external_username)?.external_username || customer?.external_username || customer?.username || null
}

function resolveLicenseUsername(customer: { name?: string | null; client_name?: string | null; username?: string | null }, externalUsername?: string | null) {
  const candidate = externalUsername?.trim()
  const storedUsername = customer.username?.trim()

  if (candidate && candidate !== customer.name && candidate !== customer.client_name) {
    return candidate
  }

  return storedUsername || candidate || null
}

function groupLicenseHistoryByReseller(entries: LicenseHistoryEntry[]) {
  const groups = new Map<string, { key: string; name: string; email: string; items: LicenseHistoryEntry[] }>()

  for (const entry of entries) {
    const key = String(entry.reseller_id ?? `unknown-${entry.reseller_name ?? 'unknown'}`)
    const existing = groups.get(key)
    if (existing) {
      existing.items.push(entry)
      continue
    }

    groups.set(key, {
      key,
      name: entry.reseller_name ?? 'Unknown',
      email: entry.reseller_email ?? '-',
      items: [entry],
    })
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    period: formatGroupPeriod(group.items),
  }))
}

function formatGroupPeriod(entries: LicenseHistoryEntry[]) {
  const timestamps = entries
    .map((entry) => entry.activated_at)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right)

  if (timestamps.length === 0) {
    return '-'
  }

  return `${new Date(timestamps[0]).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${new Date(timestamps[timestamps.length - 1]).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
}

function formatLicensePeriod(entry: LicenseHistoryEntry, locale: string) {
  const start = entry.start_at ? formatDate(entry.start_at, locale) : '-'
  const end = entry.expires_at ? formatDate(entry.expires_at, locale) : '-'
  return `${start} -> ${end}`
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
