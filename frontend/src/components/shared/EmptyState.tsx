import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  /** @deprecated icon prop is ignored — pass nothing */
  icon?: unknown
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</p>
      {description ? (
        <p className="max-w-xs text-sm text-slate-400 dark:text-slate-500">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <Button type="button" variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
