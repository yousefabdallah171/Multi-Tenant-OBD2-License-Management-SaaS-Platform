import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PieChartWidget } from '@/components/charts/PieChartWidget'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { cn, formatDate } from '@/lib/utils'
import { managerParentService } from '@/services/manager-parent.service'
import type { IpAnalyticsEntry } from '@/types/manager-parent.types'

function ReputationBadge({ value, label }: { value: 'low' | 'medium' | 'high'; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize',
        value === 'low' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
        value === 'medium' && 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
        value === 'high' && 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
      )}
    >
      {label}
    </span>
  )
}

export function IpAnalyticsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [userId, setUserId] = useState<number | ''>('')
  const [country, setCountry] = useState('')
  const [reputation, setReputation] = useState<'low' | 'medium' | 'high' | ''>('')
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })
  const [searchIp, setSearchIp] = useState('')

  const statsQuery = useQuery({
    queryKey: ['manager-parent', 'ip-analytics', 'stats'],
    queryFn: () => managerParentService.getIpStats(),
  })

  const usersQuery = useQuery({
    queryKey: ['manager-parent', 'ip-analytics', 'users'],
    queryFn: () => managerParentService.getUsernameManagement({ per_page: 100 }),
  })

  const ipQuery = useQuery({
    queryKey: ['manager-parent', 'ip-analytics', page, perPage, userId, country, reputation, range.from, range.to],
    queryFn: () =>
      managerParentService.getIpAnalytics({
        page,
        per_page: perPage,
        user_id: userId,
        country,
        reputation_score: reputation,
        from: range.from,
        to: range.to,
      }),
  })

  const countries = useMemo(() => (statsQuery.data?.data.countries ?? []).map((item) => item.country), [statsQuery.data?.data.countries])

  const filteredRows = useMemo(() => {
    const normalized = searchIp.trim().toLowerCase()
    if (!normalized) {
      return ipQuery.data?.data ?? []
    }

    return (ipQuery.data?.data ?? []).filter((row) => row.ip_address.toLowerCase().includes(normalized))
  }, [ipQuery.data?.data, searchIp])

  const columns = useMemo<Array<DataTableColumn<IpAnalyticsEntry>>>(
    () => [
      {
        key: 'user',
        label: t('common.user'),
        sortable: true,
        sortValue: (row) => row.user?.name ?? '',
        render: (row) => (
          <div className="space-y-1">
            <p className="font-medium text-slate-950 dark:text-white">{row.user?.name ?? t('managerParent.pages.ipAnalytics.unknownUser')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.user?.email ?? '-'}</p>
          </div>
        ),
      },
      { key: 'ip', label: t('managerParent.pages.ipAnalytics.ipAddress'), sortable: true, sortValue: (row) => row.ip_address, render: (row) => <code>{row.ip_address}</code> },
      { key: 'location', label: t('managerParent.pages.ipAnalytics.location'), sortable: true, sortValue: (row) => `${row.country ?? ''} ${row.city ?? ''}`, render: (row) => `${row.country ?? '-'} / ${row.city ?? '-'}` },
      { key: 'isp', label: t('managerParent.pages.ipAnalytics.isp'), sortable: true, sortValue: (row) => row.isp ?? '', render: (row) => row.isp ?? '-' },
      { key: 'reputation', label: t('managerParent.pages.ipAnalytics.reputation'), sortable: true, sortValue: (row) => row.reputation_score, render: (row) => <ReputationBadge value={row.reputation_score} label={t(`managerParent.pages.ipAnalytics.${row.reputation_score}`)} /> },
      { key: 'action', label: t('common.action'), sortable: true, sortValue: (row) => row.action, render: (row) => row.action },
      { key: 'date', label: t('common.date'), sortable: true, sortValue: (row) => row.created_at ?? '', render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-') },
    ],
    [locale, t],
  )

  return (
    <div className="space-y-6">
      <PageHeader title={t('managerParent.pages.ipAnalytics.title')} description={t('managerParent.pages.ipAnalytics.description')} />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <PieChartWidget title={t('managerParent.pages.ipAnalytics.countryDistribution')} data={statsQuery.data?.data.countries ?? []} nameKey="country" valueKey="count" isLoading={statsQuery.isLoading} totalLabel={t('managerParent.pages.ipAnalytics.ips')} />
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('managerParent.pages.ipAnalytics.suspiciousIpAlerts')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(statsQuery.data?.data.suspicious ?? []).slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-3xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-950/60 dark:bg-rose-950/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-slate-950 dark:text-white">{item.ip_address}</p>
                    <p className="text-slate-500 dark:text-slate-400">{item.country ?? t('managerParent.pages.ipAnalytics.unknownCountry')}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.created_at ? formatDate(item.created_at, locale) : '-'}</p>
                  </div>
                </div>
              </div>
            ))}
            {!statsQuery.isLoading && (statsQuery.data?.data.suspicious.length ?? 0) === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.ipAnalytics.noSuspiciousIps')}</p> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px_220px_minmax(0,0.9fr)]">
          <Input value={searchIp} onChange={(event) => setSearchIp(event.target.value)} placeholder={t('managerParent.pages.ipAnalytics.searchPlaceholder')} />
          <select
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value ? Number(event.target.value) : '')
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('managerParent.pages.ipAnalytics.allUsers')}</option>
            {(usersQuery.data?.data ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={country}
              onChange={(event) => {
                setCountry(event.target.value)
                setPage(1)
              }}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('managerParent.pages.ipAnalytics.allCountries')}</option>
              {countries.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={reputation}
              onChange={(event) => {
                setReputation(event.target.value as 'low' | 'medium' | 'high' | '')
                setPage(1)
              }}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('managerParent.pages.ipAnalytics.allReputationScores')}</option>
              <option value="low">{t('managerParent.pages.ipAnalytics.low')}</option>
              <option value="medium">{t('managerParent.pages.ipAnalytics.medium')}</option>
              <option value="high">{t('managerParent.pages.ipAnalytics.high')}</option>
            </select>
          </div>
          <DateRangePicker value={range} onChange={setRange} />
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredRows}
        rowKey={(row) => row.id}
        isLoading={ipQuery.isLoading}
        pagination={{
          page: ipQuery.data?.meta.current_page ?? 1,
          lastPage: ipQuery.data?.meta.last_page ?? 1,
          total: ipQuery.data?.meta.total ?? 0,
          perPage: ipQuery.data?.meta.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPerPage(size)
          setPage(1)
        }}
      />
    </div>
  )
}
