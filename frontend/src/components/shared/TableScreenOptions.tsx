import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Columns3, Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TableScreenOptionsProps {
  tableKey?: string
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
  tableKey,
  columns,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onToggleColumn,
  onPageSizeChange,
  isLoading = false,
}: TableScreenOptionsProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLSpanElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const panelId = useId()

  const recalcPosition = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const isRtl = document.documentElement.dir === 'rtl'
    setPanelStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      ...(isRtl ? { left: rect.left } : { right: window.innerWidth - rect.right }),
    })
  }

  const handleToggle = () => {
    if (!isOpen) recalcPosition()
    setIsOpen((prev) => !prev)
  }

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    const handleScroll = () => {
      if (isOpen) recalcPosition()
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [isOpen])

  const panel = isOpen
    ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={t('common.screenOptions', { defaultValue: 'Screen Options' })}
          style={panelStyle}
          className="z-[9999] w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 md:text-base">
              {t('common.columns', { defaultValue: 'Columns' })}
            </p>
            <div className="space-y-1">
              {columns.map((column) => (
                <button
                  key={column.key}
                  type="button"
                  disabled={column.locked}
                  aria-pressed={column.visible}
                  aria-label={column.label}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900/60 md:text-base',
                    column.locked && 'cursor-not-allowed opacity-70',
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
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
                    <input
                      type="checkbox"
                      checked={column.visible}
                      readOnly
                      disabled={column.locked}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="pointer-events-none h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-950"
                    />
                    {column.locked ? (
                      <span className="text-sm font-semibold uppercase tracking-wide text-slate-400 md:text-base">
                        {t('common.locked', { defaultValue: 'Locked' })}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {onPageSizeChange ? (
            <>
              <div className="my-3 h-px bg-slate-200 dark:bg-slate-800" />
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 md:text-base">
                  {t('common.pagination', { defaultValue: 'Pagination' })}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {pageSizeOptions.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      size="sm"
                      variant={pageSize === option ? 'default' : 'outline'}
                      className="h-10 rounded-lg px-3 text-sm md:h-11 md:px-4 md:text-base"
                      onClick={(e) => {
                        e.stopPropagation()
                        console.debug('[TableScreenOptions] page size click', {
                          tableKey: tableKey ?? 'no-table-key',
                          selectedPageSize: option,
                          currentPageSize: pageSize,
                        })
                        onPageSizeChange(option)
                        setIsOpen(false)
                      }}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>,
        document.body,
      )
    : null

  return (
    <span ref={triggerRef} className="relative inline-block">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-haspopup="dialog"
        className={cn(
          'rounded-xl border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-950/70 md:text-base',
          isLoading && 'opacity-100',
        )}
        onClick={handleToggle}
      >
        <Settings2 className="me-2 h-4 w-4" />
        {t('common.screenOptions', { defaultValue: 'Screen Options' })}
      </Button>
      {panel}
    </span>
  )
}
