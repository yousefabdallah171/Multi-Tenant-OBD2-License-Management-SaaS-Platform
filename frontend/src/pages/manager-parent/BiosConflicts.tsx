import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { managerParentService } from '@/services/manager-parent.service'
import { routePaths } from '@/router/routes'
import type { BiosConflictFilters, BiosConflictItem } from '@/types/manager-parent.types'

function StatusPill({ status, label }: { status: BiosConflictItem['status']; label: string }) {
  const base = 'inline-flex rounded-full px-3 py-1 text-sm font-semibold'
  const className = status === 'resolved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'

  return <span className={`${base} ${className}`}>{label}</span>
}

export function BiosConflictsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(15)
  const [conflictType, setConflictType] = useState('')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [selectedConflict, setSelectedConflict] = useState<BiosConflictItem | null>(null)

  const params: BiosConflictFilters = useMemo(
    () => ({
      page,
      per_page: perPage,
      conflict_type: conflictType || undefined,
      from: dateRange.from || undefined,
      to: dateRange.to || undefined,
    }),
    [conflictType, dateRange.from, dateRange.to, page, perPage],
  )

  const conflictsQuery = useQuery({
    queryKey: ['manager-parent', 'bios-conflicts', params],
    queryFn: () => managerParentService.getBiosConflicts(params),
  })

  const columns: Array<DataTableColumn<BiosConflictItem>> = [
    {
      key: 'bios',
      label: t('managerParent.pages.biosConflicts.columns.biosId'),
      sortable: true,
      sortValue: (row) => row.bios_id,
      render: (row) => (
        <div>
          <button type="button" className="text-sky-600 hover:underline dark:text-sky-300" onClick={() => navigate(routePaths.managerParent.biosDetail(lang, row.bios_id))}>
            <code>{row.bios_id}</code>
          </button>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            @{row.affected_customers[0]?.username ?? '-'}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      label: t('managerParent.pages.biosConflicts.columns.conflictType'),
      sortable: true,
      sortValue: (row) => row.conflict_type,
      render: (row) => t(`managerParent.pages.biosConflicts.types.${row.conflict_type}`, { defaultValue: row.conflict_type }),
    },
    {
      key: 'customers',
      label: t('managerParent.pages.biosConflicts.columns.affectedCustomers'),
      render: (row) => (row.affected_customers.length > 0
        ? (
            <div className="flex flex-wrap gap-2">
              {row.affected_customers.map((customer) => (
                customer.id
                  ? <Link key={`${row.id}-${customer.id}`} className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.customerDetail(lang, customer.id)}>{customer.name}</Link>
                  : <span key={`${row.id}-${customer.name}`} className="text-slate-500 dark:text-slate-400">{customer.name}</span>
              ))}
            </div>
          )
        : t('managerParent.pages.biosConflicts.noCustomers')),
    },
    {
      key: 'reseller',
      label: t('common.reseller'),
      render: (row) => row.reseller_name || '-',
    },
    {
      key: 'date',
      label: t('managerParent.pages.biosConflicts.columns.dateDetected'),
      sortable: true,
      sortValue: (row) => row.created_at ?? '',
      render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-'),
    },
    {
      key: 'status',
      label: t('managerParent.pages.biosConflicts.columns.status'),
      sortable: true,
      sortValue: (row) => row.status,
      render: (row) => <StatusPill status={row.status} label={t(`managerParent.pages.biosConflicts.status.${row.status}`)} />,
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedConflict(row)}>
            {t('common.view')}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('managerParent.pages.biosConflicts.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.biosConflicts.description')}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
            <select
              value={conflictType}
              onChange={(event) => {
                setConflictType(event.target.value)
                setPage(1)
              }}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('managerParent.pages.biosConflicts.allTypes')}</option>
              <option value="duplicate_activation">{t('managerParent.pages.biosConflicts.types.duplicate_activation')}</option>
              <option value="username_bios_mismatch">{t('managerParent.pages.biosConflicts.types.username_bios_mismatch')}</option>
              <option value="blacklisted_bios">{t('managerParent.pages.biosConflicts.types.blacklisted_bios')}</option>
            </select>
            <DateRangePicker
              value={dateRange}
              onChange={(nextValue) => {
                setDateRange(nextValue)
                setPage(1)
              }}
            />
          </div>
        </CardContent>
      </Card>

      <DataTable
        tableKey="manager_parent_bios_conflicts"
        columns={columns}
        data={conflictsQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        isLoading={conflictsQuery.isLoading}
        emptyMessage={t('managerParent.pages.biosConflicts.emptyTitle')}
        pagination={{
          page: conflictsQuery.data?.meta.current_page ?? 1,
          lastPage: conflictsQuery.data?.meta.last_page ?? 1,
          total: conflictsQuery.data?.meta.total ?? 0,
          perPage: conflictsQuery.data?.meta.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPerPage(size)
          setPage(1)
        }}
      />

      <Dialog open={selectedConflict !== null} onOpenChange={(open) => !open && setSelectedConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('managerParent.pages.biosConflicts.detailsTitle')}</DialogTitle>
            <DialogDescription>{t('managerParent.pages.biosConflicts.detailsDescription')}</DialogDescription>
          </DialogHeader>
          {selectedConflict ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-slate-500 dark:text-slate-400">{t('managerParent.pages.biosConflicts.columns.biosId')}</span>
                <code>{selectedConflict.bios_id}</code>
                <span className="text-slate-500 dark:text-slate-400">{t('managerParent.pages.biosConflicts.columns.conflictType')}</span>
                <span>{t(`managerParent.pages.biosConflicts.types.${selectedConflict.conflict_type}`, { defaultValue: selectedConflict.conflict_type })}</span>
                <span className="text-slate-500 dark:text-slate-400">{t('common.program')}</span>
                <span>{selectedConflict.program_name ?? '-'}</span>
                <span className="text-slate-500 dark:text-slate-400">{t('common.user')}</span>
                <span>{selectedConflict.attempted_by_name ?? '-'}</span>
              </div>
              <div>
                <p className="mb-1 text-slate-500 dark:text-slate-400">{t('managerParent.pages.biosConflicts.columns.affectedCustomers')}</p>
                <p>{selectedConflict.affected_customers.length > 0 ? selectedConflict.affected_customers.map((customer) => customer.name).join(', ') : t('managerParent.pages.biosConflicts.noCustomers')}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
