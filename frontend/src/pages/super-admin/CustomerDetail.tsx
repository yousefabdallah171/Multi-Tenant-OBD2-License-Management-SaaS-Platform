import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '@/components/shared/EmptyState'
import { LicenseStatusBadges } from '@/components/shared/LicenseStatusBadges'
import { RoleIdentity } from '@/components/shared/RoleIdentity'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { liveQueryOptions, LIVE_QUERY_INTERVAL } from '@/lib/live-query'
import { formatActivityActionLabel, formatDate, formatReadableActivityDescription } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { superAdminCustomerService } from '@/services/super-admin-customer.service'
import type { UserRole } from '@/types/user.types'
import { IpLocationCell } from '@/utils/countryFlag'

export function CustomerDetailPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const { id } = useParams<{ id: string }>()
  const customerId = Number(id)

  const query = useQuery({
    queryKey: ['super-admin', 'customer-detail', customerId],
    queryFn: () => superAdminCustomerService.getOne(customerId),
    enabled: Number.isFinite(customerId),
    ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_DETAIL),
  })

  const customer = query.data?.data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-start">
        <Button type="button" variant="outline" onClick={() => navigate(routePaths.superAdmin.customers(lang))}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>

      {customer ? (
        <>
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold">{customer.name}</h2>
            <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{resolveCustomerDetailUsername(customer) ?? customer.tenant?.name ?? '-'}</p>
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
              <Info label={t('common.status')} value={customer.status ? <LicenseStatusBadges status={customer.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending' | 'cancelled'} isBlocked={Boolean(customer.is_blacklisted)} /> : '-'} />
              <Info label={t('common.createdAt')} value={customer.created_at ? formatDate(customer.created_at, locale) : '-'} />
              <Info
                label={t('common.reseller')}
                value={
                  <RoleIdentity
                    name={customer.resellers_summary?.[0]?.reseller_name}
                    role={resolveUserRole(customer.resellers_summary?.[0]?.reseller_role)}
                    href={customer.resellers_summary?.[0]?.reseller_id ? routePaths.superAdmin.userDetail(lang, customer.resellers_summary[0].reseller_id) : undefined}
                  />
                }
              />
            </CardContent>
          </Card>

          <Tabs defaultValue="licenses" className="space-y-4">
            <TabsList>
              <TabsTrigger value="licenses">{t('managerParent.pages.customers.licenseHistory')}</TabsTrigger>
              <TabsTrigger value="bios">{t('managerParent.pages.customers.biosId')}</TabsTrigger>
              <TabsTrigger value="ips">{t('managerParent.pages.ipAnalytics.title')}</TabsTrigger>
              <TabsTrigger value="activity">{t('superAdmin.pages.dashboard.recentActivity')}</TabsTrigger>
            </TabsList>

            <TabsContent value="licenses">
              <Card>
                <CardHeader><CardTitle>{t('managerParent.pages.customers.licenseHistory')}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {(customer.licenses ?? []).map((license) => (
                    <div key={license.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                      <div className="grid gap-2 md:grid-cols-4">
                        <Info label={t('common.program')} value={license.program ?? '-'} />
                        <Info label={t('managerParent.pages.customers.biosId')} value={<Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.superAdmin.biosDetail(lang, license.bios_id)}>{license.bios_id}</Link>} />
                        <Info label={t('common.username')} value={resolveLicenseUsername(customer, license.external_username) ?? '-'} />
                        <Info
                          label={t('common.reseller')}
                          value={
                            <RoleIdentity
                              name={license.reseller}
                              role={resolveUserRole(license.reseller_role)}
                              href={license.reseller_id ? routePaths.superAdmin.userDetail(lang, license.reseller_id) : undefined}
                            />
                          }
                        />
                        <Info label={t('common.status')} value={<LicenseStatusBadges status={license.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending' | 'cancelled'} isBlocked={Boolean(license.is_blacklisted)} />} />
                      </div>
                    </div>
                  ))}
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

            <TabsContent value="activity">
              <Card>
                <CardHeader><CardTitle>{t('superAdmin.pages.dashboard.recentActivity')}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(customer.activity ?? []).length === 0 ? (
                    <EmptyState title={t('common.noData')} description={t('superAdmin.pages.dashboard.noActivity')} />
                  ) : (
                    (customer.activity ?? []).map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                        <p className="font-medium">{formatActivityActionLabel(entry.action, t)}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{formatReadableActivityDescription(entry.description, locale)}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  )
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
