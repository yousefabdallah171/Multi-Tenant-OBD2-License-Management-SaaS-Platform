import { useTranslation } from 'react-i18next'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface LicenseProgressProps {
  percentage: number
  daysRemaining: number
}

function getProgressTone(percentage: number) {
  if (percentage <= 10) {
    return 'bg-rose-500'
  }

  if (percentage <= 30) {
    return 'bg-amber-500'
  }

  return 'bg-emerald-500'
}

export function LicenseProgress({ percentage, daysRemaining }: LicenseProgressProps) {
  const { t } = useTranslation()
  const safePercentage = Math.min(100, Math.max(0, percentage))
  const expired = daysRemaining <= 0

  return (
    <div className="space-y-2">
      <Progress
        value={expired ? 0 : safePercentage}
        indicatorClassName={cn(getProgressTone(safePercentage), 'transition-[width] duration-300')}
        aria-label={t('customerPortal.dashboard.progressLabel')}
      />
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={cn('font-medium', expired ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400')}>
          {expired ? t('customerPortal.common.expired') : t('customerPortal.dashboard.daysRemaining', { count: daysRemaining })}
        </span>
        <span className="text-slate-500 dark:text-slate-400">{safePercentage}%</span>
      </div>
    </div>
  )
}
