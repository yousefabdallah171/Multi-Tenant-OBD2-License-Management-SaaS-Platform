import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreVertical, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
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
import { biosService } from '@/services/bios.service'
import { tenantService } from '@/services/tenant.service'
import type { ManagedUser } from '@/types/super-admin.types'

export function UsernameManagementPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [tenantId, setTenantId] = useState<number | ''>('')
  const [role, setRole] = useState('')
  const [locked, setLocked] = useState<boolean | ''>('')
  const [search, setSearch] = useState('')
  const [unlockTarget, setUnlockTarget] = useState<ManagedUser | null>(null)
  const [unlockReason, setUnlockReason] = useState('')
  const [renameTarget, setRenameTarget] = useState<ManagedUser | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [renameReason, setRenameReason] = useState('')

  const usersQuery = useQuery({
    queryKey: ['super-admin', 'username-management', page, tenantId, role, locked, search],
    queryFn: () => biosService.getUsernameManagement({ page, per_page: 10, tenant_id: tenantId, role, locked, search }),
  })

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'username-management-tenant-options'],
    queryFn: () => tenantService.getAll({ per_page: 100 }),
  })

  const unlockMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => biosService.unlockUsername(id, reason),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.usernameManagement.unlockSuccess'))
      setUnlockTarget(null)
      setUnlockReason('')
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'username-management'] })
    },
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, username, reason }: { id: number; username: string; reason?: string }) => biosService.changeUsername(id, username, reason),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.usernameManagement.renameSuccess'))
      setRenameTarget(null)
      setNewUsername('')
      setRenameReason('')
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'username-management'] })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (id: number) => biosService.resetUserPassword(id),
    onSuccess: (data) => {
      toast.success(`${t('superAdmin.pages.usernameManagement.resetPasswordSuccess')}: ${data.temporary_password}`)
    },
  })

  const columns = useMemo<Array<DataTableColumn<ManagedUser>>>(
    () => [
      {
        key: 'user',
        label: t('common.user'),
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <div>
            <div className="font-medium text-slate-950 dark:text-white">{row.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{row.email}</div>
          </div>
        ),
      },
      { key: 'username', label: t('common.username'), sortable: true, sortValue: (row) => row.username ?? '', render: (row) => row.username ?? '-' },
      { key: 'role', label: t('common.role'), sortable: true, sortValue: (row) => row.role, render: (row) => <RoleBadge role={row.role} /> },
      { key: 'tenant', label: t('common.tenant'), sortable: true, sortValue: (row) => row.tenant?.name ?? '', render: (row) => row.tenant?.name ?? '-' },
      { key: 'locked', label: t('superAdmin.pages.usernameManagement.locked'), sortable: true, sortValue: (row) => String(row.username_locked), render: (row) => <StatusBadge status={row.username_locked ? 'suspended' : 'active'} /> },
      {
        key: 'actions',
        label: t('common.actions'),
        render: (row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="ghost">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setUnlockTarget(row)} disabled={!row.username_locked}>
                {t('superAdmin.pages.usernameManagement.unlock')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setRenameTarget(row)
                  setNewUsername(row.username ?? '')
                }}
              >
                {t('superAdmin.pages.usernameManagement.changeUsername')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => resetPasswordMutation.mutate(row.id)}>
                {t('common.resetPassword')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [resetPasswordMutation, t],
  )

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('superAdmin.pages.usernameManagement.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.usernameManagement.description')}</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="ps-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('common.search')} />
          </div>
          <select value={tenantId} onChange={(event) => setTenantId(event.target.value ? Number(event.target.value) : '')} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="">{t('common.allTenants')}</option>
            {tenantsQuery.data?.data.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <select value={role} onChange={(event) => setRole(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="">{t('common.allRoles')}</option>
            <option value="super_admin">{t('roles.super_admin')}</option>
            <option value="manager_parent">{t('roles.manager_parent')}</option>
            <option value="manager">{t('roles.manager')}</option>
            <option value="reseller">{t('roles.reseller')}</option>
            <option value="customer">{t('roles.customer')}</option>
          </select>
          <select value={locked === '' ? '' : String(locked)} onChange={(event) => setLocked(event.target.value === '' ? '' : event.target.value === 'true')} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="">{t('common.all')}</option>
            <option value="true">{t('superAdmin.pages.usernameManagement.locked')}</option>
            <option value="false">{t('superAdmin.pages.usernameManagement.unlocked')}</option>
          </select>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={usersQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        pagination={{
          page: usersQuery.data?.meta.current_page ?? 1,
          lastPage: usersQuery.data?.meta.last_page ?? 1,
          total: usersQuery.data?.meta.total ?? 0,
        }}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={unlockTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUnlockTarget(null)
            setUnlockReason('')
          }
        }}
        title={t('superAdmin.pages.usernameManagement.unlockTitle')}
        description={unlockTarget?.email}
        confirmLabel={t('superAdmin.pages.usernameManagement.unlock')}
        onConfirm={() => {
          if (unlockTarget) {
            unlockMutation.mutate({ id: unlockTarget.id, reason: unlockReason })
          }
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="unlock-reason">{t('common.reason')}</Label>
          <Input id="unlock-reason" value={unlockReason} onChange={(event) => setUnlockReason(event.target.value)} />
        </div>
      </ConfirmDialog>

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('superAdmin.pages.usernameManagement.renameTitle')}</DialogTitle>
            <DialogDescription>{t('superAdmin.pages.usernameManagement.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">{t('common.username')}</Label>
              <Input id="new-username" value={newUsername} onChange={(event) => setNewUsername(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rename-reason">{t('common.reason')}</Label>
              <Input id="rename-reason" value={renameReason} onChange={(event) => setRenameReason(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRenameTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (renameTarget) {
                  renameMutation.mutate({ id: renameTarget.id, username: newUsername, reason: renameReason })
                }
              }}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
