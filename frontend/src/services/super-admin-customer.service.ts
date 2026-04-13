import { api } from '@/services/api'
import type { PaginationMeta, SuperAdminCustomerDetails, SuperAdminCustomerSummary } from '@/types/super-admin.types'
import { downloadFile } from '@/utils/download'

export interface SuperAdminCustomerParams {
  page?: number
  per_page?: number
  tenant_id?: number | ''
  reseller_id?: number | ''
  program_id?: number | ''
  country_name?: string
  status?: string
  search?: string
}

export const superAdminCustomerService = {
  async getAll(params: SuperAdminCustomerParams) {
    const { data } = await api.get<{ data: SuperAdminCustomerSummary[]; meta: PaginationMeta }>('/super-admin/customers', { params })
    return data
  },
  async getCountries(params: Omit<SuperAdminCustomerParams, 'page' | 'per_page' | 'country_name'>) {
    const { data } = await api.get<{ data: Array<{ country_name: string; count: number }> }>('/super-admin/customers/countries', { params })
    return data
  },
  async exportXlsx(params: SuperAdminCustomerParams) {
    await downloadFile('/super-admin/customers/export/csv', 'super-admin-customers.xlsx', params)
  },
  async exportPdf(params: SuperAdminCustomerParams) {
    await downloadFile('/super-admin/customers/export/pdf', 'super-admin-customers.pdf', params)
  },
  async create(payload: { name: string; client_name?: string; email?: string; phone?: string; country_name?: string; tenant_id: number; seller_id?: number; bios_id?: string; program_id?: number }) {
    const { data } = await api.post<{ data: SuperAdminCustomerSummary }>('/super-admin/customers', payload)
    return data
  },
  async getOne(id: number) {
    const { data } = await api.get<{ data: SuperAdminCustomerDetails }>(`/super-admin/customers/${id}`)
    return data
  },
  async update(id: number, payload: { client_name: string; email?: string; phone?: string }) {
    const { data } = await api.put<{ data: SuperAdminCustomerSummary }>(`/super-admin/customers/${id}`, payload)
    return data
  },
  async remove(id: number) {
    const { data } = await api.delete<{ message: string }>(`/super-admin/customers/${id}`)
    return data
  },
  async removeRevenue(id: number) {
    const { data } = await api.delete<{ message: string }>(`/super-admin/customers/${id}/revenue`)
    return data
  },
  async directChangeBiosId(licenseId: number, newBiosId: string) {
    const { data } = await api.post<{ success: boolean; message: string }>('/super-admin/bios-change-requests/direct', {
      license_id: licenseId,
      new_bios_id: newBiosId,
    })
    return data
  },
  async getExpiring() {
    const { data } = await api.get<{ data: { day1: number; day3: number; day7: number; expired: number } }>('/super-admin/licenses/expiring')
    return data
  },
}
