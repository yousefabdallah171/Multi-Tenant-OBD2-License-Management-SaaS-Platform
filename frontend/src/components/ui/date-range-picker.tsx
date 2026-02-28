import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface DateRangeValue {
  from: string
  to: string
}

interface DateRangePickerProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  className?: string
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const { t } = useTranslation()
  const hasValue = Boolean(value.from || value.to)

  return (
    <div className={cn('grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]', className)}>
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
  )
}
