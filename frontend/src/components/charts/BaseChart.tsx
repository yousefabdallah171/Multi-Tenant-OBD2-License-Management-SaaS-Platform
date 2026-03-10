import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hasMeasuredSize, setHasMeasuredSize] = useState(false)

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setHasMeasuredSize(width > 0 && height > 0)
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

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
    <div ref={containerRef} className={cn('min-w-0', heightClassName, className)} style={{ minHeight: 200 }}>
      {hasMeasuredSize ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
          {children}
        </ResponsiveContainer>
      ) : (
        <SkeletonChart className="h-full w-full" />
      )}
    </div>
  )
}
