import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { liveQueryOptions, LIVE_QUERY_INTERVAL } from '@/lib/live-query'
import { formatCurrency, formatDate, getLicenseDisplayStatus } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { licenseService } from '@/services/license.service'
import type { LicenseSummary } from '@/types/manager-reseller.types'

export function ActivationsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(Number(searchParams.get('page') || 1))
  const [perPage, setPerPage] = useState(Number(searchParams.get('per_page') || 10))
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [range, setRange] = useState<DateRangeValue>({
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  })

  useEffect(() => {
    const next = new URLSearchParams()
    if (page > 1) next.set('page', String(page))
    if (perPage !== 10) next.set('per_page', String(perPage))
    if (search) next.set('search', search)
    if (range.from) next.set('from', range.from)
    if (range.to) next.set('to', range.to)
    setSearchParams(next, { replace: true })
  }, [page, perPage, range.from, range.to, search, setSearchParams])

  const activationsQuery = useQuery({
    queryKey: ['reseller', 'activations', page, perPage, search, range.from, range.to],
    queryFn: () => licenseService.getAll({
      page,
      per_page: perPage,
      search,
      from: range.from || undefined,
      to: range.to || undefined,
    }),
    ...liveQueryOptions(LIVE_QUERY_INTERVAL.ACTIVATIONS),
  })

  const rows = activationsQuery.data?.data ?? []
  const columns = useMemo<Array<DataTableColumn<LicenseSummary>>>(() => [
    {
      key: 'customer',
      label: t('common.customer'),
      render: (row) => row.customer_id ? (
        <Link className="font-medium text-sky-700 hover:underline dark:text-sky-300" to={routePaths.reseller.customerDetail(lang, row.customer_id)}>
          {row.customer_name ?? '-'}
        </Link>
      ) : (row.customer_name ?? '-'),
    },
    {
      key: 'externalUsername',
      label: t('activate.username', { defaultValue: 'Username (API)' }),
      render: (row) => row.customer_id ? (
        <Link className="font-medium text-sky-700 hover:underline dark:text-sky-300" to={routePaths.reseller.customerDetail(lang, row.customer_id)}>
          {row.external_username ?? '-'}
        </Link>
      ) : (row.external_username ?? '-'),
    },
    {
      key: 'bios',
      label: t('reseller.pages.customers.table.bios'),
      render: (row) => row.customer_id ? (
        <Link className="font-medium text-sky-700 hover:underline dark:text-sky-300" to={routePaths.reseller.customerDetail(lang, row.customer_id)}>
          {row.bios_id}
        </Link>
      ) : row.bios_id,
    },
    {
      key: 'program',
      label: t('common.program'),
      render: (row) => row.program ?? '-',
    },
    {
      key: 'activatedAt',
      label: t('common.start', { defaultValue: 'Start' }),
      render: (row) => row.activated_at ? formatDate(row.activated_at, locale) : '-',
    },
    {
      key: 'status',
      label: t('common.status'),
      render: (row) => <StatusBadge status={getLicenseDisplayStatus(row)} />,
    },
    {
      key: 'price',
      label: t('common.price'),
      render: (row) => formatCurrency(row.price, 'USD', locale),
    },
  ], [lang, locale, t])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('roles.reseller')}
        title={t('common.activations', { defaultValue: 'Activations' })}
        description={t('reseller.pages.reports.activationsDescription', { defaultValue: 'Review activation rows, related customers, BIOS IDs, prices, and activation dates across the selected range.' })}
      />

      <Card className="border-sky-200/80 dark:border-sky-900/40">
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <DateRangePicker
            value={range}
            onChange={(value) => {
              setRange(value)
              setPage(1)
            }}
          />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t('reseller.pages.reports.searchActivationsPlaceholder', { defaultValue: 'Search by customer, email, BIOS ID, or program' })}
          />
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(row) => row.id}
        isLoading={activationsQuery.isLoading}
        emptyMessage={t('reseller.pages.reports.noActivationsDescription', { defaultValue: 'No activation rows match the current filters.' })}
        pagination={{
          page: activationsQuery.data?.meta.current_page ?? 1,
          lastPage: activationsQuery.data?.meta.last_page ?? 1,
          total: activationsQuery.data?.meta.total ?? 0,
          perPage: activationsQuery.data?.meta.per_page ?? perPage,
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
