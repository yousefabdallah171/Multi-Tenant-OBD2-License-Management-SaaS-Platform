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
import { formatIpLocation, isPrivateOrLocalIp } from '@/utils/countryFlag'

interface SoftwareIpRow {
  id: string
  username: string
  ip_address: string
  timestamp: string
  country: string
  city: string
  country_code: string
  isp: string
  proxy: boolean
  hosting: boolean
}

function parseLoginRows(raw: string): Array<{ username: string; ip_address: string; timestamp: string }> {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\S+)\s+(.+?)\s+((?:\d{1,3}\.){3}\d{1,3})$/)
      if (!match) {
        return null
      }

      return {
        username: match[1].trim(),
        timestamp: match[2].trim(),
        ip_address: match[3].trim(),
      }
    })
    .filter((row): row is { username: string; ip_address: string; timestamp: string } => row !== null)
}

export function IpAnalyticsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(15)
  const [searchIp, setSearchIp] = useState('')
  const [softwareId, setSoftwareId] = useState<number | ''>('')
  const [reputation, setReputation] = useState<'all' | 'safe' | 'proxy'>('all')
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })
  const [geoCache, setGeoCache] = useState<Record<string, Omit<SoftwareIpRow, 'id' | 'username' | 'ip_address' | 'timestamp'>>>({})

  const programsQuery = useQuery({
    queryKey: ['manager-parent', 'programs-with-external-api'],
    queryFn: () => managerParentService.getProgramsWithExternalApi(),
  })

  const logsQuery = useQuery({
    queryKey: ['manager-parent', 'ip-analytics', 'program-logs', softwareId],
    queryFn: async () => {
      if (!softwareId) {
        return { raw: '' }
      }
      return managerParentService.getProgramLogs(softwareId)
    },
    enabled: softwareId !== '',
  })

  const baseRows = useMemo(() => parseLoginRows(logsQuery.data?.raw ?? ''), [logsQuery.data?.raw])

  useEffect(() => {
    if (programsQuery.data?.length && softwareId === '') {
      setSoftwareId(programsQuery.data[0].id)
    }
  }, [programsQuery.data, softwareId])

  useEffect(() => {
    const ips = Array.from(new Set(baseRows.map((row) => row.ip_address))).filter((ip) => !isPrivateOrLocalIp(ip) && !geoCache[ip])
    if (ips.length === 0) {
      return
    }

    void (async () => {
      const entries = await Promise.all(
        ips.map(async (ip) => {
          try {
            const response = await fetch(`https://ipapi.co/${ip}/json/`)
            if (!response.ok) {
              return [ip, { country: 'Unknown', city: '', country_code: '', isp: '', proxy: false, hosting: false }] as const
            }

            const payload = await response.json() as Record<string, unknown>
            return [ip, {
              country: String(payload.country_name ?? 'Unknown'),
              city: String(payload.city ?? ''),
              country_code: String(payload.country_code ?? ''),
              isp: String(payload.org ?? ''),
              proxy: Boolean(payload.proxy),
              hosting: Boolean(payload.hosting),
            }] as const
          } catch {
            return [ip, { country: 'Unknown', city: '', country_code: '', isp: '', proxy: false, hosting: false }] as const
          }
        }),
      )

      setGeoCache((current) => Object.fromEntries([...Object.entries(current), ...entries]))
    })()
  }, [baseRows, geoCache])

  const rows = useMemo<SoftwareIpRow[]>(() => baseRows.map((row, index) => {
    if (isPrivateOrLocalIp(row.ip_address)) {
      return {
        id: `${row.ip_address}-${index}`,
        username: row.username,
        ip_address: row.ip_address,
        timestamp: row.timestamp,
        country: 'Localhost',
        city: 'Local',
        country_code: '',
        isp: 'Local',
        proxy: false,
        hosting: false,
      }
    }

    const geo = geoCache[row.ip_address] ?? { country: 'Unknown', city: '', country_code: '', isp: '', proxy: false, hosting: false }

    return {
      id: `${row.ip_address}-${index}`,
      username: row.username,
      ip_address: row.ip_address,
      timestamp: row.timestamp,
      ...geo,
    }
  }), [baseRows, geoCache])

  const filtered = useMemo(() => rows.filter((row) => {
    if (searchIp && !row.ip_address.toLowerCase().includes(searchIp.toLowerCase()) && !row.username.toLowerCase().includes(searchIp.toLowerCase())) {
      return false
    }

    if (reputation === 'proxy' && !(row.proxy || row.hosting)) {
      return false
    }

    if (reputation === 'safe' && (row.proxy || row.hosting)) {
      return false
    }

    if (range.from || range.to) {
      const time = Date.parse(row.timestamp)
      if (!Number.isNaN(time)) {
        if (range.from && time < Date.parse(range.from)) {
          return false
        }
        if (range.to && time > Date.parse(`${range.to}T23:59:59`)) {
          return false
        }
      }
    }

    return true
  }), [reputation, rows, searchIp, range.from, range.to])

  const paged = useMemo(() => {
    const start = (page - 1) * perPage
    return filtered.slice(start, start + perPage)
  }, [filtered, page, perPage])

  const countryStats = useMemo(() => {
    const grouped = filtered.reduce<Record<string, number>>((acc, row) => {
      const key = row.country || 'Unknown'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    return Object.entries(grouped).map(([country, count]) => ({ country, count }))
  }, [filtered])

  const columns = useMemo<Array<DataTableColumn<SoftwareIpRow>>>(() => [
    { key: 'username', label: t('common.username'), sortable: true, sortValue: (row) => row.username, render: (row) => row.username },
    { key: 'ip', label: t('managerParent.pages.ipAnalytics.ipAddress'), sortable: true, sortValue: (row) => row.ip_address, render: (row) => <code>{row.ip_address}</code> },
    { key: 'location', label: t('ipAnalytics.columns.location'), sortable: true, sortValue: (row) => `${row.country} ${row.city}`, render: (row) => formatIpLocation(row.country, row.city, row.country_code) },
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
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px_180px_minmax(0,0.9fr)]">
          <Input value={searchIp} onChange={(event) => setSearchIp(event.target.value)} placeholder={t('managerParent.pages.ipAnalytics.searchPlaceholder')} />
          <select value={softwareId} onChange={(event) => setSoftwareId(event.target.value ? Number(event.target.value) : '')} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="">{t('programLogs.selectProgram')}</option>
            {(programsQuery.data ?? []).map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
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
        isLoading={logsQuery.isLoading}
        pagination={{
          page,
          lastPage: Math.max(1, Math.ceil(filtered.length / perPage)),
          total: filtered.length,
          perPage,
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
