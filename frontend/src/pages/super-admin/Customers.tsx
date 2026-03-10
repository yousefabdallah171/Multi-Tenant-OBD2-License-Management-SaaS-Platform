import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreVertical, Pause, Pencil, Play, Plus, RotateCw, ShieldOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { EditCustomerDialog } from '@/components/customers/EditCustomerDialog'
import { RenewLicenseDialog } from '@/components/licenses/RenewLicenseDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { canReactivateLicense, canRetryScheduledLicense, formatDate, getLicenseDisplayStatus, shouldRenewLicense } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { licenseService } from '@/services/license.service'
import { programService } from '@/services/program.service'
import { superAdminCustomerService } from '@/services/super-admin-customer.service'
import { adminService } from '@/services/admin.service'
import { tenantService } from '@/services/tenant.service'
import type { SuperAdminCustomerSummary } from '@/types/super-admin.types'
import type { RenewLicenseData } from '@/types/manager-reseller.types'

const STATUS_OPTIONS = ['all', 'active', 'scheduled', 'expired', 'cancelled', 'pending'] as const

export function CustomersPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all')
  const [tenantId, setTenantId] = useState<number | ''>('')
  const [resellerId, setResellerId] = useState<number | ''>('')
  const [programId, setProgramId] = useState<number | ''>('')
  const [renewLicenseId, setRenewLicenseId] = useState<number | null>(null)
  const [editTarget, setEditTarget] = useState<SuperAdminCustomerSummary | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<SuperAdminCustomerSummary | null>(null)
  const [pauseTarget, setPauseTarget] = useState<SuperAdminCustomerSummary | null>(null)
  const [resumeTarget, setResumeTarget] = useState<SuperAdminCustomerSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminCustomerSummary | null>(null)

  const customersQuery = useQuery({
    queryKey: ['super-admin', 'customers', page, perPage, search, status, tenantId, resellerId, programId],
    queryFn: () =>
      superAdminCustomerService.getAll({
        page,
        per_page: perPage,
        search,
        tenant_id: tenantId,
        reseller_id: resellerId,
        program_id: programId,
        status: status === 'all' ? '' : status,
      }),
  })

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'customers', 'tenants'],
    queryFn: () => tenantService.getAll({ per_page: 100 }),
  })

  const sellersQuery = useQuery({
    queryKey: ['super-admin', 'customers', 'sellers'],
    queryFn: () => adminService.getAll({ per_page: 100 }),
  })

  const programsQuery = useQuery({
    queryKey: ['super-admin', 'customers', 'programs'],
    queryFn: () => programService.getAll({ per_page: 100 }),
  })

  const expiringQuery = useQuery({
    queryKey: ['super-admin', 'licenses', 'expiring'],
    queryFn: () => superAdminCustomerService.getExpiring(),
  })

  const editMutation = useMutation({
    mutationFn: (payload: { client_name: string; email?: string; phone?: string }) =>
      superAdminCustomerService.update(editTarget?.id ?? 0, payload),
    onSuccess: () => {
      toast.success(t('common.saved', { defaultValue: 'Saved' }))
      setEditTarget(null)
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const renewMutation = useMutation({
    mutationFn: (payload: RenewLicenseData) => licenseService.renew(renewLicenseId ?? 0, payload),
    onSuccess: () => {
      toast.success(t('common.renewed'))
      setRenewLicenseId(null)
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const deactivateMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.deactivate(licenseId),
    onSuccess: () => {
      toast.success(t('common.deactivated', { defaultValue: 'Deactivated successfully.' }))
      setDeactivateTarget(null)
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const pauseMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.pause(licenseId),
    onSuccess: () => {
      toast.success(t('common.paused'))
      setPauseTarget(null)
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const resumeMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.resume(licenseId),
    onSuccess: () => {
      toast.success(t('common.resumed'))
      setResumeTarget(null)
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const retryScheduledMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.retryScheduled(licenseId),
    onSuccess: () => {
      toast.success(t('common.retrySuccess', { defaultValue: 'Scheduled activation retried successfully.' }))
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const deleteMutation = useMutation({
    mutationFn: (customerId: number) => superAdminCustomerService.remove(customerId),
    onSuccess: () => {
      toast.success(t('common.deleted', { defaultValue: 'Deleted successfully.' }))
      setDeleteTarget(null)
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const sellerOptions = (sellersQuery.data?.data ?? []).filter((user) => user.role !== 'super_admin' && user.role !== 'customer')

  const columns = useMemo<Array<DataTableColumn<SuperAdminCustomerSummary>>>(
    () => [
      {
        key: 'name',
        label: t('common.name'),
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.superAdmin.customerDetail(lang, row.id)}>
            {row.name}
          </Link>
        ),
      },
      {
        key: 'username',
        label: t('common.username'),
        sortable: true,
        sortValue: (row) => row.username ?? '',
        render: (row) => (
          <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.superAdmin.customerDetail(lang, row.id)}>
            {row.username ?? '-'}
          </Link>
        ),
      },
      { key: 'tenant', label: t('common.tenant'), sortable: true, sortValue: (row) => row.tenant?.name ?? '', render: (row) => row.tenant?.name ?? '-' },
      { key: 'phone', label: t('common.phone'), sortable: true, sortValue: (row) => row.phone ?? '', render: (row) => row.phone ?? '-' },
      {
        key: 'bios',
        label: t('managerParent.pages.customers.biosId'),
        sortable: true,
        sortValue: (row) => row.bios_id ?? '',
        render: (row) => row.bios_id ? <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.superAdmin.biosDetail(lang, row.bios_id)}>{row.bios_id}</Link> : '-',
      },
      { key: 'reseller', label: t('common.reseller'), sortable: true, sortValue: (row) => row.reseller ?? '', render: (row) => row.reseller ?? '-' },
      { key: 'program', label: t('common.program'), sortable: true, sortValue: (row) => row.program ?? '', render: (row) => row.program ?? '-' },
      { key: 'start', label: t('common.start', { defaultValue: 'Start' }), sortable: true, sortValue: (row) => row.start_at ?? '', render: (row) => (row.start_at ? formatDate(row.start_at, locale) : '-') },
      { key: 'status', label: t('common.status'), sortable: true, sortValue: (row) => row.status ?? '', render: (row) => row.status ? <StatusBadge status={getLicenseDisplayStatus(row) as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} /> : '-' },
      { key: 'expiry', label: t('common.expiry'), sortable: true, sortValue: (row) => row.expiry ?? '', render: (row) => (row.expiry ? formatDate(row.expiry, locale) : '-') },
      {
        key: 'actions',
        label: t('common.actions'),
        render: (row) => (
          <div onClick={(event) => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="ghost" aria-label={t('common.actions')}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => navigate(routePaths.superAdmin.customerDetail(lang, row.id))}>{t('common.view')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setEditTarget(row)}>
                  <Pencil className="me-2 h-4 w-4" />
                  {t('common.edit')}
                </DropdownMenuItem>
                {row.license_id && shouldRenewLicense(row) ? (
                  <DropdownMenuItem onSelect={() => setRenewLicenseId(row.license_id ?? null)}>
                    <RotateCw className="me-2 h-4 w-4" />
                    {t('common.renew')}
                  </DropdownMenuItem>
                ) : null}
                {row.license_id && row.status === 'active' ? (
                  <DropdownMenuItem onSelect={() => setDeactivateTarget(row)}>
                    <ShieldOff className="me-2 h-4 w-4" />
                    {t('common.deactivate')}
                  </DropdownMenuItem>
                ) : null}
                {row.license_id && row.status === 'active' && !row.paused_at ? (
                  <DropdownMenuItem onSelect={() => setPauseTarget(row)}>
                    <Pause className="me-2 h-4 w-4" />
                    {t('common.pause')}
                  </DropdownMenuItem>
                ) : null}
                {row.license_id && canReactivateLicense(row) ? (
                  <DropdownMenuItem onSelect={() => setResumeTarget(row)}>
                    <Play className="me-2 h-4 w-4" />
                    {t('common.resume')}
                  </DropdownMenuItem>
                ) : null}
                {row.license_id && canRetryScheduledLicense(row) ? (
                  <DropdownMenuItem onSelect={() => void retryScheduledMutation.mutate(row.license_id!)}>
                    <RotateCw className="me-2 h-4 w-4" />
                    {t('common.retry')}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={() => setDeleteTarget(row)}>
                  <Trash2 className="me-2 h-4 w-4" />
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [lang, locale, navigate, retryScheduledMutation, t],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold">{t('managerParent.nav.customers')}</h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">Global customer directory with tenant, seller, program, status, username, and BIOS drill-downs.</p>
        </div>
        <Button type="button" onClick={() => navigate(routePaths.superAdmin.customerCreate(lang))}>
          <Plus className="me-2 h-4 w-4" />
          {t('managerParent.pages.customers.addCustomer', { defaultValue: 'Add Customer' })}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-sm text-slate-500">{t('managerParent.pages.customers.expireIn1Day', { defaultValue: 'Expire in 1 day' })}</p><p className="mt-2 text-2xl font-semibold">{expiringQuery.data?.data.day1 ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-slate-500">{t('managerParent.pages.customers.expireIn3Days', { defaultValue: 'Expire in 3 days' })}</p><p className="mt-2 text-2xl font-semibold">{expiringQuery.data?.data.day3 ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-slate-500">{t('managerParent.pages.customers.expireIn7Days', { defaultValue: 'Expire in 7 days' })}</p><p className="mt-2 text-2xl font-semibold">{expiringQuery.data?.data.day7 ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-slate-500">{t('managerParent.pages.customers.expired', { defaultValue: 'Expired' })}</p><p className="mt-2 text-2xl font-semibold">{expiringQuery.data?.data.expired ?? 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <Button key={option} type="button" size="sm" variant={status === option ? 'default' : 'secondary'} onClick={() => { setStatus(option); setPage(1) }}>
                {option === 'all' ? t('common.all') : t(`common.${option}`, { defaultValue: option.charAt(0).toUpperCase() + option.slice(1) })}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 xl:grid-cols-5">
            <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder={t('managerParent.pages.customers.searchPlaceholder')} />
            <select value={tenantId} onChange={(event) => { setTenantId(event.target.value ? Number(event.target.value) : ''); setPage(1) }} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">{t('common.allTenants')}</option>
              {tenantsQuery.data?.data.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
            </select>
            <select value={resellerId} onChange={(event) => { setResellerId(event.target.value ? Number(event.target.value) : ''); setPage(1) }} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">{t('common.allResellers', { defaultValue: 'All resellers' })}</option>
              {sellerOptions.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
            </select>
            <select value={programId} onChange={(event) => { setProgramId(event.target.value ? Number(event.target.value) : ''); setPage(1) }} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">{t('common.allPrograms', { defaultValue: 'All programs' })}</option>
              {programsQuery.data?.data.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={customersQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        isLoading={customersQuery.isLoading}
        onRowClick={(row) => navigate(routePaths.superAdmin.customerDetail(lang, row.id))}
        pagination={{
          page: customersQuery.data?.meta.current_page ?? 1,
          lastPage: customersQuery.data?.meta.last_page ?? 1,
          total: customersQuery.data?.meta.total ?? 0,
          perPage: customersQuery.data?.meta.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPerPage(nextPageSize)
          setPage(1)
        }}
      />

      <EditCustomerDialog
        open={editTarget !== null}
        onOpenChange={(open) => !open && setEditTarget(null)}
        initialClientName={editTarget?.name ?? ''}
        initialEmail={editTarget?.email ?? ''}
        initialPhone={editTarget?.phone ?? ''}
        onSubmit={(payload: { client_name: string; email?: string; phone?: string }) => editMutation.mutate(payload)}
        isPending={editMutation.isPending}
      />

      <RenewLicenseDialog
        open={renewLicenseId !== null}
        onOpenChange={(open) => !open && setRenewLicenseId(null)}
        title={t('common.renew')}
        description={t('common.renew', { defaultValue: 'Renew license' })}
        confirmLabel={t('common.renew')}
        confirmLoadingLabel={t('common.loading')}
        cancelLabel={t('common.cancel')}
        onSubmit={(payload) => renewMutation.mutate(payload)}
        isPending={renewMutation.isPending}
      />

      <ConfirmDialog open={deactivateTarget !== null} onOpenChange={(open) => !open && setDeactivateTarget(null)} title={t('common.deactivate')} description={deactivateTarget?.name ?? ''} confirmLabel={t('common.deactivate')} onConfirm={() => deactivateTarget?.license_id && deactivateMutation.mutate(deactivateTarget.license_id)} />
      <ConfirmDialog open={pauseTarget !== null} onOpenChange={(open) => !open && setPauseTarget(null)} title={t('common.pause')} description={pauseTarget?.name ?? ''} confirmLabel={t('common.pause')} onConfirm={() => pauseTarget?.license_id && pauseMutation.mutate(pauseTarget.license_id)} />
      <ConfirmDialog open={resumeTarget !== null} onOpenChange={(open) => !open && setResumeTarget(null)} title={t('common.resume')} description={resumeTarget?.name ?? ''} confirmLabel={t('common.resume')} onConfirm={() => resumeTarget?.license_id && resumeMutation.mutate(resumeTarget.license_id)} />
      <ConfirmDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)} title={t('common.delete')} description={deleteTarget?.name ?? ''} confirmLabel={t('common.delete')} isDestructive onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} />
    </div>
  )
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['super-admin', 'customers'] })
  void queryClient.invalidateQueries({ queryKey: ['super-admin', 'licenses', 'expiring'] })
}
