import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

interface StatusFilterCardProps {
  label: string
  count?: number | string
  description?: string
  isActive?: boolean
  onClick?: () => void
  color?: 'emerald' | 'amber' | 'rose' | 'slate' | 'sky'
}

const colorStyles = {
  emerald: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100/60 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-teal-950/20',
  amber: 'border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-100/60 dark:border-amber-900/50 dark:from-amber-950/40 dark:to-yellow-950/20',
  rose: 'border-rose-200 bg-gradient-to-br from-rose-50 to-orange-100/60 dark:border-rose-900/50 dark:from-rose-950/40 dark:to-orange-950/20',
  slate: 'border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/60 dark:border-slate-800 dark:from-slate-950/40 dark:to-slate-900/20',
  sky: 'border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-100/60 dark:border-sky-900/50 dark:from-sky-950/40 dark:to-cyan-950/20',
} as const

const labelStyles = {
  emerald: 'text-emerald-700 dark:text-emerald-300',
  amber: 'text-amber-700 dark:text-amber-300',
  rose: 'text-rose-700 dark:text-rose-300',
  slate: 'text-slate-700 dark:text-slate-300',
  sky: 'text-sky-700 dark:text-sky-300',
} as const

export function StatusFilterCard({
  label,
  count,
  description,
  isActive = false,
  onClick,
  color = 'sky',
}: StatusFilterCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={description ? `${label}: ${description}` : label}
      className={cn(
        'h-full rounded-3xl border p-[1px] text-start transition-all duration-200 hover:shadow-md',
        colorStyles[color],
        isActive && 'ring-2 ring-offset-2 dark:ring-offset-slate-950',
      )}
    >
      <Card className="h-full cursor-pointer border-0 bg-transparent shadow-none hover:shadow-sm">
        <CardContent className="flex h-full flex-col gap-2 p-4 sm:p-6">
          <p className={cn('text-sm font-medium sm:text-base', labelStyles[color])}>
            {label}
          </p>
          {count !== undefined ? (
            <p className="text-2xl font-semibold text-slate-950 dark:text-white sm:text-3xl">
              {count}
            </p>
          ) : null}
          {description ? (
            <p className="text-sm leading-5 text-slate-600 dark:text-slate-300">
              {description}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </button>
  )
}
