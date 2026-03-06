import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { RenewLicenseData } from '@/types/manager-reseller.types'

type DurationUnit = 'minutes' | 'hours' | 'days'
type ScheduleMode = 'after' | 'on'

interface RenewLicenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  confirmLoadingLabel: string
  cancelLabel: string
  onSubmit: (payload: RenewLicenseData) => void
  isPending?: boolean
  anchorDate?: string | null
  initialPrice?: number
  autoPricePerDay?: number
  resetKey?: string | number | null
}

const MIN_DURATION_DAYS = 1 / 1440

function toDateTimeLocal(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  const hours = String(value.getHours()).padStart(2, '0')
  const minutes = String(value.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

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

function defaultEndDate(anchorDate?: string | null) {
  const anchor = resolveAnchorDate(anchorDate)
  anchor.setDate(anchor.getDate() + 30)
  return toDateTimeLocal(anchor)
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

export function RenewLicenseDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmLoadingLabel,
  cancelLabel,
  onSubmit,
  isPending = false,
  anchorDate,
  initialPrice = 0,
  autoPricePerDay = 0,
  resetKey,
}: RenewLicenseDialogProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'duration' | 'end_date'>('end_date')
  const [durationValue, setDurationValue] = useState('30')
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days')
  const [endDate, setEndDate] = useState(() => defaultEndDate(anchorDate))
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('after')
  const [scheduleAfterValue, setScheduleAfterValue] = useState('1')
  const [scheduleAfterUnit, setScheduleAfterUnit] = useState<DurationUnit>('hours')
  const [scheduleAt, setScheduleAt] = useState('')
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>(autoPricePerDay > 0 ? 'auto' : 'manual')
  const [priceInput, setPriceInput] = useState(initialPrice > 0 ? initialPrice.toFixed(2) : '0.00')

  useEffect(() => {
    if (!open) {
      return
    }

    setMode('end_date')
    setDurationValue('30')
    setDurationUnit('days')
    setEndDate(defaultEndDate(anchorDate))
    setScheduleEnabled(false)
    setScheduleMode('after')
    setScheduleAfterValue('1')
    setScheduleAfterUnit('hours')
    setScheduleAt('')
    setPriceMode(autoPricePerDay > 0 ? 'auto' : 'manual')
    setPriceInput(initialPrice > 0 ? initialPrice.toFixed(2) : '0.00')
  }, [anchorDate, autoPricePerDay, initialPrice, open, resetKey])

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

  const effectiveAnchorDate = useMemo(() => {
    if (scheduleEnabled && scheduleAt) {
      return new Date(scheduleAt)
    }

    return resolveAnchorDate(anchorDate)
  }, [anchorDate, scheduleAt, scheduleEnabled])

  const durationDays = useMemo(() => {
    if (mode === 'end_date') {
      if (!endDate) return 0
      const diff = new Date(endDate).getTime() - effectiveAnchorDate.getTime()
      return diff > 0 ? diff / 86400000 : 0
    }

    return durationToDays(Number(durationValue), durationUnit)
  }, [durationUnit, durationValue, effectiveAnchorDate, endDate, mode])

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

    if (mode === 'end_date') {
      if (!endDate) next.endDate = t('validation.required', { defaultValue: 'Field required' })
      if (durationDays < MIN_DURATION_DAYS) next.endDate = t('validation.invalidNumber', { defaultValue: 'Invalid number' })
    }

    if (mode === 'duration' && durationDays < MIN_DURATION_DAYS) {
      next.duration = t('validation.invalidNumber', { defaultValue: 'Invalid number' })
    }

    if (scheduleEnabled) {
      const scheduledAt = new Date(scheduleAt).getTime()
      if (!scheduleAt || !Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
        next.scheduleAt = t('validation.invalidNumber', { defaultValue: 'Invalid number' })
      }
    }

    if (!Number.isFinite(totalPrice) || totalPrice < 0) {
      next.price = t('validation.invalidNumber', { defaultValue: 'Invalid number' })
    }

    return next
  }, [durationDays, endDate, mode, priceMode, scheduleAt, scheduleEnabled, t, totalPrice])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
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
                    {[['30 min', '30', 'minutes'], ['1 hr', '1', 'hours'], ['6 hr', '6', 'hours'], ['1 day', '1', 'days'], ['7 days', '7', 'days'], ['30 days', '30', 'days'], ['90 days', '90', 'days']].map(([label, value, unit]) => (
                      <Button key={label} type="button" size="sm" variant="outline" onClick={() => { setMode('duration'); setDurationValue(value); setDurationUnit(unit as DurationUnit) }}>
                        {label}
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
            <label className="flex items-center gap-3 text-sm font-medium">
              <input type="checkbox" checked={scheduleEnabled} onChange={(event) => setScheduleEnabled(event.target.checked)} />
              {t('activate.scheduleToggle', { defaultValue: 'Schedule activation for later' })}
            </label>
            {scheduleEnabled ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={scheduleMode === 'after' ? 'default' : 'outline'} onClick={() => setScheduleMode('after')}>
                    {t('activate.scheduleModeRelative', { defaultValue: 'After' })}
                  </Button>
                  <Button type="button" size="sm" variant={scheduleMode === 'on' ? 'default' : 'outline'} onClick={() => setScheduleMode('on')}>
                    {t('activate.scheduleModeCustom', { defaultValue: 'On date' })}
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
                {errors.scheduleAt ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.scheduleAt}</p> : null}
              </div>
            ) : null}
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
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
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
            })}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPending ? confirmLoadingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
