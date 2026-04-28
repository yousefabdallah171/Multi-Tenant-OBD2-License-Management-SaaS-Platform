import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BadgeDollarSign, ListOrdered, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatsCard } from '@/components/shared/StatsCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { customerService } from '@/services/customer.service'
import { managerParentService } from '@/services/manager-parent.service'
import type { ManagerParentSalesCustomerEventRow, ManagerParentSalesCustomerFilters } from '@/types/manager-reseller.types'

export function ManagerSalesCustomersPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const { managerId } = useParams<{ managerId: string }>()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const resolvedManagerId = Number(managerId)

  const [search, setSearch] = useState('')
  const [programId, setProgramId] = useState<number | ''>('')
  const [countryName, setCountryName] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const filters = useMemo<ManagerParentSalesCustomerFilters>(() => ({
    search: search || undefined,
    program_id: programId || undefined,
    country_name: countryName || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    per_page: 25,
  }), [countryName, from, page, programId, search, to])

  const salesQuery = useQuery({
    queryKey: ['manager-parent', 'reseller-payments', 'manager-customers', resolvedManagerId, filters],
    queryFn: () => managerParentService.getManagerSalesCustomers(resolvedManagerId, filters),
    enabled: Number.isFinite(resolvedManagerId) && resolvedManagerId > 0,
  })

  const programsQuery = useQuery({
    queryKey: ['manager-parent', 'programs', 'active-list'],
    queryFn: () => managerParentService.getProgramsWithExternalApi(),
  })

  const countriesQuery = useQuery({
    queryKey: ['manager-parent', 'customers', 'countries'],
    queryFn: () => customerService.getCountries({}),
  })

  const rows = salesQuery.data?.data ?? []
  const summary = salesQuery.data?.summary
  const meta = salesQuery.data?.meta
  const managerLabel = summary?.manager
    ? `${summary.manager.name} (${summary.manager.email})`
    : t('payments.managerCustomers.unknownManager', { defaultValue: 'Unknown manager' })

  const columns = useMemo<Array<DataTableColumn<ManagerParentSalesCustomerEventRow>>>(() => [
    {
      key: 'customer_name',
      label: t('payments.managerParentCustomers.columns.customer'),
      sortable: true,
      sortValue: (row) => row.customer_name ?? '',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-950 dark:text-white">{row.customer_name || '-'}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{row.customer_username || '-'}</p>
        </div>
      ),
    },
    {
      key: 'bios_id',
      label: t('payments.managerParentCustomers.columns.biosId'),
      sortable: true,
      sortValue: (row) => row.bios_id,
      render: (row) => row.bios_id || '-',
    },
    {
      key: 'program_name',
      label: t('payments.managerParentCustomers.columns.program'),
      sortable: true,
      sortValue: (row) => row.program_name ?? '',
      render: (row) => row.program_name || '-',
    },
    {
      key: 'country_name',
      label: t('payments.managerParentCustomers.columns.country'),
      sortable: true,
      sortValue: (row) => row.country_name ?? '',
      render: (row) => row.country_name || '-',
    },
    {
      key: 'sale_amount',
      label: t('payments.managerParentCustomers.columns.saleAmount'),
      sortable: true,
      sortValue: (row) => row.sale_amount,
      render: (row) => formatCurrency(row.sale_amount, 'USD', locale),
    },
    {
      key: 'sale_date',
      label: t('payments.managerParentCustomers.columns.saleDate'),
      sortable: true,
      sortValue: (row) => row.sale_date ?? '',
      render: (row) => (row.sale_date ? formatDate(row.sale_date, locale) : '-'),
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (row) => row.customer_id ? (
        <button type="button" onClick={() => navigate(routePaths.managerParent.customerDetail(lang, row.customer_id ?? ''))} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900">
          {t('payments.actions.view')}
        </button>
      ) : <span className="text-sm text-slate-500 dark:text-slate-400">-</span>,
    },
  ], [lang, locale, navigate, t])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-start">
        <Button type="button" variant="outline" onClick={() => navigate(routePaths.managerParent.resellerPayments(lang))}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>

      <PageHeader
        eyebrow={t('managerParent.layout.eyebrow')}
        title={t('payments.managerParentCustomers.title', { defaultValue: 'Manager Sales Customers' })}
        description={managerLabel}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <StatsCard title={t('payments.managerParentCustomers.summary.totalCustomers')} value={String(summary?.total_customers ?? 0)} icon={Users} color="sky" />
        <StatsCard title={t('payments.managerParentCustomers.summary.totalSales')} value={formatCurrency(summary?.total_sales ?? 0, 'USD', locale)} icon={BadgeDollarSign} color="emerald" />
        <StatsCard title={t('payments.managerParentCustomers.summary.totalEvents')} value={String(summary?.total_events ?? 0)} icon={ListOrdered} color="amber" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.search')}</span>
            <Input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder={t('payments.managerParentCustomers.searchPlaceholder')}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.program')}</span>
            <select value={programId} onChange={(event) => { setProgramId(event.target.value ? Number(event.target.value) : ''); setPage(1) }} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">{t('managerParent.pages.customers.allPrograms')}</option>
              {(programsQuery.data ?? []).map((program) => (
                <option key={program.id} value={program.id}>{program.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.country')}</span>
            <select value={countryName} onChange={(event) => { setCountryName(event.target.value); setPage(1) }} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">{t('common.allCountries', { defaultValue: 'All countries' })}</option>
              {(countriesQuery.data?.data ?? []).map((country) => (
                <option key={country.country_name} value={country.country_name}>{country.country_name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.from')}</span>
            <Input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1) }} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.to')}</span>
            <Input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1) }} />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch('')
              setProgramId('')
              setCountryName('')
              setFrom('')
              setTo('')
              setPage(1)
            }}
          >
            {t('common.clear')}
          </Button>
        </div>
      </div>

      <DataTable tableKey="manager_parent_manager_sales_customers" columns={columns} data={rows} rowKey={(row) => `${row.license_id ?? 'no-license'}-${row.sale_date ?? ''}-${row.customer_id ?? 'no-customer'}`} isLoading={salesQuery.isLoading} emptyMessage={t('payments.managerParentCustomers.empty')} />

      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>{t('common.totalCount', { count: meta?.total ?? 0 })}</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!meta || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            {t('common.previous')}
          </Button>
          <span>{meta ? `${meta.current_page} / ${meta.last_page}` : '1 / 1'}</span>
          <Button type="button" variant="outline" size="sm" disabled={!meta || page >= meta.last_page} onClick={() => setPage((current) => current + 1)}>
            {t('common.next')}
          </Button>
        </div>
      </div>
    </div>
  )
}
