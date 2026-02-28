import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { managerParentService } from '@/services/manager-parent.service'
import type { UsernameManagedUser } from '@/types/manager-parent.types'
import type { UserRole } from '@/types/user.types'

export function UsernameManagementPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [role, setRole] = useState('')
  const [locked, setLocked] = useState<'all' | 'locked' | 'unlocked'>('all')
  const [search, setSearch] = useState('')
  const [unlockTarget, setUnlockTarget] = useState<UsernameManagedUser | null>(null)
  const [unlockReason, setUnlockReason] = useState('')
  const [usernameTarget, setUsernameTarget] = useState<UsernameManagedUser | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [changeReason, setChangeReason] = useState('')

  const usersQuery = useQuery({
    queryKey: ['manager-parent', 'username-management', page, perPage, role, locked, search],
    queryFn: () =>
      managerParentService.getUsernameManagement({
        page,
        per_page: perPage,
        role,
        search,
        locked: locked === 'all' ? '' : locked === 'locked',
      }),
  })

  const unlockMutation = useMutation({
    mutationFn: () => managerParentService.unlockUsername(unlockTarget?.id ?? 0, unlockReason),
    onSuccess: () => {
      toast.success(t('managerParent.pages.usernameManagement.unlockSuccess'))
      setUnlockTarget(null)
      setUnlockReason('')
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'username-management'] })
    },
  })

  const usernameMutation = useMutation({
    mutationFn: () => managerParentService.changeUsername(usernameTarget?.id ?? 0, newUsername, changeReason),
    onSuccess: () => {
      toast.success(t('managerParent.pages.usernameManagement.renameSuccess'))
      setUsernameTarget(null)
      setNewUsername('')
      setChangeReason('')
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'username-management'] })
    },
  })

  const resetMutation = useMutation({
    mutationFn: (id: number) => managerParentService.resetPassword(id),
    onSuccess: (data) => {
      toast.success(`${t('managerParent.pages.usernameManagement.resetPasswordSuccess')}: ${data.temporary_password}`)
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'username-management'] })
    },
  })

  const columns = useMemo<Array<DataTableColumn<UsernameManagedUser>>>(
    () => [
      {
        key: 'user',
        label: t('common.user'),
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <div className="space-y-1">
            <p className="font-medium text-slate-950 dark:text-white">{row.name}</p>
            <RoleBadge role={row.role as UserRole} />
          </div>
        ),
      },
      { key: 'username', label: t('common.username'), sortable: true, sortValue: (row) => row.username ?? '', render: (row) => row.username ?? '-' },
      { key: 'email', label: t('common.email'), sortable: true, sortValue: (row) => row.email, render: (row) => row.email },
      { key: 'status', label: t('managerParent.pages.usernameManagement.roleStatus'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status as 'active' | 'suspended' | 'inactive'} /> },
      { key: 'locked', label: t('managerParent.pages.usernameManagement.locked'), sortable: true, sortValue: (row) => (row.username_locked ? 1 : 0), render: (row) => <StatusBadge status={row.username_locked ? 'suspended' : 'active'} /> },
      {
        key: 'actions',
        label: t('common.actions'),
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!row.username_locked}
              onClick={() => {
                setUnlockTarget(row)
                setUnlockReason('')
              }}
            >
              {t('managerParent.pages.usernameManagement.unlock')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setUsernameTarget(row)
                setNewUsername(row.username ?? '')
                setChangeReason('')
              }}
            >
              {t('managerParent.pages.usernameManagement.changeUsername')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => resetMutation.mutate(row.id)}>
              {t('common.resetPassword')}
            </Button>
          </div>
        ),
      },
    ],
    [resetMutation, t],
  )

  return (
    <div className="space-y-6">
      <PageHeader title={t('managerParent.pages.usernameManagement.title')} description={t('managerParent.pages.usernameManagement.description')} />

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_200px_200px]">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t('managerParent.pages.usernameManagement.searchPlaceholder')}
          />
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('common.allRoles')}</option>
            <option value="manager_parent">{t('roles.manager_parent')}</option>
            <option value="manager">{t('roles.manager')}</option>
            <option value="reseller">{t('roles.reseller')}</option>
            <option value="customer">{t('roles.customer')}</option>
          </select>
          <select
            value={locked}
            onChange={(event) => {
              setLocked(event.target.value as 'all' | 'locked' | 'unlocked')
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">{t('managerParent.pages.usernameManagement.allLockStates')}</option>
            <option value="locked">{t('managerParent.pages.usernameManagement.locked')}</option>
            <option value="unlocked">{t('managerParent.pages.usernameManagement.unlocked')}</option>
          </select>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={usersQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        isLoading={usersQuery.isLoading}
        pagination={{
          page: usersQuery.data?.meta.current_page ?? 1,
          lastPage: usersQuery.data?.meta.last_page ?? 1,
          total: usersQuery.data?.meta.total ?? 0,
          perPage: usersQuery.data?.meta.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPerPage(size)
          setPage(1)
        }}
      />

      <ConfirmDialog
        open={unlockTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUnlockTarget(null)
            setUnlockReason('')
          }
        }}
        title={t('managerParent.pages.usernameManagement.unlockTitle')}
        description={unlockTarget ? t('managerParent.pages.usernameManagement.unlockDescription', { email: unlockTarget.email }) : undefined}
        confirmLabel={t('managerParent.pages.usernameManagement.unlock')}
        onConfirm={() => {
          if (!unlockReason.trim()) {
            toast.error(t('managerParent.pages.usernameManagement.unlockReasonRequired'))
            return
          }

          unlockMutation.mutate()
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="unlock-reason">{t('common.reason')}</Label>
          <Input id="unlock-reason" value={unlockReason} onChange={(event) => setUnlockReason(event.target.value)} />
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
            <DialogTitle>{t('managerParent.pages.usernameManagement.renameTitle')}</DialogTitle>
            <DialogDescription>{usernameTarget ? t('managerParent.pages.usernameManagement.renameDescription', { email: usernameTarget.email }) : t('managerParent.pages.usernameManagement.renameDescriptionFallback')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">{t('managerParent.pages.usernameManagement.newUsername')}</Label>
              <Input id="new-username" value={newUsername} onChange={(event) => setNewUsername(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-reason">{t('common.reason')}</Label>
              <Input id="change-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} />
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
                  toast.error(t('managerParent.pages.usernameManagement.usernameRequired'))
                  return
                }

                usernameMutation.mutate()
              }}
              disabled={usernameMutation.isPending}
            >
              {usernameMutation.isPending ? t('common.saving') : t('managerParent.pages.usernameManagement.saveUsername')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
