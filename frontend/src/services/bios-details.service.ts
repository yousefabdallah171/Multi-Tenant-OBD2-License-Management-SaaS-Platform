import { api } from '@/services/api'
import type { BiosActivity, BiosIp, BiosLicense, BiosOverview, BiosReseller } from '@/types/bios-details.types'

interface PagedResponse<T> {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

function createBiosDetailsService(prefix: '' | '/super-admin' | '/manager') {
  return {
    async searchBiosIds(query: string) {
      const { data } = await api.get<{ data: string[] }>(`${prefix}/bios/search`, { params: { query } })
      return data.data
    },
    async getRecentBiosIds(limit = 20) {
      const { data } = await api.get<{ data: string[] }>(`${prefix}/bios/recent`, { params: { limit } })
      return data.data
    },
    async getBiosOverview(biosId: string) {
      const { data } = await api.get<{ data: BiosOverview }>(`${prefix}/bios/${encodeURIComponent(biosId)}`)
      return data.data
    },
    async getBiosLicenses(biosId: string, params?: { page?: number; per_page?: number; status?: string }) {
      const { data } = await api.get<PagedResponse<BiosLicense>>(`${prefix}/bios/${encodeURIComponent(biosId)}/licenses`, { params })
      return data
    },
    async getResellerBreakdown(biosId: string) {
      const { data } = await api.get<{ data: BiosReseller[] }>(`${prefix}/bios/${encodeURIComponent(biosId)}/resellers`)
      return data.data
    },
    async getIpAnalytics(biosId: string) {
      const { data } = await api.get<{ data: BiosIp[] }>(`${prefix}/bios/${encodeURIComponent(biosId)}/ips`)
      return data.data
    },
    async getBiosActivity(biosId: string) {
      const { data } = await api.get<{ data: BiosActivity[] }>(`${prefix}/bios/${encodeURIComponent(biosId)}/activity`)
      return data.data
    },
  }
}

export const managerParentBiosDetailsService = createBiosDetailsService('')
export const managerBiosDetailsService = createBiosDetailsService('/manager')
export const superAdminBiosDetailsService = createBiosDetailsService('/super-admin')
