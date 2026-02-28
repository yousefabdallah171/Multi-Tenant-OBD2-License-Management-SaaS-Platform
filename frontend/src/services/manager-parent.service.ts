import { api } from '@/services/api'
import type {
  BiosHistoryEntry,
  FinancialReportData,
  IpAnalyticsEntry,
  IpAnalyticsStats,
  ManagerParentDashboardStats,
  PaginatedResponse,
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
  async exportFinancialCsv(params?: { from?: string; to?: string }) {
    await downloadFile('/financial-reports/export/csv', 'manager-parent-financial.csv', params)
  },
  async exportFinancialPdf(params?: { from?: string; to?: string }) {
    await downloadFile('/financial-reports/export/pdf', 'manager-parent-financial.pdf', params)
  },
}
