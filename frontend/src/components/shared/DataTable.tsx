import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonTable } from '@/components/shared/SkeletonTable'
import { TableScreenOptions } from '@/components/shared/TableScreenOptions'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { cn } from '@/lib/utils'

export interface DataTableColumn<T> {
  key: string
  label: React.ReactNode
  screenLabel?: string
  sortable?: boolean
  className?: string
  alwaysVisible?: boolean
  defaultHidden?: boolean
  render: (row: T) => React.ReactNode
  sortValue?: (row: T) => string | number
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  isLoading?: boolean
  emptyMessage?: string
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  searchTerm?: string
  searchValue?: (row: T) => string
  pagination?: {
    page: number
    lastPage: number
    total: number
    perPage?: number
  }
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
  hidePageSizeSelector?: boolean
  tableKey?: string
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = '',
  rowKey,
  onRowClick,
  searchTerm,
  searchValue,
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  hidePageSizeSelector = false,
  tableKey,
}: DataTableProps<T>) {
  const { t } = useTranslation()
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const { visibleColumnSet, lockedColumns, toggleColumn, isLoading: preferencesLoading } = useTablePreferences({
    tableKey,
    columns: columns.map((column) => ({
      key: column.key,
      label: column.screenLabel ?? (typeof column.label === 'string' ? column.label : column.key),
      alwaysVisible: column.alwaysVisible,
      defaultHidden: column.defaultHidden,
    })),
    perPage: pagination?.perPage,
    onPerPageChange: onPageSizeChange,
    pageSizeOptions,
  })

  const visibleColumns = useMemo(() => columns.filter((column) => visibleColumnSet.has(column.key)), [columns, visibleColumnSet])

  const filteredData = useMemo(() => {
    if (!searchTerm || !searchValue) {
      return data
    }

    const normalizedSearch = searchTerm.trim().toLowerCase()

    if (!normalizedSearch) {
      return data
    }

    return data.filter((row) => String(searchValue(row) ?? '').toLowerCase().includes(normalizedSearch))
  }, [data, searchTerm, searchValue])

  const sortedData = useMemo(() => {
    if (!sortKey) {
      return filteredData
    }

    const column = visibleColumns.find((item) => item.key === sortKey) ?? columns.find((item) => item.key === sortKey)

    if (!column?.sortValue) {
      return filteredData
    }

    return [...filteredData].sort((left, right) => {
      const leftValue = column.sortValue?.(left)
      const rightValue = column.sortValue?.(right)

      if (leftValue === rightValue) {
        return 0
      }

      if (leftValue === undefined || leftValue === null) {
        return 1
      }

      if (rightValue === undefined || rightValue === null) {
        return -1
      }

      const comparison = leftValue > rightValue ? 1 : -1
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [columns, filteredData, sortDirection, sortKey, visibleColumns])

  const toggleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) {
      return
    }

    if (sortKey === column.key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
        return
      }

      setSortKey(null)
      setSortDirection('asc')
      return
    }

    setSortKey(column.key)
    setSortDirection('asc')
  }

  return (
    <Card className="overflow-hidden">
      {tableKey ? (
        <div className="flex justify-end border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <TableScreenOptions
            columns={columns.map((column) => ({
              key: column.key,
              label: column.screenLabel ?? (typeof column.label === 'string' ? column.label : column.key),
              locked: lockedColumns.includes(column.key),
              visible: visibleColumnSet.has(column.key),
            }))}
            pageSize={pagination?.perPage ?? null}
            pageSizeOptions={pageSizeOptions}
            onToggleColumn={toggleColumn}
            onPageSizeChange={onPageSizeChange}
            isLoading={preferencesLoading}
          />
        </div>
      ) : null}
      <div className="max-h-[70vh] overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="sticky top-0 z-20 border-b border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-950/70">
            <tr>
              {visibleColumns.map((column) => {
                const isActive = sortKey === column.key
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={column.sortable && isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={cn('px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400', column.className)}
                  >
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                        column.sortable ? 'cursor-pointer' : 'cursor-default',
                      )}
                      onClick={() => toggleSort(column)}
                    >
                      <span>{column.label}</span>
                      {column.sortable ? (
                        isActive ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5" />
                        )
                      ) : null}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {isLoading ? <SkeletonTable columnCount={visibleColumns.length || columns.length} /> : null}
            {!isLoading && sortedData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length || columns.length} className="px-4 py-6">
                  <EmptyState
                    title={emptyMessage || t('common.noData')}
                    description={t('common.adjustFilters')}
                  />
                </td>
              </tr>
            ) : null}
            {!isLoading
              ? sortedData.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className={cn('transition hover:bg-sky-50/70 dark:hover:bg-sky-950/20', onRowClick ? 'cursor-pointer' : '')}
                    onClick={() => onRowClick?.(row)}
                  >
                    {visibleColumns.map((column) => (
                      <td key={`${rowKey(row)}-${column.key}`} className={cn('px-4 py-4 align-top text-sm text-slate-700 dark:text-slate-200', column.className)}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
      {pagination && onPageChange ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>{t('common.totalCount', { count: pagination.total })}</span>
          <div className="flex flex-wrap items-center gap-3">
            {onPageSizeChange && !hidePageSizeSelector && !tableKey ? (
              <label className="flex items-center gap-2">
                <span>{t('common.rowsPerPage')}</span>
                <select
                  aria-label={t('common.rowsPerPage')}
                  className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  value={pagination.perPage ?? pageSizeOptions[0]}
                  onChange={(event) => onPageSizeChange(Number(event.target.value))}
                >
                  {pageSizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>
                {t('common.previous')}
              </Button>
              <span>
                {pagination.page} / {pagination.lastPage}
              </span>
              <Button type="button" variant="ghost" size="sm" disabled={pagination.page >= pagination.lastPage} onClick={() => onPageChange(pagination.page + 1)}>
                {t('common.next')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
