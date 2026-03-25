import { api } from '@/services/api'

export interface TablePreferencePayload {
  table_key: string
  visible_columns: string[]
  per_page: number | null
}

interface TablePreferenceRequest {
  visible_columns: string[]
  available_columns: string[]
  locked_columns: string[]
  per_page: number | null
}

export const tablePreferenceService = {
  async get(tableKey: string, availableColumns: string[], lockedColumns: string[]) {
    const { data } = await api.get<{ data: TablePreferencePayload }>('/table-preferences', {
      params: {
        table_key: tableKey,
        available_columns: availableColumns,
        locked_columns: lockedColumns,
      },
      paramsSerializer: {
        serialize: (params) => {
          const searchParams = new URLSearchParams()
          const tableKeyParam = params.table_key
          const availableColumnsParam = Array.isArray(params.available_columns) ? params.available_columns : []
          const lockedColumnsParam = Array.isArray(params.locked_columns) ? params.locked_columns : []

          if (typeof tableKeyParam === 'string') {
            searchParams.set('table_key', tableKeyParam)
          }

          for (const column of availableColumnsParam) {
            searchParams.append('available_columns[]', String(column))
          }

          for (const column of lockedColumnsParam) {
            searchParams.append('locked_columns[]', String(column))
          }

          return searchParams.toString()
        },
      },
    })

    return data.data
  },

  async update(tableKey: string, payload: TablePreferenceRequest) {
    const { data } = await api.put<{ data: TablePreferencePayload; message: string }>(`/table-preferences/${tableKey}`, payload)
    return data
  },
}
