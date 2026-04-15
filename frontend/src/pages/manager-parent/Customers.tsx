import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CheckCircle2, ChevronDown, Clock3, Cpu, FileText, MoreVertical, Pause, Pencil, Play, Plus, RotateCw, ShieldOff, Trash2, UserRound, X } from 'lucide-react'
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
import { RoleBadge } from '@/components/shared/RoleBadge'
import { RoleIdentity } from '@/components/shared/RoleIdentity'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { useResolvedTimezone } from '@/hooks/useResolvedTimezone'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { getCountryCodeByName } from '@/lib/countries'
import { liveQueryOptions, LIVE_QUERY_INTERVAL } from '@/lib/live-query'
import { COMMON_TIMEZONES, formatDateTimeLocalInTimezone } from '@/lib/timezones'
import { canDeleteCustomerRow, canDeleteLicense, canReactivateLicense, canRetryScheduledLicense, formatCurrency, formatDate, formatLicenseDurationDays, getLicenseDisplayStatus, getLicenseStartDate, getStatusMeaning, isLikelyBios, isPausedPendingLicense, isPlainPendingLicense, resolveLicenseDurationDays, shouldRenewLicense } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { customerService } from '@/services/customer.service'
import { licenseService } from '@/services/license.service'
import { managerParentService } from '@/services/manager-parent.service'
import { programService } from '@/services/program.service'
import { teamService } from '@/services/team.service'
import type { CustomerSummary } from '@/types/manager-parent.types'
import type { DurationUnit, RenewLicenseData } from '@/types/manager-reseller.types'
import type { UserRole } from '@/types/user.types'
import { formatUsername } from '@/utils/biosId'
import { FlagImage } from '@/utils/countryFlag'

const STATUS_OPTIONS = ['all', 'active', 'suspended', 'scheduled', 'expired', 'cancelled', 'pending'] as const
const SELLER_ROLE_ORDER: UserRole[] = ['manager_parent', 'manager', 'reseller']

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
  price: string
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
    price: '',
  }
}

export function CustomersPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { lang } = useLanguage()
  const queryClient = useQueryClient()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const { timezone: displayTimezone } = useResolvedTimezone()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlPage = parsePositiveIntegerParam(searchParams.get('page')) || 1
  const urlPerPage = parsePositiveIntegerParam(searchParams.get('per_page')) || 25
  const urlSearch = normalizeSearchParam(searchParams.get('search'))
  const urlStatus = parseCustomerStatusParam(searchParams.get('status'))
  const urlManagerParentId = parsePositiveIntegerParam(searchParams.get('manager_parent_id'))
  const urlManagerId = parsePositiveIntegerParam(searchParams.get('manager_id'))
  const urlResellerId = parsePositiveIntegerParam(searchParams.get('reseller_id'))
  const urlProgramId = parsePositiveIntegerParam(searchParams.get('program_id'))
  const urlCountryName = normalizeSearchParam(searchParams.get('country_name'))
  const scopeName = searchParams.get('scope_name') || ''
  const scopeRole = normalizeScopeRole(searchParams.get('scope_role'))
  const [page, setPage] = useState(urlPage)
  const [perPage, setPerPage] = useState(urlPerPage)
  const [search, setSearch] = useState(urlSearch)
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>(urlStatus)
  const [managerParentId, setManagerParentId] = useState<number | ''>(urlManagerParentId)
  const [managerId, setManagerId] = useState<number | ''>(urlManagerId)
  const [resellerId, setResellerId] = useState<number | ''>(urlResellerId)
  const [programId, setProgramId] = useState<number | ''>(urlProgramId)
  const [countryName, setCountryName] = useState(urlCountryName)
  const [activationOpen, setActivationOpen] = useState(false)
  const [activationStep, setActivationStep] = useState(0)
  const [activationForm, setActivationForm] = useState<ActivationFormState>(() => createEmptyActivationForm(displayTimezone))
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto')
  const [editTarget, setEditTarget] = useState<CustomerSummary | null>(null)
  const [notesCustomerId, setNotesCustomerId] = useState<number | null>(null)
  const [pauseTarget, setPauseTarget] = useState<CustomerSummary | null>(null)
  const [resumeTarget, setResumeTarget] = useState<CustomerSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomerSummary | null>(null)
  const [pauseReason, setPauseReason] = useState('')
  const [selectedLicenseIds, setSelectedLicenseIds] = useState<number[]>([])
  const [bulkRenewOpen, setBulkRenewOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const customerFilterParams = useMemo(
    () => ({
      search: search || undefined,
      manager_parent_id: managerParentId || undefined,
      manager_id: managerId || undefined,
      reseller_id: resellerId || undefined,
      program_id: programId || undefined,
      country_name: countryName || undefined,
    }),
    [countryName, managerId, managerParentId, programId, resellerId, search],
  )
  const exportParams = useMemo(
    () => ({
      ...customerFilterParams,
      status: status === 'all' ? undefined : status,
    }),
    [customerFilterParams, status],
  )

  const customersQuery = useQuery({
    queryKey: ['manager-parent', 'customers', page, perPage, search, status, managerParentId, managerId, resellerId, programId, countryName],
    queryFn: () =>
      customerService.getAll({
        page,
        per_page: perPage,
        ...customerFilterParams,
        status: status === 'all' ? undefined : status,
      }),
    ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_LIST),
  })

  const resellerQuery = useQuery({
    queryKey: ['manager-parent', 'customers', 'resellers'],
    queryFn: () => teamService.getAll({ role: 'reseller', per_page: 100 }),
  })

  const userOptionsQuery = useQuery({
    queryKey: ['manager-parent', 'customers', 'user-options'],
    queryFn: () => managerParentService.getUsernameManagement({ per_page: 100 }),
  })

  const programsQuery = useQuery({
    queryKey: ['manager-parent', 'customers', 'programs'],
    queryFn: () => programService.getAll({ per_page: 100 }),
  })
  const countryOptionsQuery = useQuery({
    queryKey: ['manager-parent', 'customers', 'countries', search, status, managerParentId, managerId, resellerId, programId],
    queryFn: () => customerService.getCountries({
      search: search || undefined,
      status: status === 'all' ? undefined : status,
      manager_parent_id: managerParentId || undefined,
      manager_id: managerId || undefined,
      reseller_id: resellerId || undefined,
      program_id: programId || undefined,
    }),
  })

  const allSellerOptions = useMemo(() => {
    const fromUserOptions = (userOptionsQuery.data?.data ?? [])
      .filter((m) => m.role === 'manager_parent' || m.role === 'manager')
      .map((m) => ({ id: m.id, name: m.name, role: m.role as UserRole }))

    if (user && user.role === 'manager_parent' && !fromUserOptions.some((m) => m.id === user.id)) {
      fromUserOptions.unshift({ id: user.id, name: user.name, role: 'manager_parent' as UserRole })
    }

    const fromResellers = (resellerQuery.data?.data ?? [])
      .map((r) => ({ id: r.id, name: r.name, role: 'reseller' as UserRole }))

    return [...fromUserOptions, ...fromResellers].sort((a, b) => {
      const roleDiff = SELLER_ROLE_ORDER.indexOf(a.role) - SELLER_ROLE_ORDER.indexOf(b.role)
      return roleDiff !== 0 ? roleDiff : a.name.localeCompare(b.name)
    })
  }, [resellerQuery.data?.data, user, userOptionsQuery.data?.data])

  const selectedSeller = useMemo(
    () =>
      managerParentId ? (allSellerOptions.find((s) => s.id === managerParentId && s.role === 'manager_parent') ?? null)
      : managerId ? (allSellerOptions.find((s) => s.id === managerId && s.role === 'manager') ?? null)
      : resellerId ? (allSellerOptions.find((s) => s.id === resellerId && s.role === 'reseller') ?? null)
      : null,
    [allSellerOptions, managerId, managerParentId, resellerId],
  )

  const sellerCountFilterParams = useMemo(
    () => ({
      search: search || undefined,
      program_id: programId || undefined,
      status: status === 'all' ? '' : status,
    }),
    [programId, search, status],
  )

  const sellerCountQueries = useQueries({
    queries: allSellerOptions.map((seller) => ({
      queryKey: ['manager-parent', 'customers', 'seller-count', seller.id, sellerCountFilterParams],
      queryFn: () =>
        customerService.getAll({
          page: 1,
          per_page: 1,
          ...sellerCountFilterParams,
          ...(seller.role === 'manager_parent'
            ? { manager_parent_id: seller.id }
            : seller.role === 'manager'
              ? { manager_id: seller.id }
              : { reseller_id: seller.id }),
        }),
      ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS),
    })),
  })

  const sellerCountMap = useMemo(
    () =>
      Object.fromEntries(
        allSellerOptions.map((seller, index) => [seller.id, sellerCountQueries[index]?.data?.meta.total ?? 0]),
      ) as Record<number, number>,
    [allSellerOptions, sellerCountQueries],
  )

  const handleSellerChange = (seller: (typeof allSellerOptions)[0] | null) => {
    setManagerParentId('')
    setManagerId('')
    setResellerId('')
    setPage(1)
    if (!seller) return
    if (seller.role === 'manager_parent') setManagerParentId(seller.id)
    else if (seller.role === 'manager') setManagerId(seller.id)
    else setResellerId(seller.id)
  }

  const [allCountQuery, activeCountQuery, scheduledCountQuery, expiredCountQuery, cancelledCountQuery, pendingCountQuery] = useQueries({
    queries: [
      { queryKey: ['manager-parent', 'customers', 'count', 'all', customerFilterParams], queryFn: () => customerService.getAll({ page: 1, per_page: 1, ...customerFilterParams }), ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS) },
      { queryKey: ['manager-parent', 'customers', 'count', 'active', customerFilterParams], queryFn: () => customerService.getAll({ page: 1, per_page: 1, ...customerFilterParams, status: 'active' }), ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS) },
      { queryKey: ['manager-parent', 'customers', 'count', 'scheduled', customerFilterParams], queryFn: () => customerService.getAll({ page: 1, per_page: 1, ...customerFilterParams, status: 'scheduled' }), ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS) },
      { queryKey: ['manager-parent', 'customers', 'count', 'expired', customerFilterParams], queryFn: () => customerService.getAll({ page: 1, per_page: 1, ...customerFilterParams, status: 'expired' }), ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS) },
      { queryKey: ['manager-parent', 'customers', 'count', 'cancelled', customerFilterParams], queryFn: () => customerService.getAll({ page: 1, per_page: 1, ...customerFilterParams, status: 'cancelled' }), ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS) },
      { queryKey: ['manager-parent', 'customers', 'count', 'pending', customerFilterParams], queryFn: () => customerService.getAll({ page: 1, per_page: 1, ...customerFilterParams, status: 'pending' }), ...liveQueryOptions(LIVE_QUERY_INTERVAL.STATUS_COUNTS) },
    ],
  })

  const activateMutation = useMutation({
    mutationFn: () =>
      licenseService.activate({
        customer_name: activationForm.customer_name.trim(),
        client_name: activationForm.client_name.trim() || undefined,
        customer_email: activationForm.customer_email.trim() || undefined,
        customer_phone: activationForm.customer_phone.trim().replace(/\D+/g, '') || undefined,
        bios_id: activationForm.bios_id.trim(),
        program_id: Number(activationForm.program_id),
        duration_days: durationDays,
        price: Number(totalPrice),
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
      setActivationOpen(false)
      setActivationStep(0)
      setActivationForm(createEmptyActivationForm(displayTimezone))
      setPriceMode('auto')
      invalidate(queryClient)
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  const editMutation = useMutation({
    mutationFn: (payload: { client_name: string; email?: string; phone?: string }) =>
      customerService.update(editTarget?.id ?? 0, payload),
    onSuccess: () => {
      toast.success(t('common.customerUpdatedSuccess', { defaultValue: 'Customer updated successfully.' }))
      setEditTarget(null)
      invalidate(queryClient)
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  const pauseMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.pause(licenseId, { pause_reason: pauseReason.trim() || undefined }),
    onSuccess: () => {
      toast.success(t('common.paused'))
      setPauseTarget(null)
      setPauseReason('')
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const resumeMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.resume(licenseId),
    onSuccess: () => {
      toast.success(t('common.resumed'))
      setResumeTarget(null)
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const retryScheduledMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.retryScheduled(licenseId),
    onSuccess: () => {
      toast.success(t('common.retrySuccess', { defaultValue: 'Scheduled activation retried successfully.' }))
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const cancelPendingMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.cancelPending(licenseId),
    onSuccess: () => {
      toast.success(lang === 'ar' ? 'تم إلغاء الترخيص المعلق بنجاح.' : 'Pending license cancelled successfully.')
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const deleteMutation = useMutation({
    mutationFn: (customerId: number) => customerService.remove(customerId),
    onSuccess: (response) => {
      toast.success(response.message ?? t('common.deleted', { defaultValue: 'Deleted successfully.' }))
      setDeleteTarget(null)
      invalidate(queryClient)
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message ?? t('common.error'))
    },
  })

  const bulkRenewMutation = useMutation({
    mutationFn: (payload: RenewLicenseData) => licenseService.bulkRenew(selectedLicenseIds, payload),
    onSuccess: () => {
      toast.success(t('reseller.pages.licenses.toasts.bulkRenewed'))
      setBulkRenewOpen(false)
      setSelectedLicenseIds([])
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: () => licenseService.bulkDelete(selectedLicenseIds),
    onSuccess: (response) => {
      if ((response.count ?? 0) <= 0) {
        toast.error(t('common.error', { defaultValue: 'No deletable licenses selected.' }))
      } else {
        toast.success(t('common.bulkDeleteSuccess', { defaultValue: 'Selected licenses deleted successfully.' }))
      }
      setBulkDeleteOpen(false)
      setSelectedLicenseIds([])
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const customerRows = customersQuery.data?.data ?? []
  const selectableIds = customerRows
    .filter((row) => typeof row.license_id === 'number' && canDeleteLicense(row))
    .map((row) => row.license_id as number)
  const allVisibleSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedLicenseIds.includes(id))
  const someVisibleSelected = selectableIds.some((id) => selectedLicenseIds.includes(id))
  const activationSteps = t('reseller.pages.customers.activationDialog.steps', { returnObjects: true }) as string[]

  const columns = useMemo<Array<DataTableColumn<CustomerSummary>>>(() => [
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
      render: (row) => typeof row.license_id === 'number' && canDeleteLicense(row) ? (
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
      key: 'name',
      label: t('common.name'),
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <Link className="text-brand-600 hover:underline dark:text-brand-400" to={routePaths.managerParent.customerDetail(lang, row.id)}>
          {isLikelyBios(row.name) ? '' : row.name}
        </Link>
      ),
    },
    {
      key: 'username',
      label: t('common.username'),
      sortable: true,
      sortValue: (row) => resolveCustomerApiUsername(row),
      render: (row) => (
        <Link className="font-medium text-brand-600 hover:underline dark:text-brand-400" to={routePaths.managerParent.customerDetail(lang, row.id)}>
          {resolveCustomerApiUsername(row)}
        </Link>
      ),
    },
    {
      key: 'phone',
      label: t('common.phone'),
      defaultHidden: true,
      sortable: true,
      sortValue: (row) => row.phone ?? '',
      render: (row) => (row.phone && row.phone.length > 20 ? '—' : row.phone ?? '-'),
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
      key: 'bios',
      label: t('managerParent.pages.customers.biosId'),
      sortable: true,
      sortValue: (row) => row.bios_id ?? '',
      render: (row) => row.bios_id ? (
        <Link className="text-brand-600 hover:underline dark:text-brand-400" to={routePaths.managerParent.biosDetail(lang, row.bios_id)}>
          {row.bios_id}
        </Link>
      ) : '-',
      },
      { key: 'reseller', label: t('common.reseller'), sortable: true, sortValue: (row) => row.reseller ?? '', render: (row) => (
        <RoleIdentity
          name={row.reseller}
          role={resolveUserRole(row.reseller_role)}
          href={row.reseller_id ? routePaths.managerParent.teamMemberDetail(lang, row.reseller_id) : undefined}
        />
      ) },
      {
        key: 'duration',
        label: t('common.duration'),
        sortable: true,
        sortValue: (row) => resolveLicenseDurationDays(row.duration_days, getLicenseStartDate(row), row.expiry) ?? 0,
        render: (row) => formatLicenseDurationDays(row.duration_days, t, getLicenseStartDate(row), row.expiry),
      },
      { key: 'program', label: t('common.program'), sortable: true, defaultHidden: true, sortValue: (row) => row.program ?? '', render: (row) => row.program ?? '-' },
    { key: 'start', label: t('common.start', { defaultValue: 'Start' }), sortable: true, defaultHidden: true, sortValue: (row) => String(getLicenseStartDate(row) ?? ''), render: (row) => (getLicenseStartDate(row) ? formatDate(getLicenseStartDate(row)!, locale, displayTimezone) : '-') },
    {
      key: 'status',
      label: t('common.status'),
      sortable: true,
      sortValue: (row) => getLicenseDisplayStatus(row),
      render: (row) => (row.status ? (
        <div className="relative inline-flex flex-col gap-1">
          <LicenseStatusBadges status={getLicenseDisplayStatus(row)} isBlocked={Boolean(row.is_blacklisted)} />
          {isPlainPendingLicense(row) ? (
            <span className="absolute -right-2 -top-2 inline-flex items-center rounded-full border border-fuchsia-200 bg-fuchsia-100 px-1.5 py-0.5 text-sm font-semibold leading-none text-fuchsia-700 shadow-sm dark:border-fuchsia-900/60 dark:bg-fuchsia-950/50 dark:text-fuchsia-300">
              {t('common.new', { defaultValue: lang === 'ar' ? 'جديد' : 'New' })}
            </span>
          ) : null}
          {row.bios_active_elsewhere ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-sm font-semibold leading-none text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/50 dark:text-orange-300">
              <ShieldOff className="h-2.5 w-2.5" />
              {t('customers.biosActiveElsewhere', { defaultValue: 'Active w/ other reseller' })}
            </span>
          ) : null}
        </div>
      ) : '-'),
    },
    { key: 'reason', label: t('common.reason'), sortable: true, defaultHidden: true, sortValue: (row) => row.pause_reason ?? '', render: (row) => isPausedPendingLicense(row) ? (row.pause_reason ?? '-') : '-' },
    { key: 'expiry', label: t('common.expiry'), sortable: true, defaultHidden: true, sortValue: (row) => row.expiry ?? '', render: (row) => (row.expiry ? formatDate(row.expiry, locale, displayTimezone) : '-') },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (row) => {
        const displayStatus = getLicenseDisplayStatus(row)
        const isScheduleEditable = displayStatus === 'scheduled' || displayStatus === 'scheduled_failed'
        const isPausedPending = isPausedPendingLicense(row)
        const isPlainPending = isPlainPendingLicense(row)
        const canDeleteRow = canDeleteCustomerRow(row)
        const isBlacklisted = Boolean(row.is_blacklisted)
        const isBiosActiveElsewhere = Boolean(row.bios_active_elsewhere)
        const renewActionLabel = displayStatus === 'active'
          ? t('common.increaseDuration', { defaultValue: 'Increase Duration' })
          : isScheduleEditable
            ? t('common.editSchedule', { defaultValue: 'Edit Schedule' })
            : isPlainPending
              ? t('common.activate', { defaultValue: 'Activate' })
              : t('common.renew')

        return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="ghost">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={routePaths.managerParent.customerDetail(lang, row.id)}>
                {t('common.view')}
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
            {typeof row.license_id === 'number' ? (
              <DropdownMenuItem onClick={() => navigate(`${routePaths.managerParent.customerDetail(lang, row.id)}?change_bios=1`)}>
                <Cpu className="me-2 h-4 w-4" />
                {t('biosChangeRequests.directAction', { defaultValue: 'Change BIOS ID' })}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem disabled={isBlacklisted} onClick={() => setEditTarget(row)}>
              <Pencil className="me-2 h-4 w-4" />
              {t('common.edit', { defaultValue: 'Edit' })}
            </DropdownMenuItem>
            {typeof row.license_id === 'number' && (displayStatus === 'active' || shouldRenewLicense(row)) && !isBlacklisted && !isBiosActiveElsewhere ? (
              <DropdownMenuItem onClick={() => navigate(routePaths.managerParent.licenseRenew(lang, row.license_id!), { state: { returnTo: `${location.pathname}${location.search}` } })}>
                <RotateCw className="me-2 h-4 w-4" />
                {renewActionLabel}
              </DropdownMenuItem>
            ) : null}
            {typeof row.license_id === 'number' && canRetryScheduledLicense(row) ? (
              <DropdownMenuItem onClick={() => retryScheduledMutation.mutate(row.license_id!)} disabled={retryScheduledMutation.isPending}>
                <Play className="me-2 h-4 w-4" />
                {t('common.retryNow', { defaultValue: 'Retry Now' })}
              </DropdownMenuItem>
            ) : null}
            {typeof row.license_id === 'number' && isPlainPending ? (
              <DropdownMenuItem
                disabled={cancelPendingMutation.isPending}
                onClick={() => cancelPendingMutation.mutate(row.license_id!)}
              >
                <X className="me-2 h-4 w-4" />
                {lang === 'ar' ? 'إلغاء المعلق' : 'Cancel Pending'}
              </DropdownMenuItem>
            ) : null}
            {typeof row.license_id === 'number' && displayStatus === 'active' && !isBlacklisted ? (
              <DropdownMenuItem onClick={() => setPauseTarget(row)}>
                <Pause className="me-2 h-4 w-4" />
                {t('common.pause')}
              </DropdownMenuItem>
            ) : null}
            {typeof row.license_id === 'number' && canReactivateLicense(row) && !isBlacklisted && !isBiosActiveElsewhere ? (
              <DropdownMenuItem onClick={() => setResumeTarget(row)}>
                <Play className="me-2 h-4 w-4" />
                {isPausedPending ? t('common.continue', { defaultValue: 'Continue' }) : t('common.reactivate')}
              </DropdownMenuItem>
            ) : null}
            {canDeleteRow ? (
              <DropdownMenuItem onClick={() => setDeleteTarget(row)}>
                <Trash2 className="me-2 h-4 w-4" />
                {t('common.delete')}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        )
      },
    },
  ], [allVisibleSelected, lang, locale, location.pathname, location.search, navigate, selectableIds, selectedLicenseIds, someVisibleSelected, t, retryScheduledMutation.isPending, cancelPendingMutation.isPending])

  // Reset all filters when navigating to clean URL (e.g. sidebar click)
  useEffect(() => {
    setPage(urlPage)
    setPerPage(urlPerPage)
    setSearch(urlSearch)
    setStatus(urlStatus)
    setManagerParentId(urlManagerParentId)
    setManagerId(urlManagerId)
    setResellerId(urlResellerId)
    setProgramId(urlProgramId)
    setCountryName(urlCountryName)
  }, [urlCountryName, urlManagerId, urlManagerParentId, urlPage, urlPerPage, urlProgramId, urlResellerId, urlSearch, urlStatus])

  useEffect(() => {
    const next = new URLSearchParams()
    if (page > 1) next.set('page', String(page))
    if (perPage !== 25) next.set('per_page', String(perPage))
    if (search) next.set('search', search)
    if (status !== 'all') next.set('status', status)
    if (managerParentId) next.set('manager_parent_id', String(managerParentId))
    if (managerId) next.set('manager_id', String(managerId))
    if (resellerId) next.set('reseller_id', String(resellerId))
    if (programId) next.set('program_id', String(programId))
    if (countryName) next.set('country_name', countryName)
    if (scopeName) next.set('scope_name', scopeName)
    if (scopeRole) next.set('scope_role', scopeRole)
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [countryName, managerId, managerParentId, page, perPage, programId, resellerId, scopeName, scopeRole, search, searchParams, setSearchParams, status])

  const selectedProgram = (programsQuery.data?.data ?? []).find((program) => program.id === activationForm.program_id)
  const durationDays = useMemo(() => {
    if (activationForm.mode === 'end_date' && activationForm.end_date) {
      const endDate = new Date(activationForm.end_date)
      const today = new Date()
      return Math.max(0, (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    }
    return durationToDays(Number(activationForm.duration_value), activationForm.duration_unit)
  }, [activationForm.duration_value, activationForm.duration_unit, activationForm.mode, activationForm.end_date])
  const expiryPreview = useMemo(() => {
    if (activationForm.mode === 'end_date' && activationForm.end_date) return activationForm.end_date
    if (durationDays <= 0) return ''
    return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
  }, [activationForm.mode, activationForm.end_date, durationDays])
  const autoPrice = useMemo(() => {
    const base = Number(selectedProgram?.base_price ?? 0)
    return Math.max(0, base * durationDays)
  }, [selectedProgram?.base_price, durationDays])
  const totalPrice = priceMode === 'auto' ? autoPrice : Number(activationForm.price || 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('managerParent.pages.customers.title')}
        description={t('managerParent.pages.customers.description')}
        actions={
          <div className="flex flex-wrap gap-3">
            <ExportButtons
              onExportCsv={() => customerService.exportXlsx(exportParams)}
              onExportPdf={() => customerService.exportPdf(exportParams)}
            />
            <Button type="button" onClick={() => navigate(routePaths.managerParent.customerCreate(lang))}>
              <Plus className="me-2 h-4 w-4" />
              {t('managerParent.pages.customers.addCustomer', { defaultValue: 'Add Customer' })}
            </Button>
          </div>
        }
      />

      {scopeRole ? (
        <Card>
          <CardContent className="p-4 text-sm text-sky-900 dark:text-sky-100">
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/60 dark:bg-sky-950/30">
              {t('managerParent.pages.customers.scopeHint', {
                name: scopeName || t(`managerParent.pages.customers.scopeRoles.${scopeRole}`),
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        <StatusFilterCard
          label={t('common.all')}
          count={allCountQuery.data?.meta.total ?? 0}
          isActive={status === 'all'}
          onClick={() => {
            setStatus('all')
            setPage(1)
          }}
          color="sky"
        />
        <StatusFilterCard
          label={t('common.active')}
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
          label={t('common.expired')}
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
          label={t('common.cancelled')}
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
          label={t('common.pending')}
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
              <CardContent className="grid gap-2 p-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_220px]">
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('managerParent.pages.customers.searchPlaceholder')} className="h-9 text-sm" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="h-9 w-full justify-between overflow-hidden rounded-lg border-slate-200 px-3 text-sm font-normal text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {selectedSeller ? (
                        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap">
                          <span className="min-w-0 truncate">{selectedSeller.name}</span>
                          <span className="shrink-0"><RoleBadge role={selectedSeller.role} /></span>
                        </span>
                      ) : (
                        <span className="truncate">{t('common.allRoles', { defaultValue: 'All roles' })}</span>
                      )}
                      <ChevronDown className="ms-2 h-4 w-4 shrink-0 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-64">
                    <DropdownMenuItem onSelect={() => handleSellerChange(null)}>
                      <div className="flex w-full items-center justify-between gap-3">
                        <span>{t('common.allRoles', { defaultValue: 'All roles' })}</span>
                        {!selectedSeller ? <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" /> : null}
                      </div>
                    </DropdownMenuItem>
                    {allSellerOptions.map((seller) => (
                      <DropdownMenuItem key={`${seller.role}-${seller.id}`} onSelect={() => handleSellerChange(seller)}>
                        <div className="flex w-full min-w-0 items-center justify-between gap-3">
                          <span className="min-w-0 truncate">{seller.name}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400">{sellerCountMap[seller.id] ?? 0}</span>
                            <RoleBadge role={seller.role} />
                            {selectedSeller?.id === seller.id && selectedSeller?.role === seller.role ? <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" /> : null}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <select value={programId} onChange={(event) => { setProgramId(event.target.value ? Number(event.target.value) : ''); setPage(1) }} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <option value="">{t('managerParent.pages.customers.allPrograms')}</option>
                  {(programsQuery.data?.data ?? []).map((program) => (
                    <option key={program.id} value={program.id}>{program.name}</option>
                  ))}
                </select>
                <select value={countryName} onChange={(event) => { setCountryName(event.target.value); setPage(1) }} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <option value="">{t('common.allCountries', { defaultValue: 'All countries' })}</option>
                  {(countryOptionsQuery.data?.data ?? []).map((country) => (
                    <option key={country.country_name} value={country.country_name}>{country.country_name} ({country.count})</option>
                  ))}
                </select>
            </CardContent>
          </Card>
          <DataTable
            tableKey="manager_parent_customers"
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

          {selectedLicenseIds.length > 0 ? (
            <Card className="border-brand-200/60 bg-brand-50/40 dark:border-brand-900/30 dark:bg-brand-950/10">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="text-sm text-slate-600 dark:text-slate-300">{selectedLicenseIds.length} {t('common.selected', { defaultValue: 'selected' })}</span>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => setBulkRenewOpen(true)}>{t('reseller.pages.licenses.bulkRenew')}</Button>
                  <Button type="button" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>{t('common.deleteSelected', { defaultValue: 'Delete Selected' })}</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
      </div>

      <Dialog open={activationOpen} onOpenChange={setActivationOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('reseller.pages.customers.activationDialog.title')}</DialogTitle>
            <DialogDescription>{t('reseller.pages.customers.activationDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-4">
            {activationSteps.map((label, index) => (
              <div key={label} className={`rounded-2xl border px-4 py-3 text-sm ${index === activationStep ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/30 dark:text-sky-300' : 'border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400'}`}>
                <div className="text-sm uppercase tracking-wide">{t('reseller.pages.customers.activationDialog.stepLabel')} {index + 1}</div>
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
              <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-300" style={{ width: `${((activationStep + 1) / activationSteps.length) * 100}%` }} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{Math.round(((activationStep + 1) / activationSteps.length) * 100)}%</p>
          </div>
          {activationStep === 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label={t('activate.username', { defaultValue: 'Username (API)' })} htmlFor="mp-customer-username">
                <Input id="mp-customer-username" placeholder={t('activate.usernameHint', { defaultValue: 'letters, numbers, underscore only' })}  value={activationForm.customer_name} onChange={(event) => setActivationForm((current) => ({ ...current, customer_name: event.target.value }))} onBlur={() => setActivationForm((current) => ({ ...current, customer_name: formatUsername(current.customer_name) }))} />
              </FormField>
              <FormField label={t('activate.clientName', { defaultValue: 'Client Display Name' })} htmlFor="mp-client-name">
                <Input id="mp-client-name" placeholder={t('activate.clientName', { defaultValue: 'Client Display Name' })} value={activationForm.client_name} onChange={(event) => setActivationForm((current) => ({ ...current, client_name: event.target.value }))} />
              </FormField>
              <FormField label={t('reseller.pages.customers.activationDialog.customerEmail')} htmlFor="mp-customer-email">
                <Input id="mp-customer-email" type="email" value={activationForm.customer_email} onChange={(event) => setActivationForm((current) => ({ ...current, customer_email: event.target.value }))} />
              </FormField>
              <FormField label={t('common.phone')} htmlFor="mp-customer-phone">
                <Input id="mp-customer-phone" value={activationForm.customer_phone} onChange={(event) => setActivationForm((current) => ({ ...current, customer_phone: event.target.value.replace(/\D+/g, '') }))} />
              </FormField>
              <p className="md:col-span-2 text-sm text-slate-500 dark:text-slate-400">{t('activate.usernameHint', { defaultValue: 'letters, numbers, underscore only' })}</p>
            </div>
          ) : null}
          {activationStep === 1 ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder={t('reseller.pages.customers.activationDialog.biosId')}  value={activationForm.bios_id} onChange={(event) => setActivationForm((current) => ({ ...current, bios_id: event.target.value }))} />
              <select value={activationForm.program_id} onChange={(event) => setActivationForm((current) => ({ ...current, program_id: event.target.value ? Number(event.target.value) : '' }))} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="">{t('reseller.pages.customers.activationDialog.selectProgram')}</option>
                {(programsQuery.data?.data ?? []).map((program) => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          {activationStep === 2 ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={activationForm.mode === 'duration' ? 'default' : 'outline'} onClick={() => setActivationForm((current) => ({ ...current, mode: 'duration' }))}>{t('common.duration')}</Button>
                <Button type="button" size="sm" variant={activationForm.mode === 'end_date' ? 'default' : 'outline'} onClick={() => setActivationForm((current) => ({ ...current, mode: 'end_date' }))}>{t('common.endDate', { defaultValue: 'End Date' })}</Button>
              </div>
              {activationForm.mode === 'duration' ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <Input type="number" min={1} value={activationForm.duration_value} onChange={(event) => setActivationForm((current) => ({ ...current, duration_value: event.target.value }))} />
                  <select value={activationForm.duration_unit} onChange={(event) => setActivationForm((current) => ({ ...current, duration_unit: event.target.value as 'minutes' | 'hours' | 'days' }))} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                    <option value="minutes">{t('common.minutes', { defaultValue: 'Minutes' })}</option>
                    <option value="hours">{t('common.hours', { defaultValue: 'Hours' })}</option>
                    <option value="days">{t('common.days')}</option>
                  </select>
                  <div className="flex flex-wrap gap-2">
                    {[{ label: '1d', value: '1', unit: 'days' }, { label: '7d', value: '7', unit: 'days' }, { label: '30d', value: '30', unit: 'days' }, { label: '90d', value: '90', unit: 'days' }, { label: '1y', value: '365', unit: 'days' }].map((preset) => (
                      <Button key={preset.label} type="button" size="sm" variant="outline" onClick={() => setActivationForm((current) => ({ ...current, duration_value: preset.value, duration_unit: preset.unit as 'minutes' | 'hours' | 'days' }))}>{preset.label}</Button>
                    ))}
                  </div>
                </div>
              ) : (
                <Input type="datetime-local" value={activationForm.end_date} onChange={(event) => setActivationForm((current) => ({ ...current, end_date: event.target.value }))} />
              )}

              <div className="space-y-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={activationForm.is_scheduled} onChange={(event) => setActivationForm((current) => ({ ...current, is_scheduled: event.target.checked }))} />
                  {t('activate.scheduleToggle')}
                </label>
                {activationForm.is_scheduled ? (
                  <>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant={activationForm.schedule_mode === 'relative' ? 'default' : 'outline'} onClick={() => setActivationForm((current) => ({ ...current, schedule_mode: 'relative' }))}>{t('activate.scheduleModeRelative', { defaultValue: 'After' })}</Button>
                      <Button type="button" size="sm" variant={activationForm.schedule_mode === 'custom' ? 'default' : 'outline'} onClick={() => setActivationForm((current) => ({ ...current, schedule_mode: 'custom' }))}>{t('activate.scheduleModeCustom', { defaultValue: 'Custom Date' })}</Button>
                    </div>
                    {activationForm.schedule_mode === 'relative' ? (
                      <div className="grid gap-3 md:grid-cols-3">
                        <Input type="number" min={1} value={activationForm.schedule_offset_value} onChange={(event) => setActivationForm((current) => ({ ...current, schedule_offset_value: event.target.value }))} />
                        <select value={activationForm.schedule_offset_unit} onChange={(event) => setActivationForm((current) => ({ ...current, schedule_offset_unit: event.target.value as 'minutes' | 'hours' | 'days' }))} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                          <option value="minutes">{t('common.minutes', { defaultValue: 'Minutes' })}</option>
                          <option value="hours">{t('common.hours', { defaultValue: 'Hours' })}</option>
                          <option value="days">{t('common.days')}</option>
                        </select>
                        <select value={activationForm.scheduled_timezone} onChange={(event) => setActivationForm((current) => ({ ...current, scheduled_timezone: event.target.value }))} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                          {COMMON_TIMEZONES.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input type="datetime-local" value={activationForm.scheduled_date_time} onChange={(event) => setActivationForm((current) => ({ ...current, scheduled_date_time: event.target.value }))} />
                        <select value={activationForm.scheduled_timezone} onChange={(event) => setActivationForm((current) => ({ ...current, scheduled_timezone: event.target.value }))} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                          {COMMON_TIMEZONES.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>{t('common.price')}</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={priceMode === 'auto' ? 'default' : 'outline'} onClick={() => setPriceMode('auto')}>{t('activate.priceModeAuto', { defaultValue: 'Auto' })}</Button>
                  <Button type="button" size="sm" variant={priceMode === 'manual' ? 'default' : 'outline'} onClick={() => setPriceMode('manual')}>{t('activate.priceModeManual', { defaultValue: 'Manual' })}</Button>
                </div>
                <Input type="number" min={0} step="0.01" value={priceMode === 'auto' ? totalPrice.toFixed(2) : activationForm.price} onChange={(event) => setActivationForm((current) => ({ ...current, price: event.target.value }))} readOnly={priceMode === 'auto'} />
              </div>
            </div>
          ) : null}
          {activationStep === 3 ? (
            <Card>
              <CardContent className="grid gap-2 p-4 md:grid-cols-2">
                <div>{activationForm.customer_name}</div>
                <div>{activationForm.client_name || '-'}</div>
                <div>{activationForm.customer_email || '-'}</div>
                <div>{activationForm.customer_phone || '-'}</div>
                <div>{activationForm.bios_id}</div>
                <div>{selectedProgram?.name ?? '-'}</div>
                <div>{durationDays} {t('common.days')}</div>
                <div>{expiryPreview ? formatDate(expiryPreview, locale, displayTimezone) : '-'}</div>
                <div>{formatCurrency(totalPrice, 'USD', locale)}</div>
              </CardContent>
            </Card>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => (activationStep === 0 ? setActivationOpen(false) : setActivationStep((current) => current - 1))}>{activationStep === 0 ? t('common.cancel') : t('common.back')}</Button>
            {activationStep < 3 ? (
              <Button
                type="button"
                onClick={() => {
                  const error = validateActivationStep(activationStep, activationForm, totalPrice, t)
                  if (error) {
                    toast.error(error)
                    return
                  }
                  setActivationStep((current) => current + 1)
                }}
              >
                {t('common.next')}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  const error = validateActivationStep(activationStep, activationForm, totalPrice, t)
                  if (error) {
                    toast.error(error)
                    return
                  }
                  activateMutation.mutate()
                }}
                disabled={activateMutation.isPending}
              >
                {t('common.activate')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditCustomerDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null)
          }
        }}
        title={t('common.edit', { defaultValue: 'Edit Customer' })}
        description={t('managerParent.pages.customers.editDescription', { defaultValue: 'Update the customer name, email, or phone.' })}
        initialClientName={editTarget?.name ?? ''}
        initialEmail={editTarget?.email}
        initialPhone={editTarget?.phone}
        isPending={editMutation.isPending}
        onSubmit={(payload) => editMutation.mutate(payload)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('common.delete')}
        description={deleteTarget ? `${deleteTarget.name} (${deleteTarget.email ?? '-'})` : undefined}
        confirmLabel={t('common.delete')}
        isDestructive
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id)
          }
        }}
      />

      <ConfirmDialog
        open={pauseTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPauseTarget(null)
            setPauseReason('')
          }
        }}
        title={t('common.pause')}
        description={pauseTarget?.bios_id ?? undefined}
        confirmLabel={t('common.pause')}
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

      <ConfirmDialog
        open={resumeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResumeTarget(null)
          }
        }}
        title={isPausedPendingLicense(resumeTarget) ? t('common.continue', { defaultValue: 'Continue' }) : t('common.reactivate')}
        description={resumeTarget?.bios_id ?? undefined}
        confirmLabel={isPausedPendingLicense(resumeTarget) ? t('common.continue', { defaultValue: 'Continue' }) : t('common.reactivate')}
        onConfirm={() => {
          if (resumeTarget?.license_id) {
            resumeMutation.mutate(resumeTarget.license_id)
          }
        }}
      />

      <RenewLicenseDialog
        open={bulkRenewOpen}
        onOpenChange={setBulkRenewOpen}
        title={t('reseller.pages.licenses.bulkRenew')}
        description={`${selectedLicenseIds.length} ${t('common.selected', { defaultValue: 'selected' })}`}
        confirmLabel={t('reseller.pages.licenses.bulkRenew')}
        confirmLoadingLabel={t('common.loading')}
        cancelLabel={t('common.cancel')}
        resetKey={selectedLicenseIds.join(',')}
        isPending={bulkRenewMutation.isPending}
        onSubmit={(payload) => bulkRenewMutation.mutate(payload)}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={t('common.bulkDelete', { defaultValue: 'Bulk Delete' })}
        description={t('reseller.pages.licenses.confirm.bulkDeleteDescription', { count: selectedLicenseIds.length, defaultValue: 'Delete selected licenses?' })}
        confirmLabel={t('common.deleteSelected', { defaultValue: 'Delete Selected' })}
        isDestructive
        onConfirm={() => bulkDeleteMutation.mutate()}
      />

      <CustomerNoteDialog isOpen={notesCustomerId !== null} onClose={() => setNotesCustomerId(null)} customerId={notesCustomerId ?? 0} />
    </div>
  )
}

function resolveCustomerApiUsername(row: CustomerSummary) {
  return row.external_username || row.username || '-'
}

function resolveUserRole(role?: string | null): UserRole | null {
  if (role === 'super_admin' || role === 'manager_parent' || role === 'manager' || role === 'reseller' || role === 'customer') {
    return role
  }

  return null
}

function normalizeScopeRole(value: string | null): 'manager_parent' | 'manager' | 'reseller' | '' {
  if (value === 'manager_parent' || value === 'manager' || value === 'reseller') {
    return value
  }

  return ''
}

function parsePositiveIntegerParam(value: string | null): number | '' {
  if (!value || value === 'null' || value === 'undefined') {
    return ''
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return ''
  }

  return parsed
}

function normalizeSearchParam(value: string | null): string {
  if (!value || value === 'null' || value === 'undefined') {
    return ''
  }

  return value
}

function parseCustomerStatusParam(value: string | null): (typeof STATUS_OPTIONS)[number] {
  if (!value || value === 'null' || value === 'undefined') {
    return 'all'
  }

  return STATUS_OPTIONS.includes(value as (typeof STATUS_OPTIONS)[number])
    ? (value as (typeof STATUS_OPTIONS)[number])
    : 'all'
}

function durationToDays(value: number, unit: 'minutes' | 'hours' | 'days' | DurationUnit) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }
  if (unit === 'minutes') {
    return value / 1440
  }
  if (unit === 'hours') {
    return value / 24
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
    queryClient.invalidateQueries({ queryKey: ['manager-parent', 'customers'] }),
    queryClient.invalidateQueries({ queryKey: ['manager-parent', 'licenses'] }),
    queryClient.refetchQueries({ queryKey: ['manager-parent', 'customers'], type: 'active' }),
    queryClient.refetchQueries({ queryKey: ['manager-parent', 'licenses'], type: 'active' }),
  ])
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
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

function validateActivationStep(
  step: number,
  form: ActivationFormState,
  totalPrice: number,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (step === 0 && form.customer_name.trim().length < 2) {
    return t('reseller.pages.customers.validation.customerName')
  }
  if (step === 0 && form.customer_email.trim() && !/\S+@\S+\.\S+/.test(form.customer_email.trim())) {
    return t('reseller.pages.customers.validation.customerEmail')
  }
  if (step === 0 && form.customer_phone.trim() && !/^\d+$/.test(form.customer_phone.trim())) {
    return 'Phone must start with optional + and contain digits only.'
  }

  if (step === 1) {
    if (form.bios_id.trim().length < 5) {
      return t('reseller.pages.customers.validation.biosId')
    }
    if (!form.program_id) {
      return t('reseller.pages.customers.validation.selectProgram')
    }
  }

  if (step >= 2) {
    if (form.mode === 'duration' && Number(form.duration_value) < 1) {
      return t('reseller.pages.customers.validation.duration')
    }
    if (form.mode === 'end_date' && !form.end_date) {
      return t('reseller.pages.customers.validation.duration')
    }
    if (form.mode === 'end_date' && form.end_date) {
      const endAt = new Date(form.end_date).getTime()
      if (!Number.isFinite(endAt) || endAt <= Date.now()) {
        return t('reseller.pages.customers.validation.duration')
      }
    }
    if (!Number.isFinite(totalPrice) || totalPrice < 0) {
      return t('reseller.pages.customers.validation.price')
    }
  }

  return ''
}
