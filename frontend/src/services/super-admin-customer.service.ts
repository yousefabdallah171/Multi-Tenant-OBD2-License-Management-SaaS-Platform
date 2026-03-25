import { api } from '@/services/api'
import type { PaginationMeta, SuperAdminCustomerDetails, SuperAdminCustomerSummary } from '@/types/super-admin.types'

export interface SuperAdminCustomerParams {
  page?: number
  per_page?: number
  tenant_id?: number | ''
  reseller_id?: number | ''
  program_id?: number | ''
  status?: string
  search?: string
}

export const superAdminCustomerService = {
  async getAll(params: SuperAdminCustomerParams) {
    const { data } = await api.get<{ data: SuperAdminCustomerSummary[]; meta: PaginationMeta }>('/super-admin/customers', { params })
    return data
  },
  async create(payload: { name: string; client_name?: string; email?: string; phone?: string; tenant_id: number; seller_id?: number; bios_id?: string; program_id?: number }) {
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
  async getExpiring() {
    const { data } = await api.get<{ data: { day1: number; day3: number; day7: number; expired: number } }>('/super-admin/licenses/expiring')
    return data
  },
}
