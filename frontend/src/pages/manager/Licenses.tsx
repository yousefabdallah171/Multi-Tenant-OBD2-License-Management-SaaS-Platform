import { useMemo, useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Eye, MoreVertical, Pause, Play, RotateCw, ShieldOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { licenseService } from '@/services/license.service'
import { managerService } from '@/services/manager.service'
import type { DurationUnit, LicenseSummary } from '@/types/manager-reseller.types'

const STATUS_OPTIONS = ['all', 'active', 'expired', 'cancelled', 'pending'] as const

export function LicensesPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all')
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const [detailLicenseId, setDetailLicenseId] = useState<number | null>(null)
  const [renewTargetId, setRenewTargetId] = useState<number | null>(null)
  const [renewDuration, setRenewDuration] = useState('30')
  const [renewUnit, setRenewUnit] = useState<DurationUnit>('days')
  const [renewPrice, setRenewPrice] = useState('0')

  const [bulkRenewOpen, setBulkRenewOpen] = useState(false)
  const [bulkDuration, setBulkDuration] = useState('30')
  const [bulkUnit, setBulkUnit] = useState<DurationUnit>('days')
  const [bulkPrice, setBulkPrice] = useState('0')

  const [bulkDeactivateOpen, setBulkDeactivateOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<LicenseSummary | null>(null)
  const [pauseTarget, setPauseTarget] = useState<LicenseSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LicenseSummary | null>(null)

  const licensesQuery = useQuery({
    queryKey: ['manager', 'licenses', page, perPage, search, status],
    queryFn: () => managerService.getLicenses({ page, per_page: perPage, search, status: status === 'all' ? '' : status }),
  })

  const expiringQuery = useQuery({
    queryKey: ['manager', 'licenses', 'expiring'],
    queryFn: () => managerService.getLicensesExpiring(),
  })

  const detailQuery = useQuery({
    queryKey: ['manager', 'licenses', 'detail', detailLicenseId],
    queryFn: () => licenseService.getById(detailLicenseId ?? 0),
    enabled: detailLicenseId !== null,
  })

  const renewMutation = useMutation({
    mutationFn: () => licenseService.renew(renewTargetId ?? 0, { duration_days: durationToDays(Number(renewDuration), renewUnit), price: Number(renewPrice) }),
    onSuccess: () => {
      toast.success(t('common.saved'))
      setRenewTargetId(null)
      invalidate(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('common.error'))),
  })

  const deactivateMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.deactivate(licenseId),
    onSuccess: () => {
      toast.success(t('common.saved'))
      setDeactivateTarget(null)
      invalidate(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('common.error'))),
  })

  const pauseMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.pause(licenseId),
    onSuccess: () => {
      toast.success(t('common.pauseSuccess'))
      setPauseTarget(null)
      invalidate(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('common.error'))),
  })

  const resumeMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.resume(licenseId),
    onSuccess: () => {
      toast.success(t('common.resumeSuccess'))
      invalidate(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('common.error'))),
  })

  const deleteMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.delete(licenseId),
    onSuccess: () => {
      toast.success(t('common.saved'))
      setDeleteTarget(null)
      invalidate(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('common.error'))),
  })

  const bulkRenewMutation = useMutation({
    mutationFn: () => licenseService.bulkRenew(selectedIds, { duration_days: durationToDays(Number(bulkDuration), bulkUnit), price: Number(bulkPrice) }),
    onSuccess: () => {
      toast.success(t('reseller.pages.licenses.toasts.bulkRenewed'))
      setBulkRenewOpen(false)
      setSelectedIds([])
      invalidate(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('common.error'))),
  })

  const bulkDeactivateMutation = useMutation({
    mutationFn: () => licenseService.bulkDeactivate(selectedIds),
    onSuccess: () => {
      toast.success(t('reseller.pages.licenses.toasts.bulkDeactivated'))
      setBulkDeactivateOpen(false)
      setSelectedIds([])
      invalidate(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('common.error'))),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: () => licenseService.bulkDelete(selectedIds),
    onSuccess: (response) => {
      if ((response.count ?? 0) <= 0) {
        toast.error(t('common.error', { defaultValue: 'No deletable licenses selected.' }))
      } else {
        toast.success(t('common.bulkDeleteSuccess', { defaultValue: 'Selected licenses deleted successfully.' }))
      }
      setBulkDeleteOpen(false)
      setSelectedIds([])
      invalidate(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('common.error'))),
  })

  const rows = licensesQuery.data?.data ?? []
  const visibleIds = rows.map((row) => row.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))
  const someVisibleSelected = visibleIds.some((id) => selectedIds.includes(id))
  const expiring = expiringQuery.data?.data ?? { day1: 0, day3: 0, day7: 0 }

  const columns = useMemo<Array<DataTableColumn<LicenseSummary>>>(
    () => [
      {
        key: 'select',
        label: (
          <input
            type="checkbox"
            checked={allVisibleSelected}
            ref={(element) => {
              if (element) {
                element.indeterminate = !allVisibleSelected && someVisibleSelected
              }
            }}
            onChange={(event) => {
              if (event.target.checked) {
                setSelectedIds((current) => [...new Set([...current, ...visibleIds])])
                return
              }
              setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)))
            }}
          />
        ),
        render: (row) => (
          <input
            type="checkbox"
            checked={selectedIds.includes(row.id)}
            onChange={(event) => {
              if (event.target.checked) {
                setSelectedIds((current) => [...new Set([...current, row.id])])
                return
              }
              setSelectedIds((current) => current.filter((id) => id !== row.id))
            }}
          />
        ),
      },
      {
        key: 'customer',
        label: t('common.customer'),
        sortable: true,
        sortValue: (row) => row.customer_name ?? '',
        render: (row) => row.customer_id ? (
          <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.manager.customerDetail(lang, row.customer_id)}>
            {row.customer_name ?? '-'} ({row.customer_email ?? '-'})
          </Link>
        ) : `${row.customer_name ?? '-'} (${row.customer_email ?? '-'})`,
      },
      {
        key: 'bios',
        label: t('activate.biosId'),
        sortable: true,
        sortValue: (row) => row.bios_id,
        render: (row) => row.customer_id ? (
          <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.manager.customerDetail(lang, row.customer_id)}>
            {row.bios_id}
          </Link>
        ) : row.bios_id,
      },
      { key: 'program', label: t('common.program'), sortable: true, sortValue: (row) => row.program ?? '', render: (row) => row.program ?? '-' },
      { key: 'duration', label: t('common.duration'), sortable: true, sortValue: (row) => row.duration_days, render: (row) => `${row.duration_days} ${t('common.days')}` },
      { key: 'price', label: t('common.price'), sortable: true, sortValue: (row) => row.price, render: (row) => formatCurrency(row.price, 'USD', locale) },
      { key: 'expires', label: t('common.expiry'), sortable: true, sortValue: (row) => row.expires_at ?? '', render: (row) => (row.expires_at ? formatDate(row.expires_at, locale) : '-') },
      { key: 'status', label: t('common.status'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
      {
        key: 'actions',
        label: t('common.actions'),
        render: (row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDetailLicenseId(row.id)}>
                <Eye className="me-2 h-4 w-4" />
                {t('common.view')}
              </DropdownMenuItem>
              {row.status === 'pending' || row.status === 'cancelled' ? (
                <DropdownMenuItem onClick={() => resumeMutation.mutate(row.id)} disabled={resumeMutation.isPending}>
                  <Play className="me-2 h-4 w-4" />
                  {row.status === 'cancelled' ? t('common.reactivate') : t('common.resume')}
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => { setRenewTargetId(row.id); setRenewPrice(String(row.price)) }}>
                    <RotateCw className="me-2 h-4 w-4" />
                    {t('common.renew')}
                  </DropdownMenuItem>
                  {row.status === 'active' ? (
                    <DropdownMenuItem onClick={() => setPauseTarget(row)}>
                      <Pause className="me-2 h-4 w-4" />
                      {t('common.pause')}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onClick={() => setDeactivateTarget(row)}>
                    <ShieldOff className="me-2 h-4 w-4" />
                    {t('common.deactivate')}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => setDeleteTarget(row)}>
                <Trash2 className="me-2 h-4 w-4" />
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [allVisibleSelected, lang, locale, selectedIds, someVisibleSelected, t, visibleIds, resumeMutation.isPending],
  )

  return (
    <div className="space-y-6">
      <PageHeader title={t('manager.pages.licenses.title', { defaultValue: 'Licenses' })} description={t('manager.pages.licenses.description', { defaultValue: 'Manage team licenses.' })} />

      <div className="grid gap-3 md:grid-cols-3">
        <ExpiryAlert label={t('reseller.pages.licenses.expiryLabels.day1')} value={expiring.day1} tone="rose" />
        <ExpiryAlert label={t('reseller.pages.licenses.expiryLabels.day3')} value={expiring.day3} tone="amber" />
        <ExpiryAlert label={t('reseller.pages.licenses.expiryLabels.day7')} value={expiring.day7} tone="yellow" />
      </div>

      <Tabs value={status} onValueChange={(value) => { setStatus(value as (typeof STATUS_OPTIONS)[number]); setPage(1); setSelectedIds([]) }}>
        <TabsList>
          {STATUS_OPTIONS.map((option) => (
            <TabsTrigger key={option} value={option}>{option === 'all' ? t('common.all') : t(`common.${option}`)}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={status} className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)]">
              <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder={t('reseller.pages.licenses.searchPlaceholder')} />
            </CardContent>
          </Card>

          {selectedIds.length > 0 ? (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="text-sm text-slate-600 dark:text-slate-300">{selectedIds.length} {t('common.selected', { defaultValue: 'selected' })}</span>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => setBulkRenewOpen(true)}>{t('reseller.pages.licenses.bulkRenew')}</Button>
                  <Button type="button" variant="secondary" onClick={() => setBulkDeactivateOpen(true)}>{t('reseller.pages.licenses.bulkDeactivate')}</Button>
                  <Button type="button" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>{t('common.deleteSelected', { defaultValue: 'Delete Selected' })}</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <DataTable
            columns={columns}
            data={rows}
            rowKey={(row) => row.id}
            isLoading={licensesQuery.isLoading}
            pagination={{
              page: licensesQuery.data?.meta.current_page ?? 1,
              lastPage: licensesQuery.data?.meta.last_page ?? 1,
              total: licensesQuery.data?.meta.total ?? 0,
              perPage: licensesQuery.data?.meta.per_page ?? perPage,
            }}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPerPage(size); setPage(1) }}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={detailLicenseId !== null} onOpenChange={(open) => !open && setDetailLicenseId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailQuery.data?.data.program ?? t('common.details')}</DialogTitle>
            <DialogDescription>{detailQuery.data?.data.bios_id}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog open={renewTargetId !== null} onOpenChange={(open) => !open && setRenewTargetId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.renew')}</DialogTitle>
            <DialogDescription>{t('reseller.pages.licenses.renewDialog.fallback')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label={t('common.duration')} htmlFor="renew-duration"><Input id="renew-duration" type="number" min={1} value={renewDuration} onChange={(event) => setRenewDuration(event.target.value)} /></Field>
            <Field label={t('common.unit')} htmlFor="renew-unit">
              <select id="renew-unit" value={renewUnit} onChange={(event) => setRenewUnit(event.target.value as DurationUnit)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="days">{t('common.days')}</option>
                <option value="months">{t('common.months')}</option>
                <option value="years">{t('common.years')}</option>
              </select>
            </Field>
            <Field label={t('common.price')} htmlFor="renew-price"><Input id="renew-price" type="number" min={0} step="0.01" value={renewPrice} onChange={(event) => setRenewPrice(event.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRenewTargetId(null)}>{t('common.cancel')}</Button>
            <Button type="button" onClick={() => renewMutation.mutate()} disabled={renewMutation.isPending}>{renewMutation.isPending ? t('common.loading') : t('common.renew')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkRenewOpen} onOpenChange={setBulkRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reseller.pages.licenses.bulkRenew')}</DialogTitle>
            <DialogDescription>{t('reseller.pages.licenses.bulkRenewDialog.description', { count: selectedIds.length })}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label={t('common.duration')} htmlFor="bulk-duration"><Input id="bulk-duration" type="number" min={1} value={bulkDuration} onChange={(event) => setBulkDuration(event.target.value)} /></Field>
            <Field label={t('common.unit')} htmlFor="bulk-unit">
              <select id="bulk-unit" value={bulkUnit} onChange={(event) => setBulkUnit(event.target.value as DurationUnit)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="days">{t('common.days')}</option>
                <option value="months">{t('common.months')}</option>
                <option value="years">{t('common.years')}</option>
              </select>
            </Field>
            <Field label={t('common.price')} htmlFor="bulk-price"><Input id="bulk-price" type="number" min={0} step="0.01" value={bulkPrice} onChange={(event) => setBulkPrice(event.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setBulkRenewOpen(false)}>{t('common.cancel')}</Button>
            <Button type="button" onClick={() => bulkRenewMutation.mutate()} disabled={bulkRenewMutation.isPending}>{t('reseller.pages.licenses.bulkRenew')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={bulkDeactivateOpen} onOpenChange={setBulkDeactivateOpen} title={t('reseller.pages.licenses.confirm.bulkDeactivateTitle')} description={t('reseller.pages.licenses.confirm.bulkDeactivateDescription', { count: selectedIds.length })} confirmLabel={t('reseller.pages.licenses.confirm.deactivateSelected')} isDestructive onConfirm={() => bulkDeactivateMutation.mutate()} />
      <ConfirmDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen} title={t('common.bulkDelete', { defaultValue: 'Bulk Delete' })} description={t('reseller.pages.licenses.confirm.bulkDeleteDescription', { count: selectedIds.length, defaultValue: 'Delete selected licenses?' })} confirmLabel={t('common.deleteSelected', { defaultValue: 'Delete Selected' })} isDestructive onConfirm={() => bulkDeleteMutation.mutate()} />
      <ConfirmDialog open={deactivateTarget !== null} onOpenChange={(open) => { if (!open) setDeactivateTarget(null) }} title={t('reseller.pages.licenses.confirm.deactivateTitle')} description={deactivateTarget ? t('reseller.pages.licenses.confirm.deactivateDescription', { biosId: deactivateTarget.bios_id }) : undefined} confirmLabel={t('common.deactivate')} isDestructive onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)} />
      <ConfirmDialog open={pauseTarget !== null} onOpenChange={(open) => { if (!open) setPauseTarget(null) }} title={t('reseller.pages.licenses.confirm.pauseTitle')} description={pauseTarget ? t('reseller.pages.licenses.confirm.pauseDescription', { biosId: pauseTarget.bios_id }) : undefined} confirmLabel={t('common.pause')} onConfirm={() => pauseTarget && pauseMutation.mutate(pauseTarget.id)} />
      <ConfirmDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }} title={t('common.delete')} description={deleteTarget ? `${deleteTarget.customer_name ?? '-'} ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ${deleteTarget.bios_id}` : undefined} confirmLabel={t('common.delete')} isDestructive onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} />
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function durationToDays(value: number, unit: DurationUnit) {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (unit === 'months') return value * 30
  if (unit === 'years') return value * 365
  return value
}

function ExpiryAlert({ label, value, tone }: { label: string; value: number; tone: 'rose' | 'amber' | 'yellow' }) {
  const styles = {
    rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
    yellow: 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900/60 dark:bg-yellow-950/30 dark:text-yellow-300',
  } as const

  return (
    <div className={`rounded-3xl border px-4 py-4 ${styles[tone]}`}>
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5" />
        <div>
          <p className="text-xs uppercase tracking-wide">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </div>
    </div>
  )
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: ['manager', 'licenses'] }),
    queryClient.invalidateQueries({ queryKey: ['manager', 'customers'] }),
  ])
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined)?.message
      ?? Object.values((error.response?.data as { errors?: Record<string, string[]> } | undefined)?.errors ?? {})[0]?.[0]
      ?? fallback
  }
  return fallback
}
