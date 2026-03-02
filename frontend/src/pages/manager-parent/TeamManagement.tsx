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
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [role, setRole] = useState<'manager' | 'reseller' | ''>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'active' | 'suspended' | 'inactive' | ''>('')
  const [formOpen, setFormOpen] = useState(false)
  const [inviteRole, setInviteRole] = useState<'manager' | 'reseller'>('manager')
  const [deleteTarget, setDeleteTarget] = useState<TeamMemberSummary | null>(null)
  const [editingMember, setEditingMember] = useState<TeamMemberSummary | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState<TeamFormState>(EMPTY_FORM)

  const membersQuery = useQuery({
    queryKey: ['manager-parent', 'team', role, page, perPage, search, status],
    queryFn: () => teamService.getAll({ role: role || '', page, per_page: perPage, search, status }),
  })

  const createMutation = useMutation({
    mutationFn: (payload: TeamPayload) => teamService.create(payload),
    onSuccess: () => {
      toast.success(t(inviteRole === 'manager' ? 'managerParent.pages.teamManagement.managerInvited' : 'managerParent.pages.teamManagement.resellerInvited'))
      closeForm()
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<TeamPayload, 'role' | 'password'>> }) => teamService.update(id, payload),
    onSuccess: () => {
      toast.success(t('managerParent.pages.teamManagement.updateSuccess'))
      closeForm()
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team'] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: number; nextStatus: 'active' | 'suspended' | 'inactive' }) => teamService.updateStatus(id, nextStatus),
    onSuccess: () => {
      toast.success(t('managerParent.pages.teamManagement.statusUpdated'))
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => teamService.delete(id),
    onSuccess: () => {
      toast.success(t('managerParent.pages.teamManagement.deleteSuccess'))
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team'] })
    },
  })

  const detailQuery = useQuery({
    queryKey: ['manager-parent', 'team', 'detail', selectedId],
    queryFn: () => teamService.getOne(selectedId ?? 0),
    enabled: selectedId !== null,
  })

  const columns = useMemo<Array<DataTableColumn<TeamMemberSummary>>>(
    () => [
      {
        key: 'name',
        label: t('common.name'),
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
        label: t('common.email'),
        sortable: true,
        sortValue: (row) => row.email,
        render: (row) => row.email,
      },
      {
        key: 'phone',
        label: t('common.phone'),
        sortable: true,
        sortValue: (row) => row.phone ?? '',
        render: (row) => row.phone || '-',
      },
      {
        key: 'status',
        label: t('common.status'),
        sortable: true,
        sortValue: (row) => row.status,
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'customers',
        label: t('managerParent.pages.teamManagement.customers'),
        sortable: true,
        sortValue: (row) => row.customers_count,
        render: (row) => row.customers_count,
      },
      {
        key: 'activeLicenses',
        label: t('managerParent.pages.teamManagement.activeLicenses'),
        sortable: true,
        sortValue: (row) => row.active_licenses_count,
        render: (row) => row.active_licenses_count,
      },
      {
        key: 'revenue',
        label: t('common.revenue'),
        sortable: true,
        sortValue: (row) => row.revenue,
        render: (row) => formatCurrency(row.revenue, 'USD', locale),
      },
      {
        key: 'actions',
        label: t('common.actions'),
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingMember(row)
                setInviteRole(row.role === 'reseller' ? 'reseller' : 'manager')
                setForm({
                  name: row.name,
                  email: row.email,
                  password: '',
                  phone: row.phone ?? '',
                })
                setFormOpen(true)
              }}
            >
              {t('common.edit')}
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
              {row.status === 'active' ? t('common.suspend') : t('common.activate')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDeleteTarget(row)}>
              {t('common.delete')}
            </Button>
          </div>
        ),
      },
    ],
    [locale, statusMutation, t],
  )

  const list = membersQuery.data?.data ?? []
  const totalRevenue = list.reduce((sum, member) => sum + member.revenue, 0)
  const totalCustomers = list.reduce((sum, member) => sum + member.customers_count, 0)

  function closeForm() {
    setFormOpen(false)
    setEditingMember(null)
    setInviteRole('manager')
    setForm(EMPTY_FORM)
  }

  function submitForm() {
    if (form.name.trim().length < 2) {
      toast.error(t('managerParent.pages.teamManagement.nameValidation'))
      return
    }

    if (!isValidEmail(form.email)) {
      toast.error(t('managerParent.pages.teamManagement.emailValidation'))
      return
    }

    if (!editingMember && form.password.trim().length < 8) {
      toast.error(t('managerParent.pages.teamManagement.passwordValidation'))
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
      role: inviteRole,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('managerParent.pages.teamManagement.title')}
        description={t('managerParent.pages.teamManagement.description')}
        actions={
          <Button
            type="button"
            onClick={() => {
              setEditingMember(null)
              setInviteRole(role === 'reseller' ? 'reseller' : 'manager')
              setForm(EMPTY_FORM)
              setFormOpen(true)
            }}
          >
            {t('managerParent.pages.dashboard.actions.inviteTeamMember')}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.teamManagement.visibleTeamMembers')}</p>
            <p className="mt-2 text-3xl font-semibold">{membersQuery.data?.meta.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.teamManagement.customersRepresented')}</p>
            <p className="mt-2 text-3xl font-semibold">{totalCustomers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.teamManagement.visibleRevenue')}</p>
            <p className="mt-2 text-3xl font-semibold">{formatCurrency(totalRevenue, 'USD', locale)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={role || 'all'}
        onValueChange={(value) => {
          setRole(value === 'all' ? '' : (value as 'manager' | 'reseller'))
          setPage(1)
        }}
      >
        <TabsList>
          <TabsTrigger value="all">{t('common.all')}</TabsTrigger>
          <TabsTrigger value="manager">{t('managerParent.pages.teamManagement.managers')}</TabsTrigger>
          <TabsTrigger value="reseller">{t('managerParent.pages.teamManagement.resellers')}</TabsTrigger>
        </TabsList>
        <TabsContent value={role || 'all'} className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder={t('managerParent.pages.teamManagement.searchPlaceholder')}
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
                <option value="">{t('common.allStatuses')}</option>
                <option value="active">{t('common.active')}</option>
                <option value="suspended">{t('common.suspended')}</option>
                <option value="inactive">{t('common.inactive')}</option>
              </select>
            </CardContent>
          </Card>

          <DataTable
            columns={columns}
            data={list}
            rowKey={(row) => row.id}
            onRowClick={(row) => setSelectedId(row.id)}
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
            <DialogTitle>
              {editingMember
                ? t('managerParent.pages.teamManagement.editTitle')
                : t('managerParent.pages.dashboard.actions.inviteTeamMember')}
            </DialogTitle>
            <DialogDescription>{editingMember ? t('managerParent.pages.teamManagement.editDescription') : t('managerParent.pages.teamManagement.formDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            {!editingMember ? (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="team-role">{t('common.role')}</Label>
                <select
                  id="team-role"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as 'manager' | 'reseller')}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="manager">{t('roles.manager')}</option>
                  <option value="reseller">{t('roles.reseller')}</option>
                </select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="team-name">{t('common.name')}</Label>
              <Input id="team-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-email">{t('common.email')}</Label>
              <Input id="team-email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-phone">{t('common.phone')}</Label>
              <Input id="team-phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            </div>
            {!editingMember ? (
              <div className="space-y-2">
                <Label htmlFor="team-password">{t('common.password')}</Label>
                <Input id="team-password" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeForm}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={submitForm} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? t('common.saving') : editingMember ? t('managerParent.pages.teamManagement.saveChanges') : t('managerParent.pages.teamManagement.createAccount')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="left-auto right-0 top-0 h-screen w-[min(100vw,44rem)] max-w-[44rem] translate-x-0 translate-y-0 overflow-y-auto rounded-none rounded-s-3xl">
          <DialogHeader>
            <DialogTitle>{detailQuery.data?.data.name ?? t('managerParent.pages.teamManagement.title')}</DialogTitle>
            <DialogDescription>{detailQuery.data?.data.email ?? t('managerParent.pages.teamManagement.description')}</DialogDescription>
          </DialogHeader>

          {detailQuery.data?.data ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <MetricCard label={t('managerParent.pages.teamManagement.customers')} value={detailQuery.data.data.customers_count} />
                <MetricCard label={t('managerParent.pages.teamManagement.activeLicenses')} value={detailQuery.data.data.active_licenses_count} />
                <MetricCard label={t('common.revenue')} value={formatCurrency(detailQuery.data.data.revenue, 'USD', locale)} />
                <MetricCard label={t('common.status')} value={<StatusBadge status={detailQuery.data.data.status} />} />
              </div>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <h3 className="text-lg font-semibold">{t('manager.pages.team.recentLicenses')}</h3>
                  {detailQuery.data.data.recent_licenses.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.noData')}</p>
                  ) : (
                    detailQuery.data.data.recent_licenses.map((license) => (
                      <div key={license.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                        <p className="font-medium text-slate-950 dark:text-white">{license.customer?.name ?? '-'}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{license.program ?? '-'}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('activate.biosId')} {license.bios_id}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <h3 className="text-lg font-semibold">{t('managerParent.nav.activity')}</h3>
                  {detailQuery.data.data.recent_activity.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.activity.noMatches')}</p>
                  ) : (
                    detailQuery.data.data.recent_activity.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                        <p className="font-medium text-slate-950 dark:text-white">{entry.action}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{entry.description ?? '-'}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('managerParent.pages.teamManagement.deleteTitle')}
        description={deleteTarget ? t('managerParent.pages.teamManagement.deleteDescription', { name: deleteTarget.name }) : undefined}
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

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <div className="mt-2 font-semibold text-slate-950 dark:text-white">{value}</div>
      </CardContent>
    </Card>
  )
}
