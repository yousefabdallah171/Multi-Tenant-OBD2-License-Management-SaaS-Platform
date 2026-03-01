import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'
import type { ProgramLog, ProgramLogLicenseInfo } from '@/types/manager-parent.types'
import { formatIpLocation, isPrivateOrLocalIp } from '@/utils/countryFlag'

interface LocationMeta {
  country: string
  city: string
  country_code: string
  org: string
  proxy: boolean
  hosting: boolean
}

function parseProgramLogs(raw: string): ProgramLog[] {
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean)
  const logs: ProgramLog[] = []

  for (const line of lines) {
    const added = line.match(/new user added - (.+?) with bios - (.+?) at time (.+)$/i)
    if (added) {
      logs.push({
        type: 'add',
        username: added[1].trim(),
        bios_id: added[2].trim(),
        timestamp: added[3].trim(),
      })
      continue
    }

    const deleted = line.match(/user deleted - (.+?) at time (.+)$/i)
    if (deleted) {
      logs.push({
        type: 'delete',
        username: deleted[1].trim(),
        timestamp: deleted[2].trim(),
      })
      continue
    }

    const login = line.match(/^(\S+)\s+(.+?)\s+((?:\d{1,3}\.){3}\d{1,3})$/)
    if (login) {
      logs.push({
        type: 'login',
        username: login[1].trim(),
        timestamp: login[2].trim(),
        ip: login[3].trim(),
      })
    }
  }

  return logs
}

function exportCsv(rows: ProgramLog[], fileName: string) {
  const header = 'type,username,bios_id,timestamp,ip'
  const body = rows
    .map((row) => [row.type, row.username, row.bios_id ?? '', row.timestamp, row.ip ?? ''].map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ProgramLogsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'activation' | 'login'>('activation')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [ipMetaCache, setIpMetaCache] = useState<Record<string, LocationMeta>>({})

  const programsQuery = useQuery({
    queryKey: ['manager-parent', 'programs-with-external-api'],
    queryFn: () => managerParentService.getProgramsWithExternalApi(),
  })

  const logsQuery = useQuery({
    queryKey: ['manager-parent', 'program-logs', selectedProgramId],
    queryFn: async () => {
      if (!selectedProgramId) {
        return { raw: '', licenses: {} as Record<string, ProgramLogLicenseInfo[]> }
      }
      return managerParentService.getProgramLogs(selectedProgramId)
    },
    enabled: selectedProgramId !== null,
    refetchInterval: autoRefresh ? 30000 : false,
  })

  const parsedLogs = useMemo(() => parseProgramLogs(logsQuery.data?.raw ?? ''), [logsQuery.data?.raw])
  const licenseMap = logsQuery.data?.licenses ?? {}
  const activationRows = parsedLogs.filter((entry) => entry.type === 'add' || entry.type === 'delete')
  const loginRows = parsedLogs.filter((entry) => entry.type === 'login')

  useEffect(() => {
    if (!programsQuery.data || programsQuery.data.length === 0) {
      setSelectedProgramId(null)
      return
    }

    if (selectedProgramId === null) {
      setSelectedProgramId(programsQuery.data[0].id)
    }
  }, [programsQuery.data, selectedProgramId])

  useEffect(() => {
    const ips: string[] = []
    const seen = new Set<string>()
    for (const row of loginRows) {
      if (!row.ip) {
        continue
      }
      const ip = row.ip
      if (seen.has(ip) || isPrivateOrLocalIp(ip) || ipMetaCache[ip]) {
        continue
      }
      seen.add(ip)
      ips.push(ip)
    }

    if (ips.length === 0) {
      return
    }

    void (async () => {
      const entries = await Promise.all(
        ips.map(async (ip) => {
          try {
            const response = await fetch(`https://ipapi.co/${ip}/json/`)
            if (!response.ok) {
              return [ip, { country: 'Unknown', city: '', country_code: '', org: '', proxy: false, hosting: false } satisfies LocationMeta] as const
            }
            const payload = await response.json() as Record<string, unknown>
            return [ip, {
              country: String(payload.country_name ?? 'Unknown'),
              city: String(payload.city ?? ''),
              country_code: String(payload.country_code ?? ''),
              org: String(payload.org ?? ''),
              proxy: Boolean(payload.proxy),
              hosting: Boolean(payload.hosting),
            } satisfies LocationMeta] as const
          } catch {
            return [ip, { country: 'Unknown', city: '', country_code: '', org: '', proxy: false, hosting: false } satisfies LocationMeta] as const
          }
        }),
      )

      setIpMetaCache((current) => Object.fromEntries([...Object.entries(current), ...entries]))
    })()
  }, [ipMetaCache, loginRows])

  return (
    <div className="space-y-6">
      <PageHeader title={t('programLogs.title')} description={t('managerParent.pages.logs.description')} />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <select
            value={selectedProgramId ?? ''}
            onChange={(event) => setSelectedProgramId(event.target.value ? Number(event.target.value) : null)}
            className="h-11 min-w-[260px] rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('programLogs.selectProgram')}</option>
            {(programsQuery.data ?? []).map((program) => (
              <option key={program.id} value={program.id}>
                {program.name} ({program.external_software_id ?? '-'})
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" className="h-4 w-4" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
            {t('programLogs.autoRefresh')}
          </label>
          <Button type="button" variant="outline" onClick={() => exportCsv(activeTab === 'activation' ? activationRows : loginRows, 'program-logs.csv')} disabled={selectedProgramId === null}>
            <Download className="me-2 h-4 w-4" />
            {t('programLogs.exportCsv')}
          </Button>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'activation' | 'login')}>
        <TabsList>
          <TabsTrigger value="activation">{t('programLogs.activationEvents')}</TabsTrigger>
          <TabsTrigger value="login">{t('programLogs.loginEvents')}</TabsTrigger>
        </TabsList>

        <TabsContent value="activation">
          <Card>
            <CardContent className="p-4">
              {activationRows.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('programLogs.noLogs')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                        <th className="p-2">{t('common.action')}</th>
                        <th className="p-2">{t('common.username')}</th>
                        <th className="p-2">{t('activate.biosId')}</th>
                        <th className="p-2">{t('programLogs.activatedBy')}</th>
                        <th className="p-2">{t('common.timestamp')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activationRows.map((row, index) => {
                        const candidates = row.bios_id ? (licenseMap[row.bios_id] ?? []) : []
                        const match = candidates[0]

                        return (
                          <tr key={`${row.username}-${row.timestamp}-${index}`} className="border-b border-slate-100 dark:border-slate-900">
                            <td className={`p-2 font-medium ${row.type === 'add' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                              {row.type === 'add' ? t('programLogs.eventAdded') : t('programLogs.eventDeleted')}
                            </td>
                            <td className="p-2">{row.username}</td>
                            <td className="p-2">
                              <div className="font-medium">{row.bios_id ?? '-'}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">@{match?.external_username ?? row.username}</div>
                            </td>
                            <td className="p-2">
                              {match?.customer_id ? (
                                <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.customerDetail(lang, match.customer_id)}>
                                  {(match.reseller_name ?? 'External')} <span className="text-xs text-emerald-600 dark:text-emerald-300">{t('programLogs.viaDashboard')}</span>
                                </Link>
                              ) : (
                                <span className="text-slate-500 dark:text-slate-400">{t('programLogs.externalUnknown')}</span>
                              )}
                            </td>
                            <td className="p-2">{row.timestamp}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="login">
          <Card>
            <CardContent className="p-4">
              {loginRows.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('programLogs.noLogs')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                        <th className="p-2">{t('common.username')}</th>
                        <th className="p-2">{t('common.timestamp')}</th>
                        <th className="p-2">{t('managerParent.pages.ipAnalytics.ipAddress')}</th>
                        <th className="p-2">{t('ipAnalytics.columns.location')}</th>
                        <th className="p-2">{t('managerParent.pages.ipAnalytics.isp')}</th>
                        <th className="p-2">{t('ipAnalytics.vpnProxy')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginRows.map((row, index) => {
                        const ip = row.ip ?? ''
                        const local = isPrivateOrLocalIp(ip)
                        const meta = ipMetaCache[ip]

                        return (
                          <tr key={`${row.username}-${row.timestamp}-${index}`} className="border-b border-slate-100 dark:border-slate-900">
                            <td className="p-2">{row.username}</td>
                            <td className="p-2">{row.timestamp}</td>
                            <td className="p-2">{ip || '-'}</td>
                            <td className="p-2">
                              {local ? 'Localhost / Local' : meta ? formatIpLocation(meta.country, meta.city, meta.country_code) : '...'}
                            </td>
                            <td className="p-2">{local ? 'Local' : (meta?.org ?? '-')}</td>
                            <td className="p-2">
                              {local ? '-' : meta?.proxy || meta?.hosting ? (
                                <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                                  {t('ipAnalytics.vpnProxy')}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
