import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'
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
  const navigate = useNavigate()
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
  const [form, setForm] = useState<TeamFormState>(EMPTY_FORM)
  const [unlockTarget, setUnlockTarget] = useState<TeamMemberSummary | null>(null)
  const [unlockReason, setUnlockReason] = useState('')
  const [usernameTarget, setUsernameTarget] = useState<TeamMemberSummary | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [passwordTarget, setPasswordTarget] = useState<TeamMemberSummary | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)

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

  const unlockMutation = useMutation({
    mutationFn: () => managerParentService.unlockUsername(unlockTarget?.id ?? 0, unlockReason),
    onSuccess: () => {
      toast.success(t('managerParent.pages.usernameManagement.unlockSuccess'))
      setUnlockTarget(null)
      setUnlockReason('')
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team'] })
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team', 'detail'] })
    },
  })

  const usernameMutation = useMutation({
    mutationFn: () => managerParentService.changeUsername(usernameTarget?.id ?? 0, newUsername, changeReason),
    onSuccess: () => {
      toast.success(t('managerParent.pages.usernameManagement.renameSuccess'))
      setUsernameTarget(null)
      setNewUsername('')
      setChangeReason('')
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team'] })
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team', 'detail'] })
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => managerParentService.resetPassword(passwordTarget?.id ?? 0, newPassword),
    onSuccess: () => {
      toast.success(t('managerParent.pages.usernameManagement.resetPasswordSuccess'))
      setPasswordTarget(null)
      setNewPassword('')
      setShowResetPassword(false)
    },
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
        key: 'username',
        label: t('common.username'),
        sortable: true,
        sortValue: (row) => row.username ?? '',
        render: (row) => (
          <div className="space-y-1">
            <p className="font-medium text-slate-950 dark:text-white">{row.username ?? '-'}</p>
            <StatusBadge status={row.username_locked ? 'suspended' : 'active'} />
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
          <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
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
                setShowCreatePassword(false)
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
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setPasswordTarget(row)
                setNewPassword('')
                setShowResetPassword(false)
              }}
            >
              {t('common.resetPassword')}
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
    setShowCreatePassword(false)
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
              setShowCreatePassword(false)
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
            onRowClick={(row) => navigate(routePaths.managerParent.teamMemberDetail(lang, row.id))}
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
                <div className="relative">
                  <Input id="team-password" type={showCreatePassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="pe-12" />
                  <Button type="button" variant="ghost" size="sm" className="absolute end-1 top-1/2 h-9 -translate-y-1/2 px-2" onClick={() => setShowCreatePassword((current) => !current)}>
                    {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="sr-only">{showCreatePassword ? t('common.hide') : t('common.show')}</span>
                  </Button>
                </div>
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
          <Textarea id="unlock-reason" value={unlockReason} onChange={(event) => setUnlockReason(event.target.value)} placeholder={t('managerParent.pages.usernameManagement.unlockReasonRequired')} />
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
              <Textarea id="change-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} />
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

      <Dialog
        open={passwordTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordTarget(null)
            setNewPassword('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.resetPassword')}</DialogTitle>
            <DialogDescription>{passwordTarget?.email ?? t('managerParent.pages.teamManagement.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="team-reset-password">{t('managerParent.pages.profile.newPassword')}</Label>
            <div className="relative">
              <Input id="team-reset-password" type={showResetPassword ? 'text' : 'password'} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="pe-12" />
              <Button type="button" variant="ghost" size="sm" className="absolute end-1 top-1/2 h-9 -translate-y-1/2 px-2" onClick={() => setShowResetPassword((current) => !current)}>
                {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showResetPassword ? t('common.hide') : t('common.show')}</span>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPasswordTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (newPassword.trim().length < 8) {
                  toast.error(t('managerParent.pages.teamManagement.passwordValidation'))
                  return
                }

                resetMutation.mutate()
              }}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? t('common.saving') : t('common.resetPassword')}
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
