import { api } from '@/services/api'
import type { PaginationMeta, TenantBackup, TenantStats, TenantSummary } from '@/types/super-admin.types'
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
  async getBackups(tenantId: number) {
    const { data } = await api.get<{ data: TenantBackup[] }>(`/super-admin/tenants/${tenantId}/backups`)
    return data
  },
  async resetTenant(tenantId: number, payload: { confirm_name: string; label?: string }) {
    const { data } = await api.post<{ message: string; data: TenantBackup }>(`/super-admin/tenants/${tenantId}/reset`, payload)
    return data
  },
  async restoreBackup(tenantId: number, backupId: number, payload: { confirm_name: string }) {
    const { data } = await api.post<{ message: string }>(`/super-admin/tenants/${tenantId}/backups/${backupId}/restore`, payload)
    return data
  },
  async deleteBackup(tenantId: number, backupId: number) {
    const { data } = await api.delete<{ message: string }>(`/super-admin/tenants/${tenantId}/backups/${backupId}`)
    return data
  },
  async downloadBackup(tenantId: number, backupId: number): Promise<{ blob: Blob; filename: string }> {
    const response = await api.get(`/super-admin/tenants/${tenantId}/backups/${backupId}/download`, { responseType: 'blob' })
    const disposition = response.headers['content-disposition'] as string | undefined
    const match = disposition?.match(/filename="?([^"]+)"?/)
    const filename = match?.[1] ?? `backup-${tenantId}-${backupId}.json`
    return { blob: response.data as Blob, filename }
  },
  async importBackup(tenantId: number, file: File, label?: string) {
    const form = new FormData()
    form.append('file', file)
    if (label) form.append('label', label)
    const { data } = await api.post<{ message: string; data: TenantBackup }>(
      `/super-admin/tenants/${tenantId}/backups/import`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return data
  },
}
