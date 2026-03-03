import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerParentBiosDetailsService } from '@/services/bios-details.service'

export function BiosDetailsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const biosId = searchParams.get('bios') ?? ''

  const searchQuery = useQuery({
    queryKey: ['bios-details', 'search', search],
    queryFn: () => managerParentBiosDetailsService.searchBiosIds(search),
    enabled: search.trim().length >= 2,
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

  return (
    <div className="space-y-6">
      <PageHeader title={t('biosDetails.title')} description={biosId || t('biosDetails.search')} />

      <Card>
        <CardContent className="space-y-3 p-4">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('biosDetails.search')} />
          {searchQuery.data && searchQuery.data.length > 0 ? (
            <div className="grid gap-2">
              {searchQuery.data.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => navigate(`${routePaths.managerParent.biosDetails(lang)}?bios=${encodeURIComponent(item)}`)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-start text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
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
                {overviewQuery.data?.customer ? (
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('biosDetails.customer')}</p>
                    <Link className="font-medium text-sky-600" to={routePaths.managerParent.customerDetail(lang, overviewQuery.data.customer.id)}>
                      {overviewQuery.data.customer.name}
                    </Link>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="licenses">
            <Card>
              <CardContent className="space-y-2 p-4">
                {(licensesQuery.data?.data ?? []).map((license) => (
                  <div key={license.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <p className="font-medium">{license.program?.name ?? '-'}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{license.status} | {license.price}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resellers">
            <Card>
              <CardContent className="space-y-2 p-4">
                {(resellersQuery.data ?? []).map((reseller) => (
                  <div key={`${reseller.id}-${reseller.email}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <p className="font-medium">{reseller.name ?? '-'}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{reseller.email ?? '-'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{reseller.activation_count} / {reseller.total_revenue}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ips">
            <Card>
              <CardContent className="space-y-2 p-4">
                {(ipsQuery.data ?? []).map((ip, index) => (
                  <div key={`${ip.ip_address}-${index}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <p className="font-medium">{ip.ip_address ?? '-'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{ip.created_at ? formatDate(ip.created_at, locale) : '-'}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardContent className="space-y-2 p-4">
                {(activityQuery.data ?? []).map((item) => (
                  <div key={`${item.id}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <p className="font-medium">{item.action}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{item.description ?? '-'}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blacklist">
            <Card>
              <CardContent className="p-4 text-sm text-slate-600 dark:text-slate-300">
                {overviewQuery.data?.blacklist?.is_blacklisted ? overviewQuery.data.blacklist.reason : t('biosDetails.notBlacklisted')}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}

