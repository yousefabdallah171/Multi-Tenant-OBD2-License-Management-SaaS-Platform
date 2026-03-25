import { useEffect, useId, useRef, useState } from 'react'
import { Check, Columns3, Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TableScreenOptionsProps {
  columns: Array<{
    key: string
    label: string
    locked: boolean
    visible: boolean
  }>
  pageSize: number | null
  pageSizeOptions?: number[]
  onToggleColumn: (columnKey: string) => void
  onPageSizeChange?: (pageSize: number) => void
  isLoading?: boolean
}

export function TableScreenOptions({
  columns,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onToggleColumn,
  onPageSizeChange,
  isLoading = false,
}: TableScreenOptionsProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const panelId = useId()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={isOpen}
          aria-controls={panelId}
          className={cn(
            'rounded-xl border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-950/70',
            isLoading && 'opacity-100',
          )}
          onClick={() => setIsOpen((current) => !current)}
        >
          <Settings2 className="me-2 h-4 w-4" />
          {t('common.screenOptions', { defaultValue: 'Screen Options' })}
        </Button>
      {isOpen ? (
        <div
          id={panelId}
          className="absolute end-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('common.columns', { defaultValue: 'Columns' })}
            </p>
            <div className="space-y-1">
              {columns.map((column) => (
                <Button
                  key={column.key}
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={column.locked}
                  className={cn(
                    'h-auto w-full justify-between rounded-xl px-3 py-2 text-start',
                    column.locked && 'opacity-70',
                  )}
                  onClick={() => {
                    if (!column.locked) {
                      onToggleColumn(column.key)
                    }
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Columns3 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{column.label}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {column.locked ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {t('common.locked', { defaultValue: 'Locked' })}
                      </span>
                    ) : null}
                    {column.visible ? <Check className="h-4 w-4 text-sky-600 dark:text-sky-300" /> : null}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {onPageSizeChange ? (
            <>
              <div className="my-3 h-px bg-slate-200 dark:bg-slate-800" />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('common.pagination', { defaultValue: 'Pagination' })}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {pageSizeOptions.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      size="sm"
                      variant={pageSize === option ? 'default' : 'outline'}
                      className="h-9 rounded-lg px-2"
                      onClick={() => onPageSizeChange(option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
