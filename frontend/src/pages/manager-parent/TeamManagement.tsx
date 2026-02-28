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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/utils'
import { teamService, type TeamPayload } from '@/services/team.service'
import type { TeamMemberSummary } from '@/types/manager-parent.types'
import type { UserRole } from '@/types/user.types'

interface TeamFormState {
  name: string
  email: string
  password: string
  phone: string
}

const EMPTY_FORM: TeamFormState = {
  name: '',
  email: '',
  password: '',
  phone: '',
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function TeamManagementPage() {
  const queryClient = useQueryClient()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [role, setRole] = useState<'manager' | 'reseller'>('manager')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'active' | 'suspended' | 'inactive' | ''>('')
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TeamMemberSummary | null>(null)
  const [editingMember, setEditingMember] = useState<TeamMemberSummary | null>(null)
  const [form, setForm] = useState<TeamFormState>(EMPTY_FORM)

  const membersQuery = useQuery({
    queryKey: ['manager-parent', 'team', role, page, perPage, search, status],
    queryFn: () => teamService.getAll({ role, page, per_page: perPage, search, status }),
  })

  const createMutation = useMutation({
    mutationFn: (payload: TeamPayload) => teamService.create(payload),
    onSuccess: () => {
      toast.success(`${role === 'manager' ? 'Manager' : 'Reseller'} invited successfully.`)
      closeForm()
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<TeamPayload, 'role' | 'password'>> }) => teamService.update(id, payload),
    onSuccess: () => {
      toast.success('Team member updated successfully.')
      closeForm()
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team'] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: number; nextStatus: 'active' | 'suspended' | 'inactive' }) => teamService.updateStatus(id, nextStatus),
    onSuccess: () => {
      toast.success('Status updated successfully.')
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => teamService.delete(id),
    onSuccess: () => {
      toast.success('Team member removed successfully.')
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team'] })
    },
  })

  const columns = useMemo<Array<DataTableColumn<TeamMemberSummary>>>(
    () => [
      {
        key: 'name',
        label: 'Name',
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <div className="space-y-1">
            <p className="font-medium text-slate-950 dark:text-white">{row.name}</p>
            <RoleBadge role={row.role as UserRole} />
          </div>
        ),
      },
      {
        key: 'email',
        label: 'Email',
        sortable: true,
        sortValue: (row) => row.email,
        render: (row) => row.email,
      },
      {
        key: 'phone',
        label: 'Phone',
        sortable: true,
        sortValue: (row) => row.phone ?? '',
        render: (row) => row.phone || '-',
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        sortValue: (row) => row.status,
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'customers',
        label: 'Customers',
        sortable: true,
        sortValue: (row) => row.customers_count,
        render: (row) => row.customers_count,
      },
      {
        key: 'activeLicenses',
        label: 'Active Licenses',
        sortable: true,
        sortValue: (row) => row.active_licenses_count,
        render: (row) => row.active_licenses_count,
      },
      {
        key: 'revenue',
        label: 'Revenue',
        sortable: true,
        sortValue: (row) => row.revenue,
        render: (row) => formatCurrency(row.revenue, 'USD', locale),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingMember(row)
                setForm({
                  name: row.name,
                  email: row.email,
                  password: '',
                  phone: row.phone ?? '',
                })
                setFormOpen(true)
              }}
            >
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                statusMutation.mutate({
                  id: row.id,
                  nextStatus: row.status === 'active' ? 'suspended' : 'active',
                })
              }
            >
              {row.status === 'active' ? 'Suspend' : 'Activate'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDeleteTarget(row)}>
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [locale, statusMutation],
  )

  const list = membersQuery.data?.data ?? []
  const totalRevenue = list.reduce((sum, member) => sum + member.revenue, 0)
  const totalCustomers = list.reduce((sum, member) => sum + member.customers_count, 0)

  function closeForm() {
    setFormOpen(false)
    setEditingMember(null)
    setForm(EMPTY_FORM)
  }

  function submitForm() {
    if (form.name.trim().length < 2) {
      toast.error('Name must be at least 2 characters.')
      return
    }

    if (!isValidEmail(form.email)) {
      toast.error('Please enter a valid email address.')
      return
    }

    if (!editingMember && form.password.trim().length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }

    if (editingMember) {
      updateMutation.mutate({
        id: editingMember.id,
        payload: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
        },
      })
      return
    }

    createMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      phone: form.phone.trim() || null,
      role,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Management"
        description="Invite and manage managers and resellers under this tenant. Revenue and customer counts are shown per member."
        actions={
          <Button
            type="button"
            onClick={() => {
              setEditingMember(null)
              setForm(EMPTY_FORM)
              setFormOpen(true)
            }}
          >
            {role === 'manager' ? 'Invite Manager' : 'Invite Reseller'}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">Visible team members</p>
            <p className="mt-2 text-3xl font-semibold">{membersQuery.data?.meta.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">Customers represented</p>
            <p className="mt-2 text-3xl font-semibold">{totalCustomers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">Visible revenue</p>
            <p className="mt-2 text-3xl font-semibold">{formatCurrency(totalRevenue, 'USD', locale)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={role}
        onValueChange={(value) => {
          setRole(value as 'manager' | 'reseller')
          setPage(1)
        }}
      >
        <TabsList>
          <TabsTrigger value="manager">Managers</TabsTrigger>
          <TabsTrigger value="reseller">Resellers</TabsTrigger>
        </TabsList>
        <TabsContent value={role} className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search by name or email"
                className="min-w-[220px] flex-1"
              />
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as 'active' | 'suspended' | 'inactive' | '')
                  setPage(1)
                }}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
            </CardContent>
          </Card>

          <DataTable
            columns={columns}
            data={list}
            rowKey={(row) => row.id}
            isLoading={membersQuery.isLoading}
            pagination={{
              page: membersQuery.data?.meta.current_page ?? 1,
              lastPage: membersQuery.data?.meta.last_page ?? 1,
              total: membersQuery.data?.meta.total ?? 0,
              perPage: membersQuery.data?.meta.per_page ?? perPage,
            }}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPerPage(size)
              setPage(1)
            }}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Edit Team Member' : role === 'manager' ? 'Invite Manager' : 'Invite Reseller'}</DialogTitle>
            <DialogDescription>{editingMember ? 'Update the selected team member details.' : 'Create a new account under this tenant.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="team-name">Name</Label>
              <Input id="team-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-email">Email</Label>
              <Input id="team-email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-phone">Phone</Label>
              <Input id="team-phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            </div>
            {!editingMember ? (
              <div className="space-y-2">
                <Label htmlFor="team-password">Password</Label>
                <Input id="team-password" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="button" onClick={submitForm} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingMember ? 'Save Changes' : 'Create Account'}
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
        title="Delete team member?"
        description={deleteTarget ? `This will remove ${deleteTarget.name} from the team.` : undefined}
        confirmLabel="Delete"
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
