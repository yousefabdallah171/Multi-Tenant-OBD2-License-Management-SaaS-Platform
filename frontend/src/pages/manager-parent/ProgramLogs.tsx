import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'
import type { ProgramLog, ProgramLogSummary, ProgramUserLogEntry } from '@/types/manager-parent.types'
import type { UserRole } from '@/types/user.types'
import { IpLocationCell, isPrivateOrLocalIp } from '@/utils/countryFlag'

interface LocationMeta {
  country: string
  city: string
  country_code: string
  org: string
  proxy: boolean
  hosting: boolean
}

const ACTION_OPTIONS = [
  'license.activated',
  'license.scheduled',
  'license.scheduled_activation_executed',
  'license.renewed',
  'license.deactivated',
  'license.paused',
  'license.resumed',
  'license.scheduled_activation_failed',
  'manager.program.activate',
  'license.delete',
] as const

function exportUserCsv(rows: ProgramUserLogEntry[], fileName: string) {
  const header = 'action,actor_name,actor_role,customer_name,external_username,bios_id,price,timestamp'
  const body = rows
    .map((row) => [
      row.action,
      row.actor?.name ?? '',
      row.actor?.role ?? '',
      row.customer_name ?? '',
      resolveProgramLogUsername(row),
      row.bios_id,
      row.price ?? '',
      row.created_at ?? '',
    ].map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function exportLoginCsv(rows: ProgramLog[], fileName: string) {
  const header = 'username,timestamp,ip'
  const body = rows
    .map((row) => [row.username, row.timestamp, row.ip ?? ''].map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
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
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(15)
  const [sellerId, setSellerId] = useState<number | ''>('')
  const [action, setAction] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'users' | 'login'>('users')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [ipMetaCache, setIpMetaCache] = useState<Record<string, LocationMeta>>({})

  const programsQuery = useQuery({
    queryKey: ['manager-parent', 'programs-with-external-api'],
    queryFn: () => managerParentService.getProgramsWithExternalApi(),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const logsQuery = useQuery({
    queryKey: ['manager-parent', 'program-logs', selectedProgramId, page, perPage, sellerId, action, autoRefresh],
    queryFn: () => {
      if (!selectedProgramId) {
        return Promise.resolve({
          raw: '',
          rows: [],
          user_rows: [],
          users: [],
          summary: {
            total_entries: 0,
            activations: 0,
            scheduled: 0,
            executed: 0,
            renewals: 0,
            deactivations: 0,
            failures: 0,
          } satisfies ProgramLogSummary,
          external_available: true,
          meta: { page: 1, per_page: perPage, total: 0, last_page: 1, has_next_page: false, next_page: null },
        })
      }

      return managerParentService.getProgramLogs(selectedProgramId, {
        page,
        per_page: perPage,
        seller_id: sellerId || undefined,
        action: action || undefined,
      })
    },
    enabled: selectedProgramId !== null,
    refetchInterval: autoRefresh ? 30000 : false,
  })

  useEffect(() => {
    if (!programsQuery.data || programsQuery.data.length === 0) {
      setSelectedProgramId(null)
      return
    }

    if (selectedProgramId === null) {
      setSelectedProgramId(programsQuery.data[0].id)
    }
  }, [programsQuery.data, selectedProgramId])

  const loginRows = useMemo(() => (logsQuery.data?.rows ?? []).filter((entry) => entry.type === 'login'), [logsQuery.data?.rows])
  const userRows = logsQuery.data?.user_rows ?? []
  const userOptions = logsQuery.data?.users ?? []
  const summary = logsQuery.data?.summary ?? {
    total_entries: 0,
    activations: 0,
    scheduled: 0,
    executed: 0,
    renewals: 0,
    deactivations: 0,
    failures: 0,
  }

  useEffect(() => {
    const ips: string[] = []
    const seen = new Set<string>()

    for (const row of loginRows) {
      const ip = row.ip ?? ''
      if (!ip || seen.has(ip) || isPrivateOrLocalIp(ip) || ipMetaCache[ip]) {
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
              return [ip, { country: t('programLogs.unknownLocation'), city: '', country_code: '', org: '', proxy: false, hosting: false } satisfies LocationMeta] as const
            }

            const payload = await response.json() as Record<string, unknown>
            return [ip, {
              country: String(payload.country_name ?? t('programLogs.unknownLocation')),
              city: String(payload.city ?? ''),
              country_code: String(payload.country_code ?? ''),
              org: String(payload.org ?? ''),
              proxy: Boolean(payload.proxy),
              hosting: Boolean(payload.hosting),
            } satisfies LocationMeta] as const
          } catch {
            return [ip, { country: t('programLogs.unknownLocation'), city: '', country_code: '', org: '', proxy: false, hosting: false } satisfies LocationMeta] as const
          }
        }),
      )

      setIpMetaCache((current) => Object.fromEntries([...Object.entries(current), ...entries]))
    })()
  }, [ipMetaCache, loginRows, t])

  const userColumns = useMemo<Array<DataTableColumn<ProgramUserLogEntry>>>(() => [
    {
      key: 'created_at',
      label: t('common.timestamp'),
      sortable: true,
      sortValue: (row) => row.created_at ?? '',
      render: (row) => row.created_at ? formatDate(row.created_at, locale) : '-',
    },
    {
      key: 'actor',
      label: t('common.user'),
      sortable: true,
      sortValue: (row) => row.actor?.name ?? '',
      render: (row) => {
        const role = normalizeRole(row.actor?.role)

        return row.actor ? (
          <div className="space-y-1">
            <button
              type="button"
              className="text-start font-medium text-sky-600 hover:underline dark:text-sky-300"
              onClick={() => {
                setSellerId(row.actor?.id ?? '')
                setPage(1)
              }}
            >
              {row.actor.name}
            </button>
            {role ? <RoleBadge role={role} /> : null}
          </div>
        ) : '-'
      },
    },
    {
      key: 'action',
      label: t('common.action'),
      sortable: true,
      sortValue: (row) => row.action,
      render: (row) => <ActionPill label={getActionLabel(row.action, t)} action={row.action} />,
    },
    {
      key: 'customer',
      label: t('common.customer'),
      sortable: true,
      sortValue: (row) => row.customer_name ?? '',
      render: (row) => row.customer_id ? (
        <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.customerDetail(lang, row.customer_id)}>
          {row.customer_name ?? row.customer_username ?? '-'}
        </Link>
      ) : (row.customer_name ?? row.customer_username ?? '-'),
    },
    {
      key: 'username',
      label: t('common.username'),
      sortable: true,
      sortValue: (row) => resolveProgramLogUsername(row),
      render: (row) => {
        const username = resolveProgramLogUsername(row)
        return username === '-' ? '-' : `@${username}`
      },
    },
    {
      key: 'bios_id',
      label: t('activate.biosId'),
      sortable: true,
      sortValue: (row) => row.bios_id,
      render: (row) => row.bios_id ? (
        <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.biosDetail(lang, row.bios_id)}>
          {row.bios_id}
        </Link>
      ) : '-',
    },
    {
      key: 'status',
      label: t('common.status'),
      sortable: true,
      sortValue: (row) => row.license_status ?? '',
      render: (row) => row.license_status
        ? <StatusBadge status={row.license_status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending' | 'cancelled'} />
        : '-',
    },
    {
      key: 'price',
      label: t('common.price'),
      sortable: true,
      sortValue: (row) => row.price ?? 0,
      render: (row) => row.price === null ? '-' : formatCurrency(row.price, 'USD', locale),
    },
  ], [lang, locale, t])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('programLogs.title')}
        description={t('programLogs.description')}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => activeTab === 'users'
              ? exportUserCsv(userRows, 'program-user-logs.csv')
              : exportLoginCsv(loginRows, 'program-login-logs.csv')}
            disabled={selectedProgramId === null}
          >
            <Download className="me-2 h-4 w-4" />
            {t('programLogs.exportCsv')}
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[260px_240px_240px_minmax(0,1fr)]">
          <select
            value={selectedProgramId ?? ''}
            onChange={(event) => {
              setSelectedProgramId(event.target.value ? Number(event.target.value) : null)
              setSellerId('')
              setAction('')
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('programLogs.selectProgram')}</option>
            {(programsQuery.data ?? []).map((program) => (
              <option key={program.id} value={program.id}>
                {program.name} ({program.external_software_id ?? '-'})
              </option>
            ))}
          </select>
          <select
            value={sellerId}
            onChange={(event) => {
              setSellerId(event.target.value ? Number(event.target.value) : '')
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('programLogs.allUsers')}</option>
            {userOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} ({getRoleLabel(option.role, t)})
              </option>
            ))}
          </select>
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('programLogs.allActions')}</option>
            {ACTION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {getActionLabel(option, t)}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <span>{t('programLogs.dynamicHint')}</span>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
              {t('programLogs.autoRefresh')}
            </label>
          </div>
        </CardContent>
      </Card>

      {logsQuery.data?.external_available === false ? (
        <Card className="border-amber-300 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="p-4 text-sm text-amber-900 dark:text-amber-200">
            {t('programLogs.externalUnavailable')}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label={t('common.actions')} value={summary.total_entries} />
        <MetricCard label={t('common.activate')} value={summary.activations} />
        <MetricCard label={t('programLogs.actionScheduled')} value={summary.scheduled} />
        <MetricCard label={t('programLogs.actionExecuted')} value={summary.executed} />
        <MetricCard label={t('common.renew')} value={summary.renewals} />
        <MetricCard label={t('programLogs.actionFailed')} value={summary.failures} />
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'users' | 'login')}>
        <TabsList>
          <TabsTrigger value="users">{t('programLogs.userActions')}</TabsTrigger>
          <TabsTrigger value="login">{t('programLogs.loginEvents')}</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <DataTable
            columns={userColumns}
            data={userRows}
            rowKey={(row) => row.id}
            isLoading={logsQuery.isLoading}
            emptyMessage={t('programLogs.noLogs')}
            pagination={{
              page: logsQuery.data?.meta?.page ?? 1,
              lastPage: logsQuery.data?.meta?.last_page ?? 1,
              total: logsQuery.data?.meta?.total ?? 0,
              perPage: logsQuery.data?.meta?.per_page ?? perPage,
            }}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPerPage(size)
              setPage(1)
            }}
          />
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
                            <td className="p-2">
                              {row.customer_id ? (
                                <Link className="text-blue-600 hover:underline dark:text-blue-300" to={routePaths.managerParent.customerDetail(lang, row.customer_id)}>
                                  @{row.username}
                                </Link>
                              ) : (
                                <span>@{row.username}</span>
                              )}
                            </td>
                            <td className="p-2">{row.timestamp}</td>
                            <td className="p-2">{ip || '-'}</td>
                            <td className="p-2">
                              {local
                                ? t('programLogs.localLocation')
                                : meta
                                  ? <IpLocationCell country={meta.country} city={meta.city} countryCode={meta.country_code} />
                                  : t('programLogs.loadingLocation')}
                            </td>
                            <td className="p-2">{local ? t('programLogs.localNetwork') : (meta?.org ?? '-')}</td>
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

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <div className="mt-2 font-semibold text-slate-950 dark:text-white">{value}</div>
      </CardContent>
    </Card>
  )
}

function ActionPill({ label, action }: { label: string; action: string }) {
  const styles: Record<string, string> = {
    'license.activated': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    'manager.program.activate': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    'license.scheduled': 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    'license.scheduled_activation_executed': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
    'license.renewed': 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
    'license.deactivated': 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    'license.paused': 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
    'license.resumed': 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
    'license.scheduled_activation_failed': 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    'license.delete': 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  }

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[action] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{label}</span>
}

function normalizeRole(role: string | null | undefined): UserRole | null {
  return role === 'manager_parent' || role === 'manager' || role === 'reseller' || role === 'customer' || role === 'super_admin'
    ? role
    : null
}

function getRoleLabel(role: string | null | undefined, t: (key: string, options?: Record<string, unknown>) => string) {
  const normalized = normalizeRole(role)
  return normalized ? t(`roles.${normalized}`) : (role ?? '-')
}

function getActionLabel(action: string, t: (key: string, options?: Record<string, unknown>) => string) {
  if (action === 'license.activated' || action === 'manager.program.activate') {
    return t('common.activate')
  }

  if (action === 'license.scheduled') {
    return t('programLogs.actionScheduled')
  }

  if (action === 'license.scheduled_activation_executed') {
    return t('programLogs.actionExecuted')
  }

  if (action === 'license.renewed') {
    return t('common.renew')
  }

  if (action === 'license.deactivated') {
    return t('common.deactivate')
  }

  if (action === 'license.paused') {
    return t('common.pause')
  }

  if (action === 'license.resumed') {
    return t('common.resume')
  }

  if (action === 'license.scheduled_activation_failed') {
    return t('programLogs.actionFailed')
  }

  if (action === 'license.delete') {
    return t('common.delete')
  }

  return action
}

function resolveProgramLogUsername(row: ProgramUserLogEntry) {
  const externalUsername = (row.external_username ?? '').trim()
  const customerUsername = (row.customer_username ?? '').trim()
  const customerName = (row.customer_name ?? '').trim()

  if (!externalUsername) {
    return customerUsername || '-'
  }

  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (
    customerUsername &&
    customerName &&
    normalize(externalUsername) === normalize(customerName) &&
    normalize(customerUsername) !== normalize(customerName)
  ) {
    return customerUsername
  }

  return externalUsername
}
