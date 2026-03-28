import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const borderAccent = {
  sky: 'border-l-brand-400 dark:border-l-brand-500',
  emerald: 'border-l-emerald-500 dark:border-l-emerald-400',
  amber: 'border-l-amber-500 dark:border-l-amber-400',
  rose: 'border-l-rose-500 dark:border-l-rose-400',
} as const

const trendBadge = {
  positive: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  negative: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
} as const

interface StatsCardProps {
  title: string
  value: string | number
  /** @deprecated icon is no longer rendered — pass nothing */
  icon?: unknown
  trend?: number
  color?: keyof typeof borderAccent
}

export function StatsCard({ title, value, trend, color = 'sky' }: StatsCardProps) {
  const hasTrend = typeof trend === 'number'

  return (
    <Card
      data-testid="stats-card"
      className={cn(
        'h-full border-l-4 hover:shadow-md hover:shadow-slate-950/8',
        borderAccent[color],
      )}
    >
      <CardContent className="space-y-1.5 p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{title}</p>
        <p className="tabular-nums text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">{value}</p>
        {hasTrend ? (
          <div className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold', trend >= 0 ? trendBadge.positive : trendBadge.negative)}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{Math.abs(trend)}%</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
