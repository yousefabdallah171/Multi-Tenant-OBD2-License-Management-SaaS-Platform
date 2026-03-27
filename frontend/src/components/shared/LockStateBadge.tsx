import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function LockStateBadge({ locked }: { locked: boolean }) {
  const { t } = useTranslation()

  return (
    <span
      className={cn(
        'inline-flex rounded-full px-3 py-1 text-sm font-semibold',
        locked
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
      )}
    >
      {locked ? t('common.locked') : t('common.unlocked')}
    </span>
  )
}
