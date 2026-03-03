import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const biosId = searchParams.get('bios') ?? ''

  const searchQuery = useQuery({
    queryKey: ['super-admin', 'bios-details', 'search', search],
    queryFn: () => superAdminBiosDetailsService.searchBiosIds(search),
    enabled: search.trim().length >= 2,
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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('biosDetails.title')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{biosId || t('biosDetails.search')}</p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('biosDetails.search')} />
          {searchQuery.data && searchQuery.data.length > 0 ? (
            <div className="grid gap-2">
              {searchQuery.data.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => navigate(`${routePaths.superAdmin.biosDetails(lang)}?bios=${encodeURIComponent(item)}`)}
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
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="licenses">
            <Card><CardContent className="space-y-2 p-4">{(licensesQuery.data?.data ?? []).map((license) => <div key={license.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">{license.program?.name ?? '-'}</div>)}</CardContent></Card>
          </TabsContent>
          <TabsContent value="resellers">
            <Card><CardContent className="space-y-2 p-4">{(resellersQuery.data ?? []).map((reseller) => <div key={`${reseller.id}-${reseller.email}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">{reseller.name ?? '-'}</div>)}</CardContent></Card>
          </TabsContent>
          <TabsContent value="ips">
            <Card><CardContent className="space-y-2 p-4">{(ipsQuery.data ?? []).map((ip, index) => <div key={`${ip.ip_address}-${index}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">{ip.ip_address ?? '-'}</div>)}</CardContent></Card>
          </TabsContent>
          <TabsContent value="activity">
            <Card><CardContent className="space-y-2 p-4">{(activityQuery.data ?? []).map((item) => <div key={`${item.id}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">{item.action}</div>)}</CardContent></Card>
          </TabsContent>
          <TabsContent value="blacklist">
            <Card><CardContent className="p-4 text-sm text-slate-600 dark:text-slate-300">{overviewQuery.data?.blacklist?.is_blacklisted ? overviewQuery.data.blacklist.reason : t('biosDetails.notBlacklisted')}</CardContent></Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}

