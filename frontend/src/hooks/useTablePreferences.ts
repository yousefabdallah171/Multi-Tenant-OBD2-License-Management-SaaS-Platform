import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { tablePreferenceService } from '@/services/table-preference.service'

interface TablePreferenceColumn {
  key: string
  label: string
  alwaysVisible?: boolean
  defaultHidden?: boolean
}

interface UseTablePreferencesOptions {
  tableKey?: string
  columns: TablePreferenceColumn[]
  perPage?: number
  onPerPageChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
}

function sanitizeVisibleColumns(columns: TablePreferenceColumn[], visibleColumns: string[]) {
  const available = new Set(columns.map((column) => column.key))
  const locked = new Set(columns.filter((column, index) => column.alwaysVisible || index === 0 || column.key === 'actions').map((column) => column.key))
  const filtered = visibleColumns.filter((column) => available.has(column))

  for (const column of locked) {
    if (!filtered.includes(column)) {
      filtered.push(column)
    }
  }

  return filtered.length > 0 ? filtered : columns.map((column) => column.key)
}

function buildDefaultVisibleColumns(columns: TablePreferenceColumn[]) {
  const visible = columns
    .filter((column, index) => column.alwaysVisible || index === 0 || column.key === 'actions' || !column.defaultHidden)
    .map((column) => column.key)

  return visible.length > 0 ? visible : columns.map((column) => column.key)
}

export function useTablePreferences({
  tableKey,
  columns,
  perPage,
  onPerPageChange,
  pageSizeOptions = [10, 25, 50, 100],
}: UseTablePreferencesOptions) {
  const availableColumns = useMemo(() => columns.map((column) => column.key), [columns])
  const lockedColumns = useMemo(
    () => columns.filter((column, index) => column.alwaysVisible || index === 0 || column.key === 'actions').map((column) => column.key),
    [columns],
  )
  const defaultVisibleColumns = useMemo(() => buildDefaultVisibleColumns(columns), [columns])
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultVisibleColumns)
  const [hasHydrated, setHasHydrated] = useState(false)
  const hasHydratedPerPageRef = useRef(false)
  const lastSavedPayloadRef = useRef<string | null>(null)

  const preferenceQuery = useQuery({
    queryKey: ['table-preferences', tableKey, availableColumns.join(','), lockedColumns.join(',')],
    queryFn: () => tablePreferenceService.get(tableKey!, availableColumns, lockedColumns),
    enabled: Boolean(tableKey),
    staleTime: Number.POSITIVE_INFINITY,
  })

  const saveMutation = useMutation({
    mutationFn: (payload: { visible_columns: string[]; per_page: number | null }) => tablePreferenceService.update(tableKey!, {
      visible_columns: payload.visible_columns,
      available_columns: availableColumns,
      locked_columns: lockedColumns,
      per_page: payload.per_page,
    }),
  })

  useEffect(() => {
    if (!tableKey) {
      setVisibleColumns(defaultVisibleColumns)
      setHasHydrated(true)
      return
    }

    if (preferenceQuery.isLoading) {
      return
    }

    const nextVisibleColumns = sanitizeVisibleColumns(columns, preferenceQuery.data?.visible_columns?.length ? preferenceQuery.data.visible_columns : defaultVisibleColumns)
    setVisibleColumns(nextVisibleColumns)
    setHasHydrated(true)

    if (!hasHydratedPerPageRef.current && onPerPageChange && preferenceQuery.data?.per_page && pageSizeOptions.includes(preferenceQuery.data.per_page) && preferenceQuery.data.per_page !== perPage) {
      hasHydratedPerPageRef.current = true
      onPerPageChange(preferenceQuery.data.per_page)
      return
    }

    hasHydratedPerPageRef.current = true
  }, [columns, defaultVisibleColumns, onPerPageChange, pageSizeOptions, perPage, preferenceQuery.data, preferenceQuery.isLoading, tableKey])

  useEffect(() => {
    if (!tableKey || !hasHydrated) {
      return
    }

    if (onPerPageChange && !hasHydratedPerPageRef.current) {
      return
    }

    const sanitizedVisibleColumns = sanitizeVisibleColumns(columns, visibleColumns)
    const payload = JSON.stringify({
      visible_columns: sanitizedVisibleColumns,
      per_page: typeof perPage === 'number' ? perPage : null,
    })

    if (payload === lastSavedPayloadRef.current) {
      return
    }

    lastSavedPayloadRef.current = payload
    saveMutation.mutate({
      visible_columns: sanitizedVisibleColumns,
      per_page: typeof perPage === 'number' ? perPage : null,
    })
  }, [columns, hasHydrated, perPage, saveMutation, tableKey, visibleColumns])

  const visibleColumnSet = useMemo(() => new Set(sanitizeVisibleColumns(columns, visibleColumns)), [columns, visibleColumns])

  const toggleColumn = (columnKey: string) => {
    if (lockedColumns.includes(columnKey)) {
      return
    }

    setVisibleColumns((current) => {
      if (current.includes(columnKey)) {
        return current.filter((item) => item !== columnKey)
      }

      return [...current, columnKey]
    })
  }

  return {
    visibleColumns,
    visibleColumnSet,
    availableColumns,
    lockedColumns,
    toggleColumn,
    isLoading: preferenceQuery.isLoading && !hasHydrated,
  }
}
