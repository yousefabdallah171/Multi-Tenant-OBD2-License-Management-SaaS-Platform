import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, Cpu, Eye, FileText, MoreVertical, Pause, Pencil, Play, Plus, RotateCw, UserRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { StatusFilterCard } from '@/components/customers/StatusFilterCard'
import { EditCustomerDialog } from '@/components/customers/EditCustomerDialog'
import { CustomerNoteDialog } from '@/components/customers/CustomerNoteDialog'
import { RenewLicenseDialog } from '@/components/licenses/RenewLicenseDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { ExportButtons } from '@/components/shared/ExportButtons'
import { LicenseStatusBadges } from '@/components/shared/LicenseStatusBadges'
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
import { useResolvedTimezone } from '@/hooks/useResolvedTimezone'
import { useLanguage } from '@/hooks/useLanguage'
import { getActivationDurationPresets } from '@/lib/activation-presets'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { getCountryCodeByName } from '@/lib/countries'
import { liveQueryOptions, LIVE_QUERY_INTERVAL } from '@/lib/live-query'
import { COMMON_TIMEZONES, formatDateTimeLocalInTimezone } from '@/lib/timezones'
import { canReactivateLicense, canRetryScheduledLicense, formatCurrency, formatDate, formatLicenseDurationDays, getLicenseDisplayStatus, getLicenseStartDate, getStatusMeaning, isLikelyBios, isPausedPendingLicense, isPlainPendingLicense, resolveLicenseDurationDays, shouldRenewLicense } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { licenseService } from '@/services/license.service'
import { programService } from '@/services/program.service'
import { resellerService } from '@/services/reseller.service'
import { formatUsername, rawBiosId } from '@/utils/biosId'
import { FlagImage } from '@/utils/countryFlag'
import type { RenewLicenseData, ResellerCustomerSummary } from '@/types/manager-reseller.types'

const STATUS_OPTIONS = ['all', 'active', 'suspended', 'scheduled', 'expired', 'cancelled', 'pending'] as const

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

function createEmptyActivationForm(defaultTimezone: string): ActivationFormState {
  return {
    customer_name: '',
    client_name: '',
    customer_email: '',
    customer_phone: '',
    bios_id: '',
    program_id: '',
    duration_value: '30',
    duration_unit: 'days',
    mode: 'end_date',
    end_date: formatDateTimeLocalInTimezone(new Date(Date.now() + 30 * 86400000), defaultTimezone),
    is_scheduled: false,
    schedule_mode: 'relative',
    schedule_offset_value: '1',
    schedule_offset_unit: 'hours',
    scheduled_date_time: '',
    scheduled_timezone: defaultTimezone,
  }
}

export function CustomersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const { timezone: displayTimezone } = useResolvedTimezone()
  const durationPresets = useMemo(() => getActivationDurationPresets(t), [t])
  const text = useMemo(() => (lang === 'ar'
    ? {
        eyebrow: 'موزع',
        title: 'العملاء',
        description: 'أنشئ العملاء وفعلهم ثم أدِر عمليات التجديد والإلغاء من مساحة عملك الشخصية كموزع.',
        addCustomer: 'إضافة عميل',
        statusOptions: { all: 'الكل', active: 'نشط', expired: 'منتهي', cancelled: 'ملغي', pending: 'قيد الانتظار' },
        searchPlaceholder: 'ابحث بالاسم أو البريد الإلكتروني أو BIOS ID',
        table: {
          customer: 'العميل',
          bios: 'BIOS ID',
          phone: t('common.phone'),
          program: 'البرنامج',
          status: 'الحالة',
          price: 'السعر',
          expiry: 'الانتهاء',
          actions: 'الإجراءات',
        },
        actions: { view: 'عرض', renew: 'تجديد', pause: 'إيقاف', resume: 'استئناف', reactivate: 'إعادة تفعيل', continue: 'متابعة' },
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
        pauseDialog: {
          title: 'إيقاف الترخيص؟',
          description: (biosId: string) => `سيؤدي هذا إلى إيقاف الترخيص مؤقتاً لـ BIOS ID: ${biosId}`,
        },
        units: { minutes: 'دقائق', hours: 'ساعات', days: 'أيام', months: 'أشهر', years: 'سنوات' },
        toasts: {
          activated: 'تم تفعيل الترخيص بنجاح.',
          renewed: 'تم تجديد الترخيص بنجاح.',
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
          phone: t('common.phone'),
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
          pause: t('common.pause'),
          resume: t('common.resume'),
          reactivate: t('common.reactivate'),
          continue: t('common.continue', { defaultValue: 'Continue' }),
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
  const initialStatus = searchParams.get('status')
  const [page, setPage] = useState(Number(searchParams.get('page') || 1))
  const [perPage, setPerPage] = useState(Number(searchParams.get('per_page') || 25))
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>(
    STATUS_OPTIONS.includes((initialStatus ?? 'all') as (typeof STATUS_OPTIONS)[number]) ? (initialStatus as (typeof STATUS_OPTIONS)[number]) : 'all',
  )
  const [programFilter, setProgramFilter] = useState<number | ''>(searchParams.get('program_id') ? Number(searchParams.get('program_id')) : '')
  const [countryName, setCountryName] = useState(searchParams.get('country_name') || '')
  const [editTarget, setEditTarget] = useState<ResellerCustomerSummary | null>(null)
  const [notesCustomerId, setNotesCustomerId] = useState<number | null>(null)
  const [activationOpen, setActivationOpen] = useState(false)
  const [activationStep, setActivationStep] = useState(0)
  const [activationForm, setActivationForm] = useState<ActivationFormState>(() => createEmptyActivationForm(displayTimezone))
  const [activationError, setActivationError] = useState('')
  const [pauseTarget, setPauseTarget] = useState<ResellerCustomerSummary | null>(null)
  const [pauseReason, setPauseReason] = useState('')
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto')
  const [priceInput, setPriceInput] = useState('0.00')
  const [selectedLicenseIds, setSelectedLicenseIds] = useState<number[]>([])
  const [bulkRenewOpen, setBulkRenewOpen] = useState(false)
  const customerFilterParams = useMemo(
    () => ({
      search: search || undefined,
      program_id: programFilter || undefined,
      country_name: countryName || undefined,
    }),
    [countryName, programFilter, search],
  )
  const exportParams = useMemo(
    () => ({
      ...customerFilterParams,
      status: status === 'all' ? '' : status,
    }),
    [customerFilterParams, status],
  )

  const customersQuery = useQuery({
    queryKey: ['reseller', 'customers', page, perPage, search, status, programFilter, countryName],
    queryFn: () =>
      resellerService.getCustomers({
        page,
        per_page: perPage,
        ...customerFilterParams,
        status: status === 'all' ? '' : status,
      }),
    ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_LIST),
  })

  const programsQuery = useQuery({
    queryKey: ['reseller', 'customers', 'programs'],
    queryFn: () => programService.getAll({ per_page: 100, status: 'active' }),
  })
  const countryOptionsQuery = useQuery({
    queryKey: ['reseller', 'customers', 'countries', search, status, programFilter],
    queryFn: () => resellerService.getCustomerCountries({
      search: search || undefined,
      status: status === 'all' ? '' : status,
      program_id: programFilter || undefined,
    }),
  })

  const [allCountQuery, activeCountQuery, scheduledCountQuery, expiredCountQuery, cancelledCountQuery, pendingCountQuery] = useQueries({
    queries: [
      { queryKey: ['reseller', 'customers', 'count', 'all', customerFilterParams], queryFn: () => resellerService.getCustomers({ page: 1, per_page: 1, ...customerFilterParams }), ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS) },
      { queryKey: ['reseller', 'customers', 'count', 'active', customerFilterParams], queryFn: () => resellerService.getCustomers({ page: 1, per_page: 1, ...customerFilterParams, status: 'active' }), ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS) },
      { queryKey: ['reseller', 'customers', 'count', 'scheduled', customerFilterParams], queryFn: () => resellerService.getCustomers({ page: 1, per_page: 1, ...customerFilterParams, status: 'scheduled' }), ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS) },
      { queryKey: ['reseller', 'customers', 'count', 'expired', customerFilterParams], queryFn: () => resellerService.getCustomers({ page: 1, per_page: 1, ...customerFilterParams, status: 'expired' }), ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS) },
      { queryKey: ['reseller', 'customers', 'count', 'cancelled', customerFilterParams], queryFn: () => resellerService.getCustomers({ page: 1, per_page: 1, ...customerFilterParams, status: 'cancelled' }), ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS) },
      { queryKey: ['reseller', 'customers', 'count', 'pending', customerFilterParams], queryFn: () => resellerService.getCustomers({ page: 1, per_page: 1, ...customerFilterParams, status: 'pending' }), ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS) },
    ],
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
    mutationFn: (payload: { client_name: string; email?: string; phone?: string }) =>
      resellerService.updateCustomer(editTarget?.id ?? 0, payload),
    onSuccess: () => {
      toast.success(t('common.customerUpdatedSuccess', { defaultValue: 'Customer updated successfully.' }))
      setEditTarget(null)
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
        is_scheduled: activationForm.is_scheduled || undefined,
        scheduled_date_time: activationForm.is_scheduled ? buildScheduledDateTime(activationForm) : undefined,
        scheduled_timezone: activationForm.is_scheduled ? activationForm.scheduled_timezone : undefined,
    }),
    onSuccess: () => {
      toast.success(
        activationForm.is_scheduled
          ? t('common.activationScheduledSuccess', { defaultValue: 'Activation scheduled successfully.' })
          : t('common.licenseActivatedSuccess', { defaultValue: 'License activated successfully.' }),
      )
      resetActivationDialog()
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reseller', 'customers'] }),
        queryClient.invalidateQueries({ queryKey: ['reseller', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['reseller', 'licenses'] }),
      ])
    },
    onError: (error: any) => {
      const message = getApiErrorMessage(error, text.validation.requestFailed)
      setActivationError(message)
      // Auto-clear email if it conflicts with a non-customer account
      const apiErrors = error?.response?.data?.errors ?? {}
      if (apiErrors.customer_email) {
        setActivationForm((current) => ({ ...current, customer_email: '' }))
      }
    },
  })

  const pauseMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.pause(licenseId, { pause_reason: pauseReason.trim() || undefined }),
    onSuccess: () => {
      toast.success(text.toasts.paused)
      setPauseTarget(null)
      setPauseReason('')
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

  const cancelPendingMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.cancelPending(licenseId),
    onSuccess: () => {
      toast.success(lang === 'ar' ? 'تم إلغاء الترخيص المعلق بنجاح.' : 'Pending license cancelled successfully.')
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reseller', 'customers'] }),
        queryClient.invalidateQueries({ queryKey: ['reseller', 'licenses'] }),
      ])
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.validation.requestFailed)),
  })

  const retryScheduledMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.retryScheduled(licenseId),
    onSuccess: () => {
      toast.success(t('common.retrySuccess', { defaultValue: 'Scheduled activation retried successfully.' }))
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reseller', 'customers'] }),
        queryClient.invalidateQueries({ queryKey: ['reseller', 'licenses'] }),
      ])
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.validation.requestFailed)),
  })

  const cancelScheduledMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.cancelScheduled(licenseId),
    onSuccess: () => {
      toast.success(t('common.cancelScheduledSuccess', { defaultValue: 'Scheduled activation cancelled successfully.' }))
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reseller', 'customers'] }),
        queryClient.invalidateQueries({ queryKey: ['reseller', 'licenses'] }),
      ])
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.validation.requestFailed)),
  })

  const bulkRenewMutation = useMutation({
    mutationFn: (payload: RenewLicenseData) => licenseService.bulkRenew(selectedLicenseIds, payload),
    onSuccess: () => {
      toast.success(t('reseller.pages.licenses.toasts.bulkRenewed'))
      setBulkRenewOpen(false)
      setSelectedLicenseIds([])
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reseller', 'customers'] }),
        queryClient.invalidateQueries({ queryKey: ['reseller', 'licenses'] }),
      ])
    },
    onError: (error) => toast.error(getApiErrorMessage(error, text.validation.requestFailed)),
  })

  const customerRows = customersQuery.data?.data ?? []
  const selectableIds = customerRows
    .filter((row) => typeof row.license_id === 'number')
    .map((row) => row.license_id as number)
  const allVisibleSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedLicenseIds.includes(id))
  const someVisibleSelected = selectableIds.some((id) => selectedLicenseIds.includes(id))

  const columns = useMemo<Array<DataTableColumn<ResellerCustomerSummary>>>(
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
                setSelectedLicenseIds((current) => [...new Set([...current, ...selectableIds])])
                return
              }
              setSelectedLicenseIds((current) => current.filter((id) => !selectableIds.includes(id)))
            }}
          />
        ),
      render: (row) => typeof row.license_id === 'number' ? (
        <input
          type="checkbox"
          checked={selectedLicenseIds.includes(row.license_id)}
          onChange={(event) => {
            if (event.target.checked) {
              setSelectedLicenseIds((current) => [...new Set([...current, row.license_id!])])
              return
            }
            setSelectedLicenseIds((current) => current.filter((id) => id !== row.license_id!))
          }}
        />
      ) : null,
      },
      {
        key: 'customer',
        label: text.table.customer,
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <div>
            <p className="font-medium text-slate-950 dark:text-white">
              <span className={`me-2 inline-block h-2.5 w-2.5 rounded-full ${row.status === 'active' ? 'bg-emerald-500' : row.status === 'pending' ? 'bg-amber-500' : row.status === 'cancelled' ? 'bg-rose-500' : row.status === 'expired' ? 'bg-rose-400' : 'bg-slate-400'}`} />
              <Link
                className="text-start text-brand-600 hover:underline dark:text-brand-400"
                to={routePaths.reseller.customerDetail(lang, row.id)}
              >
                {resolveResellerCustomerLabel(row)}
              </Link>
            </p>
          </div>
        ),
      },
      {
        key: 'username',
        label: t('common.username'),
        sortable: true,
        sortValue: (row) => resolveResellerCustomerUsername(row),
        render: (row) => (
          <Link className="font-medium text-brand-600 hover:underline dark:text-brand-400" to={routePaths.reseller.customerDetail(lang, row.id)}>
            {resolveResellerCustomerUsername(row)}
          </Link>
        ),
      },
      {
        key: 'bios',
        label: text.table.bios,
        sortable: true,
        sortValue: (row) => row.bios_id ?? '',
        render: (row) => row.bios_id ? (
          <Link
            className="text-brand-600 hover:underline dark:text-brand-400"
            to={routePaths.reseller.customerDetail(lang, row.id)}
          >
            {rawBiosId(row.bios_id, row.external_username)}
          </Link>
        ) : '-',
      },
        {
          key: 'phone',
          label: text.table.phone,
          defaultHidden: true,
          sortable: true,
          sortValue: (row) => row.phone ?? '',
          render: (row) => row.phone ?? '-',
        },
        {
          key: 'country',
          label: t('common.country', { defaultValue: 'Country' }),
          sortable: true,
          defaultHidden: true,
          sortValue: (row) => row.country_name ?? '',
          render: (row) => row.country_name ? (
            <span className="inline-flex items-center gap-2">
              <FlagImage code={getCountryCodeByName(row.country_name)} country={row.country_name} />
              <span>{row.country_name}</span>
            </span>
          ) : '-',
        },
        {
          key: 'duration',
          label: t('common.duration'),
          sortable: true,
          sortValue: (row) => resolveLicenseDurationDays(row.duration_days, getLicenseStartDate(row), row.expiry) ?? 0,
          render: (row) => formatLicenseDurationDays(row.duration_days, t, getLicenseStartDate(row), row.expiry),
        },
        { key: 'program', label: text.table.program, sortable: true, defaultHidden: true, sortValue: (row) => row.program ?? '', render: (row) => row.program ?? '-' },
      { key: 'start', label: t('common.start', { defaultValue: 'Start' }), sortable: true, defaultHidden: true, sortValue: (row) => String(getLicenseStartDate(row) ?? ''), render: (row) => (getLicenseStartDate(row) ? formatDate(getLicenseStartDate(row)!, locale, displayTimezone) : '-') },
      {
        key: 'status',
        label: text.table.status,
        sortable: true,
        sortValue: (row) => row.status ? getLicenseDisplayStatus(row) : '',
        render: (row) => row.status ? (
          <div className="flex flex-col items-start gap-1">
            <div className="relative inline-flex">
              <LicenseStatusBadges status={getLicenseDisplayStatus(row)} isBlocked={Boolean(row.is_blacklisted)} />
              {isPlainPendingLicense(row) ? (
                <span className="absolute -right-2 -top-2 inline-flex items-center rounded-full border border-fuchsia-200 bg-fuchsia-100 px-1.5 py-0.5 text-sm font-semibold leading-none text-fuchsia-700 shadow-sm dark:border-fuchsia-900/60 dark:bg-fuchsia-950/50 dark:text-fuchsia-300">
                  {t('common.new', { defaultValue: lang === 'ar' ? 'جديد' : 'New' })}
                </span>
              ) : null}
            </div>
            {isPausedPendingLicense(row) && row.paused_by_role != null && row.paused_by_role !== 'reseller' ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {t('customers.pausedByAdmin')}
              </span>
            ) : null}
          </div>
        ) : '-',
      },
      { key: 'reason', label: t('common.reason'), sortable: true, defaultHidden: true, sortValue: (row) => row.pause_reason ?? '', render: (row) => isPausedPendingLicense(row) ? (row.pause_reason ?? '-') : '-' },
      { key: 'price', label: text.table.price, sortable: true, sortValue: (row) => row.price, render: (row) => formatCurrency(row.price, 'USD', locale) },
      { key: 'expiry', label: text.table.expiry, sortable: true, defaultHidden: true, sortValue: (row) => row.expiry ?? '', render: (row) => (row.expiry ? formatDate(row.expiry, locale, displayTimezone) : '-') },
      {
        key: 'actions',
        label: text.table.actions,
      render: (row) => {
        const displayStatus = getLicenseDisplayStatus(row)
        const isScheduleEditable = displayStatus === 'scheduled' || displayStatus === 'scheduled_failed'
        const isPausedPending = isPausedPendingLicense(row)
        const isPlainPending = isPlainPendingLicense(row)
        const isBlacklisted = Boolean(row.is_blacklisted)
        const isBiosActiveElsewhere = Boolean(row.bios_active_elsewhere)
        const renewActionLabel = displayStatus === 'active'
          ? text.actions.renew
          : displayStatus === 'cancelled'
            ? text.actions.reactivate
          : isScheduleEditable
            ? t('common.editSchedule', { defaultValue: 'Edit Schedule' })
            : isPlainPending
              ? t('common.activate', { defaultValue: 'Activate' })
              : text.actions.renew

          return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="ghost">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={routePaths.reseller.customerDetail(lang, row.id)}>
                  <Eye className="me-2 h-4 w-4" />
                  {text.actions.view}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation()
                  setNotesCustomerId(row.id)
                }}
              >
                <FileText className="me-2 h-4 w-4" />
                {t('common.notes', { defaultValue: 'Notes' })}
              </DropdownMenuItem>
              {typeof row.license_id === 'number' && !isBlacklisted && !isBiosActiveElsewhere ? (
                <DropdownMenuItem asChild>
                  <Link to={routePaths.reseller.customerBiosChangeRequest(lang, row.id)}>
                    <Cpu className="me-2 h-4 w-4" />
                    {t('biosChangeRequests.requestAction', { defaultValue: 'Request BIOS ID Change' })}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                disabled={isBlacklisted}
                onClick={(event) => {
                  event.stopPropagation()
                  setEditTarget(row)
                }}
              >
                <Pencil className="me-2 h-4 w-4" />
                {t('common.edit', { defaultValue: 'Edit' })}
              </DropdownMenuItem>
                {typeof row.license_id === 'number' && (displayStatus === 'active' || shouldRenewLicense(row)) && !isBlacklisted && !isBiosActiveElsewhere && (
                  <DropdownMenuItem
                    onClick={(event) => {
                      event.stopPropagation()
                      navigate(routePaths.reseller.licenseRenew(lang, row.license_id!), {
                        state: { returnTo: `${location.pathname}${location.search}` },
                      })
                    }}
                  >
                    <RotateCw className="me-2 h-4 w-4" />
                    {renewActionLabel}
                  </DropdownMenuItem>
                )}
                {typeof row.license_id === 'number' && canRetryScheduledLicense(row) && (
                  <DropdownMenuItem
                    disabled={retryScheduledMutation.isPending}
                    onClick={(event) => {
                      event.stopPropagation()
                      retryScheduledMutation.mutate(row.license_id!)
                    }}
                  >
                    <Play className="me-2 h-4 w-4" />
                    {t('common.retryNow', { defaultValue: 'Retry Now' })}
                  </DropdownMenuItem>
                )}
                {typeof row.license_id === 'number' && (getLicenseDisplayStatus(row) === 'scheduled' || getLicenseDisplayStatus(row) === 'scheduled_failed') && (
                  <DropdownMenuItem
                    disabled={cancelScheduledMutation.isPending}
                    onClick={(event) => {
                      event.stopPropagation()
                      cancelScheduledMutation.mutate(row.license_id!)
                    }}
                  >
                    <X className="me-2 h-4 w-4" />
                    {t('common.cancelScheduled')}
                  </DropdownMenuItem>
                )}
                {typeof row.license_id === 'number' && canReactivateLicense(row) && !isBlacklisted && !isBiosActiveElsewhere && !(isPausedPending && row.paused_by_role != null && row.paused_by_role !== 'reseller') && (
                  <DropdownMenuItem
                    disabled={resumeMutation.isPending}
                    onClick={(event) => {
                      event.stopPropagation()
                      resumeMutation.mutate(row.license_id!)
                    }}
                  >
                    <Play className="me-2 h-4 w-4" />
                    {isPausedPending ? text.actions.continue : text.actions.reactivate}
                  </DropdownMenuItem>
                )}
                {typeof row.license_id === 'number' && isPlainPending && (
                  <DropdownMenuItem
                    disabled={cancelPendingMutation.isPending}
                    onClick={(event) => {
                      event.stopPropagation()
                      cancelPendingMutation.mutate(row.license_id!)
                    }}
                  >
                    <X className="me-2 h-4 w-4" />
                    {lang === 'ar' ? 'إلغاء المعلق' : 'Cancel Pending'}
                  </DropdownMenuItem>
                )}
                {typeof row.license_id === 'number' && displayStatus === 'active' && !isBlacklisted && (
                  <DropdownMenuItem
                    onClick={(event) => {
                      event.stopPropagation()
                      setPauseTarget(row)
                    }}
                  >
                    <Pause className="me-2 h-4 w-4" />
                    {text.actions.pause}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [allVisibleSelected, lang, locale, location.pathname, location.search, navigate, selectedLicenseIds, selectableIds, someVisibleSelected, text, retryScheduledMutation.isPending, cancelPendingMutation.isPending, t],
  )

  // Reset all filters when navigating to clean URL (e.g. sidebar click)
  useEffect(() => {
    if (searchParams.toString() === '') {
      setPage(1)
      setPerPage(25)
      setSearch('')
      setStatus('all')
      setProgramFilter('')
      setCountryName('')
    }
  }, [searchParams])

  useEffect(() => {
    const next = new URLSearchParams()
    if (page > 1) next.set('page', String(page))
    if (perPage !== 25) next.set('per_page', String(perPage))
    if (search) next.set('search', search)
    if (status !== 'all') next.set('status', status)
    if (programFilter) next.set('program_id', String(programFilter))
    if (countryName) next.set('country_name', countryName)
    setSearchParams(next, { replace: true })
  }, [countryName, page, perPage, programFilter, search, setSearchParams, status])
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
        actions={
          <div className="flex flex-wrap gap-3">
            <ExportButtons
              onExportCsv={() => resellerService.exportCustomersXlsx(exportParams)}
              onExportPdf={() => resellerService.exportCustomersPdf(exportParams)}
            />
            <Button type="button" onClick={() => navigate(routePaths.reseller.customerCreate(lang))}>
              <Plus className="me-2 h-4 w-4" />
              {text.addCustomer}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        <StatusFilterCard
          label={text.statusOptions.all}
          count={allCountQuery.data?.meta.total ?? 0}
          isActive={status === 'all'}
          onClick={() => {
            setStatus('all')
            setPage(1)
          }}
          color="sky"
        />
        <StatusFilterCard
          label={text.statusOptions.active}
          description={getStatusMeaning('active', t)}
          count={activeCountQuery.data?.meta.total ?? 0}
          isActive={status === 'active'}
          onClick={() => {
            setStatus('active')
            setPage(1)
          }}
          color="emerald"
        />
        <StatusFilterCard
          label={t('common.scheduled', { defaultValue: 'Scheduled' })}
          description={getStatusMeaning('scheduled', t)}
          count={scheduledCountQuery.data?.meta.total ?? 0}
          isActive={status === 'scheduled'}
          onClick={() => {
            setStatus('scheduled')
            setPage(1)
          }}
          color="amber"
        />
        <StatusFilterCard
          label={text.statusOptions.expired}
          description={getStatusMeaning('expired', t)}
          count={expiredCountQuery.data?.meta.total ?? 0}
          isActive={status === 'expired'}
          onClick={() => {
            setStatus('expired')
            setPage(1)
          }}
          color="rose"
        />
        <StatusFilterCard
          label={text.statusOptions.cancelled}
          description={getStatusMeaning('cancelled', t)}
          count={cancelledCountQuery.data?.meta.total ?? 0}
          isActive={status === 'cancelled'}
          onClick={() => {
            setStatus('cancelled')
            setPage(1)
          }}
          color="slate"
        />
        <StatusFilterCard
          label={text.statusOptions.pending}
          description={getStatusMeaning('pending', t)}
          count={pendingCountQuery.data?.meta.total ?? 0}
          isActive={status === 'pending'}
          onClick={() => {
            setStatus('pending')
            setPage(1)
          }}
          color="amber"
        />
      </div>

      <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_180px_220px]">
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder={text.searchPlaceholder}
                className="h-9 text-sm"
              />
              <select
                value={programFilter}
                onChange={(event) => {
                  setProgramFilter(event.target.value ? Number(event.target.value) : '')
                  setPage(1)
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="">{lang === 'ar' ? 'كل البرامج' : 'All Programs'}</option>
                {(programsQuery.data?.data ?? []).map((program) => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </select>
              <select
                value={countryName}
                onChange={(event) => {
                  setCountryName(event.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="">{t('common.allCountries', { defaultValue: 'All countries' })}</option>
                {(countryOptionsQuery.data?.data ?? []).map((country) => (
                  <option key={country.country_name} value={country.country_name}>{country.country_name} ({country.count})</option>
                ))}
              </select>
            </CardContent>
          </Card>

          {selectedLicenseIds.length > 0 ? (
            <Card className="border-brand-200/60 bg-brand-50/40 dark:border-brand-900/40 dark:bg-brand-950/20">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="text-sm text-slate-600 dark:text-slate-300">{selectedLicenseIds.length} {t('common.selected', { defaultValue: 'selected' })}</span>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => setBulkRenewOpen(true)}>{t('reseller.pages.licenses.bulkRenew')}</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <DataTable
            tableKey="reseller_customers"
            columns={columns}
            data={customerRows}
            rowKey={(row) => row.id}
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
      </div>

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
                <div className="text-sm uppercase tracking-wide">{text.activationDialog.stepLabel} {index + 1}</div>
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
            <p className="text-sm text-slate-500 dark:text-slate-400">{Math.round(((activationStep + 1) / activationSteps.length) * 100)}%</p>
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
                  <Input id="customer-phone" value={activationForm.customer_phone} onChange={(event) => setActivationForm((current) => ({ ...current, customer_phone: normalizePhoneInput(event.target.value) }))} />
                </FormField>
              </div>
            ) : null}

            {activationStep === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label={text.activationDialog.biosId} htmlFor="bios-id">
                  <Input id="bios-id" value={activationForm.bios_id} maxLength={255} onChange={(event) => setActivationForm((current) => ({ ...current, bios_id: event.target.value }))} />
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
                    <CardContent className="grid gap-4 p-4 md:grid-cols-2">
                      <InfoPair label={text.activationDialog.program} value={selectedProgram.name} />
                      <InfoPair label={text.activationDialog.trialDays} value={selectedProgram.trial_days} />
                      <div className="md:col-span-2 text-sm text-slate-500 dark:text-slate-400">{selectedProgram.description || text.activationDialog.noDescription}</div>
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
                      {t('activate.durationMode')}
                    </Button>
                    <Button
                      type="button"
                      variant={activationForm.mode === 'end_date' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActivationForm((current) => ({ ...current, mode: 'end_date' }))}
                    >
                      {t('common.endDate', { defaultValue: 'End Date' })}
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
                            <option value="minutes">{t('common.minutes', { defaultValue: 'Minutes' })}</option>
                            <option value="hours">{t('common.hours', { defaultValue: 'Hours' })}</option>
                            <option value="days">{text.units.days}</option>
                          </select>
                        </FormField>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">{t('activate.quickPresets', { defaultValue: 'Quick Presets' })}</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {durationPresets.map((preset) => (
                            <Button
                              key={`${preset.value}-${preset.unit}`}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-sm"
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
                    <FormField label={t('activate.endDateTime', { defaultValue: 'End Date & Time' })} htmlFor="end-date-input">
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
                      {t('activate.scheduleToggle')}
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
                          {t('activate.scheduleModeRelative', { defaultValue: 'Duration Mode' })}
                        </Button>
                        <Button
                          type="button"
                          variant={activationForm.schedule_mode === 'custom' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setActivationForm((current) => ({ ...current, schedule_mode: 'custom' }))}
                        >
                          {t('activate.scheduleModeCustom', { defaultValue: 'Custom Date' })}
                        </Button>
                      </div>

                      {activationForm.schedule_mode === 'relative' ? (
                        <div className="space-y-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <FormField label={t('activate.offsetValue', { defaultValue: 'Offset Value' })} htmlFor="schedule-offset-value">
                              <Input
                                id="schedule-offset-value"
                                type="number"
                                min={1}
                                value={activationForm.schedule_offset_value}
                                onChange={(event) => setActivationForm((current) => ({ ...current, schedule_offset_value: event.target.value }))}
                              />
                            </FormField>
                            <FormField label={t('activate.offsetUnit', { defaultValue: 'Offset Unit' })} htmlFor="schedule-offset-unit">
                              <select
                                id="schedule-offset-unit"
                                value={activationForm.schedule_offset_unit}
                                onChange={(event) => setActivationForm((current) => ({ ...current, schedule_offset_unit: event.target.value as 'minutes' | 'hours' | 'days' }))}
                                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                              >
                                <option value="minutes">{t('common.minutes', { defaultValue: 'Minutes' })}</option>
                                <option value="hours">{t('common.hours', { defaultValue: 'Hours' })}</option>
                                <option value="days">{t('common.days', { defaultValue: 'Days' })}</option>
                              </select>
                            </FormField>
                          </div>
                          <FormField label={t('activate.timezone', { defaultValue: 'Timezone' })} htmlFor="schedule-timezone">
                            <select
                              id="schedule-timezone"
                              value={activationForm.scheduled_timezone}
                              onChange={(event) => setActivationForm((current) => ({ ...current, scheduled_timezone: event.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                            >
                              {COMMON_TIMEZONES.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                              ))}
                            </select>
                          </FormField>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <FormField label={t('activate.scheduledDateTime', { defaultValue: 'Scheduled Date & Time' })} htmlFor="scheduled-datetime">
                            <Input
                              id="scheduled-datetime"
                              type="datetime-local"
                              value={activationForm.scheduled_date_time}
                              onChange={(event) => setActivationForm((current) => ({ ...current, scheduled_date_time: event.target.value }))}
                            />
                          </FormField>
                          <FormField label={t('activate.timezone', { defaultValue: 'Timezone' })} htmlFor="scheduled-timezone">
                            <select
                              id="scheduled-timezone"
                              value={activationForm.scheduled_timezone}
                              onChange={(event) => setActivationForm((current) => ({ ...current, scheduled_timezone: event.target.value }))}
                              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                            >
                              {COMMON_TIMEZONES.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                              ))}
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
                        {t('activate.priceModeAuto')}
                      </Button>
                      <Button
                        type="button"
                        variant={priceMode === 'manual' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPriceMode('manual')}
                      >
                        {t('activate.priceModeManual')}
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
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {priceMode === 'auto'
                        ? t('activate.priceAuto')
                        : t('activate.priceManualEntry', { defaultValue: 'Enter custom price' })}
                    </p>
                  </div>
                </div>

                {/* Summary Card */}
                <Card>
                  <CardContent className="grid gap-4 p-4 md:grid-cols-3">
                    <InfoPair label={text.activationDialog.durationDays} value={Math.round(durationDays) || 0} />
                    <InfoPair label={text.activationDialog.expiryPreview} value={expiryPreview ? formatDate(expiryPreview, locale, displayTimezone) : '-'} />
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
                      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">{text.activationDialog.customer}</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <InfoPair label={text.activationDialog.customer} value={activationForm.customer_name || '-'} />
                        <InfoPair label={text.activationDialog.email} value={activationForm.customer_email || '-'} />
                        <InfoPair label={text.activationDialog.phone} value={activationForm.customer_phone || '-'} />
                        <InfoPair label={text.activationDialog.biosId} value={activationForm.bios_id || '-'} />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{text.activationDialog.program}</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <InfoPair label={text.activationDialog.program} value={selectedProgram?.name ?? '-'} />
                        <InfoPair label={text.activationDialog.duration} value={`${durationDays.toFixed(2)} ${text.units.days}`} />
                        <InfoPair label={text.activationDialog.price} value={formatCurrency(totalPrice, 'USD', locale)} />
                        <InfoPair label={text.activationDialog.expiry} value={expiryPreview ? formatDate(expiryPreview, locale, displayTimezone) : '-'} />
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

      <ConfirmDialog
        open={pauseTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPauseTarget(null)
            setPauseReason('')
          }
        }}
        title={text.pauseDialog.title}
        description={pauseTarget ? text.pauseDialog.description(pauseTarget.bios_id ?? '-') : undefined}
        confirmLabel={text.actions.pause}
        onConfirm={() => {
          if (pauseTarget?.license_id) {
            pauseMutation.mutate(pauseTarget.license_id)
          }
        }}
      >
        <div className="space-y-2">
          <Label>{t('common.reason')}</Label>
          <textarea
            className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={pauseReason}
            onChange={(event) => setPauseReason(event.target.value)}
            placeholder={t('common.reason')}
            maxLength={500}
          />
        </div>
      </ConfirmDialog>

      <RenewLicenseDialog
        open={bulkRenewOpen}
        onOpenChange={setBulkRenewOpen}
        title={t('reseller.pages.licenses.bulkRenew')}
        description={`${selectedLicenseIds.length} ${t('common.selected', { defaultValue: 'selected' })}`}
        confirmLabel={t('reseller.pages.licenses.bulkRenew')}
        confirmLoadingLabel={text.renewDialog.renewing}
        cancelLabel={text.renewDialog.cancel}
        resetKey={selectedLicenseIds.join(',')}
        isPending={bulkRenewMutation.isPending}
        onSubmit={(payload) => bulkRenewMutation.mutate(payload)}
      />

      <EditCustomerDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null)
          }
        }}
        title={t('common.edit', { defaultValue: 'Edit Customer' })}
        description="Update the customer name, email, or phone."
        initialClientName={editTarget?.client_name ?? editTarget?.name ?? editTarget?.username ?? ''}
        initialEmail={editTarget?.email}
        initialPhone={editTarget?.phone}
        isPending={editMutation.isPending}
        onSubmit={(payload) => editMutation.mutate(payload)}
      />

      <CustomerNoteDialog isOpen={notesCustomerId !== null} onClose={() => setNotesCustomerId(null)} customerId={notesCustomerId ?? 0} />
    </div>
  )

  function resetActivationDialog() {
    setActivationOpen(false)
    setActivationStep(0)
    setActivationForm(createEmptyActivationForm(displayTimezone))
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
      <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 font-semibold text-slate-950 dark:text-white">{value}</div>
    </div>
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

    if (form.customer_phone.trim() && !/^\+?\d{6,20}$/.test(form.customer_phone.trim())) {
      return 'Phone must contain digits only.'
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

    if (form.mode === 'end_date' && form.end_date) {
      const endAt = new Date(form.end_date).getTime()
      if (!Number.isFinite(endAt) || endAt <= Date.now()) {
        return text.validation.duration
      }
    }
  }

  return ''
}

function buildScheduledDateTime(form: ActivationFormState) {
  if (form.schedule_mode === 'custom') {
    return form.scheduled_date_time || undefined
  }

  const amount = Math.max(1, Number(form.schedule_offset_value) || 1)
  const date = new Date()
  if (form.schedule_offset_unit === 'minutes') date.setMinutes(date.getMinutes() + amount)
  if (form.schedule_offset_unit === 'hours') date.setHours(date.getHours() + amount)
  if (form.schedule_offset_unit === 'days') date.setDate(date.getDate() + amount)
  return formatDateTimeLocalInTimezone(date, form.scheduled_timezone)
}

function normalizePhoneInput(value: string) {
  const compact = value.replace(/[^\d+]/g, '')
  if (compact.startsWith('+')) {
    return `+${compact.slice(1).replace(/\+/g, '')}`
  }

  return compact.replace(/\+/g, '')
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return resolveApiErrorMessage(error, fallback)
  }

  return fallback
}

function resolveResellerCustomerLabel(row: ResellerCustomerSummary) {
  if (row.client_name?.trim()) {
    return row.client_name
  }

  if (row.name?.trim() && !isLikelyBios(row.name)) {
    return row.name
  }

  if (row.username?.trim()) {
    return row.username
  }

  return row.name || '-'
}

function resolveResellerCustomerUsername(row: ResellerCustomerSummary) {
  return row.external_username || row.username || '-'
}
