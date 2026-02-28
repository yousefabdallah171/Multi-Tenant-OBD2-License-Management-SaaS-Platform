import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
      toast.success('Username unlocked successfully.')
      setUnlockTarget(null)
      setUnlockReason('')
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'username-management'] })
    },
  })

  const usernameMutation = useMutation({
    mutationFn: () => managerParentService.changeUsername(usernameTarget?.id ?? 0, newUsername, changeReason),
    onSuccess: () => {
      toast.success('Username changed successfully.')
      setUsernameTarget(null)
      setNewUsername('')
      setChangeReason('')
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'username-management'] })
    },
  })

  const resetMutation = useMutation({
    mutationFn: (id: number) => managerParentService.resetPassword(id),
    onSuccess: (data) => {
      toast.success(`Temporary password: ${data.temporary_password}`)
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'username-management'] })
    },
  })

  const columns = useMemo<Array<DataTableColumn<UsernameManagedUser>>>(
    () => [
      {
        key: 'user',
        label: 'User',
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <div className="space-y-1">
            <p className="font-medium text-slate-950 dark:text-white">{row.name}</p>
            <RoleBadge role={row.role as UserRole} />
          </div>
        ),
      },
      { key: 'username', label: 'Username', sortable: true, sortValue: (row) => row.username ?? '', render: (row) => row.username ?? '-' },
      { key: 'email', label: 'Email', sortable: true, sortValue: (row) => row.email, render: (row) => row.email },
      { key: 'status', label: 'Role Status', sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status as 'active' | 'suspended' | 'inactive'} /> },
      { key: 'locked', label: 'Locked', sortable: true, sortValue: (row) => (row.username_locked ? 1 : 0), render: (row) => <StatusBadge status={row.username_locked ? 'suspended' : 'active'} /> },
      {
        key: 'actions',
        label: 'Actions',
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
              Unlock
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
              Change Username
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => resetMutation.mutate(row.id)}>
              Reset Password
            </Button>
          </div>
        ),
      },
    ],
    [resetMutation],
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Username Management" description="Manage tenant usernames, unlock locked identities, and reset passwords with full tenant scope." />

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_200px_200px]">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search by username or email"
          />
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">All roles</option>
            <option value="manager_parent">Manager Parent</option>
            <option value="manager">Manager</option>
            <option value="reseller">Reseller</option>
            <option value="customer">Customer</option>
          </select>
          <select
            value={locked}
            onChange={(event) => {
              setLocked(event.target.value as 'all' | 'locked' | 'unlocked')
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">All lock states</option>
            <option value="locked">Locked</option>
            <option value="unlocked">Unlocked</option>
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
        title="Unlock username?"
        description={unlockTarget ? `Unlock ${unlockTarget.email} and clear the username lock.` : undefined}
        confirmLabel="Unlock"
        onConfirm={() => unlockMutation.mutate()}
      >
        <div className="space-y-2">
          <Label htmlFor="unlock-reason">Reason</Label>
          <Input id="unlock-reason" value={unlockReason} onChange={(event) => setUnlockReason(event.target.value)} />
        </div>
      </ConfirmDialog>

      <Dialog open={usernameTarget !== null} onOpenChange={(open) => !open && setUsernameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Username</DialogTitle>
            <DialogDescription>{usernameTarget ? `Assign a new username for ${usernameTarget.email}.` : 'Assign a new username.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">New Username</Label>
              <Input id="new-username" value={newUsername} onChange={(event) => setNewUsername(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-reason">Reason</Label>
              <Input id="change-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setUsernameTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!newUsername.trim()) {
                  toast.error('Username is required.')
                  return
                }

                usernameMutation.mutate()
              }}
              disabled={usernameMutation.isPending}
            >
              {usernameMutation.isPending ? 'Saving...' : 'Save Username'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
