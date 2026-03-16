import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatActivityActionLabel, formatDate, formatReadableActivityDescription } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { biosService } from '@/services/bios.service'
import { tenantService } from '@/services/tenant.service'
import type { BiosHistoryEvent } from '@/types/super-admin.types'

export function BiosHistoryPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [searchParams] = useSearchParams()
  const initialBiosId = searchParams.get('bios') ?? ''
  const [page, setPage] = useState(1)
  const [biosId, setBiosId] = useState(initialBiosId)
  const [tenantId, setTenantId] = useState<number | ''>('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    setBiosId(initialBiosId)
  }, [initialBiosId])

  const historyQuery = useQuery({
    queryKey: ['super-admin', 'bios-history', page, biosId, tenantId, action, from, to],
    queryFn: () => biosService.getHistory({ page, per_page: 10, bios_id: biosId || undefined, tenant_id: tenantId, action, from, to }),
  })

  const detailQuery = useQuery({
    queryKey: ['super-admin', 'bios-history', 'detail', biosId],
    queryFn: () => biosService.getHistoryById(biosId),
    enabled: biosId.length > 0,
  })

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'bios-history-tenant-options'],
    queryFn: () => tenantService.getAll({ per_page: 100 }),
  })

  const columns: Array<DataTableColumn<BiosHistoryEvent>> = [
    { key: 'bios', label: t('superAdmin.pages.biosHistory.biosId'), sortable: true, sortValue: (row) => row.bios_id, render: (row) => <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.superAdmin.biosDetail(lang, row.bios_id)}><code>{row.bios_id}</code></Link> },
    { key: 'tenant', label: t('common.tenant'), sortable: true, sortValue: (row) => row.tenant ?? '', render: (row) => row.tenant ?? '-' },
    { key: 'customer', label: t('common.customer'), sortable: true, sortValue: (row) => row.customer ?? '', render: (row) => row.customer ?? '-' },
    { key: 'action', label: t('common.action'), sortable: true, sortValue: (row) => row.action, render: (row) => formatActivityActionLabel(row.action, t) },
    { key: 'status', label: t('common.status'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status as never} /> },
    { key: 'date', label: t('common.date'), sortable: true, sortValue: (row) => row.occurred_at, render: (row) => formatDate(row.occurred_at, locale) },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('superAdmin.pages.biosHistory.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.biosHistory.description')}</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="ps-10" value={biosId} onChange={(event) => setBiosId(event.target.value)} placeholder={t('superAdmin.pages.biosHistory.searchPlaceholder')} />
          </div>
          <select value={tenantId} onChange={(event) => setTenantId(event.target.value ? Number(event.target.value) : '')} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="">{t('common.allTenants')}</option>
            {tenantsQuery.data?.data.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <Input value={action} onChange={(event) => setAction(event.target.value)} placeholder={t('common.action')} />
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </CardContent>
      </Card>

      {biosId && detailQuery.data?.data.events.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('superAdmin.pages.biosHistory.timelineTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detailQuery.data.data.events.slice(0, 5).map((event) => (
              <div key={event.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-950 dark:text-white">{formatActivityActionLabel(event.action, t)}</p>
                  <StatusBadge status={event.status as never} />
                </div>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{formatReadableActivityDescription(event.description, locale)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {historyQuery.isLoading ? (
        <LoadingSpinner fullPage label={t('common.loading')} />
      ) : (
        <DataTable
          columns={columns}
          data={historyQuery.data?.data ?? []}
          rowKey={(row) => row.id}
          pagination={{
            page: historyQuery.data?.meta.current_page ?? 1,
            lastPage: historyQuery.data?.meta.last_page ?? 1,
            total: historyQuery.data?.meta.total ?? 0,
          }}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
