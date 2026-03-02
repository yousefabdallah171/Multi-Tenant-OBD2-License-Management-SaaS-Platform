import { useMemo, useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, RotateCw, ShieldOff, Trash2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { licenseService } from '@/services/license.service'
import { managerParentService } from '@/services/manager-parent.service'
import { teamService } from '@/services/team.service'
import type { DurationUnit, LicenseSummary } from '@/types/manager-reseller.types'

const STATUS_OPTIONS = ['all', 'active', 'expired', 'suspended', 'pending'] as const

export function LicensesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all')
  const [resellerId, setResellerId] = useState<number | ''>('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [detailLicenseId, setDetailLicenseId] = useState<number | null>(null)
  const [renewTargetId, setRenewTargetId] = useState<number | null>(null)
  const [renewDuration, setRenewDuration] = useState('30')
  const [renewUnit, setRenewUnit] = useState<DurationUnit>('days')
  const [renewPrice, setRenewPrice] = useState('0')
  const [deactivateTarget, setDeactivateTarget] = useState<LicenseSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LicenseSummary | null>(null)

  const licensesQuery = useQuery({
    queryKey: ['manager-parent', 'licenses', page, perPage, search, status, resellerId],
    queryFn: () =>
      managerParentService.getLicenses({
        page,
        per_page: perPage,
        search,
        reseller_id: resellerId,
        status: status === 'all' ? '' : status,
      }),
  })

  const resellerQuery = useQuery({
    queryKey: ['manager-parent', 'licenses', 'resellers'],
    queryFn: () => teamService.getAll({ role: 'reseller', per_page: 100 }),
  })

  const expiringQuery = useQuery({
    queryKey: ['manager-parent', 'licenses', 'expiring'],
    queryFn: () => managerParentService.getLicensesExpiring(),
  })

  const detailQuery = useQuery({
    queryKey: ['manager-parent', 'licenses', 'detail', detailLicenseId],
    queryFn: () => licenseService.getById(detailLicenseId ?? 0),
    enabled: detailLicenseId !== null,
  })

  const renewMutation = useMutation({
    mutationFn: () =>
      licenseService.renew(renewTargetId ?? 0, {
        duration_days: durationToDays(Number(renewDuration), renewUnit),
        price: Number(renewPrice),
      }),
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

  const bulkRenewMutation = useMutation({
    mutationFn: () =>
      licenseService.bulkRenew(selectedIds, {
        duration_days: durationToDays(Number(renewDuration), renewUnit),
        price: Number(renewPrice),
      }),
    onSuccess: () => {
      setSelectedIds([])
      invalidate(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('common.error'))),
  })

  const bulkDeactivateMutation = useMutation({
    mutationFn: () => licenseService.bulkDeactivate(selectedIds),
    onSuccess: () => {
      setSelectedIds([])
      invalidate(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('common.error'))),
  })

  const deleteMutation = useMutation({
    mutationFn: (licenseId: number) => managerParentService.deleteLicense(licenseId),
    onSuccess: (response) => {
      toast.success(response.message ?? t('common.saved'))
      setDeleteTarget(null)
      invalidate(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('common.error'))),
  })

  const rows = licensesQuery.data?.data ?? []
  const visibleIds = rows.map((row) => row.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))
  const expiring = expiringQuery.data?.data ?? { day1: 0, day3: 0, day7: 0 }

  const columns = useMemo<Array<DataTableColumn<LicenseSummary>>>(() => [
    {
      key: 'select',
      label: t('common.select'),
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
        <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.customerDetail(lang, row.customer_id)}>
          {row.customer_name ?? '-'} ({row.customer_email ?? '-'})
        </Link>
      ) : `${row.customer_name ?? '-'} (${row.customer_email ?? '-'})`,
    },
    { key: 'bios', label: t('activate.biosId'), sortable: true, sortValue: (row) => row.bios_id, render: (row) => row.bios_id },
    { key: 'program', label: t('common.program'), sortable: true, sortValue: (row) => row.program ?? '', render: (row) => row.program ?? '-' },
    { key: 'duration', label: t('common.duration'), sortable: true, sortValue: (row) => row.duration_days, render: (row) => `${row.duration_days} ${t('common.days')}` },
    { key: 'price', label: t('common.price'), sortable: true, sortValue: (row) => row.price, render: (row) => formatCurrency(row.price, 'USD', locale) },
    { key: 'expires', label: t('common.expiry'), sortable: true, sortValue: (row) => row.expires_at ?? '', render: (row) => (row.expires_at ? formatDate(row.expires_at, locale) : '-') },
    { key: 'status', label: t('common.status'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setDetailLicenseId(row.id)}>
            <Eye className="me-1 h-4 w-4" />
            {t('common.view')}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setRenewTargetId(row.id); setRenewPrice(String(row.price)) }}>
            <RotateCw className="me-1 h-4 w-4" />
            {t('common.renew')}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setDeactivateTarget(row)}>
            <ShieldOff className="me-1 h-4 w-4" />
            {t('common.deactivate')}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setDeleteTarget(row)} disabled={row.status === 'active'}>
            <Trash2 className="me-1 h-4 w-4" />
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ], [lang, locale, selectedIds, t])

  return (
    <div className="space-y-6">
      <PageHeader title={t('managerParent.pages.licenses.title', { defaultValue: 'Licenses' })} description={t('managerParent.pages.licenses.description', { defaultValue: 'Manage tenant licenses.' })} />

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label={t('reseller.pages.licenses.expiryLabels.day1')} value={expiring.day1} />
        <StatCard label={t('reseller.pages.licenses.expiryLabels.day3')} value={expiring.day3} />
        <StatCard label={t('reseller.pages.licenses.expiryLabels.day7')} value={expiring.day7} />
      </div>

      <Tabs value={status} onValueChange={(value) => setStatus(value as (typeof STATUS_OPTIONS)[number])}>
        <TabsList>
          {STATUS_OPTIONS.map((option) => (
            <TabsTrigger key={option} value={option}>{option === 'all' ? t('common.all') : t(`common.${option}`)}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={status} className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px_auto_auto_auto]">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('reseller.pages.licenses.searchPlaceholder')} />
              <select value={resellerId} onChange={(event) => setResellerId(event.target.value ? Number(event.target.value) : '')} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="">{t('managerParent.pages.customers.allResellers')}</option>
                {(resellerQuery.data?.data ?? []).map((reseller) => (
                  <option key={reseller.id} value={reseller.id}>{reseller.name}</option>
                ))}
              </select>
              <Button type="button" variant="ghost" onClick={() => setSelectedIds(allVisibleSelected ? [] : visibleIds)}>
                {allVisibleSelected ? t('common.clearVisible') : t('common.selectAllVisible')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => bulkRenewMutation.mutate()} disabled={selectedIds.length === 0 || bulkRenewMutation.isPending}>
                {t('reseller.pages.licenses.bulkRenew')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => bulkDeactivateMutation.mutate()} disabled={selectedIds.length === 0 || bulkDeactivateMutation.isPending}>
                {t('reseller.pages.licenses.bulkDeactivate')}
              </Button>
            </CardContent>
          </Card>
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
            onPageSizeChange={(size) => {
              setPerPage(size)
              setPage(1)
            }}
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
            <Input type="number" min={1} value={renewDuration} onChange={(event) => setRenewDuration(event.target.value)} />
            <select value={renewUnit} onChange={(event) => setRenewUnit(event.target.value as DurationUnit)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="days">{t('common.days')}</option>
              <option value="months">{t('common.months')}</option>
              <option value="years">{t('common.years')}</option>
            </select>
            <Input type="number" min={0} step="0.01" value={renewPrice} onChange={(event) => setRenewPrice(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRenewTargetId(null)}>{t('common.cancel')}</Button>
            <Button type="button" onClick={() => renewMutation.mutate()} disabled={renewMutation.isPending}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateTarget(null)
          }
        }}
        title={t('common.deactivate')}
        description={deactivateTarget?.bios_id}
        confirmLabel={t('common.deactivate')}
        isDestructive
        onConfirm={() => {
          if (deactivateTarget) {
            deactivateMutation.mutate(deactivateTarget.id)
          }
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('common.delete')}
        description={deleteTarget ? `${deleteTarget.customer_name ?? '-'} • ${deleteTarget.bios_id}` : undefined}
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-2 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

function durationToDays(value: number, unit: DurationUnit) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }
  if (unit === 'months') {
    return value * 30
  }
  if (unit === 'years') {
    return value * 365
  }
  return value
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: ['manager-parent', 'licenses'] }),
    queryClient.invalidateQueries({ queryKey: ['manager-parent', 'customers'] }),
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
