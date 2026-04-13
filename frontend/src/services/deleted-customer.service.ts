import { api } from '@/services/api'
import type { DeletedCustomer, DeletedCustomerDetail, PaginationMeta } from '@/types/super-admin.types'

export interface DeletedCustomerListParams {
  page?: number
  per_page?: number
  search?: string
  tenant_id?: number
}

export interface DeletedCustomerListResponse {
  data: DeletedCustomer[]
  meta: PaginationMeta
}

export interface DeletedCustomerResponse {
  data: DeletedCustomerDetail
}

export interface RestorePayload {
  confirm_name: string
}

export interface RestoreResponse {
  message: string
  data: { customer_id: number }
}

export const deletedCustomerService = {
  async getAll(params: DeletedCustomerListParams) {
    const { data } = await api.get<DeletedCustomerListResponse>('/super-admin/deleted-customers', { params })
    return data
  },

  async getOne(id: number) {
    const { data } = await api.get<DeletedCustomerResponse>(`/super-admin/deleted-customers/${id}`)
    return data
  },

  async restore(id: number, payload: RestorePayload) {
    const { data } = await api.post<RestoreResponse>(`/super-admin/deleted-customers/${id}/restore`, payload)
    return data
  },

  async deleteRevenue(id: number) {
    const { data } = await api.delete<{ message: string }>(`/super-admin/deleted-customers/${id}/revenue`)
    return data
  },

  async destroy(id: number) {
    const { data } = await api.delete<{ message: string }>(`/super-admin/deleted-customers/${id}`)
    return data
  },
}
