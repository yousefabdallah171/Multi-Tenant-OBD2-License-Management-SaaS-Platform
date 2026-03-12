import { type ReactNode, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { StatusFilterCard } from '@/components/customers/StatusFilterCard'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { biosService, type BiosConflictParams } from '@/services/bios.service'
import type { BiosConflictItem } from '@/types/super-admin.types'

function StatusPill({ status, label }: { status: BiosConflictItem['status']; label: string }) {
  const base = 'inline-flex rounded-full px-3 py-1 text-xs font-semibold'
  const className = status === 'resolved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'

  return <span className={`${base} ${className}`}>{label}</span>
}

export function BiosConflictsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [status, setStatus] = useState<BiosConflictParams['status']>('')
  const [conflictType, setConflictType] = useState('')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [selectedConflict, setSelectedConflict] = useState<BiosConflictItem | null>(null)
  const [resolveTarget, setResolveTarget] = useState<BiosConflictItem | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')

  const params: BiosConflictParams = useMemo(
    () => ({
      page,
      per_page: perPage,
      status,
      conflict_type: conflictType || undefined,
      from: dateRange.from || undefined,
      to: dateRange.to || undefined,
    }),
    [conflictType, dateRange.from, dateRange.to, page, perPage, status],
  )

  const conflictsQuery = useQuery({
    queryKey: ['super-admin', 'bios-conflicts', params],
    queryFn: () => biosService.getConflicts(params),
  })

  const resolveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) => biosService.resolveConflict(id, { resolution_notes: notes }),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.biosConflicts.resolveSuccess'))
      setResolveTarget(null)
      setResolutionNotes('')
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'bios-conflicts'] })
    },
  })

  const columns: Array<DataTableColumn<BiosConflictItem>> = [
    {
      key: 'bios',
      label: t('superAdmin.pages.biosConflicts.columns.biosId'),
      sortable: true,
      sortValue: (row) => row.bios_id,
      render: (row) => <button type="button" className="text-sky-600 hover:underline dark:text-sky-300" onClick={() => navigate(routePaths.superAdmin.biosDetail(lang, row.bios_id))}><code>{row.bios_id}</code></button>,
    },
    {
      key: 'tenant',
      label: t('common.tenant'),
      sortable: true,
      sortValue: (row) => row.tenant_name ?? '',
      render: (row) => row.tenant_name ?? '-',
    },
    {
      key: 'type',
      label: t('superAdmin.pages.biosConflicts.columns.conflictType'),
      sortable: true,
      sortValue: (row) => row.conflict_type,
      render: (row) => t(`superAdmin.pages.biosConflicts.types.${row.conflict_type}`, { defaultValue: row.conflict_type }),
    },
    {
      key: 'customers',
      label: t('superAdmin.pages.biosConflicts.columns.affectedCustomers'),
      render: (row) => (row.affected_customers.length > 0
        ? row.affected_customers.map((customer) => customer.id != null ? (
          <button key={customer.id} type="button" className="text-sky-600 hover:underline dark:text-sky-300" onClick={() => navigate(routePaths.superAdmin.customerDetail(lang, Number(customer.id)))}>
            {customer.name}
          </button>
        ) : <span key={customer.name}>{customer.name}</span>).reduce<ReactNode[]>((acc, node, index) => {
          if (index > 0) acc.push(<span key={`sep-${index}`}>, </span>)
          acc.push(node)
          return acc
        }, [])
        : t('superAdmin.pages.biosConflicts.noCustomers')),
    },
    {
      key: 'date',
      label: t('superAdmin.pages.biosConflicts.columns.dateDetected'),
      sortable: true,
      sortValue: (row) => row.created_at ?? '',
      render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-'),
    },
    {
      key: 'status',
      label: t('superAdmin.pages.biosConflicts.columns.status'),
      sortable: true,
      sortValue: (row) => row.status,
      render: (row) => <StatusPill status={row.status} label={t(`superAdmin.pages.biosConflicts.status.${row.status}`)} />,
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedConflict(row)}>
            {t('common.view')}
          </Button>
          {!row.resolved ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setResolveTarget(row)}>
              {t('superAdmin.pages.biosConflicts.resolve')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('superAdmin.pages.biosConflicts.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.biosConflicts.description')}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <StatusFilterCard label={t('common.all')} count={conflictsQuery.data?.status_counts.all ?? 0} isActive={status === ''} onClick={() => { setStatus(''); setPage(1) }} color="sky" />
            <StatusFilterCard label={t('superAdmin.pages.biosConflicts.status.open')} count={conflictsQuery.data?.status_counts.open ?? 0} isActive={status === 'open'} onClick={() => { setStatus('open'); setPage(1) }} color="rose" />
            <StatusFilterCard label={t('superAdmin.pages.biosConflicts.status.resolved')} count={conflictsQuery.data?.status_counts.resolved ?? 0} isActive={status === 'resolved'} onClick={() => { setStatus('resolved'); setPage(1) }} color="emerald" />
          </div>
          <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
            <select
              value={conflictType}
              onChange={(event) => {
                setConflictType(event.target.value)
                setPage(1)
              }}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('superAdmin.pages.biosConflicts.allTypes')}</option>
              <option value="duplicate_activation">{t('superAdmin.pages.biosConflicts.types.duplicate_activation')}</option>
              <option value="username_bios_mismatch">{t('superAdmin.pages.biosConflicts.types.username_bios_mismatch')}</option>
              <option value="blacklisted_bios">{t('superAdmin.pages.biosConflicts.types.blacklisted_bios')}</option>
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
        columns={columns}
        data={conflictsQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        isLoading={conflictsQuery.isLoading}
        emptyMessage={t('superAdmin.pages.biosConflicts.emptyTitle')}
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
            <DialogTitle>{t('superAdmin.pages.biosConflicts.detailsTitle')}</DialogTitle>
            <DialogDescription>{t('superAdmin.pages.biosConflicts.detailsDescription')}</DialogDescription>
          </DialogHeader>
          {selectedConflict ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-slate-500 dark:text-slate-400">{t('superAdmin.pages.biosConflicts.columns.biosId')}</span>
                <code>{selectedConflict.bios_id}</code>
                <span className="text-slate-500 dark:text-slate-400">{t('common.tenant')}</span>
                <span>{selectedConflict.tenant_name ?? '-'}</span>
                <span className="text-slate-500 dark:text-slate-400">{t('superAdmin.pages.biosConflicts.columns.conflictType')}</span>
                <span>{t(`superAdmin.pages.biosConflicts.types.${selectedConflict.conflict_type}`, { defaultValue: selectedConflict.conflict_type })}</span>
                <span className="text-slate-500 dark:text-slate-400">{t('common.program')}</span>
                <span>{selectedConflict.program_name ?? '-'}</span>
                <span className="text-slate-500 dark:text-slate-400">{t('common.user')}</span>
                <span>{selectedConflict.attempted_by_name ?? '-'}</span>
              </div>
              <div>
                <p className="mb-1 text-slate-500 dark:text-slate-400">{t('superAdmin.pages.biosConflicts.columns.affectedCustomers')}</p>
                <p>{selectedConflict.affected_customers.length > 0 ? selectedConflict.affected_customers.map((customer) => customer.name).join(', ') : t('superAdmin.pages.biosConflicts.noCustomers')}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={resolveTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResolveTarget(null)
            setResolutionNotes('')
          }
        }}
        title={t('superAdmin.pages.biosConflicts.resolveTitle')}
        description={resolveTarget ? t('superAdmin.pages.biosConflicts.resolveDescription', { biosId: resolveTarget.bios_id }) : undefined}
        confirmLabel={t('superAdmin.pages.biosConflicts.resolve')}
        onConfirm={() => {
          if (!resolveTarget) {
            return
          }

          if (!resolutionNotes.trim()) {
            toast.error(t('superAdmin.pages.biosConflicts.notesRequired'))
            return
          }

          resolveMutation.mutate({ id: resolveTarget.id, notes: resolutionNotes.trim() })
        }}
      >
        <div className="space-y-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">{t('superAdmin.pages.biosConflicts.notesLabel')}</p>
          <Textarea value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} />
        </div>
      </ConfirmDialog>
    </div>
  )
}
