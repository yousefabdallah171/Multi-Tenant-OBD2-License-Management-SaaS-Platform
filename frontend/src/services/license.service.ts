import { api } from '@/services/api'
import { apiCache } from '@/lib/apiCache'
import type { PaginatedResponse } from '@/types/manager-parent.types'
import type { ActivateLicenseData, LicenseDetails, LicenseFilters, LicenseSummary, PauseLicenseData, RenewLicenseData } from '@/types/manager-reseller.types'

function clearRoleCaches() {
  apiCache.clearPattern(/^(reseller|manager|manager-parent|super-admin):/)
}

export const licenseService = {
  async activate(data: ActivateLicenseData) {
    const response = await api.post<{ message: string; data: LicenseSummary }>('/licenses/activate', data)
    clearRoleCaches()
    return response.data
  },
  async renew(id: number, data: RenewLicenseData) {
    const response = await api.post<{ message: string; data: LicenseSummary }>(`/licenses/${id}/renew`, data)
    clearRoleCaches()
    return response.data
  },
  async deactivate(id: number) {
    const response = await api.post<{ message: string; data: LicenseSummary }>(`/licenses/${id}/deactivate`)
    clearRoleCaches()
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
    const { data } = await api.get<{ data: LicenseSummary[]; summary?: { day1: number; day3: number; day7: number; expired: number } }>('/reseller/licenses/expiring', {
      params: { days },
    })
    return data
  },
  async bulkRenew(ids: number[], data: RenewLicenseData) {
    const response = await api.post<{ message: string; count: number }>('/licenses/bulk-renew', {
      ids,
      ...data,
    })
    clearRoleCaches()
    return response.data
  },
  async bulkDeactivate(ids: number[]) {
    const response = await api.post<{ message: string; count: number }>('/licenses/bulk-deactivate', {
      ids,
    })
    clearRoleCaches()
    return response.data
  },
  async bulkDelete(ids: number[]) {
    const response = await api.post<{ message: string; count: number }>('/licenses/bulk-delete', {
      ids,
    })
    clearRoleCaches()
    return response.data
  },
  async delete(id: number) {
    const response = await api.delete<{ message: string }>(`/licenses/${id}`)
    clearRoleCaches()
    return response.data
  },
  async pause(id: number, data: PauseLicenseData = {}) {
    const response = await api.post<{ message: string; data: LicenseSummary }>(`/licenses/${id}/pause`, data)
    clearRoleCaches()
    return response.data
  },
  async resume(id: number) {
    const response = await api.post<{ message: string; data: LicenseSummary }>(`/licenses/${id}/resume`)
    clearRoleCaches()
    return response.data
  },
  async retryScheduled(id: number) {
    const response = await api.post<{ message: string; data: LicenseSummary }>(`/licenses/${id}/retry-scheduled`)
    clearRoleCaches()
    return response.data
  },
  async cancelScheduled(id: number) {
    const response = await api.post<{ message: string; data: LicenseSummary }>(`/licenses/${id}/cancel-scheduled`)
    clearRoleCaches()
    return response.data
  },
  async cancelPending(id: number) {
    const response = await api.post<{ message: string; data: LicenseSummary }>(`/licenses/${id}/cancel-pending`)
    clearRoleCaches()
    return response.data
  },
}
