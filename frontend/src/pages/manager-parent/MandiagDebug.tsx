import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bug } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { managerParentService } from '@/services/manager-parent.service'
import type {
  MandiagDebugLog,
  MandiagLocalLicense,
  MandiagLocalReseller,
  MandiagWebhookEventRow,
} from '@/types/manager-parent.types'

function statusGroup(statusCode: number) {
  if (statusCode >= 500) return 'offline'
  if (statusCode >= 400) return 'degraded'
  return 'online'
}

const WEBHOOK_EVENT_TYPES = ['license_expired', 'license_renewed', 'license_disabled', 'license_enabled', 'balance_low']

const WEBHOOK_DEFAULTS: Record<string, Record<string, unknown>> = {
  license_expired: {
    license_id: 12345,
    hwid: 'ABC123DEF456',
    customer: 'customer@example.com',
  },
  license_renewed: {
    license_id: 12345,
    new_expire_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  },
  license_disabled: {
    license_id: 12345,
    reason: 'Payment failed',
  },
  license_enabled: {
    license_id: 12345,
  },
  balance_low: {
    current_balance: 100.50,
    threshold: 200.00,
  },
}

export function MandiagDebugPage() {
  const { t } = useTranslation()
  const { lang, isRtl } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [activeTab, setActiveTab] = useState<'logs' | 'licenses' | 'resellers' | 'webhook-events' | 'test-webhook'>('logs')

  // Filter states for each tab
  const [logPage, setLogPage] = useState(1)
  const [logMethod, setLogMethod] = useState('')
  const [logStatusGroup, setLogStatusGroup] = useState('')
  const [logDateRange, setLogDateRange] = useState({ from: '', to: '' })
  const [logAutoRefresh, setLogAutoRefresh] = useState(false)
  const [selectedLog, setSelectedLog] = useState<MandiagDebugLog | null>(null)

  const [licensePage, setLicensePage] = useState(1)
  const [licenseStatus, setLicenseStatus] = useState('')
  const [licenseSearch, setLicenseSearch] = useState('')

  const [resellerPage, setResellerPage] = useState(1)

  const [webhookPage, setWebhookPage] = useState(1)
  const [webhookEventType, setWebhookEventType] = useState('')

  const [pingLoading, setPingLoading] = useState(false)
  const [pingResult, setPingResult] = useState<unknown>(null)

  const [testWebhookEventType, setTestWebhookEventType] = useState('license_expired')
  const [testWebhookData, setTestWebhookData] = useState(JSON.stringify(WEBHOOK_DEFAULTS.license_expired, null, 2))
  const [testWebhookLoading, setTestWebhookLoading] = useState(false)
  const [testWebhookResult, setTestWebhookResult] = useState<unknown>(null)

  // Queries
  const logsQuery = useQuery({
    queryKey: ['mandiag', 'debug', 'logs', logPage, logMethod, logStatusGroup, logDateRange, logAutoRefresh],
    queryFn: () =>
      managerParentService.getMandiagDebugLogs({
        page: logPage,
        per_page: 15,
        method: logMethod || undefined,
        status_group: logStatusGroup || undefined,
        from: logDateRange.from || undefined,
        to: logDateRange.to || undefined,
      }),
    refetchInterval: logAutoRefresh ? 15000 : false,
  })

  const logDetailQuery = useQuery({
    queryKey: ['mandiag', 'debug', 'logs', 'detail', selectedLog?.id],
    queryFn: () => managerParentService.getMandiagDebugLogDetail(selectedLog!.id),
    enabled: selectedLog !== null,
  })

  const licensesQuery = useQuery({
    queryKey: ['mandiag', 'debug', 'local-licenses', licensePage, licenseStatus, licenseSearch],
    queryFn: () =>
      managerParentService.getMandiagLocalLicenses({
        page: licensePage,
        per_page: 25,
        status: licenseStatus || undefined,
        search: licenseSearch || undefined,
      }),
  })

  const resellersQuery = useQuery({
    queryKey: ['mandiag', 'debug', 'local-resellers', resellerPage],
    queryFn: () =>
      managerParentService.getMandiagLocalResellers({
        page: resellerPage,
        per_page: 25,
      }),
  })

  const webhookEventsQuery = useQuery({
    queryKey: ['mandiag', 'debug', 'webhook-events', webhookPage, webhookEventType],
    queryFn: () =>
      managerParentService.getMandiagWebhookEvents({
        page: webhookPage,
        per_page: 25,
        event_type: webhookEventType || undefined,
      }),
    refetchInterval: 30000,
  })

  // Handlers
  const handlePing = async () => {
    setPingLoading(true)
    try {
      const result = await managerParentService.pingMandiag()
      setPingResult(result)
    } catch (error) {
      setPingResult({ error: (error as Error).message })
    } finally {
      setPingLoading(false)
    }
  }

  const handleTestWebhook = async () => {
    setTestWebhookLoading(true)
    try {
      const data = JSON.parse(testWebhookData)
      const result = await managerParentService.testMandiagWebhook({
        event_type: testWebhookEventType,
        data,
      })
      setTestWebhookResult(result)
      webhookEventsQuery.refetch()
    } catch (error) {
      setTestWebhookResult({ error: (error as Error).message })
    } finally {
      setTestWebhookLoading(false)
    }
  }

  const handleWebhookEventTypeChange = (eventType: string) => {
    setTestWebhookEventType(eventType)
    setTestWebhookData(JSON.stringify(WEBHOOK_DEFAULTS[eventType] ?? {}, null, 2))
  }

  // Stats for summary cards
  const todayLogs = logsQuery.data?.data ?? []
  const errorCount = todayLogs.filter((log) => log.status_code >= 400).length
  const lastWebhook = webhookEventsQuery.data?.data?.[0]?.processed_at

  // Column definitions
  const logColumns: Array<DataTableColumn<MandiagDebugLog>> = [
    {
      key: 'timestamp',
      label: t('managerParent.pages.mandiagDebug.apiLogs.columns.timestamp'),
      sortable: true,
      sortValue: (row) => row.created_at ?? '',
      render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-'),
    },
    {
      key: 'method',
      label: t('managerParent.pages.mandiagDebug.apiLogs.columns.method'),
      sortable: true,
      sortValue: (row) => row.method,
      render: (row) => row.method,
      hideOnMobile: true,
    },
    {
      key: 'endpoint',
      label: t('managerParent.pages.mandiagDebug.apiLogs.columns.endpoint'),
      sortable: true,
      sortValue: (row) => row.endpoint,
      render: (row) => <code className="text-xs break-all" dir={isRtl ? 'rtl' : 'ltr'}>{row.endpoint}</code>,
      hideOnMobile: true,
    },
    {
      key: 'status',
      label: t('managerParent.pages.mandiagDebug.apiLogs.columns.status'),
      sortable: true,
      sortValue: (row) => row.status_code,
      render: (row) => <StatusBadge status={statusGroup(row.status_code)} />,
    },
    {
      key: 'time',
      label: t('managerParent.pages.mandiagDebug.apiLogs.columns.responseTime'),
      sortable: true,
      sortValue: (row) => row.response_time_ms,
      render: (row) => `${row.response_time_ms}ms`,
      hideOnMobile: true,
    },
    {
      key: 'actions',
      label: t('managerParent.pages.mandiagDebug.apiLogs.columns.actions'),
      render: (row) => (
        <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedLog(row)}>
          {t('managerParent.pages.mandiagDebug.view')}
        </Button>
      ),
    },
  ]

  const licenseColumns: Array<DataTableColumn<MandiagLocalLicense>> = [
    {
      key: 'mandiag_license_id',
      label: t('managerParent.pages.mandiagDebug.licenses.columns.mandiagId'),
      alwaysVisible: true,
      render: (row) => row.mandiag_license_id
    },
    {
      key: 'external_username',
      label: t('managerParent.pages.mandiagDebug.licenses.columns.customer'),
      render: (row) => row.external_username ?? '-',
      hideOnMobile: true,
    },
    {
      key: 'bios_id',
      label: t('managerParent.pages.mandiagDebug.licenses.columns.biosId'),
      render: (row) => row.bios_id ?? '-',
      hideOnMobile: true,
    },
    {
      key: 'software_key',
      label: t('managerParent.pages.mandiagDebug.licenses.columns.software'),
      render: (row) => row.software_key ?? '-'
    },
    {
      key: 'duration_days',
      label: t('managerParent.pages.mandiagDebug.licenses.columns.duration'),
      render: (row) => `${row.duration_days} days`,
      hideOnMobile: true,
    },
    {
      key: 'status',
      label: t('managerParent.pages.mandiagDebug.licenses.columns.status'),
      render: (row) => <span className="text-sm font-medium">{row.status}</span>
    },
    {
      key: 'activated_at',
      label: t('managerParent.pages.mandiagDebug.licenses.columns.activated'),
      render: (row) => (row.activated_at ? formatDate(row.activated_at, locale) : '-'),
      hideOnMobile: true,
    },
    {
      key: 'expires_at',
      label: t('managerParent.pages.mandiagDebug.licenses.columns.expires'),
      render: (row) => (row.expires_at ? formatDate(row.expires_at, locale) : '-'),
      hideOnMobile: true,
    },
    {
      key: 'reseller_name',
      label: t('managerParent.pages.mandiagDebug.licenses.columns.reseller'),
      render: (row) => row.reseller_name ?? '-',
      hideOnMobile: true,
    },
  ]

  const resellerColumns: Array<DataTableColumn<MandiagLocalReseller>> = [
    {
      key: 'name',
      label: t('managerParent.pages.mandiagDebug.resellers.columns.name'),
      alwaysVisible: true,
      render: (row) => row.name
    },
    {
      key: 'username',
      label: t('managerParent.pages.mandiagDebug.resellers.columns.username'),
      render: (row) => row.username,
      hideOnMobile: true,
    },
    {
      key: 'mandiag_sub_id',
      label: t('managerParent.pages.mandiagDebug.resellers.columns.mandiagSubId'),
      render: (row) => <code className="text-xs break-all" dir="ltr">{row.mandiag_sub_id}</code>
    },
    {
      key: 'software_keys',
      label: t('managerParent.pages.mandiagDebug.resellers.columns.pricedSoftwareKeys'),
      render: (row) => (row.mandiag_priced_software_keys?.length ? row.mandiag_priced_software_keys.join(', ') : '-'),
      hideOnMobile: true,
    },
    {
      key: 'status',
      label: t('managerParent.pages.mandiagDebug.resellers.columns.status'),
      render: (row) => <span className="text-sm font-medium">{row.status}</span>
    },
    {
      key: 'created_at',
      label: t('managerParent.pages.mandiagDebug.resellers.columns.created'),
      render: (row) => formatDate(row.created_at, locale),
      hideOnMobile: true,
    },
  ]

  const webhookColumns: Array<DataTableColumn<MandiagWebhookEventRow>> = [
    {
      key: 'event_id',
      label: t('managerParent.pages.mandiagDebug.webhooks.columns.eventId'),
      alwaysVisible: true,
      render: (row) => <code className="text-xs break-all" dir="ltr">{row.event_id}</code>
    },
    {
      key: 'event_type',
      label: t('managerParent.pages.mandiagDebug.webhooks.columns.eventType'),
      render: (row) => row.event_type
    },
    {
      key: 'occurred_at',
      label: t('managerParent.pages.mandiagDebug.webhooks.columns.occurred'),
      render: (row) => (row.occurred_at ? formatDate(row.occurred_at, locale) : '-'),
      hideOnMobile: true,
    },
    {
      key: 'processed_at',
      label: t('managerParent.pages.mandiagDebug.webhooks.columns.processed'),
      render: (row) => (row.processed_at ? formatDate(row.processed_at, locale) : '-'),
      hideOnMobile: true,
    },
    {
      key: 'actions',
      label: t('managerParent.pages.mandiagDebug.webhooks.columns.payload'),
      render: (row) => (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setSelectedLog({
              ...row,
              id: row.id,
              method: '',
              endpoint: '',
              user: null,
              response_time_ms: 0,
              status_code: 200,
              created_at: row.processed_at ?? '',
              response_body: row.payload
            } as never)
          }}
        >
          {t('managerParent.pages.mandiagDebug.view')}
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-xl sm:text-2xl lg:text-3xl font-semibold">
            <Bug className="h-6 w-6 sm:h-8 sm:w-8" />
            {t('managerParent.pages.mandiagDebug.title')}
          </h2>
          <p className="max-w-3xl text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t('managerParent.pages.mandiagDebug.description')}
          </p>
        </div>
      </div>

      {/* Summary Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title={t('managerParent.pages.mandiagDebug.statsCards.apiCallsToday')}
          value={todayLogs.length}
          color="emerald"
        />
        <StatsCard
          title={t('managerParent.pages.mandiagDebug.statsCards.errorsToday')}
          value={errorCount}
          color={errorCount > 0 ? 'rose' : 'emerald'}
        />
        <StatsCard
          title={t('managerParent.pages.mandiagDebug.statsCards.lastWebhook')}
          value={lastWebhook ? formatDate(lastWebhook, locale) : t('managerParent.pages.mandiagDebug.never')}
          color="sky"
        />
      </div>

      {/* Health Check Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-base">{t('managerParent.pages.mandiagDebug.health.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-3 md:p-4">
          <Button
            onClick={handlePing}
            disabled={pingLoading}
            size="lg"
            className="w-full sm:w-auto"
          >
            {pingLoading ? t('managerParent.pages.mandiagDebug.health.pinging') : t('managerParent.pages.mandiagDebug.health.ping')}
          </Button>
          {pingResult && (
            <div className="space-y-2 overflow-x-auto">
              <pre
                className="rounded-lg bg-slate-950 p-2 md:p-3 text-xs text-slate-100 dark:bg-slate-900 overflow-x-auto"
                dir={isRtl ? 'rtl' : 'ltr'}
              >
                {JSON.stringify(pingResult, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 h-auto">
          <TabsTrigger value="logs" className="text-xs sm:text-sm">{t('managerParent.pages.mandiagDebug.tabs.apiLogs')}</TabsTrigger>
          <TabsTrigger value="licenses" className="text-xs sm:text-sm">{t('managerParent.pages.mandiagDebug.tabs.activeLicenses')}</TabsTrigger>
          <TabsTrigger value="resellers" className="text-xs sm:text-sm">{t('managerParent.pages.mandiagDebug.tabs.resellers')}</TabsTrigger>
          <TabsTrigger value="webhook-events" className="text-xs sm:text-sm">{t('managerParent.pages.mandiagDebug.tabs.webhookEvents')}</TabsTrigger>
          <TabsTrigger value="test-webhook" className="text-xs sm:text-sm">{t('managerParent.pages.mandiagDebug.tabs.testWebhook')}</TabsTrigger>
        </TabsList>

        {/* API Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-3 md:p-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
              <select
                value={logMethod}
                onChange={(e) => {
                  setLogMethod(e.target.value)
                  setLogPage(1)
                }}
                className="h-10 md:h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 w-full"
              >
                <option value="">{t('managerParent.pages.mandiagDebug.apiLogs.methods')}</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>

              <select
                value={logStatusGroup}
                onChange={(e) => {
                  setLogStatusGroup(e.target.value)
                  setLogPage(1)
                }}
                className="h-10 md:h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 w-full"
              >
                <option value="">{t('managerParent.pages.mandiagDebug.apiLogs.status')}</option>
                <option value="2xx">{t('managerParent.pages.mandiagDebug.apiLogs.status2xx')}</option>
                <option value="4xx">{t('managerParent.pages.mandiagDebug.apiLogs.status4xx')}</option>
                <option value="5xx">{t('managerParent.pages.mandiagDebug.apiLogs.status5xx')}</option>
              </select>

              <div className="md:col-span-2 lg:col-span-1">
                <DateRangePicker
                  value={logDateRange}
                  onChange={(range) => {
                    setLogDateRange(range)
                    setLogPage(1)
                  }}
                />
              </div>

              <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 h-10 md:h-11">
                <input
                  type="checkbox"
                  checked={logAutoRefresh}
                  onChange={(e) => setLogAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="whitespace-nowrap">{t('managerParent.pages.mandiagDebug.apiLogs.autoRefresh')}</span>
              </label>
            </CardContent>
          </Card>

          <DataTable
            tableKey="mandiag_debug_logs"
            columns={logColumns}
            rows={logsQuery.data?.data ?? []}
            isLoading={logsQuery.isLoading}
            getRowKey={(row) => String(row.id)}
          />

          {(logsQuery.data?.meta.last_page ?? 1) > 1 && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs sm:text-sm text-slate-500">
              <span>
                {t('managerParent.pages.mandiagDebug.pagination.pageInfo', {
                  current: logsQuery.data?.meta.current_page ?? logPage,
                  total: logsQuery.data?.meta.last_page ?? '?',
                })}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={logPage <= 1}
                  onClick={() => setLogPage(Math.max(1, logPage - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {t('managerParent.pages.mandiagDebug.pagination.previous')}
                </button>
                <button
                  disabled={logPage >= (logsQuery.data?.meta.last_page ?? 1)}
                  onClick={() => setLogPage(logPage + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {t('managerParent.pages.mandiagDebug.pagination.next')}
                </button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Active Licenses Tab */}
        <TabsContent value="licenses" className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-3 md:p-4 grid-cols-1 md:grid-cols-2">
              <select
                value={licenseStatus}
                onChange={(e) => {
                  setLicenseStatus(e.target.value)
                  setLicensePage(1)
                }}
                className="h-10 md:h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 w-full"
              >
                <option value="">{t('managerParent.pages.mandiagDebug.licenses.statusFilter')}</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
              </select>

              <Input
                type="search"
                value={licenseSearch}
                onChange={(e) => {
                  setLicenseSearch(e.target.value)
                  setLicensePage(1)
                }}
                placeholder={t('managerParent.pages.mandiagDebug.licenses.searchPlaceholder')}
                className="h-10 md:h-11"
              />
            </CardContent>
          </Card>

          <DataTable
            tableKey="mandiag_debug_licenses"
            columns={licenseColumns}
            rows={licensesQuery.data?.data ?? []}
            isLoading={licensesQuery.isLoading}
            getRowKey={(row) => String(row.id)}
          />

          {(licensesQuery.data?.meta.last_page ?? 1) > 1 && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs sm:text-sm text-slate-500">
              <span>
                {t('managerParent.pages.mandiagDebug.pagination.pageInfo', {
                  current: licensesQuery.data?.meta.current_page ?? licensePage,
                  total: licensesQuery.data?.meta.last_page ?? '?',
                })}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={licensePage <= 1}
                  onClick={() => setLicensePage(Math.max(1, licensePage - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {t('managerParent.pages.mandiagDebug.pagination.previous')}
                </button>
                <button
                  disabled={licensePage >= (licensesQuery.data?.meta.last_page ?? 1)}
                  onClick={() => setLicensePage(licensePage + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {t('managerParent.pages.mandiagDebug.pagination.next')}
                </button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Resellers Tab */}
        <TabsContent value="resellers" className="space-y-4">
          <DataTable
            tableKey="mandiag_debug_resellers"
            columns={resellerColumns}
            rows={resellersQuery.data?.data ?? []}
            isLoading={resellersQuery.isLoading}
            getRowKey={(row) => String(row.id)}
          />

          {(resellersQuery.data?.meta.last_page ?? 1) > 1 && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs sm:text-sm text-slate-500">
              <span>
                {t('managerParent.pages.mandiagDebug.pagination.pageInfo', {
                  current: resellersQuery.data?.meta.current_page ?? resellerPage,
                  total: resellersQuery.data?.meta.last_page ?? '?',
                })}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={resellerPage <= 1}
                  onClick={() => setResellerPage(Math.max(1, resellerPage - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {t('managerParent.pages.mandiagDebug.pagination.previous')}
                </button>
                <button
                  disabled={resellerPage >= (resellersQuery.data?.meta.last_page ?? 1)}
                  onClick={() => setResellerPage(resellerPage + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {t('managerParent.pages.mandiagDebug.pagination.next')}
                </button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Webhook Events Tab */}
        <TabsContent value="webhook-events" className="space-y-4">
          <Card>
            <CardContent className="p-3 md:p-4">
              <select
                value={webhookEventType}
                onChange={(e) => {
                  setWebhookEventType(e.target.value)
                  setWebhookPage(1)
                }}
                className="h-10 md:h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 w-full"
              >
                <option value="">{t('managerParent.pages.mandiagDebug.webhooks.eventTypeFilter')}</option>
                {WEBHOOK_EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`managerParent.pages.mandiagDebug.webhooks.eventTypes.${type}`)}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          <DataTable
            tableKey="mandiag_debug_webhook_events"
            columns={webhookColumns}
            rows={webhookEventsQuery.data?.data ?? []}
            isLoading={webhookEventsQuery.isLoading}
            getRowKey={(row) => String(row.id)}
          />

          {(webhookEventsQuery.data?.meta.last_page ?? 1) > 1 && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs sm:text-sm text-slate-500">
              <span>
                {t('managerParent.pages.mandiagDebug.pagination.pageInfo', {
                  current: webhookEventsQuery.data?.meta.current_page ?? webhookPage,
                  total: webhookEventsQuery.data?.meta.last_page ?? '?',
                })}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={webhookPage <= 1}
                  onClick={() => setWebhookPage(Math.max(1, webhookPage - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {t('managerParent.pages.mandiagDebug.pagination.previous')}
                </button>
                <button
                  disabled={webhookPage >= (webhookEventsQuery.data?.meta.last_page ?? 1)}
                  onClick={() => setWebhookPage(webhookPage + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {t('managerParent.pages.mandiagDebug.pagination.next')}
                </button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Test Webhook Tab */}
        <TabsContent value="test-webhook" className="space-y-4">
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 md:p-4 text-xs sm:text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200">
            {t('managerParent.pages.mandiagDebug.testWebhook.warning')}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-base">{t('managerParent.pages.mandiagDebug.testWebhook.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-3 md:p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('managerParent.pages.mandiagDebug.testWebhook.eventType')}</label>
                <select
                  value={testWebhookEventType}
                  onChange={(e) => handleWebhookEventTypeChange(e.target.value)}
                  className="h-10 md:h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {WEBHOOK_EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`managerParent.pages.mandiagDebug.webhooks.eventTypes.${type}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('managerParent.pages.mandiagDebug.testWebhook.mockData')}</label>
                <textarea
                  value={testWebhookData}
                  onChange={(e) => setTestWebhookData(e.target.value)}
                  className="w-full h-40 md:h-48 rounded-xl border border-slate-300 bg-white p-2 md:p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                  dir={isRtl ? 'rtl' : 'ltr'}
                />
              </div>

              <Button
                onClick={handleTestWebhook}
                disabled={testWebhookLoading}
                size="lg"
                className="w-full sm:w-auto"
              >
                {testWebhookLoading ? t('managerParent.pages.mandiagDebug.testWebhook.sending') : t('managerParent.pages.mandiagDebug.testWebhook.sendButton')}
              </Button>

              {testWebhookResult && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('managerParent.pages.mandiagDebug.testWebhook.responseLabel')}</label>
                  <pre
                    className="w-full overflow-x-auto rounded-lg bg-slate-950 p-2 md:p-3 text-xs text-slate-100 dark:bg-slate-900"
                    dir={isRtl ? 'rtl' : 'ltr'}
                  >
                    {JSON.stringify(testWebhookResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Log Detail Dialog */}
      <Dialog open={selectedLog !== null} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('managerParent.pages.mandiagDebug.dialog.title')}</DialogTitle>
            <DialogDescription>{t('managerParent.pages.mandiagDebug.dialog.description')}</DialogDescription>
          </DialogHeader>
          {logDetailQuery.isLoading ? (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              <div className="h-40 md:h-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="h-40 md:h-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 overflow-x-auto">
              <div>
                <h3 className="mb-2 text-sm font-medium">{t('managerParent.pages.mandiagDebug.dialog.requestLabel')}</h3>
                <pre
                  className="overflow-auto rounded-lg bg-slate-950 p-2 md:p-3 text-xs text-slate-100 dark:bg-slate-900"
                  dir={isRtl ? 'rtl' : 'ltr'}
                >
                  {JSON.stringify(logDetailQuery.data?.request_body ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">{t('managerParent.pages.mandiagDebug.dialog.responseLabel')}</h3>
                <pre
                  className="overflow-auto rounded-lg bg-slate-950 p-2 md:p-3 text-xs text-slate-100 dark:bg-slate-900"
                  dir={isRtl ? 'rtl' : 'ltr'}
                >
                  {JSON.stringify(logDetailQuery.data?.response_body ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
