import { api } from '@/services/api'
import type { ManagedUser, ManagedUserDetail, PaginationMeta, RoleCounts } from '@/types/super-admin.types'

export interface UserListParams {
  page?: number
  per_page?: number
  role?: string
  roles?: string[]
  tenant_id?: number | ''
  status?: string
  search?: string
}

export interface UserListResponse {
  data: ManagedUser[]
  meta: PaginationMeta
  role_counts: RoleCounts
}

export const userService = {
  async getAll(params: UserListParams) {
    const { data } = await api.get<UserListResponse>('/super-admin/users', { params })
    return data
  },
  async getOne(id: number) {
    const { data } = await api.get<{ data: ManagedUserDetail }>(`/super-admin/users/${id}`)
    return data
  },
  async updateStatus(id: number, status: 'active' | 'suspended' | 'inactive') {
    const { data } = await api.put<{ data: ManagedUser }>(`/super-admin/users/${id}/status`, { status })
    return data
  },
  async delete(id: number) {
    const { data } = await api.delete<{ message: string }>(`/super-admin/users/${id}`)
    return data
  },
}
