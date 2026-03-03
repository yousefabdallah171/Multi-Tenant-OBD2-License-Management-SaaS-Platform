import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RotateCw, ShieldOff } from 'lucide-react'
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
import { formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { licenseService } from '@/services/license.service'
import { managerService } from '@/services/manager.service'
import { programService } from '@/services/program.service'
import type { DurationUnit, ManagerCustomerSummary } from '@/types/manager-reseller.types'

const STATUS_OPTIONS = ['all', 'active', 'expired', 'suspended', 'pending'] as const

interface ActivationFormState {
  customer_name: string
  customer_email: string
  customer_phone: string
  bios_id: string
  program_id: number | ''
  duration_value: string
  duration_unit: DurationUnit
  price: string
}

const EMPTY_ACTIVATION_FORM: ActivationFormState = {
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  bios_id: '',
  program_id: '',
  duration_value: '30',
  duration_unit: 'days',
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
  const [renewLicenseId, setRenewLicenseId] = useState<number | null>(null)
  const [renewDuration, setRenewDuration] = useState('30')
  const [renewUnit, setRenewUnit] = useState<DurationUnit>('days')
  const [renewPrice, setRenewPrice] = useState('')
  const [deactivateTarget, setDeactivateTarget] = useState<ManagerCustomerSummary | null>(null)

  const customersQuery = useQuery({
    queryKey: ['manager', 'customers', page, perPage, search, status, resellerId, programId],
    queryFn: () =>
      managerService.getCustomers({
        page,
        per_page: perPage,
        search,
        reseller_id: resellerId,
        program_id: programId,
        status: status === 'all' ? '' : status,
      }),
  })

  const resellerQuery = useQuery({
    queryKey: ['manager', 'customers', 'resellers'],
    queryFn: () => managerService.getTeam({ per_page: 100 }),
  })

  const programsQuery = useQuery({
    queryKey: ['manager', 'customers', 'programs'],
    queryFn: () => programService.getAll({ per_page: 100 }),
  })

  const activateMutation = useMutation({
    mutationFn: () =>
      licenseService.activate({
        customer_name: activationForm.customer_name.trim(),
        customer_email: activationForm.customer_email.trim() || undefined,
        customer_phone: activationForm.customer_phone.trim() || undefined,
        bios_id: activationForm.bios_id.trim(),
        program_id: Number(activationForm.program_id),
        duration_days: durationToDays(Number(activationForm.duration_value), activationForm.duration_unit),
        price: Number(activationForm.price),
      }),
    onSuccess: () => {
      setActivationOpen(false)
      setActivationStep(0)
      setActivationForm(EMPTY_ACTIVATION_FORM)
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
      setRenewLicenseId(null)
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const deactivateMutation = useMutation({
    mutationFn: (licenseId: number) => licenseService.deactivate(licenseId),
    onSuccess: () => {
      setDeactivateTarget(null)
      invalidate(queryClient)
    },
    onError: () => toast.error(t('common.error')),
  })

  const columns = useMemo<Array<DataTableColumn<ManagerCustomerSummary>>>(() => [
    {
      key: 'name',
      label: t('common.name'),
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => (isLikelyBios(row.name) ? '—' : row.name),
    },
    { key: 'email', label: t('common.email'), sortable: true, sortValue: (row) => row.email ?? '', render: (row) => row.email ?? '-' },
    {
      key: 'phone',
      label: t('common.phone'),
      sortable: true,
      sortValue: (row) => row.phone ?? '',
      render: (row) => (row.phone && row.phone.length > 20 ? '—' : row.phone ?? '-'),
    },
    {
      key: 'bios',
      label: t('manager.pages.customers.biosId'),
      sortable: true,
      sortValue: (row) => row.bios_id ?? '',
      render: (row) => row.bios_id ? (
        <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.manager.customerDetail(lang, row.id)}>
          {row.bios_id}
        </Link>
      ) : '-',
    },
    { key: 'reseller', label: t('common.reseller'), sortable: true, sortValue: (row) => row.reseller ?? '', render: (row) => row.reseller ?? '-' },
    { key: 'program', label: t('common.program'), sortable: true, sortValue: (row) => row.program ?? '', render: (row) => row.program ?? '-' },
    {
      key: 'status',
      label: t('common.status'),
      sortable: true,
      sortValue: (row) => row.status ?? '',
      render: (row) => (row.status ? <StatusBadge status={row.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} /> : '-'),
    },
    { key: 'expiry', label: t('common.expiry'), sortable: true, sortValue: (row) => row.expiry ?? '', render: (row) => (row.expiry ? formatDate(row.expiry, locale) : '-') },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setRenewLicenseId(row.license_id ?? null)} disabled={!row.license_id}>
            <RotateCw className="me-1 h-4 w-4" />
            {t('common.renew')}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setDeactivateTarget(row)} disabled={!row.license_id}>
            <ShieldOff className="me-1 h-4 w-4" />
            {t('common.deactivate')}
          </Button>
        </div>
      ),
    },
  ], [lang, locale, t])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('manager.layout.eyebrow')}
        title={t('manager.pages.customers.title')}
        description={t('manager.pages.customers.description')}
        actions={
          <Button type="button" onClick={() => setActivationOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t('reseller.pages.customers.addCustomer')}
          </Button>
        }
      />

      <Tabs value={status} onValueChange={(value) => setStatus(value as (typeof STATUS_OPTIONS)[number])}>
        <TabsList>
          {STATUS_OPTIONS.map((option) => (
            <TabsTrigger key={option} value={option}>{option === 'all' ? t('common.all') : t(`common.${option}`)}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={status} className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('manager.pages.customers.searchPlaceholder')} />
              <select value={resellerId} onChange={(event) => setResellerId(event.target.value ? Number(event.target.value) : '')} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="">{t('manager.pages.customers.allResellers')}</option>
                {(resellerQuery.data?.data ?? []).map((reseller) => (
                  <option key={reseller.id} value={reseller.id}>{reseller.name}</option>
                ))}
              </select>
              <select value={programId} onChange={(event) => setProgramId(event.target.value ? Number(event.target.value) : '')} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="">{t('manager.pages.customers.allPrograms')}</option>
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

      <Dialog open={activationOpen} onOpenChange={setActivationOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('reseller.pages.customers.activationDialog.title')}</DialogTitle>
            <DialogDescription>{t('reseller.pages.customers.activationDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-4">
            {(t('reseller.pages.customers.activationDialog.steps', { returnObjects: true }) as string[]).map((label, index) => (
              <div key={label} className={`rounded-2xl border px-4 py-3 text-sm ${index === activationStep ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/30 dark:text-sky-300' : 'border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400'}`}>
                {label}
              </div>
            ))}
          </div>
          {activationStep === 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder={t('reseller.pages.customers.activationDialog.customerName')} value={activationForm.customer_name} onChange={(event) => setActivationForm((current) => ({ ...current, customer_name: event.target.value }))} />
              <Input placeholder={t('reseller.pages.customers.activationDialog.customerEmail')} value={activationForm.customer_email} onChange={(event) => setActivationForm((current) => ({ ...current, customer_email: event.target.value }))} />
              <Input placeholder={t('common.phone')} value={activationForm.customer_phone} onChange={(event) => setActivationForm((current) => ({ ...current, customer_phone: event.target.value }))} />
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
            <div className="grid gap-3 md:grid-cols-3">
              <Input type="number" min={1} value={activationForm.duration_value} onChange={(event) => setActivationForm((current) => ({ ...current, duration_value: event.target.value }))} />
              <select value={activationForm.duration_unit} onChange={(event) => setActivationForm((current) => ({ ...current, duration_unit: event.target.value as DurationUnit }))} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="days">{t('common.days')}</option>
                <option value="months">{t('common.months')}</option>
                <option value="years">{t('common.years')}</option>
              </select>
              <Input type="number" min={0} step="0.01" value={activationForm.price} onChange={(event) => setActivationForm((current) => ({ ...current, price: event.target.value }))} />
            </div>
          ) : null}
          {activationStep === 3 ? (
            <Card>
              <CardContent className="grid gap-2 p-4 md:grid-cols-2">
                <div>{activationForm.customer_name}</div>
                <div>{activationForm.customer_email || '-'}</div>
                <div>{activationForm.bios_id}</div>
                <div>{activationForm.program_id}</div>
              </CardContent>
            </Card>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => (activationStep === 0 ? setActivationOpen(false) : setActivationStep((current) => current - 1))}>{activationStep === 0 ? t('common.cancel') : t('common.back')}</Button>
            {activationStep < 3 ? (
              <Button type="button" onClick={() => setActivationStep((current) => current + 1)}>{t('common.next')}</Button>
            ) : (
              <Button type="button" onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending}>{t('common.activate')}</Button>
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
    </div>
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
    queryClient.invalidateQueries({ queryKey: ['manager', 'customers'] }),
    queryClient.invalidateQueries({ queryKey: ['manager', 'licenses'] }),
  ])
}

function isLikelyBios(value: string | null | undefined): boolean {
  void value
  return false
}
