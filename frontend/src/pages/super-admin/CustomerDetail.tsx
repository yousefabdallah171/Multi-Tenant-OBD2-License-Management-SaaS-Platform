import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileText, Lock, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CustomerNoteDialog } from '@/components/customers/CustomerNoteDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { LicenseStatusBadges } from '@/components/shared/LicenseStatusBadges'
import { RoleIdentity } from '@/components/shared/RoleIdentity'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { useLanguage } from '@/hooks/useLanguage'
import { liveQueryOptions, LIVE_QUERY_INTERVAL } from '@/lib/live-query'
import { formatActivityActionLabel, formatDate, formatReadableActivityDescription } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { superAdminCustomerService } from '@/services/super-admin-customer.service'
import type { SuperAdminCustomerDetails } from '@/types/super-admin.types'
import type { UserRole } from '@/types/user.types'
import { IpLocationCell } from '@/utils/countryFlag'
import { formatUsername } from '@/utils/biosId'

export function CustomerDetailPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const { id } = useParams<{ id: string }>()
  const customerId = Number(id)
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false)
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [renameReason, setRenameReason] = useState('')

  const query = useQuery({
    queryKey: ['super-admin', 'customer-detail', customerId],
    queryFn: () => superAdminCustomerService.getOne(customerId),
    enabled: Number.isFinite(customerId),
    ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_DETAIL),
  })

  const customer = query.data?.data
  const groupedLicenses = groupLicensesByReseller(customer)

  useEffect(() => {
    if (!customer) {
      return
    }

    if (searchParams.get('action') !== 'change-username') {
      return
    }

    setUsernameDraft((resolveCustomerDetailUsername(customer) ?? '').toLowerCase())
    setIsRenameDialogOpen(true)
  }, [customer, searchParams, setSearchParams])

  const handleRenameDialogOpenChange = (open: boolean) => {
    setIsRenameDialogOpen(open)

    if (open) {
      return
    }

    if (searchParams.get('action') !== 'change-username') {
      return
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('action')
    setSearchParams(nextParams, { replace: true })
  }

  const renameMutation = useMutation({
    mutationFn: (payload: { username: string; reason?: string }) => superAdminCustomerService.renameUsername(customerId, payload),
    onSuccess: (result) => {
      toast.success(result.message || t('common.saved', { defaultValue: 'Saved' }))
      handleRenameDialogOpenChange(false)
      setRenameReason('')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'customer-detail', customerId] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'customers'] })
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={() => navigate(routePaths.superAdmin.customers(lang))}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('common.back')}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setUsernameDraft((resolveCustomerDetailUsername(customer) ?? '').toLowerCase())
              setIsRenameDialogOpen(true)
            }}
            disabled={!customer}
          >
            <Pencil className="me-2 h-4 w-4" />
            {t('common.changeUsername', { defaultValue: 'Change Username' })}
          </Button>
          <Button type="button" variant="outline" onClick={() => setIsNotesDialogOpen(true)}>
            <FileText className="me-2 h-4 w-4" />
            {t('common.notes', { defaultValue: 'Notes' })}
          </Button>
        </div>
      </div>

      {customer ? (
        <>
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold">{customer.name}</h2>
            <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              {resolveCustomerDetailUsername(customer) ?? customer.tenant?.name ?? '-'}
            </p>
          </div>

          <Card>
            <CardHeader><CardTitle>{t('managerParent.pages.customers.customerDetails')}</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <Info label={t('common.name')} value={customer.name} />
              <Info
                label={t('common.username')}
                value={resolveCustomerDetailUsername(customer) ?? '-'}
                isLocked={customer.username_locked}
                lockTooltip={t('activate.biosLockedHint')}
              />
              <Info label={t('common.tenant')} value={customer.tenant?.name ?? '-'} />
              <Info label={t('common.email')} value={customer.email ?? '-'} />
              <Info label={t('common.phone')} value={customer.phone ?? '-'} />
              <Info label={t('common.country', { defaultValue: 'Country' })} value={customer.country_name ?? '-'} />
              <Info
                label={t('common.status')}
                value={customer.status ? <LicenseStatusBadges status={customer.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending' | 'cancelled'} isBlocked={Boolean(customer.is_blacklisted)} /> : '-'}
              />
              <Info label={t('common.createdAt')} value={customer.created_at ? formatDate(customer.created_at, locale) : '-'} />
            </CardContent>
          </Card>

          <Tabs defaultValue="licenses" className="space-y-4">
            <TabsList>
              <TabsTrigger value="licenses">{t('managerParent.pages.customers.licenseHistory')}</TabsTrigger>
              <TabsTrigger value="bios">{t('managerParent.pages.customers.biosId')}</TabsTrigger>
              <TabsTrigger value="ips">{t('managerParent.pages.ipAnalytics.title')}</TabsTrigger>
              <TabsTrigger value="username_history">{t('common.history', { defaultValue: 'History' })}</TabsTrigger>
              <TabsTrigger value="activity">{t('managerParent.nav.activity', { defaultValue: 'Panel Activity' })}</TabsTrigger>
            </TabsList>

            <TabsContent value="licenses">
              <Card>
                <CardHeader><CardTitle>{t('managerParent.pages.customers.licenseHistory')}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {groupedLicenses.length === 0 ? (
                    <EmptyState title={t('common.noData')} description={t('common.adjustFilters')} />
                  ) : (
                    groupedLicenses.map((group) => (
                      <details key={group.key} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800" open>
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{t('customerDetail.resellerTimeline', { defaultValue: 'Reseller Timeline' })}: {group.name}</p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {group.items.length} {t('common.activations', { defaultValue: 'Activations' })} | {group.period}
                              </p>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{group.email}</p>
                          </div>
                        </summary>
                        <div className="mt-4 space-y-3">
                          {group.items.map((license) => (
                            <div key={license.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/40">
                              <div className="grid gap-3 md:grid-cols-5">
                                <Info label={t('common.program')} value={license.program ?? '-'} />
                                <Info
                                  label={t('customerDetail.soldBy', { defaultValue: 'Sold by' })}
                                  value={(
                                    <RoleIdentity
                                      name={group.name}
                                      role={resolveUserRole(group.role)}
                                      href={group.id ? routePaths.superAdmin.userDetail(lang, group.id) : undefined}
                                    />
                                  )}
                                />
                                <Info label={t('customerDetail.period', { defaultValue: 'Period' })} value={formatLicensePeriod(license, locale)} />
                                <Info label={t('common.price', { defaultValue: 'Price' })} value={`$${Number(license.price ?? 0).toFixed(2)}`} />
                                <Info label={t('common.status')} value={<LicenseStatusBadges status={license.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending' | 'cancelled'} isBlocked={Boolean(license.is_blacklisted)} />} />
                              </div>
                              <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                                <span>
                                  {t('managerParent.pages.customers.biosId')}: <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.superAdmin.biosDetail(lang, license.bios_id)}>{license.bios_id}</Link>
                                </span>
                                <span>{t('common.username')}: {resolveLicenseUsername(customer, license.external_username) ?? '-'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bios">
              <Card>
                <CardContent className="space-y-2 p-4">
                  {(customer.licenses ?? []).map((license) => (
                    <Link key={`bios-${license.id}`} className="block rounded-xl border border-slate-200 p-3 text-sky-600 hover:underline dark:border-slate-700" to={routePaths.superAdmin.biosDetail(lang, license.bios_id)}>
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

            <TabsContent value="username_history">
              <Card>
                <CardHeader><CardTitle>{t('common.username', { defaultValue: 'Username' })} {t('common.history', { defaultValue: 'History' })}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(customer.username_history ?? []).length === 0 ? (
                    <EmptyState title={t('common.noData')} description={t('common.adjustFilters')} />
                  ) : (
                    (customer.username_history ?? []).map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium">{entry.old_username} → {entry.new_username}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {(entry.changed_by?.name ?? entry.changed_by?.email) ? `${entry.changed_by?.name ?? entry.changed_by?.email}` : t('common.system', { defaultValue: 'System' })}
                              {entry.reason ? ` • ${entry.reason}` : ''}
                            </p>
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

            <TabsContent value="activity">
              <Card>
                <CardHeader><CardTitle>{t('managerParent.nav.activity', { defaultValue: 'Panel Activity' })}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(customer.activity ?? []).length === 0 ? (
                    <EmptyState title={t('common.noData')} description={t('superAdmin.pages.dashboard.noActivity')} />
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

      <CustomerNoteDialog isOpen={isNotesDialogOpen} onClose={() => setIsNotesDialogOpen(false)} customerId={customerId} />

      <Dialog open={isRenameDialogOpen} onOpenChange={handleRenameDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.username', { defaultValue: 'Username' })}</DialogTitle>
            <DialogDescription>{t('common.dangerZone', { defaultValue: 'This action updates external software usernames for active licenses. If the external API fails, nothing will be changed.' })}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="rename-username">{t('common.username', { defaultValue: 'Username' })}</Label>
              <Input
                id="rename-username"
                value={usernameDraft}
                onChange={(event) => setUsernameDraft(event.target.value)}
                onBlur={(event) => setUsernameDraft(formatUsername(event.target.value).toLowerCase())}
                placeholder="e.g. john_doe"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rename-reason">{t('common.reason', { defaultValue: 'Reason' })}</Label>
              <Input id="rename-reason" value={renameReason} onChange={(event) => setRenameReason(event.target.value)} placeholder={t('common.optional', { defaultValue: 'Optional' })} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleRenameDialogOpenChange(false)} disabled={renameMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => renameMutation.mutate({ username: usernameDraft, reason: renameReason.trim() || undefined })}
              disabled={!customer || renameMutation.isPending || usernameDraft.trim().length < 2}
            >
              {renameMutation.isPending ? t('common.loading', { defaultValue: 'Loading...' }) : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function groupLicensesByReseller(customer: SuperAdminCustomerDetails | undefined) {
  const groups = new Map<string, {
    key: string
    id: number | null
    name: string
    email: string
    role: string | null
    items: NonNullable<SuperAdminCustomerDetails['licenses']>
  }>()

  for (const license of customer?.licenses ?? []) {
    const key = String(license.reseller_id ?? `unknown-${license.reseller ?? 'unknown'}`)
    const existing = groups.get(key)

    if (existing) {
      existing.items.push(license)
      continue
    }

    groups.set(key, {
      key,
      id: license.reseller_id ?? null,
      name: license.reseller ?? 'Unknown',
      email: license.reseller_email ?? '-',
      role: license.reseller_role ?? null,
      items: [license],
    })
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    period: formatGroupPeriod(group.items),
  }))
}

function formatGroupPeriod(licenses: NonNullable<SuperAdminCustomerDetails['licenses']>) {
  const dates = licenses
    .flatMap((license) => [license.activated_at, license.start_at, license.expires_at])
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => left.getTime() - right.getTime())

  if (dates.length === 0) {
    return '-'
  }

  const first = dates[0]
  const last = dates[dates.length - 1]
  const formatMonth = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })

  return `${formatMonth.format(first)} - ${formatMonth.format(last)}`
}

function formatLicensePeriod(
  license: NonNullable<SuperAdminCustomerDetails['licenses']>[number],
  locale: string,
) {
  const start = license.start_at ?? license.activated_at
  const end = license.expires_at

  if (!start && !end) {
    return '-'
  }

  return `${start ? formatDate(start, locale) : '-'} -> ${end ? formatDate(end, locale) : '-'}`
}

function resolveCustomerDetailUsername(customer: { name?: string | null; client_name?: string | null; external_username?: string | null; username?: string | null; licenses?: Array<{ external_username?: string | null }> } | undefined) {
  const firstLicenseUsername = customer?.licenses?.find((license) => license.external_username)?.external_username?.trim()
  const storedUsername = customer?.username?.trim()

  if (firstLicenseUsername && firstLicenseUsername !== customer?.name && firstLicenseUsername !== customer?.client_name) {
    return firstLicenseUsername
  }

  return storedUsername || firstLicenseUsername || customer?.external_username || null
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

function Info({
  label,
  value,
  isLocked,
  lockTooltip,
}: {
  label: string
  value: ReactNode
  isLocked?: boolean
  lockTooltip?: string
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40" title={isLocked ? lockTooltip : undefined}>
      <div className="flex items-center gap-1">
        <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        {isLocked ? <Lock className="h-3 w-3 text-amber-600" /> : null}
      </div>
      <div className={`mt-1 whitespace-pre-line font-medium ${isLocked ? 'text-slate-400 dark:text-slate-600' : ''}`}>
        {value}
      </div>
    </div>
  )
}
