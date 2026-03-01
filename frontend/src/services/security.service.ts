import { api } from '@/services/api'
import type { PaginationMeta, SecurityAuditLog, SecurityLocksData } from '@/types/super-admin.types'

export const securityService = {
  async getLocks() {
    const { data } = await api.get<{ data: SecurityLocksData }>('/super-admin/security/locks')
    return data.data
  },
  async unblockEmail(email: string) {
    const { data } = await api.post<{ message: string }>('/super-admin/security/unblock-email', { email })
    return data
  },
  async unblockIp(ip: string) {
    const { data } = await api.post<{ message: string }>('/super-admin/security/unblock-ip', { ip })
    return data
  },
  async getAuditLog(params?: { per_page?: number }) {
    const { data } = await api.get<{ data: SecurityAuditLog[]; meta: PaginationMeta }>('/super-admin/security/audit-log', { params })
    return data
  },
}

