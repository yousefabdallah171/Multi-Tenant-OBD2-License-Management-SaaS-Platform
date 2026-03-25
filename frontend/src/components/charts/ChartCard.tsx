import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ChartCardProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
  contentClassName?: string
  children: ReactNode
}

export function ChartCard({ title, description, actions, className, contentClassName, children }: ChartCardProps) {
  return (
    <Card className={cn('min-w-0 overflow-hidden hover:shadow-2xl hover:shadow-slate-950/10', className)}>
      <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </CardHeader>
      <CardContent className={cn('min-w-0 pt-0', contentClassName)}>{children}</CardContent>
    </Card>
  )
}
