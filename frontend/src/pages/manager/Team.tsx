import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { managerService } from '@/services/manager.service'
import type { ManagerTeamReseller } from '@/types/manager-reseller.types'

export function TeamPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [status, setStatus] = useState<'active' | 'suspended' | 'inactive' | ''>('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [unlockTarget, setUnlockTarget] = useState<ManagerTeamReseller | null>(null)
  const [unlockReason, setUnlockReason] = useState('')
  const [usernameTarget, setUsernameTarget] = useState<ManagerTeamReseller | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [passwordTarget, setPasswordTarget] = useState<ManagerTeamReseller | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)

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

  const detailQuery = useQuery({
    queryKey: ['manager', 'team', 'detail', selectedId],
    queryFn: () => managerService.getTeamMember(selectedId ?? 0),
    enabled: selectedId !== null,
  })

  const unlockMutation = useMutation({
    mutationFn: () => managerService.unlockUsername(unlockTarget?.id ?? 0, unlockReason),
    onSuccess: () => {
      toast.success(t('manager.pages.usernameManagement.unlockSuccess'))
      setUnlockTarget(null)
      setUnlockReason('')
      void queryClient.invalidateQueries({ queryKey: ['manager', 'team'] })
      void queryClient.invalidateQueries({ queryKey: ['manager', 'team', 'detail'] })
    },
  })

  const usernameMutation = useMutation({
    mutationFn: () => managerService.changeUsername(usernameTarget?.id ?? 0, newUsername, changeReason),
    onSuccess: () => {
      toast.success(t('manager.pages.usernameManagement.renameSuccess'))
      setUsernameTarget(null)
      setNewUsername('')
      setChangeReason('')
      void queryClient.invalidateQueries({ queryKey: ['manager', 'team'] })
      void queryClient.invalidateQueries({ queryKey: ['manager', 'team', 'detail'] })
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => managerService.resetPassword(passwordTarget?.id ?? 0, newPassword),
    onSuccess: () => {
      toast.success(t('manager.pages.usernameManagement.resetPasswordSuccess'))
      setPasswordTarget(null)
      setNewPassword('')
      setShowNewPassword(false)
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
            <p className="font-medium text-slate-950 dark:text-white">{row.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.email}</p>
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
      { key: 'customers', label: t('manager.pages.dashboard.teamCustomers'), sortable: true, sortValue: (row) => row.customers_count, render: (row) => row.customers_count },
      { key: 'licenses', label: t('manager.pages.dashboard.activeLicenses'), sortable: true, sortValue: (row) => row.active_licenses_count, render: (row) => row.active_licenses_count },
      { key: 'revenue', label: t('common.revenue'), sortable: true, sortValue: (row) => row.revenue, render: (row) => formatCurrency(row.revenue, 'USD', locale) },
      { key: 'status', label: t('common.status'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
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
                setPasswordTarget(row)
                setNewPassword('')
                setShowNewPassword(false)
              }}
            >
              {t('common.resetPassword')}
            </Button>
          </div>
        ),
      },
    ],
    [locale, t],
  )

  const selectedReseller = detailQuery.data?.data

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('manager.layout.eyebrow')}
        title={t('manager.pages.team.title')}
        description={t('manager.pages.usernameManagement.description')}
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
        data={teamQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        onRowClick={(row) => setSelectedId(row.id)}
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

      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="left-auto right-0 top-0 h-screen w-[min(100vw,44rem)] max-w-[44rem] translate-x-0 translate-y-0 overflow-y-auto rounded-none rounded-s-3xl">
          <DialogHeader>
            <DialogTitle>{selectedReseller?.name ?? t('manager.pages.team.resellerDetail')}</DialogTitle>
            <DialogDescription>{selectedReseller?.email ?? t('manager.pages.team.resellerDetailDescription')}</DialogDescription>
          </DialogHeader>

          {selectedReseller ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <MetricCard label={t('common.username')} value={selectedReseller.username ?? '-'} />
                <MetricCard label={t('manager.pages.dashboard.teamCustomers')} value={selectedReseller.customers_count} />
                <MetricCard label={t('manager.pages.dashboard.activeLicenses')} value={selectedReseller.active_licenses_count} />
                <MetricCard label={t('common.revenue')} value={formatCurrency(selectedReseller.revenue, 'USD', locale)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <MetricCard label={t('common.status')} value={<StatusBadge status={selectedReseller.status} />} />
                <MetricCard label={t('manager.pages.usernameManagement.locked')} value={<StatusBadge status={selectedReseller.username_locked ? 'suspended' : 'active'} />} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('manager.pages.team.recentLicenses')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedReseller.recent_licenses.length === 0 ? (
                    <EmptyState title={t('manager.pages.team.noRecentLicensesTitle')} description={t('manager.pages.team.noRecentLicensesDescription')} />
                  ) : (
                    selectedReseller.recent_licenses.map((license) => (
                      <div key={license.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-medium text-slate-950 dark:text-white">{license.customer?.name ?? t('manager.pages.team.unknownCustomer')}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{license.customer?.email ?? t('manager.pages.team.noEmail')}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{license.program ?? t('manager.pages.customers.unknownProgram')}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('manager.pages.team.biosId')} {license.bios_id}</p>
                          </div>
                          <div className="text-right">
                            <StatusBadge status={license.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} />
                            <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{formatCurrency(license.price, 'USD', locale)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {t('manager.pages.customers.expires')} {license.expires_at ? formatDate(license.expires_at, locale) : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('manager.nav.activity')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedReseller.recent_activity.length === 0 ? (
                    <EmptyState title={t('common.noData')} description={t('manager.pages.activity.noMatches')} />
                  ) : (
                    selectedReseller.recent_activity.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                        <p className="font-medium text-slate-950 dark:text-white">{entry.action}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{entry.description ?? '-'}</p>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('manager.pages.team.joined')} {selectedReseller.created_at ? formatDate(selectedReseller.created_at, locale) : '-'}
              </p>
            </div>
          ) : null}
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
