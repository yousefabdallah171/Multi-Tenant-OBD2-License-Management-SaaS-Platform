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
  const text = useMemo(() => (lang === 'ar'
    ? {
        eyebrow: 'موزع',
        title: 'التراخيص',
        description: 'تابع جميع التراخيص التي قمت بتفعيلها، وجدّدها بشكل جماعي، وتحرك مبكراً قبل انتهاء الصلاحية.',
        expiryLabels: {
          day1: 'تنتهي خلال يوم واحد',
          day3: 'تنتهي خلال 3 أيام',
          day7: 'تنتهي خلال 7 أيام',
          licenses: 'ترخيص',
        },
        statusOptions: { all: 'الكل', active: 'نشط', expired: 'منتهي', suspended: 'معلق', pending: 'قيد الانتظار' },
        searchPlaceholder: 'ابحث بالعميل أو BIOS ID أو البرنامج',
        bulkActionPlaceholder: 'إجراء جماعي',
        bulkRenew: 'تجديد المحدد',
        bulkDeactivate: 'إلغاء المحدد',
        apply: 'تطبيق',
        selectVisible: 'تحديد الظاهر',
        clearVisible: 'مسح الظاهر',
        table: {
          select: 'تحديد',
          customer: 'العميل',
          bios: 'BIOS ID',
          program: 'البرنامج',
          duration: 'المدة',
          price: 'السعر',
          activated: 'تم التفعيل',
          expires: 'ينتهي',
          status: 'الحالة',
          actions: 'الإجراءات',
        },
        actions: { view: 'عرض', renew: 'تجديد', deactivate: 'إلغاء' },
        units: { days: 'أيام', months: 'أشهر', years: 'سنوات' },
        details: {
          titleFallback: 'تفاصيل الترخيص',
          descriptionFallback: 'راجع السجل الكامل للترخيص.',
          customer: 'العميل',
          program: 'البرنامج',
          version: 'الإصدار',
          status: 'الحالة',
          bios: 'BIOS ID',
          duration: 'المدة',
          price: 'السعر',
          expires: 'ينتهي',
          activity: 'النشاط',
          openDownload: 'فتح رابط التحميل',
        },
        renewDialog: {
          title: 'تجديد الترخيص',
          fallback: 'حدّث المدة والسعر ثم قم بالتجديد.',
          description: (program: string, biosId: string) => `قم بتجديد ${program} لـ BIOS ID ${biosId}.`,
          duration: 'المدة',
          unit: 'الوحدة',
          price: 'السعر',
          cancel: 'إلغاء',
          renew: 'تجديد',
          renewing: 'جارٍ التجديد...',
        },
        bulkRenewDialog: {
          title: 'تجديد جماعي',
          description: (count: number) => `طبّق نفس المدة والسعر على ${count} من التراخيص المحددة.`,
        },
        confirm: {
          bulkDeactivateTitle: 'إلغاء التراخيص المحددة؟',
          bulkDeactivateDescription: (count: number) => `سيؤدي هذا إلى إلغاء ${count} من التراخيص المحددة.`,
          deactivateTitle: 'إلغاء الترخيص؟',
          deactivateDescription: (biosId: string) => `سيؤدي هذا إلى إلغاء الترخيص الخاص بـ BIOS ID: ${biosId}`,
          deactivateSelected: 'إلغاء المحدد',
          deactivate: 'إلغاء',
        },
        toasts: {
          renewed: 'تم تجديد الترخيص بنجاح.',
          deactivated: 'تم إلغاء الترخيص بنجاح.',
          bulkRenewed: 'تم تجديد التراخيص المحددة بنجاح.',
          bulkDeactivated: 'تم إلغاء التراخيص المحددة بنجاح.',
        },
        errors: {
          selectAction: 'حدد التراخيص والإجراء الجماعي أولاً.',
          renew: 'أدخل مدة وسعراً صالحين قبل التجديد.',
          bulkRenew: 'حدد التراخيص وأدخل مدة وسعراً صالحين أولاً.',
          requestFailed: 'فشل تنفيذ الطلب.',
        },
      }
    : {
        eyebrow: 'Reseller',
        title: 'Licenses',
        description: 'Track all licenses you have activated, renew them in bulk, and act early on upcoming expirations.',
        expiryLabels: {
          day1: 'Expire in 1 day',
          day3: 'Expire in 3 days',
          day7: 'Expire in 7 days',
          licenses: 'licenses',
        },
        statusOptions: { all: 'All', active: 'Active', expired: 'Expired', suspended: 'Suspended', pending: 'Pending' },
        searchPlaceholder: 'Search by customer, BIOS ID, or program',
        bulkActionPlaceholder: 'Bulk action',
        bulkRenew: 'Renew Selected',
        bulkDeactivate: 'Deactivate Selected',
        apply: 'Apply',
        selectVisible: 'Select Visible',
        clearVisible: 'Clear Visible',
        table: {
          select: 'Select',
          customer: 'Customer',
          bios: 'BIOS ID',
          program: 'Program',
          duration: 'Duration',
          price: 'Price',
          activated: 'Activated',
          expires: 'Expires',
          status: 'Status',
          actions: 'Actions',
        },
        actions: { view: 'View', renew: 'Renew', deactivate: 'Deactivate' },
        units: { days: 'Days', months: 'Months', years: 'Years' },
        details: {
          titleFallback: 'License detail',
          descriptionFallback: 'Inspect the full license record.',
          customer: 'Customer',
          program: 'Program',
          version: 'Version',
          status: 'Status',
          bios: 'BIOS ID',
          duration: 'Duration',
          price: 'Price',
          expires: 'Expires',
          activity: 'Activity',
          openDownload: 'Open Download Link',
        },
        renewDialog: {
          title: 'Renew License',
          fallback: 'Update duration and price, then renew.',
          description: (program: string, biosId: string) => `Renew ${program} for BIOS ID ${biosId}.`,
          duration: 'Duration',
          unit: 'Unit',
          price: 'Price',
          cancel: 'Cancel',
          renew: 'Renew',
          renewing: 'Renewing...',
        },
        bulkRenewDialog: {
          title: 'Bulk Renew',
          description: (count: number) => `Apply the same duration and price to ${count} selected licenses.`,
        },
        confirm: {
          bulkDeactivateTitle: 'Bulk deactivate licenses?',
          bulkDeactivateDescription: (count: number) => `This will deactivate ${count} selected licenses.`,
          deactivateTitle: 'Deactivate license?',
          deactivateDescription: (biosId: string) => `This will deactivate the license for BIOS ID: ${biosId}`,
          deactivateSelected: 'Deactivate Selected',
          deactivate: 'Deactivate',
        },
        toasts: {
          renewed: 'License renewed successfully.',
          deactivated: 'License deactivated successfully.',
          bulkRenewed: 'Selected licenses renewed successfully.',
          bulkDeactivated: 'Selected licenses deactivated successfully.',
        },
        errors: {
          selectAction: 'Select licenses and a bulk action first.',
          renew: 'Enter a valid duration and price before renewing.',
          bulkRenew: 'Select licenses and enter a valid duration and price first.',
          requestFailed: 'The request failed.',
        },
      }), [lang])
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
      toast.success(text.toasts.renewed)
      setRenewTargetId(null)
      invalidateLicenseQueries(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.errors.requestFailed)),
  })

  const deactivateMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.deactivate(licenseId),
    onSuccess: () => {
      toast.success(text.toasts.deactivated)
      setDeactivateTarget(null)
      invalidateLicenseQueries(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.errors.requestFailed)),
  })

  const bulkRenewMutation = useMutation({
    mutationFn: () =>
      licenseService.bulkRenew(selectedIds, {
        duration_days: durationToDays(Number(bulkDuration), bulkUnit),
        price: Number(bulkPrice),
      }),
    onSuccess: () => {
      toast.success(text.toasts.bulkRenewed)
      setBulkRenewOpen(false)
      setSelectedIds([])
      invalidateLicenseQueries(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.errors.requestFailed)),
  })

  const bulkDeactivateMutation = useMutation({
    mutationFn: () => licenseService.bulkDeactivate(selectedIds),
    onSuccess: () => {
      toast.success(text.toasts.bulkDeactivated)
      setBulkDeactivateOpen(false)
      setSelectedIds([])
      invalidateLicenseQueries(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.errors.requestFailed)),
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
        label: text.table.select,
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
        label: text.table.customer,
        sortable: true,
        sortValue: (row) => row.customer_name ?? '',
        render: (row) => (
          <div>
            <p className="font-medium text-slate-950 dark:text-white">{row.customer_name ?? '-'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.customer_email ?? '-'}</p>
          </div>
        ),
      },
      { key: 'bios', label: text.table.bios, sortable: true, sortValue: (row) => row.bios_id, render: (row) => row.bios_id },
      { key: 'program', label: text.table.program, sortable: true, sortValue: (row) => row.program ?? '', render: (row) => row.program ?? '-' },
      { key: 'duration', label: text.table.duration, sortable: true, sortValue: (row) => row.duration_days, render: (row) => `${row.duration_days} ${text.units.days}` },
      { key: 'price', label: text.table.price, sortable: true, sortValue: (row) => row.price, render: (row) => formatCurrency(row.price, 'USD', locale) },
      { key: 'activated', label: text.table.activated, sortable: true, sortValue: (row) => row.activated_at ?? '', render: (row) => (row.activated_at ? formatDate(row.activated_at, locale) : '-') },
      { key: 'expires', label: text.table.expires, sortable: true, sortValue: (row) => row.expires_at ?? '', render: (row) => (row.expires_at ? formatDate(row.expires_at, locale) : '-') },
      { key: 'status', label: text.table.status, sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
      {
        key: 'actions',
        label: text.table.actions,
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setDetailLicenseId(row.id)}>
              <Eye className="me-1 h-4 w-4" />
              {text.actions.view}
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
              {text.actions.renew}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDeactivateTarget(row)}>
              <ShieldOff className="me-1 h-4 w-4" />
              {text.actions.deactivate}
            </Button>
          </div>
        ),
      },
    ],
    [locale, selectedIds, text],
  )

  const detailLicense = detailQuery.data?.data
  const renewLicense = renewQuery.data?.data

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} />

      <div className="grid gap-3 md:grid-cols-3">
        <ExpiryAlert count={oneDay} label={text.expiryLabels.day1} licensesLabel={text.expiryLabels.licenses} tone="rose" />
        <ExpiryAlert count={threeDays} label={text.expiryLabels.day3} licensesLabel={text.expiryLabels.licenses} tone="amber" />
        <ExpiryAlert count={sevenDays} label={text.expiryLabels.day7} licensesLabel={text.expiryLabels.licenses} tone="yellow" />
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
              {text.statusOptions[option]}
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
                placeholder={text.searchPlaceholder}
              />
              <select
                value={bulkAction}
                onChange={(event) => setBulkAction(event.target.value as 'renew' | 'deactivate' | '')}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">{text.bulkActionPlaceholder}</option>
                <option value="renew">{text.bulkRenew}</option>
                <option value="deactivate">{text.bulkDeactivate}</option>
              </select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!bulkAction || selectedIds.length === 0) {
                    toast.error(text.errors.selectAction)
                    return
                  }

                  if (bulkAction === 'renew') {
                    setBulkRenewOpen(true)
                    return
                  }

                  setBulkDeactivateOpen(true)
                }}
              >
                {text.apply}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedIds(allVisibleSelected ? [] : visibleIds)}
              >
                <CheckSquare className="me-2 h-4 w-4" />
                {allVisibleSelected ? text.clearVisible : text.selectVisible}
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
            <DialogTitle>{detailLicense?.program ?? text.details.titleFallback}</DialogTitle>
            <DialogDescription>{detailLicense ? `BIOS ID ${detailLicense.bios_id}` : text.details.descriptionFallback}</DialogDescription>
          </DialogHeader>
          {detailLicense ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <InfoCard label={text.details.customer} value={detailLicense.customer?.name ?? '-'} />
                <InfoCard label={text.details.program} value={detailLicense.program ?? '-'} />
                <InfoCard label={text.details.version} value={detailLicense.program_version ?? '-'} />
                <InfoCard label={text.details.status} value={<StatusBadge status={detailLicense.status} />} />
              </div>

              <Card>
                <CardContent className="grid gap-4 p-4 md:grid-cols-2">
                  <InfoBlock label={text.details.bios} value={detailLicense.bios_id} />
                  <InfoBlock label={text.details.duration} value={`${detailLicense.duration_days} ${text.units.days}`} />
                  <InfoBlock label={text.details.price} value={formatCurrency(detailLicense.price, 'USD', locale)} />
                  <InfoBlock label={text.details.expires} value={detailLicense.expires_at ? formatDate(detailLicense.expires_at, locale) : '-'} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{text.details.activity}</CardTitle>
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
                  {text.details.openDownload}
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={renewTargetId !== null} onOpenChange={(open) => !open && setRenewTargetId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text.renewDialog.title}</DialogTitle>
            <DialogDescription>{renewLicense ? text.renewDialog.description(renewLicense.program ?? 'license', renewLicense.bios_id) : text.renewDialog.fallback}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={text.renewDialog.duration} htmlFor="renew-duration">
              <Input id="renew-duration" type="number" min={1} value={renewDuration} onChange={(event) => setRenewDuration(event.target.value)} />
            </Field>
            <Field label={text.renewDialog.unit} htmlFor="renew-unit">
              <select
                id="renew-unit"
                value={renewUnit}
                onChange={(event) => setRenewUnit(event.target.value as DurationUnit)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="days">{text.units.days}</option>
                <option value="months">{text.units.months}</option>
                <option value="years">{text.units.years}</option>
              </select>
            </Field>
            <Field label={text.renewDialog.price} htmlFor="renew-price">
              <Input id="renew-price" type="number" step="0.01" min={0} value={renewPrice} onChange={(event) => setRenewPrice(event.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRenewTargetId(null)}>
              {text.renewDialog.cancel}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (Number(renewDuration) < 1 || Number(renewPrice) < 0) {
                  toast.error(text.errors.renew)
                  return
                }

                renewMutation.mutate()
              }}
              disabled={renewMutation.isPending}
            >
              {renewMutation.isPending ? text.renewDialog.renewing : text.renewDialog.renew}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkRenewOpen} onOpenChange={setBulkRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text.bulkRenewDialog.title}</DialogTitle>
            <DialogDescription>{text.bulkRenewDialog.description(selectedIds.length)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={text.renewDialog.duration} htmlFor="bulk-duration">
              <Input id="bulk-duration" type="number" min={1} value={bulkDuration} onChange={(event) => setBulkDuration(event.target.value)} />
            </Field>
            <Field label={text.renewDialog.unit} htmlFor="bulk-unit">
              <select
                id="bulk-unit"
                value={bulkUnit}
                onChange={(event) => setBulkUnit(event.target.value as DurationUnit)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="days">{text.units.days}</option>
                <option value="months">{text.units.months}</option>
                <option value="years">{text.units.years}</option>
              </select>
            </Field>
            <Field label={text.renewDialog.price} htmlFor="bulk-price">
              <Input id="bulk-price" type="number" step="0.01" min={0} value={bulkPrice} onChange={(event) => setBulkPrice(event.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setBulkRenewOpen(false)}>
              {text.renewDialog.cancel}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (selectedIds.length === 0 || Number(bulkDuration) < 1 || Number(bulkPrice) < 0) {
                  toast.error(text.errors.bulkRenew)
                  return
                }

                bulkRenewMutation.mutate()
              }}
              disabled={bulkRenewMutation.isPending}
            >
              {bulkRenewMutation.isPending ? text.renewDialog.renewing : text.bulkRenew}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={bulkDeactivateOpen}
        onOpenChange={setBulkDeactivateOpen}
        title={text.confirm.bulkDeactivateTitle}
        description={text.confirm.bulkDeactivateDescription(selectedIds.length)}
        confirmLabel={text.confirm.deactivateSelected}
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
        title={text.confirm.deactivateTitle}
        description={deactivateTarget ? text.confirm.deactivateDescription(deactivateTarget.bios_id) : undefined}
        confirmLabel={text.confirm.deactivate}
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

function ExpiryAlert({ count, label, licensesLabel, tone }: { count: number; label: string; licensesLabel: string; tone: 'rose' | 'amber' | 'yellow' }) {
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
          <p className="text-lg font-semibold">{count} {licensesLabel}</p>
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

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined)?.message
      ?? Object.values((error.response?.data as { errors?: Record<string, string[]> } | undefined)?.errors ?? {})[0]?.[0]
      ?? fallback
  }

  return fallback
}
