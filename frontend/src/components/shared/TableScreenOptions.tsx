import { Check, Columns3, Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
  disabled?: boolean
}

export function TableScreenOptions({
  columns,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onToggleColumn,
  onPageSizeChange,
  disabled = false,
}: TableScreenOptionsProps) {
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button type="button" variant="outline" size="sm" className="rounded-xl">
          <Settings2 className="me-2 h-4 w-4" />
          {t('common.screenOptions', { defaultValue: 'Screen Options' })}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('common.columns', { defaultValue: 'Columns' })}
          </p>
        </div>
        {columns.map((column) => (
          <DropdownMenuItem
            key={column.key}
            disabled={column.locked}
            onSelect={(event) => {
              event.preventDefault()
              if (!column.locked) {
                onToggleColumn(column.key)
              }
            }}
            className={cn('justify-between gap-3', column.locked && 'opacity-70')}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Columns3 className="h-3.5 w-3.5 text-slate-400" />
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
          </DropdownMenuItem>
        ))}

        {onPageSizeChange ? (
          <>
            <DropdownMenuSeparator className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
            <div className="px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('common.pagination', { defaultValue: 'Pagination' })}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 px-3 pb-3">
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
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
