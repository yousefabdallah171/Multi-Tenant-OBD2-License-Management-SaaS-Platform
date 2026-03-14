import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { liveQueryOptions, LIVE_QUERY_INTERVAL } from '@/lib/live-query'
import { formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'
import type { LicenseHistoryEntry } from '@/types/manager-reseller.types'
import { IpLocationCell } from '@/utils/countryFlag'

export function CustomerDetailPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const { id } = useParams<{ id: string }>()
  const customerId = Number(id)

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

  const customer = query.data?.data
  const licenseHistoryGroups = groupLicenseHistoryByReseller(licenseHistoryQuery.data?.data ?? [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-start">
        <Button type="button" variant="outline" onClick={() => navigate(routePaths.manager.customers(lang))}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>
      <PageHeader eyebrow={t('manager.layout.eyebrow')} title={customer?.name ?? t('manager.pages.customers.customerDetails')} description={resolveCustomerDetailUsername(customer) ?? t('manager.pages.customers.customerDetailsDescription')} />

      {customer ? (
        <>
          <Card>
            <CardHeader><CardTitle>{t('manager.pages.customers.customerDetails')}</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Info label={t('common.name')} value={customer.name} />
              <Info label={t('common.email')} value={customer.email} />
              <Info label={t('common.username')} value={resolveCustomerDetailUsername(customer) ?? '-'} />
              <Info label={t('common.phone')} value={customer.phone ?? '-'} />
              <Info label={t('common.status')} value={customer.status ? <StatusBadge status={customer.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} /> : '-'} />
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
                          <Info label={t('common.status')} value={<StatusBadge status={license.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} />} />
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
              {(customer.ip_logs ?? []).map((log) => (
                <div key={log.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                  <p className="font-medium">{log.ip_address}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400"><IpLocationCell country={log.country ?? 'Unknown'} city={log.city ?? ''} countryCode={log.country_code ?? ''} /></p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{log.created_at ? formatDate(log.created_at, locale) : '-'}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('manager.nav.activity')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(customer.activity ?? []).map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                  <p className="font-medium">{entry.action}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{entry.description ?? '-'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
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

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 whitespace-pre-line font-medium">{value}</p>
    </div>
  )
}
