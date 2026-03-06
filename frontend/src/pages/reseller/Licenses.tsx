import { useMemo, useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Eye, MoreVertical, Pause, Play, RotateCw, ShieldOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { RenewLicenseDialog } from '@/components/licenses/RenewLicenseDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { licenseService } from '@/services/license.service'
import { programService } from '@/services/program.service'
import type { LicenseSummary, RenewLicenseData } from '@/types/manager-reseller.types'
import { rawBiosId } from '@/utils/biosId'

const STATUS_OPTIONS = ['all', 'active', 'expired', 'cancelled', 'pending'] as const

export function LicensesPage() {
  const { t } = useTranslation()
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
        statusOptions: { all: 'الكل', active: 'نشط', expired: 'منتهي', cancelled: 'ملغي', pending: 'موقف' },
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
        actions: { view: 'عرض', renew: 'تجديد', deactivate: 'إلغاء', pause: 'إيقاف', resume: 'استئناف', reactivate: 'إعادة تفعيل' },
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
          pauseTitle: 'إيقاف الترخيص؟',
          pauseDescription: (biosId: string) => `سيؤدي هذا إلى إيقاف الترخيص مؤقتاً لـ BIOS ID: ${biosId}`,
        },
        toasts: {
          renewed: 'تم تجديد الترخيص بنجاح.',
          deactivated: 'تم إلغاء الترخيص بنجاح.',
          bulkRenewed: 'تم تجديد التراخيص المحددة بنجاح.',
          bulkDeactivated: 'تم إلغاء التراخيص المحددة بنجاح.',
          paused: 'تم إيقاف الترخيص بنجاح.',
          resumed: 'تم استئناف الترخيص بنجاح.',
          reactivated: 'تم إعادة تفعيل الترخيص بنجاح.',
        },
        errors: {
          selectAction: 'حدد التراخيص والإجراء الجماعي أولاً.',
          renew: 'أدخل مدة وسعراً صالحين قبل التجديد.',
          bulkRenew: 'حدد التراخيص وأدخل مدة وسعراً صالحين أولاً.',
          requestFailed: 'فشل تنفيذ الطلب.',
        },
      }
    : {
        eyebrow: t('roles.reseller'),
        title: t('reseller.pages.licenses.title'),
        description: t('reseller.pages.licenses.description'),
        expiryLabels: {
          day1: t('reseller.pages.licenses.expiryLabels.day1'),
          day3: t('reseller.pages.licenses.expiryLabels.day3'),
          day7: t('reseller.pages.licenses.expiryLabels.day7'),
          licenses: t('reseller.pages.licenses.expiryLabels.licenses'),
        },
        statusOptions: {
          all: t('common.all'),
          active: t('common.active'),
          expired: t('common.expired'),
          cancelled: t('common.cancelled'),
          pending: t('common.pending'),
        },
        searchPlaceholder: t('reseller.pages.licenses.searchPlaceholder'),
        bulkActionPlaceholder: t('reseller.pages.licenses.bulkActionPlaceholder'),
        bulkRenew: t('reseller.pages.licenses.bulkRenew'),
        bulkDeactivate: t('reseller.pages.licenses.bulkDeactivate'),
        apply: t('common.apply'),
        selectVisible: t('common.selectAllVisible'),
        clearVisible: t('common.clearVisible'),
        table: {
          select: t('common.select'),
          customer: t('common.customer'),
          bios: t('reseller.pages.licenses.table.bios'),
          program: t('common.program'),
          duration: t('common.duration'),
          price: t('common.price'),
          activated: t('reseller.pages.licenses.table.activated'),
          expires: t('reseller.pages.licenses.table.expires'),
          status: t('common.status'),
          actions: t('common.actions'),
        },
        actions: {
          view: t('common.view'),
          renew: t('common.renew'),
          deactivate: t('common.deactivate'),
          pause: t('common.pause'),
          resume: t('common.resume'),
          reactivate: t('common.reactivate'),
        },
        units: {
          days: t('common.days'),
          months: t('common.months'),
          years: t('common.years'),
        },
        details: {
          titleFallback: t('reseller.pages.licenses.details.titleFallback'),
          descriptionFallback: t('reseller.pages.licenses.details.descriptionFallback'),
          customer: t('common.customer'),
          program: t('common.program'),
          version: t('reseller.pages.licenses.details.version'),
          status: t('common.status'),
          bios: t('reseller.pages.licenses.details.bios'),
          duration: t('common.duration'),
          price: t('common.price'),
          expires: t('reseller.pages.licenses.details.expires'),
          activity: t('reseller.pages.licenses.details.activity'),
          openDownload: t('reseller.pages.licenses.details.openDownload'),
        },
        renewDialog: {
          title: t('reseller.pages.licenses.renewDialog.title'),
          fallback: t('reseller.pages.licenses.renewDialog.fallback'),
          description: (program: string, biosId: string) => t('reseller.pages.licenses.renewDialog.description', { program, biosId }),
          duration: t('common.duration'),
          unit: t('common.unit'),
          price: t('common.price'),
          cancel: t('common.cancel'),
          renew: t('common.renew'),
          renewing: t('reseller.pages.licenses.renewDialog.renewing'),
        },
        bulkRenewDialog: {
          title: t('reseller.pages.licenses.bulkRenewDialog.title'),
          description: (count: number) => t('reseller.pages.licenses.bulkRenewDialog.description', { count }),
        },
        confirm: {
          bulkDeactivateTitle: t('reseller.pages.licenses.confirm.bulkDeactivateTitle'),
          bulkDeactivateDescription: (count: number) => t('reseller.pages.licenses.confirm.bulkDeactivateDescription', { count }),
          deactivateTitle: t('reseller.pages.licenses.confirm.deactivateTitle'),
          deactivateDescription: (biosId: string) => t('reseller.pages.licenses.confirm.deactivateDescription', { biosId }),
          deactivateSelected: t('reseller.pages.licenses.confirm.deactivateSelected'),
          deactivate: t('common.deactivate'),
          pauseTitle: t('reseller.pages.licenses.confirm.pauseTitle'),
          pauseDescription: (biosId: string) => t('reseller.pages.licenses.confirm.pauseDescription', { biosId }),
        },
        toasts: {
          renewed: t('reseller.pages.licenses.toasts.renewed'),
          deactivated: t('reseller.pages.licenses.toasts.deactivated'),
          bulkRenewed: t('reseller.pages.licenses.toasts.bulkRenewed'),
          bulkDeactivated: t('reseller.pages.licenses.toasts.bulkDeactivated'),
          paused: t('reseller.pages.licenses.toasts.paused'),
          resumed: t('reseller.pages.licenses.toasts.resumed'),
          reactivated: t('reseller.pages.licenses.toasts.reactivated'),
        },
        errors: {
          selectAction: t('reseller.pages.licenses.errors.selectAction'),
          renew: t('reseller.pages.licenses.errors.renew'),
          bulkRenew: t('reseller.pages.licenses.errors.bulkRenew'),
          requestFailed: t('reseller.pages.licenses.errors.requestFailed'),
        },
      }), [lang, t])
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [detailLicenseId, setDetailLicenseId] = useState<number | null>(null)
  const [renewTargetId, setRenewTargetId] = useState<number | null>(null)
  const [bulkRenewOpen, setBulkRenewOpen] = useState(false)
  const [bulkDeactivateOpen, setBulkDeactivateOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<LicenseSummary | null>(null)
  const [pauseTarget, setPauseTarget] = useState<LicenseSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LicenseSummary | null>(null)
  const [programFilter, setProgramFilter] = useState<number | ''>('')

  const programsQuery = useQuery({
    queryKey: ['reseller', 'licenses', 'programs'],
    queryFn: () => programService.getAll({ per_page: 100, status: 'active' }),
  })

  const licensesQuery = useQuery({
    queryKey: ['reseller', 'licenses', page, perPage, search, status, programFilter],
    queryFn: () =>
      licenseService.getAll({
        page,
        per_page: perPage,
        search,
        status: status === 'all' ? '' : status,
        program_id: programFilter || undefined,
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
    mutationFn: (payload: RenewLicenseData) => licenseService.renew(renewTargetId ?? 0, payload),
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

  const pauseMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.pause(licenseId),
    onSuccess: () => {
      toast.success(text.toasts.paused)
      setPauseTarget(null)
      invalidateLicenseQueries(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.errors.requestFailed)),
  })

  const resumeMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.resume(licenseId),
    onSuccess: () => {
      toast.success(text.toasts.resumed)
      invalidateLicenseQueries(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.errors.requestFailed)),
  })

  const bulkRenewMutation = useMutation({
    mutationFn: (payload: RenewLicenseData) => licenseService.bulkRenew(selectedIds, payload),
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

  const deleteMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.delete(licenseId),
    onSuccess: () => {
      toast.success(t('common.deleted', { defaultValue: 'License deleted successfully.' }))
      setDeleteTarget(null)
      invalidateLicenseQueries(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.errors.requestFailed)),
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
      invalidateLicenseQueries(queryClient)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.errors.requestFailed)),
  })

  const rows = licensesQuery.data?.data ?? []
  const visibleIds = rows.map((row) => row.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))
  const someVisibleSelected = visibleIds.some((id) => selectedIds.includes(id))
  const expiring = expiringQuery.data?.data ?? []
  const oneDay = expiring.filter((license) => daysUntil(license.expires_at) <= 1).length
  const threeDays = expiring.filter((license) => daysUntil(license.expires_at) <= 3).length
  const sevenDays = expiring.length

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
        label: text.table.customer,
        sortable: true,
        sortValue: (row) => row.customer_name ?? '',
        render: (row) => (
          <div>
            <p className="font-medium text-slate-950 dark:text-white">
              {row.customer_id ? (
                <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.reseller.customerDetail(lang, row.customer_id)}>
                  {row.customer_name ?? '-'}
                </Link>
              ) : (row.customer_name ?? '-')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.customer_email ?? '-'}</p>
          </div>
        ),
      },
      {
        key: 'bios',
        label: text.table.bios,
        sortable: true,
        sortValue: (row) => row.bios_id,
        render: (row) => (
          <div>
            <p className="font-medium">
              {row.customer_id ? (
                <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.reseller.customerDetail(lang, row.customer_id)}>
                  {rawBiosId(row.bios_id, row.external_username)}
                </Link>
              ) : rawBiosId(row.bios_id, row.external_username)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">@{row.external_username ?? '-'}</p>
          </div>
        ),
      },
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="ghost">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="transition-colors duration-150 focus:bg-sky-50 dark:focus:bg-sky-950/20" onClick={() => setDetailLicenseId(row.id)}>
                <Eye className="me-2 h-4 w-4" />
                {text.actions.view}
              </DropdownMenuItem>
              {row.status === 'pending' && (
                <DropdownMenuItem
                  className="transition-colors duration-150 focus:bg-sky-50 dark:focus:bg-sky-950/20"
                  onClick={() => setRenewTargetId(row.id)}
                >
                  <RotateCw className="me-2 h-4 w-4" />
                  {text.actions.renew}
                </DropdownMenuItem>
              )}
              {row.status === 'cancelled' && (
                <DropdownMenuItem className="transition-colors duration-150 focus:bg-sky-50 dark:focus:bg-sky-950/20" onClick={() => resumeMutation.mutate(row.id)} disabled={resumeMutation.isPending}>
                  <Play className="me-2 h-4 w-4" />
                  {text.actions.reactivate}
                </DropdownMenuItem>
              )}
              {row.status !== 'pending' && row.status !== 'cancelled' && (
                <>
                  <DropdownMenuItem
                    className="transition-colors duration-150 focus:bg-sky-50 dark:focus:bg-sky-950/20"
                    onClick={() => {
                      setRenewTargetId(row.id)
                    }}
                  >
                    <RotateCw className="me-2 h-4 w-4" />
                    {text.actions.renew}
                  </DropdownMenuItem>
                  {row.status === 'active' && (
                    <DropdownMenuItem className="transition-colors duration-150 focus:bg-sky-50 dark:focus:bg-sky-950/20" onClick={() => setPauseTarget(row)}>
                      <Pause className="me-2 h-4 w-4" />
                      {text.actions.pause}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="transition-colors duration-150 focus:bg-sky-50 dark:focus:bg-sky-950/20" onClick={() => setDeactivateTarget(row)}>
                    <ShieldOff className="me-2 h-4 w-4" />
                    {text.actions.deactivate}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem className="transition-colors duration-150 focus:bg-sky-50 dark:focus:bg-sky-950/20" onClick={() => setDeleteTarget(row)}>
                <Trash2 className="me-2 h-4 w-4" />
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [allVisibleSelected, lang, locale, selectedIds, someVisibleSelected, text, t, visibleIds, resumeMutation.isPending],
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
            <CardHeader className="border-b border-sky-100 bg-gradient-to-r from-sky-100 via-cyan-50 to-blue-100 py-4 dark:border-sky-900/40 dark:from-sky-950/40 dark:via-slate-900 dark:to-sky-950/30">
              <CardTitle className="text-base">{lang === 'ar' ? 'بحث وتصفية التراخيص' : 'Search & Filter Licenses'}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_180px]">
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder={text.searchPlaceholder}
              />
              <select
                value={programFilter}
                onChange={(event) => {
                  setProgramFilter(event.target.value ? Number(event.target.value) : '')
                  setPage(1)
                  setSelectedIds([])
                }}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">{lang === 'ar' ? 'كل البرامج' : 'All Programs'}</option>
                {(programsQuery.data?.data ?? []).map((program) => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </select>
            </CardContent>
          </Card>

          {selectedIds.length > 0 ? (
            <Card className="border-sky-200 bg-sky-50/70 dark:border-sky-900/40 dark:bg-sky-950/20">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="text-sm text-slate-600 dark:text-slate-300">{selectedIds.length} {t('common.selected', { defaultValue: 'selected' })}</span>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => setBulkRenewOpen(true)}>
                    {text.bulkRenew}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setBulkDeactivateOpen(true)}>
                    {text.bulkDeactivate}
                  </Button>
                  <Button type="button" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                    {t('common.deleteSelected', { defaultValue: 'Delete Selected' })}
                  </Button>
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
            <DialogDescription>{detailLicense ? `${text.details.bios} ${detailLicense.bios_id}` : text.details.descriptionFallback}</DialogDescription>
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

      <RenewLicenseDialog
        open={renewTargetId !== null}
        onOpenChange={(open) => !open && setRenewTargetId(null)}
        title={text.renewDialog.title}
        description={renewLicense ? text.renewDialog.description(renewLicense.program ?? text.details.program, renewLicense.bios_id) : text.renewDialog.fallback}
        confirmLabel={text.renewDialog.renew}
        confirmLoadingLabel={text.renewDialog.renewing}
        cancelLabel={text.renewDialog.cancel}
        anchorDate={renewLicense?.expires_at}
        initialPrice={renewLicense?.price ?? 0}
        autoPricePerDay={renewLicense && renewLicense.duration_days > 0 ? renewLicense.price / renewLicense.duration_days : 0}
        resetKey={renewTargetId}
        isPending={renewMutation.isPending}
        onSubmit={(payload) => renewMutation.mutate(payload)}
      />

      <RenewLicenseDialog
        open={bulkRenewOpen}
        onOpenChange={setBulkRenewOpen}
        title={text.bulkRenewDialog.title}
        description={text.bulkRenewDialog.description(selectedIds.length)}
        confirmLabel={text.bulkRenew}
        confirmLoadingLabel={text.renewDialog.renewing}
        cancelLabel={text.renewDialog.cancel}
        resetKey={selectedIds.join(',')}
        isPending={bulkRenewMutation.isPending}
        onSubmit={(payload) => bulkRenewMutation.mutate(payload)}
      />

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
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={t('common.bulkDelete', { defaultValue: 'Bulk Delete' })}
        description={t('reseller.pages.licenses.confirm.bulkDeleteDescription', { count: selectedIds.length, defaultValue: 'Delete selected licenses?' })}
        confirmLabel={t('common.deleteSelected', { defaultValue: 'Delete Selected' })}
        isDestructive
        onConfirm={() => bulkDeleteMutation.mutate()}
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

      <ConfirmDialog
        open={pauseTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPauseTarget(null)
        }}
        title={text.confirm.pauseTitle}
        description={pauseTarget ? text.confirm.pauseDescription(pauseTarget.bios_id) : undefined}
        confirmLabel={text.actions.pause}
        onConfirm={() => {
          if (pauseTarget) {
            pauseMutation.mutate(pauseTarget.id)
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
  const accents = {
    rose: 'border-s-4 border-s-rose-500',
    amber: 'border-s-4 border-s-amber-500',
    yellow: 'border-s-4 border-s-yellow-500',
  } as const

  return (
    <div className={`rounded-3xl border px-4 py-4 ${styles[tone]} ${accents[tone]}`}>
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
