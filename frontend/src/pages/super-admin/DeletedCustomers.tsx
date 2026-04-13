import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreVertical, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { formatCurrency, formatDate } from '@/lib/utils'
import { deletedCustomerService } from '@/services/deleted-customer.service'
import { tenantService } from '@/services/tenant.service'
import type { DeletedCustomer } from '@/types/super-admin.types'

type PendingAction =
  | { type: 'restore'; row: DeletedCustomer }
  | { type: 'deleteRevenue'; row: DeletedCustomer }
  | { type: 'destroy'; row: DeletedCustomer }
  | null

export function DeletedCustomersPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [tenantId, setTenantId] = useState<number | ''>(() => {
    const value = searchParams.get('tenant_id')
    return value ? Number(value) : ''
  })
  const [detailId, setDetailId] = useState<number | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [confirmName, setConfirmName] = useState('')

  const deletedCustomersQuery = useQuery({
    queryKey: ['super-admin', 'deleted-customers', page, perPage, search, tenantId],
    queryFn: () =>
      deletedCustomerService.getAll({
        page,
        per_page: perPage,
        search: search || undefined,
        tenant_id: typeof tenantId === 'number' ? tenantId : undefined,
      }),
  })

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'tenant-options'],
    queryFn: () => tenantService.getAll({ per_page: 100 }),
  })

  const detailQuery = useQuery({
    queryKey: ['super-admin', 'deleted-customers', 'detail', detailId],
    queryFn: () => deletedCustomerService.getOne(detailId as number),
    enabled: detailId !== null,
  })

  const restoreMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => deletedCustomerService.restore(id, { confirm_name: name }),
    onSuccess: (data) => {
      toast.success(data.message)
      setPendingAction(null)
      setConfirmName('')
      setDetailId(null)
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'deleted-customers'] })
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'customers'] })
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  const deleteRevenueMutation = useMutation({
    mutationFn: (id: number) => deletedCustomerService.deleteRevenue(id),
    onSuccess: (data) => {
      toast.success(data.message)
      setPendingAction(null)
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'deleted-customers'] })
      if (detailId !== null) {
        void queryClient.invalidateQueries({ queryKey: ['super-admin', 'deleted-customers', 'detail', detailId] })
      }
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  const destroyMutation = useMutation({
    mutationFn: (id: number) => deletedCustomerService.destroy(id),
    onSuccess: (data) => {
      toast.success(data.message)
      setPendingAction(null)
      setDetailId(null)
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'deleted-customers'] })
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  const columns = useMemo<Array<DataTableColumn<DeletedCustomer>>>(
    () => [
      {
        key: 'name',
        label: t('common.name'),
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <div>
            <div className="font-medium text-slate-950 dark:text-white">{row.name}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{row.email || '-'}</div>
          </div>
        ),
      },
      {
        key: 'tenant',
        label: t('common.tenant'),
        sortable: true,
        sortValue: (row) => row.tenant?.name ?? '',
        render: (row) => row.tenant?.name ?? '-',
      },
      {
        key: 'deleted_by',
        label: t('superAdmin.pages.deletedCustomers.deletedBy'),
        sortable: true,
        sortValue: (row) => row.deleted_by?.name ?? '',
        render: (row) => row.deleted_by?.name ?? '-',
      },
      {
        key: 'deleted_at',
        label: t('superAdmin.pages.deletedCustomers.deletedAt'),
        sortable: true,
        sortValue: (row) => row.deleted_at,
        render: (row) => formatDate(row.deleted_at, locale),
      },
      {
        key: 'licenses_count',
        label: t('common.licenses'),
        sortable: true,
        sortValue: (row) => row.licenses_count,
        render: (row) => row.licenses_count,
      },
      {
        key: 'revenue_total',
        label: t('superAdmin.pages.deletedCustomers.revenue'),
        sortable: true,
        sortValue: (row) => row.revenue_total,
        render: (row) => formatCurrency(row.revenue_total, 'USD', locale),
      },
      {
        key: 'actions',
        label: t('common.actions'),
        className: 'w-20',
        render: (row) => (
          <div onClick={(event) => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="ghost">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDetailId(row.id)}>
                  {t('common.view')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPendingAction({ type: 'deleteRevenue', row })}>
                  {t('superAdmin.pages.deletedCustomers.deleteRevenue')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPendingAction({ type: 'restore', row })}>
                  {t('superAdmin.pages.deletedCustomers.restore')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPendingAction({ type: 'destroy', row })}>
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [locale, t],
  )

  const detail = detailQuery.data?.data ?? null
  const snapshotUser = detail?.snapshot.user ?? null
  const snapshotLicenses = Array.isArray(detail?.snapshot.licenses) ? detail.snapshot.licenses : []
  const activityLogIds = Array.isArray(detail?.snapshot.activity_log_ids) ? detail.snapshot.activity_log_ids : []

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('superAdmin.pages.deletedCustomers.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.deletedCustomers.description')}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="ps-10"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder={t('superAdmin.pages.customers.searchPlaceholder')}
              />
            </div>
            <select
              value={tenantId}
              onChange={(event) => {
                const nextValue = event.target.value ? Number(event.target.value) : ''
                setTenantId(nextValue)
                setPage(1)
                const nextParams = new URLSearchParams(searchParams)
                if (typeof nextValue === 'number') {
                  nextParams.set('tenant_id', String(nextValue))
                } else {
                  nextParams.delete('tenant_id')
                }
                setSearchParams(nextParams, { replace: true })
              }}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('common.allTenants')}</option>
              {tenantsQuery.data?.data.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <DataTable
        tableKey="super_admin_deleted_customers"
        columns={columns}
        data={deletedCustomersQuery.data?.data ?? []}
        isLoading={deletedCustomersQuery.isLoading}
        emptyMessage={t('common.noData')}
        rowKey={(row) => row.id}
        onRowClick={(row) => setDetailId(row.id)}
        pagination={{
          page: deletedCustomersQuery.data?.meta.current_page ?? page,
          lastPage: deletedCustomersQuery.data?.meta.last_page ?? 1,
          total: deletedCustomersQuery.data?.meta.total ?? 0,
          perPage: deletedCustomersQuery.data?.meta.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPerPage(nextPageSize)
          setPage(1)
        }}
      />

      <Dialog open={detailId !== null} onOpenChange={(open) => {
        if (!open) {
          setDetailId(null)
        }
      }}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.name ?? t('superAdmin.pages.deletedCustomers.title')}</DialogTitle>
            <DialogDescription>
              {detail?.deleted_at ? formatDate(detail.deleted_at, locale) : t('common.loading')}
            </DialogDescription>
          </DialogHeader>

          {detailQuery.isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
          ) : detail ? (
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-3">
                <Card>
                  <CardContent className="space-y-1 p-4">
                    <div className="text-sm text-slate-500 dark:text-slate-400">{t('common.tenant')}</div>
                    <div className="font-medium">{detail.tenant?.name ?? '-'}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-1 p-4">
                    <div className="text-sm text-slate-500 dark:text-slate-400">{t('common.licenses')}</div>
                    <div className="font-medium">{detail.licenses_count}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-1 p-4">
                    <div className="text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.deletedCustomers.revenue')}</div>
                    <div className="font-medium">{formatCurrency(detail.revenue_total, 'USD', locale)}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="space-y-2 p-4 text-sm">
                    <div><span className="font-medium">{t('common.name')}:</span> {detail.name}</div>
                    <div><span className="font-medium">{t('common.email')}:</span> {detail.email || '-'}</div>
                    <div><span className="font-medium">{t('common.username')}:</span> {detail.username || '-'}</div>
                    <div><span className="font-medium">{t('common.phone')}:</span> {detail.phone || '-'}</div>
                    <div><span className="font-medium">{t('superAdmin.pages.deletedCustomers.deletedBy')}:</span> {detail.deleted_by?.name ?? '-'}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-2 p-4 text-sm">
                    <div><span className="font-medium">Snapshot User ID:</span> {String(snapshotUser?.id ?? '-')}</div>
                    <div><span className="font-medium">Snapshot Status:</span> {String(snapshotUser?.status ?? '-')}</div>
                    <div><span className="font-medium">Snapshot Role:</span> {String(snapshotUser?.role ?? '-')}</div>
                    <div><span className="font-medium">Activity Logs:</span> {activityLogIds.length}</div>
                    <div><span className="font-medium">Original Customer ID:</span> {detail.original_customer_id ?? '-'}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="font-medium">{t('common.licenses')}</div>
                  {snapshotLicenses.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.noData')}</p>
                  ) : (
                    <div className="space-y-3">
                      {snapshotLicenses.map((license, index) => (
                        <div key={`${license.id ?? 'snapshot'}-${index}`} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                          <div><span className="font-medium">BIOS:</span> {String(license.bios_id ?? '-')}</div>
                          <div><span className="font-medium">{t('common.program')}:</span> {String(license.program_id ?? '-')}</div>
                          <div><span className="font-medium">{t('common.status')}:</span> {String(license.status ?? '-')}</div>
                          <div><span className="font-medium">{t('common.price')}:</span> {String(license.price ?? '-')}</div>
                          <div><span className="font-medium">{t('common.start')}:</span> {String(license.activated_at ?? license.start_at ?? '-')}</div>
                          <div><span className="font-medium">{t('common.expiry')}:</span> {String(license.expires_at ?? '-')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-2 p-4">
                  <div className="font-medium">Activity Log IDs</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {activityLogIds.length > 0 ? activityLogIds.join(', ') : t('common.noData')}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.noData')}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailId(null)}>
              {t('common.closeDialog')}
            </Button>
            {detail ? (
              <>
                <Button type="button" variant="secondary" onClick={() => setPendingAction({ type: 'deleteRevenue', row: detail })}>
                  {t('superAdmin.pages.deletedCustomers.deleteRevenue')}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setPendingAction({ type: 'restore', row: detail })}>
                  {t('superAdmin.pages.deletedCustomers.restore')}
                </Button>
                <Button type="button" variant="destructive" onClick={() => setPendingAction({ type: 'destroy', row: detail })}>
                  {t('common.delete')}
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null)
            setConfirmName('')
          }
        }}
        title={
          pendingAction?.type === 'restore'
            ? t('superAdmin.pages.deletedCustomers.restore')
            : pendingAction?.type === 'deleteRevenue'
              ? t('superAdmin.pages.deletedCustomers.deleteRevenueConfirm')
              : t('common.delete')
        }
        description={
          pendingAction?.type === 'restore'
            ? t('superAdmin.pages.deletedCustomers.restoreWarning')
            : pendingAction?.row
              ? `${pendingAction.row.name} - ${pendingAction.row.email || '-'}`
              : undefined
        }
        confirmLabel={
          pendingAction?.type === 'restore'
            ? t('superAdmin.pages.deletedCustomers.restore')
            : pendingAction?.type === 'deleteRevenue'
              ? t('superAdmin.pages.deletedCustomers.deleteRevenue')
              : t('common.delete')
        }
        isDestructive={pendingAction?.type !== 'restore'}
        confirmDisabled={
          (pendingAction?.type === 'restore' && confirmName.trim() !== pendingAction.row.name)
          || restoreMutation.isPending
          || deleteRevenueMutation.isPending
          || destroyMutation.isPending
        }
        onConfirm={() => {
          if (!pendingAction) {
            return
          }

          if (pendingAction.type === 'restore') {
            restoreMutation.mutate({ id: pendingAction.row.id, name: confirmName.trim() })
            return
          }

          if (pendingAction.type === 'deleteRevenue') {
            deleteRevenueMutation.mutate(pendingAction.row.id)
            return
          }

          destroyMutation.mutate(pendingAction.row.id)
        }}
      >
        {pendingAction?.type === 'restore' ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Type <span className="font-medium">{pendingAction.row.name}</span> to confirm.
            </p>
            <Input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} />
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}
