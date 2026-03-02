import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PieChartWidget } from '@/components/charts/PieChartWidget'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { managerParentService } from '@/services/manager-parent.service'
import { IpLocationCell } from '@/utils/countryFlag'

interface SoftwareIpRow {
  id: string
  username: string
  bios_id: string | null
  customer_id: number | null
  ip_address: string
  timestamp: string
  country: string
  city: string
  country_code: string
  isp: string
  proxy: boolean
  hosting: boolean
}

export function IpAnalyticsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(15)
  const [searchIp, setSearchIp] = useState('')
  const [reputation, setReputation] = useState<'all' | 'safe' | 'proxy'>('all')
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })

  useEffect(() => {
    setPage(1)
  }, [searchIp, reputation, range.from, range.to, perPage])

  const logsQuery = useInfiniteQuery({
    queryKey: ['manager-parent', 'ip-analytics', searchIp, reputation, range.from, range.to, perPage],
    queryFn: ({ pageParam }) => managerParentService.getIpAnalytics({
      page: Number(pageParam),
      per_page: perPage,
      search: searchIp || undefined,
      reputation,
      from: range.from || undefined,
      to: range.to || undefined,
    }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.meta.has_next_page ? lastPage.meta.next_page ?? undefined : undefined),
  })

  const rows = useMemo<SoftwareIpRow[]>(() => (logsQuery.data?.pages ?? []).flatMap((page) => page.data).map((row, index) => ({
    id: `${row.ip_address}-${index}`,
    username: row.username,
    bios_id: row.bios_id ?? null,
    customer_id: row.customer_id ?? null,
    ip_address: row.ip_address,
    timestamp: row.timestamp,
    country: row.country ?? 'Unknown',
    city: row.city ?? '',
    country_code: row.country_code ?? '',
    isp: row.isp ?? '',
    proxy: Boolean(row.proxy),
    hosting: Boolean(row.hosting),
  })), [logsQuery.data?.pages])

  const paged = useMemo(() => {
    const start = (page - 1) * perPage
    return rows.slice(start, start + perPage)
  }, [rows, page, perPage])

  const countryStats = useMemo(() => {
    const grouped = rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.country || 'Unknown'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    return Object.entries(grouped).map(([country, count]) => ({ country, count }))
  }, [rows])

  const meta = logsQuery.data?.pages.at(-1)?.meta
  const total = logsQuery.data?.pages[0]?.meta.total ?? 0

  const columns = useMemo<Array<DataTableColumn<SoftwareIpRow>>>(() => [
    { key: 'username', label: t('common.username'), sortable: true, sortValue: (row) => row.username, render: (row) => row.username },
    {
      key: 'bios_id',
      label: t('ipAnalytics.columns.biosId'),
      sortable: true,
      sortValue: (row) => row.bios_id ?? '',
      render: (row) => <code>{row.bios_id ?? '—'}</code>,
    },
    { key: 'ip', label: t('managerParent.pages.ipAnalytics.ipAddress'), sortable: true, sortValue: (row) => row.ip_address, render: (row) => <code dir="ltr">{row.ip_address}</code> },
    { key: 'location', label: t('ipAnalytics.columns.location'), sortable: true, sortValue: (row) => `${row.country} ${row.city}`, render: (row) => <IpLocationCell country={row.country} city={row.city} countryCode={row.country_code} /> },
    { key: 'isp', label: t('managerParent.pages.ipAnalytics.isp'), sortable: true, sortValue: (row) => row.isp, render: (row) => row.isp || '-' },
    {
      key: 'vpn',
      label: t('ipAnalytics.vpnProxy'),
      sortable: true,
      sortValue: (row) => (row.proxy || row.hosting ? 'proxy' : 'safe'),
      render: (row) => (row.proxy || row.hosting ? (
        <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {t('ipAnalytics.vpnProxy')}
        </span>
      ) : '-'),
    },
    { key: 'time', label: t('common.timestamp'), sortable: true, sortValue: (row) => row.timestamp, render: (row) => (Date.parse(row.timestamp) ? formatDate(row.timestamp, locale) : row.timestamp) },
  ], [locale, t])

  return (
    <div className="space-y-6">
      <PageHeader title={t('managerParent.pages.ipAnalytics.title')} description={t('managerParent.pages.ipAnalytics.description')} />

      <PieChartWidget
        title={t('managerParent.pages.ipAnalytics.countryDistribution')}
        data={countryStats}
        nameKey="country"
        valueKey="count"
        totalLabel={t('managerParent.pages.ipAnalytics.ips')}
      />

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,0.9fr)]">
          <Input value={searchIp} onChange={(event) => setSearchIp(event.target.value)} placeholder={t('managerParent.pages.ipAnalytics.searchPlaceholder')} />
          <select value={reputation} onChange={(event) => setReputation(event.target.value as 'all' | 'safe' | 'proxy')} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="all">{t('managerParent.pages.ipAnalytics.allReputationScores')}</option>
            <option value="safe">{t('managerParent.pages.ipAnalytics.low')}</option>
            <option value="proxy">{t('ipAnalytics.vpnProxy')}</option>
          </select>
          <DateRangePicker value={range} onChange={setRange} />
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={paged}
        rowKey={(row) => row.id}
        isLoading={logsQuery.isLoading || logsQuery.isFetchingNextPage}
        pagination={{
          page,
          lastPage: meta?.last_page ?? Math.max(1, Math.ceil(total / perPage)),
          total,
          perPage,
        }}
        onPageChange={(nextPage) => {
          setPage(nextPage)
          if (nextPage > (logsQuery.data?.pages.length ?? 0) && logsQuery.hasNextPage) {
            void logsQuery.fetchNextPage()
          }
        }}
        onPageSizeChange={(size) => {
          setPerPage(size)
          setPage(1)
        }}
      />
    </div>
  )
}
