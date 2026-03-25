import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreVertical, Pause, Pencil, Play, Plus, RotateCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { EditCustomerDialog } from '@/components/customers/EditCustomerDialog'
import { StatusFilterCard } from '@/components/customers/StatusFilterCard'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { LicenseStatusBadges } from '@/components/shared/LicenseStatusBadges'
import { RoleIdentity } from '@/components/shared/RoleIdentity'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { liveQueryOptions, LIVE_QUERY_INTERVAL } from '@/lib/live-query'
import { canDeleteCustomerRow, canReactivateLicense, canRetryScheduledLicense, formatDate, formatLicenseDurationDays, getLicenseDisplayStatus, getStatusMeaning, isPausedPendingLicense, isPlainPendingLicense, resolveLicenseDurationDays, shouldRenewLicense } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { licenseService } from '@/services/license.service'
import { programService } from '@/services/program.service'
import { superAdminCustomerService } from '@/services/super-admin-customer.service'
import { tenantService } from '@/services/tenant.service'
import { userService } from '@/services/user.service'
import type { SuperAdminCustomerSummary } from '@/types/super-admin.types'
import type { UserRole } from '@/types/user.types'

const STATUS_OPTIONS = ['all', 'active', 'suspended', 'scheduled', 'expired', 'cancelled', 'pending'] as const

export function CustomersPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStatus = searchParams.get('status')
  const [page, setPage] = useState(Number(searchParams.get('page') || 1))
  const [perPage, setPerPage] = useState(Number(searchParams.get('per_page') || 25))
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>(
    STATUS_OPTIONS.includes((initialStatus ?? 'all') as (typeof STATUS_OPTIONS)[number]) ? (initialStatus as (typeof STATUS_OPTIONS)[number]) : 'all',
  )
  const [tenantId, setTenantId] = useState<number | ''>(searchParams.get('tenant_id') ? Number(searchParams.get('tenant_id')) : '')
  const [resellerId, setResellerId] = useState<number | ''>(searchParams.get('reseller_id') ? Number(searchParams.get('reseller_id')) : '')
  const [programId, setProgramId] = useState<number | ''>(searchParams.get('program_id') ? Number(searchParams.get('program_id')) : '')
  const [editTarget, setEditTarget] = useState<SuperAdminCustomerSummary | null>(null)
  const [pauseTarget, setPauseTarget] = useState<SuperAdminCustomerSummary | null>(null)
  const [resumeTarget, setResumeTarget] = useState<SuperAdminCustomerSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminCustomerSummary | null>(null)
  const [pauseReason, setPauseReason] = useState('')
  const customerFilterParams = useMemo(
    () => ({
      search: search || undefined,
      tenant_id: tenantId || undefined,
      reseller_id: resellerId || undefined,
      program_id: programId || undefined,
    }),
    [programId, resellerId, search, tenantId],
  )

  const customersQuery = useQuery({
    queryKey: ['super-admin', 'customers', page, perPage, search, status, tenantId, resellerId, programId],
    queryFn: () =>
      superAdminCustomerService.getAll({
        page,
        per_page: perPage,
        ...customerFilterParams,
        status: status === 'all' ? '' : status,
      }),
    ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_LIST),
  })

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'customers', 'tenants'],
    queryFn: () => tenantService.getAll({ per_page: 100 }),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  const sellersQuery = useQuery({
    queryKey: ['super-admin', 'customers', 'sellers', tenantId],
    queryFn: () => userService.getAll({ per_page: 100, tenant_id: tenantId || '', role: 'reseller', status: 'active' }),
    enabled: tenantId !== '',
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  })

  const programsQuery = useQuery({
    queryKey: ['super-admin', 'customers', 'programs'],
    queryFn: () => programService.getAll({ per_page: 100 }),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  const [allCountQuery, activeCountQuery, scheduledCountQuery, expiredCountQuery, cancelledCountQuery, pendingCountQuery] = useQueries({
    queries: [
      {
        queryKey: ['super-admin', 'customers', 'count', 'all', customerFilterParams],
        queryFn: () => superAdminCustomerService.getAll({ page: 1, per_page: 1, ...customerFilterParams }),
        ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS),
      },
      {
        queryKey: ['super-admin', 'customers', 'count', 'active', customerFilterParams],
        queryFn: () => superAdminCustomerService.getAll({ page: 1, per_page: 1, ...customerFilterParams, status: 'active' }),
        ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS),
      },
      {
        queryKey: ['super-admin', 'customers', 'count', 'scheduled', customerFilterParams],
        queryFn: () => superAdminCustomerService.getAll({ page: 1, per_page: 1, ...customerFilterParams, status: 'scheduled' }),
        ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS),
      },
      {
        queryKey: ['super-admin', 'customers', 'count', 'expired', customerFilterParams],
        queryFn: () => superAdminCustomerService.getAll({ page: 1, per_page: 1, ...customerFilterParams, status: 'expired' }),
        ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS),
      },
      {
        queryKey: ['super-admin', 'customers', 'count', 'cancelled', customerFilterParams],
        queryFn: () => superAdminCustomerService.getAll({ page: 1, per_page: 1, ...customerFilterParams, status: 'cancelled' }),
        ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS),
      },
      {
        queryKey: ['super-admin', 'customers', 'count', 'pending', customerFilterParams],
        queryFn: () => superAdminCustomerService.getAll({ page: 1, per_page: 1, ...customerFilterParams, status: 'pending' }),
        ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS),
      },
    ],
  })

  // Reset all filters when navigating to clean URL (e.g. sidebar click)
  useEffect(() => {
    if (searchParams.toString() === '') {
      setPage(1)
      setPerPage(25)
      setSearch('')
      setStatus('all')
      setTenantId('')
      setResellerId('')
      setProgramId('')
    }
  }, [searchParams])

  useEffect(() => {
    const next = new URLSearchParams()
    if (page > 1) next.set('page', String(page))
    if (perPage !== 25) next.set('per_page', String(perPage))
    if (search) next.set('search', search)
    if (status !== 'all') next.set('status', status)
    if (tenantId) next.set('tenant_id', String(tenantId))
    if (resellerId) next.set('reseller_id', String(resellerId))
    if (programId) next.set('program_id', String(programId))
    setSearchParams(next, { replace: true })
  }, [page, perPage, programId, resellerId, search, setSearchParams, status, tenantId])

  const editMutation = useMutation({
    mutationFn: (payload: { client_name: string; email?: string; phone?: string }) =>
      superAdminCustomerService.update(editTarget?.id ?? 0, payload),
    onSuccess: () => {
      toast.success(t('common.customerUpdatedSuccess', { defaultValue: 'Customer updated successfully.' }))
      setEditTarget(null)
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const pauseMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.pause(licenseId, { pause_reason: pauseReason.trim() || undefined }),
    onSuccess: () => {
      toast.success(t('common.paused'))
      setPauseTarget(null)
      setPauseReason('')
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

  const sellerOptions = sellersQuery.data?.data ?? []
  const sellerFilterPlaceholder = tenantId
    ? t('superAdmin.pages.customers.allResellers', { defaultValue: 'All resellers' })
    : t('superAdmin.pages.customers.allResellers', { defaultValue: 'All resellers' })

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
      { key: 'tenant', label: t('common.tenant'), sortable: true, defaultHidden: true, sortValue: (row) => row.tenant?.name ?? '', render: (row) => row.tenant?.name ?? '-' },
      { key: 'phone', label: t('common.phone'), sortable: true, defaultHidden: true, sortValue: (row) => row.phone ?? '', render: (row) => row.phone ?? '-' },
      {
        key: 'bios',
        label: t('superAdmin.pages.customers.biosId'),
        sortable: true,
        sortValue: (row) => row.bios_id ?? '',
        render: (row) => row.bios_id ? <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.superAdmin.biosDetail(lang, row.bios_id)}>{row.bios_id}</Link> : '-',
        },
        { key: 'reseller', label: t('common.reseller'), sortable: true, sortValue: (row) => row.reseller ?? '', render: (row) => (
          <RoleIdentity
            name={row.reseller}
            role={resolveUserRole(row.reseller_role)}
            href={row.reseller_id ? routePaths.superAdmin.userDetail(lang, row.reseller_id) : undefined}
          />
        ) },
        {
          key: 'duration',
          label: t('common.duration'),
          sortable: true,
          sortValue: (row) => resolveLicenseDurationDays(row.duration_days, row.start_at, row.expiry) ?? 0,
          render: (row) => formatLicenseDurationDays(row.duration_days, t, row.start_at, row.expiry),
        },
        { key: 'program', label: t('common.program'), sortable: true, defaultHidden: true, sortValue: (row) => row.program ?? '', render: (row) => row.program ?? '-' },
      { key: 'start', label: t('common.start', { defaultValue: 'Start' }), sortable: true, defaultHidden: true, sortValue: (row) => row.start_at ?? '', render: (row) => (row.start_at ? formatDate(row.start_at, locale) : '-') },
      {
        key: 'status',
        label: t('common.status'),
        sortable: true,
        sortValue: (row) => row.status ? getLicenseDisplayStatus(row) : '',
        render: (row) => row.status ? (
          <div className="relative inline-flex">
            <LicenseStatusBadges status={getLicenseDisplayStatus(row)} isBlocked={Boolean(row.is_blacklisted)} />
            {isPlainPendingLicense(row) ? (
              <span className="absolute -right-2 -top-2 inline-flex items-center rounded-full border border-fuchsia-200 bg-fuchsia-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-fuchsia-700 shadow-sm dark:border-fuchsia-900/60 dark:bg-fuchsia-950/50 dark:text-fuchsia-300">
                {t('common.new', { defaultValue: lang === 'ar' ? 'جديد' : 'New' })}
              </span>
            ) : null}
          </div>
        ) : '-',
      },
      { key: 'reason', label: t('common.reason'), sortable: true, defaultHidden: true, sortValue: (row) => row.pause_reason ?? '', render: (row) => isPausedPendingLicense(row) ? (row.pause_reason ?? '-') : '-' },
      { key: 'expiry', label: t('common.expiry'), sortable: true, defaultHidden: true, sortValue: (row) => row.expiry ?? '', render: (row) => (row.expiry ? formatDate(row.expiry, locale) : '-') },
      {
        key: 'actions',
        label: t('common.actions'),
        render: (row) => {
        const displayStatus = row.status ? getLicenseDisplayStatus(row) : null
        const isScheduleEditable = displayStatus === 'scheduled' || displayStatus === 'scheduled_failed'
        const isPausedPending = isPausedPendingLicense(row)
        const isPlainPending = isPlainPendingLicense(row)
        const canDeleteRow = canDeleteCustomerRow(row)
        const isBlacklisted = Boolean(row.is_blacklisted)
        const renewActionLabel = displayStatus === 'active'
            ? t('common.increaseDuration', { defaultValue: 'Increase Duration' })
            : isScheduleEditable
              ? t('common.editSchedule', { defaultValue: 'Edit Schedule' })
              : isPlainPending
                ? t('common.activate', { defaultValue: 'Activate' })
                : t('common.renew')

          return (
          <div onClick={(event) => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="ghost" aria-label={t('common.actions')}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => navigate(routePaths.superAdmin.customerDetail(lang, row.id))}>{t('common.view')}</DropdownMenuItem>
                <DropdownMenuItem disabled={isBlacklisted} onSelect={() => setEditTarget(row)}>
                  <Pencil className="me-2 h-4 w-4" />
                  {t('common.edit')}
                </DropdownMenuItem>
                {row.license_id && (displayStatus === 'active' || shouldRenewLicense(row)) && !isBlacklisted ? (
                  <DropdownMenuItem onSelect={() => navigate(routePaths.superAdmin.licenseRenew(lang, row.license_id ?? 0), { state: { returnTo: `${location.pathname}${location.search}` } })}>
                    <RotateCw className="me-2 h-4 w-4" />
                    {renewActionLabel}
                  </DropdownMenuItem>
                ) : null}
                {row.license_id && row.status === 'active' && !row.paused_at && !isBlacklisted ? (
                  <DropdownMenuItem onSelect={() => setPauseTarget(row)}>
                    <Pause className="me-2 h-4 w-4" />
                    {t('common.pause')}
                  </DropdownMenuItem>
                ) : null}
                {row.license_id && canReactivateLicense(row) ? (
                  <DropdownMenuItem onSelect={() => setResumeTarget(row)}>
                    <Play className="me-2 h-4 w-4" />
                    {isPausedPending ? t('common.continue', { defaultValue: 'Continue' }) : t('common.resume')}
                  </DropdownMenuItem>
                ) : null}
                {row.license_id && canRetryScheduledLicense(row) ? (
                  <DropdownMenuItem onSelect={() => void retryScheduledMutation.mutate(row.license_id!)}>
                    <RotateCw className="me-2 h-4 w-4" />
                    {t('common.retry')}
                  </DropdownMenuItem>
                ) : null}
                {canDeleteRow ? (
                  <DropdownMenuItem onSelect={() => setDeleteTarget(row)}>
                    <Trash2 className="me-2 h-4 w-4" />
                    {t('common.delete')}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          )
        },
      },
    ],
    [lang, locale, location.pathname, location.search, navigate, retryScheduledMutation, t],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold">{t('superAdmin.pages.customers.title')}</h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.customers.description')}</p>
        </div>
        <Button type="button" onClick={() => navigate(routePaths.superAdmin.customerCreate(lang))}>
          <Plus className="me-2 h-4 w-4" />
          {t('superAdmin.pages.customers.addCustomer', { defaultValue: 'Add Customer' })}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-6">
        <StatusFilterCard
          label={t('common.all')}
          count={allCountQuery.data?.meta.total ?? 0}
          isActive={status === 'all'}
          onClick={() => {
            setStatus('all')
            setPage(1)
          }}
          color="sky"
        />
        <StatusFilterCard
          label={t('common.active')}
          description={getStatusMeaning('active', t)}
          count={activeCountQuery.data?.meta.total ?? 0}
          isActive={status === 'active'}
          onClick={() => {
            setStatus('active')
            setPage(1)
          }}
          color="emerald"
        />
        <StatusFilterCard
          label={t('common.scheduled', { defaultValue: 'Scheduled' })}
          description={getStatusMeaning('scheduled', t)}
          count={scheduledCountQuery.data?.meta.total ?? 0}
          isActive={status === 'scheduled'}
          onClick={() => {
            setStatus('scheduled')
            setPage(1)
          }}
          color="amber"
        />
        <StatusFilterCard
          label={t('common.expired')}
          description={getStatusMeaning('expired', t)}
          count={expiredCountQuery.data?.meta.total ?? 0}
          isActive={status === 'expired'}
          onClick={() => {
            setStatus('expired')
            setPage(1)
          }}
          color="rose"
        />
        <StatusFilterCard
          label={t('common.cancelled')}
          description={getStatusMeaning('cancelled', t)}
          count={cancelledCountQuery.data?.meta.total ?? 0}
          isActive={status === 'cancelled'}
          onClick={() => {
            setStatus('cancelled')
            setPage(1)
          }}
          color="slate"
        />
        <StatusFilterCard
          label={t('common.pending')}
          description={getStatusMeaning('pending', t)}
          count={pendingCountQuery.data?.meta.total ?? 0}
          isActive={status === 'pending'}
          onClick={() => {
            setStatus('pending')
            setPage(1)
          }}
          color="amber"
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 xl:grid-cols-5">
            <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder={t('superAdmin.pages.customers.searchPlaceholder')} />
            <select value={tenantId} onChange={(event) => { setTenantId(event.target.value ? Number(event.target.value) : ''); setPage(1) }} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">{t('common.allTenants')}</option>
              {tenantsQuery.data?.data.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
            </select>
            <select value={resellerId} onChange={(event) => { setResellerId(event.target.value ? Number(event.target.value) : ''); setPage(1) }} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">{sellerFilterPlaceholder}</option>
              {sellerOptions.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
            </select>
            <select value={programId} onChange={(event) => { setProgramId(event.target.value ? Number(event.target.value) : ''); setPage(1) }} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">{t('superAdmin.pages.customers.allPrograms', { defaultValue: 'All programs' })}</option>
              {programsQuery.data?.data.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <DataTable
        tableKey="super_admin_customers"
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

      <ConfirmDialog
        open={pauseTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPauseTarget(null)
            setPauseReason('')
          }
        }}
        title={t('common.pause')}
        description={pauseTarget?.name ?? ''}
        confirmLabel={t('common.pause')}
        onConfirm={() => pauseTarget?.license_id && pauseMutation.mutate(pauseTarget.license_id)}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('common.reason')}</label>
          <textarea
            className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={pauseReason}
            onChange={(event) => setPauseReason(event.target.value)}
            placeholder={t('common.reason')}
            maxLength={500}
          />
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={resumeTarget !== null}
        onOpenChange={(open) => !open && setResumeTarget(null)}
        title={isPausedPendingLicense(resumeTarget) ? t('common.continue', { defaultValue: 'Continue' }) : t('common.resume')}
        description={resumeTarget?.name ?? ''}
        confirmLabel={isPausedPendingLicense(resumeTarget) ? t('common.continue', { defaultValue: 'Continue' }) : t('common.resume')}
        onConfirm={() => resumeTarget?.license_id && resumeMutation.mutate(resumeTarget.license_id)}
      />
      <ConfirmDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)} title={t('common.delete')} description={deleteTarget?.name ?? ''} confirmLabel={t('common.delete')} isDestructive onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} />
    </div>
  )
}

function resolveUserRole(role?: string | null): UserRole | null {
  if (role === 'super_admin' || role === 'manager_parent' || role === 'manager' || role === 'reseller' || role === 'customer') {
    return role
  }

  return null
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'customers'] }),
    queryClient.refetchQueries({ queryKey: ['super-admin', 'customers'], type: 'active' }),
  ])
}
