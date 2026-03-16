import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatActivityActionLabel, formatDate, formatReadableActivityDescription } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'
import { teamService } from '@/services/team.service'
import type { BiosHistoryEntry } from '@/types/manager-parent.types'

export function BiosHistoryPage() {
  const { t } = useTranslation()
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
      {
        key: 'bios',
        label: t('managerParent.pages.biosHistory.biosId'),
        sortable: true,
        sortValue: (row) => row.bios_id,
        render: (row) => (
          <div>
            <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.biosDetail(lang, row.bios_id)}>
              <code>{row.bios_id}</code>
            </Link>
            <p className="text-xs text-slate-500 dark:text-slate-400">@{row.external_username ?? '-'}</p>
          </div>
        ),
      },
      {
        key: 'customer',
        label: t('common.customer'),
        sortable: true,
        sortValue: (row) => row.customer ?? '',
        render: (row) => (row.customer_id ? <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.customerDetail(lang, row.customer_id)}>{row.customer ?? '-'}</Link> : (row.customer ?? '-')),
      },
      { key: 'reseller', label: t('common.reseller'), sortable: true, sortValue: (row) => row.reseller ?? '', render: (row) => row.reseller ?? '-' },
      { key: 'action', label: t('common.action'), sortable: true, sortValue: (row) => row.action, render: (row) => formatActivityActionLabel(row.action, t) },
      { key: 'status', label: t('common.status'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending' | 'removed'} /> },
      { key: 'date', label: t('common.date'), sortable: true, sortValue: (row) => row.occurred_at ?? '', render: (row) => (row.occurred_at ? formatDate(row.occurred_at, locale) : '-') },
    ],
    [locale, t],
  )

  const timelineEntries = timelineQuery.data?.data.events ?? []

  return (
    <div className="space-y-6">
      <PageHeader title={t('managerParent.pages.biosHistory.title')} description={t('managerParent.pages.biosHistory.description')} />

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_170px_220px_minmax(0,0.9fr)]">
          <div className="flex gap-2">
            <Input value={biosInput} onChange={(event) => setBiosInput(event.target.value)} placeholder={t('managerParent.pages.biosHistory.enterBiosId')} />
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
            <option value="">{t('managerParent.pages.biosHistory.allActions')}</option>
            <option value="activation">{t('managerParent.pages.biosHistory.activation')}</option>
            <option value="blacklist">{t('managerParent.pages.biosHistory.blacklist')}</option>
            <option value="conflict">{t('managerParent.pages.biosHistory.conflict')}</option>
            <option value="renewal">{t('managerParent.pages.biosHistory.renewal')}</option>
          </select>
          <select
            value={resellerId}
            onChange={(event) => {
              setResellerId(event.target.value ? Number(event.target.value) : '')
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('managerParent.pages.biosHistory.allResellers')}</option>
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
          <CardTitle className="text-lg">{activeBios ? t('managerParent.pages.biosHistory.timelineFor', { biosId: activeBios }) : t('managerParent.pages.biosHistory.timelineTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeBios && timelineEntries.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.biosHistory.noTimelineEntries')}</p> : null}
          {!activeBios ? <p className="text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.biosHistory.searchToLoadTimeline')}</p> : null}
          {timelineEntries.slice(0, 8).map((entry) => (
            <div key={entry.id} className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950 dark:text-white">{formatActivityActionLabel(entry.action, t)}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{formatReadableActivityDescription(entry.description, locale)}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t('managerParent.pages.biosHistory.timelineMeta', { customer: entry.customer ?? '-', reseller: entry.reseller ?? '-' })}
                  </p>
                </div>
                <div className="text-end">
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
