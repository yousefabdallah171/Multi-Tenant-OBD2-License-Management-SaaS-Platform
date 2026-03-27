import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, MoreHorizontal, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/hooks/useLanguage'
import { normalizeAccountStatus, toStoredAccountStatus, type AccountStatusFilter } from '@/lib/account-status'
import { formatDate, isValidPhoneNumber, normalizePhoneInput } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { adminService } from '@/services/admin.service'
import { biosService } from '@/services/bios.service'
import { tenantService } from '@/services/tenant.service'
import type { ManagedUser } from '@/types/super-admin.types'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  username: '',
  role: 'manager_parent' as 'super_admin' | 'manager_parent' | 'manager' | 'reseller',
  tenant_id: '' as number | '',
  phone: '',
  status: 'active' as 'active' | 'inactive',
}

export function AdminManagementPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const queryClient = useQueryClient()
  const returnTo = `${location.pathname}${location.search}`
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
  const [perPage, setPerPage] = useState(() => restoreState?.perPage ?? 10)
  const [role, setRole] = useState(() => restoreState?.role ?? '')
  const [tenantId, setTenantId] = useState<number | ''>(() => restoreState?.tenantId ?? '')
  const [status, setStatus] = useState<AccountStatusFilter>(() => (restoreState?.status as AccountStatusFilter | undefined) ?? '')
  const [search, setSearch] = useState(() => restoreState?.search ?? '')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [form, setForm] = useState(emptyForm)
  const [passwordTarget, setPasswordTarget] = useState<ManagedUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [revokeTokensOnReset, setRevokeTokensOnReset] = useState(true)

  const adminsQuery = useQuery({
    queryKey: ['super-admin', 'admin-management', page, perPage, role, tenantId, status, search],
    queryFn: () => adminService.getAll({ page, per_page: perPage, role, tenant_id: tenantId, status, search }),
  })

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'admin-tenant-options'],
    queryFn: () => tenantService.getAll({ per_page: 100 }),
  })

  function invalidateUserQueries(userId?: number) {
    void queryClient.invalidateQueries({ queryKey: ['super-admin', 'admin-management'] })
    void queryClient.invalidateQueries({ queryKey: ['super-admin', 'users'] })
    if (userId) {
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'users', 'detail', userId] })
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const normalizedPhone = normalizePhoneInput(form.phone.trim())

      if (editing) {
        await adminService.update(editing.id, {
          name: form.name,
          email: form.email,
          role: form.role,
          tenant_id: form.role === 'super_admin' ? null : Number(form.tenant_id),
          phone: normalizedPhone || null,
          status: form.status,
        })

        const desiredUsername = form.username.trim()
        const currentUsername = editing.username?.trim() ?? ''

        if (desiredUsername && desiredUsername !== currentUsername) {
          try {
            await biosService.changeUsername(editing.id, desiredUsername)
            return { usernameUpdated: true, usernameErrorMessage: null as string | null }
          } catch (error) {
            return {
              usernameUpdated: false,
              usernameErrorMessage: getApiErrorMessage(error, t('superAdmin.pages.usernameManagement.usernameRequired')),
            }
          }
        }

        return { usernameUpdated: true, usernameErrorMessage: null as string | null }
      }

      await adminService.create({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        tenant_id: form.role === 'super_admin' ? null : Number(form.tenant_id),
        phone: normalizedPhone || null,
        status: form.status,
      })

      return { usernameUpdated: true, usernameErrorMessage: null as string | null }
    },
    onSuccess: ({ usernameUpdated, usernameErrorMessage }) => {
      setFormOpen(false)
      setEditing(null)
      setForm(emptyForm)
      setShowCreatePassword(false)
      invalidateUserQueries(editing?.id)

      if (usernameUpdated) {
        toast.success(t('superAdmin.pages.adminManagement.saveSuccess'))
        return
      }

      toast.error(usernameErrorMessage ?? t('common.partialUsernameUpdate', { defaultValue: 'Account details were saved, but the username could not be updated.' }))
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: number; nextStatus: 'active' | 'inactive' }) => adminService.update(id, { status: nextStatus }),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.adminManagement.statusUpdated'))
      invalidateUserQueries()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminService.delete(id),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.adminManagement.deleteSuccess'))
      setDeleteTarget(null)
      setSelectedIds((current) => current.filter((id) => id !== deleteTarget?.id))
      invalidateUserQueries(deleteTarget?.id)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'This account cannot be deleted.'))
      setDeleteTarget(null)
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedIds.map((id) => adminService.delete(id)))
    },
    onSuccess: () => {
      toast.success(t('superAdmin.pages.adminManagement.bulkDeleteSuccess'))
      setSelectedIds([])
      setBulkDeleteOpen(false)
      invalidateUserQueries()
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: () => adminService.resetPassword(passwordTarget?.id ?? 0, newPassword, revokeTokensOnReset),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.adminManagement.resetSuccess'))
      setPasswordTarget(null)
      setNewPassword('')
      setShowResetPassword(false)
      setRevokeTokensOnReset(true)
      invalidateUserQueries(passwordTarget?.id)
    },
  })

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

  function validateForm() {
    if (editing && !form.username.trim()) {
      toast.error(t('superAdmin.pages.usernameManagement.usernameRequired'))
      return false
    }

    if (form.phone.trim() && !isValidPhoneNumber(form.phone)) {
      toast.error(t('validation.invalidPhone', { defaultValue: 'Invalid phone number' }))
      return false
    }

    return true
  }

  const columns = useMemo<Array<DataTableColumn<ManagedUser>>>(
    () => [
      {
        key: 'name',
        label: t('common.name'),
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <button
            type="button"
            className="text-start font-medium text-sky-600 hover:underline dark:text-sky-300"
            onClick={(event) => {
              event.stopPropagation()
              navigate(routePaths.superAdmin.userDetail(lang, row.id), { state: detailState })
            }}
          >
            {row.name}
          </button>
        ),
      },
      { key: 'email', label: t('common.email'), sortable: true, sortValue: (row) => row.email, render: (row) => row.email },
      {
        key: 'username',
        label: t('common.username'),
        sortable: true,
        sortValue: (row) => row.username ?? '',
        render: (row) => (
          row.username ? (
            <button
              type="button"
              className="text-start font-medium text-sky-600 hover:underline dark:text-sky-300"
              onClick={(event) => {
                event.stopPropagation()
                navigate(routePaths.superAdmin.userDetail(lang, row.id), { state: detailState })
              }}
            >
              {row.username}
            </button>
          ) : (
            <p className="font-medium text-slate-950 dark:text-white">-</p>
          )
        ),
      },
      { key: 'role', label: t('common.role'), sortable: true, sortValue: (row) => row.role, render: (row) => <RoleBadge role={row.role} /> },
      {
        key: 'status',
        label: t('common.accountStatus'),
        sortable: true,
        sortValue: (row) => normalizeAccountStatus(row.status),
        render: (row) => <StatusBadge status={normalizeAccountStatus(row.status)} />,
      },
      { key: 'created', label: t('common.createdAt'), sortable: true, sortValue: (row) => row.created_at ?? '', render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-') },
      {
        key: 'actions',
        label: t('common.actions'),
        className: 'w-20',
        render: (row) => (
          <div
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="ghost" aria-label={t('common.actions')}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setEditing(row)
                  setForm({
                    name: row.name,
                    email: row.email,
                    password: '',
                    username: row.username ?? '',
                    role: row.role === 'customer' ? 'reseller' : row.role,
                    tenant_id: row.tenant?.id ?? '',
                    phone: row.phone ?? '',
                    status: toStoredAccountStatus(normalizeAccountStatus(row.status)),
                  })
                  setFormOpen(true)
                  setShowCreatePassword(false)
                }}
              >
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(routePaths.superAdmin.userDetail(lang, row.id), { state: detailState })}>
                {t('common.view')}
              </DropdownMenuItem>
              {row.role !== 'super_admin' ? (
                <DropdownMenuItem onSelect={() => statusMutation.mutate({ id: row.id, nextStatus: normalizeAccountStatus(row.status) === 'active' ? 'inactive' : 'active' })}>
                  {normalizeAccountStatus(row.status) === 'active' ? t('common.deactive') : t('common.activate')}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onSelect={() => {
                  setPasswordTarget(row)
                  setNewPassword('')
                  setShowResetPassword(false)
                  setRevokeTokensOnReset(true)
                }}
              >
                {t('common.resetPassword')}
              </DropdownMenuItem>
              {row.role !== 'super_admin' ? (
                <DropdownMenuItem className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400" onSelect={() => setDeleteTarget(row)}>
                  {t('common.delete')}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [detailState, lang, locale, navigate, selectedIds, statusMutation, t],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold">{t('superAdmin.pages.adminManagement.title')}</h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.adminManagement.description')}</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditing(null)
            setForm(emptyForm)
            setFormOpen(true)
            setShowCreatePassword(false)
          }}
        >
          <Plus className="me-2 h-4 w-4" />
          {t('superAdmin.pages.adminManagement.add')}
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
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
            value={role}
            onChange={(event) => {
              setRole(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('common.allRoles')}</option>
            <option value="super_admin">{t('roles.super_admin')}</option>
            <option value="manager_parent">{t('roles.manager_parent')}</option>
            <option value="manager">{t('roles.manager')}</option>
            <option value="reseller">{t('roles.reseller')}</option>
          </select>
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
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as AccountStatusFilter)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('common.allStatuses')}</option>
            <option value="active">{t('common.active')}</option>
            <option value="deactive">{t('common.deactive')}</option>
          </select>
        </CardContent>
      </Card>


      <DataTable
        tableKey="super_admin_admin_management"
        columns={columns}
        data={adminsQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(routePaths.superAdmin.userDetail(lang, row.id), { state: detailState })}
        isLoading={adminsQuery.isLoading}
        pagination={{
          page: adminsQuery.data?.meta.current_page ?? 1,
          lastPage: adminsQuery.data?.meta.last_page ?? 1,
          total: adminsQuery.data?.meta.total ?? 0,
          perPage: adminsQuery.data?.meta.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPerPage(nextPageSize)
          setPage(1)
        }}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('superAdmin.pages.adminManagement.editTitle') : t('superAdmin.pages.adminManagement.addTitle')}</DialogTitle>
            <DialogDescription>{t('superAdmin.pages.adminManagement.formDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admin-name">{t('common.name')}</Label>
              <Input id="admin-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">{t('common.email')}</Label>
              <Input id="admin-email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            {editing ? (
              <div className="space-y-2">
                <Label htmlFor="admin-username">{t('common.username')}</Label>
                <Input id="admin-username" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
              </div>
            ) : null}
            {!editing ? (
              <div className="space-y-2">
                <Label htmlFor="admin-password">{t('common.password')}</Label>
                <div className="relative">
                  <Input id="admin-password" type={showCreatePassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="pe-12" />
                  <Button type="button" variant="ghost" size="sm" className="absolute end-1 top-1/2 h-9 -translate-y-1/2 px-2" onClick={() => setShowCreatePassword((current) => !current)}>
                    {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="sr-only">{showCreatePassword ? t('common.hide') : t('common.show')}</span>
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="admin-phone">{t('common.phone')}</Label>
              <Input
                id="admin-phone"
                type="tel"
                inputMode="tel"
                placeholder="+966..."
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: normalizePhoneInput(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-role">{t('common.role')}</Label>
              <select
                id="admin-role"
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as typeof current.role }))}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="super_admin">{t('roles.super_admin')}</option>
                <option value="manager_parent">{t('roles.manager_parent')}</option>
                <option value="manager">{t('roles.manager')}</option>
                <option value="reseller">{t('roles.reseller')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-tenant">{t('common.tenant')}</Label>
              <select
                id="admin-tenant"
                value={form.tenant_id}
                onChange={(event) => setForm((current) => ({ ...current, tenant_id: event.target.value ? Number(event.target.value) : '' }))}
                disabled={form.role === 'super_admin'}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">{t('common.selectTenant')}</option>
                {tenantsQuery.data?.data.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-status">{t('common.accountStatus')}</Label>
              <select
                id="admin-status"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as typeof current.status }))}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="active">{t('common.active')}</option>
                <option value="inactive">{t('common.deactive')}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!validateForm()) {
                  return
                }

                saveMutation.mutate()
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordTarget(null)
            setNewPassword('')
            setShowResetPassword(false)
            setRevokeTokensOnReset(true)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.resetPassword')}</DialogTitle>
            <DialogDescription>{passwordTarget?.email ?? t('superAdmin.pages.adminManagement.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="admin-reset-password">{t('superAdmin.pages.profile.newPassword')}</Label>
            <div className="relative">
              <Input id="admin-reset-password" type={showResetPassword ? 'text' : 'password'} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="pe-12" />
              <Button type="button" variant="ghost" size="sm" className="absolute end-1 top-1/2 h-9 -translate-y-1/2 px-2" onClick={() => setShowResetPassword((current) => !current)}>
                {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showResetPassword ? t('common.hide') : t('common.show')}</span>
              </Button>
            </div>
          </div>
          <label htmlFor="super-admin-reset-revoke-tokens" className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
            <input
              id="super-admin-reset-revoke-tokens"
              type="checkbox"
              checked={revokeTokensOnReset}
              onChange={(event) => setRevokeTokensOnReset(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="space-y-1">
              <span className="block font-medium text-slate-950 dark:text-white">{t('common.revokeSessionsOnPasswordReset')}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{t('common.revokeSessionsOnPasswordResetHelp')}</span>
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPasswordTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (newPassword.trim().length < 8) {
                  toast.error(t('superAdmin.pages.adminManagement.passwordValidation'))
                  return
                }

                resetPasswordMutation.mutate()
              }}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? t('common.saving') : t('common.resetPassword')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('superAdmin.pages.adminManagement.deleteTitle')}
        description={deleteTarget ? `${deleteTarget.name} - ${deleteTarget.email}` : ''}
        confirmLabel={t('common.delete')}
        isDestructive
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id)
          }
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={t('superAdmin.pages.adminManagement.bulkDelete')}
        description={t('common.selectedCount', { count: selectedIds.length })}
        confirmLabel={t('common.delete')}
        isDestructive
        onConfirm={() => bulkDeleteMutation.mutate()}
      />
    </div>
  )
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message && error.message !== 'Request failed with status code 422') {
    return error.message
  }

  const response = (error as AxiosError<{ message?: string; errors?: Record<string, string[]> }>).response

  return response?.data?.message
    ?? Object.values(response?.data?.errors ?? {})[0]?.[0]
    ?? fallback
}
