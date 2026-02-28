import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number
  indicatorClassName?: string
}

export function Progress({ className, value = 0, indicatorClassName, ...props }: ProgressProps) {
  const safeValue = Math.min(100, Math.max(0, value))

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeValue)}
      className={cn('h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800', className)}
      {...props}
    >
      <div
        className={cn('h-full rounded-full bg-sky-500 transition-all', indicatorClassName)}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  )
}
