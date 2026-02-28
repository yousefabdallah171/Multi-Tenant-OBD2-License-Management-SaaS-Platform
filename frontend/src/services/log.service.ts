import { api } from '@/services/api'
import type { LogEntry, PaginationMeta } from '@/types/super-admin.types'

export interface LogListParams {
  page?: number
  per_page?: number
  tenant_id?: number | ''
  endpoint?: string
  method?: string
  status_group?: string
  status_from?: number | ''
  status_to?: number | ''
  from?: string
  to?: string
}

export const logService = {
  async getAll(params: LogListParams) {
    const { data } = await api.get<{ data: LogEntry[]; meta: PaginationMeta }>('/super-admin/logs', { params })
    return data
  },
  async getById(id: number) {
    const { data } = await api.get<{ data: LogEntry }>(`/super-admin/logs/${id}`)
    return data
  },
}
