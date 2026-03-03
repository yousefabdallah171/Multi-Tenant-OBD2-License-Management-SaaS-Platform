import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { COMMON_TIMEZONES } from '@/lib/timezones'
import { activateLicense } from '@/services/activation.service'

export interface ActivationProgram {
  id: number
  name: string
  price_per_day: number
  has_external_api?: boolean
  external_software_id?: number | null
}

interface ActivateLicenseFormProps {
  program: ActivationProgram
  onCancel: () => void
  onSuccess?: () => void
}

interface ActivationFormErrors {
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  bios_id?: string
  duration?: string
  end_date?: string
  price?: string
}

const EMPTY_FORM = {
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  bios_id: '',
  duration_value: '30',
  duration_unit: 'days' as 'minutes' | 'hours' | 'days',
  mode: 'duration' as 'duration' | 'end_date',
  end_date: '',
  is_scheduled: false,
  scheduled_date_time: '',
  scheduled_timezone: 'UTC',
}
const MAX_PRICE = 99_999_999.99
const MAX_DURATION_DAYS = 36_500
const MIN_DURATION_DAYS = 1 / 1440

export function ActivateLicenseForm({ program, onCancel, onSuccess }: ActivateLicenseFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState(EMPTY_FORM)
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto')
  const [priceInput, setPriceInput] = useState('0.00')
  const requiredMessage = t('validation.required', { defaultValue: 'Field required' })
  const invalidEmailMessage = t('validation.invalidEmail', { defaultValue: 'Invalid email format' })
  const invalidPhoneMessage = t('validation.invalidPhone', { defaultValue: 'Invalid phone number' })
  const invalidNumberMessage = t('validation.invalidNumber', { defaultValue: 'Invalid number' })
  const maxPriceMessage = t('validation.maxPrice', { defaultValue: 'Price is too high' })

  const durationDays = useMemo(() => {
    if (form.mode === 'end_date') {
      if (!form.end_date) {
        return 0
      }

      const endDate = new Date(form.end_date).getTime()
      const now = Date.now()
      const diffMs = endDate - now
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
  }, [form.duration_unit, form.duration_value, form.end_date, form.mode])

  const autoPrice = useMemo(() => Number((Math.max(durationDays, 0) * program.price_per_day).toFixed(2)), [durationDays, program.price_per_day])

  useEffect(() => {
    if (priceMode === 'auto') {
      setPriceInput(autoPrice.toFixed(2))
    }
  }, [autoPrice, priceMode])

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

  const errors = useMemo<ActivationFormErrors>(() => {
    const nextErrors: ActivationFormErrors = {}

    if (form.customer_name.trim().length < 2) {
      nextErrors.customer_name = requiredMessage
    }

    const trimmedEmail = form.customer_email.trim()
    if (trimmedEmail !== '' && !/\S+@\S+\.\S+/.test(trimmedEmail)) {
      nextErrors.customer_email = invalidEmailMessage
    }

    const trimmedPhone = form.customer_phone.trim()
    if (trimmedPhone !== '' && !/^\d{6,20}$/.test(trimmedPhone)) {
      nextErrors.customer_phone = invalidPhoneMessage
    }

    if (form.bios_id.trim().length < 3) {
      nextErrors.bios_id = requiredMessage
    }

    if (form.mode === 'duration' && (durationDays < MIN_DURATION_DAYS || durationDays > MAX_DURATION_DAYS)) {
      nextErrors.duration = invalidNumberMessage
    }

    if (form.mode === 'end_date') {
      if (!form.end_date) {
        nextErrors.end_date = requiredMessage
      } else if (durationDays < MIN_DURATION_DAYS || durationDays > MAX_DURATION_DAYS) {
        nextErrors.end_date = invalidNumberMessage
      }
    }

    if (form.is_scheduled) {
      if (!form.scheduled_date_time) {
        nextErrors.end_date = requiredMessage
      } else {
        const scheduledAt = new Date(form.scheduled_date_time).getTime()
        if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
          nextErrors.end_date = invalidNumberMessage
        }
      }
    }

    if (priceMode === 'manual' && priceInput.trim() === '') {
      nextErrors.price = requiredMessage
    } else if (!Number.isFinite(totalPrice) || totalPrice < 0) {
      nextErrors.price = invalidNumberMessage
    } else if (totalPrice > MAX_PRICE) {
      nextErrors.price = maxPriceMessage
    }

    return nextErrors
  }, [durationDays, form.bios_id, form.customer_email, form.customer_name, form.customer_phone, form.end_date, form.mode, invalidEmailMessage, invalidNumberMessage, invalidPhoneMessage, maxPriceMessage, priceInput, priceMode, requiredMessage, totalPrice])

  const isFormValid = useMemo(() => Object.keys(errors).length === 0, [errors])

  const activationMutation = useMutation({
    mutationFn: () =>
      activateLicense({
        program_id: program.id,
        customer_name: form.customer_name.trim(),
        customer_email: form.customer_email.trim() || undefined,
        customer_phone: form.customer_phone.trim() || undefined,
        bios_id: form.bios_id.trim(),
        duration_days: Number(durationDays.toFixed(3)),
        price: totalPrice,
        is_scheduled: form.is_scheduled,
        scheduled_date_time: form.is_scheduled ? form.scheduled_date_time : undefined,
        scheduled_timezone: form.is_scheduled ? form.scheduled_timezone : undefined,
      }),
    onSuccess: (data) => {
      if (form.is_scheduled && form.scheduled_date_time) {
        toast.success(t('activate.scheduledSuccess', { dateTime: new Date(form.scheduled_date_time).toLocaleString() }))
      } else {
        toast.success(`${t('activate.successTitle')} - ${t('activate.successMessage', { key: data.license_key })}`)
      }
      onSuccess?.()
    },
    onError: (error: unknown) => {
      const rawMessage =
        typeof error === 'object' && error !== null && 'response' in error
          ? (Object.values((error as { response?: { data?: { errors?: Record<string, string[]> } } }).response?.data?.errors ?? {})[0]?.[0]
            ?? (error as { response?: { data?: { message?: string } } }).response?.data?.message
            ?? t('activate.errorTitle'))
          : t('activate.errorTitle')

      const normalized = String(rawMessage).toLowerCase()
      let message = rawMessage

      if (normalized.includes('no external api configured') || normalized.includes('not configured for external activation')) {
        message = t('software.noApiWarning')
      } else if (normalized.includes('already exists for this bios')) {
        message = t('activate.biosAlreadyActive')
      } else if (normalized.includes('blacklisted')) {
        message = t('activate.biosBlacklisted')
      }

      toast.error(message)
    },
  })

  const isExternalConfigured = program.has_external_api !== false
  const biosPreview = `${form.customer_name.trim() || 'username'}-${form.bios_id.trim() || 'BIOS ID'}`
  const schedulePreview = form.is_scheduled && form.scheduled_date_time
    ? `${new Date(form.scheduled_date_time).toLocaleString()} ${form.scheduled_timezone}`
    : ''

  function handleSubmit() {
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
    return value.replace(/\D/g, '')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
        <span className="font-medium text-slate-900 dark:text-slate-100">{program.name}</span>
      </div>

      {!isExternalConfigured ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {t('software.noApiWarning')}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="activate-customer-name">{t('activate.customerName')}</Label>
        <Input id="activate-customer-name" value={form.customer_name} onChange={(event) => setForm((current) => ({ ...current, customer_name: event.target.value }))} />
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('activate.customerNameHint')}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('activate.biosConcatenationHint', { value: biosPreview })}</p>
        {errors.customer_name ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.customer_name}</p> : null}
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
        <Input id="activate-bios-id" value={form.bios_id} onChange={(event) => setForm((current) => ({ ...current, bios_id: event.target.value }))} />
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('activate.biosIdHint')}</p>
        {errors.bios_id ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.bios_id}</p> : null}
      </div>
      <div className="space-y-2">
        <Label>{t('activate.duration')}</Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={form.mode === 'duration' ? 'default' : 'outline'} onClick={() => setForm((current) => ({ ...current, mode: 'duration' }))}>
            {t('activate.durationMode')}
          </Button>
          <Button type="button" size="sm" variant={form.mode === 'end_date' ? 'default' : 'outline'} onClick={() => setForm((current) => ({ ...current, mode: 'end_date' }))}>
            {t('activate.endDateMode')}
          </Button>
        </div>
        {form.mode === 'duration' ? (
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
              {[
                { label: '30 min', value: '30', unit: 'minutes' as const },
                { label: '1 hr', value: '1', unit: 'hours' as const },
                { label: '6 hr', value: '6', unit: 'hours' as const },
                { label: '1 day', value: '1', unit: 'days' as const },
                { label: '7 days', value: '7', unit: 'days' as const },
                { label: '30 days', value: '30', unit: 'days' as const },
                { label: '90 days', value: '90', unit: 'days' as const },
              ].map((quick) => (
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
      <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={form.is_scheduled}
            onChange={(event) => setForm((current) => ({ ...current, is_scheduled: event.target.checked }))}
          />
          {t('activate.scheduleToggle')}
        </label>
        {form.is_scheduled ? (
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('activate.selectDateTime')}</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_date_time}
                onChange={(event) => setForm((current) => ({ ...current, scheduled_date_time: event.target.value }))}
              />
            </div>
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
            {schedulePreview ? (
              <p className="md:col-span-2 text-xs text-slate-500 dark:text-slate-400">
                {t('activate.preview', { dateTime: schedulePreview })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="activate-price">{t('activate.price')}</Label>
          <div className="flex gap-2">
            <Button type="button" variant={priceMode === 'auto' ? 'default' : 'outline'} size="sm" onClick={() => setPriceMode('auto')}>
              {t('activate.priceModeAuto')}
            </Button>
            <Button type="button" variant={priceMode === 'manual' ? 'default' : 'outline'} size="sm" onClick={() => setPriceMode('manual')}>
              {t('activate.priceModeManual')}
            </Button>
          </div>
        </div>
        <Input
          id="activate-price"
          inputMode="decimal"
          value={priceInput}
          readOnly={priceMode === 'auto'}
          onChange={(event) => setPriceInput(normalizeDecimalInput(event.target.value))}
          onBlur={(event) => {
            if (priceMode === 'manual') {
              setPriceInput(clampPriceInput(event.target.value))
            }
          }}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">{priceMode === 'auto' ? t('activate.priceAuto') : t('activate.priceManualHint')}</p>
        {errors.price ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.price}</p> : null}
      </div>

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
