import { api } from '@/services/api'
import type { PaginatedResponse } from '@/types/manager-parent.types'
import type { BiosChangeRequest } from '@/types/manager-reseller.types'

export interface SuperAdminBcrFilters {
  page?: number
  per_page?: number
  status?: '' | 'pending' | 'approved' | 'rejected'
}

export const superAdminBcrService = {
  async getBiosChangeRequests(params?: SuperAdminBcrFilters) {
    const { data } = await api.get<PaginatedResponse<BiosChangeRequest>>('/super-admin/bios-change-requests', { params })
    return data
  },

  async getPendingBiosChangeRequestCount() {
    const { data } = await api.get<{ count: number }>('/super-admin/bios-change-requests', {
      params: { status: 'pending', count_only: true },
    })
    return data
  },

  async approveBiosChangeRequest(id: number) {
    const { data } = await api.put<{ data: BiosChangeRequest; message: string }>(`/super-admin/bios-change-requests/${id}/approve`)
    return data
  },

  async rejectBiosChangeRequest(id: number, reviewerNotes: string) {
    const { data } = await api.put<{ data: BiosChangeRequest; message: string }>(`/super-admin/bios-change-requests/${id}/reject`, {
      reviewer_notes: reviewerNotes,
    })
    return data
  },
}
