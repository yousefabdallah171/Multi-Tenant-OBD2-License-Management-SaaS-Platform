import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { managerParentService } from '@/services/manager-parent.service'
import type { LogFilters, ManagerParentLogEntry } from '@/types/manager-parent.types'

function statusGroup(statusCode: number) {
  if (statusCode >= 500) return 'offline'
  if (statusCode >= 400) return 'degraded'
  return 'online'
}

export function LogsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [endpoint, setEndpoint] = useState('')
  const [method, setMethod] = useState('')
  const [statusFrom, setStatusFrom] = useState<number | ''>('')
  const [statusTo, setStatusTo] = useState<number | ''>('')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [selectedLog, setSelectedLog] = useState<ManagerParentLogEntry | null>(null)

  const queryParams: LogFilters = useMemo(
    () => ({
      page,
      per_page: perPage,
      endpoint,
      method,
      status_from: statusFrom,
      status_to: statusTo,
      from: dateRange.from || undefined,
      to: dateRange.to || undefined,
    }),
    [dateRange.from, dateRange.to, endpoint, method, page, perPage, statusFrom, statusTo],
  )

  const logsQuery = useQuery({
    queryKey: ['manager-parent', 'logs', queryParams, autoRefresh],
    queryFn: () => managerParentService.getLogs(queryParams),
    refetchInterval: autoRefresh ? 15000 : false,
  })

  const detailQuery = useQuery({
    queryKey: ['manager-parent', 'logs', 'detail', selectedLog?.id],
    queryFn: () => managerParentService.getLogById(selectedLog?.id as number),
    enabled: selectedLog !== null,
  })

  const columns: Array<DataTableColumn<ManagerParentLogEntry>> = [
    { key: 'timestamp', label: t('common.timestamp'), sortable: true, sortValue: (row) => row.created_at ?? '', render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-') },
    { key: 'user', label: t('common.user'), sortable: true, sortValue: (row) => row.user ?? '', render: (row) => row.user ?? '-' },
    { key: 'endpoint', label: t('managerParent.pages.logs.endpoint'), sortable: true, sortValue: (row) => row.endpoint, render: (row) => <code className="text-xs">{row.endpoint}</code> },
    { key: 'method', label: t('managerParent.pages.logs.method'), sortable: true, sortValue: (row) => row.method, render: (row) => row.method },
    { key: 'status', label: t('managerParent.pages.logs.statusCode'), sortable: true, sortValue: (row) => row.status_code, render: (row) => <StatusBadge status={statusGroup(row.status_code)} /> },
    { key: 'time', label: t('managerParent.pages.logs.responseTime'), sortable: true, sortValue: (row) => row.response_time_ms, render: (row) => `${row.response_time_ms}ms` },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (row) => (
        <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedLog(row)}>
          {t('common.view')}
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('managerParent.pages.logs.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.logs.description')}</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="ps-10"
              value={endpoint}
              onChange={(event) => {
                setEndpoint(event.target.value)
                setPage(1)
              }}
              placeholder={t('managerParent.pages.logs.endpoint')}
            />
          </div>
          <select
            value={method}
            onChange={(event) => {
              setMethod(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('common.allMethods')}</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
          <Input
            type="number"
            min={100}
            max={599}
            value={statusFrom}
            onChange={(event) => {
              setStatusFrom(event.target.value ? Number(event.target.value) : '')
              setPage(1)
            }}
            placeholder={t('common.from')}
          />
          <Input
            type="number"
            min={100}
            max={599}
            value={statusTo}
            onChange={(event) => {
              setStatusTo(event.target.value ? Number(event.target.value) : '')
              setPage(1)
            }}
            placeholder={t('common.to')}
          />
          <div className="xl:col-span-3">
            <DateRangePicker
              value={dateRange}
              onChange={(nextValue) => {
                setDateRange(nextValue)
                setPage(1)
              }}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
            {t('managerParent.pages.logs.autoRefresh')}
          </label>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={logsQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        isLoading={logsQuery.isLoading}
        pagination={{
          page: logsQuery.data?.meta.current_page ?? 1,
          lastPage: logsQuery.data?.meta.last_page ?? 1,
          total: logsQuery.data?.meta.total ?? 0,
          perPage: logsQuery.data?.meta.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPerPage(nextPageSize)
          setPage(1)
        }}
      />

      <Dialog open={selectedLog !== null} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('managerParent.pages.logs.detailTitle')}</DialogTitle>
            <DialogDescription>{t('managerParent.pages.logs.description')}</DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <pre className="overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(detailQuery.data?.data.request_body ?? {}, null, 2)}</pre>
              <pre className="overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(detailQuery.data?.data.response_body ?? {}, null, 2)}</pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
