import { api } from '@/services/api'
import type {
  BiosChangeAuditEntry,
  BiosChangeAuditParams,
  BiosChangeAuditSummary,
  IpAnalyticsEntry,
  IpAnalyticsStats,
  NetworkDiagramPayload,
  PaginatedResponse,
  ProgramLog,
  ProgramLogSummary,
  ProgramLogUserOption,
  ProgramSummary,
  ProgramUserLogEntry,
  SellerLogEntry,
  SellerLogSummary,
} from '@/types/manager-parent.types'
import type { ManagerParentSalesCustomerFilters, ManagerParentSalesCustomerListResponse, RecordPaymentPayload, ResellerPaymentDetailData, ResellerPaymentFilters, ResellerPaymentListData, StoreCommissionPayload, TransactionHistoryFilters, TransactionHistoryListResponse } from '@/types/manager-reseller.types'
import type { ImpersonationStartResponse, ImpersonationTargetListResponse } from '@/types/super-admin.types'

export const superAdminPlatformService = {
  async getSellers(params?: { role?: 'manager_parent' | 'manager' | 'reseller'; tenant_id?: number | ''; per_page?: number }) {
    const { data } = await api.get<PaginatedResponse<{ id: number; name: string; email: string; role: 'manager_parent' | 'manager' | 'reseller'; tenant_id: number | null; tenant_name: string | null }>>('/super-admin/sellers', {
      params: { per_page: 100, ...params },
    })
    return data
  },
  async getTeamNetwork(params?: { tenant_id?: number | '' }) {
    const { data } = await api.get<{ data: NetworkDiagramPayload }>('/super-admin/team/network', { params })
    return data
  },
  async getProgramsWithExternalApi(params?: { tenant_id?: number | '' }) {
    const { data } = await api.get<PaginatedResponse<ProgramSummary>>('/super-admin/programs', { params: { per_page: 100, status: 'active', ...params } })
    return data.data.filter((program) => program.has_external_api)
  },
  async getProgramLogs(programId: number, params?: { page?: number; per_page?: number; seller_id?: number | ''; action?: string }): Promise<{ raw: string; rows?: ProgramLog[]; user_rows?: ProgramUserLogEntry[]; users?: ProgramLogUserOption[]; summary?: ProgramLogSummary; external_available?: boolean; meta?: { page: number; per_page: number; total: number; last_page: number; has_next_page: boolean; next_page: number | null } }> {
    const { data } = await api.get<{ data: { raw: string; rows?: ProgramLog[]; user_rows?: ProgramUserLogEntry[]; users?: ProgramLogUserOption[]; summary?: ProgramLogSummary; external_available?: boolean; meta?: { page: number; per_page: number; total: number; last_page: number; has_next_page: boolean; next_page: number | null } } }>(`/super-admin/programs/${programId}/logs`, { params })
    return data.data
  },
  async getProgramActiveUsers(programId: number): Promise<{ users: Record<string, string> }> {
    const { data } = await api.get<{ data: { users: Record<string, string> } }>(`/super-admin/programs/${programId}/active-users`)
    return data.data
  },
  async getProgramStats(programId: number): Promise<{ count: number }> {
    const { data } = await api.get<{ data: { count: number } }>(`/super-admin/programs/${programId}/stats`)
    return data.data
  },
  async getResellerPayments(filters?: ResellerPaymentFilters & { tenant_id?: number | '' }) {
    const { data } = await api.get<ResellerPaymentListData>('/super-admin/reseller-payments', { params: filters })
    return data
  },
  async getResellerPaymentDetail(resellerId: number) {
    const { data } = await api.get<{ data: ResellerPaymentDetailData }>(`/super-admin/reseller-payments/${resellerId}`)
    return data
  },
  async getManagerParentSalesCustomers(managerParentId: number, filters?: ManagerParentSalesCustomerFilters) {
    const { data } = await api.get<ManagerParentSalesCustomerListResponse>(`/super-admin/reseller-payments/manager-parent/${managerParentId}/customers`, { params: filters })
    return data
  },
  async getManagerSalesCustomers(managerId: number, filters?: ManagerParentSalesCustomerFilters) {
    const { data } = await api.get<ManagerParentSalesCustomerListResponse>(`/super-admin/reseller-payments/manager/${managerId}/customers`, { params: filters })
    return data
  },
  async getResellerSalesCustomers(resellerId: number, filters?: ManagerParentSalesCustomerFilters) {
    const { data } = await api.get<ManagerParentSalesCustomerListResponse>(`/super-admin/reseller-payments/reseller/${resellerId}/customers`, { params: filters })
    return data
  },
  async getTransactionHistory(filters?: TransactionHistoryFilters) {
    const { data } = await api.get<TransactionHistoryListResponse>('/super-admin/transaction-history', { params: filters })
    return data
  },
  async recordPayment(payload: RecordPaymentPayload) {
    const { data } = await api.post<{ data: unknown; message: string }>('/super-admin/reseller-payments', payload)
    return data
  },
  async updatePayment(paymentId: number, payload: RecordPaymentPayload) {
    const { data } = await api.put<{ data: unknown; message: string }>(`/super-admin/reseller-payments/${paymentId}`, payload)
    return data
  },
  async deletePayment(paymentId: number) {
    const { data } = await api.delete<{ message: string }>(`/super-admin/reseller-payments/${paymentId}`)
    return data
  },
  async storeCommission(payload: StoreCommissionPayload) {
    const { data } = await api.post<{ data: unknown; message: string }>('/super-admin/reseller-commissions', payload)
    return data
  },
  async getIpAnalytics(params: { page?: number; per_page?: number; search?: string; reputation?: 'all' | 'safe' | 'proxy'; from?: string; to?: string; country?: string; program_id?: number; tenant_id?: number | '' }) {
    const { data } = await api.get<{ data: IpAnalyticsEntry[]; meta: { page: number; per_page: number; total: number; last_page: number; has_next_page: boolean; next_page: number | null } }>('/super-admin/ip-analytics', { params })
    return data
  },
  async getIpStats() {
    const { data } = await api.get<{ data: IpAnalyticsStats }>('/super-admin/ip-analytics/stats')
    return data
  },
  async getBiosChangeAudit(params: BiosChangeAuditParams & { tenant_id?: number | '' } = {}) {
    const { data } = await api.get<PaginatedResponse<BiosChangeAuditEntry>>('/super-admin/bios-change-audit', { params })
    return data
  },
  async getBiosChangeAuditSummary(params?: { tenant_id?: number | '' }) {
    const { data } = await api.get<BiosChangeAuditSummary>('/super-admin/bios-change-audit/summary', { params })
    return data
  },
  async getActivity(params?: { page?: number; per_page?: number; user_id?: number | ''; action?: string; from?: string; to?: string; tenant_id?: number | '' }) {
    const { data } = await api.get<PaginatedResponse<{
      id: number
      tenant_id: number | null
      tenant_name: string | null
      action: string
      description: string | null
      metadata: Record<string, unknown>
      ip_address: string | null
      user: { id: number; name: string } | null
      created_at: string | null
    }>>('/super-admin/activity', { params })
    return data
  },
  async exportActivity(params?: { user_id?: number | ''; action?: string; from?: string; to?: string; per_page?: number; page?: number; tenant_id?: number | '' }) {
    const { downloadFile } = await import('@/utils/download')
    await downloadFile('/super-admin/activity/export', 'super-admin-activity.csv', params)
  },
  async getSellerLogs(params?: { page?: number; per_page?: number; seller_id?: number | ''; action?: string; from?: string; to?: string; tenant_id?: number | '' }) {
    const { data } = await api.get<{ data: SellerLogEntry[]; summary: SellerLogSummary; meta: { page: number; per_page: number; total: number; last_page: number; has_next_page: boolean; next_page: number | null } }>('/super-admin/reseller-logs', { params })
    return data
  },
  async getImpersonationTargets(params?: { page?: number; per_page?: number; search?: string; role?: 'manager_parent' | 'manager' | 'reseller' | ''; tenant_id?: number | ''; status?: 'active' | 'suspended' | 'inactive' | '' }) {
    const { data } = await api.get<ImpersonationTargetListResponse>('/super-admin/impersonation/targets', { params })
    return data
  },
  async startImpersonation(targetUserId: number) {
    const { data } = await api.post<ImpersonationStartResponse>('/super-admin/impersonation/start', { target_user_id: targetUserId })
    return data
  },
  async exchangeImpersonation(token: string) {
    const { data } = await api.post<{
      data: {
        token: string
        expires_at: string
        user: {
          id: number
          tenant_id: number | null
          name: string
          username: string | null
          email: string
          phone: string | null
          timezone?: string | null
          role: 'super_admin' | 'manager_parent' | 'manager' | 'reseller' | 'customer'
          status: 'active' | 'suspended' | 'inactive'
          created_by: number | null
          username_locked: boolean
          tenant?: { id: number; name: string; slug: string; status: string } | null
        }
        impersonation: {
          active: true
          actor: { id: number; name: string; email: string }
          target: { id: number; name: string; email: string; role: 'manager_parent' | 'manager' | 'reseller' }
          started_at: string
          expires_at: string
        }
      }
    }>('/super-admin/impersonation/exchange', { token })
    return data
  },
  async stopImpersonation(payload?: { target_user_id?: number; target_role?: string }) {
    const { data } = await api.post<{ message: string }>('/super-admin/impersonation/stop', payload ?? {})
    return data
  },
}
