import { useMemo, useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckSquare, Eye, RotateCw, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { licenseService } from '@/services/license.service'
import type { DurationUnit, LicenseSummary } from '@/types/manager-reseller.types'

const STATUS_OPTIONS = ['all', 'active', 'expired', 'suspended', 'pending'] as const

export function LicensesPage() {
  const queryClient = useQueryClient()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkAction, setBulkAction] = useState<'renew' | 'deactivate' | ''>('')
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
  const [deactivateTarget, setDeactivateTarget] = useState<LicenseSummary | null>(null)

  const licensesQuery = useQuery({
    queryKey: ['reseller', 'licenses', page, perPage, search, status],
    queryFn: () =>
      licenseService.getAll({
        page,
        per_page: perPage,
        search,
        status: status === 'all' ? '' : status,
      }),
  })

  const expiringQuery = useQuery({
    queryKey: ['reseller', 'licenses', 'expiring'],
    queryFn: () => licenseService.getExpiring(7),
  })

  const detailQuery = useQuery({
    queryKey: ['reseller', 'licenses', 'detail', detailLicenseId],
    queryFn: () => licenseService.getById(detailLicenseId ?? 0),
    enabled: detailLicenseId !== null,
  })

  const renewQuery = useQuery({
    queryKey: ['reseller', 'licenses', 'renew', renewTargetId],
    queryFn: () => licenseService.getById(renewTargetId ?? 0),
    enabled: renewTargetId !== null,
  })

  const renewMutation = useMutation({
    mutationFn: () =>
      licenseService.renew(renewTargetId ?? 0, {
        duration_days: durationToDays(Number(renewDuration), renewUnit),
        price: Number(renewPrice),
      }),
    onSuccess: () => {
      toast.success('License renewed successfully.')
      setRenewTargetId(null)
      invalidateLicenseQueries(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const deactivateMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.deactivate(licenseId),
    onSuccess: () => {
      toast.success('License deactivated successfully.')
      setDeactivateTarget(null)
      invalidateLicenseQueries(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const bulkRenewMutation = useMutation({
    mutationFn: () =>
      licenseService.bulkRenew(selectedIds, {
        duration_days: durationToDays(Number(bulkDuration), bulkUnit),
        price: Number(bulkPrice),
      }),
    onSuccess: () => {
      toast.success('Selected licenses renewed successfully.')
      setBulkRenewOpen(false)
      setSelectedIds([])
      invalidateLicenseQueries(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const bulkDeactivateMutation = useMutation({
    mutationFn: () => licenseService.bulkDeactivate(selectedIds),
    onSuccess: () => {
      toast.success('Selected licenses deactivated successfully.')
      setBulkDeactivateOpen(false)
      setSelectedIds([])
      invalidateLicenseQueries(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })

  const rows = licensesQuery.data?.data ?? []
  const visibleIds = rows.map((row) => row.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))
  const expiring = expiringQuery.data?.data ?? []
  const oneDay = expiring.filter((license) => daysUntil(license.expires_at) <= 1).length
  const threeDays = expiring.filter((license) => daysUntil(license.expires_at) <= 3).length
  const sevenDays = expiring.length

  const columns = useMemo<Array<DataTableColumn<LicenseSummary>>>(
    () => [
      {
        key: 'select',
        label: 'Select',
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
        label: 'Customer',
        sortable: true,
        sortValue: (row) => row.customer_name ?? '',
        render: (row) => (
          <div>
            <p className="font-medium text-slate-950 dark:text-white">{row.customer_name ?? '-'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.customer_email ?? '-'}</p>
          </div>
        ),
      },
      { key: 'bios', label: 'BIOS ID', sortable: true, sortValue: (row) => row.bios_id, render: (row) => row.bios_id },
      { key: 'program', label: 'Program', sortable: true, sortValue: (row) => row.program ?? '', render: (row) => row.program ?? '-' },
      { key: 'duration', label: 'Duration', sortable: true, sortValue: (row) => row.duration_days, render: (row) => `${row.duration_days} days` },
      { key: 'price', label: 'Price', sortable: true, sortValue: (row) => row.price, render: (row) => formatCurrency(row.price, 'USD', locale) },
      { key: 'activated', label: 'Activated', sortable: true, sortValue: (row) => row.activated_at ?? '', render: (row) => (row.activated_at ? formatDate(row.activated_at, locale) : '-') },
      { key: 'expires', label: 'Expires', sortable: true, sortValue: (row) => row.expires_at ?? '', render: (row) => (row.expires_at ? formatDate(row.expires_at, locale) : '-') },
      { key: 'status', label: 'Status', sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setDetailLicenseId(row.id)}>
              <Eye className="me-1 h-4 w-4" />
              View
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setRenewTargetId(row.id)
                setRenewDuration('30')
                setRenewUnit('days')
                setRenewPrice(String(row.price))
              }}
            >
              <RotateCw className="me-1 h-4 w-4" />
              Renew
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDeactivateTarget(row)}>
              <ShieldOff className="me-1 h-4 w-4" />
              Deactivate
            </Button>
          </div>
        ),
      },
    ],
    [locale, selectedIds],
  )

  const detailLicense = detailQuery.data?.data
  const renewLicense = renewQuery.data?.data

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Reseller" title="Licenses" description="Track all licenses you have activated, renew them in bulk, and act early on upcoming expirations." />

      <div className="grid gap-3 md:grid-cols-3">
        <ExpiryAlert count={oneDay} label="Expire in 1 day" tone="rose" />
        <ExpiryAlert count={threeDays} label="Expire in 3 days" tone="amber" />
        <ExpiryAlert count={sevenDays} label="Expire in 7 days" tone="yellow" />
      </div>

      <Tabs
        value={status}
        onValueChange={(value) => {
          setStatus(value as (typeof STATUS_OPTIONS)[number])
          setPage(1)
          setSelectedIds([])
        }}
      >
        <TabsList>
          {STATUS_OPTIONS.map((option) => (
            <TabsTrigger key={option} value={option}>
              {option === 'all' ? 'All' : option.charAt(0).toUpperCase() + option.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={status} className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_180px_140px_120px]">
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search by customer, BIOS ID, or program"
              />
              <select
                value={bulkAction}
                onChange={(event) => setBulkAction(event.target.value as 'renew' | 'deactivate' | '')}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Bulk action</option>
                <option value="renew">Renew Selected</option>
                <option value="deactivate">Deactivate Selected</option>
              </select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!bulkAction || selectedIds.length === 0) {
                    toast.error('Select licenses and a bulk action first.')
                    return
                  }

                  if (bulkAction === 'renew') {
                    setBulkRenewOpen(true)
                    return
                  }

                  setBulkDeactivateOpen(true)
                }}
              >
                Apply
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedIds(allVisibleSelected ? [] : visibleIds)}
              >
                <CheckSquare className="me-2 h-4 w-4" />
                {allVisibleSelected ? 'Clear' : 'Select'} Visible
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
        <DialogContent className="left-auto right-0 top-0 h-screen w-[min(100vw,44rem)] max-w-[44rem] translate-x-0 translate-y-0 overflow-y-auto rounded-none rounded-s-3xl">
          <DialogHeader>
            <DialogTitle>{detailLicense?.program ?? 'License detail'}</DialogTitle>
            <DialogDescription>{detailLicense ? `BIOS ID ${detailLicense.bios_id}` : 'Inspect the full license record.'}</DialogDescription>
          </DialogHeader>
          {detailLicense ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <InfoCard label="Customer" value={detailLicense.customer?.name ?? '-'} />
                <InfoCard label="Program" value={detailLicense.program ?? '-'} />
                <InfoCard label="Version" value={detailLicense.program_version ?? '-'} />
                <InfoCard label="Status" value={<StatusBadge status={detailLicense.status} />} />
              </div>

              <Card>
                <CardContent className="grid gap-4 p-4 md:grid-cols-2">
                  <InfoBlock label="BIOS ID" value={detailLicense.bios_id} />
                  <InfoBlock label="Duration" value={`${detailLicense.duration_days} days`} />
                  <InfoBlock label="Price" value={formatCurrency(detailLicense.price, 'USD', locale)} />
                  <InfoBlock label="Expires" value={detailLicense.expires_at ? formatDate(detailLicense.expires_at, locale) : '-'} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {detailLicense.activity.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-950 dark:text-white">{entry.action}</p>
                          {entry.description ? <p className="text-sm text-slate-500 dark:text-slate-400">{entry.description}</p> : null}
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {detailLicense.download_link ? (
                <Button type="button" variant="secondary" className="w-full" onClick={() => window.open(detailLicense.download_link ?? '', '_blank', 'noopener,noreferrer')}>
                  Open Download Link
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={renewTargetId !== null} onOpenChange={(open) => !open && setRenewTargetId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renew License</DialogTitle>
            <DialogDescription>{renewLicense ? `Renew ${renewLicense.program ?? 'license'} for BIOS ID ${renewLicense.bios_id}.` : 'Update duration and price, then renew.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Duration" htmlFor="renew-duration">
              <Input id="renew-duration" type="number" min={1} value={renewDuration} onChange={(event) => setRenewDuration(event.target.value)} />
            </Field>
            <Field label="Unit" htmlFor="renew-unit">
              <select
                id="renew-unit"
                value={renewUnit}
                onChange={(event) => setRenewUnit(event.target.value as DurationUnit)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="days">Days</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </Field>
            <Field label="Price" htmlFor="renew-price">
              <Input id="renew-price" type="number" step="0.01" min={0} value={renewPrice} onChange={(event) => setRenewPrice(event.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRenewTargetId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (Number(renewDuration) < 1 || Number(renewPrice) < 0) {
                  toast.error('Enter a valid duration and price before renewing.')
                  return
                }

                renewMutation.mutate()
              }}
              disabled={renewMutation.isPending}
            >
              {renewMutation.isPending ? 'Renewing...' : 'Renew'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkRenewOpen} onOpenChange={setBulkRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Renew</DialogTitle>
            <DialogDescription>Apply the same duration and price to {selectedIds.length} selected licenses.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Duration" htmlFor="bulk-duration">
              <Input id="bulk-duration" type="number" min={1} value={bulkDuration} onChange={(event) => setBulkDuration(event.target.value)} />
            </Field>
            <Field label="Unit" htmlFor="bulk-unit">
              <select
                id="bulk-unit"
                value={bulkUnit}
                onChange={(event) => setBulkUnit(event.target.value as DurationUnit)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="days">Days</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </Field>
            <Field label="Price" htmlFor="bulk-price">
              <Input id="bulk-price" type="number" step="0.01" min={0} value={bulkPrice} onChange={(event) => setBulkPrice(event.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setBulkRenewOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (selectedIds.length === 0 || Number(bulkDuration) < 1 || Number(bulkPrice) < 0) {
                  toast.error('Select licenses and enter a valid duration and price first.')
                  return
                }

                bulkRenewMutation.mutate()
              }}
              disabled={bulkRenewMutation.isPending}
            >
              {bulkRenewMutation.isPending ? 'Renewing...' : 'Renew Selected'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={bulkDeactivateOpen}
        onOpenChange={setBulkDeactivateOpen}
        title="Bulk deactivate licenses?"
        description={`This will deactivate ${selectedIds.length} selected licenses.`}
        confirmLabel="Deactivate Selected"
        isDestructive
        onConfirm={() => bulkDeactivateMutation.mutate()}
      />

      <ConfirmDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateTarget(null)
          }
        }}
        title="Deactivate license?"
        description={deactivateTarget ? `This will deactivate the license for BIOS ID: ${deactivateTarget.bios_id}` : undefined}
        confirmLabel="Deactivate"
        isDestructive
        onConfirm={() => {
          if (deactivateTarget) {
            deactivateMutation.mutate(deactivateTarget.id)
          }
        }}
      />
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

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <div className="mt-2 font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}

function InfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 font-semibold text-slate-950 dark:text-white">{value}</div>
    </div>
  )
}

function ExpiryAlert({ count, label, tone }: { count: number; label: string; tone: 'rose' | 'amber' | 'yellow' }) {
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
          <p className="text-lg font-semibold">{count} licenses</p>
        </div>
      </div>
    </div>
  )
}

function durationToDays(value: number, unit: DurationUnit) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  switch (unit) {
    case 'months':
      return value * 30
    case 'years':
      return value * 365
    default:
      return value
  }
}

function daysUntil(date: string | null) {
  if (!date) {
    return Number.POSITIVE_INFINITY
  }

  const diff = new Date(date).getTime() - Date.now()
  return Math.ceil(diff / (24 * 60 * 60 * 1000))
}

function invalidateLicenseQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: ['reseller', 'licenses'] }),
    queryClient.invalidateQueries({ queryKey: ['reseller', 'customers'] }),
    queryClient.invalidateQueries({ queryKey: ['reseller', 'dashboard'] }),
  ])
}

function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined)?.message
      ?? Object.values((error.response?.data as { errors?: Record<string, string[]> } | undefined)?.errors ?? {})[0]?.[0]
      ?? 'The request failed.'
  }

  return 'The request failed.'
}
