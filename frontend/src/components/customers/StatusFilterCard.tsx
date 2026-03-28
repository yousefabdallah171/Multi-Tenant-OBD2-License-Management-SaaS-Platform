import { cn } from '@/lib/utils'

interface StatusFilterCardProps {
  label: string
  count?: number | string
  description?: string
  isActive?: boolean
  onClick?: () => void
  color?: 'emerald' | 'amber' | 'rose' | 'slate' | 'sky'
}

const config = {
  emerald: {
    bg: 'bg-emerald-50/50 dark:bg-emerald-950/10',
    bgActive: 'bg-emerald-50 dark:bg-emerald-950/25',
    border: 'border-emerald-100 dark:border-emerald-900/20',
    borderActive: 'border-emerald-200 dark:border-emerald-800/50',
    label: 'text-emerald-700 dark:text-emerald-400',
    labelInactive: 'text-emerald-700/70 dark:text-emerald-400/70',
    count: 'text-emerald-950 dark:text-white',
    countInactive: 'text-emerald-900 dark:text-emerald-200',
    icon: 'bg-emerald-500/15 dark:bg-emerald-500/10',
    iconDot: 'bg-emerald-500 dark:bg-emerald-400',
    ring: 'ring-emerald-500/10 dark:ring-emerald-500/5',
    hover: 'hover:bg-emerald-50 hover:border-emerald-200/80 dark:hover:bg-emerald-950/20 dark:hover:border-emerald-800/40',
  },
  amber: {
    bg: 'bg-amber-50/50 dark:bg-amber-950/10',
    bgActive: 'bg-amber-50 dark:bg-amber-950/25',
    border: 'border-amber-100 dark:border-amber-900/20',
    borderActive: 'border-amber-200 dark:border-amber-800/50',
    label: 'text-amber-700 dark:text-amber-400',
    labelInactive: 'text-amber-700/70 dark:text-amber-400/70',
    count: 'text-amber-950 dark:text-white',
    countInactive: 'text-amber-900 dark:text-amber-200',
    icon: 'bg-amber-500/15 dark:bg-amber-500/10',
    iconDot: 'bg-amber-500 dark:bg-amber-400',
    ring: 'ring-amber-500/10 dark:ring-amber-500/5',
    hover: 'hover:bg-amber-50 hover:border-amber-200/80 dark:hover:bg-amber-950/20 dark:hover:border-amber-800/40',
  },
  rose: {
    bg: 'bg-rose-50/50 dark:bg-rose-950/10',
    bgActive: 'bg-rose-50 dark:bg-rose-950/25',
    border: 'border-rose-100 dark:border-rose-900/20',
    borderActive: 'border-rose-200 dark:border-rose-800/50',
    label: 'text-rose-700 dark:text-rose-400',
    labelInactive: 'text-rose-700/70 dark:text-rose-400/70',
    count: 'text-rose-950 dark:text-white',
    countInactive: 'text-rose-900 dark:text-rose-200',
    icon: 'bg-rose-500/15 dark:bg-rose-500/10',
    iconDot: 'bg-rose-500 dark:bg-rose-400',
    ring: 'ring-rose-500/10 dark:ring-rose-500/5',
    hover: 'hover:bg-rose-50 hover:border-rose-200/80 dark:hover:bg-rose-950/20 dark:hover:border-rose-800/40',
  },
  slate: {
    bg: 'bg-slate-100/40 dark:bg-slate-800/10',
    bgActive: 'bg-slate-100/80 dark:bg-slate-800/25',
    border: 'border-slate-200/50 dark:border-slate-700/20',
    borderActive: 'border-slate-300/80 dark:border-slate-700/50',
    label: 'text-slate-600 dark:text-slate-400',
    labelInactive: 'text-slate-500 dark:text-slate-400',
    count: 'text-slate-900 dark:text-white',
    countInactive: 'text-slate-700 dark:text-slate-300',
    icon: 'bg-slate-400/15 dark:bg-slate-400/10',
    iconDot: 'bg-slate-400 dark:bg-slate-500',
    ring: 'ring-slate-400/10 dark:ring-slate-400/5',
    hover: 'hover:bg-slate-100/70 hover:border-slate-300/60 dark:hover:bg-slate-800/20 dark:hover:border-slate-700/40',
  },
  sky: {
    bg: 'bg-brand-50/40 dark:bg-brand-950/10',
    bgActive: 'bg-brand-50 dark:bg-brand-950/25',
    border: 'border-brand-100 dark:border-brand-900/20',
    borderActive: 'border-brand-200 dark:border-brand-800/50',
    label: 'text-brand-700 dark:text-brand-400',
    labelInactive: 'text-brand-700/70 dark:text-brand-400/70',
    count: 'text-brand-950 dark:text-white',
    countInactive: 'text-brand-900 dark:text-brand-200',
    icon: 'bg-brand-500/15 dark:bg-brand-500/10',
    iconDot: 'bg-brand-500 dark:bg-brand-400',
    ring: 'ring-brand-500/10 dark:ring-brand-500/5',
    hover: 'hover:bg-brand-50 hover:border-brand-200/80 dark:hover:bg-brand-950/20 dark:hover:border-brand-800/40',
  },
} as const

export function StatusFilterCard({
  label,
  count,
  isActive = false,
  onClick,
  color = 'sky',
}: StatusFilterCardProps) {
  const c = config[color]
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        'group relative rounded-xl border px-3.5 py-3.5 text-start transition-all duration-200',
        isActive ? c.bgActive : c.bg,
        isActive ? c.borderActive : c.border,
        isActive
          ? cn('shadow-sm ring-1 ring-inset', c.ring)
          : c.hover,
      )}
    >
      {/* Status dot pill */}
      <div className="mb-3 flex items-center gap-1.5">
        <span className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded-md',
          c.icon,
        )}>
          <span className={cn('h-1.5 w-1.5 rounded-full', c.iconDot)} />
        </span>
        <p className={cn(
          'text-[10.5px] font-semibold uppercase tracking-widest leading-none truncate',
          isActive ? c.label : c.labelInactive,
        )}>
          {label}
        </p>
      </div>

      {/* Count */}
      {count !== undefined ? (
        <p className={cn(
          'text-[26px] font-bold tabular-nums leading-none tracking-tight',
          isActive ? c.count : c.countInactive,
        )}>
          {count}
        </p>
      ) : null}

      {/* Active indicator bar at bottom */}
      {isActive ? (
        <span className={cn(
          'absolute bottom-0 start-3 end-3 h-[2px] rounded-full',
          c.iconDot,
        )} />
      ) : null}
    </button>
  )
}
