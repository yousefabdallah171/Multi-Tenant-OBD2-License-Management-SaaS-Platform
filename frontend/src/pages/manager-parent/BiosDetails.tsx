import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate, formatLicenseDurationDays } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerParentBiosDetailsService } from '@/services/bios-details.service'
import type { BiosActivity, BiosReseller } from '@/types/bios-details.types'

export function BiosDetailsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search.trim(), 400)
  const biosId = params.biosId ?? searchParams.get('bios') ?? ''

  const searchQuery = useQuery({
    queryKey: ['bios-details', 'search', debouncedSearch],
    queryFn: () => managerParentBiosDetailsService.searchBiosIds(debouncedSearch),
    enabled: debouncedSearch.length >= 3,
  })

  const recentQuery = useQuery({
    queryKey: ['bios-details', 'recent'],
    queryFn: () => managerParentBiosDetailsService.getRecentBiosIds(20),
  })

  const overviewQuery = useQuery({
    queryKey: ['bios-details', 'overview', biosId],
    queryFn: () => managerParentBiosDetailsService.getBiosOverview(biosId),
    enabled: biosId !== '',
  })

  const licensesQuery = useQuery({
    queryKey: ['bios-details', 'licenses', biosId],
    queryFn: () => managerParentBiosDetailsService.getBiosLicenses(biosId),
    enabled: biosId !== '',
  })

  const resellersQuery = useQuery({
    queryKey: ['bios-details', 'resellers', biosId],
    queryFn: () => managerParentBiosDetailsService.getResellerBreakdown(biosId),
    enabled: biosId !== '',
  })

  const ipsQuery = useQuery({
    queryKey: ['bios-details', 'ips', biosId],
    queryFn: () => managerParentBiosDetailsService.getIpAnalytics(biosId),
    enabled: biosId !== '',
  })

  const activityQuery = useQuery({
    queryKey: ['bios-details', 'activity', biosId],
    queryFn: () => managerParentBiosDetailsService.getBiosActivity(biosId),
    enabled: biosId !== '',
  })

  const visibleBiosList = debouncedSearch.length >= 3 ? (searchQuery.data ?? []) : (biosId ? [] : (recentQuery.data ?? []))
  const latestLicense = overviewQuery.data?.latest_license
  const latestCustomer = latestLicense?.customer ?? overviewQuery.data?.customer
  const latestReseller = latestLicense?.reseller ?? overviewQuery.data?.reseller
  const normalizedActivity = useMemo(() => dedupeParentBiosActivity(activityQuery.data ?? []), [activityQuery.data])

  return (
    <div className="space-y-6">
      <PageHeader title={t('biosDetails.title')} description={biosId || t('biosDetails.description')} />

      <Card>
        <CardContent className="space-y-4 p-4">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('biosDetails.searchPlaceholder')} />
          {visibleBiosList.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {visibleBiosList.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  className="rounded-full border border-slate-300 px-3 py-1 text-sm hover:border-sky-400 hover:text-sky-600 dark:border-slate-700 dark:hover:text-sky-300"
                  onClick={() => navigate(routePaths.managerParent.biosDetail(lang, candidate))}
                >
                  {candidate}
                </button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {biosId ? (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="overview">{t('biosDetails.overview')}</TabsTrigger>
            <TabsTrigger value="licenses">{t('common.licenses')}</TabsTrigger>
            <TabsTrigger value="resellers">{t('biosDetails.resellers')}</TabsTrigger>
            <TabsTrigger value="ips">{t('managerParent.pages.ipAnalytics.title')}</TabsTrigger>
            <TabsTrigger value="activity">{t('managerParent.nav.activity')}</TabsTrigger>
            <TabsTrigger value="blacklist">{t('biosDetails.blacklist')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader><CardTitle>{t('biosDetails.overview')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {!overviewQuery.isLoading && !overviewQuery.data ? (
                  <EmptyState title={t('common.noData')} description={t('biosDetails.description')} />
                ) : null}
                <SectionCard title={t('biosDetails.overviewSections.biosInfo')}>
                  <InfoGrid items={[
                    [t('biosDetails.originalBios'), overviewQuery.data?.original_bios_id || '-'],
                    [t('biosDetails.username'), overviewQuery.data?.username || '-'],
                    [t('biosDetails.status'), overviewQuery.data?.status ? <StatusBadge status={overviewQuery.data.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} /> : '-'],
                    [t('biosDetails.firstActivation'), overviewQuery.data?.first_activation ? formatDate(overviewQuery.data.first_activation, locale) : '-'],
                    [t('biosDetails.lastActivity'), overviewQuery.data?.last_activity ? formatDate(overviewQuery.data.last_activity, locale) : '-'],
                  ]} />
                </SectionCard>
                <SectionCard title={t('biosDetails.overviewSections.currentLicense')}>
                  <InfoGrid items={[
                    [t('common.program'), latestLicense?.program?.name ?? '-'],
                    [t('common.duration'), formatLicenseDurationDays(latestLicense?.duration_days, t, latestLicense?.activated_at, latestLicense?.expires_at)],
                    [t('common.price'), latestLicense ? `$${Number(latestLicense.price).toFixed(2)}` : '-'],
                    [t('common.start'), latestLicense?.activated_at ? formatDate(latestLicense.activated_at, locale) : '-'],
                    [t('common.expiry'), latestLicense?.expires_at ? formatDate(latestLicense.expires_at, locale) : '-'],
                    [t('common.status'), latestLicense?.status ? <StatusBadge status={latestLicense.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} /> : '-'],
                  ]} />
                </SectionCard>
                <SectionCard title={t('biosDetails.customer')}>
                  <InfoGrid items={[
                    [t('common.customer'), latestCustomer?.id ? <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.customerDetail(lang, latestCustomer.id)}>{latestCustomer.name}</Link> : (latestCustomer?.name ?? '-')],
                    [t('common.email'), latestCustomer?.email ?? '-'],
                    [t('common.reseller'), latestReseller?.id ? <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.teamMemberDetail(lang, latestReseller.id)}>{latestReseller.name}</Link> : (latestReseller?.name ?? '-')],
                    [t('customerDetail.soldBy'), latestReseller?.email ?? '-'],
                  ]} />
                </SectionCard>
                <SectionCard title={t('biosDetails.overviewSections.saleSummary')}>
                  <InfoGrid items={[
                    [t('biosDetails.totalActivations'), String(overviewQuery.data?.total_activations ?? 0)],
                    [t('common.duration'), formatLicenseDurationDays(overviewQuery.data?.avg_duration_days, t)],
                    [t('common.price'), `$${Number(overviewQuery.data?.total_revenue ?? 0).toFixed(2)}`],
                    [t('biosDetails.avgDaysBetween'), String(overviewQuery.data?.avg_days_between_purchases ?? 0)],
                  ]} />
                </SectionCard>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="licenses">
            <Card>
              <CardContent className="space-y-3 p-4">
                {(licensesQuery.data?.data ?? []).map((license) => (
                  <div key={license.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <div className="grid gap-3 md:grid-cols-5">
                      <MiniInfo label={t('common.program')} value={license.program?.name ?? '-'} />
                      <MiniInfo label={t('common.reseller')} value={<ResellerWithRole name={license.reseller?.name ?? '-'} role={license.reseller?.role} t={t} />} />
                      <MiniInfo label={t('common.duration')} value={formatLicenseDurationDays(license.duration_days, t, license.activated_at, license.expires_at)} />
                      <MiniInfo label={t('common.price')} value={`$${Number(license.price).toFixed(2)}`} />
                      <MiniInfo label={t('common.status')} value={<StatusBadge status={license.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} />} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resellers">
            <Card>
              <CardContent className="space-y-3 p-4">
                {(resellersQuery.data ?? []).map((reseller) => (
                  <ResellerCard key={`${reseller.id}-${reseller.email}`} reseller={reseller} locale={locale} lang={lang} t={t} />
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ips">
            <Card>
              <CardContent className="space-y-2 p-4">
                {!ipsQuery.isLoading && !ipsQuery.isError && (ipsQuery.data ?? []).length === 0 ? (
                  <EmptyState title={t('biosDetails.noSoftwareActivity')} description={t('biosDetails.noSoftwareActivityDesc')} />
                ) : null}
                {(ipsQuery.data ?? []).map((ip, index) => (
                  <div key={`${ip.ip_address}-${index}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{ip.ip_address ?? '-'}</p>
                      {ip.proxy ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">VPN/Proxy</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {ip.country ? <span>{ip.city ? `${ip.city}, ` : ''}{ip.country}</span> : null}
                      {ip.isp ? <span>{ip.isp}</span> : null}
                      {ip.program_name ? <span>{ip.program_name}</span> : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{ip.timestamp ? formatDate(ip.timestamp, locale) : '-'}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardContent className="space-y-3 p-4">
                {normalizedActivity.map((item) => (
                  <div key={`${item.id}`} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.badgeClassName}`}>{item.label.startsWith('biosDetails.') ? t(item.label) : item.label}</span>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{item.reseller_name ?? '-'}</p>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{item.created_at ? formatDate(item.created_at, locale) : '-'}</p>
                    </div>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{item.description ?? '-'}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blacklist">
            <Card>
              <CardContent className="p-4 text-sm text-slate-600 dark:text-slate-300">
                {overviewQuery.data?.blacklist?.is_blacklisted ? (overviewQuery.data.blacklist.reason || t('activate.biosBlacklisted')) : t('biosDetails.notBlacklisted')}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}

function dedupeParentBiosActivity(items: BiosActivity[]) {
  const seen = new Set<string>()
  return items.flatMap((item) => {
    const family = resolveParentActivityFamily(item.action)
    const timestamp = item.created_at ? new Date(item.created_at).toISOString() : String(item.id)
    const key = `${family.label}:${timestamp}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ ...item, label: family.label, badgeClassName: family.badgeClassName }]
  })
}

function resolveParentActivityFamily(action: string) {
  if (action.includes('activate')) return { label: 'biosDetails.activityTypes.activate', badgeClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' }
  if (action.includes('renew')) return { label: 'biosDetails.activityTypes.renew', badgeClassName: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' }
  if (action.includes('pause')) return { label: 'biosDetails.activityTypes.pause', badgeClassName: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' }
  if (action.includes('deactivate') || action.includes('delete') || action.includes('blacklist') || action.includes('conflict')) return { label: 'biosDetails.activityTypes.deactivate', badgeClassName: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' }
  return { label: action, badgeClassName: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300' }
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><p className="mb-3 text-sm font-semibold">{title}</p>{children}</div>
}

function InfoGrid({ items }: { items: Array<[string, React.ReactNode]> }) {
  return <div className="grid gap-3 md:grid-cols-2">{items.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><div className="font-medium">{value}</div></div>)}</div>
}

function MiniInfo({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><div className="font-medium">{value}</div></div>
}

function ResellerWithRole({ name, role, t }: { name: string; role?: string | null; t: (k: string) => string }) {
  const badge = resolveRoleBadge(role, t)
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span>{name}</span>
      {badge ? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span> : null}
    </span>
  )
}

function resolveRoleBadge(role?: string | null, t?: (k: string) => string) {
  if (!role) return null
  const map: Record<string, string> = {
    reseller: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    manager_parent: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
    manager: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    super_admin: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  }
  const cls = map[role]
  if (!cls) return null
  return { label: t?.(`roles.${role}`) ?? role, className: cls }
}

function ResellerCard({ reseller, locale, lang, t }: { reseller: BiosReseller; locale: string; lang: 'ar' | 'en'; t: (key: string) => string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {reseller.id ? <Link className="font-medium text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.teamMemberDetail(lang, reseller.id)}>{reseller.name ?? '-'}</Link> : <p className="font-medium">{reseller.name ?? '-'}</p>}
          {(() => { const b = resolveRoleBadge(reseller.role, t); return b ? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${b.className}`}>{b.label}</span> : null })()}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{reseller.email ?? '-'}</p>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <MiniInfo label={t('common.activations')} value={reseller.activation_count} />
        <MiniInfo label={t('common.revenue')} value={`$${Number(reseller.total_revenue).toFixed(2)}`} />
        <MiniInfo label={t('biosDetails.resellerMetrics.lastActivity')} value={reseller.last_activity_at ? formatDate(reseller.last_activity_at, locale) : '-'} />
        <MiniInfo label={t('biosDetails.resellerMetrics.programsSold')} value={(reseller.programs_sold ?? []).join(', ') || '-'} />
      </div>
    </div>
  )
}
