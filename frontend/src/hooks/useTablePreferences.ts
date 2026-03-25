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
  const schemaKey = useMemo(() => `${tableKey ?? 'default'}|${availableColumns.join(',')}|${lockedColumns.join(',')}`, [availableColumns, lockedColumns, tableKey])
  const defaultVisibleColumns = useMemo(() => buildDefaultVisibleColumns(columns), [columns])
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultVisibleColumns)
  const [hasHydrated, setHasHydrated] = useState(false)
  const hasHydratedPerPageRef = useRef(false)
  const lastSavedPayloadRef = useRef<string | null>(null)
  const isInitialHydrationRef = useRef(true)

  useEffect(() => {
    console.log('[TableScreenOptions] Schema changed - resetting', { tableKey, schemaKey })
    setVisibleColumns(defaultVisibleColumns)
    setHasHydrated(false)
    hasHydratedPerPageRef.current = false
    lastSavedPayloadRef.current = null
  }, [defaultVisibleColumns, schemaKey, tableKey])

  const preferenceQuery = useQuery({
    queryKey: ['table-preferences', tableKey, availableColumns.join(','), lockedColumns.join(',')],
    queryFn: () => tablePreferenceService.get(tableKey!, availableColumns, lockedColumns),
    enabled: Boolean(tableKey),
    staleTime: 30 * 60 * 1000, // 30 minutes - reasonable cache for user preferences
    gcTime: 60 * 60 * 1000,    // 60 minutes in garbage collector
    retry: 1,
  })

  const saveMutation = useMutation({
    mutationFn: (payload: { visible_columns: string[]; per_page: number | null }) =>
      tablePreferenceService.update(tableKey!, {
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

    if (hasHydrated) {
      return
    }

    if (preferenceQuery.isLoading) {
      return
    }

    const nextVisibleColumns = sanitizeVisibleColumns(columns, preferenceQuery.data?.visible_columns?.length ? preferenceQuery.data.visible_columns : defaultVisibleColumns)
    isInitialHydrationRef.current = true
    setVisibleColumns(nextVisibleColumns)
    setHasHydrated(true)

    if (!hasHydratedPerPageRef.current && onPerPageChange && preferenceQuery.data?.per_page && pageSizeOptions.includes(preferenceQuery.data.per_page) && preferenceQuery.data.per_page !== perPage) {
      hasHydratedPerPageRef.current = true
      onPerPageChange(preferenceQuery.data.per_page)
      return
    }

    hasHydratedPerPageRef.current = true
  }, [availableColumns, columns, defaultVisibleColumns, hasHydrated, lockedColumns, onPerPageChange, pageSizeOptions, perPage, preferenceQuery.data, preferenceQuery.isLoading, tableKey])

  useEffect(() => {
    if (!tableKey || !hasHydrated) {
      return
    }

    if (onPerPageChange && !hasHydratedPerPageRef.current) {
      return
    }

    if (isInitialHydrationRef.current) {
      isInitialHydrationRef.current = false
      const sanitizedVisibleColumns = sanitizeVisibleColumns(columns, visibleColumns)
      const initialPayload = JSON.stringify({
        visible_columns: sanitizedVisibleColumns,
        per_page: typeof perPage === 'number' ? perPage : null,
      })
      lastSavedPayloadRef.current = initialPayload
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

    console.log('[TableScreenOptions] Saving column preferences:', sanitizedVisibleColumns)
    lastSavedPayloadRef.current = payload
    saveMutation.mutate({
      visible_columns: sanitizedVisibleColumns,
      per_page: typeof perPage === 'number' ? perPage : null,
    })
  }, [columns, hasHydrated, perPage, saveMutation, tableKey, onPerPageChange])

  const visibleColumnSet = useMemo(() => new Set(sanitizeVisibleColumns(columns, visibleColumns)), [columns, visibleColumns])

  const toggleColumn = (columnKey: string) => {
    console.log('[TableScreenOptions] Clicked column:', columnKey)

    if (lockedColumns.includes(columnKey)) {
      return
    }

    isInitialHydrationRef.current = false

    setVisibleColumns((current) => {
      const isCurrentlyVisible = current.includes(columnKey)
      const newState = isCurrentlyVisible ? current.filter((item) => item !== columnKey) : [...current, columnKey]
      return newState
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
