import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
  external_username: string | null
  bios_id: string | null
  customer_id: number | null
  customer_name: string | null
  customer_username: string | null
  license_id: number | null
  program_id: number | null
  program_name: string | null
  ip_address: string
  timestamp: string
  parsed_at: string | null
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
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null)
  const [searchIp, setSearchIp] = useState('')
  const [reputation, setReputation] = useState<'all' | 'safe' | 'proxy'>('all')
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })

  useEffect(() => {
    setPage(1)
  }, [selectedProgramId, searchIp, reputation, range.from, range.to, perPage])

  const programsQuery = useQuery({
    queryKey: ['manager-parent', 'programs-with-external-api'],
    queryFn: () => managerParentService.getProgramsWithExternalApi(),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 24 * 60 * 60 * 1000,
  })

  useEffect(() => {
    if (!programsQuery.data || programsQuery.data.length === 0) {
      setSelectedProgramId(null)
      return
    }

    if (selectedProgramId === null || !programsQuery.data.some((program) => program.id === selectedProgramId)) {
      setSelectedProgramId(programsQuery.data[0].id)
    }
  }, [programsQuery.data, selectedProgramId])

  const logsQuery = useQuery({
    queryKey: ['manager-parent', 'ip-analytics', selectedProgramId, page, perPage, searchIp, reputation, range.from, range.to],
    queryFn: () => managerParentService.getIpAnalytics({
      program_id: selectedProgramId as number,
      page,
      per_page: perPage,
      search: searchIp || undefined,
      reputation,
      from: range.from || undefined,
      to: range.to || undefined,
    }),
    enabled: selectedProgramId !== null,
  })

  const rows = useMemo<SoftwareIpRow[]>(() => (logsQuery.data?.data ?? []).map((row, index) => ({
    id: `${row.ip_address}-${row.parsed_at ?? row.timestamp}-${index}`,
    username: row.username,
    external_username: row.external_username ?? null,
    bios_id: row.bios_id ?? null,
    customer_id: row.customer_id ?? null,
    customer_name: row.customer_name ?? null,
    customer_username: row.customer_username ?? null,
    license_id: row.license_id ?? null,
    program_id: row.program_id ?? null,
    program_name: row.program_name ?? null,
    ip_address: row.ip_address,
    timestamp: row.timestamp,
    parsed_at: row.parsed_at ?? null,
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

    return Object.entries(grouped).map(([country, count]) => ({ country, count }))
  }, [rows])

  const meta = logsQuery.data?.meta
  const total = logsQuery.data?.meta.total ?? 0

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
    {
      key: 'time',
      label: t('common.timestamp'),
      sortable: true,
      sortValue: (row) => row.parsed_at ?? row.timestamp,
      render: (row) => (row.parsed_at ? formatDate(row.parsed_at, locale) : row.timestamp),
    },
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
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,0.9fr)_minmax(0,1fr)_180px_minmax(0,0.9fr)]">
          <select
            value={selectedProgramId ?? ''}
            onChange={(event) => setSelectedProgramId(event.target.value ? Number(event.target.value) : null)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('programLogs.selectProgram')}</option>
            {(programsQuery.data ?? []).map((program) => (
              <option key={program.id} value={program.id}>
                {program.name} ({program.external_software_id ?? '-'})
              </option>
            ))}
          </select>
          <Input value={searchIp} onChange={(event) => setSearchIp(event.target.value)} placeholder={t('managerParent.pages.ipAnalytics.searchPlaceholder')} />
          <select value={reputation} onChange={(event) => setReputation(event.target.value as 'all' | 'safe' | 'proxy')} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="all">{t('managerParent.pages.ipAnalytics.allReputationScores')}</option>
            <option value="safe">{t('managerParent.pages.ipAnalytics.low')}</option>
            <option value="proxy">{t('ipAnalytics.vpnProxy')}</option>
          </select>
          <DateRangePicker value={range} onChange={setRange} />
          <p className="lg:col-span-4 text-xs text-slate-500 dark:text-slate-400">
            {t('programLogs.dynamicHint')}
          </p>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(row) => row.id}
        isLoading={programsQuery.isLoading || logsQuery.isLoading || logsQuery.isFetching}
        pagination={{
          page,
          lastPage: meta?.last_page ?? 1,
          total,
          perPage,
        }}
        onPageChange={(nextPage) => {
          setPage(nextPage)
        }}
        onPageSizeChange={(size) => {
          setPerPage(size)
          setPage(1)
        }}
      />
    </div>
  )
}
