import { api } from '@/services/api'
import type {
  ApiStatusHistoryPoint,
  BiosConflictFilters,
  BiosConflictItem,
  BiosHistoryEntry,
  FinancialReportData,
  IpAnalyticsEntry,
  IpAnalyticsStats,
  LogFilters,
  ManagerParentApiStatus,
  ManagerParentDashboardStats,
  ManagerParentLogEntry,
  PaginatedResponse,
  ProgramLogLicenseInfo,
  ProgramSummary,
  TenantSettings,
  UsernameManagedUser,
} from '@/types/manager-parent.types'
import { downloadFile } from '@/utils/download'

export const managerParentService = {
  async getDashboardStats() {
    const { data } = await api.get<{ stats: ManagerParentDashboardStats }>('/dashboard/stats')
    return data
  },
  async getRevenueChart() {
    const { data } = await api.get<{ data: Array<{ month: string; revenue: number }> }>('/dashboard/revenue-chart')
    return data
  },
  async getExpiryForecast() {
    const { data } = await api.get<{ data: Array<{ range: string; count: number }> }>('/dashboard/expiry-forecast')
    return data
  },
  async getTeamPerformance() {
    const { data } = await api.get<{ data: Array<{ id: number; name: string; role: string; activations: number; revenue: number; customers: number }> }>('/dashboard/team-performance')
    return data
  },
  async getConflictRate() {
    const { data } = await api.get<{ data: Array<{ month: string; count: number }> }>('/dashboard/conflict-rate')
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
    return data
  },
  async getBiosHistory(params?: { page?: number; per_page?: number; bios_id?: string; action?: string; reseller_id?: number | ''; from?: string; to?: string }) {
    const { data } = await api.get<PaginatedResponse<BiosHistoryEntry>>('/bios-history', { params })
    return data
  },
  async getBiosHistoryById(biosId: string) {
    const { data } = await api.get<{ data: { bios_id: string; events: BiosHistoryEntry[] } }>(`/bios-history/${biosId}`)
    return data
  },
  async getIpAnalytics(params?: { page?: number; per_page?: number; user_id?: number | ''; country?: string; reputation_score?: string; from?: string; to?: string }) {
    const { data } = await api.get<PaginatedResponse<IpAnalyticsEntry>>('/ip-analytics', { params })
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
    const { data } = await api.get<PaginatedResponse<BiosConflictItem>>('/bios-conflicts', { params })
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
  async resetPassword(id: number, password?: string) {
    const { data } = await api.post<{ message: string; temporary_password: string }>(`/username-management/${id}/reset-password`, { password })
    return data
  },
  async getFinancialReports(params?: { from?: string; to?: string }) {
    const { data } = await api.get<{ data: FinancialReportData }>('/financial-reports', { params })
    return data
  },
  async getProgramsWithExternalApi() {
    const { data } = await api.get<PaginatedResponse<ProgramSummary>>('/programs', { params: { per_page: 100, status: 'active' } })
    return data.data.filter((program) => program.has_external_api)
  },
  async getProgramLogs(programId: number): Promise<{ raw: string; licenses?: Record<string, ProgramLogLicenseInfo[]> }> {
    const { data } = await api.get<{ data: { raw: string; licenses?: Record<string, ProgramLogLicenseInfo[]> } }>(`/manager-parent/programs/${programId}/logs`)
    return data.data
  },
  async getProgramActiveUsers(programId: number): Promise<{ users: Record<string, string> }> {
    const { data } = await api.get<{ data: { users: Record<string, string> } }>(`/manager-parent/programs/${programId}/active-users`)
    return data.data
  },
  async getProgramStats(programId: number): Promise<{ count: number }> {
    const { data } = await api.get<{ data: { count: number } }>(`/manager-parent/programs/${programId}/stats`)
    return data.data
  },
  async exportFinancialCsv(params?: { from?: string; to?: string }) {
    await downloadFile('/financial-reports/export/csv', 'manager-parent-financial.csv', params)
  },
  async exportFinancialPdf(params?: { from?: string; to?: string }) {
    await downloadFile('/financial-reports/export/pdf', 'manager-parent-financial.pdf', params)
  },
}
