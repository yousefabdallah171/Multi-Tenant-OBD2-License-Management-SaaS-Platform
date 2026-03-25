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
        indexes: null,
      },
    })

    return data.data
  },

  async update(tableKey: string, payload: TablePreferenceRequest) {
    const { data } = await api.put<{ data: TablePreferencePayload; message: string }>(`/table-preferences/${tableKey}`, payload)
    return data
  },
}
