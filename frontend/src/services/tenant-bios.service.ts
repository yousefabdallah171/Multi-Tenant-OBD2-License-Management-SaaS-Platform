import { api } from '@/services/api'
import type { BiosBlacklistEntry, PaginationMeta } from '@/types/super-admin.types'

export interface TenantBiosBlacklistParams {
  page?: number
  per_page?: number
  search?: string
  status?: string
}

export const tenantBiosService = {
  async getBlacklist(params: TenantBiosBlacklistParams) {
    const { data } = await api.get<{ data: BiosBlacklistEntry[]; meta: PaginationMeta }>('/bios-blacklist', { params })
    return data
  },
  async addToBlacklist(payload: { bios_id: string; reason: string }) {
    const { data } = await api.post<{ data: BiosBlacklistEntry }>('/bios-blacklist', payload)
    return data
  },
  async removeFromBlacklist(id: number) {
    const { data } = await api.delete<{ message: string }>(`/bios-blacklist/${id}`)
    return data
  },
}
