import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: LucideIcon
}

export function EmptyState({ title, description, actionLabel, onAction, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="rounded-full bg-sky-100 p-4 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
          <Icon className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
          {description ? <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
        {actionLabel && onAction ? (
          <Button type="button" variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
