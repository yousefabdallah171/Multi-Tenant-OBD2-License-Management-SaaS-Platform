import { cn } from '@/lib/utils'

interface SkeletonChartProps {
  className?: string
}

export function SkeletonChart({ className }: SkeletonChartProps) {
  return (
    <div
      data-testid="skeleton-chart"
      className={cn(
        'relative h-80 overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40',
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-x-6 top-6 h-5 w-40 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
      <div className="absolute inset-x-6 bottom-6 top-16 rounded-2xl bg-gradient-to-t from-slate-200/90 via-slate-200/40 to-transparent dark:from-slate-800/90 dark:via-slate-800/40 dark:to-transparent" />
    </div>
  )
}
