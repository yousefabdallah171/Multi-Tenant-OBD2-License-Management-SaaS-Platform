import { api } from '@/services/api'
import type { CustomerDashboardData, CustomerDownloadItem, CustomerNote, CustomerSoftwareItem } from '@/types/customer.types'
import type { CustomerDetails, CustomerSummary, PaginatedResponse } from '@/types/manager-parent.types'
import { downloadFile } from '@/utils/download'

export interface CustomerParams {
  page?: number
  per_page?: number
  manager_parent_id?: number | ''
  manager_id?: number | ''
  reseller_id?: number | ''
  program_id?: number | ''
  country_name?: string
  status?: string
  search?: string
}

export const customerService = {
  async getAll(params: CustomerParams) {
    const { data } = await api.get<PaginatedResponse<CustomerSummary>>('/customers', { params })
    return data
  },
  async getCountries(params: Omit<CustomerParams, 'page' | 'per_page' | 'country_name'>) {
    const { data } = await api.get<{ data: Array<{ country_name: string; count: number }> }>('/customers/countries', { params })
    return data
  },
  async exportXlsx(params: CustomerParams) {
    await downloadFile('/customers/export/csv', 'manager-parent-customers.xlsx', params)
  },
  async exportPdf(params: CustomerParams) {
    await downloadFile('/customers/export/pdf', 'manager-parent-customers.pdf', params)
  },
  async create(payload: { name: string; client_name?: string; email?: string; phone?: string; country_name?: string; bios_id?: string; program_id?: number }) {
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
  async getMyNotes(customerId: number) {
    const { data } = await api.get<{ data: CustomerNote[] }>(`/customers/${customerId}/notes`)
    return data
  },
  async addNote(customerId: number, note: string) {
    const { data } = await api.post<{ data: CustomerNote }>(`/customers/${customerId}/notes`, { note })
    return data
  },
  async updateNote(noteId: number, note: string) {
    const { data } = await api.put<{ data: CustomerNote }>(`/notes/${noteId}`, { note })
    return data
  },
  async deleteNote(noteId: number) {
    const { data } = await api.delete<{ message: string }>(`/notes/${noteId}`)
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
