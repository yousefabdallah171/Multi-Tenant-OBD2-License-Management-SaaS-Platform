import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { StatusFilterCard } from '@/components/customers/StatusFilterCard'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { useLanguage } from '@/hooks/useLanguage'
import { formatActivityActionLabel, formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { resellerService } from '@/services/reseller.service'
import type { ResellerSellerLogEntry } from '@/types/manager-reseller.types'

const ACTION_OPTIONS = [
  'license.activated',
  'license.renewed',
  'license.deactivated',
  'license.delete',
] as const

export function ResellerLogsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(() => parsePositiveInt(searchParams.get('page'), 1))
  const [perPage, setPerPage] = useState(() => parsePositiveInt(searchParams.get('per_page'), 15))
  const [action, setAction] = useState<string>(() => searchParams.get('action') ?? '')
  const [range, setRange] = useState<DateRangeValue>(() => ({
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
  }))

  useEffect(() => {
    if (searchParams.toString() === '') {
      setPage(1)
      setPerPage(15)
      setAction('')
      setRange({ from: '', to: '' })
    }
  }, [searchParams])

  useEffect(() => {
    const next = new URLSearchParams()

    if (page > 1) next.set('page', String(page))
    if (perPage !== 15) next.set('per_page', String(perPage))
    if (action !== '') next.set('action', action)
    if (range.from) next.set('from', range.from)
    if (range.to) next.set('to', range.to)

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [action, page, perPage, range.from, range.to, searchParams, setSearchParams])

  const logsQuery = useQuery({
    queryKey: ['reseller', 'seller-logs', page, perPage, action, range.from, range.to],
    queryFn: () => resellerService.getSellerLogs({ page, per_page: perPage, action, from: range.from, to: range.to }),
  })

  const columns = useMemo<Array<DataTableColumn<ResellerSellerLogEntry>>>(() => [
    {
      key: 'created_at',
      label: t('common.timestamp'),
      sortable: true,
      sortValue: (row) => row.created_at ?? '',
      render: (row) => row.created_at ? formatDate(row.created_at, locale) : '-',
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
      sortValue: (row) => row.customer_name ?? getMetadataString(row.metadata, 'customer_name') ?? '',
      render: (row) => {
        const customerName = row.customer_name ?? getMetadataString(row.metadata, 'customer_name') ?? '-'
        return row.customer_id ? (
          <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.reseller.customerDetail(lang, row.customer_id)}>
            {customerName}
          </Link>
        ) : customerName
      },
    },
    {
      key: 'program',
      label: t('common.program'),
      sortable: true,
      sortValue: (row) => row.program_name ?? getMetadataString(row.metadata, 'program_name') ?? '',
      render: (row) => row.program_name ?? getMetadataString(row.metadata, 'program_name') ?? '-',
    },
    {
      key: 'bios_id',
      label: t('activate.biosId'),
      sortable: true,
      sortValue: (row) => row.bios_id ?? getMetadataString(row.metadata, 'bios_id') ?? '',
      render: (row) => {
        const biosId = row.bios_id ?? getMetadataString(row.metadata, 'bios_id')
        if (!biosId) return '-'
        return row.customer_id ? (
          <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.reseller.customerDetail(lang, row.customer_id)}>
            {biosId}
          </Link>
        ) : biosId
      },
    },
    {
      key: 'price',
      label: t('common.price'),
      sortable: true,
      sortValue: (row) => row.price ?? getMetadataNumber(row.metadata, 'price') ?? 0,
      render: (row) => {
        const price = row.price ?? getMetadataNumber(row.metadata, 'price')
        return price === null ? '-' : formatCurrency(price, 'USD', locale)
      },
    },
    {
      key: 'license_status',
      label: t('common.status'),
      sortable: true,
      sortValue: (row) => row.license_status ?? '',
      render: (row) => row.license_status
        ? <StatusBadge status={row.license_status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} />
        : '-',
    },
    {
      key: 'ip_address',
      label: 'IP',
      sortable: true,
      sortValue: (row) => row.ip_address ?? '',
      render: (row) => row.ip_address ?? '-',
    },
  ], [lang, locale, t])

  const summary = logsQuery.data?.summary ?? {
    total_entries: 0,
    activations: 0,
    renewals: 0,
    deactivations: 0,
    deletions: 0,
    revenue: 0,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('roles.reseller')}
        title={t('reseller.nav.resellerLogs')}
        description={t('reseller.pages.resellerLogs.description')}
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setAction('')
              setRange({ from: '', to: '' })
              setPage(1)
            }}
          >
            {t('common.clear')}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatusFilterCard label={t('reseller.pages.activity.allActions')} count={summary.total_entries} isActive={action === ''} onClick={() => { setAction(''); setPage(1) }} color="sky" />
        <StatusFilterCard label={t('common.activate')} count={summary.activations} isActive={action === 'license.activated'} onClick={() => { setAction('license.activated'); setPage(1) }} color="emerald" />
        <StatusFilterCard label={t('common.renew')} count={summary.renewals} isActive={action === 'license.renewed'} onClick={() => { setAction('license.renewed'); setPage(1) }} color="sky" />
        <StatusFilterCard label={t('common.deactivate')} count={summary.deactivations} isActive={action === 'license.deactivated'} onClick={() => { setAction('license.deactivated'); setPage(1) }} color="amber" />
        <StatusFilterCard label={t('common.delete')} count={summary.deletions} isActive={action === 'license.delete'} onClick={() => { setAction('license.delete'); setPage(1) }} color="rose" />
        <MetricCard label={t('common.revenue')} value={formatCurrency(summary.revenue, 'USD', locale)} />
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[240px_minmax(0,1fr)]">
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('reseller.pages.activity.allActions')}</option>
            {ACTION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {getActionLabel(option, t)}
              </option>
            ))}
          </select>
          <DateRangePicker
            value={range}
            onChange={(value) => {
              setRange(value)
              setPage(1)
            }}
          />
        </CardContent>
      </Card>

      <DataTable
        tableKey="reseller_reseller_logs"
        columns={columns}
        data={logsQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        isLoading={logsQuery.isLoading}
        emptyMessage={t('reseller.pages.activity.empty')}
        pagination={{
          page: logsQuery.data?.meta.page ?? 1,
          lastPage: logsQuery.data?.meta.last_page ?? 1,
          total: logsQuery.data?.meta.total ?? 0,
          perPage: logsQuery.data?.meta.per_page ?? perPage,
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

function getActionLabel(action: string, t: TFunction<'translation'>) {
  return formatActivityActionLabel(action, t)
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' ? value : null
}

function getMetadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'number' ? value : null
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function ActionPill({ label, action }: { label: string; action: string }) {
  const palette = action.includes('delete')
    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
    : action.includes('deactivate')
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
      : action.includes('renew')
        ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${palette}`}>{label}</span>
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-slate-200/80 dark:border-slate-800">
      <CardContent className="space-y-1 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-xl font-semibold text-slate-950 dark:text-white">{value}</p>
      </CardContent>
    </Card>
  )
}
