import { api } from '@/services/api'
import type { ManagedUser, ManagedUserDetail, PaginationMeta } from '@/types/super-admin.types'

export interface AdminListParams {
  page?: number
  per_page?: number
  role?: string
  tenant_id?: number | ''
  status?: string
  search?: string
}

export interface AdminPayload {
  name: string
  email: string
  password?: string
  role: 'super_admin' | 'manager_parent' | 'manager' | 'reseller'
  tenant_id?: number | null
  assign_to_id?: number
  phone?: string | null
  status?: 'active' | 'suspended' | 'inactive'
}

export const adminService = {
  async getAll(params: AdminListParams) {
    const { data } = await api.get<{ data: ManagedUser[]; meta: PaginationMeta }>('/super-admin/admin-management', { params })
    return data
  },
  async create(payload: AdminPayload) {
    const { data } = await api.post<{ data: ManagedUser }>('/super-admin/admin-management', payload)
    return data
  },
  async getOne(id: number) {
    const { data } = await api.get<{ data: ManagedUserDetail }>(`/super-admin/admin-management/${id}`)
    return data
  },
  async update(id: number, payload: Partial<AdminPayload>) {
    const { data } = await api.put<{ data: ManagedUser }>(`/super-admin/admin-management/${id}`, payload)
    return data
  },
  async delete(id: number) {
    const { data } = await api.delete<{ message: string }>(`/super-admin/admin-management/${id}`)
    return data
  },
  async resetPassword(id: number, newPassword?: string, revokeTokens = true) {
    const { data } = await api.post<{ message: string; temporary_password: string }>(`/super-admin/admin-management/${id}/reset-password`, {
      new_password: newPassword,
      revoke_tokens: revokeTokens,
    })
    return data
  },
}
