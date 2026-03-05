import { api } from '@/services/api'
import type { PaginatedResponse } from '@/types/manager-parent.types'
import type { ActivateLicenseData, LicenseDetails, LicenseFilters, LicenseSummary, RenewLicenseData } from '@/types/manager-reseller.types'

export const licenseService = {
  async activate(data: ActivateLicenseData) {
    const response = await api.post<{ message: string; data: LicenseSummary }>('/licenses/activate', data)
    return response.data
  },
  async renew(id: number, data: RenewLicenseData) {
    const response = await api.post<{ message: string; data: LicenseSummary }>(`/licenses/${id}/renew`, data)
    return response.data
  },
  async deactivate(id: number) {
    const response = await api.post<{ message: string; data: LicenseSummary }>(`/licenses/${id}/deactivate`)
    return response.data
  },
  async getAll(params: LicenseFilters) {
    const { data } = await api.get<PaginatedResponse<LicenseSummary>>('/reseller/licenses', { params })
    return data
  },
  async getById(id: number) {
    const { data } = await api.get<{ data: LicenseDetails }>(`/licenses/${id}`)
    return data
  },
  async getExpiring(days = 7) {
    const { data } = await api.get<{ data: LicenseSummary[] }>('/reseller/licenses/expiring', {
      params: { days },
    })
    return data
  },
  async bulkRenew(ids: number[], data: RenewLicenseData) {
    const response = await api.post<{ message: string; count: number }>('/licenses/bulk-renew', {
      ids,
      ...data,
    })
    return response.data
  },
  async bulkDeactivate(ids: number[]) {
    const response = await api.post<{ message: string; count: number }>('/licenses/bulk-deactivate', {
      ids,
    })
    return response.data
  },
  async pause(id: number) {
    const response = await api.post<{ message: string; data: LicenseSummary }>(`/licenses/${id}/pause`)
    return response.data
  },
  async resume(id: number) {
    const response = await api.post<{ message: string; data: LicenseSummary }>(`/licenses/${id}/resume`)
    return response.data
  },
}
