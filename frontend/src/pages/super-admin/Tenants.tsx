import { useRef, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Download, History, MoreHorizontal, Plus, RotateCcw, Search, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { StatusFilterCard } from '@/components/customers/StatusFilterCard'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { tenantService } from '@/services/tenant.service'
import type { TenantBackup, TenantSummary } from '@/types/super-admin.types'

const emptyTenantForm = {
  name: '',
  manager_name: '',
  manager_email: '',
  manager_password: '',
  status: 'active' as 'active' | 'suspended' | 'inactive',
}

export function TenantsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [status, setStatus] = useState<'' | 'active' | 'suspended' | 'inactive'>('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<TenantSummary | null>(null)
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TenantSummary | null>(null)
  const [showManagerPassword, setShowManagerPassword] = useState(false)
  const [form, setForm] = useState(emptyTenantForm)

  // Reset & Backup state
  const [resetTarget, setResetTarget] = useState<TenantSummary | null>(null)
  const [resetConfirmName, setResetConfirmName] = useState('')
  const [resetLabel, setResetLabel] = useState('')
  const [backupsTarget, setBackupsTarget] = useState<TenantSummary | null>(null)
  const [createBackupTarget, setCreateBackupTarget] = useState<TenantSummary | null>(null)
  const [backupName, setBackupName] = useState('')
  const [restoreTarget, setRestoreTarget] = useState<TenantBackup | null>(null)
  const [restoreConfirmName, setRestoreConfirmName] = useState('')
  const [deleteBackupTarget, setDeleteBackupTarget] = useState<TenantBackup | null>(null)
  const [importLabel, setImportLabel] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'tenants', page, perPage, status, search],
    queryFn: () => tenantService.getAll({ page, status, search, per_page: perPage }),
  })

  const tenantStatsQuery = useQuery({
    queryKey: ['super-admin', 'tenant-stats', selectedTenantId],
    queryFn: () => tenantService.getStats(selectedTenantId as number),
    enabled: selectedTenantId !== null && statsOpen,
  })

  const backupsQuery = useQuery({
    queryKey: ['super-admin', 'tenant-backups', backupsTarget?.id],
    queryFn: () => tenantService.getBackups(backupsTarget!.id),
    enabled: backupsTarget !== null,
  })

  const resetMutation = useMutation({
    mutationFn: () =>
      tenantService.resetTenant(resetTarget!.id, {
        confirm_name: resetConfirmName,
        label: resetLabel || undefined,
      }),
    onSuccess: (data) => {
      toast.success(data.message)
      setResetTarget(null)
      setResetConfirmName('')
      setResetLabel('')
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'tenants'] })
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'tenant-backups', resetTarget?.id] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Reset failed. Please try again.')
    },
  })

  const restoreMutation = useMutation({
    mutationFn: () =>
      tenantService.restoreBackup(backupsTarget!.id, restoreTarget!.id, {
        confirm_name: restoreConfirmName,
      }),
    onSuccess: (data) => {
      toast.success(data.message)
      setRestoreTarget(null)
      setRestoreConfirmName('')
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'tenants'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Restore failed. Please try again.')
    },
  })

  const deleteBackupMutation = useMutation({
    mutationFn: (backup: TenantBackup) => tenantService.deleteBackup(backupsTarget!.id, backup.id),
    onSuccess: () => {
      toast.success('Backup deleted.')
      setDeleteBackupTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'tenant-backups', backupsTarget?.id] })
    },
  })

  const createBackupMutation = useMutation({
    mutationFn: () =>
      tenantService.createBackup(createBackupTarget!.id, {
        label: backupName || undefined,
      }),
    onSuccess: (data) => {
      toast.success(data.message || t('superAdmin.pages.tenants.backupCreatedSuccess', { defaultValue: 'Backup created successfully.' }))
      setCreateBackupTarget(null)
      setBackupName('')
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'tenant-backups', createBackupTarget?.id] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? t('superAdmin.pages.tenants.backupCreateError', { defaultValue: 'Failed to create backup. Please try again.' }))
    },
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => tenantService.importBackup(backupsTarget!.id, file, importLabel || undefined),
    onSuccess: (data) => {
      toast.success(data.message)
      setImportLabel('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'tenant-backups', backupsTarget?.id] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Import failed. Please check the file format.')
    },
  })

  async function handleDownload(backup: TenantBackup) {
    if (!backupsTarget) return
    try {
      const { blob, filename } = await tenantService.downloadBackup(backupsTarget.id, backup.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed. Please try again.')
    }
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    importMutation.mutate(file)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingTenant) {
        return tenantService.update(editingTenant.id, {
          name: form.name,
          status: form.status,
        })
      }

      return tenantService.create(form)
    },
    onSuccess: () => {
      toast.success(t('superAdmin.pages.tenants.saveSuccess'))
      setFormOpen(false)
      setEditingTenant(null)
      setShowManagerPassword(false)
      setForm(emptyTenantForm)
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'tenants'] })
    },
    onError: (err: unknown) => {
      const fallback = t('common.error')
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
      const message = data?.message
      const fieldErrors = data?.errors ? Object.values(data.errors).flat().filter(Boolean) : []
      toast.error(fieldErrors[0] ?? message ?? fallback)
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: number; nextStatus: 'active' | 'suspended' }) => tenantService.update(id, { status: nextStatus }),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.tenants.saveSuccess'))
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'tenants'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tenantService.delete(id),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.tenants.deleteSuccess'))
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'tenants'] })
    },
  })

  function openTenantStats(tenantId: number) {
    setSelectedTenantId(tenantId)
    setStatsOpen(true)
  }

  const columns = useMemo<Array<DataTableColumn<TenantSummary>>>(
    () => [
      {
        key: 'name',
        label: t('common.name'),
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <button
            type="button"
            onClick={() => openTenantStats(row.id)}
            className="text-start transition hover:opacity-80"
          >
            <div className="font-medium text-slate-950 dark:text-white">{row.name}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{row.slug}</div>
          </button>
        ),
      },
      { key: 'users', label: t('common.users'), sortable: true, sortValue: (row) => row.users_count, render: (row) => row.users_count },
      { key: 'managers', label: t('superAdmin.pages.tenants.managers'), sortable: true, sortValue: (row) => row.managers_count, render: (row) => row.managers_count },
      { key: 'resellers', label: t('superAdmin.pages.tenants.resellers'), sortable: true, sortValue: (row) => row.resellers_count, render: (row) => row.resellers_count },
      { key: 'customers', label: t('superAdmin.pages.tenants.customers'), sortable: true, sortValue: (row) => row.customers_count, render: (row) => row.customers_count },
      { key: 'licenses', label: t('superAdmin.pages.tenants.activeLicenses'), sortable: true, sortValue: (row) => row.active_licenses_count, render: (row) => row.active_licenses_count },
      { key: 'revenue', label: t('common.revenue'), sortable: true, sortValue: (row) => row.revenue, render: (row) => formatCurrency(row.revenue, 'USD', locale) },
      { key: 'status', label: t('common.status'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
      {
        key: 'actions',
        label: t('common.actions'),
        className: 'w-20',
        render: (row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="ghost" aria-label={t('common.actions')}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => openTenantStats(row.id)}
              >
                <BarChart3 className="me-2 h-4 w-4" />
                {t('common.view')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setEditingTenant(row)
                  setForm({
                    name: row.name,
                    manager_name: '',
                    manager_email: '',
                    manager_password: '',
                    status: row.status,
                  })
                  setShowManagerPassword(false)
                  setFormOpen(true)
                }}
              >
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => statusMutation.mutate({ id: row.id, nextStatus: row.status === 'active' ? 'suspended' : 'active' })}>
                {row.status === 'active' ? t('common.suspend') : t('common.activate')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setBackupsTarget(row)
                }}
              >
                <History className="me-2 h-4 w-4" />
                {t('superAdmin.pages.tenants.backupHistory', { defaultValue: 'Backup History' })}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setCreateBackupTarget(row)
                  setBackupName('')
                }}
              >
                <Plus className="me-2 h-4 w-4" />
                {t('superAdmin.pages.tenants.createBackupAction', { defaultValue: 'Create Backup' })}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-orange-600 focus:text-orange-600 dark:text-orange-400 dark:focus:text-orange-400"
                onSelect={() => {
                  setResetTarget(row)
                  setResetConfirmName('')
                  setResetLabel('')
                }}
              >
                <RotateCcw className="me-2 h-4 w-4" />
                {t('superAdmin.pages.tenants.resetTenant', { defaultValue: 'Reset Tenant' })}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400" onSelect={() => setDeleteTarget(row)}>
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [locale, statusMutation, t],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold">{t('superAdmin.pages.tenants.title')}</h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.tenants.description')}</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditingTenant(null)
            setShowManagerPassword(false)
            setForm(emptyTenantForm)
            setFormOpen(true)
          }}
        >
          <Plus className="me-2 h-4 w-4" />
          {t('superAdmin.pages.tenants.add')}
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="relative min-w-[220px]">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              className="ps-10"
              placeholder={t('common.search')}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <StatusFilterCard label={t('common.all')} count={tenantsQuery.data?.status_counts.all ?? 0} isActive={status === ''} onClick={() => { setStatus(''); setPage(1) }} color="sky" />
            <StatusFilterCard label={t('common.active')} count={tenantsQuery.data?.status_counts.active ?? 0} isActive={status === 'active'} onClick={() => { setStatus('active'); setPage(1) }} color="emerald" />
            <StatusFilterCard label={t('common.suspended')} count={tenantsQuery.data?.status_counts.suspended ?? 0} isActive={status === 'suspended'} onClick={() => { setStatus('suspended'); setPage(1) }} color="amber" />
            <StatusFilterCard label={t('common.inactive')} count={tenantsQuery.data?.status_counts.inactive ?? 0} isActive={status === 'inactive'} onClick={() => { setStatus('inactive'); setPage(1) }} color="slate" />
          </div>
        </CardContent>
      </Card>

      {tenantsQuery.isLoading ? (
        <DataTable tableKey="super_admin_tenants" columns={columns} data={[]} rowKey={(row) => row.id} isLoading />
      ) : (
        <DataTable
          tableKey="super_admin_tenants"
          columns={columns}
          data={tenantsQuery.data?.data ?? []}
          rowKey={(row) => row.id}
          pagination={{
            page: tenantsQuery.data?.meta.current_page ?? 1,
            lastPage: tenantsQuery.data?.meta.last_page ?? 1,
            total: tenantsQuery.data?.meta.total ?? 0,
            perPage: tenantsQuery.data?.meta.per_page ?? perPage,
          }}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPerPage(nextPageSize)
            setPage(1)
          }}
        />
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTenant ? t('superAdmin.pages.tenants.editTitle') : t('superAdmin.pages.tenants.addTitle')}</DialogTitle>
            <DialogDescription>{t('superAdmin.pages.tenants.formDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tenant-name">{t('common.name')}</Label>
              <Input id="tenant-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            {!editingTenant ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="manager-name">{t('superAdmin.pages.tenants.managerName')}</Label>
                  <Input id="manager-name" value={form.manager_name} onChange={(event) => setForm((current) => ({ ...current, manager_name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager-email">{t('common.email')}</Label>
                  <Input id="manager-email" type="email" value={form.manager_email} onChange={(event) => setForm((current) => ({ ...current, manager_email: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager-password">{t('common.password')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="manager-password"
                      type={showManagerPassword ? 'text' : 'password'}
                      value={form.manager_password}
                      onChange={(event) => setForm((current) => ({ ...current, manager_password: event.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowManagerPassword((current) => !current)}
                      aria-label={showManagerPassword ? t('common.hide') : t('common.show')}
                    >
                      {showManagerPassword ? t('common.hide') : t('common.show')}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="tenant-status">{t('common.status')}</Label>
              <select
                id="tenant-status"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as typeof current.status }))}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="active">{t('common.active')}</option>
                <option value="suspended">{t('common.suspended')}</option>
                <option value="inactive">{t('common.inactive')}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!editingTenant && form.manager_password.trim().length < 8) {
                  toast.error(t('superAdmin.pages.tenants.passwordMin', { defaultValue: 'Password must be at least 8 characters.' }))
                  return
                }
                saveMutation.mutate()
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('superAdmin.pages.tenants.statsTitle')}</DialogTitle>
            <DialogDescription>{t('superAdmin.pages.tenants.description')}</DialogDescription>
          </DialogHeader>
          {tenantStatsQuery.isLoading ? (
            <LoadingSpinner fullPage label={t('common.loading')} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('common.users')}</CardTitle>
                </CardHeader>
                <CardContent>{tenantStatsQuery.data?.data.users ?? 0}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('superAdmin.pages.tenants.managers')}</CardTitle>
                </CardHeader>
                <CardContent>{tenantStatsQuery.data?.data.managers ?? 0}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('superAdmin.pages.tenants.resellers')}</CardTitle>
                </CardHeader>
                <CardContent>{tenantStatsQuery.data?.data.resellers ?? 0}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('superAdmin.pages.tenants.customers')}</CardTitle>
                </CardHeader>
                <CardContent>{tenantStatsQuery.data?.data.customers ?? 0}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('common.revenue')}</CardTitle>
                </CardHeader>
                <CardContent>{formatCurrency(tenantStatsQuery.data?.data.revenue ?? 0, 'USD', locale)}</CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('superAdmin.pages.tenants.deleteTitle')}
        description={deleteTarget ? `${deleteTarget.name} • ${formatDate(deleteTarget.created_at ?? new Date(), locale)}` : ''}
        confirmLabel={t('common.delete')}
        isDestructive
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id)
          }
        }}
      />

      {/* Reset Tenant Dialog */}
      <Dialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null)
            setResetConfirmName('')
            setResetLabel('')
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-orange-600 dark:text-orange-400">{t('superAdmin.pages.tenants.resetTenantData', { defaultValue: 'Reset Tenant Data' })}</DialogTitle>
            <DialogDescription>
              This will permanently delete all customers, licenses, BIOS logs, and activity data for{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{resetTarget?.name}</span>. A backup will be created first so you can restore later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900/50 dark:bg-orange-950/20">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">What will be deleted:</p>
              <ul className="mt-1 list-inside list-disc text-sm text-orange-700 dark:text-orange-400">
                <li>All customers (users with role: customer)</li>
                <li>All licenses and BIOS access logs</li>
                <li>All activity logs and API logs</li>
                <li>All reseller commissions and financial reports</li>
              </ul>
              <p className="mt-2 text-sm text-orange-700 dark:text-orange-400">Managers and resellers are <strong>NOT</strong> deleted.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-label">{t('superAdmin.pages.tenants.backupLabelOptional', { defaultValue: 'Backup Label (optional)' })}</Label>
              <Input
                id="reset-label"
                placeholder="e.g. Before Q1 2026 reset"
                value={resetLabel}
                onChange={(e) => setResetLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-confirm">
                {t('superAdmin.pages.tenants.typeToConfirm', { defaultValue: 'Type' })} <span className="font-mono font-semibold text-slate-900 dark:text-white">{resetTarget?.name}</span> {t('superAdmin.pages.tenants.toConfirm', { defaultValue: 'to confirm' })}
              </Label>
              <Input
                id="reset-confirm"
                placeholder={resetTarget?.name ?? ''}
                value={resetConfirmName}
                onChange={(e) => setResetConfirmName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setResetTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={resetConfirmName !== resetTarget?.name || resetMutation.isPending}
              onClick={() => resetMutation.mutate()}
            >
              {resetMutation.isPending ? t('superAdmin.pages.tenants.resetting', { defaultValue: 'Resetting...' }) : t('superAdmin.pages.tenants.resetTenant', { defaultValue: 'Reset Tenant' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backups List Dialog */}
      <Dialog
        open={backupsTarget !== null && restoreTarget === null && deleteBackupTarget === null}
        onOpenChange={(open) => {
          if (!open) {
            setBackupsTarget(null)
            setImportLabel('')
            if (fileInputRef.current) fileInputRef.current.value = ''
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('superAdmin.pages.tenants.backupsTitle', { defaultValue: 'Backups' })} - {backupsTarget?.name}</DialogTitle>
            <DialogDescription>{t('superAdmin.pages.tenants.backupsDescription', { defaultValue: 'Restore, download, or import backups. Downloaded files can be imported on any server.' })}</DialogDescription>
          </DialogHeader>

          {/* Import section */}
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('superAdmin.pages.tenants.importBackupFile', { defaultValue: 'Import backup file' })}</p>
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('superAdmin.pages.tenants.labelOptional', { defaultValue: 'Label (optional)' })}
                value={importLabel}
                onChange={(e) => setImportLabel(e.target.value)}
                className="max-w-[180px]"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileImport}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={importMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="me-1.5 h-3.5 w-3.5" />
                {importMutation.isPending ? t('superAdmin.pages.tenants.importing', { defaultValue: 'Importing...' }) : t('superAdmin.pages.tenants.chooseFile', { defaultValue: 'Choose file' })}
              </Button>
            </div>
            <p className="mt-1.5 text-sm text-slate-400">{t('superAdmin.pages.tenants.importBackupHint', { defaultValue: 'Accepts .json exported from this or another server. Backup is stored without restoring - use Restore to apply it.' })}</p>
          </div>

          {backupsQuery.isLoading ? (
            <LoadingSpinner fullPage={false} label={t('superAdmin.pages.tenants.loadingBackups', { defaultValue: 'Loading backups...' })} />
          ) : backupsQuery.data?.data.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">{t('superAdmin.pages.tenants.noBackupsYet', { defaultValue: 'No backups yet. Reset the tenant to create a backup first, or import a file above.' })}</p>
          ) : (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {backupsQuery.data?.data.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {backup.label ?? formatDate(backup.created_at ?? new Date(), locale)}
                      </p>
                      {backup.label ? (
                        <span className="text-sm text-slate-400">{formatDate(backup.created_at ?? new Date(), locale)}</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {t('common.addedBy')} {backup.created_by?.name ?? t('common.unknown')} •{' '}
                      {backup.stats.customers} customers, {backup.stats.licenses} licenses
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {Object.entries(backup.stats)
                        .filter(([, v]) => v > 0)
                        .map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          >
                            {k.replace(/_/g, ' ')}: {v}
                          </span>
                        ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRestoreTarget(backup)
                        setRestoreConfirmName('')
                      }}
                    >
                      <RotateCcw className="me-1 h-3.5 w-3.5" />
                      {t('superAdmin.pages.tenants.restoreAction', { defaultValue: 'Restore' })}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(backup)}
                    >
                      <Download className="me-1 h-3.5 w-3.5" />
                      {t('superAdmin.pages.tenants.downloadAction', { defaultValue: 'Download' })}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/20"
                      onClick={() => setDeleteBackupTarget(backup)}
                    >
                      <Trash2 className="me-1 h-3.5 w-3.5" />
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setBackupsTarget(null)}>
              {t('common.closeDialog')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirm Dialog */}
      <Dialog
        open={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRestoreTarget(null)
            setRestoreConfirmName('')
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sky-600 dark:text-sky-400">{t('superAdmin.pages.tenants.restoreBackupTitle', { defaultValue: 'Restore Backup' })}</DialogTitle>
            <DialogDescription>
              {t('superAdmin.pages.tenants.restoreBackupIntro', { defaultValue: 'This will replace all current tenant operational data with the backup from' })}{' '}
              <span className="font-semibold">{restoreTarget ? formatDate(restoreTarget.created_at ?? new Date(), locale) : ''}</span>.
              {' '}{t('superAdmin.pages.tenants.restoreBackupWarning', { defaultValue: 'Current data will be wiped before restoring.' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {restoreTarget ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
                <p className="text-sm font-medium text-sky-800 dark:text-sky-300">{t('superAdmin.pages.tenants.backupContains', { defaultValue: 'This backup contains:' })}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {Object.entries(restoreTarget.stats)
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => (
                      <span key={k} className="rounded bg-sky-100 px-1.5 py-0.5 text-sm text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                        {k.replace(/_/g, ' ')}: {v}
                      </span>
                    ))}
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="restore-confirm">
                {t('superAdmin.pages.tenants.typeToConfirm', { defaultValue: 'Type' })} <span className="font-mono font-semibold text-slate-900 dark:text-white">{backupsTarget?.name}</span> {t('superAdmin.pages.tenants.toConfirm', { defaultValue: 'to confirm' })}
              </Label>
              <Input
                id="restore-confirm"
                placeholder={backupsTarget?.name ?? ''}
                value={restoreConfirmName}
                onChange={(e) => setRestoreConfirmName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRestoreTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={restoreConfirmName !== backupsTarget?.name || restoreMutation.isPending}
              onClick={() => restoreMutation.mutate()}
            >
              {restoreMutation.isPending ? t('superAdmin.pages.tenants.restoring', { defaultValue: 'Restoring...' }) : t('superAdmin.pages.tenants.restoreBackupTitle', { defaultValue: 'Restore Backup' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Backup Confirm */}
      <ConfirmDialog
        open={deleteBackupTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteBackupTarget(null)
        }}
        title={t('superAdmin.pages.tenants.deleteBackupTitle', { defaultValue: 'Delete Backup' })}
        description={deleteBackupTarget ? t('superAdmin.pages.tenants.deleteBackupDescription', { defaultValue: 'Delete backup from {{date}}? This cannot be undone.', date: formatDate(deleteBackupTarget.created_at ?? new Date(), locale) }) : ''}
        confirmLabel={t('common.delete')}
        isDestructive
        onConfirm={() => {
          if (deleteBackupTarget) deleteBackupMutation.mutate(deleteBackupTarget)
        }}
      />

      {/* Create Backup Dialog */}
      <Dialog
        open={createBackupTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateBackupTarget(null)
            setBackupName('')
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('superAdmin.pages.tenants.createBackupTitle', { defaultValue: 'Create Backup' })}</DialogTitle>
            <DialogDescription>
              {t('superAdmin.pages.tenants.createBackupDescription', { defaultValue: 'Create a new backup of {{tenantName}} tenant.', tenantName: createBackupTarget?.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="backup-name">{t('superAdmin.pages.tenants.backupNameLabel', { defaultValue: 'Backup Name (Optional)' })}</Label>
              <Input
                id="backup-name"
                value={backupName}
                onChange={(e) => setBackupName(e.target.value)}
                placeholder={t('superAdmin.pages.tenants.backupNamePlaceholder', { defaultValue: 'e.g. Pre-Update Backup' })}
                maxLength={100}
                disabled={createBackupMutation.isPending}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('superAdmin.pages.tenants.backupNameHint', { defaultValue: 'Add a descriptive name to identify this backup later.' })}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateBackupTarget(null)
                setBackupName('')
              }}
              disabled={createBackupMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => createBackupMutation.mutate()}
              disabled={createBackupMutation.isPending}
            >
              {createBackupMutation.isPending && <span className="me-2">⏳</span>}
              {t('superAdmin.pages.tenants.createBackupButton', { defaultValue: 'Create Backup' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
