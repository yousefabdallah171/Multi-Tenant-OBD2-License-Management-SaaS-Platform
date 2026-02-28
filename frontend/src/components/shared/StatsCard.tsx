import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const accentStyles = {
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300',
} as const

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: number
  color?: keyof typeof accentStyles
}

export function StatsCard({ title, value, icon: Icon, trend, color = 'sky' }: StatsCardProps) {
  const hasTrend = typeof trend === 'number'

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-3xl font-semibold text-slate-950 dark:text-white">{value}</p>
          {hasTrend ? (
            <div className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', trend >= 0 ? accentStyles.emerald : accentStyles.rose)}>
              {trend >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              <span>{Math.abs(trend)}%</span>
            </div>
          ) : null}
        </div>
        <div className={cn('rounded-2xl p-3', accentStyles[color])}>
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  )
}
