import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { superAdminBiosDetailsService } from '@/services/bios-details.service'

export function BiosDetailsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const biosId = params.biosId ?? searchParams.get('bios') ?? ''

  const searchQuery = useQuery({
    queryKey: ['super-admin', 'bios-details', 'search', search],
    queryFn: () => superAdminBiosDetailsService.searchBiosIds(search),
    enabled: search.trim().length >= 2,
  })
  const recentQuery = useQuery({
    queryKey: ['super-admin', 'bios-details', 'recent'],
    queryFn: () => superAdminBiosDetailsService.getRecentBiosIds(20),
  })
  const overviewQuery = useQuery({
    queryKey: ['super-admin', 'bios-details', 'overview', biosId],
    queryFn: () => superAdminBiosDetailsService.getBiosOverview(biosId),
    enabled: biosId !== '',
  })
  const licensesQuery = useQuery({
    queryKey: ['super-admin', 'bios-details', 'licenses', biosId],
    queryFn: () => superAdminBiosDetailsService.getBiosLicenses(biosId),
    enabled: biosId !== '',
  })
  const resellersQuery = useQuery({
    queryKey: ['super-admin', 'bios-details', 'resellers', biosId],
    queryFn: () => superAdminBiosDetailsService.getResellerBreakdown(biosId),
    enabled: biosId !== '',
  })
  const ipsQuery = useQuery({
    queryKey: ['super-admin', 'bios-details', 'ips', biosId],
    queryFn: () => superAdminBiosDetailsService.getIpAnalytics(biosId),
    enabled: biosId !== '',
  })
  const activityQuery = useQuery({
    queryKey: ['super-admin', 'bios-details', 'activity', biosId],
    queryFn: () => superAdminBiosDetailsService.getBiosActivity(biosId),
    enabled: biosId !== '',
  })

  const overviewRows = useMemo(() => {
    const overview = overviewQuery.data
    if (!overview) {
      return []
    }
    return [
      [t('biosDetails.originalBios'), overview.original_bios_id || '-'],
      [t('biosDetails.username'), overview.username || '-'],
      [t('biosDetails.status'), overview.status || '-'],
      [t('biosDetails.firstActivation'), overview.first_activation ? formatDate(overview.first_activation, locale) : '-'],
      [t('biosDetails.lastActivity'), overview.last_activity ? formatDate(overview.last_activity, locale) : '-'],
      [t('biosDetails.totalActivations'), String(overview.total_activations ?? 0)],
      [t('biosDetails.avgDaysBetween'), String(overview.avg_days_between_purchases ?? 0)],
    ] as Array<[string, string]>
  }, [locale, overviewQuery.data, t])

  const visibleBiosList = search.trim().length >= 2 ? (searchQuery.data ?? []) : (biosId ? [] : (recentQuery.data ?? []))
  const latestLicense = overviewQuery.data?.latest_license
  const latestCustomer = latestLicense?.customer ?? overviewQuery.data?.customer
  const latestReseller = latestLicense?.reseller ?? overviewQuery.data?.reseller

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('biosDetails.title')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{biosId || t('biosDetails.search')}</p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('biosDetails.search')} />
          {visibleBiosList.length > 0 ? (
            <div className="grid gap-2">
              {visibleBiosList.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => navigate(routePaths.superAdmin.biosDetail(lang, item))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-start text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
                >
                  {item}
                </button>
              ))}
            </div>
          ) : biosId ? null : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {search.trim().length >= 2 ? t('common.noData') : t('biosDetails.description')}
            </p>
          )}
        </CardContent>
      </Card>

      {biosId ? (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">{t('biosDetails.overview')}</TabsTrigger>
            <TabsTrigger value="licenses">{t('biosDetails.licenses')}</TabsTrigger>
            <TabsTrigger value="resellers">{t('biosDetails.resellers')}</TabsTrigger>
            <TabsTrigger value="ips">{t('biosDetails.ips')}</TabsTrigger>
            <TabsTrigger value="activity">{t('biosDetails.activity')}</TabsTrigger>
            <TabsTrigger value="blacklist">{t('biosDetails.blacklist')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader><CardTitle>{t('biosDetails.overview')}</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {overviewRows.map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
                {latestCustomer ? (
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('biosDetails.customer')}</p>
                    <p className="font-medium">
                      {latestCustomer.id ? <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.superAdmin.customerDetail(lang, latestCustomer.id)}>{latestCustomer.name}</Link> : latestCustomer.name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{latestCustomer.email ?? '-'}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{latestCustomer.phone ?? '-'}</p>
                  </div>
                ) : null}
                {latestReseller ? (
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('biosDetails.resellers')}</p>
                    <p className="font-medium">
                      {latestReseller.id ? <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.superAdmin.userDetail(lang, latestReseller.id)}>{latestReseller.name}</Link> : latestReseller.name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{latestReseller.email ?? '-'}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{latestReseller.phone ?? '-'}</p>
                  </div>
                ) : null}
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('common.program')}</p>
                  <p className="font-medium">{latestLicense?.program?.name ?? '-'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('common.duration')}</p>
                  <p className="font-medium">{latestLicense ? `${latestLicense.duration_days} ${t('common.days')}` : '-'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('common.price')}</p>
                  <p className="font-medium">{latestLicense ? `$${Number(latestLicense.price).toFixed(2)}` : '-'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('common.activate')}</p>
                  <p className="font-medium">{latestLicense?.activated_at ? formatDate(latestLicense.activated_at, locale) : '-'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('common.expiry')}</p>
                  <p className="font-medium">{latestLicense?.expires_at ? formatDate(latestLicense.expires_at, locale) : '-'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('common.username')}</p>
                  <p className="font-medium">{latestLicense?.external_username ?? '-'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('common.status')}</p>
                  <p className="font-medium">{latestLicense?.status ?? '-'}</p>
                </div>
                {latestCustomer && latestLicense ? (
                  <div className="rounded-xl bg-slate-50 p-3 md:col-span-2 dark:bg-slate-900/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('biosDetails.overviewSections.saleSummary')}</p>
                    <p className="font-medium">
                      {`${latestReseller?.name ?? '-'} sold ${latestLicense.program?.name ?? '-'} to ${latestCustomer.name}`}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {`${latestLicense.duration_days} days | $${Number(latestLicense.price).toFixed(2)} | ${latestLicense.activated_at ? formatDate(latestLicense.activated_at, locale) : '-'}`}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="licenses">
            <Card><CardContent className="space-y-2 p-4">{(licensesQuery.data?.data ?? []).map((license) => <div key={license.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><p className="font-medium">{license.program?.name ?? '-'}</p><p className="text-sm text-slate-500 dark:text-slate-400">{license.status} | ${Number(license.price).toFixed(2)}</p></div>)}</CardContent></Card>
          </TabsContent>
          <TabsContent value="resellers">
            <Card><CardContent className="space-y-2 p-4">{(resellersQuery.data ?? []).map((reseller) => <div key={`${reseller.id}-${reseller.email}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><p className="font-medium">{reseller.name ?? '-'}</p><p className="text-sm text-slate-500 dark:text-slate-400">{reseller.email ?? '-'}</p><p className="text-xs text-slate-500 dark:text-slate-400">{t('common.activations')}: {reseller.activation_count}</p><p className="text-xs text-slate-500 dark:text-slate-400">{t('common.revenue')}: ${Number(reseller.total_revenue).toFixed(2)}</p></div>)}</CardContent></Card>
          </TabsContent>
          <TabsContent value="ips">
            <Card><CardContent className="space-y-2 p-4">{(ipsQuery.data ?? []).map((ip, index) => <div key={`${ip.ip_address}-${index}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">{ip.ip_address ?? '-'}</div>)}</CardContent></Card>
          </TabsContent>
          <TabsContent value="activity">
            <Card><CardContent className="space-y-2 p-4">{(activityQuery.data ?? []).map((item) => <div key={`${item.id}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">{item.action}</div>)}</CardContent></Card>
          </TabsContent>
          <TabsContent value="blacklist">
            <Card><CardContent className="p-4 text-sm text-slate-600 dark:text-slate-300">{overviewQuery.data?.blacklist?.is_blacklisted ? (overviewQuery.data.blacklist.reason || t('activate.biosBlacklisted')) : t('biosDetails.notBlacklisted')}</CardContent></Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}
