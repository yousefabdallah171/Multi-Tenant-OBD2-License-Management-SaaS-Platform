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
import { Textarea } from '@/components/ui/textarea'
import { managerService } from '@/services/manager.service'
import type { TeamManagedUser } from '@/types/manager-reseller.types'
import type { UserRole } from '@/types/user.types'

export function UsernameManagementPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [role, setRole] = useState<'reseller' | 'customer' | ''>('')
  const [locked, setLocked] = useState<'all' | 'locked' | 'unlocked'>('all')
  const [search, setSearch] = useState('')
  const [unlockTarget, setUnlockTarget] = useState<TeamManagedUser | null>(null)
  const [unlockReason, setUnlockReason] = useState('')
  const [usernameTarget, setUsernameTarget] = useState<TeamManagedUser | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [changeReason, setChangeReason] = useState('')

  const usersQuery = useQuery({
    queryKey: ['manager', 'username-management', page, perPage, role, locked, search],
    queryFn: () =>
      managerService.getUsernameManagement({
        page,
        per_page: perPage,
        role,
        search,
        locked: locked === 'all' ? '' : locked === 'locked',
      }),
  })

  const unlockMutation = useMutation({
    mutationFn: () => managerService.unlockUsername(unlockTarget?.id ?? 0, unlockReason),
    onSuccess: () => {
      toast.success(t('manager.pages.usernameManagement.unlockSuccess'))
      setUnlockTarget(null)
      setUnlockReason('')
      void queryClient.invalidateQueries({ queryKey: ['manager', 'username-management'] })
    },
  })

  const usernameMutation = useMutation({
    mutationFn: () => managerService.changeUsername(usernameTarget?.id ?? 0, newUsername, changeReason),
    onSuccess: () => {
      toast.success(t('manager.pages.usernameManagement.renameSuccess'))
      setUsernameTarget(null)
      setNewUsername('')
      setChangeReason('')
      void queryClient.invalidateQueries({ queryKey: ['manager', 'username-management'] })
    },
  })

  const resetMutation = useMutation({
    mutationFn: (id: number) => managerService.resetPassword(id),
    onSuccess: (data) => {
      toast.success(`${t('manager.pages.usernameManagement.resetPasswordSuccess')}: ${data.temporary_password}`)
      void queryClient.invalidateQueries({ queryKey: ['manager', 'username-management'] })
    },
  })

  const columns = useMemo<Array<DataTableColumn<TeamManagedUser>>>(
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
      { key: 'status', label: t('manager.pages.usernameManagement.roleStatus'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
      { key: 'locked', label: t('manager.pages.usernameManagement.locked'), sortable: true, sortValue: (row) => (row.username_locked ? 1 : 0), render: (row) => <StatusBadge status={row.username_locked ? 'suspended' : 'active'} /> },
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
              onClick={(event) => {
                event.stopPropagation()
                setUnlockTarget(row)
                setUnlockReason('')
              }}
            >
              {t('manager.pages.usernameManagement.unlock')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                setUsernameTarget(row)
                setNewUsername(row.username ?? '')
                setChangeReason('')
              }}
            >
              {t('manager.pages.usernameManagement.changeUsername')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                resetMutation.mutate(row.id)
              }}
            >
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
      <PageHeader
        eyebrow={t('manager.layout.eyebrow')}
        title={t('manager.pages.usernameManagement.title')}
        description={t('manager.pages.usernameManagement.description')}
      />

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_200px_200px]">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t('manager.pages.usernameManagement.searchPlaceholder')}
          />
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value as 'reseller' | 'customer' | '')
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('common.allRoles')}</option>
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
            <option value="all">{t('manager.pages.usernameManagement.allLockStates')}</option>
            <option value="locked">{t('manager.pages.usernameManagement.locked')}</option>
            <option value="unlocked">{t('manager.pages.usernameManagement.unlocked')}</option>
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
        title={t('manager.pages.usernameManagement.unlockTitle')}
        description={unlockTarget ? t('manager.pages.usernameManagement.unlockDescription', { email: unlockTarget.email }) : undefined}
        confirmLabel={t('manager.pages.usernameManagement.unlock')}
        onConfirm={() => {
          if (!unlockReason.trim()) {
            toast.error(t('manager.pages.usernameManagement.unlockReasonRequired'))
            return
          }

          unlockMutation.mutate()
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="unlock-reason">{t('common.reason')}</Label>
          <Textarea id="unlock-reason" value={unlockReason} onChange={(event) => setUnlockReason(event.target.value)} placeholder={t('manager.pages.usernameManagement.unlockReasonPlaceholder')} />
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
            <DialogTitle>{t('manager.pages.usernameManagement.renameTitle')}</DialogTitle>
            <DialogDescription>{usernameTarget ? t('manager.pages.usernameManagement.renameDescription', { email: usernameTarget.email }) : t('manager.pages.usernameManagement.renameDescriptionFallback')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">{t('manager.pages.usernameManagement.newUsername')}</Label>
              <Input id="new-username" value={newUsername} onChange={(event) => setNewUsername(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-reason">{t('common.reason')}</Label>
              <Textarea id="change-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder={t('manager.pages.usernameManagement.changeReasonPlaceholder')} />
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
                  toast.error(t('manager.pages.usernameManagement.usernameRequired'))
                  return
                }

                usernameMutation.mutate()
              }}
              disabled={usernameMutation.isPending}
            >
              {usernameMutation.isPending ? t('common.saving') : t('manager.pages.usernameManagement.saveUsername')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
