import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BadgeDollarSign, ListOrdered, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatsCard } from '@/components/shared/StatsCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { superAdminPlatformService } from '@/services/super-admin-platform.service'
import { tenantService } from '@/services/tenant.service'
import type { TransactionHistoryFilters, TransactionHistoryRow } from '@/types/manager-reseller.types'
import type { UserRole } from '@/types/user.types'
import { FlagImage } from '@/utils/countryFlag'

const ROLE_OPTIONS: Array<{ value: 'manager_parent' | 'manager' | 'reseller'; label: string }> = [
  { value: 'manager_parent', label: 'manager_parent' },
  { value: 'manager', label: 'manager' },
  { value: 'reseller', label: 'reseller' },
]

export function TransactionHistoryPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'

  const [search, setSearch] = useState('')
  const [tenantId, setTenantId] = useState<number | ''>('')
  const [role, setRole] = useState<'manager_parent' | 'manager' | 'reseller' | ''>('')
  const [sellerId, setSellerId] = useState<number | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const sellerFilters = useMemo(() => ({
    tenant_id: tenantId || undefined,
    from: from || undefined,
    to: to || undefined,
  }), [from, tenantId, to])

  const filters = useMemo<TransactionHistoryFilters>(() => ({
    search: search || undefined,
    tenant_id: tenantId || undefined,
    role: role || undefined,
    seller_id: sellerId || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    per_page: 25,
  }), [from, page, role, search, sellerId, tenantId, to])

  const historyQuery = useQuery({
    queryKey: ['super-admin', 'transaction-history', filters],
    queryFn: () => superAdminPlatformService.getTransactionHistory(filters),
  })

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'transaction-history-tenant-options'],
    queryFn: () => tenantService.getAll({ per_page: 100 }),
  })

  const sellersQuery = useQuery({
    queryKey: ['super-admin', 'transaction-history-sellers', sellerFilters],
    queryFn: () => superAdminPlatformService.getTransactionHistorySellers(sellerFilters),
  })

  const rows = historyQuery.data?.data ?? []
  const summary = historyQuery.data?.summary
  const meta = historyQuery.data?.meta

  const columns = useMemo<Array<DataTableColumn<TransactionHistoryRow>>>(() => [
    {
      key: 'seller_name',
      label: t('transactionHistory.columns.seller', { defaultValue: 'Seller' }),
      sortable: true,
      sortValue: (row) => row.seller_name,
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-slate-950 dark:text-white">{row.seller_name || '-'}</span>
          {row.seller_email ? <span className="text-xs text-slate-500 dark:text-slate-400">{row.seller_email}</span> : null}
          {row.seller_role ? (
            <span className="mt-0.5">
              <RoleBadge role={row.seller_role as UserRole} />
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'tenant_name',
      label: t('common.tenant', { defaultValue: 'Tenant' }),
      sortable: true,
      sortValue: (row) => row.tenant_name,
      render: (row) => row.tenant_name || '-',
    },
    {
      key: 'customer_name',
      label: t('common.customer', { defaultValue: 'Customer' }),
      sortable: true,
      sortValue: (row) => row.customer_name,
      render: (row) => row.customer_id ? (
        <Link
          to={routePaths.superAdmin.customerDetail(lang, row.customer_id)}
          className="group flex flex-col gap-0.5"
        >
          <span className="font-medium text-sky-600 group-hover:underline dark:text-sky-300">
            {row.customer_name || '-'}
          </span>
          {row.customer_username ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">{row.customer_username}</span>
          ) : null}
        </Link>
      ) : (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-slate-950 dark:text-white">{row.customer_name || '-'}</span>
          {row.customer_username ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">{row.customer_username}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'bios_id',
      label: t('common.biosId', { defaultValue: 'BIOS ID' }),
      sortable: true,
      sortValue: (row) => row.bios_id,
      render: (row) => row.bios_id ? (
        <Link
          to={routePaths.superAdmin.biosDetail(lang, row.bios_id)}
          className="font-mono text-xs text-sky-600 hover:underline dark:text-sky-300"
        >
          {row.bios_id}
        </Link>
      ) : '-',
    },
    {
      key: 'program_name',
      label: t('common.program', { defaultValue: 'Program' }),
      sortable: true,
      sortValue: (row) => row.program_name,
      render: (row) => row.program_name || '-',
    },
    {
      key: 'country_name',
      label: t('common.country', { defaultValue: 'Country' }),
      sortable: true,
      sortValue: (row) => row.country_name,
      render: (row) => row.country_name ? (
        <span className="inline-flex items-center gap-1.5" dir="ltr">
          <FlagImage code={row.country_code} country={row.country_name} />
          <span>{row.country_name}</span>
        </span>
      ) : '-',
    },
    {
      key: 'amount',
      label: t('common.amount', { defaultValue: 'Amount' }),
      sortable: true,
      sortValue: (row) => row.amount,
      render: (row) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(row.amount, 'USD', locale)}
        </span>
      ),
    },
    {
      key: 'type',
      label: t('common.type', { defaultValue: 'Type' }),
      sortable: true,
      sortValue: (row) => row.type,
      render: (row) => (
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
          row.type === 'Renewal'
            ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300'
            : 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300'
        }`}>
          {row.type === 'Renewal'
            ? t('transactionHistory.type.renewal', { defaultValue: 'Renewal' })
            : t('transactionHistory.type.activation', { defaultValue: 'Activation' })}
        </span>
      ),
    },
    {
      key: 'sale_date',
      label: t('transactionHistory.columns.saleDate', { defaultValue: 'Sale Date' }),
      sortable: true,
      sortValue: (row) => row.sale_date ?? '',
      render: (row) => row.sale_date ? formatDate(row.sale_date, locale) : '-',
    },
  ], [lang, locale, t])

  const clearFilters = () => {
    setSearch('')
    setTenantId('')
    setRole('')
    setSellerId('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const hasFilters = search || tenantId || role || sellerId || from || to

  const filteredSellers = role
    ? (sellersQuery.data?.data ?? []).filter((s) => s.role === role)
    : (sellersQuery.data?.data ?? [])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('superAdmin.layout.eyebrow')}
        title={t('transactionHistory.title', { defaultValue: 'Transaction History' })}
        description={t('transactionHistory.description', { defaultValue: 'View all license activations and renewals across all tenants and sellers.' })}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <StatsCard
          title={t('transactionHistory.summary.totalEvents', { defaultValue: 'Total Sales Events' })}
          value={String(summary?.total_events ?? 0)}
          icon={ListOrdered}
          color="sky"
        />
        <button type="button" className="w-full text-start" onClick={() => navigate(routePaths.superAdmin.reports(lang))}>
          <StatsCard
            title={t('transactionHistory.summary.totalSales', { defaultValue: 'Total Sales' })}
            value={formatCurrency(summary?.total_sales ?? 0, 'USD', locale)}
            icon={BadgeDollarSign}
            color="emerald"
          />
        </button>
        <StatsCard
          title={t('transactionHistory.summary.totalSellers', { defaultValue: 'Total Sellers' })}
          value={String(summary?.total_sellers ?? 0)}
          icon={Users}
          color="amber"
        />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <label className="space-y-2 sm:col-span-2 lg:col-span-1 xl:col-span-1">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.search')}</span>
            <Input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder={t('transactionHistory.searchPlaceholder', { defaultValue: 'Customer, BIOS ID, program…' })}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.tenant', { defaultValue: 'Tenant' })}</span>
            <select
              value={tenantId}
              onChange={(event) => { setTenantId(event.target.value ? Number(event.target.value) : ''); setSellerId(''); setPage(1) }}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('common.allTenants', { defaultValue: 'All tenants' })}</option>
              {(tenantsQuery.data?.data ?? []).map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.role', { defaultValue: 'Role' })}</span>
            <select
              value={role}
              onChange={(event) => { setRole(event.target.value as typeof role); setSellerId(''); setPage(1) }}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('common.allRoles', { defaultValue: 'All roles' })}</option>
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(`roles.${opt.value}`)}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.seller', { defaultValue: 'Seller' })}</span>
            <select
              value={sellerId}
              onChange={(event) => { setSellerId(event.target.value ? Number(event.target.value) : ''); setPage(1) }}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('common.allSellers', { defaultValue: 'All sellers' })}</option>
              {filteredSellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name} ({t(`roles.${seller.role}`)})
                </option>
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

        {hasFilters ? (
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="ghost" onClick={clearFilters}>
              {t('common.clear')}
            </Button>
          </div>
        ) : null}
      </div>

      <DataTable
        tableKey="super_admin_transaction_history"
        columns={columns}
        data={rows}
        rowKey={(row) => String(row.id)}
        isLoading={historyQuery.isLoading}
        emptyMessage={t('transactionHistory.empty', { defaultValue: 'No transactions found.' })}
      />

      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>{t('common.totalCount', { count: meta?.total ?? 0 })}</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!meta || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {t('common.previous')}
          </Button>
          <span>{meta ? `${meta.current_page} / ${meta.last_page}` : '1 / 1'}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!meta || page >= meta.last_page}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      </div>
    </div>
  )
}
