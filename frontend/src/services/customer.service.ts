import { api } from '@/services/api'
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
  async getOne(id: number) {
    const { data } = await api.get<{ data: CustomerDetails }>(`/customers/${id}`)
    return data
  },
}
