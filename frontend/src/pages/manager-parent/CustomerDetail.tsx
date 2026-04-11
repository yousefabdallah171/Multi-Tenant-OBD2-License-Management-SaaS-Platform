import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Lock, FileText } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { availabilityService } from '@/services/availability.service'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BlockBadge } from '@/components/shared/BlockBadge'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { CustomerNoteDialog } from '@/components/customers/CustomerNoteDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { LicenseStatusBadges } from '@/components/shared/LicenseStatusBadges'
import { RoleIdentity } from '@/components/shared/RoleIdentity'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { liveQueryOptions, LIVE_QUERY_INTERVAL } from '@/lib/live-query'
import { formatActivityActionLabel, formatDate, formatReadableActivityDescription } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { customerService } from '@/services/customer.service'
import { managerParentService } from '@/services/manager-parent.service'
import type { CustomerLicenseHistoryEntry } from '@/types/manager-parent.types'
import type { UserRole } from '@/types/user.types'
import { IpLocationCell } from '@/utils/countryFlag'

export function CustomerDetailPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const queryClient = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const customerId = Number(id)
  const [changeDialogOpen, setChangeDialogOpen] = useState(false)
  const [newBiosId, setNewBiosId] = useState('')
  const [biosCheckResult, setBiosCheckResult] = useState<{ available: boolean; is_blacklisted: boolean; message: string; linked_username: string | null } | null>(null)
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false)
  const debouncedNewBiosId = useDebounce(newBiosId.trim(), 400)

  useEffect(() => {
    if (debouncedNewBiosId.length < 3) {
      setBiosCheckResult(null)
      return
    }

    availabilityService.checkBios(debouncedNewBiosId).then(setBiosCheckResult)
  }, [debouncedNewBiosId])

  const query = useQuery({
    queryKey: ['manager-parent', 'customer-detail', customerId],
    queryFn: () => customerService.getOne(customerId),
    enabled: Number.isFinite(customerId),
    ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_DETAIL),
  })

  const licenseHistoryQuery = useQuery({
    queryKey: ['manager-parent', 'customer-license-history', customerId],
    queryFn: () => managerParentService.getCustomerLicenseHistory(customerId),
    enabled: Number.isFinite(customerId),
  })

  const customer = query.data?.data
  const licenseHistoryGroups = groupCustomerLicenseHistoryByReseller(licenseHistoryQuery.data?.data ?? [])
  const customerUsername = resolveCustomerDetailUsername(customer)?.trim().toLowerCase() ?? ''

  const requestableLicense = customer?.licenses?.find((l: { status: string }) => l.status === 'active')
    ?? customer?.licenses?.find((l: { status: string }) => l.status === 'expired')
    ?? customer?.licenses?.find((l: { status: string }) => l.status === 'cancelled')
    ?? customer?.licenses?.[0]
    ?? null

  const directChangeMutation = useMutation({
    mutationFn: () => managerParentService.directChangeBiosId(
      (requestableLicense as { id: number } | null)?.id ?? 0,
      newBiosId.trim(),
    ),
    onSuccess: (response) => {
      toast.success(response.message ?? t('biosChangeRequests.directSuccess'))
      setChangeDialogOpen(false)
      setNewBiosId('')
      setBiosCheckResult(null)
      if (searchParams.get('change_bios') === '1') {
        searchParams.delete('change_bios')
        setSearchParams(searchParams, { replace: true })
      }
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'customer-detail', customerId] })
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  useEffect(() => {
    if (searchParams.get('change_bios') === '1' && requestableLicense) {
      setChangeDialogOpen(true)
    }
  }, [requestableLicense, searchParams])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-start">
        <Button type="button" variant="outline" onClick={() => navigate(routePaths.managerParent.customers(lang))}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>

      <PageHeader
        title={customer?.name ?? t('managerParent.pages.customers.customerDetails')}
        description={resolveCustomerDetailUsername(customer) ?? t('managerParent.pages.customers.customerDetailsDescription')}
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setIsNotesDialogOpen(true)}>
              <FileText className="me-2 h-4 w-4" />
              {t('common.notes', { defaultValue: 'Notes' })}
            </Button>
            {requestableLicense ? (
              <Button type="button" onClick={() => setChangeDialogOpen(true)}>
                {t('biosChangeRequests.directAction', { defaultValue: 'Change BIOS ID' })}
              </Button>
            ) : null}
          </div>
        }
      />

      {customer ? (
        <>
          <Card>
            <CardHeader><CardTitle>{t('managerParent.pages.customers.customerDetails')}</CardTitle></CardHeader>
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

          <Tabs defaultValue="licenses" className="space-y-4">
            <TabsList>
              <TabsTrigger value="licenses">{t('managerParent.pages.customers.licenseHistory')}</TabsTrigger>
              <TabsTrigger value="bios">{t('managerParent.pages.customers.biosId')}</TabsTrigger>
              <TabsTrigger value="ips">{t('managerParent.pages.ipAnalytics.title')}</TabsTrigger>
              <TabsTrigger value="activity">{t('managerParent.nav.activity')}</TabsTrigger>
            </TabsList>

            <TabsContent value="licenses">
              <Card>
                <CardHeader><CardTitle>{t('managerParent.pages.customers.licenseHistory')}</CardTitle></CardHeader>
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
                              <Info
                                label={t('customerDetail.soldBy')}
                                value={(
                                  <RoleIdentity
                                    name={group.name}
                                    role={resolveUserRole(group.role)}
                                    href={group.id ? routePaths.managerParent.teamMemberDetail(lang, group.id) : undefined}
                                  />
                                )}
                              />
                              <Info label={t('customerDetail.period')} value={formatCustomerLicensePeriod(license, locale)} />
                              <Info label={t('common.price')} value={`$${Number(license.price).toFixed(2)}`} />
                              <Info label={t('common.status')} value={<LicenseStatusBadges status={license.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending' | 'cancelled'} isBlocked={Boolean(license.is_blacklisted)} />} />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                              <span>{t('managerParent.pages.customers.biosId')}: <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.biosDetail(lang, license.bios_id)}>{license.bios_id}</Link></span>
                              <span>{t('common.username')}: {resolveLicenseUsername(customer, license.external_username) ?? '-'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bios">
              <Card>
                <CardContent className="space-y-2 p-4">
                  {(customer.licenses ?? []).map((license) => (
                    <Link key={`bios-${license.id}`} className="block rounded-xl border border-slate-200 p-3 text-sky-600 hover:underline dark:border-slate-700" to={routePaths.managerParent.biosDetail(lang, license.bios_id)}>
                      {license.bios_id}
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ips">
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
                        <p className="text-sm text-slate-500 dark:text-slate-400">{log.created_at ? formatDate(log.created_at, locale) : '-'}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity">
              <Card>
                <CardHeader><CardTitle>{t('managerParent.nav.activity')}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(customer.activity ?? []).length === 0 ? (
                    <EmptyState title={t('common.noData')} description={t('managerParent.pages.activity.noMatches')} />
                  ) : (
                    (customer.activity ?? []).map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium">{formatActivityActionLabel(entry.action, t)}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{formatReadableActivityDescription(entry.description, locale)}</p>
                          </div>
                          <div className="text-start">
                            <p className="text-sm text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <Dialog open={changeDialogOpen} onOpenChange={(open) => {
        setChangeDialogOpen(open)
        if (!open) {
          setNewBiosId('')
          setBiosCheckResult(null)
          if (searchParams.get('change_bios') === '1') {
            searchParams.delete('change_bios')
            setSearchParams(searchParams, { replace: true })
          }
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('biosChangeRequests.directTitle', { defaultValue: 'Change BIOS ID Directly' })}</DialogTitle>
            <DialogDescription>
              {t('biosChangeRequests.directDescription', { defaultValue: 'This change is applied immediately without creating a request.' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('biosChangeRequests.currentBios')}</p>
              <div className="flex items-center gap-2">
                <p className="font-medium font-mono">{(requestableLicense as { bios_id?: string } | null)?.bios_id ?? '-'}</p>
                {(requestableLicense as { is_blacklisted?: boolean } | null)?.is_blacklisted ? <BlockBadge /> : null}
              </div>
            </div>
            <div className="space-y-1">
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
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setChangeDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={directChangeMutation.isPending}
              onClick={() => {
                const license = requestableLicense as { id: number; bios_id?: string } | null
                if (!license) {
                  toast.error(t('common.error'))
                  return
                }
                if (newBiosId.trim().length < 3 || newBiosId.trim().length > 10) {
                  toast.error(t('biosChangeRequests.newBiosValidation'))
                  return
                }
                if ((license.bios_id ?? '').trim().toLowerCase() === newBiosId.trim().toLowerCase()) {
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerNoteDialog isOpen={isNotesDialogOpen} onClose={() => setIsNotesDialogOpen(false)} customerId={customerId} />
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

function resolveUserRole(role?: string | null): UserRole | null {
  if (role === 'super_admin' || role === 'manager_parent' || role === 'manager' || role === 'reseller' || role === 'customer') {
    return role
  }

  return null
}

function groupCustomerLicenseHistoryByReseller(entries: CustomerLicenseHistoryEntry[]) {
  const groups = new Map<string, { key: string; id: number | null; name: string; email: string; role: string | null; items: CustomerLicenseHistoryEntry[] }>()

  for (const entry of entries) {
    const key = String(entry.reseller_id ?? `unknown-${entry.reseller_name ?? 'unknown'}`)
    const existing = groups.get(key)
    if (existing) {
      existing.items.push(entry)
      continue
    }

    groups.set(key, {
      key,
      id: entry.reseller_id ?? null,
      name: entry.reseller_name ?? 'Unknown',
      email: entry.reseller_email ?? '-',
      role: entry.reseller_role ?? null,
      items: [entry],
    })
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    period: formatCustomerGroupPeriod(group.items),
  }))
}

function formatCustomerGroupPeriod(entries: CustomerLicenseHistoryEntry[]) {
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

function formatCustomerLicensePeriod(entry: CustomerLicenseHistoryEntry, locale: string) {
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
        <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        {isLocked && <Lock className="h-3 w-3 text-amber-600" />}
      </div>
      <div className={`mt-1 whitespace-pre-line font-medium ${isLocked ? 'text-slate-400 dark:text-slate-600' : ''}`}>
        {value}
      </div>
    </div>
  )
}
