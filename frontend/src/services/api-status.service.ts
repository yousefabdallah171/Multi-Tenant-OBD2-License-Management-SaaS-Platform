import { api } from '@/services/api'
import type { ApiStatusSummary } from '@/types/super-admin.types'

export const apiStatusService = {
  async getStatus() {
    const { data } = await api.get<{ data: ApiStatusSummary }>('/super-admin/api-status')
    return data
  },
  async getHistory() {
    const { data } = await api.get<{ data: Array<{ time: string; response_time_ms: number; status_code: number }> }>('/super-admin/api-status/history')
    return data
  },
  async ping() {
    const { data } = await api.post<{ data: { status: string; status_code: number; response_time_ms: number; payload: Record<string, unknown> } }>('/super-admin/api-status/ping')
    return data
  },
}
