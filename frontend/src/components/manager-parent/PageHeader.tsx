import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, eyebrow = 'Manager Parent', actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.24em] text-sky-600 dark:text-sky-400">{eyebrow}</p>
        <h2 className="text-3xl font-semibold">{title}</h2>
        {description ? <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  )
}
