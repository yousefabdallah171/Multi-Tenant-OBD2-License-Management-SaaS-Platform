import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useResolvedTimezone } from '@/hooks/useResolvedTimezone'
import { getActivationDurationPresets } from '@/lib/activation-presets'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { COMMON_TIMEZONES, formatDateTimeLocalInTimezone, zonedDateTimeInputToUtcDate } from '@/lib/timezones'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { activateLicense } from '@/services/activation.service'
import { programService } from '@/services/program.service'
import { superAdminCustomerService } from '@/services/super-admin-customer.service'
import { tenantService } from '@/services/tenant.service'
import { userService } from '@/services/user.service'
import { formatUsername } from '@/utils/biosId'

type DurationUnit = 'minutes' | 'hours' | 'days'
type ScheduleMode = 'after' | 'on'

const MIN_DURATION_DAYS = 1 / 1440

function getDefaultEndDate(timeZone: string, days = 1) {
  const next = new Date()
  next.setDate(next.getDate() + days)
  return formatDateTimeLocalInTimezone(next, timeZone)
}

function getDefaultScheduleDate(timeZone: string) {
  const next = new Date()
  next.setHours(next.getHours() + 1)
  return formatDateTimeLocalInTimezone(next, timeZone)
}

function normalizePhoneInput(value: string) {
  const compact = value.replace(/[^\d+]/g, '')
  if (compact.startsWith('+')) {
    return `+${compact.slice(1).replace(/\+/g, '')}`
  }

  return compact.replace(/\+/g, '')
}

function durationToDays(value: number, unit: DurationUnit) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  if (unit === 'minutes') return value / 1440
  if (unit === 'hours') return value / 24
  return value
}

function buildRelativeSchedule(value: number, unit: DurationUnit) {
  const next = new Date()
  if (unit === 'minutes') next.setMinutes(next.getMinutes() + value)
  if (unit === 'hours') next.setHours(next.getHours() + value)
  if (unit === 'days') next.setDate(next.getDate() + value)
  return next
}

export function CreateCustomerPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const { timezone: displayTimezone } = useResolvedTimezone()
  const previousDisplayTimezoneRef = useRef(displayTimezone)
  const durationPresets = useMemo(() => getActivationDurationPresets(t), [t])
  const [customerName, setCustomerName] = useState('')
  const [clientName, setClientName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [tenantId, setTenantId] = useState<number | ''>('')
  const [sellerId, setSellerId] = useState<number | ''>('')
  const [createLicenseNow, setCreateLicenseNow] = useState(true)
  const [biosId, setBiosId] = useState('')
  const [programId, setProgramId] = useState<number | ''>('')
  const [mode, setMode] = useState<'duration' | 'end_date'>('end_date')
  const [durationValue, setDurationValue] = useState('30')
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days')
  const [endDate, setEndDate] = useState(() => getDefaultEndDate(displayTimezone))
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('on')
  const [scheduleAfterValue, setScheduleAfterValue] = useState('1')
  const [scheduleAfterUnit, setScheduleAfterUnit] = useState<DurationUnit>('hours')
  const [scheduleAt, setScheduleAt] = useState(() => getDefaultScheduleDate(displayTimezone))
  const [scheduleTimezone, setScheduleTimezone] = useState(displayTimezone)
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto')
  const [priceInput, setPriceInput] = useState('0.00')
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    const previousDisplayTimezone = previousDisplayTimezoneRef.current
    if (previousDisplayTimezone === displayTimezone) {
      return
    }

    setEndDate((current) => current === getDefaultEndDate(previousDisplayTimezone) ? getDefaultEndDate(displayTimezone) : current)
    setScheduleTimezone((current) => current === previousDisplayTimezone ? displayTimezone : current)
    setScheduleAt((current) => !current || current === getDefaultScheduleDate(previousDisplayTimezone) ? getDefaultScheduleDate(displayTimezone) : current)
    previousDisplayTimezoneRef.current = displayTimezone
  }, [displayTimezone])

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'customer-create', 'tenants'],
    queryFn: () => tenantService.getAll({ per_page: 100 }),
  })

  const sellersQuery = useQuery({
    queryKey: ['super-admin', 'customer-create', 'sellers', tenantId],
    queryFn: () => userService.getAll({ per_page: 100, tenant_id: tenantId || '', role: 'reseller', status: 'active' }),
    enabled: tenantId !== '',
  })

  const programsQuery = useQuery({
    queryKey: ['super-admin', 'customer-create', 'programs'],
    queryFn: () => programService.getAll({ per_page: 100, status: 'active' }),
  })

  useEffect(() => {
    setSellerId('')
  }, [tenantId])

  useEffect(() => {
    if (!scheduleEnabled || scheduleMode !== 'after') {
      return
    }

    const value = Number(scheduleAfterValue)
    if (!Number.isFinite(value) || value <= 0) {
      return
    }

    setScheduleAt(formatDateTimeLocalInTimezone(buildRelativeSchedule(value, scheduleAfterUnit), scheduleTimezone))
  }, [scheduleAfterUnit, scheduleAfterValue, scheduleEnabled, scheduleMode, scheduleTimezone])

  const sellerOptions = useMemo(() => sellersQuery.data?.data ?? [], [sellersQuery.data?.data])
  const sellerPlaceholder = !tenantId
    ? t('activate.selectTenantFirst', { defaultValue: 'Select a tenant first' })
    : sellersQuery.isLoading
      ? t('common.loading', { defaultValue: 'Loading...' })
      : sellerOptions.length === 0
        ? t('activate.noResellersAvailable', { defaultValue: 'No active resellers available' })
        : t('common.selectOption', { defaultValue: 'Select option' })

  const selectedProgram = (programsQuery.data?.data ?? []).find((program) => program.id === programId)

  const effectiveStartDate = useMemo(() => {
    if (!createLicenseNow || !scheduleEnabled) {
      return new Date()
    }

    return zonedDateTimeInputToUtcDate(scheduleAt, scheduleTimezone) ?? new Date()
  }, [createLicenseNow, scheduleAt, scheduleEnabled, scheduleTimezone])

  const durationDays = useMemo(() => {
    if (!createLicenseNow) {
      return 0
    }

    if (mode === 'end_date') {
      if (!endDate) return 0
      const zonedEndDate = zonedDateTimeInputToUtcDate(endDate, displayTimezone)
      if (!zonedEndDate) return 0
      const diff = zonedEndDate.getTime() - effectiveStartDate.getTime()
      return diff > 0 ? diff / 86400000 : 0
    }

    return durationToDays(Number(durationValue), durationUnit)
  }, [createLicenseNow, displayTimezone, durationUnit, durationValue, effectiveStartDate, endDate, mode])

  const autoPrice = useMemo(() => {
    if (!selectedProgram || !createLicenseNow) return 0
    return Number((Math.max(durationDays, 0) * Number(selectedProgram.base_price ?? 0)).toFixed(2))
  }, [createLicenseNow, durationDays, selectedProgram])

  useEffect(() => {
    if (priceMode === 'auto') {
      setPriceInput(autoPrice.toFixed(2))
    }
  }, [autoPrice, priceMode])

  const totalPrice = useMemo(() => {
    if (priceMode === 'auto') return autoPrice
    const parsed = Number(priceInput)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  }, [autoPrice, priceInput, priceMode])

  const expiryPreview = useMemo(() => {
    if (!createLicenseNow || durationDays <= 0) return ''
    if (mode === 'end_date') {
      const zonedEndDate = zonedDateTimeInputToUtcDate(endDate, displayTimezone)
      return zonedEndDate ? zonedEndDate.toISOString() : ''
    }
    return new Date(effectiveStartDate.getTime() + durationDays * 86400000).toISOString()
  }, [createLicenseNow, displayTimezone, durationDays, effectiveStartDate, endDate, mode])

  const startSummary = useMemo(() => {
    if (!createLicenseNow) {
      return ''
    }

    if (!scheduleEnabled) {
      return t('activate.startingNow', { defaultValue: 'Starting now' })
    }

    const scheduledDate = zonedDateTimeInputToUtcDate(scheduleAt, scheduleTimezone)
    if (!scheduledDate) {
      return t('activate.startingFromPending', { defaultValue: 'Starting from the selected date' })
    }

    return `${t('activate.startingFrom', { defaultValue: 'Starting from' })}: ${formatDate(scheduledDate.toISOString(), locale, scheduleTimezone)} (${scheduleTimezone})`
  }, [createLicenseNow, locale, scheduleAt, scheduleEnabled, scheduleTimezone, t])

  const endSummary = useMemo(() => {
    if (!createLicenseNow) {
      return ''
    }

    if (!expiryPreview) {
      return t('activate.endingDatePending', { defaultValue: 'Ending date will be calculated after you choose the duration.' })
    }

    return `${t('activate.endingDate', { defaultValue: 'Ending date' })}: ${formatDate(expiryPreview, locale, mode === 'end_date' ? displayTimezone : scheduleEnabled ? scheduleTimezone : displayTimezone)}`
  }, [createLicenseNow, displayTimezone, expiryPreview, locale, mode, scheduleEnabled, scheduleTimezone, t])

  const errors = useMemo(() => {
    const next: Record<string, string> = {}
    if (customerName.trim().length < 2) next.customerName = t('validation.required', { defaultValue: 'Field required' })
    if (!tenantId) next.tenantId = t('validation.required', { defaultValue: 'Field required' })
    if (email.trim() && !/\S+@\S+\.\S+/.test(email.trim())) next.email = t('validation.invalidEmail', { defaultValue: 'Invalid email format' })
    if (phone.trim() && !/^\+?\d{6,20}$/.test(phone.trim())) next.phone = t('validation.invalidPhone', { defaultValue: 'Invalid phone number' })
    if (biosId.trim().length < 3) next.biosId = t('validation.required', { defaultValue: 'Field required' })
    if (!programId) next.programId = t('validation.required', { defaultValue: 'Field required' })
    if (!sellerId) next.sellerId = t('validation.required', { defaultValue: 'Field required' })

    if (createLicenseNow) {
      if (durationDays < MIN_DURATION_DAYS) next.duration = t('validation.invalidNumber', { defaultValue: 'Invalid number' })
      if (scheduleEnabled) {
        const scheduledAt = zonedDateTimeInputToUtcDate(scheduleAt, scheduleTimezone)?.getTime() ?? Number.NaN
        if (!scheduleAt || !Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
          next.scheduleAt = t('validation.invalidNumber', { defaultValue: 'Invalid number' })
        }
      }
    }

    return next
  }, [biosId, createLicenseNow, customerName, durationDays, email, phone, programId, scheduleAt, scheduleEnabled, scheduleTimezone, sellerId, t, tenantId])

  const createOnlyMutation = useMutation({
    mutationFn: () => superAdminCustomerService.create({
      name: formatUsername(customerName.trim()),
      client_name: clientName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      tenant_id: Number(tenantId),
      seller_id: sellerId ? Number(sellerId) : undefined,
      bios_id: biosId.trim() || undefined,
      program_id: programId ? Number(programId) : undefined,
    }),
    onSuccess: () => {
      setSubmitError('')
      toast.success(t('common.customerCreatedSuccess', { defaultValue: 'Customer created successfully.' }))
      navigate(routePaths.superAdmin.customers(lang))
    },
    onError: (error: unknown) => {
      const rawMessage = resolveApiErrorMessage(error, t('common.error'))
      const normalized = rawMessage.toLowerCase()
      const message = normalized.includes('blacklisted') ? t('activate.biosBlacklisted') : rawMessage
      setSubmitError(message)
    },
  })

  const activateMutation = useMutation({
    mutationFn: () => activateLicense({
      seller_id: Number(sellerId),
      customer_name: formatUsername(customerName.trim()),
      client_name: clientName.trim() || undefined,
      customer_email: email.trim() || undefined,
      customer_phone: phone.trim() || undefined,
      bios_id: biosId.trim(),
      program_id: Number(programId),
      duration_days: Number(durationDays.toFixed(6)),
      price: totalPrice,
      is_scheduled: scheduleEnabled || undefined,
      scheduled_date_time: scheduleEnabled ? scheduleAt : undefined,
      scheduled_timezone: scheduleEnabled ? scheduleTimezone : undefined,
    }),
    onSuccess: () => {
      setSubmitError('')
      toast.success(
        scheduleEnabled
          ? t('common.activationScheduledSuccess', { defaultValue: 'Activation scheduled successfully.' })
          : t('common.licenseActivatedSuccess', { defaultValue: 'License activated successfully.' }),
      )
      navigate(routePaths.superAdmin.customers(lang))
    },
    onError: (error: unknown) => {
      const rawMessage = resolveApiErrorMessage(error, t('common.error'))
      const normalized = rawMessage.toLowerCase()
      const message = normalized.includes('blacklisted') ? t('activate.biosBlacklisted') : rawMessage
      setSubmitError(message)
    },
  })

  const isBusy = createOnlyMutation.isPending || activateMutation.isPending

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
          <CardTitle>{t('superAdmin.pages.customers.addCustomer', { defaultValue: 'Add Customer' })}</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('superAdmin.pages.customers.createDescription', { defaultValue: 'Create a customer profile or activate a license from the super admin workspace.' })}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('activate.username', { defaultValue: 'Username (API)' })} hint={t('activate.usernameHint', { defaultValue: 'API username — auto-formatted (no spaces)' })} error={errors.customerName}>
              <Input value={customerName} placeholder={t('activate.usernamePlaceholder', { defaultValue: 'e.g. john_doe' })} maxLength={10} onChange={(event) => setCustomerName(event.target.value)} onBlur={(event) => setCustomerName(formatUsername(event.target.value))} />
            </Field>
            <Field label={t('activate.clientName', { defaultValue: 'Client Display Name' })} hint={t('activate.clientNameHint', { defaultValue: 'Human-readable name for display in your dashboard' })}>
              <Input value={clientName} placeholder={t('activate.clientNamePlaceholder', { defaultValue: 'Full client name (optional)' })} onChange={(event) => setClientName(event.target.value)} />
            </Field>
            <Field label={t('common.tenant')} error={errors.tenantId}>
              <select value={tenantId} onChange={(event) => setTenantId(event.target.value ? Number(event.target.value) : '')} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="">{t('common.selectOption', { defaultValue: 'Select option' })}</option>
                {(tenantsQuery.data?.data ?? []).map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t('common.reseller')} error={errors.sellerId}>
              <select
                value={sellerId}
                onChange={(event) => setSellerId(event.target.value ? Number(event.target.value) : '')}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                disabled={!tenantId || sellersQuery.isLoading}
              >
                <option value="">{sellerPlaceholder}</option>
                {sellerOptions.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {`${seller.name} (${t(`roles.${seller.role}`)})`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('activate.customerEmail', { defaultValue: 'Customer Email' })} error={errors.email}>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field label={t('common.phone')} error={errors.phone}>
              <Input type="tel" value={phone} onChange={(event) => setPhone(normalizePhoneInput(event.target.value))} placeholder="+966..." />
            </Field>
          </div>

          {submitError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {submitError}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('activate.biosId')} hint={t('activate.biosIdHint', { defaultValue: 'Hardware BIOS serial number for this machine.' })} error={errors.biosId}>
              <Input value={biosId} maxLength={10} onChange={(event) => setBiosId(event.target.value)} />
            </Field>
            <Field label={t('common.program')} error={errors.programId}>
              <select value={programId} onChange={(event) => setProgramId(event.target.value ? Number(event.target.value) : '')} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="">{t('reseller.pages.customers.activationDialog.selectProgram', { defaultValue: 'Select program' })}</option>
                {(programsQuery.data?.data ?? []).map((program) => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="grid gap-3 md:grid-cols-2">
              <Button type="button" variant={createLicenseNow ? 'default' : 'outline'} className="justify-start" onClick={() => setCreateLicenseNow(true)}>
                {t('activate.scheduleToggleNow', { defaultValue: 'Create and activate license now' })}
              </Button>
              <Button
                type="button"
                variant="outline"
                className={createLicenseNow
                  ? 'justify-start border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/30'
                  : 'justify-start border-rose-500 bg-rose-600 text-white hover:bg-rose-700 hover:text-white dark:border-rose-500 dark:bg-rose-600 dark:text-white dark:hover:bg-rose-700'}
                onClick={() => setCreateLicenseNow(false)}
              >
                {t('activate.createCustomerOnly', { defaultValue: 'Create customer only' })}
              </Button>
            </div>
            <p className={`mt-3 rounded-2xl px-4 py-3 text-xs ${
              createLicenseNow
                ? 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
            }`}>
              {createLicenseNow
                ? t('activate.reviewDescription', { defaultValue: 'Create the customer and activate the license now.' })
                : t('activate.createCustomerOnlyHint', { defaultValue: 'Saving now will create the customer as not active yet and keep this BIOS ID plus program saved as pending.' })}
            </p>
          </div>

          {createLicenseNow ? (
            <>
              <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
                    {t('activate.startingLabel', { defaultValue: 'Starting' })}
                  </p>
                  <p className="mt-1 text-base font-semibold text-emerald-900 dark:text-emerald-100">{startSummary}</p>
                </div>
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(event) => {
                      const checked = event.target.checked
                      setScheduleEnabled(checked)
                      if (checked) {
                        setScheduleMode('on')
                        setScheduleAt((current) => current || getDefaultScheduleDate(scheduleTimezone))
                      }
                    }}
                  />
                  {t('activate.scheduleToggle', { defaultValue: 'Schedule activation for later' })}
                </label>
                {scheduleEnabled ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant={scheduleMode === 'on' ? 'default' : 'outline'} onClick={() => setScheduleMode('on')}>{t('activate.scheduleModeCustom', { defaultValue: 'Custom Date' })}</Button>
                      <Button type="button" size="sm" variant={scheduleMode === 'after' ? 'default' : 'outline'} onClick={() => setScheduleMode('after')}>{t('activate.scheduleModeRelative', { defaultValue: 'After' })}</Button>
                    </div>
                    {scheduleMode === 'after' ? (
                      <div className="grid gap-3 md:grid-cols-3">
                        <Input value={scheduleAfterValue} onChange={(event) => setScheduleAfterValue(event.target.value.replace(/[^\d.]/g, ''))} />
                        <select value={scheduleAfterUnit} onChange={(event) => setScheduleAfterUnit(event.target.value as DurationUnit)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                          <option value="minutes">{t('common.minutes', { defaultValue: 'Minutes' })}</option>
                          <option value="hours">{t('common.hours', { defaultValue: 'Hours' })}</option>
                          <option value="days">{t('common.days')}</option>
                        </select>
                        <Input type="datetime-local" value={scheduleAt} readOnly />
                      </div>
                    ) : (
                      <Input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} />
                    )}
                    <select value={scheduleTimezone} onChange={(event) => setScheduleTimezone(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                      {COMMON_TIMEZONES.map((timezone) => (
                        <option key={timezone.value} value={timezone.value}>{timezone.label}</option>
                      ))}
                    </select>
                    {errors.scheduleAt ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.scheduleAt}</p> : null}
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
                    {t('activate.endingLabel', { defaultValue: 'Ending' })}
                  </p>
                  <p className="mt-1 text-base font-semibold text-emerald-900 dark:text-emerald-100">{endSummary}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Label>{t('common.duration')}</Label>
                  <Button type="button" size="sm" variant={mode === 'duration' ? 'default' : 'outline'} onClick={() => setMode('duration')}>{t('activate.durationMode', { defaultValue: 'Duration' })}</Button>
                  <Button type="button" size="sm" variant={mode === 'end_date' ? 'default' : 'outline'} onClick={() => setMode('end_date')}>{t('common.endDate', { defaultValue: 'End Date' })}</Button>
                </div>
                {mode === 'duration' ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-[140px_180px_1fr]">
                      <Input value={durationValue} onChange={(event) => setDurationValue(event.target.value.replace(/[^\d.]/g, ''))} />
                      <select value={durationUnit} onChange={(event) => setDurationUnit(event.target.value as DurationUnit)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                        <option value="minutes">{t('common.minutes', { defaultValue: 'Minutes' })}</option>
                        <option value="hours">{t('common.hours', { defaultValue: 'Hours' })}</option>
                        <option value="days">{t('common.days')}</option>
                      </select>
                      <div className="flex flex-wrap gap-2">
                        {durationPresets.map((preset) => (
                          <Button key={preset.label} type="button" size="sm" variant="outline" onClick={() => { setMode('duration'); setDurationValue(preset.value); setDurationUnit(preset.unit as DurationUnit) }}>{preset.label}</Button>
                        ))}
                      </div>
                    </div>
                    {errors.duration ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.duration}</p> : null}
                  </>
                ) : (
                  <Field label={t('activate.endDateTime', { defaultValue: 'End Date & Time' })} error={errors.duration}>
                    <Input type="datetime-local" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                  </Field>
                )}
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <Label>{t('activate.price', { defaultValue: 'Total Price' })}</Label>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={priceMode === 'auto' ? 'default' : 'outline'} onClick={() => setPriceMode('auto')}>{t('activate.priceModeAuto', { defaultValue: 'Auto' })}</Button>
                    <Button type="button" size="sm" variant={priceMode === 'manual' ? 'default' : 'outline'} onClick={() => setPriceMode('manual')}>{t('activate.priceModeManual', { defaultValue: 'Manual' })}</Button>
                  </div>
                </div>
                <Input value={priceInput} readOnly={priceMode === 'auto'} onChange={(event) => setPriceInput(event.target.value.replace(/[^\d.]/g, ''))} />
                <p className="text-xs text-slate-500 dark:text-slate-400">{priceMode === 'auto' ? t('activate.priceAuto', { defaultValue: 'Auto-calculated' }) : t('activate.priceManualHint', { defaultValue: 'Enter custom price' })}</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <Summary label={t('activate.durationDays', { defaultValue: 'Duration in Days' })} value={durationDays > 0 ? durationDays.toFixed(3) : '0'} />
                  <Summary label={t('activate.expiryPreview', { defaultValue: 'Expiry Preview' })} value={expiryPreview ? formatDate(expiryPreview, locale, mode === 'end_date' ? displayTimezone : scheduleEnabled ? scheduleTimezone : displayTimezone) : '-'} />
                  <Summary label={t('activate.price', { defaultValue: 'Price' })} value={formatCurrency(totalPrice, 'USD', locale)} />
                </div>
              </div>
            </>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate(routePaths.superAdmin.customers(lang))} disabled={isBusy}>{t('common.cancel')}</Button>
            <Button
              type="button"
              disabled={Object.keys(errors).length > 0 || isBusy}
              onClick={() => {
                setSubmitError('')
                if (createLicenseNow) {
                  activateMutation.mutate()
                  return
                }
                createOnlyMutation.mutate()
              }}
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {createLicenseNow ? t('common.activate', { defaultValue: 'Activate' }) : t('activate.createCustomerSubmit', { defaultValue: 'Create customer' })}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, children, hint, error }: { label: string; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
      {error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  )
}

function Summary({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  )
}
