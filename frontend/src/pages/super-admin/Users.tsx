import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, MoreVertical, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { StatusFilterCard } from '@/components/customers/StatusFilterCard'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { tenantService } from '@/services/tenant.service'
import { userService } from '@/services/user.service'
import type { ManagedUser } from '@/types/super-admin.types'

const statusTabs = [
  { value: '', labelKey: 'common.all', fallback: 'All' },
  { value: 'active', labelKey: 'common.active', fallback: 'Active' },
  { value: 'suspended', labelKey: 'common.suspended', fallback: 'Suspended' },
  { value: 'inactive', labelKey: 'common.inactive', fallback: 'Inactive' },
] as const

export function UsersPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const restoreState = (location.state as {
    restore?: {
      page?: number
      perPage?: number
      role?: string
      tenantId?: number | ''
      status?: string
      search?: string
    }
  } | null)?.restore
  const [page, setPage] = useState(() => restoreState?.page ?? 1)
  const [perPage, setPerPage] = useState(() => restoreState?.perPage ?? 25)
  const [role, setRole] = useState(() => restoreState?.role ?? '')
  const [tenantId, setTenantId] = useState<number | ''>(() => restoreState?.tenantId ?? '')
  const [status, setStatus] = useState(() => restoreState?.status ?? '')
  const [search, setSearch] = useState(() => restoreState?.search ?? '')
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null)
  const returnTo = `${location.pathname}${location.search}`
  const detailState = {
    returnTo,
    restore: {
      page,
      perPage,
      role,
      tenantId,
      status,
      search,
    },
  }

  const usersQuery = useQuery({
    queryKey: ['super-admin', 'users', page, perPage, role, tenantId, status, search],
    queryFn: () => userService.getAll({ page, per_page: perPage, role, tenant_id: tenantId, status, search }),
  })

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'tenant-options'],
    queryFn: () => tenantService.getAll({ per_page: 100 }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: number; nextStatus: 'active' | 'suspended' | 'inactive' }) => userService.updateStatus(id, nextStatus),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.users.statusUpdated'))
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'users'] })
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'users', 'detail'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => userService.delete(id),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.users.deleteSuccess'))
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'users'] })
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'users', 'detail'] })
    },
  })

  const resolveDetailPath = (row: ManagedUser) => (row.role === 'customer' ? routePaths.superAdmin.customerDetail(lang, row.id) : routePaths.superAdmin.userDetail(lang, row.id))
  const columns = useMemo<Array<DataTableColumn<ManagedUser>>>(
    () => [
      {
        key: 'name',
        label: t('common.name'),
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <div>
            <div className="font-medium text-slate-950 dark:text-white">{row.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{row.email}</div>
          </div>
        ),
      },
      { key: 'role', label: t('common.role'), sortable: true, sortValue: (row) => row.role, render: (row) => <RoleBadge role={row.role} /> },
      { key: 'tenant', label: t('common.tenant'), sortable: true, sortValue: (row) => row.tenant?.name ?? '', render: (row) => row.tenant?.name ?? '-' },
      { key: 'status', label: t('common.accountStatus'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
      { key: 'created', label: t('common.createdAt'), sortable: true, sortValue: (row) => row.created_at ?? '', render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-') },
      {
        key: 'actions',
        label: t('common.actions'),
        render: (row) => (
          <div onClick={(event) => event.stopPropagation()}>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="ghost">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate(resolveDetailPath(row), { state: detailState })}>
                <Eye className="me-2 h-4 w-4" />
                {t('common.view')}
              </DropdownMenuItem>
              {row.role !== 'super_admin' ? (
                <DropdownMenuItem onClick={() => statusMutation.mutate({ id: row.id, nextStatus: row.status === 'active' ? 'suspended' : 'active' })}>
                  {row.status === 'active' ? t('common.suspend') : t('common.activate')}
                </DropdownMenuItem>
              ) : null}
              {row.role !== 'super_admin' ? (
                <DropdownMenuItem onClick={() => setDeleteTarget(row)}>
                  {t('common.delete')}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [detailState, lang, locale, navigate, resolveDetailPath, statusMutation, t],
  )

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('superAdmin.pages.users.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.users.description')}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatusFilterCard label={t('common.all')} count={Object.values(usersQuery.data?.role_counts ?? {}).reduce((sum, count) => sum + count, 0)} isActive={role === ''} onClick={() => { setRole(''); setPage(1) }} color="sky" />
        <StatusFilterCard label={t('roles.super_admin')} count={usersQuery.data?.role_counts.super_admin ?? 0} isActive={role === 'super_admin'} onClick={() => { setRole('super_admin'); setPage(1) }} color="rose" />
        <StatusFilterCard label={t('roles.manager_parent')} count={usersQuery.data?.role_counts.manager_parent ?? 0} isActive={role === 'manager_parent'} onClick={() => { setRole('manager_parent'); setPage(1) }} color="sky" />
        <StatusFilterCard label={t('roles.manager')} count={usersQuery.data?.role_counts.manager ?? 0} isActive={role === 'manager'} onClick={() => { setRole('manager'); setPage(1) }} color="sky" />
        <StatusFilterCard label={t('roles.reseller')} count={usersQuery.data?.role_counts.reseller ?? 0} isActive={role === 'reseller'} onClick={() => { setRole('reseller'); setPage(1) }} color="emerald" />
        <StatusFilterCard label={t('roles.customer')} count={usersQuery.data?.role_counts.customer ?? 0} isActive={role === 'customer'} onClick={() => { setRole('customer'); setPage(1) }} color="amber" />
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
                placeholder={t('common.search')}
              />
            </div>
            <select
              value={tenantId}
              onChange={(event) => {
                setTenantId(event.target.value ? Number(event.target.value) : '')
                setPage(1)
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
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('superAdmin.pages.users.accountStatusHint')}</p>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('common.accountStatus')}>
            {statusTabs.map((tab) => (
              <Button
                key={tab.value || 'all'}
                type="button"
                size="sm"
                variant={status === tab.value ? 'default' : 'secondary'}
                onClick={() => {
                  setStatus(tab.value)
                  setPage(1)
                }}
              >
                {t(tab.labelKey, { defaultValue: tab.fallback })}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {usersQuery.isLoading ? (
        <DataTable columns={columns} data={[]} rowKey={(row) => row.id} isLoading />
      ) : (
        <DataTable
          columns={columns}
          data={usersQuery.data?.data ?? []}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(resolveDetailPath(row), { state: detailState })}
          pagination={{
            page: usersQuery.data?.meta.current_page ?? 1,
            lastPage: usersQuery.data?.meta.last_page ?? 1,
            total: usersQuery.data?.meta.total ?? 0,
            perPage: usersQuery.data?.meta.per_page ?? perPage,
          }}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPerPage(nextPageSize)
            setPage(1)
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('superAdmin.pages.users.deleteTitle')}
        description={deleteTarget ? `${deleteTarget.name} - ${deleteTarget.email}` : ''}
        confirmLabel={t('common.delete')}
        isDestructive
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id)
          }
        }}
      />
    </div>
  )
}
