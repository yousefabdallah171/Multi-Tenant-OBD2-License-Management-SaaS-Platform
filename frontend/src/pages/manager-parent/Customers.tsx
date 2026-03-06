import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, Cpu, MoreVertical, Pause, Play, Plus, RotateCw, ShieldOff, Trash2, UserRound } from 'lucide-react'
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate, isLikelyBios } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { customerService } from '@/services/customer.service'
import { licenseService } from '@/services/license.service'
import { programService } from '@/services/program.service'
import { teamService } from '@/services/team.service'
import type { CustomerSummary } from '@/types/manager-parent.types'
import type { DurationUnit } from '@/types/manager-reseller.types'
import { formatUsername } from '@/utils/biosId'

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
  price: string
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
  price: '',
}

export function CustomersPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const queryClient = useQueryClient()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all')
  const [resellerId, setResellerId] = useState<number | ''>('')
  const [programId, setProgramId] = useState<number | ''>('')
  const [activationOpen, setActivationOpen] = useState(false)
  const [activationStep, setActivationStep] = useState(0)
  const [activationForm, setActivationForm] = useState<ActivationFormState>(EMPTY_ACTIVATION_FORM)
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto')
  const [renewLicenseId, setRenewLicenseId] = useState<number | null>(null)
  const [renewDuration, setRenewDuration] = useState('30')
  const [renewUnit, setRenewUnit] = useState<DurationUnit>('days')
  const [renewPrice, setRenewPrice] = useState('')
  const [deactivateTarget, setDeactivateTarget] = useState<CustomerSummary | null>(null)
  const [pauseTarget, setPauseTarget] = useState<CustomerSummary | null>(null)
  const [resumeTarget, setResumeTarget] = useState<CustomerSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomerSummary | null>(null)
  const [selectedLicenseIds, setSelectedLicenseIds] = useState<number[]>([])
  const [bulkRenewOpen, setBulkRenewOpen] = useState(false)
  const [bulkDuration, setBulkDuration] = useState('30')
  const [bulkUnit, setBulkUnit] = useState<DurationUnit>('days')
  const [bulkPrice, setBulkPrice] = useState('0')
  const [bulkDeactivateOpen, setBulkDeactivateOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const customersQuery = useQuery({
    queryKey: ['manager-parent', 'customers', page, perPage, search, status, resellerId, programId],
    queryFn: () =>
      customerService.getAll({
        page,
        per_page: perPage,
        search,
        reseller_id: resellerId,
        program_id: programId,
        status: status === 'all' ? '' : status,
      }),
  })

  const resellerQuery = useQuery({
    queryKey: ['manager-parent', 'customers', 'resellers'],
    queryFn: () => teamService.getAll({ role: 'reseller', per_page: 100 }),
  })

  const programsQuery = useQuery({
    queryKey: ['manager-parent', 'customers', 'programs'],
    queryFn: () => programService.getAll({ per_page: 100 }),
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
      setActivationOpen(false)
      setActivationStep(0)
      setActivationForm(EMPTY_ACTIVATION_FORM)
      setPriceMode('auto')
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const renewMutation = useMutation({
    mutationFn: () =>
      licenseService.renew(renewLicenseId ?? 0, {
        duration_days: durationToDays(Number(renewDuration), renewUnit),
        price: Number(renewPrice),
      }),
    onSuccess: () => {
      toast.success(t('common.renewed'))
      setRenewLicenseId(null)
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const deactivateMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.deactivate(licenseId),
    onSuccess: () => {
      toast.success(t('common.deactivated', { defaultValue: 'Deactivated successfully.' }))
      setDeactivateTarget(null)
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const pauseMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.pause(licenseId),
    onSuccess: () => {
      toast.success(t('common.paused'))
      setPauseTarget(null)
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

  const deleteMutation = useMutation({
    mutationFn: (customerId: number) => customerService.remove(customerId),
    onSuccess: (response) => {
      toast.success(response.message ?? t('common.saved'))
      setDeleteTarget(null)
      invalidate(queryClient)
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message ?? t('common.error'))
    },
  })

  const bulkRenewMutation = useMutation({
    mutationFn: () => licenseService.bulkRenew(selectedLicenseIds, { duration_days: durationToDays(Number(bulkDuration), bulkUnit), price: Number(bulkPrice) }),
    onSuccess: () => {
      toast.success(t('reseller.pages.licenses.toasts.bulkRenewed'))
      setBulkRenewOpen(false)
      setSelectedLicenseIds([])
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const bulkDeactivateMutation = useMutation({
    mutationFn: () => licenseService.bulkDeactivate(selectedLicenseIds),
    onSuccess: () => {
      toast.success(t('reseller.pages.licenses.toasts.bulkDeactivated'))
      setBulkDeactivateOpen(false)
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
  const selectableIds = customerRows.map((row) => row.license_id).filter((id): id is number => typeof id === 'number')
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
      render: (row) => (
        <input
          type="checkbox"
          disabled={!row.license_id}
          checked={Boolean(row.license_id && selectedLicenseIds.includes(row.license_id))}
          onChange={(event) => {
            if (!row.license_id) return
            if (event.target.checked) {
              setSelectedLicenseIds((current) => [...new Set([...current, row.license_id!])])
              return
            }
            setSelectedLicenseIds((current) => current.filter((id) => id !== row.license_id))
          }}
        />
      ),
    },
    {
      key: 'name',
      label: t('common.name'),
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.customerDetail(lang, row.id)}>
          {isLikelyBios(row.name) ? '—' : row.name}
        </Link>
      ),
    },
    { key: 'email', label: t('common.email'), sortable: true, sortValue: (row) => row.email ?? '', render: (row) => row.email ?? '-' },
    {
      key: 'phone',
      label: t('common.phone'),
      sortable: true,
      sortValue: (row) => row.phone ?? '',
      render: (row) => (row.phone && row.phone.length > 20 ? 'â€”' : row.phone ?? '-'),
    },
    {
      key: 'bios',
      label: t('managerParent.pages.customers.biosId'),
      sortable: true,
      sortValue: (row) => row.bios_id ?? '',
      render: (row) => row.bios_id ? (
        <Link className="text-sky-600 hover:underline dark:text-sky-300" to={`${routePaths.managerParent.biosDetails(lang)}?bios=${encodeURIComponent(row.bios_id)}`}>
          {row.bios_id}
        </Link>
      ) : '-',
    },
    { key: 'reseller', label: t('common.reseller'), sortable: true, sortValue: (row) => row.reseller ?? '', render: (row) => row.reseller ?? '-' },
    { key: 'program', label: t('common.program'), sortable: true, sortValue: (row) => row.program ?? '', render: (row) => row.program ?? '-' },
    { key: 'status', label: t('common.status'), sortable: true, sortValue: (row) => row.status ?? '', render: (row) => (row.status ? <StatusBadge status={row.status as 'active' | 'expired' | 'suspended' | 'cancelled' | 'inactive' | 'pending'} /> : '-') },
    { key: 'expiry', label: t('common.expiry'), sortable: true, sortValue: (row) => row.expiry ?? '', render: (row) => (row.expiry ? formatDate(row.expiry, locale) : '-') },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (row) => (
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
            <DropdownMenuItem onClick={() => setRenewLicenseId(row.license_id ?? null)} disabled={!row.license_id}>
              <RotateCw className="me-2 h-4 w-4" />
              {t('common.renew')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeactivateTarget(row)} disabled={!row.license_id}>
              <ShieldOff className="me-2 h-4 w-4" />
              {t('common.deactivate')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPauseTarget(row)} disabled={!row.license_id || row.status !== 'active'}>
              <Pause className="me-2 h-4 w-4" />
              {t('common.pause')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setResumeTarget(row)} disabled={!row.license_id || (row.status !== 'pending' && row.status !== 'cancelled')}>
              <Play className="me-2 h-4 w-4" />
              {row.status === 'cancelled' ? t('common.reactivate') : t('common.resume')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeleteTarget(row)}>
              <Trash2 className="me-2 h-4 w-4" />
              {t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [allVisibleSelected, lang, locale, selectableIds, selectedLicenseIds, someVisibleSelected, t])

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
      <PageHeader title={t('managerParent.pages.customers.title')} description={t('managerParent.pages.customers.description')} actions={<Button type="button" onClick={() => setActivationOpen(true)}><Plus className="me-2 h-4 w-4" />{t('reseller.pages.customers.addCustomer')}</Button>} />

      <Tabs value={status} onValueChange={(value) => setStatus(value as (typeof STATUS_OPTIONS)[number])}>
        <TabsList>
          {STATUS_OPTIONS.map((option) => (
            <TabsTrigger key={option} value={option}>{option === 'all' ? t('common.all') : t(`common.${option}`)}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={status} className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('managerParent.pages.customers.searchPlaceholder')} />
              <select value={resellerId} onChange={(event) => setResellerId(event.target.value ? Number(event.target.value) : '')} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="">{t('managerParent.pages.customers.allResellers')}</option>
                {(resellerQuery.data?.data ?? []).map((reseller) => (
                  <option key={reseller.id} value={reseller.id}>{reseller.name}</option>
                ))}
              </select>
              <select value={programId} onChange={(event) => setProgramId(event.target.value ? Number(event.target.value) : '')} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="">{t('managerParent.pages.customers.allPrograms')}</option>
                {(programsQuery.data?.data ?? []).map((program) => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </select>
            </CardContent>
          </Card>
          <DataTable
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
            <Card className="border-sky-200 bg-sky-50/70 dark:border-sky-900/40 dark:bg-sky-950/20">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="text-sm text-slate-600 dark:text-slate-300">{selectedLicenseIds.length} {t('common.selected', { defaultValue: 'selected' })}</span>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => setBulkRenewOpen(true)}>{t('reseller.pages.licenses.bulkRenew')}</Button>
                  <Button type="button" variant="secondary" onClick={() => setBulkDeactivateOpen(true)}>{t('reseller.pages.licenses.bulkDeactivate')}</Button>
                  <Button type="button" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>{t('common.deleteSelected', { defaultValue: 'Delete Selected' })}</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>

      <Dialog open={activationOpen} onOpenChange={setActivationOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('reseller.pages.customers.activationDialog.title')}</DialogTitle>
            <DialogDescription>{t('reseller.pages.customers.activationDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-4">
            {activationSteps.map((label, index) => (
              <div key={label} className={`rounded-2xl border px-4 py-3 text-sm ${index === activationStep ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/30 dark:text-sky-300' : 'border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400'}`}>
                <div className="text-xs uppercase tracking-wide">{t('reseller.pages.customers.activationDialog.stepLabel')} {index + 1}</div>
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
            <p className="text-xs text-slate-500 dark:text-slate-400">{Math.round(((activationStep + 1) / activationSteps.length) * 100)}%</p>
          </div>
          {activationStep === 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label={t('activate.username', { defaultValue: 'Username (API)' })} htmlFor="mp-customer-username">
                <Input id="mp-customer-username" placeholder={t('activate.usernameHint', { defaultValue: 'letters, numbers, underscore only' })} value={activationForm.customer_name} onChange={(event) => setActivationForm((current) => ({ ...current, customer_name: event.target.value }))} onBlur={() => setActivationForm((current) => ({ ...current, customer_name: formatUsername(current.customer_name) }))} />
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
              <p className="md:col-span-2 text-xs text-slate-500 dark:text-slate-400">{t('activate.usernameHint', { defaultValue: 'letters, numbers, underscore only' })}</p>
            </div>
          ) : null}
          {activationStep === 1 ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder={t('reseller.pages.customers.activationDialog.biosId')} value={activationForm.bios_id} onChange={(event) => setActivationForm((current) => ({ ...current, bios_id: event.target.value }))} />
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
                <Input type="date" value={activationForm.end_date} onChange={(event) => setActivationForm((current) => ({ ...current, end_date: event.target.value }))} />
              )}

              <div className="space-y-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={activationForm.is_scheduled} onChange={(event) => setActivationForm((current) => ({ ...current, is_scheduled: event.target.checked }))} />
                  {t('activate.scheduleToggle')}
                </label>
                {activationForm.is_scheduled ? (
                  <>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant={activationForm.schedule_mode === 'relative' ? 'default' : 'outline'} onClick={() => setActivationForm((current) => ({ ...current, schedule_mode: 'relative' }))}>Relative</Button>
                      <Button type="button" size="sm" variant={activationForm.schedule_mode === 'custom' ? 'default' : 'outline'} onClick={() => setActivationForm((current) => ({ ...current, schedule_mode: 'custom' }))}>Custom</Button>
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
                          <option value="UTC">UTC</option>
                          <option value="America/New_York">America/New_York</option>
                          <option value="America/Chicago">America/Chicago</option>
                          <option value="America/Los_Angeles">America/Los_Angeles</option>
                          <option value="Europe/London">Europe/London</option>
                          <option value="Europe/Paris">Europe/Paris</option>
                          <option value="Asia/Tokyo">Asia/Tokyo</option>
                          <option value="Asia/Dubai">Asia/Dubai</option>
                        </select>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input type="datetime-local" value={activationForm.scheduled_date_time} onChange={(event) => setActivationForm((current) => ({ ...current, scheduled_date_time: event.target.value }))} />
                        <select value={activationForm.scheduled_timezone} onChange={(event) => setActivationForm((current) => ({ ...current, scheduled_timezone: event.target.value }))} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                          <option value="UTC">UTC</option>
                          <option value="America/New_York">America/New_York</option>
                          <option value="America/Chicago">America/Chicago</option>
                          <option value="America/Los_Angeles">America/Los_Angeles</option>
                          <option value="Europe/London">Europe/London</option>
                          <option value="Europe/Paris">Europe/Paris</option>
                          <option value="Asia/Tokyo">Asia/Tokyo</option>
                          <option value="Asia/Dubai">Asia/Dubai</option>
                        </select>
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>{t('common.price')}</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={priceMode === 'auto' ? 'default' : 'outline'} onClick={() => setPriceMode('auto')}>Auto</Button>
                  <Button type="button" size="sm" variant={priceMode === 'manual' ? 'default' : 'outline'} onClick={() => setPriceMode('manual')}>Manual</Button>
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
                <div>{expiryPreview ? formatDate(expiryPreview, locale) : '-'}</div>
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

      <Dialog open={renewLicenseId !== null} onOpenChange={(open) => !open && setRenewLicenseId(null)}>
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
            <Button type="button" variant="ghost" onClick={() => setRenewLicenseId(null)}>{t('common.cancel')}</Button>
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
        description={deactivateTarget?.bios_id ?? undefined}
        confirmLabel={t('common.deactivate')}
        isDestructive
        onConfirm={() => {
          if (deactivateTarget?.license_id) {
            deactivateMutation.mutate(deactivateTarget.license_id)
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
      />

      <ConfirmDialog
        open={resumeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResumeTarget(null)
          }
        }}
        title={resumeTarget?.status === 'cancelled' ? t('common.reactivate') : t('common.resume')}
        description={resumeTarget?.bios_id ?? undefined}
        confirmLabel={resumeTarget?.status === 'cancelled' ? t('common.reactivate') : t('common.resume')}
        onConfirm={() => {
          if (resumeTarget?.license_id) {
            resumeMutation.mutate(resumeTarget.license_id)
          }
        }}
      />

      <Dialog open={bulkRenewOpen} onOpenChange={setBulkRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reseller.pages.licenses.bulkRenew')}</DialogTitle>
            <DialogDescription>{selectedLicenseIds.length} {t('common.selected', { defaultValue: 'selected' })}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-3">
            <Input type="number" min={1} value={bulkDuration} onChange={(event) => setBulkDuration(event.target.value)} />
            <select value={bulkUnit} onChange={(event) => setBulkUnit(event.target.value as DurationUnit)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="days">{t('common.days')}</option>
              <option value="months">{t('common.months')}</option>
              <option value="years">{t('common.years')}</option>
            </select>
            <Input type="number" min={0} step="0.01" value={bulkPrice} onChange={(event) => setBulkPrice(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setBulkRenewOpen(false)}>{t('common.cancel')}</Button>
            <Button type="button" onClick={() => bulkRenewMutation.mutate()} disabled={bulkRenewMutation.isPending}>{t('reseller.pages.licenses.bulkRenew')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={bulkDeactivateOpen}
        onOpenChange={setBulkDeactivateOpen}
        title={t('reseller.pages.licenses.confirm.bulkDeactivateTitle')}
        description={t('reseller.pages.licenses.confirm.bulkDeactivateDescription', { count: selectedLicenseIds.length })}
        confirmLabel={t('reseller.pages.licenses.confirm.deactivateSelected')}
        isDestructive
        onConfirm={() => bulkDeactivateMutation.mutate()}
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
    </div>
  )
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
  return date.toISOString()
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
    return 'Phone must contain digits only.'
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

