import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { routePaths } from '@/router/routes'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/utils'
import { activateLicense } from '@/services/activation.service'
import { adminService } from '@/services/admin.service'
import { programService } from '@/services/program.service'
import { superAdminCustomerService } from '@/services/super-admin-customer.service'
import { tenantService } from '@/services/tenant.service'
import { formatUsername } from '@/utils/biosId'

export function CreateCustomerPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [tenantId, setTenantId] = useState<number | ''>('')
  const [sellerId, setSellerId] = useState<number | ''>('')
  const [programId, setProgramId] = useState<number | ''>('')
  const [biosId, setBiosId] = useState('')
  const [durationDays, setDurationDays] = useState('30')
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto')
  const [priceInput, setPriceInput] = useState('0.00')
  const [createLicenseNow, setCreateLicenseNow] = useState(true)

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'customers', 'tenant-options'],
    queryFn: () => tenantService.getAll({ per_page: 100 }),
  })

  const sellersQuery = useQuery({
    queryKey: ['super-admin', 'customers', 'seller-options', tenantId],
    queryFn: () => adminService.getAll({ per_page: 100, tenant_id: tenantId || '' }),
    enabled: tenantId !== '',
  })

  const programsQuery = useQuery({
    queryKey: ['super-admin', 'customers', 'program-options'],
    queryFn: () => programService.getAll({ per_page: 100, status: 'active' }),
  })

  const sellerOptions = useMemo(
    () => (sellersQuery.data?.data ?? []).filter((user) => user.role !== 'super_admin' && user.role !== 'customer'),
    [sellersQuery.data?.data],
  )

  const selectedProgram = useMemo(
    () => (programsQuery.data?.data ?? []).find((program) => program.id === programId),
    [programId, programsQuery.data?.data],
  )

  const normalizedDurationDays = useMemo(() => {
    const parsed = Number(durationDays)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }, [durationDays])

  const autoPrice = useMemo(() => {
    if (!selectedProgram || normalizedDurationDays <= 0) {
      return 0
    }

    return Number((normalizedDurationDays * Number(selectedProgram.base_price ?? 0)).toFixed(2))
  }, [normalizedDurationDays, selectedProgram])

  const resolvedPrice = useMemo(() => {
    if (priceMode === 'auto') {
      return autoPrice
    }

    const parsed = Number(priceInput)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  }, [autoPrice, priceInput, priceMode])

  const createMutation = useMutation({
    mutationFn: () => superAdminCustomerService.create({
      name: formatUsername(name.trim()),
      client_name: clientName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      tenant_id: Number(tenantId),
    }),
    onSuccess: () => {
      toast.success(t('common.saved', { defaultValue: 'Saved' }))
      navigate(routePaths.superAdmin.customers(lang))
    },
    onError: (error: unknown) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  const activateMutation = useMutation({
    mutationFn: () => activateLicense({
      seller_id: Number(sellerId),
      program_id: Number(programId),
      customer_name: formatUsername(name.trim()),
      client_name: clientName.trim() || undefined,
      customer_email: email.trim() || undefined,
      customer_phone: phone.trim() || undefined,
      bios_id: biosId.trim(),
      duration_days: normalizedDurationDays,
      price: resolvedPrice,
    }),
    onSuccess: () => {
      toast.success(t('activate.successTitle', { defaultValue: 'Activated successfully' }))
      navigate(routePaths.superAdmin.customers(lang))
    },
    onError: (error: unknown) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  const isBusy = createMutation.isPending || activateMutation.isPending
  const canCreateOnly = !!name.trim() && tenantId !== ''
  const canActivate = canCreateOnly && sellerId !== '' && programId !== '' && biosId.trim().length >= 3 && normalizedDurationDays > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => navigate(routePaths.superAdmin.customers(lang))}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('managerParent.pages.customers.addCustomer', { defaultValue: 'Add Customer' })}</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">Create a global customer profile or activate a license directly across any tenant.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('activate.username', { defaultValue: 'Username (API)' })}>
              <Input value={name} onChange={(event) => setName(event.target.value)} onBlur={(event) => setName(formatUsername(event.target.value))} />
            </Field>
            <Field label={t('activate.clientName', { defaultValue: 'Client Display Name' })}>
              <Input value={clientName} onChange={(event) => setClientName(event.target.value)} />
            </Field>
            <Field label={t('common.tenant')}>
              <select value={tenantId} onChange={(event) => setTenantId(event.target.value ? Number(event.target.value) : '')} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="">{t('common.selectOption', { defaultValue: 'Select option' })}</option>
                {tenantsQuery.data?.data.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
              </select>
            </Field>
            <Field label={t('activate.customerEmail', { defaultValue: 'Customer Email' })}>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field label={t('common.phone')}>
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="grid gap-3 md:grid-cols-2">
              <Button type="button" variant={createLicenseNow ? 'default' : 'outline'} className="justify-start" onClick={() => setCreateLicenseNow(true)}>
                {t('activate.scheduleToggleNow', { defaultValue: 'Create and activate license now' })}
              </Button>
              <Button type="button" variant={createLicenseNow ? 'outline' : 'default'} className="justify-start" onClick={() => setCreateLicenseNow(false)}>
                {t('activate.createCustomerOnly', { defaultValue: 'Create customer only' })}
              </Button>
            </div>
          </div>

          {createLicenseNow ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t('common.reseller')}>
                  <select value={sellerId} onChange={(event) => setSellerId(event.target.value ? Number(event.target.value) : '')} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                    <option value="">{t('common.selectOption', { defaultValue: 'Select option' })}</option>
                    {sellerOptions.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
                  </select>
                </Field>
                <Field label={t('common.program')}>
                  <select value={programId} onChange={(event) => setProgramId(event.target.value ? Number(event.target.value) : '')} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                    <option value="">{t('common.selectOption', { defaultValue: 'Select option' })}</option>
                    {programsQuery.data?.data.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
                  </select>
                </Field>
                <Field label={t('activate.biosId', { defaultValue: 'BIOS ID' })}>
                  <Input value={biosId} onChange={(event) => setBiosId(event.target.value)} />
                </Field>
                <Field label={t('activate.durationDays', { defaultValue: 'Duration in Days' })}>
                  <Input value={durationDays} onChange={(event) => setDurationDays(event.target.value.replace(/[^\d.]/g, ''))} />
                </Field>
              </div>

              <div className="space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <Label>{t('activate.price', { defaultValue: 'Total Price' })}</Label>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={priceMode === 'auto' ? 'default' : 'outline'} onClick={() => { setPriceMode('auto'); setPriceInput(autoPrice.toFixed(2)) }}>
                      {t('activate.priceModeAuto', { defaultValue: 'Auto' })}
                    </Button>
                    <Button type="button" size="sm" variant={priceMode === 'manual' ? 'default' : 'outline'} onClick={() => setPriceMode('manual')}>
                      {t('activate.priceModeManual', { defaultValue: 'Manual' })}
                    </Button>
                  </div>
                </div>
                <Input value={priceMode === 'auto' ? autoPrice.toFixed(2) : priceInput} readOnly={priceMode === 'auto'} onChange={(event) => setPriceInput(event.target.value.replace(/[^\d.]/g, ''))} />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedProgram ? `${selectedProgram.name} · ${formatCurrency(resolvedPrice, 'USD', lang === 'ar' ? 'ar-EG' : 'en-US')}` : '-'}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate(routePaths.superAdmin.customers(lang))} disabled={isBusy}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (createLicenseNow) {
                  activateMutation.mutate()
                  return
                }

                createMutation.mutate()
              }}
              disabled={isBusy || (createLicenseNow ? !canActivate : !canCreateOnly)}
            >
              {isBusy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {createLicenseNow ? t('common.activate', { defaultValue: 'Activate' }) : t('common.save')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
