import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { api } from '@/services/api'
import type { ManagerParentSalesCustomerFilters } from '@/types/manager-reseller.types'

interface TransactionEditLog {
  id: number
  license_id: number
  tenant_id: number
  tenant_name: string
  bios_id: string
  customer_name: string
  reseller_name: string
  program_name: string
  super_admin_id: number
  super_admin_name: string
  previous_values: Record<string, any>
  new_values: Record<string, any>
  reason: string
  created_at: string
}

export function TransactionEditLogsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'

  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)

  const filters = useMemo<ManagerParentSalesCustomerFilters>(() => ({
    search: search || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    per_page: perPage,
  }), [from, page, perPage, search, to])

  const logsQuery = useQuery({
    queryKey: ['super-admin', 'transaction-edit-logs', filters],
    queryFn: async () => {
      const { data } = await api.get<{
        data: TransactionEditLog[]
        meta: { current_page: number; last_page: number; total: number; per_page: number }
      >('/super-admin/transaction-edit-logs', { params: filters })
      return data
    },
  })

  const rows = logsQuery.data?.data ?? []
  const meta = logsQuery.data?.meta

  const columns = useMemo<Array<DataTableColumn<TransactionEditLog>>>(() => [
    {
      key: 'created_at',
      label: t('common.date'),
      sortable: true,
      sortValue: (row) => row.created_at,
      render: (row) => formatDate(row.created_at, locale),
    },
    {
      key: 'super_admin_name',
      label: t('transaction.edit.edited_by', { defaultValue: 'Edited By' }),
      sortable: true,
      sortValue: (row) => row.super_admin_name,
      render: (row) => row.super_admin_name,
    },
    {
      key: 'bios_id',
      label: t('payments.managerParentCustomers.columns.biosId'),
      sortable: true,
      sortValue: (row) => row.bios_id,
      render: (row) => row.bios_id,
    },
    {
      key: 'customer_name',
      label: t('payments.managerParentCustomers.columns.customer'),
      sortable: true,
      sortValue: (row) => row.customer_name ?? '',
      render: (row) => row.customer_name || '-',
    },
    {
      key: 'reseller_name',
      label: t('transaction.field.reseller', { defaultValue: 'Reseller' }),
      sortable: true,
      sortValue: (row) => row.reseller_name ?? '',
      render: (row) => row.reseller_name || '-',
    },
    {
      key: 'program_name',
      label: t('payments.managerParentCustomers.columns.program'),
      sortable: true,
      sortValue: (row) => row.program_name ?? '',
      render: (row) => row.program_name || '-',
    },
    {
      key: 'changes',
      label: t('transaction.edit.changes', { defaultValue: 'Changes' }),
      render: (row) => {
        const changes = Object.entries(row.new_values)
          .map(([key, newVal]) => {
            const oldVal = row.previous_values[key]
            if (key === 'price') {
              return `Price: $${oldVal} → $${newVal}`
            }
            return `${key}: ${oldVal} → ${newVal}`
          })
          .join(', ')
        return <span className="text-sm text-gray-700">{changes || '-'}</span>
      },
    },
    {
      key: 'reason',
      label: t('transaction.edit.reason_label', { defaultValue: 'Reason' }),
      render: (row) => (
        <div className="max-w-xs">
          <p className="text-sm text-gray-700 line-clamp-2" title={row.reason}>
            {row.reason || '-'}
          </p>
        </div>
      ),
    },
  ], [locale, t])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('superAdmin.layout.eyebrow')}
        title={t('transaction.edit.logs_title', { defaultValue: 'Transaction Edit Logs' })}
        description={t('transaction.edit.logs_description', {
          defaultValue: 'View all transaction edits across all customers',
        })}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.search')}</span>
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder={t('transaction.edit.search_placeholder', {
                defaultValue: 'Search by BIOS ID, customer name, or reseller...',
              })}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.from')}</span>
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value)
                setPage(1)
              }}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-950 dark:text-white">{t('common.to')}</span>
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value)
                setPage(1)
              }}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch('')
              setFrom('')
              setTo('')
              setPage(1)
            }}
          >
            {t('common.clear')}
          </Button>
        </div>
      </div>

      <DataTable
        tableKey="super_admin_transaction_edit_logs"
        columns={columns}
        data={rows}
        rowKey={(row) => `${row.id}`}
        isLoading={logsQuery.isLoading}
        emptyMessage={t('transaction.edit.logs_empty', {
          defaultValue: 'No transaction edits found',
        })}
        pagination={{
          page: meta?.current_page ?? page,
          lastPage: meta?.last_page ?? 1,
          total: meta?.total ?? 0,
          perPage: meta?.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPerPage(newSize)
          setPage(1)
        }}
      />
    </div>
  )
}
