import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface ResponsiveTableProps {
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

export function ResponsiveTable({ children, className, contentClassName }: ResponsiveTableProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [showLeftFade, setShowLeftFade] = useState(false)
  const [showRightFade, setShowRightFade] = useState(false)

  useEffect(() => {
    const element = containerRef.current

    if (!element) {
      return undefined
    }

    const syncShadows = () => {
      const hasOverflow = element.scrollWidth > element.clientWidth + 1
      setShowLeftFade(element.scrollLeft > 1)
      setShowRightFade(hasOverflow && element.scrollLeft + element.clientWidth < element.scrollWidth - 1)
    }

    syncShadows()
    element.addEventListener('scroll', syncShadows, { passive: true })
    window.addEventListener('resize', syncShadows)

    return () => {
      element.removeEventListener('scroll', syncShadows)
      window.removeEventListener('resize', syncShadows)
    }
  }, [])

  return (
    <div data-testid="responsive-table" className={cn('relative overflow-clip', className)}>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-slate-100 via-slate-100/80 to-transparent transition-opacity dark:from-slate-950 dark:via-slate-950/80 lg:hidden',
          showLeftFade ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-slate-100 via-slate-100/80 to-transparent transition-opacity dark:from-slate-950 dark:via-slate-950/80 lg:hidden',
          showRightFade ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div ref={containerRef} className={cn('overflow-x-auto', contentClassName)}>
        {children}
      </div>
    </div>
  )
}
