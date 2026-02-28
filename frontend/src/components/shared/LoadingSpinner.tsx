import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  fullPage?: boolean
  label?: string
  className?: string
}

export function LoadingSpinner({ fullPage = false, label, className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(fullPage ? 'flex min-h-[50vh] flex-col items-center justify-center gap-3' : 'inline-flex items-center gap-2', className)}
      role="status"
      aria-live="polite"
    >
      <LoaderCircle className="h-5 w-5 animate-spin text-sky-500" />
      {label ? <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span> : null}
      <span className="sr-only">{label ?? 'Loading'}</span>
    </div>
  )
}
