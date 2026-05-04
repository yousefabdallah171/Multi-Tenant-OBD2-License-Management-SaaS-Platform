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
  const { lang } = useLanguage()
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
      // Refetch webhook events after sending test
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
      label: 'Timestamp',
      sortable: true,
      sortValue: (row) => row.created_at ?? '',
      render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-'),
    },
    { key: 'method', label: 'Method', sortable: true, sortValue: (row) => row.method, render: (row) => row.method },
    {
      key: 'endpoint',
      label: 'Endpoint',
      sortable: true,
      sortValue: (row) => row.endpoint,
      render: (row) => <code className="text-xs">{row.endpoint}</code>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      sortValue: (row) => row.status_code,
      render: (row) => <StatusBadge status={statusGroup(row.status_code)} />,
    },
    {
      key: 'time',
      label: 'Response Time',
      sortable: true,
      sortValue: (row) => row.response_time_ms,
      render: (row) => `${row.response_time_ms}ms`,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedLog(row)}>
          View
        </Button>
      ),
    },
  ]

  const licenseColumns: Array<DataTableColumn<MandiagLocalLicense>> = [
    { key: 'mandiag_license_id', label: 'Mandiag ID', alwaysVisible: true, render: (row) => row.mandiag_license_id },
    { key: 'external_username', label: 'Customer', render: (row) => row.external_username ?? '-' },
    { key: 'bios_id', label: 'BIOS ID', render: (row) => row.bios_id ?? '-' },
    { key: 'software_key', label: 'Software', render: (row) => row.software_key ?? '-' },
    { key: 'duration_days', label: 'Duration', render: (row) => `${row.duration_days} days` },
    { key: 'status', label: 'Status', render: (row) => <span className="text-sm font-medium">{row.status}</span> },
    { key: 'activated_at', label: 'Activated', render: (row) => (row.activated_at ? formatDate(row.activated_at, locale) : '-') },
    { key: 'expires_at', label: 'Expires', render: (row) => (row.expires_at ? formatDate(row.expires_at, locale) : '-') },
    { key: 'reseller_name', label: 'Reseller', render: (row) => row.reseller_name ?? '-' },
  ]

  const resellerColumns: Array<DataTableColumn<MandiagLocalReseller>> = [
    { key: 'name', label: 'Name', alwaysVisible: true, render: (row) => row.name },
    { key: 'username', label: 'Username', render: (row) => row.username },
    { key: 'mandiag_sub_id', label: 'Mandiag Sub ID', render: (row) => <code className="text-xs">{row.mandiag_sub_id}</code> },
    {
      key: 'software_keys',
      label: 'Priced Software Keys',
      render: (row) => (row.mandiag_priced_software_keys?.length ? row.mandiag_priced_software_keys.join(', ') : '-'),
    },
    { key: 'status', label: 'Status', render: (row) => <span className="text-sm font-medium">{row.status}</span> },
    { key: 'created_at', label: 'Created', render: (row) => formatDate(row.created_at, locale) },
  ]

  const webhookColumns: Array<DataTableColumn<MandiagWebhookEventRow>> = [
    { key: 'event_id', label: 'Event ID', alwaysVisible: true, render: (row) => <code className="text-xs">{row.event_id}</code> },
    { key: 'event_type', label: 'Event Type', render: (row) => row.event_type },
    { key: 'occurred_at', label: 'Occurred', render: (row) => (row.occurred_at ? formatDate(row.occurred_at, locale) : '-') },
    { key: 'processed_at', label: 'Processed', render: (row) => (row.processed_at ? formatDate(row.processed_at, locale) : '-') },
    {
      key: 'actions',
      label: 'Payload',
      render: (row) => (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setSelectedLog({ ...row, id: row.id, method: '', endpoint: '', user: null, response_time_ms: 0, status_code: 200, created_at: row.processed_at ?? '', response_body: row.payload } as never)
          }}
        >
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-3xl font-semibold">
            <Bug className="h-8 w-8" />
            Mandiag Debug & Monitoring
          </h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Monitor API calls, webhook events, and local Mandiag integration state. Test connectivity and webhooks.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatsCard
          title="API Calls (Today)"
          value={todayLogs.length}
          color="emerald"
        />
        <StatsCard
          title="Errors (Today)"
          value={errorCount}
          color={errorCount > 0 ? 'rose' : 'emerald'}
        />
        <StatsCard
          title="Last Webhook"
          value={lastWebhook ? formatDate(lastWebhook, locale) : 'Never'}
          color="sky"
        />
      </div>

      {/* Health Check */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handlePing} disabled={pingLoading} size="lg">
            {pingLoading ? 'Pinging...' : 'Ping Mandiag'}
          </Button>
          {pingResult && (
            <div className="space-y-2">
              <pre className="overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100 dark:bg-slate-900">
                {JSON.stringify(pingResult, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="logs">API Logs</TabsTrigger>
          <TabsTrigger value="licenses">Active Licenses</TabsTrigger>
          <TabsTrigger value="resellers">Resellers</TabsTrigger>
          <TabsTrigger value="webhook-events">Webhook Events</TabsTrigger>
          <TabsTrigger value="test-webhook">Test Webhook</TabsTrigger>
        </TabsList>

        {/* API Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-5">
              <select
                value={logMethod}
                onChange={(e) => {
                  setLogMethod(e.target.value)
                  setLogPage(1)
                }}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">All Methods</option>
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
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">All Status</option>
                <option value="2xx">2xx Success</option>
                <option value="4xx">4xx Client Error</option>
                <option value="5xx">5xx Server Error</option>
              </select>

              <div className="lg:col-span-2">
                <DateRangePicker
                  value={logDateRange}
                  onChange={(range) => {
                    setLogDateRange(range)
                    setLogPage(1)
                  }}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={logAutoRefresh}
                  onChange={(e) => setLogAutoRefresh(e.target.checked)}
                />
                Auto-refresh
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
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Page {logsQuery.data?.meta.current_page ?? logPage} / {logsQuery.data?.meta.last_page ?? '?'}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={logPage <= 1}
                  onClick={() => setLogPage(Math.max(1, logPage - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Previous
                </button>
                <button
                  disabled={logPage >= (logsQuery.data?.meta.last_page ?? 1)}
                  onClick={() => setLogPage(logPage + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Active Licenses Tab */}
        <TabsContent value="licenses" className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-2">
              <select
                value={licenseStatus}
                onChange={(e) => {
                  setLicenseStatus(e.target.value)
                  setLicensePage(1)
                }}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">All Status</option>
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
                placeholder="Search BIOS ID or customer..."
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
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Page {licensesQuery.data?.meta.current_page ?? licensePage} / {licensesQuery.data?.meta.last_page ?? '?'}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={licensePage <= 1}
                  onClick={() => setLicensePage(Math.max(1, licensePage - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Previous
                </button>
                <button
                  disabled={licensePage >= (licensesQuery.data?.meta.last_page ?? 1)}
                  onClick={() => setLicensePage(licensePage + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Next
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
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Page {resellersQuery.data?.meta.current_page ?? resellerPage} / {resellersQuery.data?.meta.last_page ?? '?'}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={resellerPage <= 1}
                  onClick={() => setResellerPage(Math.max(1, resellerPage - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Previous
                </button>
                <button
                  disabled={resellerPage >= (resellersQuery.data?.meta.last_page ?? 1)}
                  onClick={() => setResellerPage(resellerPage + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Webhook Events Tab */}
        <TabsContent value="webhook-events" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <select
                value={webhookEventType}
                onChange={(e) => {
                  setWebhookEventType(e.target.value)
                  setWebhookPage(1)
                }}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">All Event Types</option>
                <option value="license_expired">License Expired</option>
                <option value="license_renewed">License Renewed</option>
                <option value="license_disabled">License Disabled</option>
                <option value="license_enabled">License Enabled</option>
                <option value="balance_low">Balance Low</option>
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
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Page {webhookEventsQuery.data?.meta.current_page ?? webhookPage} / {webhookEventsQuery.data?.meta.last_page ?? '?'}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={webhookPage <= 1}
                  onClick={() => setWebhookPage(Math.max(1, webhookPage - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Previous
                </button>
                <button
                  disabled={webhookPage >= (webhookEventsQuery.data?.meta.last_page ?? 1)}
                  onClick={() => setWebhookPage(webhookPage + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Test Webhook Tab */}
        <TabsContent value="test-webhook" className="space-y-4">
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200">
            This sends a real request to your webhook endpoint. It will create a MandiagWebhookEvent record and dispatch a job.
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Send Test Webhook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Event Type</label>
                <select
                  value={testWebhookEventType}
                  onChange={(e) => handleWebhookEventTypeChange(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {WEBHOOK_EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Mock Data (JSON)</label>
                <textarea
                  value={testWebhookData}
                  onChange={(e) => setTestWebhookData(e.target.value)}
                  className="h-48 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <Button onClick={handleTestWebhook} disabled={testWebhookLoading} size="lg">
                {testWebhookLoading ? 'Sending...' : 'Send Test Webhook'}
              </Button>

              {testWebhookResult && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Response</label>
                  <pre className="overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100 dark:bg-slate-900">
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
            <DialogTitle>Request / Response Details</DialogTitle>
            <DialogDescription>View the full payload sent and received</DialogDescription>
          </DialogHeader>
          {logDetailQuery.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="h-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-medium">Request</h3>
                <pre className="overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100 dark:bg-slate-900">
                  {JSON.stringify(logDetailQuery.data?.request_body ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">Response</h3>
                <pre className="overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100 dark:bg-slate-900">
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
