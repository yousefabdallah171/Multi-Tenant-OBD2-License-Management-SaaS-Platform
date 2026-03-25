import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PieChartWidget } from '@/components/charts/PieChartWidget'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'
import { IpLocationCell } from '@/utils/countryFlag'

interface SoftwareIpRow {
  id: string
  username: string
  bios_id: string | null
  customer_id: number | null
  reseller_id: number | null
  customer_name: string | null
  customer_username: string | null
  reseller_name: string | null
  program_id: number | null
  program_name: string | null
  external_software_id: number | null
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
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('')
  const [reputation, setReputation] = useState<'all' | 'safe' | 'proxy'>('all')
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })

  useEffect(() => {
    setPage(1)
  }, [search, reputation, range.from, range.to, perPage, country])

  const logsQuery = useQuery({
    queryKey: ['manager-parent', 'ip-analytics', page, perPage, search, reputation, range.from, range.to, country],
    queryFn: () => managerParentService.getIpAnalytics({
      page,
      per_page: perPage,
      search: search || undefined,
      reputation,
      from: range.from || undefined,
      to: range.to || undefined,
      country: country || undefined,
    }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const rows = useMemo<SoftwareIpRow[]>(() => (logsQuery.data?.data ?? []).map((row, index) => ({
    id: `${row.ip_address}-${row.timestamp}-${index}`,
    username: row.username,
    bios_id: row.bios_id ?? null,
    customer_id: row.customer_id ?? null,
    reseller_id: row.reseller_id ?? null,
    customer_name: row.customer_name ?? null,
    customer_username: row.customer_username ?? null,
    reseller_name: row.reseller_name ?? null,
    program_id: row.program_id ?? null,
    program_name: row.program_name ?? null,
    external_software_id: row.external_software_id ?? null,
    ip_address: row.ip_address,
    timestamp: row.timestamp,
    country: row.country ?? 'Unknown',
    city: row.city ?? '',
    country_code: row.country_code ?? '',
    isp: row.isp ?? '',
    proxy: Boolean(row.proxy),
    hosting: Boolean(row.hosting),
  })), [logsQuery.data?.data])

  const countryStats = useMemo(() => {
    const grouped = rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.country || 'Unknown'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    return Object.entries(grouped).map(([countryName, count]) => ({ country: countryName, count }))
  }, [rows])

  const meta = logsQuery.data?.meta
  const total = meta?.total ?? 0

  const columns = useMemo<Array<DataTableColumn<SoftwareIpRow>>>(() => [
    {
      key: 'username',
      label: t('common.username'),
      sortable: true,
      sortValue: (row) => row.username,
      render: (row) => {
        if (row.customer_id) {
          return (
            <Link className="text-sky-600 hover:underline" to={routePaths.managerParent.customerDetail(lang, row.customer_id)}>
              {row.customer_username || row.customer_name || row.username}
            </Link>
          )
        }

        if (row.reseller_id) {
          return (
            <Link className="text-sky-600 hover:underline" to={routePaths.managerParent.teamMemberDetail(lang, row.reseller_id)}>
              {row.reseller_name || row.username}
            </Link>
          )
        }

        return row.username
      },
    },
    {
      key: 'bios_id',
      label: t('ipAnalytics.columns.biosId'),
      sortable: true,
      sortValue: (row) => row.bios_id ?? '',
      render: (row) => row.bios_id ? (
        <Link className="text-sky-600 hover:underline" to={routePaths.managerParent.biosDetail(lang, row.bios_id)}>
          <code>{row.bios_id}</code>
        </Link>
      ) : <code>-</code>,
    },
    { key: 'program_name', label: t('ipAnalytics.columns.program'), sortable: true, sortValue: (row) => row.program_name ?? '', render: (row) => row.program_name ?? '-' },
    { key: 'external_software_id', label: t('ipAnalytics.columns.externalId'), sortable: true, sortValue: (row) => String(row.external_software_id ?? ''), render: (row) => row.external_software_id ?? '-' },
    { key: 'ip', label: t('managerParent.pages.ipAnalytics.ipAddress'), sortable: true, sortValue: (row) => row.ip_address, render: (row) => <code dir="ltr">{row.ip_address}</code> },
    { key: 'location', label: t('ipAnalytics.columns.location'), sortable: true, sortValue: (row) => `${row.country} ${row.city}`, render: (row) => <IpLocationCell country={row.country} city={row.city} countryCode={row.country_code} /> },
    { key: 'isp', label: t('managerParent.pages.ipAnalytics.isp'), sortable: true, sortValue: (row) => row.isp, render: (row) => row.isp || '-' },
    {
      key: 'vpn',
      label: t('ipAnalytics.vpnProxy'),
      sortable: true,
      sortValue: (row) => (row.proxy || row.hosting ? 'proxy' : 'safe'),
      render: (row) => row.proxy || row.hosting ? (
        <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {t('ipAnalytics.vpnProxy')}
        </span>
      ) : '-',
    },
    { key: 'time', label: t('common.timestamp'), sortable: true, sortValue: (row) => row.timestamp, render: (row) => formatDate(row.timestamp, locale) },
  ], [lang, locale, t])

  return (
    <div className="space-y-6">
      <PageHeader title={t('managerParent.pages.ipAnalytics.title')} description={t('managerParent.pages.ipAnalytics.description')} />

      <PieChartWidget title={t('managerParent.pages.ipAnalytics.countryDistribution')} data={countryStats} nameKey="country" valueKey="count" totalLabel={t('managerParent.pages.ipAnalytics.ips')} />

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,0.9fr)_200px]">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('managerParent.pages.ipAnalytics.searchPlaceholder')} />
          <select value={reputation} onChange={(event) => setReputation(event.target.value as 'all' | 'safe' | 'proxy')} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="all">{t('managerParent.pages.ipAnalytics.allReputationScores')}</option>
            <option value="safe">{t('managerParent.pages.ipAnalytics.low')}</option>
            <option value="proxy">{t('ipAnalytics.vpnProxy')}</option>
          </select>
          <DateRangePicker value={range} onChange={setRange} />
          <Input value={country} onChange={(event) => setCountry(event.target.value)} placeholder={t('ipAnalytics.columns.country')} />
        </CardContent>
      </Card>

      {rows.length === 0 && !logsQuery.isLoading && !logsQuery.isFetching ? (
        <EmptyState
          title={t('ipAnalytics.emptyTitle', { defaultValue: 'No matching IP logs found' })}
          description={t('ipAnalytics.emptyDescription', { defaultValue: 'No matching IP logs found for your tenant software.' })}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(row) => row.id}
          isLoading={logsQuery.isLoading || logsQuery.isFetching}
          pagination={{
            page,
            lastPage: meta?.last_page ?? 1,
            total,
            perPage,
          }}
          onPageChange={(nextPage) => setPage(nextPage)}
          onPageSizeChange={(size) => {
            setPerPage(size)
            setPage(1)
          }}
        />
      )}
    </div>
  )
}
