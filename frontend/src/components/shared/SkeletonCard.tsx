import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SkeletonCardProps {
  className?: string
  lines?: number
  showAccent?: boolean
}

export function SkeletonCard({ className, lines = 3, showAccent = false }: SkeletonCardProps) {
  return (
    <Card data-testid="skeleton-card" className={cn('overflow-hidden border-dashed border-l-4 border-l-slate-200 shadow-none dark:border-l-slate-800', className)} aria-hidden="true">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-8 w-1/2 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
          {showAccent ? <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /> : null}
        </div>
        <div className="space-y-3">
          {Array.from({ length: lines }).map((_, index) => (
            <div
              key={index}
              className={cn(
                'h-4 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800',
                index === lines - 1 ? 'w-2/3' : 'w-full',
              )}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
