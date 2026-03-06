import { useMemo, useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, Cpu, Eye, MoreVertical, Pause, Pencil, Play, Plus, RotateCw, ShieldOff, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { licenseService } from '@/services/license.service'
import { programService } from '@/services/program.service'
import { resellerService } from '@/services/reseller.service'
import { formatUsername, rawBiosId } from '@/utils/biosId'
import type { DurationUnit, ResellerCustomerSummary } from '@/types/manager-reseller.types'

const STATUS_OPTIONS = ['all', 'active', 'expired', 'cancelled', 'pending'] as const

interface ActivationFormState {
  customer_name: string
  client_name: string
  customer_email: string
  customer_phone: string
  bios_id: string
  program_id: number | ''
  duration_value: string
  duration_unit: 'minutes' | 'hours' | 'days'
  mode: 'duration' | 'end_date'
  end_date: string
  is_scheduled: boolean
  schedule_mode: 'relative' | 'custom'
  schedule_offset_value: string
  schedule_offset_unit: 'minutes' | 'hours' | 'days'
  scheduled_date_time: string
  scheduled_timezone: string
}

const EMPTY_ACTIVATION_FORM: ActivationFormState = {
  customer_name: '',
  client_name: '',
  customer_email: '',
  customer_phone: '',
  bios_id: '',
  program_id: '',
  duration_value: '30',
  duration_unit: 'days',
  mode: 'duration',
  end_date: '',
  is_scheduled: false,
  schedule_mode: 'relative',
  schedule_offset_value: '1',
  schedule_offset_unit: 'hours',
  scheduled_date_time: '',
  scheduled_timezone: 'UTC',
}

export function CustomersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const text = useMemo(() => (lang === 'ar'
    ? {
        eyebrow: 'موزع',
        title: 'العملاء',
        description: 'أنشئ العملاء وفعلهم ثم أدِر عمليات التجديد والإلغاء من مساحة عملك الشخصية كموزع.',
        addCustomer: 'إضافة عميل',
        statusOptions: { all: 'الكل', active: 'نشط', expired: 'منتهي', cancelled: 'ملغي', pending: 'موقف' },
        searchPlaceholder: 'ابحث بالاسم أو البريد الإلكتروني أو BIOS ID',
        table: {
          customer: 'العميل',
          bios: 'BIOS ID',
          program: 'البرنامج',
          status: 'الحالة',
          price: 'السعر',
          expiry: 'الانتهاء',
          actions: 'الإجراءات',
        },
        actions: { view: 'عرض', renew: 'تجديد', deactivate: 'إلغاء', pause: 'إيقاف', resume: 'استئناف', reactivate: 'إعادة تفعيل' },
        activationDialog: {
          title: 'إضافة عميل',
          description: 'انتقل بين الخطوات لإنشاء العميل وتفعيل الترخيص.',
          steps: ['بيانات العميل', 'تفعيل BIOS', 'السعر والمدة', 'المراجعة'],
          stepLabel: 'الخطوة',
          username: 'اسم المستخدم (API)',
          usernameHint: 'حروف وأرقام وشرطة سفلية فقط',
          clientName: 'الاسم الظاهر للعميل',
          customerEmail: 'بريد العميل الإلكتروني',
          phone: 'الهاتف',
          biosId: 'BIOS ID',
          program: 'البرنامج',
          selectProgram: 'اختر برنامجاً',
          basePrice: 'السعر الأساسي',
          trialDays: 'أيام التجربة',
          noDescription: 'لا يوجد وصف متاح.',
          duration: 'المدة',
          unit: 'الوحدة',
          price: 'السعر',
          durationDays: 'المدة بالأيام',
          expiryPreview: 'معاينة تاريخ الانتهاء',
          review: 'المراجعة والتأكيد',
          customer: 'العميل',
          email: 'البريد الإلكتروني',
          expiry: 'الانتهاء',
          cancel: 'إلغاء',
          back: 'رجوع',
          next: 'التالي',
          activate: 'تفعيل',
          activating: 'جارٍ التفعيل...',
        },
        detail: {
          titleFallback: 'تفاصيل العميل',
          descriptionFallback: 'راجع سجل التراخيص لهذا العميل.',
          phone: 'الهاتف',
          bios: 'BIOS ID',
          program: 'البرنامج',
          status: 'الحالة',
          activationHistory: 'سجل التفعيل',
          unknownProgram: 'برنامج غير معروف',
          activated: 'تم التفعيل',
          expires: 'ينتهي',
        },
        renewDialog: {
          title: 'تجديد الترخيص',
          descriptionFallback: 'حدّث المدة والسعر ثم قم بالتجديد.',
          descriptionWithProgram: (program: string, biosId: string) => `قم بتجديد ${program} لـ BIOS ID ${biosId}.`,
          duration: 'المدة',
          unit: 'الوحدة',
          price: 'السعر',
          cancel: 'إلغاء',
          renew: 'تجديد',
          renewing: 'جارٍ التجديد...',
        },
        deactivateDialog: {
          title: 'إلغاء الترخيص؟',
          description: (biosId: string) => `سيؤدي هذا إلى إلغاء الترخيص الخاص بـ BIOS ID: ${biosId}`,
          confirm: 'إلغاء',
        },
        pauseDialog: {
          title: 'إيقاف الترخيص؟',
          description: (biosId: string) => `سيؤدي هذا إلى إيقاف الترخيص مؤقتاً لـ BIOS ID: ${biosId}`,
        },
        units: { minutes: 'دقائق', hours: 'ساعات', days: 'أيام', months: 'أشهر', years: 'سنوات' },
        toasts: {
          activated: 'تم تفعيل الترخيص بنجاح.',
          renewed: 'تم تجديد الترخيص بنجاح.',
          deactivated: 'تم إلغاء الترخيص بنجاح.',
          paused: 'تم إيقاف الترخيص بنجاح.',
          resumed: 'تم استئناف الترخيص بنجاح.',
          reactivated: 'تم إعادة تفعيل الترخيص بنجاح.',
        },
        validation: {
          customerName: 'يجب أن يكون اسم المستخدم مكوناً من حرفين على الأقل.',
          nameNotBiosId: t('validation.nameNotBiosId'),
          customerEmail: 'Invalid customer email.',
          biosId: 'BIOS ID must be at least 5 characters.',
          selectProgram: 'اختر برنامجاً قبل المتابعة.',
          duration: 'يجب أن تكون المدة 1 على الأقل.',
          price: 'أدخل سعراً صحيحاً.',
          renew: 'أدخل مدة وسعراً صالحين قبل التجديد.',
          requestFailed: 'فشل تنفيذ الطلب.',
        },
      }
    : {
        eyebrow: t('roles.reseller'),
        title: t('reseller.pages.customers.title'),
        description: t('reseller.pages.customers.description'),
        addCustomer: t('reseller.pages.customers.addCustomer'),
        statusOptions: {
          all: t('common.all'),
          active: t('common.active'),
          expired: t('common.expired'),
          cancelled: t('common.cancelled'),
          pending: t('common.pending'),
        },
        searchPlaceholder: t('reseller.pages.customers.searchPlaceholder'),
        table: {
          customer: t('common.customer'),
          bios: t('reseller.pages.customers.table.bios'),
          program: t('common.program'),
          status: t('common.status'),
          price: t('common.price'),
          expiry: t('common.expiry'),
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
        activationDialog: {
          title: t('reseller.pages.customers.activationDialog.title'),
          description: t('reseller.pages.customers.activationDialog.description'),
          steps: t('reseller.pages.customers.activationDialog.steps', { returnObjects: true }) as string[],
          stepLabel: t('reseller.pages.customers.activationDialog.stepLabel'),
          username: t('activate.username', { defaultValue: 'Username (API)' }),
          usernameHint: t('activate.usernameHint', { defaultValue: 'Letters, numbers, underscores only' }),
          clientName: t('activate.clientName', { defaultValue: 'Client Display Name' }),
          customerEmail: t('reseller.pages.customers.activationDialog.customerEmail'),
          phone: t('common.phone'),
          biosId: t('reseller.pages.customers.activationDialog.biosId'),
          program: t('common.program'),
          selectProgram: t('reseller.pages.customers.activationDialog.selectProgram'),
          basePrice: t('reseller.pages.customers.activationDialog.basePrice'),
          trialDays: t('reseller.pages.customers.activationDialog.trialDays'),
          noDescription: t('reseller.pages.customers.activationDialog.noDescription'),
          duration: t('common.duration'),
          unit: t('common.unit'),
          price: t('common.price'),
          durationDays: t('reseller.pages.customers.activationDialog.durationDays'),
          expiryPreview: t('reseller.pages.customers.activationDialog.expiryPreview'),
          review: t('reseller.pages.customers.activationDialog.review'),
          customer: t('common.customer'),
          email: t('common.email'),
          expiry: t('common.expiry'),
          cancel: t('common.cancel'),
          back: t('common.back'),
          next: t('common.next'),
          activate: t('common.activate'),
          activating: t('reseller.pages.customers.activationDialog.activating'),
        },
        detail: {
          titleFallback: t('reseller.pages.customers.detail.titleFallback'),
          descriptionFallback: t('reseller.pages.customers.detail.descriptionFallback'),
          phone: t('common.phone'),
          bios: t('reseller.pages.customers.detail.bios'),
          program: t('common.program'),
          status: t('common.status'),
          activationHistory: t('reseller.pages.customers.detail.activationHistory'),
          unknownProgram: t('reseller.pages.customers.detail.unknownProgram'),
          activated: t('reseller.pages.customers.detail.activated'),
          expires: t('reseller.pages.customers.detail.expires'),
        },
        renewDialog: {
          title: t('reseller.pages.customers.renewDialog.title'),
          descriptionFallback: t('reseller.pages.customers.renewDialog.descriptionFallback'),
          descriptionWithProgram: (program: string, biosId: string) => t('reseller.pages.customers.renewDialog.descriptionWithProgram', { program, biosId }),
          duration: t('common.duration'),
          unit: t('common.unit'),
          price: t('common.price'),
          cancel: t('common.cancel'),
          renew: t('common.renew'),
          renewing: t('reseller.pages.customers.renewDialog.renewing'),
        },
        deactivateDialog: {
          title: t('reseller.pages.customers.deactivateDialog.title'),
          description: (biosId: string) => t('reseller.pages.customers.deactivateDialog.description', { biosId }),
          confirm: t('common.deactivate'),
        },
        pauseDialog: {
          title: t('reseller.pages.customers.pauseDialog.title'),
          description: (biosId: string) => t('reseller.pages.customers.pauseDialog.description', { biosId }),
        },
        units: {
          minutes: t('common.minutes', { defaultValue: 'Minutes' }),
          hours: t('common.hours', { defaultValue: 'Hours' }),
          days: t('common.days'),
          months: t('common.months'),
          years: t('common.years'),
        },
        toasts: {
          activated: t('reseller.pages.customers.toasts.activated'),
          renewed: t('reseller.pages.customers.toasts.renewed'),
          deactivated: t('reseller.pages.customers.toasts.deactivated'),
          paused: t('reseller.pages.customers.toasts.paused'),
          resumed: t('reseller.pages.customers.toasts.resumed'),
          reactivated: t('reseller.pages.customers.toasts.reactivated'),
        },
        validation: {
          customerName: t('reseller.pages.customers.validation.customerName'),
          nameNotBiosId: t('validation.nameNotBiosId'),
          biosId: t('reseller.pages.customers.validation.biosId'),
          customerEmail: t('reseller.pages.customers.validation.customerEmail'),
          selectProgram: t('reseller.pages.customers.validation.selectProgram'),
          duration: t('reseller.pages.customers.validation.duration'),
          price: t('reseller.pages.customers.validation.price'),
          renew: t('reseller.pages.customers.validation.renew'),
          requestFailed: t('reseller.pages.customers.validation.requestFailed'),
        },
      }), [lang, t])
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all')
  const [programFilter, setProgramFilter] = useState<number | ''>('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [editCustomerId, setEditCustomerId] = useState<number | null>(null)
  const [editClientName, setEditClientName] = useState('')
  const [activationOpen, setActivationOpen] = useState(false)
  const [activationStep, setActivationStep] = useState(0)
  const [activationForm, setActivationForm] = useState<ActivationFormState>(EMPTY_ACTIVATION_FORM)
  const [activationError, setActivationError] = useState('')
  const [renewLicenseId, setRenewLicenseId] = useState<number | null>(null)
  const [renewDuration, setRenewDuration] = useState('30')
  const [renewUnit, setRenewUnit] = useState<DurationUnit>('days')
  const [renewPrice, setRenewPrice] = useState('')
  const [deactivateTarget, setDeactivateTarget] = useState<ResellerCustomerSummary | null>(null)
  const [pauseTarget, setPauseTarget] = useState<ResellerCustomerSummary | null>(null)
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto')
  const [priceInput, setPriceInput] = useState('0.00')

  const customersQuery = useQuery({
    queryKey: ['reseller', 'customers', page, perPage, search, status, programFilter],
    queryFn: () =>
      resellerService.getCustomers({
        page,
        per_page: perPage,
        search,
        status: status === 'all' ? '' : status,
        program_id: programFilter || undefined,
      }),
  })

  const detailQuery = useQuery({
    queryKey: ['reseller', 'customers', 'detail', selectedCustomerId],
    queryFn: () => resellerService.getCustomer(selectedCustomerId ?? 0),
    enabled: selectedCustomerId !== null,
  })

  const programsQuery = useQuery({
    queryKey: ['reseller', 'customers', 'programs'],
    queryFn: () => programService.getAll({ per_page: 100, status: 'active' }),
  })

  const renewLicenseQuery = useQuery({
    queryKey: ['reseller', 'customers', 'renew-license', renewLicenseId],
    queryFn: () => licenseService.getById(renewLicenseId ?? 0),
    enabled: renewLicenseId !== null,
  })

  const activationSteps = text.activationDialog.steps

  const selectedProgram = (programsQuery.data?.data ?? []).find((program) => program.id === activationForm.program_id)
  const basePrice = selectedProgram?.base_price ?? 0
  const durationDays = useMemo(() => {
    if (activationForm.mode === 'end_date' && activationForm.end_date) {
      const endDate = new Date(activationForm.end_date)
      const today = new Date()
      return Math.max(0, (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    }
    return durationToDays(Number(activationForm.duration_value || 0), activationForm.duration_unit)
  }, [activationForm.mode, activationForm.end_date, activationForm.duration_value, activationForm.duration_unit])

  const autoPrice = useMemo(() => {
    if (!selectedProgram || durationDays <= 0) return 0
    return durationDays * basePrice
  }, [selectedProgram, durationDays, basePrice])

  const totalPrice = useMemo(() => {
    if (priceMode === 'auto') {
      return autoPrice
    }
    const price = parseFloat(priceInput || '0')
    return Number.isFinite(price) ? price : 0
  }, [priceMode, autoPrice, priceInput])

  const expiryPreview = useMemo(() => {
    if (durationDays <= 0) return null
    return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
  }, [durationDays])

  const editMutation = useMutation({
    mutationFn: () =>
      resellerService.updateCustomer(editCustomerId ?? 0, { client_name: editClientName.trim() }),
    onSuccess: () => {
      toast.success(t('common.saved', { defaultValue: 'Saved' }))
      setEditCustomerId(null)
      void queryClient.invalidateQueries({ queryKey: ['reseller', 'customers'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.validation.requestFailed)),
  })

  const activateMutation = useMutation({
    mutationFn: () =>
      licenseService.activate({
        customer_name: activationForm.customer_name.trim(),
        client_name: activationForm.client_name.trim() || undefined,
        customer_email: activationForm.customer_email.trim() || undefined,
        customer_phone: activationForm.customer_phone.trim() || undefined,
        bios_id: activationForm.bios_id.trim(),
        program_id: Number(activationForm.program_id),
        duration_days: durationDays,
        price: totalPrice,
      }),
    onSuccess: () => {
      toast.success(text.toasts.activated)
      resetActivationDialog()
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reseller', 'customers'] }),
        queryClient.invalidateQueries({ queryKey: ['reseller', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['reseller', 'licenses'] }),
      ])
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, text.validation.requestFailed)
      setActivationError(message)
      toast.error(message)
    },
  })

  const renewMutation = useMutation({
    mutationFn: () =>
      licenseService.renew(renewLicenseId ?? 0, {
        duration_days: durationToDays(Number(renewDuration), renewUnit),
        price: Number(renewPrice),
      }),
    onSuccess: () => {
      toast.success(text.toasts.renewed)
      setRenewLicenseId(null)
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reseller', 'customers'] }),
        queryClient.invalidateQueries({ queryKey: ['reseller', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['reseller', 'licenses'] }),
      ])
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.validation.requestFailed)),
  })

  const deactivateMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.deactivate(licenseId),
    onSuccess: () => {
      toast.success(text.toasts.deactivated)
      setDeactivateTarget(null)
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reseller', 'customers'] }),
        queryClient.invalidateQueries({ queryKey: ['reseller', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['reseller', 'licenses'] }),
      ])
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.validation.requestFailed)),
  })

  const pauseMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.pause(licenseId),
    onSuccess: () => {
      toast.success(text.toasts.paused)
      setPauseTarget(null)
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reseller', 'customers'] }),
        queryClient.invalidateQueries({ queryKey: ['reseller', 'licenses'] }),
      ])
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.validation.requestFailed)),
  })

  const resumeMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.resume(licenseId),
    onSuccess: () => {
      toast.success(text.toasts.resumed)
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reseller', 'customers'] }),
        queryClient.invalidateQueries({ queryKey: ['reseller', 'licenses'] }),
      ])
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.validation.requestFailed)),
  })

  const columns = useMemo<Array<DataTableColumn<ResellerCustomerSummary>>>(
    () => [
      {
        key: 'customer',
        label: text.table.customer,
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <div>
            <p className="font-medium text-slate-950 dark:text-white">
              <span className={`me-2 inline-block h-2.5 w-2.5 rounded-full ${row.status === 'active' ? 'bg-emerald-500' : row.status === 'pending' ? 'bg-amber-500' : row.status === 'cancelled' ? 'bg-rose-500' : 'bg-slate-400'}`} />
              <button
                type="button"
                className="text-start text-sky-600 hover:underline dark:text-sky-300"
                onClick={(event) => {
                  event.stopPropagation()
                  setSelectedCustomerId(row.id)
                }}
              >
                {isLikelyBios(row.name) ? '-' : row.name}
              </button>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.email ?? '-'}</p>
          </div>
        ),
      },
      {
        key: 'bios',
        label: text.table.bios,
        sortable: true,
        sortValue: (row) => row.bios_id ?? '',
        render: (row) => row.bios_id ? (
          <button
            type="button"
            className="text-sky-600 hover:underline dark:text-sky-300"
            onClick={(event) => {
              event.stopPropagation()
              setSelectedCustomerId(row.id)
            }}
          >
            {rawBiosId(row.bios_id, row.external_username)}
          </button>
        ) : '-',
      },
      { key: 'program', label: text.table.program, sortable: true, sortValue: (row) => row.program ?? '', render: (row) => row.program ?? '-' },
      { key: 'status', label: text.table.status, sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
      { key: 'price', label: text.table.price, sortable: true, sortValue: (row) => row.price, render: (row) => formatCurrency(row.price, 'USD', locale) },
      { key: 'expiry', label: text.table.expiry, sortable: true, sortValue: (row) => row.expiry ?? '', render: (row) => (row.expiry ? formatDate(row.expiry, locale) : '-') },
      {
        key: 'actions',
        label: text.table.actions,
        render: (row) => (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                setSelectedCustomerId(row.id)
              }}
            >
              <Eye className="me-1 h-4 w-4" />
              {text.actions.view}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                setEditCustomerId(row.id)
                setEditClientName(row.client_name ?? row.name ?? '')
              }}
            >
              <Pencil className="me-1 h-4 w-4" />
              {t('common.edit', { defaultValue: 'Edit' })}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="ghost">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {row.status === 'pending' && (
                  <DropdownMenuItem
                    disabled={!row.license_id || resumeMutation.isPending}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (row.license_id) resumeMutation.mutate(row.license_id)
                    }}
                  >
                    <Play className="me-2 h-4 w-4" />
                    {text.actions.resume}
                  </DropdownMenuItem>
                )}
                {row.status === 'cancelled' && (
                  <DropdownMenuItem
                    disabled={!row.license_id || resumeMutation.isPending}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (row.license_id) resumeMutation.mutate(row.license_id)
                    }}
                  >
                    <Play className="me-2 h-4 w-4" />
                    {text.actions.reactivate}
                  </DropdownMenuItem>
                )}
                {row.status !== 'pending' && row.status !== 'cancelled' && (
                  <>
                    <DropdownMenuItem
                      disabled={!row.license_id}
                      onClick={(event) => {
                        event.stopPropagation()
                        setRenewLicenseId(row.license_id)
                        setRenewDuration('30')
                        setRenewUnit('days')
                        setRenewPrice(String(row.price || '0'))
                      }}
                    >
                      <RotateCw className="me-2 h-4 w-4" />
                      {text.actions.renew}
                    </DropdownMenuItem>
                    {row.status === 'active' && (
                      <DropdownMenuItem
                        disabled={!row.license_id}
                        onClick={(event) => {
                          event.stopPropagation()
                          setPauseTarget(row)
                        }}
                      >
                        <Pause className="me-2 h-4 w-4" />
                        {text.actions.pause}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      disabled={!row.license_id}
                      onClick={(event) => {
                        event.stopPropagation()
                        setDeactivateTarget(row)
                      }}
                    >
                      <ShieldOff className="me-2 h-4 w-4" />
                      {text.actions.deactivate}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [locale, text],
  )

  const detailCustomer = detailQuery.data?.data
  const renewLicense = renewLicenseQuery.data?.data

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
        actions={
          <Button type="button" onClick={() => setActivationOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            {text.addCustomer}
          </Button>
        }
      />

      <Tabs
        value={status}
        onValueChange={(value) => {
          setStatus(value as (typeof STATUS_OPTIONS)[number])
          setPage(1)
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
            <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_200px]">
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

          <DataTable
            columns={columns}
            data={customersQuery.data?.data ?? []}
            rowKey={(row) => row.id}
            onRowClick={(row) => setSelectedCustomerId(row.id)}
            isLoading={customersQuery.isLoading}
            pagination={{
              page: customersQuery.data?.meta.current_page ?? 1,
              lastPage: customersQuery.data?.meta.last_page ?? 1,
              total: customersQuery.data?.meta.total ?? 0,
              perPage: customersQuery.data?.meta.per_page ?? perPage,
            }}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPerPage(size)
              setPage(1)
            }}
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={activationOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetActivationDialog()
            return
          }

          setActivationOpen(true)
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{text.activationDialog.title}</DialogTitle>
            <DialogDescription>{text.activationDialog.description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-4">
            {activationSteps.map((label, index) => (
              <div
                key={label}
                className={`rounded-2xl border px-4 py-3 text-sm ${index === activationStep ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/30 dark:text-sky-300' : 'border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400'}`}
              >
                <div className="text-xs uppercase tracking-wide">{text.activationDialog.stepLabel} {index + 1}</div>
                <div className="mt-1 flex items-center gap-2 font-semibold">
                  {index === 0 ? <UserRound className="h-4 w-4" /> : null}
                  {index === 1 ? <Cpu className="h-4 w-4" /> : null}
                  {index === 2 ? <Clock3 className="h-4 w-4" /> : null}
                  {index === 3 ? <CheckCircle2 className="h-4 w-4" /> : null}
                  <span>{label}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${((activationStep + 1) / activationSteps.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{Math.round(((activationStep + 1) / activationSteps.length) * 100)}%</p>
          </div>

          <div className="space-y-4">
            {activationStep === 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label={text.activationDialog.username} htmlFor="customer-name">
                  <Input
                    id="customer-name"
                    value={activationForm.customer_name}
                    onChange={(event) => setActivationForm((current) => ({ ...current, customer_name: event.target.value }))}
                    onBlur={() => setActivationForm((current) => ({ ...current, customer_name: formatUsername(current.customer_name) }))}
                    placeholder={text.activationDialog.usernameHint}
                  />
                </FormField>
                <FormField label={text.activationDialog.clientName} htmlFor="client-name">
                  <Input
                    id="client-name"
                    value={activationForm.client_name}
                    onChange={(event) => setActivationForm((current) => ({ ...current, client_name: event.target.value }))}
                    placeholder={lang === 'ar' ? 'مثال: محمد أحمد' : 'e.g. John Smith'}
                  />
                </FormField>
                <FormField label={text.activationDialog.customerEmail} htmlFor="customer-email">
                  <Input id="customer-email" type="email" value={activationForm.customer_email} onChange={(event) => setActivationForm((current) => ({ ...current, customer_email: event.target.value }))} />
                </FormField>
                <FormField label={text.activationDialog.phone} htmlFor="customer-phone">
                  <Input id="customer-phone" value={activationForm.customer_phone} onChange={(event) => setActivationForm((current) => ({ ...current, customer_phone: event.target.value }))} />
                </FormField>
              </div>
            ) : null}

            {activationStep === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label={text.activationDialog.biosId} htmlFor="bios-id">
                  <Input id="bios-id" value={activationForm.bios_id} onChange={(event) => setActivationForm((current) => ({ ...current, bios_id: event.target.value }))} />
                </FormField>
                <FormField label={text.activationDialog.program} htmlFor="program-id">
                  <select
                    id="program-id"
                    value={activationForm.program_id}
                    onChange={(event) => {
                      const nextId = event.target.value ? Number(event.target.value) : ''

                      setActivationForm((current) => ({
                        ...current,
                        program_id: nextId,
                      }))
                    }}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="">{text.activationDialog.selectProgram}</option>
                    {(programsQuery.data?.data ?? []).map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                {selectedProgram ? (
                  <Card className="md:col-span-2">
                    <CardContent className="grid gap-4 p-4 md:grid-cols-3">
                      <InfoPair label={text.activationDialog.program} value={selectedProgram.name} />
                      <InfoPair label={text.activationDialog.basePrice} value={formatCurrency(selectedProgram.base_price, 'USD', locale)} />
                      <InfoPair label={text.activationDialog.trialDays} value={selectedProgram.trial_days} />
                      <div className="md:col-span-3 text-sm text-slate-500 dark:text-slate-400">{selectedProgram.description || text.activationDialog.noDescription}</div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : null}

            {activationStep === 2 ? (
              <div className="space-y-6">
                {/* Duration Section */}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={activationForm.mode === 'duration' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActivationForm((current) => ({ ...current, mode: 'duration' }))}
                    >
                      Duration
                    </Button>
                    <Button
                      type="button"
                      variant={activationForm.mode === 'end_date' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActivationForm((current) => ({ ...current, mode: 'end_date' }))}
                    >
                      End Date
                    </Button>
                  </div>

                  {activationForm.mode === 'duration' ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <FormField label={text.activationDialog.duration} htmlFor="duration-value">
                          <Input
                            id="duration-value"
                            type="number"
                            min={1}
                            value={activationForm.duration_value}
                            onChange={(event) => setActivationForm((current) => ({ ...current, duration_value: event.target.value }))}
                          />
                        </FormField>
                        <FormField label={text.activationDialog.unit} htmlFor="duration-unit">
                          <select
                            id="duration-unit"
                            value={activationForm.duration_unit}
                            onChange={(event) => setActivationForm((current) => ({ ...current, duration_unit: event.target.value as 'minutes' | 'hours' | 'days' }))}
                            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                          >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">{text.units.days}</option>
                          </select>
                        </FormField>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600 dark:text-slate-400">Quick Presets</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: '30 min', value: '30', unit: 'minutes' },
                            { label: '1 hr', value: '1', unit: 'hours' },
                            { label: '6 hr', value: '6', unit: 'hours' },
                            { label: '1 day', value: '1', unit: 'days' },
                            { label: '7 days', value: '7', unit: 'days' },
                            { label: '30 days', value: '30', unit: 'days' },
                            { label: '90 days', value: '90', unit: 'days' },
                          ].map((preset) => (
                            <Button
                              key={`${preset.value}-${preset.unit}`}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() =>
                                setActivationForm((current) => ({
                                  ...current,
                                  duration_value: preset.value,
                                  duration_unit: preset.unit as 'minutes' | 'hours' | 'days',
                                }))
                              }
                            >
                              {preset.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <FormField label="End Date & Time" htmlFor="end-date-input">
                      <Input
                        id="end-date-input"
                        type="datetime-local"
                        value={activationForm.end_date}
                        onChange={(event) => setActivationForm((current) => ({ ...current, end_date: event.target.value }))}
                      />
                    </FormField>
                  )}
                </div>

                {/* Scheduling Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="schedule-checkbox"
                      checked={activationForm.is_scheduled}
                      onChange={(event) => setActivationForm((current) => ({ ...current, is_scheduled: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <Label htmlFor="schedule-checkbox" className="font-medium">
                      Schedule activation for later
                    </Label>
                  </div>

                  {activationForm.is_scheduled ? (
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={activationForm.schedule_mode === 'relative' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setActivationForm((current) => ({ ...current, schedule_mode: 'relative' }))}
                        >
                          Duration Mode
                        </Button>
                        <Button
                          type="button"
                          variant={activationForm.schedule_mode === 'custom' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setActivationForm((current) => ({ ...current, schedule_mode: 'custom' }))}
                        >
                          Custom Date
                        </Button>
                      </div>

                      {activationForm.schedule_mode === 'relative' ? (
                        <div className="space-y-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <FormField label="Offset Value" htmlFor="schedule-offset-value">
                              <Input
                                id="schedule-offset-value"
                                type="number"
                                min={1}
                                value={activationForm.schedule_offset_value}
                                onChange={(event) => setActivationForm((current) => ({ ...current, schedule_offset_value: event.target.value }))}
                              />
                            </FormField>
                            <FormField label="Offset Unit" htmlFor="schedule-offset-unit">
                              <select
                                id="schedule-offset-unit"
                                value={activationForm.schedule_offset_unit}
                                onChange={(event) => setActivationForm((current) => ({ ...current, schedule_offset_unit: event.target.value as 'minutes' | 'hours' | 'days' }))}
                                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                              >
                                <option value="minutes">Minutes</option>
                                <option value="hours">Hours</option>
                                <option value="days">Days</option>
                              </select>
                            </FormField>
                          </div>
                          <FormField label="Timezone" htmlFor="schedule-timezone">
                            <select
                              id="schedule-timezone"
                              value={activationForm.scheduled_timezone}
                              onChange={(event) => setActivationForm((current) => ({ ...current, scheduled_timezone: event.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                            >
                              <option value="UTC">UTC</option>
                              <option value="America/New_York">America/New_York</option>
                              <option value="America/Chicago">America/Chicago</option>
                              <option value="America/Los_Angeles">America/Los_Angeles</option>
                              <option value="Europe/London">Europe/London</option>
                              <option value="Europe/Paris">Europe/Paris</option>
                              <option value="Asia/Tokyo">Asia/Tokyo</option>
                              <option value="Asia/Dubai">Asia/Dubai</option>
                            </select>
                          </FormField>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <FormField label="Scheduled Date & Time" htmlFor="scheduled-datetime">
                            <Input
                              id="scheduled-datetime"
                              type="datetime-local"
                              value={activationForm.scheduled_date_time}
                              onChange={(event) => setActivationForm((current) => ({ ...current, scheduled_date_time: event.target.value }))}
                            />
                          </FormField>
                          <FormField label="Timezone" htmlFor="scheduled-timezone">
                            <select
                              id="scheduled-timezone"
                              value={activationForm.scheduled_timezone}
                              onChange={(event) => setActivationForm((current) => ({ ...current, scheduled_timezone: event.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                            >
                              <option value="UTC">UTC</option>
                              <option value="America/New_York">America/New_York</option>
                              <option value="America/Chicago">America/Chicago</option>
                              <option value="America/Los_Angeles">America/Los_Angeles</option>
                              <option value="Europe/London">Europe/London</option>
                              <option value="Europe/Paris">Europe/Paris</option>
                              <option value="Asia/Tokyo">Asia/Tokyo</option>
                              <option value="Asia/Dubai">Asia/Dubai</option>
                            </select>
                          </FormField>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Price Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Label className="font-medium">{text.activationDialog.price}</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={priceMode === 'auto' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPriceMode('auto')}
                      >
                        Auto
                      </Button>
                      <Button
                        type="button"
                        variant={priceMode === 'manual' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPriceMode('manual')}
                      >
                        Manual
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={priceMode === 'auto' ? totalPrice.toFixed(2) : priceInput}
                      onChange={(event) => {
                        if (priceMode === 'manual') {
                          setPriceInput(normalizeDecimalInput(event.target.value))
                        }
                      }}
                      readOnly={priceMode === 'auto'}
                      className={priceMode === 'auto' ? 'bg-slate-100 dark:bg-slate-900' : ''}
                    />
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      {priceMode === 'auto' ? 'Auto-calculated' : 'Enter custom price'}
                    </p>
                  </div>
                </div>

                {/* Summary Card */}
                <Card>
                  <CardContent className="grid gap-4 p-4 md:grid-cols-3">
                    <InfoPair label={text.activationDialog.durationDays} value={Math.round(durationDays) || 0} />
                    <InfoPair label={text.activationDialog.expiryPreview} value={expiryPreview ? formatDate(expiryPreview, locale) : '-'} />
                    <InfoPair label={text.activationDialog.price} value={formatCurrency(totalPrice, 'USD', locale)} />
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {activationStep === 3 ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{text.activationDialog.review}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">{text.activationDialog.customer}</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <InfoPair label={text.activationDialog.customer} value={activationForm.customer_name || '-'} />
                        <InfoPair label={text.activationDialog.email} value={activationForm.customer_email || '-'} />
                        <InfoPair label={text.activationDialog.phone} value={activationForm.customer_phone || '-'} />
                        <InfoPair label={text.activationDialog.biosId} value={activationForm.bios_id || '-'} />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{text.activationDialog.program}</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <InfoPair label={text.activationDialog.program} value={selectedProgram?.name ?? '-'} />
                        <InfoPair label={text.activationDialog.duration} value={`${durationDays.toFixed(2)} ${text.units.days}`} />
                        <InfoPair label={text.activationDialog.price} value={formatCurrency(totalPrice, 'USD', locale)} />
                        <InfoPair label={text.activationDialog.expiry} value={expiryPreview ? formatDate(expiryPreview, locale) : '-'} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {activationError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{activationError}</div> : null}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => (activationStep === 0 ? resetActivationDialog() : setActivationStep((current) => current - 1))}>
              {activationStep === 0 ? text.activationDialog.cancel : text.activationDialog.back}
            </Button>
            {activationStep < activationSteps.length - 1 ? (
              <Button
                type="button"
                onClick={() => {
                  const error = validateActivationStep(activationStep, activationForm, text)
                  if (error) {
                    toast.error(error)
                    return
                  }

                  setActivationStep((current) => current + 1)
                }}
              >
                {text.activationDialog.next}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  const error = validateActivationStep(activationStep, activationForm, text)
                  if (error) {
                    toast.error(error)
                    return
                  }

                  setActivationError('')
                  activateMutation.mutate()
                }}
                disabled={activateMutation.isPending}
              >
                {activateMutation.isPending ? text.activationDialog.activating : text.activationDialog.activate}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedCustomerId !== null} onOpenChange={(open) => !open && setSelectedCustomerId(null)}>
        <DialogContent className="left-auto right-0 top-0 h-screen w-[min(100vw,44rem)] max-w-[44rem] translate-x-0 translate-y-0 overflow-y-auto rounded-none rounded-s-3xl">
          <DialogHeader>
            <DialogTitle>{detailCustomer?.name ?? text.detail.titleFallback}</DialogTitle>
            <DialogDescription>{detailCustomer?.email ?? detailCustomer?.phone ?? text.detail.descriptionFallback}</DialogDescription>
          </DialogHeader>
          {detailCustomer ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <InfoCard label={text.detail.phone} value={detailCustomer.phone ?? '-'} />
                <InfoCard label={text.detail.bios} value={detailCustomer.bios_id ?? '-'} />
                <InfoCard label={text.detail.program} value={detailCustomer.program ?? '-'} />
                <InfoCard label={text.detail.status} value={<StatusBadge status={detailCustomer.status} />} />
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold">{text.detail.activationHistory}</h3>
                {detailCustomer.licenses.map((license) => (
                  <div key={license.id} className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-950 dark:text-white">{license.program ?? text.detail.unknownProgram}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{text.detail.bios} {license.bios_id}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{text.detail.activated} {license.activated_at ? formatDate(license.activated_at, locale) : '-'}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={license.status as 'active' | 'expired' | 'suspended' | 'cancelled' | 'inactive' | 'pending'} />
                        <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{formatCurrency(license.price, 'USD', locale)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{text.detail.expires} {license.expires_at ? formatDate(license.expires_at, locale) : '-'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={renewLicenseId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenewLicenseId(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text.renewDialog.title}</DialogTitle>
            <DialogDescription>{renewLicense ? text.renewDialog.descriptionWithProgram(renewLicense.program ?? text.detail.program, renewLicense.bios_id) : text.renewDialog.descriptionFallback}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField label={text.renewDialog.duration} htmlFor="renew-duration">
              <Input id="renew-duration" type="number" min={1} value={renewDuration} onChange={(event) => setRenewDuration(event.target.value)} />
            </FormField>
            <FormField label={text.renewDialog.unit} htmlFor="renew-unit">
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
            </FormField>
            <FormField label={text.renewDialog.price} htmlFor="renew-price">
              <Input id="renew-price" type="number" step="0.01" min={0} value={renewPrice} onChange={(event) => setRenewPrice(event.target.value)} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRenewLicenseId(null)}>
              {text.renewDialog.cancel}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (Number(renewDuration) < 1 || Number(renewPrice) < 0) {
                  toast.error(text.validation.renew)
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

      <ConfirmDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateTarget(null)
          }
        }}
        title={text.deactivateDialog.title}
        description={deactivateTarget ? text.deactivateDialog.description(deactivateTarget.bios_id ?? '-') : undefined}
        confirmLabel={text.deactivateDialog.confirm}
        isDestructive
        onConfirm={() => {
          if (deactivateTarget?.license_id) {
            deactivateMutation.mutate(deactivateTarget.license_id)
          }
        }}
      />

      <ConfirmDialog
        open={pauseTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPauseTarget(null)
        }}
        title={text.pauseDialog.title}
        description={pauseTarget ? text.pauseDialog.description(pauseTarget.bios_id ?? '-') : undefined}
        confirmLabel={text.actions.pause}
        onConfirm={() => {
          if (pauseTarget?.license_id) {
            pauseMutation.mutate(pauseTarget.license_id)
          }
        }}
      />

      <Dialog open={editCustomerId !== null} onOpenChange={(open) => { if (!open) setEditCustomerId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{lang === 'ar' ? 'تعديل اسم العميل' : 'Edit Client Name'}</DialogTitle>
            <DialogDescription>{lang === 'ar' ? 'عدّل الاسم الظاهر لهذا العميل.' : 'Update the display name for this customer.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label={lang === 'ar' ? 'الاسم الظاهر' : 'Client Display Name'} htmlFor="edit-client-name">
              <Input
                id="edit-client-name"
                value={editClientName}
                onChange={(event) => setEditClientName(event.target.value)}
                autoFocus
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditCustomerId(null)}>
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (editClientName.trim().length < 1) return
                editMutation.mutate()
              }}
              disabled={editMutation.isPending || editClientName.trim().length < 1}
            >
              {editMutation.isPending ? (lang === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  function resetActivationDialog() {
    setActivationOpen(false)
    setActivationStep(0)
    setActivationForm(EMPTY_ACTIVATION_FORM)
    setActivationError('')
  }
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function InfoPair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 font-semibold text-slate-950 dark:text-white">{value}</div>
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function normalizeDecimalInput(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const num = parseFloat(trimmed)
  if (!Number.isFinite(num)) return ''
  return String(num)
}

function durationToDays(value: number, unit: 'minutes' | 'hours' | 'days' | 'months' | 'years'): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  switch (unit) {
    case 'minutes':
      return value / 1440
    case 'hours':
      return value / 24
    case 'months':
      return value * 30
    case 'years':
      return value * 365
    default:
      return value
  }
}

function validateActivationStep(step: number, form: ActivationFormState, text: {
  validation: {
    customerName: string
    nameNotBiosId: string
    customerEmail: string
    biosId: string
    selectProgram: string
    duration: string
    price: string
  }
}) {
  if (step === 0) {
    if (form.customer_name.trim().length < 2) {
      return text.validation.customerName
    }

    if (isLikelyBios(form.customer_name.trim())) {
      return text.validation.nameNotBiosId
    }

    if (form.customer_email.trim() && !/\S+@\S+\.\S+/.test(form.customer_email.trim())) {
      return text.validation.customerEmail
    }
  }

  if (step === 1) {
    if (form.bios_id.trim().length < 5) {
      return text.validation.biosId
    }

    if (!form.program_id) {
      return text.validation.selectProgram
    }
  }

  if (step >= 2) {
    if (Number(form.duration_value) < 1 && form.mode === 'duration') {
      return text.validation.duration
    }

    if (form.mode === 'end_date' && !form.end_date) {
      return text.validation.duration
    }
  }

  return ''
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined)?.message
      ?? Object.values((error.response?.data as { errors?: Record<string, string[]> } | undefined)?.errors ?? {})[0]?.[0]
      ?? fallback
  }

  return fallback
}


function isLikelyBios(value: string): boolean {
  void value
  return false
}

