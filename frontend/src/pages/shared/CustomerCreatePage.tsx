import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { COMMON_TIMEZONES } from '@/lib/timezones'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { activateLicense } from '@/services/activation.service'
import { programService } from '@/services/program.service'
import { settingsService } from '@/services/settings.service'
import { formatUsername } from '@/utils/biosId'

interface CustomerCreatePageProps {
  title: string
  description: string
  backPath: (lang: 'ar' | 'en') => string
  createCustomer: (payload: { name: string; client_name?: string; email?: string; phone?: string }) => Promise<unknown>
}

type DurationUnit = 'minutes' | 'hours' | 'days'
type ScheduleMode = 'after' | 'on'

const MIN_DURATION_DAYS = 1 / 1440

function toDateTimeLocal(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  const hours = String(value.getHours()).padStart(2, '0')
  const minutes = String(value.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
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

export function CustomerCreatePage({ title, description, backPath, createCustomer }: CustomerCreatePageProps) {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const [customerName, setCustomerName] = useState('')
  const [clientName, setClientName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [createLicenseNow, setCreateLicenseNow] = useState(true)
  const [biosId, setBiosId] = useState('')
  const [programId, setProgramId] = useState<number | ''>('')
  const [mode, setMode] = useState<'duration' | 'end_date'>('duration')
  const [durationValue, setDurationValue] = useState('30')
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days')
  const [endDate, setEndDate] = useState('')
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('after')
  const [scheduleAfterValue, setScheduleAfterValue] = useState('1')
  const [scheduleAfterUnit, setScheduleAfterUnit] = useState<DurationUnit>('hours')
  const [scheduleAt, setScheduleAt] = useState('')
  const [scheduleTimezone, setScheduleTimezone] = useState('UTC')
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto')
  const [priceInput, setPriceInput] = useState('0.00')

  const programsQuery = useQuery({
    queryKey: ['customer-create', 'programs'],
    queryFn: () => programService.getAll({ per_page: 100, status: 'active' }),
  })

  const timezoneQuery = useQuery({
    queryKey: ['customer-create', 'timezone'],
    queryFn: () => settingsService.getOnlineWidgetSettings(),
    staleTime: 300000,
  })

  useEffect(() => {
    const serverTimezone = timezoneQuery.data?.data.server_timezone
    if (serverTimezone && scheduleTimezone === 'UTC') {
      setScheduleTimezone(serverTimezone)
    }
  }, [scheduleTimezone, timezoneQuery.data?.data.server_timezone])

  useEffect(() => {
    if (!scheduleEnabled || scheduleMode !== 'after') {
      return
    }

    const value = Number(scheduleAfterValue)
    if (!Number.isFinite(value) || value <= 0) {
      return
    }

    setScheduleAt(toDateTimeLocal(buildRelativeSchedule(value, scheduleAfterUnit)))
  }, [scheduleAfterUnit, scheduleAfterValue, scheduleEnabled, scheduleMode])

  const selectedProgram = (programsQuery.data?.data ?? []).find((program) => program.id === programId)

  const durationDays = useMemo(() => {
    if (!createLicenseNow) {
      return 0
    }

    if (mode === 'end_date') {
      if (!endDate) return 0
      const diff = new Date(endDate).getTime() - Date.now()
      return diff > 0 ? diff / 86400000 : 0
    }

    return durationToDays(Number(durationValue), durationUnit)
  }, [createLicenseNow, durationUnit, durationValue, endDate, mode])

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
    return new Date(Date.now() + durationDays * 86400000).toISOString()
  }, [createLicenseNow, durationDays])

  const errors = useMemo(() => {
    const next: Record<string, string> = {}
    if (customerName.trim().length < 2) next.customerName = t('validation.required', { defaultValue: 'Field required' })
    if (email.trim() && !/\S+@\S+\.\S+/.test(email.trim())) next.email = t('validation.invalidEmail', { defaultValue: 'Invalid email format' })
    if (phone.trim() && !/^\+?\d{6,20}$/.test(phone.trim())) next.phone = t('validation.invalidPhone', { defaultValue: 'Invalid phone number' })

    if (createLicenseNow) {
      if (biosId.trim().length < 3) next.biosId = t('validation.required', { defaultValue: 'Field required' })
      if (!programId) next.programId = t('validation.required', { defaultValue: 'Field required' })
      if (durationDays < MIN_DURATION_DAYS) next.duration = t('validation.invalidNumber', { defaultValue: 'Invalid number' })
      if (scheduleEnabled) {
        const scheduledAt = new Date(scheduleAt).getTime()
        if (!scheduleAt || !Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
          next.scheduleAt = t('validation.invalidNumber', { defaultValue: 'Invalid number' })
        }
      }
    }

    return next
  }, [biosId, createLicenseNow, customerName, durationDays, email, phone, programId, scheduleAt, scheduleEnabled, t])

  const createOnlyMutation = useMutation({
    mutationFn: () => createCustomer({
      name: formatUsername(customerName.trim()),
      client_name: clientName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success(t('common.saved', { defaultValue: 'Saved' }))
      navigate(backPath(lang))
    },
    onError: () => toast.error(t('common.error')),
  })

  const activateMutation = useMutation({
    mutationFn: () => activateLicense({
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
      toast.success(t('activate.successTitle', { defaultValue: 'Activated successfully' }))
      navigate(backPath(lang))
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'response' in error
          ? ((error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data?.message
            ?? Object.values((error as { response?: { data?: { errors?: Record<string, string[]> } } }).response?.data?.errors ?? {})[0]?.[0]
            ?? t('common.error'))
          : t('common.error')
      toast.error(message)
    },
  })

  const isBusy = createOnlyMutation.isPending || activateMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => navigate(backPath(lang))}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('activate.username', { defaultValue: 'Username (API)' })} hint={t('activate.usernameHint', { defaultValue: 'API username — auto-formatted (no spaces)' })} error={errors.customerName}>
              <Input value={customerName} placeholder={t('activate.usernamePlaceholder', { defaultValue: 'e.g. john_doe' })} onChange={(event) => setCustomerName(event.target.value)} onBlur={(event) => setCustomerName(formatUsername(event.target.value))} />
            </Field>
            <Field label={t('activate.clientName', { defaultValue: 'Client Display Name' })} hint={t('activate.clientNameHint', { defaultValue: 'Human-readable name for display in your dashboard' })}>
              <Input value={clientName} placeholder={t('activate.clientNamePlaceholder', { defaultValue: 'Full client name (optional)' })} onChange={(event) => setClientName(event.target.value)} />
            </Field>
            <Field label={t('activate.customerEmail', { defaultValue: 'Customer Email' })} error={errors.email}>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field label={t('common.phone')} error={errors.phone}>
              <Input type="tel" value={phone} onChange={(event) => setPhone(normalizePhoneInput(event.target.value))} placeholder="+966..." />
            </Field>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input type="checkbox" checked={createLicenseNow} onChange={(event) => setCreateLicenseNow(event.target.checked)} />
              {t('activate.submit', { defaultValue: 'Activate License' })}
            </label>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {createLicenseNow
                ? t('activate.reviewDescription', { defaultValue: 'Create the customer and activate the license now.' })
                : t('common.saved', { defaultValue: 'Create customer only without activating a license.' })}
            </p>
          </div>

          {createLicenseNow ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t('activate.biosId')} hint={t('activate.biosIdHint', { defaultValue: 'Hardware BIOS serial number for this machine.' })} error={errors.biosId}>
                  <Input value={biosId} onChange={(event) => setBiosId(event.target.value)} />
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

              <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
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
                        {[['30 min', '30', 'minutes'], ['1 hr', '1', 'hours'], ['6 hr', '6', 'hours'], ['1 day', '1', 'days'], ['7 days', '7', 'days'], ['30 days', '30', 'days'], ['90 days', '90', 'days']].map(([label, value, unit]) => (
                          <Button key={label} type="button" size="sm" variant="outline" onClick={() => { setMode('duration'); setDurationValue(value); setDurationUnit(unit as DurationUnit) }}>{label}</Button>
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
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input type="checkbox" checked={scheduleEnabled} onChange={(event) => setScheduleEnabled(event.target.checked)} />
                  {t('activate.scheduleToggle', { defaultValue: 'Schedule activation for later' })}
                </label>
                {scheduleEnabled ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant={scheduleMode === 'after' ? 'default' : 'outline'} onClick={() => setScheduleMode('after')}>{t('activate.scheduleModeRelative', { defaultValue: 'After' })}</Button>
                      <Button type="button" size="sm" variant={scheduleMode === 'on' ? 'default' : 'outline'} onClick={() => setScheduleMode('on')}>{t('activate.scheduleModeCustom', { defaultValue: 'On date' })}</Button>
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
                  <Summary label={t('activate.expiryPreview', { defaultValue: 'Expiry Preview' })} value={expiryPreview ? formatDate(expiryPreview, lang === 'ar' ? 'ar-EG' : 'en-US') : '-'} />
                  <Summary label={t('activate.price', { defaultValue: 'Price' })} value={formatCurrency(totalPrice, 'USD', lang === 'ar' ? 'ar-EG' : 'en-US')} />
                </div>
              </div>
            </>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate(backPath(lang))} disabled={isBusy}>{t('common.cancel')}</Button>
            <Button
              type="button"
              disabled={Object.keys(errors).length > 0 || isBusy}
              onClick={() => {
                if (createLicenseNow) {
                  activateMutation.mutate()
                  return
                }
                createOnlyMutation.mutate()
              }}
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {createLicenseNow ? t('common.activate', { defaultValue: 'Activate' }) : t('common.save', { defaultValue: 'Save' })}
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
