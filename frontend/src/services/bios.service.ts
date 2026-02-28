import { api } from '@/services/api'
import type { BiosBlacklistEntry, BiosHistoryEvent, ManagedUser, PaginationMeta } from '@/types/super-admin.types'

export interface BiosBlacklistParams {
  page?: number
  per_page?: number
  search?: string
  status?: string
}

export interface BiosHistoryParams {
  page?: number
  per_page?: number
  bios_id?: string
  tenant_id?: number | ''
  action?: string
  from?: string
  to?: string
}

async function downloadFile(url: string, filename: string) {
  const response = await api.get<Blob>(url, { responseType: 'blob' })
  const blobUrl = window.URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(blobUrl)
}

export const biosService = {
  async getBlacklist(params: BiosBlacklistParams) {
    const { data } = await api.get<{ data: BiosBlacklistEntry[]; meta: PaginationMeta }>('/super-admin/bios-blacklist', { params })
    return data
  },
  async addToBlacklist(payload: { bios_id: string; reason: string }) {
    const { data } = await api.post<{ data: BiosBlacklistEntry }>('/super-admin/bios-blacklist', payload)
    return data
  },
  async removeFromBlacklist(id: number) {
    const { data } = await api.post<{ message: string }>(`/super-admin/bios-blacklist/${id}/remove`)
    return data
  },
  async exportBlacklist() {
    await downloadFile('/super-admin/bios-blacklist/export', 'bios-blacklist.csv')
  },
  async importBlacklist(file: File) {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await api.post<{ message: string; created: number }>('/super-admin/bios-blacklist/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return data
  },
  async getHistory(params: BiosHistoryParams) {
    const { data } = await api.get<{ data: BiosHistoryEvent[]; meta: PaginationMeta }>('/super-admin/bios-history', { params })
    return data
  },
  async getHistoryById(biosId: string) {
    const { data } = await api.get<{ data: { bios_id: string; events: BiosHistoryEvent[] } }>(`/super-admin/bios-history/${biosId}`)
    return data
  },
  async getUsernameManagement(params: { page?: number; per_page?: number; tenant_id?: number | ''; role?: string; locked?: boolean | ''; search?: string }) {
    const { data } = await api.get<{ data: ManagedUser[]; meta: PaginationMeta }>('/super-admin/username-management', { params })
    return data
  },
  async unlockUsername(id: number, reason?: string) {
    const { data } = await api.post<{ data: ManagedUser }>(`/super-admin/username-management/${id}/unlock`, { reason })
    return data
  },
  async changeUsername(id: number, username: string, reason?: string) {
    const { data } = await api.put<{ data: ManagedUser }>(`/super-admin/username-management/${id}/username`, { username, reason })
    return data
  },
  async resetUserPassword(id: number, password?: string) {
    const { data } = await api.post<{ message: string; temporary_password: string }>(`/super-admin/username-management/${id}/reset-password`, { password })
    return data
  },
}
