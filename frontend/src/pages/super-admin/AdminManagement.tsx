import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, MoreHorizontal, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
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
import { Textarea } from '@/components/ui/textarea'
import { biosService } from '@/services/bios.service'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate, isValidPhoneNumber, normalizePhoneInput } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { adminService } from '@/services/admin.service'
import { tenantService } from '@/services/tenant.service'
import type { ManagedUser } from '@/types/super-admin.types'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'manager_parent' as 'super_admin' | 'manager_parent' | 'manager' | 'reseller',
  tenant_id: '' as number | '',
  phone: '',
  status: 'active' as 'active' | 'suspended' | 'inactive',
}

export function AdminManagementPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const { user } = useAuth()
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [role, setRole] = useState('')
  const [tenantId, setTenantId] = useState<number | ''>('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [form, setForm] = useState(emptyForm)
  const [unlockTarget, setUnlockTarget] = useState<ManagedUser | null>(null)
  const [unlockReason, setUnlockReason] = useState('')
  const [usernameTarget, setUsernameTarget] = useState<ManagedUser | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [changeReason, setChangeReason] = useState('')
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const normalizedPhone = normalizePhoneInput(form.phone.trim())

      if (editing) {
        return adminService.update(editing.id, {
          name: form.name,
          email: form.email,
          role: form.role,
          tenant_id: form.role === 'super_admin' ? null : Number(form.tenant_id),
          phone: normalizedPhone || null,
          status: form.status,
        })
      }

      return adminService.create({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        tenant_id: form.role === 'super_admin' ? null : Number(form.tenant_id),
        phone: normalizedPhone || null,
        status: form.status,
      })
    },
    onSuccess: () => {
      toast.success(t('superAdmin.pages.adminManagement.saveSuccess'))
      setFormOpen(false)
      setEditing(null)
      setForm(emptyForm)
      setShowCreatePassword(false)
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'admin-management'] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: number; nextStatus: 'active' | 'suspended' }) => adminService.update(id, { status: nextStatus }),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.adminManagement.statusUpdated'))
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'admin-management'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminService.delete(id),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.adminManagement.deleteSuccess'))
      setDeleteTarget(null)
      setSelectedIds((current) => current.filter((id) => id !== deleteTarget?.id))
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'admin-management'] })
    },
  })

  const bulkSuspendMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedIds.map((id) => adminService.update(id, { status: 'suspended' })))
    },
    onSuccess: () => {
      toast.success(t('superAdmin.pages.adminManagement.bulkSuspendSuccess'))
      setSelectedIds([])
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'admin-management'] })
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
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'admin-management'] })
    },
  })

  const unlockMutation = useMutation({
    mutationFn: () => biosService.unlockUsername(unlockTarget?.id ?? 0, unlockReason),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.usernameManagement.unlockSuccess'))
      setUnlockTarget(null)
      setUnlockReason('')
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'admin-management'] })
    },
  })

  const usernameMutation = useMutation({
    mutationFn: () => biosService.changeUsername(usernameTarget?.id ?? 0, newUsername, changeReason),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.usernameManagement.renameSuccess'))
      setUsernameTarget(null)
      setNewUsername('')
      setChangeReason('')
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'admin-management'] })
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
    },
  })

  const visibleAdminIds = adminsQuery.data?.data.map((admin) => admin.id) ?? []
  const allVisibleSelected = visibleAdminIds.length > 0 && visibleAdminIds.every((id) => selectedIds.includes(id))
  const activeSuperAdminCount = (adminsQuery.data?.data ?? []).filter((admin) => admin.role === 'super_admin' && admin.status === 'active').length
  const currentUserId = user?.id ?? null

  const isProtectedSuperAdmin = (row: ManagedUser) =>
    row.role === 'super_admin' && (row.id === currentUserId || (row.status === 'active' && activeSuperAdminCount <= 1))

  function validateForm() {
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
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={selectedIds.includes(row.id)}
              onChange={(event) => {
                setSelectedIds((current) =>
                  event.target.checked ? Array.from(new Set([...current, row.id])) : current.filter((id) => id !== row.id),
                )
              }}
              aria-label={t('common.selectRow', { name: row.name })}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <button
              type="button"
              className="text-start font-medium text-sky-600 hover:underline dark:text-sky-300"
              onClick={(event) => {
                event.stopPropagation()
                navigate(routePaths.superAdmin.userDetail(lang, row.id))
              }}
            >
              {row.name}
            </button>
          </label>
        ),
      },
      { key: 'email', label: t('common.email'), sortable: true, sortValue: (row) => row.email, render: (row) => row.email },
      {
        key: 'username',
        label: t('common.username'),
        sortable: true,
        sortValue: (row) => row.username ?? '',
        render: (row) => (
          <div className="space-y-1">
            {row.username ? (
              <button
                type="button"
                className="text-start font-medium text-sky-600 hover:underline dark:text-sky-300"
                onClick={(event) => {
                  event.stopPropagation()
                  navigate(routePaths.superAdmin.userDetail(lang, row.id))
                }}
              >
                {row.username}
              </button>
            ) : (
              <p className="font-medium text-slate-950 dark:text-white">-</p>
            )}
            <StatusBadge status={row.username_locked ? 'suspended' : 'active'} />
          </div>
        ),
      },
      { key: 'role', label: t('common.role'), sortable: true, sortValue: (row) => row.role, render: (row) => <RoleBadge role={row.role} /> },
      { key: 'status', label: t('common.status'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
      { key: 'created', label: t('common.createdAt'), sortable: true, sortValue: (row) => row.created_at ?? '', render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-') },
      {
        key: 'actions',
        label: t('common.actions'),
        className: 'w-20',
        render: (row) => (
          <div onClick={(event) => event.stopPropagation()}>
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
                    role: row.role === 'customer' ? 'reseller' : row.role,
                    tenant_id: row.tenant?.id ?? '',
                    phone: row.phone ?? '',
                    status: row.status,
                  })
                  setFormOpen(true)
                  setShowCreatePassword(false)
                }}
              >
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(routePaths.superAdmin.userDetail(lang, row.id))}>
                {t('common.view')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={isProtectedSuperAdmin(row)} onSelect={() => statusMutation.mutate({ id: row.id, nextStatus: row.status === 'active' ? 'suspended' : 'active' })}>
                {row.status === 'active' ? t('common.suspend') : t('common.activate')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!row.username_locked}
                onSelect={() => {
                  setUnlockTarget(row)
                  setUnlockReason('')
                }}
              >
                {t('superAdmin.pages.usernameManagement.unlock')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setUsernameTarget(row)
                  setNewUsername(row.username ?? '')
                  setChangeReason('')
                }}
              >
                {t('superAdmin.pages.usernameManagement.changeUsername')}
              </DropdownMenuItem>
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
              <DropdownMenuItem className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400" disabled={isProtectedSuperAdmin(row)} onSelect={() => setDeleteTarget(row)}>
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [activeSuperAdminCount, currentUserId, lang, locale, navigate, selectedIds, statusMutation, t],
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
              setStatus(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('common.allStatuses')}</option>
            <option value="active">{t('common.active')}</option>
            <option value="suspended">{t('common.suspended')}</option>
            <option value="inactive">{t('common.inactive')}</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setSelectedIds((current) =>
                  allVisibleSelected ? current.filter((id) => !visibleAdminIds.includes(id)) : Array.from(new Set([...current, ...visibleAdminIds])),
                )
              }
              disabled={visibleAdminIds.length === 0}
            >
              {allVisibleSelected ? t('common.clearVisible') : t('common.selectAllVisible')}
            </Button>
            {selectedIds.length > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setSelectedIds([])}>
                {t('common.clearSelection')}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">{t('common.selectedCount', { count: selectedIds.length })}</span>
            <Button type="button" variant="secondary" onClick={() => bulkSuspendMutation.mutate()} disabled={selectedIds.length === 0 || bulkSuspendMutation.isPending || (adminsQuery.data?.data ?? []).some((row) => selectedIds.includes(row.id) && isProtectedSuperAdmin(row))}>
              {t('superAdmin.pages.adminManagement.bulkSuspend')}
            </Button>
            <Button type="button" onClick={() => setBulkDeleteOpen(true)} disabled={selectedIds.length === 0 || bulkDeleteMutation.isPending || (adminsQuery.data?.data ?? []).some((row) => selectedIds.includes(row.id) && isProtectedSuperAdmin(row))}>
              {t('superAdmin.pages.adminManagement.bulkDelete')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={adminsQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(routePaths.superAdmin.userDetail(lang, row.id))}
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

      <ConfirmDialog
        open={unlockTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUnlockTarget(null)
            setUnlockReason('')
          }
        }}
        title={t('superAdmin.pages.usernameManagement.unlockTitle')}
        description={unlockTarget?.email ?? ''}
        confirmLabel={t('superAdmin.pages.usernameManagement.unlock')}
        onConfirm={() => {
          if (!unlockReason.trim()) {
            toast.error(t('common.reason'))
            return
          }

          unlockMutation.mutate()
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="unlock-reason">{t('common.reason')}</Label>
          <Textarea id="unlock-reason" value={unlockReason} onChange={(event) => setUnlockReason(event.target.value)} />
        </div>
      </ConfirmDialog>

      <Dialog
        open={usernameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUsernameTarget(null)
            setNewUsername('')
            setChangeReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('superAdmin.pages.usernameManagement.renameTitle')}</DialogTitle>
            <DialogDescription>{usernameTarget?.email ?? t('superAdmin.pages.usernameManagement.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-new-username">{t('common.username')}</Label>
              <Input id="admin-new-username" value={newUsername} onChange={(event) => setNewUsername(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-change-reason">{t('common.reason')}</Label>
              <Textarea id="admin-change-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setUsernameTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!newUsername.trim()) {
                  toast.error(t('common.username'))
                  return
                }

                usernameMutation.mutate()
              }}
              disabled={usernameMutation.isPending}
            >
              {usernameMutation.isPending ? t('common.saving') : t('common.save')}
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
