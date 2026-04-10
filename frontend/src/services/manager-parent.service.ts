import { api } from '@/services/api'
import { apiCache } from '@/lib/apiCache'
import type {
  ApiStatusHistoryPoint,
  BiosChangeAuditEntry,
  BiosChangeAuditParams,
  BiosChangeAuditSummary,
  BiosConflictFilters,
  BiosConflictItem,
  BiosHistoryEntry,
  FinancialReportData,
  IpAnalyticsEntry,
  IpAnalyticsStats,
  LogFilters,
  ManagerParentApiStatus,
  ManagerParentDashboardPayload,
  ManagerParentDashboardStats,
  ManagerParentLogEntry,
  NetworkDiagramPayload,
  CustomerLicenseHistoryEntry,
  ManagerParentBiosChangeRequest,
  PaginatedResponse,
  ProgramLog,
  ProgramLogSummary,
  ProgramLogUserOption,
  ProgramUserLogEntry,
  ProgramSummary,
  SellerLogEntry,
  SellerLogSummary,
  TenantSettings,
  TeamMemberDetail,
  UsernameManagedUser,
} from '@/types/manager-parent.types'
import type { LicenseFilters, LicenseSummary, SubmitBiosChangeRequestData } from '@/types/manager-reseller.types'
import type { RecordPaymentPayload, ResellerPaymentDetailData, ResellerPaymentFilters, ResellerPaymentListData, StoreCommissionPayload } from '@/types/manager-reseller.types'
import { downloadFile } from '@/utils/download'

/**
 * Cache TTL values (in milliseconds)
 */
const CACHE_TTL = {
  STATS: 45 * 1000, // 45 seconds
  CHART: 30 * 1000, // 30 seconds
  ACTIVITY: 60 * 1000, // 60 seconds
  REPORT: 90 * 1000, // 90 seconds
}

export const managerParentService = {
  async getDashboard() {
    const { data } = await api.get<ManagerParentDashboardPayload>('/dashboard')
    return data
  },
  async getDashboardStats() {
    const cacheKey = 'manager-parent:dashboard:stats'
    const cached = apiCache.get<{ stats: ManagerParentDashboardStats }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ stats: ManagerParentDashboardStats }>('/dashboard/stats')
    apiCache.set(cacheKey, data, CACHE_TTL.STATS)
    return data
  },
  async getRevenueChart() {
    const cacheKey = 'manager-parent:dashboard:revenue-chart'
    const cached = apiCache.get<{ data: Array<{ month: string; revenue: number }> }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: Array<{ month: string; revenue: number }> }>('/dashboard/revenue-chart')
    apiCache.set(cacheKey, data, CACHE_TTL.CHART)
    return data
  },
  async getExpiryForecast() {
    const cacheKey = 'manager-parent:dashboard:expiry-forecast'
    const cached = apiCache.get<{ data: Array<{ range: string; count: number }> }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: Array<{ range: string; count: number }> }>('/dashboard/expiry-forecast')
    apiCache.set(cacheKey, data, CACHE_TTL.CHART)
    return data
  },
  async getTeamPerformance() {
    const cacheKey = 'manager-parent:dashboard:team-performance'
    const cached = apiCache.get<{ data: Array<{ id: number; name: string; role: string; activations: number; revenue: number; customers: number }> }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: Array<{ id: number; name: string; role: string; activations: number; revenue: number; customers: number }> }>('/dashboard/team-performance')
    apiCache.set(cacheKey, data, CACHE_TTL.CHART)
    return data
  },
  async getConflictRate() {
    const cacheKey = 'manager-parent:dashboard:conflict-rate'
    const cached = apiCache.get<{ data: Array<{ month: string; count: number }> }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: Array<{ month: string; count: number }> }>('/dashboard/conflict-rate')
    apiCache.set(cacheKey, data, CACHE_TTL.CHART)
    return data
  },
  async getRevenueByReseller(params?: { from?: string; to?: string }) {
    const { data } = await api.get<{ data: Array<{ reseller: string; revenue: number; activations: number }> }>('/reports/revenue-by-reseller', { params })
    return data
  },
  async getRevenueByProgram(params?: { from?: string; to?: string }) {
    const { data } = await api.get<{ data: Array<{ program: string; revenue: number; activations: number }> }>('/reports/revenue-by-program', { params })
    return data
  },
  async getActivationRate(params?: { from?: string; to?: string }) {
    const { data } = await api.get<{ data: Array<{ label: string; count: number; percentage: number }> }>('/reports/activation-rate', { params })
    return data
  },
  async getRetention(params?: { from?: string; to?: string }) {
    const { data } = await api.get<{ data: Array<{ month: string; customers: number; activations: number }> }>('/reports/retention', { params })
    return data
  },
  async exportReportsCsv(params?: { from?: string; to?: string }) {
    await downloadFile('/reports/export/csv', 'manager-parent-reports.csv', params)
  },
  async exportReportsPdf(params?: { from?: string; to?: string }) {
    await downloadFile('/reports/export/pdf', 'manager-parent-reports.pdf', params)
  },
  async getSettings() {
    const { data } = await api.get<{ data: TenantSettings }>('/settings')
    return data
  },
  async updateSettings(payload: TenantSettings) {
    const { data } = await api.put<{ data: TenantSettings; message: string }>('/settings', payload)
    // Invalidate cache after mutation
    apiCache.clearPattern(/^manager-parent:dashboard:/)
    apiCache.clearPattern(/^manager-parent:reports:/)
    return data
  },
  async uploadLogo(file: File) {
    const formData = new FormData()
    formData.append('logo', file)
    const { data } = await api.post<{ data: { logo: string }; message: string }>('/settings/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },
  async getBiosHistory(params?: { page?: number; per_page?: number; bios_id?: string; action?: string; reseller_id?: number | ''; from?: string; to?: string }) {
    const { data } = await api.get<PaginatedResponse<BiosHistoryEntry>>('/bios-history', { params })
    return data
  },
  async getBiosChangeAudit(params: BiosChangeAuditParams = {}) {
    const { data } = await api.get<PaginatedResponse<BiosChangeAuditEntry>>('/bios-change-audit', { params })
    return data
  },
  async getBiosChangeAuditSummary() {
    const { data } = await api.get<BiosChangeAuditSummary>('/bios-change-audit/summary')
    return data
  },
  async getBiosHistoryById(biosId: string) {
    const { data } = await api.get<{ data: { bios_id: string; events: BiosHistoryEntry[] } }>(`/bios-history/${biosId}`)
    return data
  },
  async getIpAnalytics(params: { page?: number; per_page?: number; search?: string; reputation?: 'all' | 'safe' | 'proxy'; from?: string; to?: string; country?: string; program_id?: number }) {
    const { data } = await api.get<{ data: IpAnalyticsEntry[]; meta: { page: number; per_page: number; total: number; last_page: number; has_next_page: boolean; next_page: number | null } }>('/ip-analytics', { params })
    return data
  },
  async getIpStats() {
    const { data } = await api.get<{ data: IpAnalyticsStats }>('/ip-analytics/stats')
    return data
  },
  async getLogs(params?: LogFilters) {
    const { data } = await api.get<PaginatedResponse<ManagerParentLogEntry>>('/logs', { params })
    return data
  },
  async getLogById(id: number) {
    const { data } = await api.get<{ data: ManagerParentLogEntry }>(`/logs/${id}`)
    return data
  },
  async getApiStatus(programId?: number) {
    const { data } = await api.get<{ data: ManagerParentApiStatus }>('/api-status', {
      params: { program_id: programId },
    })
    return data
  },
  async pingApiStatus(programId?: number) {
    const { data } = await api.post<{ data: ManagerParentApiStatus }>('/api-status/ping', null, {
      params: { program_id: programId },
    })
    return data
  },
  async getApiStatusHistory() {
    const { data } = await api.get<{ data: ApiStatusHistoryPoint[] }>('/api-status/history')
    return data
  },
  async getBiosConflicts(params?: BiosConflictFilters) {
    const { data } = await api.get<PaginatedResponse<BiosConflictItem> & { status_counts: { all: number; open: number; resolved: number } }>('/bios-conflicts', { params })
    return data
  },
  async resolveBiosConflict(id: number, payload: { resolution_notes: string }) {
    const { data } = await api.put<{ data: BiosConflictItem }>(`/bios-conflicts/${id}/resolve`, payload)
    return data
  },
  async getUsernameManagement(params?: { page?: number; per_page?: number; role?: string; locked?: boolean | ''; search?: string }) {
    const { data } = await api.get<PaginatedResponse<UsernameManagedUser>>('/username-management', { params })
    return data
  },
  async unlockUsername(id: number, reason?: string) {
    const { data } = await api.post<{ data: UsernameManagedUser }>(`/username-management/${id}/unlock`, { reason })
    return data
  },
  async changeUsername(id: number, username: string, reason?: string) {
    const { data } = await api.put<{ data: UsernameManagedUser }>(`/username-management/${id}/username`, { username, reason })
    return data
  },
  async resetPassword(id: number, password?: string, revokeTokens = true) {
    const { data } = await api.post<{ message: string; temporary_password: string }>(`/username-management/${id}/reset-password`, {
      password,
      revoke_tokens: revokeTokens,
    })
    return data
  },
  async getFinancialReports(params?: { from?: string; to?: string }) {
    const paramKey = JSON.stringify(params)
    const cacheKey = `manager-parent:reports:financial:${paramKey}`
    const cached = apiCache.get<{ data: FinancialReportData }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: FinancialReportData }>('/financial-reports', { params })
    apiCache.set(cacheKey, data, CACHE_TTL.REPORT)
    return data
  },
  async getTeamNetwork() {
    const { data } = await api.get<{ data: NetworkDiagramPayload }>('/team/network')
    return data
  },
  async getProgramsWithExternalApi() {
    const { data } = await api.get<PaginatedResponse<ProgramSummary>>('/programs', { params: { per_page: 100, status: 'active' } })
    return data.data.filter((program) => program.has_external_api)
  },
  async getTeamMember(id: number) {
      const { data } = await api.get<{ data: TeamMemberDetail }>(`/team/${id}`)
      return data
    },
    async getCustomerLicenseHistory(id: number) {
      const { data } = await api.get<{ data: CustomerLicenseHistoryEntry[] }>(`/customers/${id}/license-history`)
      return data
    },
    async getCustomerBiosChangeHistory(id: number) {
      const { data } = await api.get<{ data: Array<{ id: number; old_bios_id: string; new_bios_id: string; reason: string; status: string; requested_by: string | null; reviewed_by: string | null; created_at: string; reviewed_at: string | null }> }>(`/customers/${id}/bios-change-history`)
      return data
    },
  async submitBiosChangeRequest(payload: SubmitBiosChangeRequestData) {
    const { data } = await api.post<{ data: unknown; message: string }>('/bios-change-requests', payload)
    return data
  },
  async directChangeBiosId(licenseId: number, newBiosId: string) {
    const { data } = await api.post<{ success: boolean; message: string }>('/bios-change-requests/direct', { license_id: licenseId, new_bios_id: newBiosId })
    return data
  },
  async getBiosChangeRequests(params?: { page?: number; per_page?: number; status?: '' | 'pending' | 'approved' | 'rejected'; count_only?: boolean }) {
    const { data } = await api.get<PaginatedResponse<ManagerParentBiosChangeRequest>>('/bios-change-requests', { params })
    return data
  },
  async getPendingBiosChangeRequestCount() {
    const { data } = await api.get<{ count: number }>('/bios-change-requests', { params: { status: 'pending', count_only: true } })
    return data
  },
  async approveBiosChangeRequest(id: number) {
    const { data } = await api.put<{ data: ManagerParentBiosChangeRequest; message: string }>(`/bios-change-requests/${id}/approve`)
    return data
  },
  async rejectBiosChangeRequest(id: number, reviewerNotes: string) {
    const { data } = await api.put<{ data: ManagerParentBiosChangeRequest; message: string }>(`/bios-change-requests/${id}/reject`, { reviewer_notes: reviewerNotes })
    return data
  },
  async getResellerPayments(filters?: ResellerPaymentFilters) {
    const { data } = await api.get<ResellerPaymentListData>('/reseller-payments', { params: filters })
    return data
  },
  async getResellerPaymentDetail(resellerId: number) {
    const { data } = await api.get<{ data: ResellerPaymentDetailData }>(`/reseller-payments/${resellerId}`)
    return data
  },
  async recordPayment(payload: RecordPaymentPayload) {
    const { data } = await api.post<{ data: unknown; message: string }>('/reseller-payments', payload)
    return data
  },
  async updatePayment(paymentId: number, payload: RecordPaymentPayload) {
    const { data } = await api.put<{ data: unknown; message: string }>(`/reseller-payments/${paymentId}`, payload)
    return data
  },
  async storeCommission(payload: StoreCommissionPayload) {
    const { data } = await api.post<{ data: unknown; message: string }>('/reseller-commissions', payload)
    return data
  },
  async getProgramLogs(programId: number, params?: { page?: number; per_page?: number; seller_id?: number | ''; action?: string }): Promise<{ raw: string; rows?: ProgramLog[]; user_rows?: ProgramUserLogEntry[]; users?: ProgramLogUserOption[]; summary?: ProgramLogSummary; external_available?: boolean; meta?: { page: number; per_page: number; total: number; last_page: number; has_next_page: boolean; next_page: number | null } }> {
    const { data } = await api.get<{ data: { raw: string; rows?: ProgramLog[]; user_rows?: ProgramUserLogEntry[]; users?: ProgramLogUserOption[]; summary?: ProgramLogSummary; external_available?: boolean; meta?: { page: number; per_page: number; total: number; last_page: number; has_next_page: boolean; next_page: number | null } } }>(`/manager-parent/programs/${programId}/logs`, { params })
    return data.data
  },
  async getSellerLogs(params?: { page?: number; per_page?: number; seller_id?: number | ''; action?: string; from?: string; to?: string }) {
    const { data } = await api.get<{ data: SellerLogEntry[]; summary: SellerLogSummary; meta: { page: number; per_page: number; total: number; last_page: number; has_next_page: boolean; next_page: number | null } }>('/reseller-logs', { params })
    return data
  },
  async getLicenses(params?: LicenseFilters & { reseller_id?: number | '' }) {
    const { data } = await api.get<PaginatedResponse<LicenseSummary>>('/licenses', { params })
    return data
  },
  async deleteLicense(id: number) {
    const { data } = await api.delete<{ message: string }>(`/licenses/${id}`)
    return data
  },
  async getLicensesExpiring() {
    const { data } = await api.get<{ data: { day1: number; day3: number; day7: number; expired: number } }>('/licenses/expiring')
    return data
  },
  async getProgramActiveUsers(programId: number): Promise<{ users: Record<string, string> }> {
    const { data } = await api.get<{ data: { users: Record<string, string> } }>(`/manager-parent/programs/${programId}/active-users`)
    return data.data
  },
  async getProgramStats(programId: number): Promise<{ count: number }> {
    const { data } = await api.get<{ data: { count: number } }>(`/manager-parent/programs/${programId}/stats`)
    return data.data
  },
  async getOnlineUsers() {
    const { data } = await api.get<{ data: Array<{ masked_name: string; role: string }> }>('/online-users')
    return data
  },
  async exportFinancialCsv(params?: { from?: string; to?: string }) {
    await downloadFile('/financial-reports/export/csv', 'manager-parent-financial.csv', params)
  },
  async exportFinancialPdf(params?: { from?: string; to?: string }) {
    await downloadFile('/financial-reports/export/pdf', 'manager-parent-financial.pdf', params)
  },
}
