import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { resolveApiErrorMessage } from '@/lib/api-errors'
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

interface CachedTablePreference {
  visible_columns?: string[]
  per_page?: number | null
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

function readCachedPreference(tableKey?: string): CachedTablePreference | null {
  if (!tableKey || typeof window === 'undefined') {
    return null
  }

  try {
    const cached = window.localStorage.getItem(`table-prefs-${tableKey}`)
    return cached ? (JSON.parse(cached) as CachedTablePreference) : null
  } catch {
    return null
  }
}

function writeCachedPreference(tableKey: string, payload: CachedTablePreference) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(`table-prefs-${tableKey}`, JSON.stringify(payload))
  } catch {
    // Ignore localStorage errors
  }
}

function sanitizePerPage(perPage: number | null | undefined, pageSizeOptions: number[]) {
  return typeof perPage === 'number' && pageSizeOptions.includes(perPage) ? perPage : null
}

export function useTablePreferences({
  tableKey,
  columns,
  perPage,
  onPerPageChange,
  pageSizeOptions = [10, 25, 50, 100],
}: UseTablePreferencesOptions) {
  const queryClient = useQueryClient()
  const columnSchemaKey = useMemo(
    () =>
      columns
        .map((column, index) => `${index}:${column.key}:${column.alwaysVisible ? '1' : '0'}:${column.defaultHidden ? '1' : '0'}`)
        .join('|'),
    [columns],
  )
  const availableColumns = useMemo(() => columns.map((column) => column.key), [columns])
  const lockedColumns = useMemo(
    () => columns.filter((column, index) => column.alwaysVisible || index === 0 || column.key === 'actions').map((column) => column.key),
    [columns],
  )
  const schemaKey = useMemo(() => `${tableKey ?? 'default'}|${availableColumns.join(',')}|${lockedColumns.join(',')}`, [availableColumns, lockedColumns, tableKey])
  const defaultVisibleColumns = useMemo(() => buildDefaultVisibleColumns(columns), [columns])
  const defaultVisibleColumnsKey = useMemo(() => defaultVisibleColumns.join(','), [defaultVisibleColumns])
  const preferenceQueryKey = useMemo(
    () => ['table-preferences', tableKey, availableColumns.join(','), lockedColumns.join(',')] as const,
    [availableColumns, lockedColumns, tableKey],
  )
  const hasExplicitPerPageInUrl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('per_page')

  // Load from localStorage for instant display
  const getCachedColumns = () => {
    const cached = readCachedPreference(tableKey)

    if (cached?.visible_columns) {
      return sanitizeVisibleColumns(columns, cached.visible_columns)
    }

    return defaultVisibleColumns
  }

  const [visibleColumns, setVisibleColumns] = useState<string[]>(getCachedColumns())
  const [hasHydrated, setHasHydrated] = useState(false)
  const initialPerPageRef = useRef<number | null>(typeof perPage === 'number' ? perPage : null)
  const hasAppliedCachedPerPageRef = useRef(false)
  const hasHydratedPerPageRef = useRef(false)
  const lastCommittedPayloadRef = useRef<string | null>(null)
  const inFlightPayloadRef = useRef<string | null>(null)
  const pendingPerPageRef = useRef<number | null>(null)
  const isInitialHydrationRef = useRef(true)

  useEffect(() => {
    setVisibleColumns(getCachedColumns())
    setHasHydrated(false)
    initialPerPageRef.current = typeof perPage === 'number' ? perPage : null
    hasAppliedCachedPerPageRef.current = false
    hasHydratedPerPageRef.current = false
    lastCommittedPayloadRef.current = null
    inFlightPayloadRef.current = null
    pendingPerPageRef.current = null
  }, [columnSchemaKey, defaultVisibleColumnsKey, schemaKey, tableKey])

  const preferenceQuery = useQuery({
    queryKey: preferenceQueryKey,
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
    if (!tableKey || !onPerPageChange || hasExplicitPerPageInUrl || hasAppliedCachedPerPageRef.current || hasHydratedPerPageRef.current) {
      return
    }

    const cachedPerPage = sanitizePerPage(readCachedPreference(tableKey)?.per_page, pageSizeOptions)
    hasAppliedCachedPerPageRef.current = true

    if (cachedPerPage !== null && cachedPerPage !== perPage) {
      onPerPageChange(cachedPerPage)
    }
  }, [hasExplicitPerPageInUrl, onPerPageChange, pageSizeOptions, perPage, tableKey])

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

    const nextVisibleColumns = sanitizeVisibleColumns(
      columns,
      preferenceQuery.data?.visible_columns?.length ? preferenceQuery.data.visible_columns : defaultVisibleColumns,
    )
    const serverPerPage = sanitizePerPage(preferenceQuery.data?.per_page, pageSizeOptions)
    isInitialHydrationRef.current = true
    setVisibleColumns(nextVisibleColumns)
    setHasHydrated(true)

    if (!hasHydratedPerPageRef.current && onPerPageChange && !hasExplicitPerPageInUrl && pendingPerPageRef.current === null) {
      if (serverPerPage !== null && serverPerPage !== perPage) {
        hasHydratedPerPageRef.current = true
        onPerPageChange(serverPerPage)
        return
      }

      if (serverPerPage === null && initialPerPageRef.current !== null && perPage !== initialPerPageRef.current) {
        hasHydratedPerPageRef.current = true
        onPerPageChange(initialPerPageRef.current)
        return
      }
    }

    hasHydratedPerPageRef.current = true
  }, [columns, defaultVisibleColumns, hasExplicitPerPageInUrl, hasHydrated, onPerPageChange, pageSizeOptions, perPage, preferenceQuery.data, preferenceQuery.isLoading, tableKey])

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
      lastCommittedPayloadRef.current = initialPayload
      return
    }

    const sanitizedVisibleColumns = sanitizeVisibleColumns(columns, visibleColumns)
    const payload = JSON.stringify({
      visible_columns: sanitizedVisibleColumns,
      per_page: typeof perPage === 'number' ? perPage : null,
    })

    if (payload === lastCommittedPayloadRef.current || payload === inFlightPayloadRef.current) {
      return
    }

    inFlightPayloadRef.current = payload
    pendingPerPageRef.current = typeof perPage === 'number' ? perPage : null

    void saveMutation
      .mutateAsync({
        visible_columns: sanitizedVisibleColumns,
        per_page: typeof perPage === 'number' ? perPage : null,
      })
      .then((response) => {
        const confirmed = {
          table_key: response.data.table_key,
          visible_columns: sanitizeVisibleColumns(columns, response.data.visible_columns),
          per_page: sanitizePerPage(response.data.per_page, pageSizeOptions),
        }
        const confirmedPayload = JSON.stringify({
          visible_columns: confirmed.visible_columns,
          per_page: confirmed.per_page,
        })

        lastCommittedPayloadRef.current = confirmedPayload
        inFlightPayloadRef.current = null
        pendingPerPageRef.current = null
        hasHydratedPerPageRef.current = true

        writeCachedPreference(tableKey, confirmed)
        queryClient.setQueryData(preferenceQueryKey, confirmed)

        if (confirmed.per_page !== null && onPerPageChange && confirmed.per_page !== perPage) {
          onPerPageChange(confirmed.per_page)
        }
      })
      .catch((error: unknown) => {
        inFlightPayloadRef.current = null
        pendingPerPageRef.current = null
        toast.error(resolveApiErrorMessage(error, 'Failed to save table preferences.'))
        void queryClient.invalidateQueries({ queryKey: preferenceQueryKey })
      })
  }, [columns, hasHydrated, onPerPageChange, pageSizeOptions, perPage, preferenceQueryKey, queryClient, saveMutation, tableKey, visibleColumns])

  const visibleColumnSet = useMemo(() => new Set(sanitizeVisibleColumns(columns, visibleColumns)), [columns, visibleColumns])

  const toggleColumn = (columnKey: string) => {
    if (lockedColumns.includes(columnKey)) {
      return
    }

    isInitialHydrationRef.current = false
    setVisibleColumns((current) => {
      const isCurrentlyVisible = current.includes(columnKey)
      return isCurrentlyVisible ? current.filter((item) => item !== columnKey) : [...current, columnKey]
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
