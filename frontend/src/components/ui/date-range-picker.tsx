import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'

export interface DateRangeValue {
  from: string
  to: string
}

interface DateRangePickerProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  className?: string
  showPresets?: boolean
}

function formatDateInput(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function resolvePresetRange(days: number) {
  const today = new Date()
  const from = new Date(today)

  from.setDate(today.getDate() - (days - 1))

  return {
    from: formatDateInput(from),
    to: formatDateInput(today),
  }
}

export function DateRangePicker({ value, onChange, className, showPresets = true }: DateRangePickerProps) {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const hasValue = Boolean(value.from || value.to)
  const presetLabels = {
    last7: t('dateRange.last7Days', { defaultValue: lang === 'ar' ? 'آخر 7 أيام' : 'Last 7 Days' }),
    last30: t('dateRange.last30Days', { defaultValue: lang === 'ar' ? 'آخر 30 يومًا' : 'Last 30 Days' }),
    last90: t('dateRange.last3Months', { defaultValue: lang === 'ar' ? 'آخر 3 أشهر' : 'Last 3 Months' }),
    last365: t('dateRange.lastYear', { defaultValue: lang === 'ar' ? 'آخر سنة' : 'Last Year' }),
    custom: t('dateRange.custom', { defaultValue: lang === 'ar' ? 'مخصص' : 'Custom' }),
  }

  return (
    <div className={cn('space-y-3', className)}>
      {showPresets ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => onChange(resolvePresetRange(7))}>
            {presetLabels.last7}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => onChange(resolvePresetRange(30))}>
            {presetLabels.last30}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => onChange(resolvePresetRange(90))}>
            {presetLabels.last90}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => onChange(resolvePresetRange(365))}>
            {presetLabels.last365}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(value)}>
            {presetLabels.custom}
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="space-y-2">
          <span className="sr-only">{t('common.from')}</span>
          <Input
            aria-label={t('common.from')}
            type="date"
            value={value.from}
            onChange={(event) => onChange({ ...value, from: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <span className="sr-only">{t('common.to')}</span>
          <Input
            aria-label={t('common.to')}
            type="date"
            value={value.to}
            onChange={(event) => onChange({ ...value, to: event.target.value })}
          />
        </div>
        <Button type="button" variant="secondary" onClick={() => onChange({ from: '', to: '' })} disabled={!hasValue}>
          {t('common.clear')}
        </Button>
      </div>
    </div>
  )
}
