import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/hooks/useLanguage'
import { useResolvedTimezone } from '@/hooks/useResolvedTimezone'
import { getActivationDurationPresets } from '@/lib/activation-presets'
import { COMMON_TIMEZONES, formatDateTimeLocalInTimezone, zonedDateTimeInputToUtcDate } from '@/lib/timezones'
import { formatDate } from '@/lib/utils'
import type { RenewLicenseData } from '@/types/manager-reseller.types'

type DurationUnit = 'minutes' | 'hours' | 'days'
type ScheduleMode = 'after' | 'on'

interface RenewLicenseFormProps {
  confirmLabel: string
  confirmLoadingLabel: string
  cancelLabel: string
  onSubmit: (payload: RenewLicenseData) => void
  onCancel: () => void
  isPending?: boolean
  anchorDate?: string | null
  initialPrice?: number
  autoPricePerDay?: number
  initialScheduledAt?: string | null
  initialScheduledTimezone?: string | null
  initialExpiresAt?: string | null
  resetKey?: string | number | null
  enabled?: boolean
}

const MIN_DURATION_DAYS = 1 / 1440

function resolveAnchorDate(anchorDate?: string | null) {
  if (!anchorDate) {
    return new Date()
  }

  const parsed = new Date(anchorDate)
  if (!Number.isFinite(parsed.getTime()) || parsed.getTime() < Date.now()) {
    return new Date()
  }

  return parsed
}

function defaultEndDate(timeZone: string, anchorDate?: string | null) {
  const anchor = resolveAnchorDate(anchorDate)
  anchor.setDate(anchor.getDate() + 1)
  return formatDateTimeLocalInTimezone(anchor, timeZone)
}

function defaultScheduleDate(timeZone: string, anchorDate?: string | null) {
  const anchor = resolveAnchorDate(anchorDate)
  if (anchor.getTime() <= Date.now()) {
    anchor.setHours(anchor.getHours() + 1)
  }
  return formatDateTimeLocalInTimezone(anchor, timeZone)
}

function resolveDateTimeLocal(value: string | null | undefined, timeZone: string) {
  if (!value) {
    return ''
  }

  return formatDateTimeLocalInTimezone(value, timeZone)
}

function resolveInitialEndDate(
  timeZone: string,
  anchorDate?: string | null,
  initialExpiresAt?: string | null,
  initialScheduledAt?: string | null,
) {
  if (initialScheduledAt) {
    const scheduledExpiry = resolveDateTimeLocal(initialExpiresAt, timeZone)
    if (scheduledExpiry) {
      return scheduledExpiry
    }
  }

  return defaultEndDate(timeZone, anchorDate)
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

export function RenewLicenseForm({
  confirmLabel,
  confirmLoadingLabel,
  cancelLabel,
  onSubmit,
  onCancel,
  isPending = false,
  anchorDate,
  initialPrice = 0,
  autoPricePerDay = 0,
  initialScheduledAt,
  initialScheduledTimezone,
  initialExpiresAt,
  resetKey,
  enabled = true,
}: RenewLicenseFormProps) {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const { timezone: displayTimezone } = useResolvedTimezone()
  const durationPresets = useMemo(() => getActivationDurationPresets(t), [t])
  const [mode, setMode] = useState<'duration' | 'end_date'>('end_date')
  const [durationValue, setDurationValue] = useState('30')
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days')
  const [endDate, setEndDate] = useState(() => resolveInitialEndDate(displayTimezone, anchorDate, initialExpiresAt, initialScheduledAt))
  const [scheduleEnabled, setScheduleEnabled] = useState(Boolean(initialScheduledAt))
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('on')
  const [scheduleAfterValue, setScheduleAfterValue] = useState('1')
  const [scheduleAfterUnit, setScheduleAfterUnit] = useState<DurationUnit>('hours')
  const [scheduleAt, setScheduleAt] = useState(() => {
    const nextScheduleTimezone = initialScheduledTimezone ?? displayTimezone
    return resolveDateTimeLocal(initialScheduledAt, nextScheduleTimezone) || defaultScheduleDate(nextScheduleTimezone, anchorDate)
  })
  const [scheduleTimezone, setScheduleTimezone] = useState(initialScheduledTimezone ?? displayTimezone)
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>(autoPricePerDay > 0 ? 'auto' : 'manual')
  const [priceInput, setPriceInput] = useState(initialPrice > 0 ? initialPrice.toFixed(2) : '0.00')

  useEffect(() => {
    if (!enabled) {
      return
    }

    setMode('end_date')
    setDurationValue('30')
    setDurationUnit('days')
    const nextScheduleTimezone = initialScheduledTimezone ?? displayTimezone
    setEndDate(resolveInitialEndDate(displayTimezone, anchorDate, initialExpiresAt, initialScheduledAt))
    setScheduleEnabled(Boolean(initialScheduledAt))
    setScheduleMode('on')
    setScheduleAfterValue('1')
    setScheduleAfterUnit('hours')
    setScheduleAt(resolveDateTimeLocal(initialScheduledAt, nextScheduleTimezone) || defaultScheduleDate(nextScheduleTimezone, anchorDate))
    setScheduleTimezone(nextScheduleTimezone)
    setPriceMode(autoPricePerDay > 0 ? 'auto' : 'manual')
    setPriceInput(initialPrice > 0 ? initialPrice.toFixed(2) : '0.00')
  }, [anchorDate, autoPricePerDay, displayTimezone, enabled, initialExpiresAt, initialPrice, initialScheduledAt, initialScheduledTimezone, resetKey])

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

  const effectiveAnchorDate = useMemo(() => {
    if (scheduleEnabled && scheduleAt) {
      return zonedDateTimeInputToUtcDate(scheduleAt, scheduleTimezone) ?? resolveAnchorDate(anchorDate)
    }

    return resolveAnchorDate(anchorDate)
  }, [anchorDate, scheduleAt, scheduleEnabled, scheduleTimezone])

  const durationDays = useMemo(() => {
    if (mode === 'end_date') {
      if (!endDate) return 0
      const endDateUtc = zonedDateTimeInputToUtcDate(endDate, displayTimezone)
      if (!endDateUtc) return 0
      const diff = endDateUtc.getTime() - effectiveAnchorDate.getTime()
      return diff > 0 ? diff / 86400000 : 0
    }

    return durationToDays(Number(durationValue), durationUnit)
  }, [displayTimezone, durationUnit, durationValue, effectiveAnchorDate, endDate, mode])

  const autoPrice = useMemo(() => {
    return Number((Math.max(durationDays, 0) * autoPricePerDay).toFixed(2))
  }, [autoPricePerDay, durationDays])

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

  const errors = useMemo(() => {
    const next: Record<string, string> = {}
    const scheduledStartDate = scheduleEnabled && scheduleAt
      ? zonedDateTimeInputToUtcDate(scheduleAt, scheduleTimezone)
      : null
    const effectiveStartDate = scheduledStartDate ?? effectiveAnchorDate

    if (mode === 'end_date') {
      const endDateUtc = endDate ? zonedDateTimeInputToUtcDate(endDate, displayTimezone) : null
      if (!endDate) {
        next.endDate = t('validation.required', { defaultValue: 'Field required' })
      } else if (!endDateUtc || endDateUtc.getTime() <= effectiveStartDate.getTime()) {
        next.endDate = t('validation.invalidNumber', { defaultValue: 'Invalid number' })
      } else if (durationDays < MIN_DURATION_DAYS) {
        next.endDate = t('validation.invalidNumber', { defaultValue: 'Invalid number' })
      }
    }

    if (mode === 'duration' && durationDays < MIN_DURATION_DAYS) {
      next.duration = t('validation.invalidNumber', { defaultValue: 'Invalid number' })
    }

    if (scheduleEnabled) {
      const scheduledAt = scheduledStartDate?.getTime() ?? Number.NaN
      if (!scheduleAt || !Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
        next.scheduleAt = t('validation.invalidNumber', { defaultValue: 'Invalid number' })
      }
    }

    if (!Number.isFinite(totalPrice) || totalPrice < 0) {
      next.price = t('validation.invalidNumber', { defaultValue: 'Invalid number' })
    }

    return next
  }, [displayTimezone, durationDays, effectiveAnchorDate, endDate, mode, scheduleAt, scheduleEnabled, scheduleTimezone, t, totalPrice])

  const startSummary = useMemo(() => {
    if (!scheduleEnabled) {
      return t('activate.startingNow', { defaultValue: 'Starting now' })
    }

    const scheduledDate = zonedDateTimeInputToUtcDate(scheduleAt, scheduleTimezone)
    if (!scheduledDate) {
      return t('activate.startingFromPending', { defaultValue: 'Starting from the selected date' })
    }

    return `${t('activate.startingFrom', { defaultValue: 'Starting from' })}: ${formatDate(scheduledDate.toISOString(), locale, scheduleTimezone)} (${scheduleTimezone})`
  }, [locale, scheduleAt, scheduleEnabled, scheduleTimezone, t])

  const endSummary = useMemo(() => {
    if (mode === 'end_date') {
      const endDateUtc = zonedDateTimeInputToUtcDate(endDate, displayTimezone)
      if (!endDateUtc) {
        return t('activate.endingDatePending', { defaultValue: 'Ending date will be calculated after you choose the duration.' })
      }

      return `${t('activate.endingDate', { defaultValue: 'Ending date' })}: ${formatDate(endDateUtc.toISOString(), locale, displayTimezone)}`
    }

    if (durationDays <= 0) {
      return t('activate.endingDatePending', { defaultValue: 'Ending date will be calculated after you choose the duration.' })
    }

    return `${t('activate.endingDate', { defaultValue: 'Ending date' })}: ${formatDate(new Date(effectiveAnchorDate.getTime() + durationDays * 86400000), locale, displayTimezone)}`
  }, [displayTimezone, durationDays, effectiveAnchorDate, endDate, locale, mode, t])

  return (
    <div className="space-y-4">
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
                setScheduleAt((current) => current || defaultScheduleDate(scheduleTimezone, anchorDate))
              }
            }}
          />
          {t('activate.scheduleToggle', { defaultValue: 'Schedule activation for later' })}
        </label>
        {scheduleEnabled ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={scheduleMode === 'on' ? 'default' : 'outline'} onClick={() => setScheduleMode('on')}>
                {t('activate.scheduleModeCustom', { defaultValue: 'Custom Date' })}
              </Button>
              <Button type="button" size="sm" variant={scheduleMode === 'after' ? 'default' : 'outline'} onClick={() => setScheduleMode('after')}>
                {t('activate.scheduleModeRelative', { defaultValue: 'After' })}
              </Button>
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
              {COMMON_TIMEZONES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
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
          <Button type="button" size="sm" variant={mode === 'duration' ? 'default' : 'outline'} onClick={() => setMode('duration')}>
            {t('activate.durationMode', { defaultValue: 'Duration' })}
          </Button>
          <Button type="button" size="sm" variant={mode === 'end_date' ? 'default' : 'outline'} onClick={() => setMode('end_date')}>
            {t('common.endDate', { defaultValue: 'End Date' })}
          </Button>
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
                  <Button key={preset.label} type="button" size="sm" variant="outline" onClick={() => { setMode('duration'); setDurationValue(preset.value); setDurationUnit(preset.unit) }}>
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            {errors.duration ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.duration}</p> : null}
          </>
        ) : (
          <Field label={t('activate.endDateTime', { defaultValue: 'End Date & Time' })} error={errors.endDate}>
            <Input type="datetime-local" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </Field>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="flex items-center justify-between gap-3">
          <Label>{t('activate.price', { defaultValue: 'Total Price' })}</Label>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={priceMode === 'auto' ? 'default' : 'outline'} onClick={() => setPriceMode('auto')}>
              {t('activate.priceModeAuto', { defaultValue: 'Auto' })}
            </Button>
            <Button type="button" size="sm" variant={priceMode === 'manual' ? 'default' : 'outline'} onClick={() => setPriceMode('manual')}>
              {t('activate.priceModeManual', { defaultValue: 'Manual' })}
            </Button>
          </div>
        </div>
        <Input value={priceInput} readOnly={priceMode === 'auto'} onChange={(event) => setPriceInput(event.target.value.replace(/[^\d.]/g, ''))} />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {priceMode === 'auto'
            ? t('activate.priceAuto', { defaultValue: 'Auto-calculated' })
            : t('activate.priceManualHint', { defaultValue: 'Enter custom price' })}
        </p>
        {errors.price ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.price}</p> : null}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          disabled={Object.keys(errors).length > 0 || isPending}
          onClick={() => onSubmit({
            duration_days: Number(durationDays.toFixed(6)),
            price: totalPrice,
            is_scheduled: scheduleEnabled || undefined,
            scheduled_date_time: scheduleEnabled ? scheduleAt : undefined,
            scheduled_timezone: scheduleEnabled ? scheduleTimezone : undefined,
          })}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isPending ? confirmLoadingLabel : confirmLabel}
        </Button>
      </div>
    </div>
  )
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  )
}
