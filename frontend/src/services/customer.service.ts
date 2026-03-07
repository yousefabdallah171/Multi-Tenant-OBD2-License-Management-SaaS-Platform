import { api } from '@/services/api'
import type { CustomerDashboardData, CustomerDownloadItem, CustomerSoftwareItem } from '@/types/customer.types'
import type { CustomerDetails, CustomerSummary, PaginatedResponse } from '@/types/manager-parent.types'

export interface CustomerParams {
  page?: number
  per_page?: number
  reseller_id?: number | ''
  program_id?: number | ''
  status?: string
  search?: string
}

export const customerService = {
  async getAll(params: CustomerParams) {
    const { data } = await api.get<PaginatedResponse<CustomerSummary>>('/customers', { params })
    return data
  },
  async create(payload: { name: string; client_name?: string; email?: string; phone?: string; bios_id?: string; program_id?: number }) {
    const { data } = await api.post<{ data: CustomerSummary }>('/customers', payload)
    return data
  },
  async getOne(id: number) {
    const { data } = await api.get<{ data: CustomerDetails }>(`/customers/${id}`)
    return data
  },
  async update(id: number, payload: { client_name: string; email?: string; phone?: string }) {
    const { data } = await api.put<{ data: CustomerSummary }>(`/customers/${id}`, payload)
    return data
  },
  async remove(id: number) {
    const { data } = await api.delete<{ message: string }>(`/customers/${id}`)
    return data
  },
}

export const customerPortalService = {
  async getDashboard() {
    const { data } = await api.get<{ data: CustomerDashboardData }>('/customer/dashboard')
    return data
  },
  async getSoftware() {
    const { data } = await api.get<{ data: CustomerSoftwareItem[] }>('/customer/software')
    return data
  },
  async getDownloads() {
    const { data } = await api.get<{ data: CustomerDownloadItem[] }>('/customer/downloads')
    return data
  },
  async logDownload(id: number) {
    const { data } = await api.post<{ message: string; logged_at: string }>(`/customer/downloads/${id}/log`)
    return data
  },
}
