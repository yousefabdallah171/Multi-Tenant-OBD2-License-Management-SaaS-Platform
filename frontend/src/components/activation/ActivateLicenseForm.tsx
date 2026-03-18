import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { useResolvedTimezone } from '@/hooks/useResolvedTimezone'
import { useDebounce } from '@/hooks/useDebounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getActivationDurationPresets } from '@/lib/activation-presets'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { COMMON_TIMEZONES, formatDateTimeLocalInTimezone, zonedDateTimeInputToUtcDate } from '@/lib/timezones'
import { formatDate } from '@/lib/utils'
import { activateLicense } from '@/services/activation.service'
import { availabilityService, type BiosCheckResult } from '@/services/availability.service'
import type { ProgramDurationPreset } from '@/types/manager-reseller.types'
import { formatUsername } from '@/utils/biosId'

export interface ActivationProgram {
  id: number
  name: string
  price_per_day: number
  has_external_api?: boolean
  external_software_id?: number | null
  duration_presets?: ProgramDurationPreset[]
}

interface ActivateLicenseFormProps {
  program: ActivationProgram
  onCancel: () => void
  onSuccess?: () => void
}

interface ActivationFormErrors {
  customer_name?: string
  client_name?: string
  customer_email?: string
  customer_phone?: string
  bios_id?: string
  duration?: string
  end_date?: string
  scheduled_date_time?: string
  price?: string
}

function getDefaultEndDate(timeZone: string, days = 1): string {
  const next = new Date()
  next.setDate(next.getDate() + days)
  return formatDateTimeLocalInTimezone(next, timeZone)
}

function getDefaultScheduleDate(timeZone: string): string {
  const next = new Date()
  next.setHours(next.getHours() + 1)
  return formatDateTimeLocalInTimezone(next, timeZone)
}

function createEmptyForm(defaultTimezone: string) {
  return {
  customer_name: '',
  client_name: '',
  customer_email: '',
  customer_phone: '',
  bios_id: '',
  duration_value: '30',
  duration_unit: 'days' as 'minutes' | 'hours' | 'days',
  mode: 'end_date' as 'duration' | 'end_date',
  end_date: getDefaultEndDate(defaultTimezone),
  is_scheduled: false,
  schedule_mode: 'custom' as 'relative' | 'custom',
  schedule_offset_value: '1',
  schedule_offset_unit: 'hours' as 'minutes' | 'hours' | 'days',
  scheduled_date_time: getDefaultScheduleDate(defaultTimezone),
  scheduled_timezone: defaultTimezone,
}
}
const MAX_PRICE = 99_999_999.99
const MAX_DURATION_DAYS = 36_500
const MIN_DURATION_DAYS = 1 / 1440

function computeRelativeScheduleDate(value: number, unit: 'minutes' | 'hours' | 'days'): Date {
  const next = new Date()

  if (unit === 'minutes') {
    next.setMinutes(next.getMinutes() + value)
    return next
  }

  if (unit === 'hours') {
    next.setHours(next.getHours() + value)
    return next
  }

  next.setDate(next.getDate() + value)
  return next
}

export function ActivateLicenseForm({ program, onCancel, onSuccess }: ActivateLicenseFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const { timezone: displayTimezone } = useResolvedTimezone()
  const durationPresets = useMemo(() => getActivationDurationPresets(t), [t])
  const isReseller = user?.role === 'reseller'
  const [form, setForm] = useState(() => createEmptyForm(displayTimezone))
  const previousDisplayTimezoneRef = useRef(displayTimezone)
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto')
  const [priceInput, setPriceInput] = useState('0.00')
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(() => program.duration_presets?.[0]?.id ?? null)
  const [submitError, setSubmitError] = useState('')
  const [biosCheckResult, setBiosCheckResult] = useState<BiosCheckResult | null>(null)
  const [biosCheckLoading, setBiosCheckLoading] = useState(false)
  const debouncedBiosId = useDebounce(form.bios_id, 400)
  const requiredMessage = t('validation.required', { defaultValue: 'Field required' })
  const invalidEmailMessage = t('validation.invalidEmail', { defaultValue: 'Invalid email format' })
  const invalidPhoneMessage = t('validation.invalidPhone', { defaultValue: 'Invalid phone number' })
  const invalidNumberMessage = t('validation.invalidNumber', { defaultValue: 'Invalid number' })
  const maxPriceMessage = t('validation.maxPrice', { defaultValue: 'Price is too high' })

  const effectiveStartDate = useMemo(() => {
    if (!form.is_scheduled) {
      return new Date()
    }

    return zonedDateTimeInputToUtcDate(form.scheduled_date_time, form.scheduled_timezone) ?? new Date()
  }, [form.is_scheduled, form.scheduled_date_time, form.scheduled_timezone])

  const selectedPreset = useMemo(
    () => program.duration_presets?.find((preset) => preset.id === selectedPresetId) ?? program.duration_presets?.[0] ?? null,
    [program.duration_presets, selectedPresetId],
  )

  const durationDays = useMemo(() => {
    if (isReseller) {
      return selectedPreset?.duration_days ?? 0
    }

    if (form.mode === 'end_date') {
      if (!form.end_date) {
        return 0
      }

      const endDate = zonedDateTimeInputToUtcDate(form.end_date, displayTimezone)?.getTime() ?? Number.NaN
      const diffMs = endDate - effectiveStartDate.getTime()
      if (diffMs <= 0) {
        return 0
      }

      return Math.ceil((diffMs / 86400000) * 1000) / 1000
    }

    const value = Number(form.duration_value)
    if (!Number.isFinite(value) || value <= 0) {
      return 0
    }

    if (form.duration_unit === 'minutes') {
      return value / 1440
    }

    if (form.duration_unit === 'hours') {
      return value / 24
    }

    return value
  }, [displayTimezone, effectiveStartDate, form.duration_unit, form.duration_value, form.end_date, form.mode, isReseller, selectedPreset?.duration_days])

  const autoPrice = useMemo(() => {
    if (isReseller) {
      return Number((selectedPreset?.price ?? 0).toFixed(2))
    }

    return Number((Math.max(durationDays, 0) * program.price_per_day).toFixed(2))
  }, [durationDays, isReseller, program.price_per_day, selectedPreset?.price])

  useEffect(() => {
    if (!isReseller) {
      return
    }

    const firstPreset = program.duration_presets?.[0] ?? null
    setSelectedPresetId((current) => {
      if (current && program.duration_presets?.some((preset) => preset.id === current)) {
        return current
      }

      return firstPreset?.id ?? null
    })
  }, [isReseller, program.duration_presets])

  useEffect(() => {
    const previousDisplayTimezone = previousDisplayTimezoneRef.current
    if (previousDisplayTimezone === displayTimezone) {
      return
    }

    setForm((current) => {
      const next = { ...current }

      if (current.scheduled_timezone === previousDisplayTimezone) {
        next.scheduled_timezone = displayTimezone
      }

      if (current.end_date === getDefaultEndDate(previousDisplayTimezone)) {
        next.end_date = getDefaultEndDate(displayTimezone)
      }

      if (!current.is_scheduled && (!current.scheduled_date_time || current.scheduled_date_time === getDefaultScheduleDate(previousDisplayTimezone))) {
        next.scheduled_date_time = getDefaultScheduleDate(displayTimezone)
      }

      return next
    })
    previousDisplayTimezoneRef.current = displayTimezone
  }, [displayTimezone])

  useEffect(() => {
    if (priceMode === 'auto') {
      setPriceInput(autoPrice.toFixed(2))
    }
  }, [autoPrice, priceMode])

  useEffect(() => {
    if (isReseller) {
      setPriceInput(autoPrice.toFixed(2))
    }
  }, [autoPrice, isReseller])

  const totalPrice = useMemo(() => {
    if (priceMode === 'auto') {
      return autoPrice
    }

    const manual = Number(priceInput)
    if (!Number.isFinite(manual) || manual < 0) {
      return 0
    }

    return Number(Math.min(manual, MAX_PRICE).toFixed(2))
  }, [autoPrice, priceInput, priceMode])

  useEffect(() => {
    if (!form.is_scheduled || form.schedule_mode !== 'relative') {
      return
    }

    const value = Number(form.schedule_offset_value)
    if (!Number.isFinite(value) || value <= 0) {
      return
    }

    const scheduledAt = computeRelativeScheduleDate(value, form.schedule_offset_unit)
    setForm((current) => ({
      ...current,
      scheduled_date_time: formatDateTimeLocalInTimezone(scheduledAt, current.scheduled_timezone),
    }))
  }, [form.is_scheduled, form.schedule_mode, form.schedule_offset_unit, form.schedule_offset_value, form.scheduled_timezone])

  // Real-time BIOS availability check
  useEffect(() => {
    if (debouncedBiosId.length < 3) {
      setBiosCheckResult(null)
      return
    }

    const checkBios = async () => {
      setBiosCheckLoading(true)
      try {
        const result = await availabilityService.checkBios(debouncedBiosId)
        setBiosCheckResult(result)
      } catch (error) {
        console.error('BIOS availability check failed:', error)
      } finally {
        setBiosCheckLoading(false)
      }
    }

    checkBios()
  }, [debouncedBiosId])

  const errors = useMemo<ActivationFormErrors>(() => {
    const nextErrors: ActivationFormErrors = {}

    if (form.customer_name.trim().length < 2) {
      nextErrors.customer_name = requiredMessage
    } else if (/\s/.test(form.customer_name)) {
      nextErrors.customer_name = t('activate.usernameNoSpaces', { defaultValue: 'Username cannot contain spaces' })
    }

    const trimmedEmail = form.customer_email.trim()
    if (trimmedEmail !== '' && !/\S+@\S+\.\S+/.test(trimmedEmail)) {
      nextErrors.customer_email = invalidEmailMessage
    }

    const trimmedPhone = form.customer_phone.trim()
    if (trimmedPhone !== '' && !/^\+?\d{6,20}$/.test(trimmedPhone)) {
      nextErrors.customer_phone = invalidPhoneMessage
    }

    if (form.bios_id.trim().length < 3) {
      nextErrors.bios_id = requiredMessage
    } else if (biosCheckResult && !biosCheckResult.available) {
      nextErrors.bios_id = biosCheckResult.message
    }

    if (isReseller && !selectedPreset) {
      nextErrors.duration = requiredMessage
    } else if (form.mode === 'duration' && (durationDays < MIN_DURATION_DAYS || durationDays > MAX_DURATION_DAYS)) {
      nextErrors.duration = invalidNumberMessage
    }

    if (!isReseller && form.mode === 'end_date') {
      if (!form.end_date) {
        nextErrors.end_date = requiredMessage
      } else if (durationDays < MIN_DURATION_DAYS || durationDays > MAX_DURATION_DAYS) {
        nextErrors.end_date = invalidNumberMessage
      }
    }

    if (form.is_scheduled) {
      if (form.schedule_mode === 'relative') {
        const relativeValue = Number(form.schedule_offset_value)
        if (!Number.isFinite(relativeValue) || relativeValue <= 0) {
          nextErrors.scheduled_date_time = invalidNumberMessage
        }
      }

      if (!form.scheduled_date_time) {
        nextErrors.scheduled_date_time = requiredMessage
      } else {
        const scheduledAt = zonedDateTimeInputToUtcDate(form.scheduled_date_time, form.scheduled_timezone)?.getTime() ?? Number.NaN
        if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
          nextErrors.scheduled_date_time = invalidNumberMessage
        }
      }
    }

    if (!isReseller && priceMode === 'manual' && priceInput.trim() === '') {
      nextErrors.price = requiredMessage
    } else if (!Number.isFinite(totalPrice) || totalPrice < 0) {
      nextErrors.price = invalidNumberMessage
    } else if (totalPrice > MAX_PRICE) {
      nextErrors.price = maxPriceMessage
    }

    return nextErrors
  }, [biosCheckResult, durationDays, form.bios_id, form.customer_email, form.customer_name, form.customer_phone, form.end_date, form.is_scheduled, form.mode, form.schedule_mode, form.schedule_offset_value, form.scheduled_date_time, invalidEmailMessage, invalidNumberMessage, invalidPhoneMessage, isReseller, maxPriceMessage, priceInput, priceMode, requiredMessage, selectedPreset, totalPrice])

  const isFormValid = useMemo(() => Object.keys(errors).length === 0, [errors])

  const activationMutation = useMutation({
    mutationFn: () =>
      activateLicense({
        program_id: program.id,
        customer_name: form.customer_name.trim(),
        client_name: form.client_name.trim() || undefined,
        customer_email: form.customer_email.trim() || undefined,
        customer_phone: form.customer_phone.trim() || undefined,
        bios_id: form.bios_id.trim(),
        preset_id: isReseller ? selectedPreset?.id : undefined,
        duration_days: isReseller ? undefined : Number(durationDays.toFixed(3)),
        price: isReseller ? undefined : totalPrice,
        is_scheduled: form.is_scheduled,
        scheduled_date_time: form.is_scheduled ? form.scheduled_date_time : undefined,
        scheduled_timezone: form.is_scheduled ? form.scheduled_timezone : undefined,
      }),
    onSuccess: (data) => {
      setSubmitError('')
      if (form.is_scheduled && form.scheduled_date_time) {
        const scheduledAt = zonedDateTimeInputToUtcDate(form.scheduled_date_time, form.scheduled_timezone)
        const dateTime = scheduledAt
          ? `${formatDate(scheduledAt.toISOString(), locale, form.scheduled_timezone)} (${form.scheduled_timezone})`
          : `${form.scheduled_date_time.replace('T', ' ')} ${form.scheduled_timezone}`
        toast.success(t('activate.scheduledSuccess', { dateTime }))
      } else {
        toast.success(`${t('activate.successTitle')} - ${t('activate.successMessage', { key: data.license_key })}`)
      }
      onSuccess?.()
    },
    onError: (error: unknown) => {
      const rawMessage = resolveApiErrorMessage(error, t('activate.errorTitle'))
      const normalized = rawMessage.toLowerCase()
      let message = rawMessage

      if (normalized.includes('no external api configured') || normalized.includes('not configured for external activation')) {
        message = t('software.noApiWarning')
      } else if (normalized.includes('already exists for this bios')) {
        message = t('activate.biosAlreadyActive')
      } else if (normalized.includes('blacklisted')) {
        message = t('activate.biosBlacklisted')
      }

      setSubmitError(message)
      toast.error(message)
    },
  })

  const isExternalConfigured = program.has_external_api !== false
  const schedulePreview = form.is_scheduled && form.scheduled_date_time
    ? (() => {
        const scheduledAt = zonedDateTimeInputToUtcDate(form.scheduled_date_time, form.scheduled_timezone)
        return scheduledAt
          ? `${formatDate(scheduledAt.toISOString(), locale, form.scheduled_timezone)} (${form.scheduled_timezone})`
          : `${form.scheduled_date_time.replace('T', ' ')} ${form.scheduled_timezone}`
      })()
    : ''

  const startSummary = useMemo(() => {
    if (!form.is_scheduled) {
      return t('activate.startingNow', { defaultValue: 'Starting now' })
    }

    const scheduledAt = zonedDateTimeInputToUtcDate(form.scheduled_date_time, form.scheduled_timezone)
    if (!scheduledAt) {
      return t('activate.startingFromPending', { defaultValue: 'Starting from the selected date' })
    }

    return `${t('activate.startingFrom', { defaultValue: 'Starting from' })}: ${formatDate(scheduledAt.toISOString(), locale, form.scheduled_timezone)} (${form.scheduled_timezone})`
  }, [form.is_scheduled, form.scheduled_date_time, form.scheduled_timezone, locale, t])

  const endSummary = useMemo(() => {
    if (form.mode === 'end_date') {
      const endDate = zonedDateTimeInputToUtcDate(form.end_date, displayTimezone)
      if (!endDate) {
        return t('activate.endingDatePending', { defaultValue: 'Ending date will be calculated after you choose the duration.' })
      }

      return `${t('activate.endingDate', { defaultValue: 'Ending date' })}: ${formatDate(endDate.toISOString(), locale, displayTimezone)}`
    }

    if (durationDays <= 0) {
      return t('activate.endingDatePending', { defaultValue: 'Ending date will be calculated after you choose the duration.' })
    }

    return `${t('activate.endingDate', { defaultValue: 'Ending date' })}: ${formatDate(new Date(effectiveStartDate.getTime() + durationDays * 86400000), locale, displayTimezone)}`
  }, [displayTimezone, durationDays, effectiveStartDate, form.end_date, form.mode, locale, t])

  function handleSubmit() {
    setSubmitError('')

    if (!isExternalConfigured) {
      toast.error(t('software.noApiWarning'))
      return
    }

    if (!isFormValid) {
      toast.error(t('activate.errorTitle'))
      return
    }

    activationMutation.mutate()
  }

  function normalizeDecimalInput(value: string): string {
    const cleaned = value.replace(/[^\d.]/g, '')
    const [integerPart, ...rest] = cleaned.split('.')

    if (rest.length === 0) {
      return integerPart
    }

    return `${integerPart}.${rest.join('')}`
  }

  function clampPriceInput(raw: string): string {
    const normalized = normalizeDecimalInput(raw)
    if (normalized.trim() === '') {
      return ''
    }

    const numeric = Number(normalized)
    if (!Number.isFinite(numeric) || numeric < 0) {
      return ''
    }

    return Math.min(numeric, MAX_PRICE).toFixed(2)
  }

  function normalizePhoneInput(value: string): string {
    const compact = value.replace(/[^\d+]/g, '')
    if (compact.startsWith('+')) {
      return `+${compact.slice(1).replace(/\+/g, '')}`
    }

    return compact.replace(/\+/g, '')
  }

  return (
    <div className="space-y-4">
      {submitError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {submitError}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
        <span className="font-medium text-slate-900 dark:text-slate-100">{program.name}</span>
      </div>

      {!isExternalConfigured ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {t('software.noApiWarning')}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="activate-customer-name">{t('activate.username')}</Label>
        <Input
          id="activate-customer-name"
          value={form.customer_name}
          onChange={(event) => setForm((current) => ({ ...current, customer_name: event.target.value }))}
          onBlur={(event) => setForm((current) => ({ ...current, customer_name: formatUsername(event.target.value) }))}
          placeholder={t('activate.usernamePlaceholder', { defaultValue: 'e.g. john_doe' })}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('activate.usernameHint', { defaultValue: 'API username — auto-formatted (no spaces)' })}</p>
        {errors.customer_name ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.customer_name}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="activate-client-name">{t('activate.clientName')}</Label>
        <Input
          id="activate-client-name"
          value={form.client_name}
          onChange={(event) => setForm((current) => ({ ...current, client_name: event.target.value }))}
          placeholder={t('activate.clientNamePlaceholder', { defaultValue: 'Full client name (optional)' })}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('activate.clientNameHint', { defaultValue: 'Human-readable name for display in your dashboard' })}</p>
        {errors.client_name ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.client_name}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="activate-customer-email">{t('activate.customerEmail')}</Label>
        <Input id="activate-customer-email" type="email" value={form.customer_email} onChange={(event) => setForm((current) => ({ ...current, customer_email: event.target.value }))} />
        {errors.customer_email ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.customer_email}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="activate-customer-phone">{t('common.phone')}</Label>
        <Input
          id="activate-customer-phone"
          type="tel"
          inputMode="numeric"
          value={form.customer_phone}
          onChange={(event) => setForm((current) => ({ ...current, customer_phone: normalizePhoneInput(event.target.value) }))}
        />
        {errors.customer_phone ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.customer_phone}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="activate-bios-id">{t('activate.biosId')}</Label>
        <Input id="activate-bios-id" value={form.bios_id} onChange={(event) => setForm((current) => ({ ...current, bios_id: event.target.value }))} data-testid="bios-id" />
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('activate.biosIdHint')}</p>
        {biosCheckLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <Loader2 className="size-3 animate-spin" />
            <span data-testid="bios-checking">{t('activate.biosChecking', { defaultValue: 'Checking BIOS availability...' })}</span>
          </div>
        )}
        {biosCheckResult && !biosCheckLoading && (
          <div className={`flex items-center gap-2 text-xs ${biosCheckResult.available ? 'text-emerald-600 dark:text-emerald-400' : biosCheckResult.is_blacklisted ? 'text-red-600 dark:text-red-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {biosCheckResult.available ? (
              <>
                <Check className="size-3" />
                <span data-testid="bios-check-available">{t('activate.biosAvailable', { defaultValue: 'BIOS ID is available' })}</span>
              </>
            ) : biosCheckResult.is_blacklisted ? (
              <>
                <X className="size-3" />
                <span data-testid="bios-blacklist-error" className="font-semibold">{t('activate.biosBlacklisted', { defaultValue: 'This BIOS ID is blacklisted and cannot be used' })}</span>
              </>
            ) : (
              <>
                <X className="size-3" />
                <span data-testid="bios-conflict-error">{biosCheckResult.message || t('activate.biosConflict', { defaultValue: 'BIOS ID is already working with another reseller' })}</span>
              </>
            )}
          </div>
        )}
        {errors.bios_id ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.bios_id}</p> : null}
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
            {t('activate.startingLabel', { defaultValue: 'Starting' })}
          </p>
          <p className="mt-1 text-base font-semibold text-emerald-900 dark:text-emerald-100">{startSummary}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={form.is_scheduled}
            onChange={(event) => setForm((current) => {
              if (event.target.checked) {
                return {
                  ...current,
                  is_scheduled: true,
                  schedule_mode: 'custom',
                  schedule_offset_value: current.schedule_offset_value || '1',
                  schedule_offset_unit: current.schedule_offset_unit || 'hours',
                  scheduled_date_time: current.scheduled_date_time || getDefaultScheduleDate(current.scheduled_timezone),
                }
              }

              return { ...current, is_scheduled: false }
            })}
          />
          {t('activate.scheduleToggle')}
        </label>
        {form.is_scheduled ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={form.schedule_mode === 'custom' ? 'default' : 'outline'}
                onClick={() => setForm((current) => ({ ...current, schedule_mode: 'custom' }))}
              >
                {t('activate.scheduleModeCustom', { defaultValue: 'Custom Date' })}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={form.schedule_mode === 'relative' ? 'default' : 'outline'}
                onClick={() => setForm((current) => ({ ...current, schedule_mode: 'relative' }))}
              >
                {t('activate.scheduleModeRelative', { defaultValue: 'After' })}
              </Button>
            </div>
            {form.schedule_mode === 'relative' ? (
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('activate.duration')}</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={form.schedule_offset_value}
                    onChange={(event) => setForm((current) => ({ ...current, schedule_offset_value: normalizeDecimalInput(event.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('common.unit')}</Label>
                  <select
                    value={form.schedule_offset_unit}
                    onChange={(event) => setForm((current) => ({ ...current, schedule_offset_unit: event.target.value as 'minutes' | 'hours' | 'days' }))}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="minutes">{t('activate.minutes')}</option>
                    <option value="hours">{t('activate.hours')}</option>
                    <option value="days">{t('activate.days')}</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t('activate.selectDateTime')}</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduled_date_time}
                  onChange={(event) => setForm((current) => ({ ...current, scheduled_date_time: event.target.value }))}
                />
              </div>
            )}
            {form.schedule_mode === 'relative' ? (
              <div className="space-y-2">
                <Label>{t('activate.selectDateTime')}</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduled_date_time}
                  readOnly
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>{t('activate.selectTimezone')}</Label>
              <select
                value={form.scheduled_timezone}
                onChange={(event) => setForm((current) => ({ ...current, scheduled_timezone: event.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {COMMON_TIMEZONES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            {errors.scheduled_date_time ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.scheduled_date_time}</p> : null}
            {schedulePreview ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('activate.preview', { dateTime: schedulePreview })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
            {t('activate.endingLabel', { defaultValue: 'Ending' })}
          </p>
          <p className="mt-1 text-base font-semibold text-emerald-900 dark:text-emerald-100">{endSummary}</p>
        </div>
        <Label>{t('activate.duration')}</Label>
        {isReseller ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {(program.duration_presets ?? []).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`rounded-2xl border px-4 py-3 text-start transition ${
                    selectedPreset?.id === preset.id
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/30 dark:text-emerald-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
                  }`}
                >
                  <div className="text-sm font-semibold">{preset.label}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t('activate.presetDurationSummary', {
                      defaultValue: '{{days}} days',
                      days: preset.duration_days,
                    })}
                  </div>
                  <div className="mt-2 text-sm font-medium">
                    {t('activate.presetPriceSummary', {
                      defaultValue: '${{price}}',
                      price: preset.price.toFixed(2),
                    })}
                  </div>
                </button>
              ))}
            </div>
            {errors.duration ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.duration}</p> : null}
          </>
        ) : form.mode === 'duration' ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Input
                id="activate-duration"
                type="text"
                inputMode="decimal"
                value={form.duration_value}
                onChange={(event) => setForm((current) => ({ ...current, duration_value: normalizeDecimalInput(event.target.value) }))}
              />
              <select
                value={form.duration_unit}
                onChange={(event) => setForm((current) => ({ ...current, duration_unit: event.target.value as 'minutes' | 'hours' | 'days' }))}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="minutes">{t('activate.minutes')}</option>
                <option value="hours">{t('activate.hours')}</option>
                <option value="days">{t('activate.days')}</option>
              </select>
            </div>
            {errors.duration ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.duration}</p> : null}
            <div className="flex flex-wrap gap-2">
              {durationPresets.map((quick) => (
                <Button
                  key={quick.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((current) => ({ ...current, mode: 'duration', duration_value: quick.value, duration_unit: quick.unit }))}
                >
                  {quick.label}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <>
            <Input type="datetime-local" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} />
            {errors.end_date ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.end_date}</p> : null}
          </>
        )}
      </div>
      {!selectedPreset || !isReseller ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="activate-price">{t('activate.price')}</Label>
            {!isReseller ? (
              <div className="flex gap-2">
                <Button type="button" variant={priceMode === 'auto' ? 'default' : 'outline'} size="sm" onClick={() => setPriceMode('auto')}>
                  {t('activate.priceModeAuto')}
                </Button>
                <Button type="button" variant={priceMode === 'manual' ? 'default' : 'outline'} size="sm" onClick={() => setPriceMode('manual')}>
                  {t('activate.priceModeManual')}
                </Button>
              </div>
            ) : null}
          </div>
          <Input
            id="activate-price"
            inputMode="decimal"
            value={priceInput}
            readOnly={isReseller || priceMode === 'auto'}
            onChange={(event) => setPriceInput(normalizeDecimalInput(event.target.value))}
            onBlur={(event) => {
              if (!isReseller && priceMode === 'manual') {
                setPriceInput(clampPriceInput(event.target.value))
              }
            }}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isReseller
              ? t('activate.pricePresetLocked', { defaultValue: 'Price is controlled by the selected preset.' })
              : priceMode === 'auto'
                ? t('activate.priceAuto')
                : t('activate.priceManualHint')}
          </p>
          {errors.price ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.price}</p> : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={activationMutation.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={activationMutation.isPending || !isExternalConfigured || !isFormValid}>
          {activationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t('activate.submit')}
        </Button>
      </div>
    </div>
  )
}
