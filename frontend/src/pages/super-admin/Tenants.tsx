import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, MoreHorizontal, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
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
import type { TenantSummary } from '@/types/super-admin.types'

const emptyTenantForm = {
  name: '',
  manager_name: '',
  manager_email: '',
  manager_password: '',
  status: 'active' as 'active' | 'suspended' | 'inactive',
}

const statusTabs: Array<{ value: '' | 'active' | 'suspended' | 'inactive'; labelKey: string }> = [
  { value: '', labelKey: 'common.all' },
  { value: 'active', labelKey: 'common.active' },
  { value: 'suspended', labelKey: 'common.suspended' },
  { value: 'inactive', labelKey: 'common.inactive' },
]

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

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'tenants', page, perPage, status, search],
    queryFn: () => tenantService.getAll({ page, status, search, per_page: perPage }),
  })

  const tenantStatsQuery = useQuery({
    queryKey: ['super-admin', 'tenant-stats', selectedTenantId],
    queryFn: () => tenantService.getStats(selectedTenantId as number),
    enabled: selectedTenantId !== null && statsOpen,
  })

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

  const columns = useMemo<Array<DataTableColumn<TenantSummary>>>(
    () => [
      {
        key: 'name',
        label: t('common.name'),
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <div>
            <div className="font-medium text-slate-950 dark:text-white">{row.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{row.slug}</div>
          </div>
        ),
      },
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
                onSelect={() => {
                  setSelectedTenantId(row.id)
                  setStatsOpen(true)
                }}
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
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('common.status')}>
            {statusTabs.map((tab) => (
              <Button
                key={tab.value || 'all'}
                type="button"
                size="sm"
                variant={status === tab.value ? 'default' : 'secondary'}
                onClick={() => {
                  setStatus(tab.value)
                  setPage(1)
                }}
              >
                {t(tab.labelKey)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {tenantsQuery.isLoading ? (
        <DataTable columns={columns} data={[]} rowKey={(row) => row.id} isLoading />
      ) : (
        <DataTable
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
            <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
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
    </div>
  )
}
