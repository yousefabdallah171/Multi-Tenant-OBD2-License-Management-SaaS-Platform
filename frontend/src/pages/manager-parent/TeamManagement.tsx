import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, MoreVertical } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { PageHeader } from '@/components/manager-parent/PageHeader'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, isValidPhoneNumber, normalizePhoneInput } from '@/lib/utils'
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
  username: string
}

const EMPTY_FORM: TeamFormState = {
  name: '',
  email: '',
  password: '',
  phone: '',
  username: '',
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function TeamManagementPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const returnTo = `${location.pathname}${location.search}`
  const restoreState = (location.state as {
    restore?: {
      role?: 'manager' | 'reseller' | ''
      page?: number
      perPage?: number
      search?: string
      status?: 'active' | 'suspended' | 'inactive' | ''
    }
  } | null)?.restore
  const [role, setRole] = useState<'manager' | 'reseller' | ''>(() => restoreState?.role ?? '')
  const [page, setPage] = useState(() => restoreState?.page ?? 1)
  const [perPage, setPerPage] = useState(() => restoreState?.perPage ?? 10)
  const [search, setSearch] = useState(() => restoreState?.search ?? '')
  const [status, setStatus] = useState<'active' | 'suspended' | 'inactive' | ''>(() => restoreState?.status ?? '')
  const [formOpen, setFormOpen] = useState(false)
  const [inviteRole, setInviteRole] = useState<'reseller'>('reseller')
  const [deleteTarget, setDeleteTarget] = useState<TeamMemberSummary | null>(null)
  const [editingMember, setEditingMember] = useState<TeamMemberSummary | null>(null)
  const [form, setForm] = useState<TeamFormState>(EMPTY_FORM)
  const [unlockTarget, setUnlockTarget] = useState<TeamMemberSummary | null>(null)
  const [unlockReason, setUnlockReason] = useState('')
  const [passwordTarget, setPasswordTarget] = useState<TeamMemberSummary | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [revokeTokensOnReset, setRevokeTokensOnReset] = useState(true)

  const membersQuery = useQuery({
    queryKey: ['manager-parent', 'team', role, page, perPage, search, status],
    queryFn: () => teamService.getAll({ role: role || '', page, per_page: perPage, search, status }),
  })

  function invalidateTeamQueries(memberId?: number) {
    void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team'] })
    if (memberId) {
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team', 'detail', memberId] })
    }
  }

  const createMutation = useMutation({
    mutationFn: (payload: TeamPayload) => teamService.create(payload),
    onSuccess: () => {
      toast.success(t('managerParent.pages.teamManagement.resellerInvited'))
      closeForm()
      invalidateTeamQueries()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<Omit<TeamPayload, 'role' | 'password'>> }) => {
      await teamService.update(id, payload)

      const desiredUsername = form.username.trim()
      const currentUsername = editingMember?.username?.trim() ?? ''

      if (desiredUsername && desiredUsername !== currentUsername) {
        try {
          await managerParentService.changeUsername(id, desiredUsername)
          return { usernameUpdated: true, usernameErrorMessage: null as string | null }
        } catch (error) {
          return {
            usernameUpdated: false,
            usernameErrorMessage: getApiErrorMessage(error, t('managerParent.pages.usernameManagement.usernameRequired')),
          }
        }
      }

      return { usernameUpdated: true, usernameErrorMessage: null as string | null }
    },
    onSuccess: ({ usernameUpdated, usernameErrorMessage }) => {
      closeForm()
      invalidateTeamQueries(editingMember?.id)

      if (usernameUpdated) {
        toast.success(t('managerParent.pages.teamManagement.updateSuccess'))
        return
      }

      toast.error(usernameErrorMessage ?? t('common.partialUsernameUpdate', { defaultValue: 'Account details were saved, but the username could not be updated.' }))
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: number; nextStatus: 'active' | 'suspended' | 'inactive' }) => teamService.updateStatus(id, nextStatus),
    onSuccess: () => {
      toast.success(t('managerParent.pages.teamManagement.statusUpdated'))
      invalidateTeamQueries()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => teamService.delete(id),
    onSuccess: () => {
      toast.success(t('managerParent.pages.teamManagement.deleteSuccess'))
      setDeleteTarget(null)
      invalidateTeamQueries(deleteTarget?.id)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'This team member cannot be deleted.'))
      setDeleteTarget(null)
    },
  })

  const unlockMutation = useMutation({
    mutationFn: () => managerParentService.unlockUsername(unlockTarget?.id ?? 0, unlockReason),
    onSuccess: () => {
      toast.success(t('managerParent.pages.usernameManagement.unlockSuccess'))
      setUnlockTarget(null)
      setUnlockReason('')
      invalidateTeamQueries(unlockTarget?.id)
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => managerParentService.resetPassword(passwordTarget?.id ?? 0, newPassword, revokeTokensOnReset),
    onSuccess: () => {
      toast.success(t('managerParent.pages.usernameManagement.resetPasswordSuccess'))
      setPasswordTarget(null)
      setNewPassword('')
      setShowResetPassword(false)
      setRevokeTokensOnReset(true)
      invalidateTeamQueries(passwordTarget?.id)
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
        render: (row) => <p className="font-medium text-slate-950 dark:text-white">{row.username ?? '-'}</p>,
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
        label: t('common.accountStatus'),
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
          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">{t('common.actions')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingMember(row)
                    setInviteRole('reseller')
                    setForm({
                      name: row.name,
                      email: row.email,
                      password: '',
                      phone: row.phone ?? '',
                      username: row.username ?? '',
                    })
                    setFormOpen(true)
                    setShowCreatePassword(false)
                  }}
                >
                  {t('common.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    statusMutation.mutate({
                      id: row.id,
                      nextStatus: row.status === 'active' ? 'suspended' : 'active',
                    })
                  }
                >
                  {row.status === 'active' ? t('common.suspend') : t('common.activate')}
                </DropdownMenuItem>
                {row.can_delete ? <DropdownMenuItem onClick={() => setDeleteTarget(row)}>{t('common.delete')}</DropdownMenuItem> : null}
                {row.username_locked ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setUnlockTarget(row)
                      setUnlockReason('')
                    }}
                  >
                    {t('managerParent.pages.usernameManagement.unlock')}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onClick={() => {
                    setPasswordTarget(row)
                    setNewPassword('')
                    setShowResetPassword(false)
                    setRevokeTokensOnReset(true)
                  }}
                >
                  {t('common.resetPassword')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [locale, statusMutation, t],
  )

  const list = membersQuery.data?.data ?? []
  const detailState = {
    returnTo,
    restore: {
      role,
      page,
      perPage,
      search,
      status,
    },
  }

  function closeForm() {
    setFormOpen(false)
    setEditingMember(null)
    setInviteRole('reseller')
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

    if (editingMember && !form.username.trim()) {
      toast.error(t('managerParent.pages.usernameManagement.usernameRequired'))
      return
    }

    if (!editingMember && form.password.trim().length < 8) {
      toast.error(t('managerParent.pages.teamManagement.passwordValidation'))
      return
    }

    if (form.phone.trim() && !isValidPhoneNumber(form.phone)) {
      toast.error(t('validation.invalidPhone', { defaultValue: 'Invalid phone number' }))
      return
    }

    if (editingMember) {
      updateMutation.mutate({
        id: editingMember.id,
        payload: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: normalizePhoneInput(form.phone.trim()) || null,
        },
      })
      return
    }

    createMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      phone: normalizePhoneInput(form.phone.trim()) || null,
      role: inviteRole,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
      title={t('managerParent.pages.teamManagement.title')}
        description={lang === 'ar'
          ? 'اعرض المدراء الحاليين وأدر حسابات الموزعين ضمن هذا الشريك. لا يمكن إنشاء مدير جديد من هذه الصفحة.'
          : 'Review existing managers and manage reseller accounts under this tenant. New manager accounts can only be created by super admin.'}
        actions={
          <Button
            type="button"
            onClick={() => {
              setEditingMember(null)
              setInviteRole('reseller')
              setForm(EMPTY_FORM)
              setFormOpen(true)
              setShowCreatePassword(false)
            }}
          >
            {lang === 'ar' ? 'إنشاء موزع' : 'Create reseller'}
          </Button>
        }
      />

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
            onRowClick={(row) => navigate(routePaths.managerParent.teamMemberDetail(lang, row.id), { state: detailState })}
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
                : (lang === 'ar' ? 'إنشاء موزع' : 'Create reseller')}
            </DialogTitle>
            <DialogDescription>
              {editingMember
                ? t('managerParent.pages.teamManagement.editDescription')
                : (lang === 'ar'
                    ? 'أنشئ حساب موزع جديد ضمن هذا الشريك.'
                    : 'Create a new reseller account under this tenant.')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            {!editingMember ? (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="team-role">{t('common.role')}</Label>
                <Input
                  id="team-role"
                  value={lang === 'ar' ? 'موزع' : 'Reseller'}
                  readOnly
                  className="cursor-not-allowed bg-slate-100 dark:bg-slate-900"
                />
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
            {editingMember ? (
              <div className="space-y-2">
                <Label htmlFor="team-username">{t('common.username')}</Label>
                <Input id="team-username" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="team-phone">{t('common.phone')}</Label>
              <Input
                id="team-phone"
                type="tel"
                inputMode="tel"
                placeholder="+966..."
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: normalizePhoneInput(event.target.value) }))}
              />
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
          <label htmlFor="manager-parent-reset-revoke-tokens" className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
            <input
              id="manager-parent-reset-revoke-tokens"
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

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message && error.message !== 'Request failed with status code 422') {
    return error.message
  }

  const response = (error as AxiosError<{ message?: string; errors?: Record<string, string[]> }>).response

  return response?.data?.message
    ?? Object.values(response?.data?.errors ?? {})[0]?.[0]
    ?? fallback
}
