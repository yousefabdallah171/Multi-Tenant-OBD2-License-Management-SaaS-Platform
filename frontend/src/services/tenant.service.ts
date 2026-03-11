import { api } from '@/services/api'
import type { PaginationMeta, TenantStats, TenantSummary } from '@/types/super-admin.types'
import type { User } from '@/types/user.types'

export interface TenantListParams {
  page?: number
  per_page?: number
  status?: 'active' | 'suspended' | 'inactive' | ''
  search?: string
}

export interface CreateTenantPayload {
  name: string
  manager_name: string
  manager_email: string
  manager_password: string
  status?: 'active' | 'suspended' | 'inactive'
}

export interface TenantListResponse {
  data: TenantSummary[]
  meta: PaginationMeta
  status_counts: {
    all: number
    active: number
    suspended: number
    inactive: number
  }
}

export interface TenantCreateResponse {
  data: {
    tenant: TenantSummary
    manager: User
  }
}

export const tenantService = {
  async getAll(params: TenantListParams) {
    const { data } = await api.get<TenantListResponse>('/super-admin/tenants', { params })
    return data
  },
  async create(payload: CreateTenantPayload) {
    const { data } = await api.post<TenantCreateResponse>('/super-admin/tenants', payload)
    return data
  },
  async update(id: number, payload: Partial<Pick<TenantSummary, 'name' | 'status' | 'settings'>>) {
    const { data } = await api.put<{ data: TenantSummary }>(`/super-admin/tenants/${id}`, payload)
    return data
  },
  async delete(id: number) {
    const { data } = await api.delete<{ message: string }>(`/super-admin/tenants/${id}`)
    return data
  },
  async getStats(id: number) {
    const { data } = await api.get<{ data: TenantStats }>(`/super-admin/tenants/${id}/stats`)
    return data
  },
}
