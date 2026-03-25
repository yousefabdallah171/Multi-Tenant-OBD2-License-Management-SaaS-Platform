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
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/hooks/useLanguage'
import { normalizeAccountStatus, type AccountStatusFilter } from '@/lib/account-status'
import { formatCurrency, isValidPhoneNumber, normalizePhoneInput } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'
import type { ManagerTeamReseller } from '@/types/manager-reseller.types'

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

export function TeamPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const queryClient = useQueryClient()
  const returnTo = `${location.pathname}${location.search}`
  const restoreState = (location.state as { restore?: { page?: number; perPage?: number; status?: AccountStatusFilter; search?: string } } | null)?.restore
  const [page, setPage] = useState(() => restoreState?.page ?? 1)
  const [perPage, setPerPage] = useState(() => restoreState?.perPage ?? 10)
  const [status, setStatus] = useState<AccountStatusFilter>(() => restoreState?.status ?? '')
  const [search, setSearch] = useState(() => restoreState?.search ?? '')
  const [formOpen, setFormOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<ManagerTeamReseller | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ManagerTeamReseller | null>(null)
  const [form, setForm] = useState<TeamFormState>(EMPTY_FORM)
  const [unlockTarget, setUnlockTarget] = useState<ManagerTeamReseller | null>(null)
  const [unlockReason, setUnlockReason] = useState('')
  const [passwordTarget, setPasswordTarget] = useState<ManagerTeamReseller | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [revokeTokensOnReset, setRevokeTokensOnReset] = useState(true)

  const teamQuery = useQuery({
    queryKey: ['manager', 'team', page, perPage, status, search],
    queryFn: () =>
      managerService.getTeam({
        page,
        per_page: perPage,
        status,
        search,
      }),
  })
  const detailState = {
    returnTo,
    restore: {
      page,
      perPage,
      status,
      search,
    },
  }

  function invalidateTeamQueries(memberId?: number) {
    void queryClient.invalidateQueries({ queryKey: ['manager', 'team'] })
    if (memberId) {
      void queryClient.invalidateQueries({ queryKey: ['manager', 'team', 'detail', memberId] })
    }
  }

  const createMutation = useMutation({
    mutationFn: () =>
      managerService.createTeamMember({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: normalizePhoneInput(form.phone.trim()) || null,
      }),
    onSuccess: () => {
      toast.success(t('manager.pages.team.createSuccess'))
      closeForm()
      invalidateTeamQueries()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      const memberId = editingMember?.id ?? 0
      await managerService.updateTeamMember(memberId, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: normalizePhoneInput(form.phone.trim()) || null,
      })

      const desiredUsername = form.username.trim()
      const currentUsername = editingMember?.username?.trim() ?? ''

      if (desiredUsername && desiredUsername !== currentUsername) {
        try {
          await managerService.changeUsername(memberId, desiredUsername)
          return { usernameUpdated: true, usernameErrorMessage: null as string | null }
        } catch (error) {
          return {
            usernameUpdated: false,
            usernameErrorMessage: getApiErrorMessage(error, t('manager.pages.usernameManagement.usernameRequired')),
          }
        }
      }

      return { usernameUpdated: true, usernameErrorMessage: null as string | null }
    },
    onSuccess: ({ usernameUpdated, usernameErrorMessage }) => {
      closeForm()
      invalidateTeamQueries(editingMember?.id)

      if (usernameUpdated) {
        toast.success(t('manager.pages.team.updateSuccess'))
        return
      }

      toast.error(usernameErrorMessage ?? t('common.partialUsernameUpdate', { defaultValue: 'Account details were saved, but the username could not be updated.' }))
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: number; nextStatus: 'active' | 'inactive' }) =>
      managerService.updateTeamMemberStatus(id, nextStatus),
    onSuccess: () => {
      toast.success(t('manager.pages.team.statusUpdated'))
      invalidateTeamQueries()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => managerService.deleteTeamMember(id),
    onSuccess: () => {
      toast.success(t('manager.pages.team.deleteSuccess'))
      setDeleteTarget(null)
      invalidateTeamQueries(deleteTarget?.id)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'This reseller cannot be deleted.'))
      setDeleteTarget(null)
    },
  })

  const unlockMutation = useMutation({
    mutationFn: () => managerService.unlockUsername(unlockTarget?.id ?? 0, unlockReason),
    onSuccess: () => {
      toast.success(t('manager.pages.usernameManagement.unlockSuccess'))
      setUnlockTarget(null)
      setUnlockReason('')
      invalidateTeamQueries(unlockTarget?.id)
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => managerService.resetPassword(passwordTarget?.id ?? 0, newPassword, revokeTokensOnReset),
    onSuccess: () => {
      toast.success(t('manager.pages.usernameManagement.resetPasswordSuccess'))
      setPasswordTarget(null)
      setNewPassword('')
      setShowNewPassword(false)
      setRevokeTokensOnReset(true)
      invalidateTeamQueries(passwordTarget?.id)
    },
  })

  const columns = useMemo<Array<DataTableColumn<ManagerTeamReseller>>>(
    () => [
      {
        key: 'name',
        label: t('manager.pages.team.columns.reseller'),
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <div className="space-y-1">
            <p className="font-medium text-slate-950 dark:text-white">
              <button
                type="button"
                className="text-start text-sky-600 hover:underline dark:text-sky-300"
                onClick={(event) => {
                  event.stopPropagation()
                  navigate(routePaths.manager.teamMemberDetail(lang, row.id), { state: detailState })
                }}
              >
                {row.name}
              </button>
            </p>
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
      { key: 'customers', label: t('manager.pages.dashboard.teamCustomers'), sortable: true, sortValue: (row) => row.customers_count, render: (row) => row.customers_count },
      { key: 'licenses', label: t('manager.pages.dashboard.activeLicenses'), sortable: true, sortValue: (row) => row.active_licenses_count, render: (row) => row.active_licenses_count },
      { key: 'revenue', label: t('common.revenue'), sortable: true, sortValue: (row) => row.revenue, render: (row) => formatCurrency(row.revenue, 'USD', locale) },
      {
        key: 'status',
        label: t('common.accountStatus'),
        sortable: true,
        sortValue: (row) => normalizeAccountStatus(row.status),
        render: (row) => <StatusBadge status={normalizeAccountStatus(row.status)} />,
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
                      nextStatus: normalizeAccountStatus(row.status) === 'active' ? 'inactive' : 'active',
                    })
                  }
                >
                  {normalizeAccountStatus(row.status) === 'active' ? t('common.deactive') : t('common.activate')}
                </DropdownMenuItem>
                {row.can_delete ? <DropdownMenuItem onClick={() => setDeleteTarget(row)}>{t('common.delete')}</DropdownMenuItem> : null}
                {row.username_locked ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setUnlockTarget(row)
                      setUnlockReason('')
                    }}
                  >
                    {t('manager.pages.usernameManagement.unlock')}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onClick={() => {
                    setPasswordTarget(row)
                    setNewPassword('')
                    setShowNewPassword(false)
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
    [lang, locale, navigate, returnTo, statusMutation, t],
  )

  function closeForm() {
    setFormOpen(false)
    setEditingMember(null)
    setForm(EMPTY_FORM)
    setShowCreatePassword(false)
  }

  function submitForm() {
    if (form.name.trim().length < 2) {
      toast.error(t('manager.pages.team.nameValidation'))
      return
    }

    if (!isValidEmail(form.email)) {
      toast.error(t('manager.pages.team.emailValidation'))
      return
    }

    if (editingMember && !form.username.trim()) {
      toast.error(t('manager.pages.usernameManagement.usernameRequired'))
      return
    }

    if (!editingMember && form.password.trim().length < 8) {
      toast.error(t('manager.pages.team.passwordValidation'))
      return
    }

    if (form.phone.trim() && !isValidPhoneNumber(form.phone)) {
      toast.error(t('validation.invalidPhone', { defaultValue: 'Invalid phone number' }))
      return
    }

    if (editingMember) {
      updateMutation.mutate()
      return
    }

    createMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('manager.layout.eyebrow')}
        title={t('manager.pages.team.title')}
        description={t('manager.pages.team.description')}
        actions={
          <Button
            type="button"
            onClick={() => {
              setEditingMember(null)
              setForm(EMPTY_FORM)
              setFormOpen(true)
              setShowCreatePassword(false)
            }}
          >
            {t('manager.pages.team.inviteReseller')}
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t('manager.pages.usernameManagement.searchPlaceholder')}
          />
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
        columns={columns}
        data={teamQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(routePaths.manager.teamMemberDetail(lang, row.id), { state: detailState })}
        isLoading={teamQuery.isLoading}
        pagination={{
          page: teamQuery.data?.meta.current_page ?? 1,
          lastPage: teamQuery.data?.meta.last_page ?? 1,
          total: teamQuery.data?.meta.total ?? 0,
          perPage: teamQuery.data?.meta.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPerPage(size)
          setPage(1)
        }}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMember ? t('manager.pages.team.editTitle') : t('manager.pages.team.inviteTitle')}</DialogTitle>
            <DialogDescription>{editingMember ? t('manager.pages.team.editDescription') : t('manager.pages.team.inviteDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
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
                  <Input
                    id="team-password"
                    type={showCreatePassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    className="pe-12"
                  />
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
              {createMutation.isPending || updateMutation.isPending ? t('common.saving') : editingMember ? t('manager.pages.team.saveChanges') : t('manager.pages.team.createAccount')}
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
        title={t('manager.pages.team.deleteTitle')}
        description={deleteTarget ? t('manager.pages.team.deleteDescription', { email: deleteTarget.email }) : undefined}
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          if (!deleteTarget) {
            return
          }

          deleteMutation.mutate(deleteTarget.id)
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
        open={passwordTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordTarget(null)
            setNewPassword('')
            setShowNewPassword(false)
            setRevokeTokensOnReset(true)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.resetPassword')}</DialogTitle>
            <DialogDescription>{passwordTarget?.email ?? t('manager.pages.usernameManagement.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t('manager.pages.profile.newPassword')}</Label>
            <div className="relative">
              <Input id="new-password" type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="pe-12" />
              <Button type="button" variant="ghost" size="sm" className="absolute end-1 top-1/2 h-9 -translate-y-1/2 px-2" onClick={() => setShowNewPassword((current) => !current)}>
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showNewPassword ? t('common.hide') : t('common.show')}</span>
              </Button>
            </div>
          </div>
          <label htmlFor="manager-reset-revoke-tokens" className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
            <input
              id="manager-reset-revoke-tokens"
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
                  toast.error(t('manager.pages.usernameManagement.passwordValidation'))
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
