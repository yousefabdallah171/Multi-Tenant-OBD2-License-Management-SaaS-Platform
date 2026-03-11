import type { ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonChart } from '@/components/shared/SkeletonChart'
import { cn } from '@/lib/utils'

interface BaseChartProps {
  data: unknown[]
  isLoading?: boolean
  heightClassName?: string
  emptyTitle?: string
  emptyDescription?: string
  className?: string
  children: ReactNode
}

export function BaseChart({
  data,
  isLoading = false,
  heightClassName = 'h-[200px] sm:h-72 xl:h-80',
  emptyTitle,
  emptyDescription,
  className,
  children,
}: BaseChartProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return <SkeletonChart className={cn(heightClassName, className)} />
  }

  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 dark:border-slate-800 dark:bg-slate-950/40', heightClassName, className)}>
        <EmptyState title={emptyTitle ?? t('common.noData')} description={emptyDescription ?? t('superAdmin.pages.dashboard.noActivity')} />
      </div>
    )
  }

  return (
    <div className={cn('min-w-0', heightClassName, className)} style={{ minHeight: 200 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}
