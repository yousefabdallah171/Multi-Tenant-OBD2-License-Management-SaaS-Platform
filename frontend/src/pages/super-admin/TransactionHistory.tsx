import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BadgeDollarSign, ListOrdered, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { StatsCard } from '@/components/shared/StatsCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { superAdminPlatformService } from '@/services/super-admin-platform.service'
import { tenantService } from '@/services/tenant.service'
import type { TransactionHistoryFilters, TransactionHistoryRow } from '@/types/manager-reseller.types'

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

  const filters = useMemo<TransactionHistoryFilters>(() => ({
    search: search || undefined,
    tenant_id: tenantId || undefined,
    role: role || undefined,
    seller_id: sellerId || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    per_page: 25,
  }), [search, tenantId, role, sellerId, from, to, page])

  const transactionQuery = useQuery({
    queryKey: ['super-admin', 'transaction-history', filters],
    queryFn: () => superAdminPlatformService.getTransactionHistory(filters),
  })

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'transaction-history', 'tenants'],
    queryFn: () => tenantService.getAll({ per_page: 100 }),
  })

  const sellersQuery = useQuery({
    queryKey: ['super-admin', 'transaction-history', 'sellers', role],
    queryFn: () => superAdminPlatformService.getSellers({ role: role || undefined, per_page: 100 }),
  })

  const rows = transactionQuery.data?.data ?? []
  const summary = transactionQuery.data?.summary
  const meta = transactionQuery.data?.meta

  const columns = useMemo<Array<DataTableColumn<TransactionHistoryRow>>>(() => [
    {
      key: 'seller_name',
      label: t('payments.columns.reseller'),
      sortable: true,
      sortValue: (row) => row.seller_name,
      render: (row) => (
        <button
          type="button"
          onClick={() => navigate(getSellerPath(row))}
          className="inline-flex items-center gap-2 text-left hover:underline"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-blue-600 dark:text-blue-400">{row.seller_name}</span>
              {row.seller_role ? <RoleBadge role={row.seller_role} /> : null}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.seller_email}</p>
          </div>
        </button>
      ),
    },
    {
      key: 'tenant_name',
      label: t('common.tenant'),
      sortable: true,
      sortValue: (row) => row.tenant_name ?? '',
      render: (row) => row.tenant_name || '-',
      defaultHidden: tenantId !== '',
    },
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
      label: t('common.amount'),
      sortable: true,
      sortValue: (row) => row.sale_amount,
      render: (row) => formatCurrency(row.sale_amount, 'USD', locale),
    },
    {
      key: 'action',
      label: t('common.type'),
      sortable: true,
      sortValue: (row) => row.action,
      render: (row) => (
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            row.action === 'license.activated'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          }`}
        >
          {row.action === 'license.activated' ? t('common.activation', { defaultValue: 'Activation' }) : t('common.renewal', { defaultValue: 'Renewal' })}
        </span>
      ),
    },
    {
      key: 'sale_date',
      label: t('payments.managerParentCustomers.columns.saleDate'),
      sortable: true,
      sortValue: (row) => row.sale_date ?? '',
      render: (row) => (row.sale_date ? formatDate(row.sale_date, locale) : '-'),
    },
  ], [lang, locale, navigate, t, tenantId])

  const getSellerPath = (row: TransactionHistoryRow) => {
    if (row.seller_role === 'manager_parent') {
      return routePaths.superAdmin.resellerPaymentsManagerParentCustomers(lang, row.seller_id)
    }
    if (row.seller_role === 'manager') {
      return routePaths.superAdmin.resellerPaymentsManagerCustomers(lang, row.seller_id)
    }
    return routePaths.superAdmin.resellerPaymentsResellerCustomers(lang, row.seller_id)
  }

  const handleClearFilters = () => {
    setSearch('')
    setTenantId('')
    setRole('')
    setSellerId('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('superAdmin.layout.eyebrow')}
        title={t('payments.managerParentCustomers.title', { defaultValue: 'Transaction History' })}
        description={t('payments.description', { defaultValue: 'View all sales transactions across all sellers and tenants' })}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <StatsCard title={t('payments.managerParentCustomers.summary.totalEvents')} value={String(summary?.total_events ?? 0)} icon={ListOrdered} color="sky" />
        <StatsCard title={t('payments.managerParentCustomers.summary.totalSales')} value={formatCurrency(summary?.total_sales ?? 0, 'USD', locale)} icon={BadgeDollarSign} color="emerald" />
        <StatsCard title={t('common.sellers', { defaultValue: 'Total Sellers' })} value={String(summary?.total_sellers ?? 0)} icon={Users} color="amber" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.search')}</span>
            <Input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder={t('payments.managerParentCustomers.searchPlaceholder')}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.tenant')}</span>
            <select
              value={tenantId}
              onChange={(event) => { setTenantId(event.target.value ? Number(event.target.value) : ''); setPage(1) }}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('common.allTenants')}</option>
              {(tenantsQuery.data?.data ?? []).map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.role')}</span>
            <select
              value={role}
              onChange={(event) => { setRole(event.target.value as any); setSellerId(''); setPage(1) }}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('common.allRoles', { defaultValue: 'All Roles' })}</option>
              <option value="manager_parent">{t('roles.manager_parent')}</option>
              <option value="manager">{t('roles.manager')}</option>
              <option value="reseller">{t('roles.reseller')}</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.seller', { defaultValue: 'Seller' })}</span>
            <select
              value={sellerId}
              onChange={(event) => { setSellerId(event.target.value ? Number(event.target.value) : ''); setPage(1) }}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('common.allSellers', { defaultValue: 'All Sellers' })}</option>
              {(sellersQuery.data?.data ?? []).map((seller) => (
                <option key={seller.id} value={seller.id}>{seller.name}</option>
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
          <Button variant="ghost" onClick={handleClearFilters}>
            {t('common.clear')}
          </Button>
        </div>
      </div>

      <DataTable
        tableKey="super_admin_transaction_history"
        columns={columns}
        data={rows}
        rowKey={(row) => `${row.id}`}
        isLoading={transactionQuery.isLoading}
        emptyMessage={t('payments.managerParentCustomers.empty', { defaultValue: 'No transactions found' })}
      />

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
