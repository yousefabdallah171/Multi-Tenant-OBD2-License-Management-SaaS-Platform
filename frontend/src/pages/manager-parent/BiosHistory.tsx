import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { managerParentService } from '@/services/manager-parent.service'
import { teamService } from '@/services/team.service'
import type { BiosHistoryEntry } from '@/types/manager-parent.types'

export function BiosHistoryPage() {
  const [searchParams] = useSearchParams()
  const initialBios = searchParams.get('bios') ?? ''
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [biosInput, setBiosInput] = useState(initialBios)
  const [activeBios, setActiveBios] = useState(initialBios)
  const [action, setAction] = useState('')
  const [resellerId, setResellerId] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })

  const historyQuery = useQuery({
    queryKey: ['manager-parent', 'bios-history', activeBios, action, resellerId, page, perPage, range.from, range.to],
    queryFn: () =>
      managerParentService.getBiosHistory({
        bios_id: activeBios,
        action,
        reseller_id: resellerId,
        page,
        per_page: perPage,
        from: range.from,
        to: range.to,
      }),
  })

  const timelineQuery = useQuery({
    queryKey: ['manager-parent', 'bios-history', 'timeline', activeBios],
    queryFn: () => managerParentService.getBiosHistoryById(activeBios),
    enabled: Boolean(activeBios),
  })

  const resellerQuery = useQuery({
    queryKey: ['manager-parent', 'bios-history', 'resellers'],
    queryFn: () => teamService.getAll({ role: 'reseller', per_page: 100 }),
  })

  const columns = useMemo<Array<DataTableColumn<BiosHistoryEntry>>>(
    () => [
      { key: 'bios', label: 'BIOS ID', sortable: true, sortValue: (row) => row.bios_id, render: (row) => <code>{row.bios_id}</code> },
      { key: 'customer', label: 'Customer', sortable: true, sortValue: (row) => row.customer ?? '', render: (row) => row.customer ?? '-' },
      { key: 'reseller', label: 'Reseller', sortable: true, sortValue: (row) => row.reseller ?? '', render: (row) => row.reseller ?? '-' },
      { key: 'action', label: 'Action', sortable: true, sortValue: (row) => row.action, render: (row) => row.action },
      { key: 'status', label: 'Status', sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending' | 'removed'} /> },
      { key: 'date', label: 'Date', sortable: true, sortValue: (row) => row.occurred_at ?? '', render: (row) => (row.occurred_at ? formatDate(row.occurred_at, locale) : '-') },
    ],
    [locale],
  )

  const timelineEntries = timelineQuery.data?.data.events ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="BIOS History" description="Search a BIOS identifier and review timeline events scoped to this tenant only." />

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_170px_220px_minmax(0,0.9fr)]">
          <div className="flex gap-2">
            <Input value={biosInput} onChange={(event) => setBiosInput(event.target.value)} placeholder="Enter BIOS ID" />
            <Button
              type="button"
              onClick={() => {
                setActiveBios(biosInput.trim())
                setPage(1)
              }}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">All actions</option>
            <option value="activation">Activation</option>
            <option value="blacklist">Blacklist</option>
            <option value="conflict">Conflict</option>
            <option value="renewal">Renewal</option>
          </select>
          <select
            value={resellerId}
            onChange={(event) => {
              setResellerId(event.target.value ? Number(event.target.value) : '')
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">All resellers</option>
            {(resellerQuery.data?.data ?? []).map((reseller) => (
              <option key={reseller.id} value={reseller.id}>
                {reseller.name}
              </option>
            ))}
          </select>
          <DateRangePicker value={range} onChange={setRange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{activeBios ? `Timeline for ${activeBios}` : 'BIOS Timeline'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeBios && timelineEntries.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No timeline entries were found for this BIOS ID.</p> : null}
          {!activeBios ? <p className="text-sm text-slate-500 dark:text-slate-400">Search for a BIOS ID to load the full tenant timeline.</p> : null}
          {timelineEntries.slice(0, 8).map((entry) => (
            <div key={entry.id} className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950 dark:text-white">{entry.action}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{entry.description}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Customer: {entry.customer ?? '-'} | Reseller: {entry.reseller ?? '-'}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status={entry.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending' | 'removed'} />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{entry.occurred_at ? formatDate(entry.occurred_at, locale) : '-'}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={historyQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        isLoading={historyQuery.isLoading}
        pagination={{
          page: historyQuery.data?.meta.current_page ?? 1,
          lastPage: historyQuery.data?.meta.last_page ?? 1,
          total: historyQuery.data?.meta.total ?? 0,
          perPage: historyQuery.data?.meta.per_page ?? perPage,
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
