import { api } from '@/services/api'
import { apiCache } from '@/lib/apiCache'
import type { FinancialReportData, PaginatedResponse } from '@/types/manager-parent.types'
import type {
  ActivateManagerSoftwareData,
  CreateManagerSoftwareData,
  DashboardSeriesPoint,
  ManagerCustomerDetails,
  ManagerCustomerFilters,
  ManagerDashboardPayload,
  ManagerCustomerSummary,
  ManagerDashboardStats,
  ManagerSoftwareFilters,
  ManagerSoftwareProgram,
  ManagerSellerLogEntry,
  ManagerSellerLogSummary,
  ManagerTeamFilters,
  ManagerTeamPayload,
  ManagerTeamReseller,
  ManagerTeamResellerDetail,
  ReportRangeFilters,
  RoleActivityEntry,
  RoleActivityFilters,
  TeamManagedUser,
  TeamManagedUserFilters,
  UpdateManagerSoftwareData,
} from '@/types/manager-reseller.types'
import type { LicenseFilters, LicenseSummary } from '@/types/manager-reseller.types'
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

export const managerService = {
  async getDashboard() {
    const { data } = await api.get<ManagerDashboardPayload>('/manager/dashboard')
    return data
  },
  async getDashboardStats() {
    const cacheKey = 'manager:dashboard:stats'
    const cached = apiCache.get<{ stats: ManagerDashboardStats }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ stats: ManagerDashboardStats }>('/manager/dashboard/stats')
    apiCache.set(cacheKey, data, CACHE_TTL.STATS)
    return data
  },
  async getActivationsChart() {
    const cacheKey = 'manager:dashboard:activations-chart'
    const cached = apiCache.get<{ data: DashboardSeriesPoint[] }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: DashboardSeriesPoint[] }>('/manager/dashboard/activations-chart')
    apiCache.set(cacheKey, data, CACHE_TTL.CHART)
    return data
  },
  async getRevenueChart() {
    const cacheKey = 'manager:dashboard:revenue-chart'
    const cached = apiCache.get<{ data: DashboardSeriesPoint[] }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: DashboardSeriesPoint[] }>('/manager/dashboard/revenue-chart')
    apiCache.set(cacheKey, data, CACHE_TTL.CHART)
    return data
  },
  async getRecentActivity() {
    const cacheKey = 'manager:dashboard:recent-activity'
    const cached = apiCache.get<{ data: RoleActivityEntry[] }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: RoleActivityEntry[] }>('/manager/dashboard/recent-activity')
    apiCache.set(cacheKey, data, CACHE_TTL.ACTIVITY)
    return data
  },
  async getTeam(params: ManagerTeamFilters) {
    const { data } = await api.get<PaginatedResponse<ManagerTeamReseller>>('/manager/team', { params })
    return data
  },
  async getTeamMember(id: number) {
    const { data } = await api.get<{ data: ManagerTeamResellerDetail }>(`/manager/team/${id}`)
    return data
  },
  async createTeamMember(payload: ManagerTeamPayload) {
    const { data } = await api.post<{ data: ManagerTeamReseller }>('/manager/team', payload)
    return data
  },
  async updateTeamMember(id: number, payload: Partial<Omit<ManagerTeamPayload, 'password'>>) {
    const { data } = await api.put<{ data: ManagerTeamReseller }>(`/manager/team/${id}`, payload)
    return data
  },
  async updateTeamMemberStatus(id: number, status: 'active' | 'suspended' | 'inactive') {
    const { data } = await api.put<{ data: ManagerTeamReseller }>(`/manager/team/${id}/status`, { status })
    return data
  },
  async deleteTeamMember(id: number) {
    const { data } = await api.delete<{ message: string }>(`/manager/team/${id}`)
    return data
  },
  async getUsernameManagement(params: TeamManagedUserFilters) {
    const { data } = await api.get<PaginatedResponse<TeamManagedUser>>('/manager/username-management', { params })
    return data
  },
  async unlockUsername(id: number, reason?: string) {
    const { data } = await api.post<{ data: TeamManagedUser }>(`/manager/username-management/${id}/unlock`, { reason })
    return data
  },
  async changeUsername(id: number, username: string, reason?: string) {
    const { data } = await api.put<{ data: TeamManagedUser }>(`/manager/username-management/${id}/username`, { username, reason })
    return data
  },
  async resetPassword(id: number, password?: string, revokeTokens = true) {
    const { data } = await api.post<{ message: string; temporary_password: string }>(`/manager/username-management/${id}/reset-password`, {
      password,
      revoke_tokens: revokeTokens,
    })
    return data
  },
  async getCustomers(params: ManagerCustomerFilters) {
    const { data } = await api.get<PaginatedResponse<ManagerCustomerSummary>>('/manager/customers', { params })
    return data
  },
  async createCustomer(payload: { name: string; client_name?: string; email?: string; phone?: string; bios_id?: string; program_id?: number }) {
    const { data } = await api.post<{ data: ManagerCustomerSummary }>('/manager/customers', payload)
    // Invalidate cache after mutation
    apiCache.clearPattern(/^manager:dashboard:/)
    apiCache.clearPattern(/^manager:reports:/)
    return data
  },
  async getCustomer(id: number) {
    const { data } = await api.get<{ data: ManagerCustomerDetails }>(`/manager/customers/${id}`)
    return data
  },
  async updateCustomer(id: number, payload: { client_name: string; email?: string; phone?: string }) {
    const { data } = await api.put<{ data: ManagerCustomerSummary }>(`/manager/customers/${id}`, payload)
    // Invalidate cache after mutation
    apiCache.clearPattern(/^manager:dashboard:/)
    apiCache.clearPattern(/^manager:reports:/)
    return data
  },
  async deleteCustomer(id: number) {
    const { data } = await api.delete<{ message: string }>(`/manager/customers/${id}`)
    // Invalidate cache after mutation
    apiCache.clearPattern(/^manager:dashboard:/)
    apiCache.clearPattern(/^manager:reports:/)
    return data
  },
  async getLicenses(params?: LicenseFilters) {
    const { data } = await api.get<PaginatedResponse<LicenseSummary>>('/manager/licenses', { params })
    return data
  },
  async getLicensesExpiring() {
    const { data } = await api.get<{ data: { day1: number; day3: number; day7: number; expired: number } }>('/manager/licenses/expiring')
    return data
  },
  async getSoftwarePrograms(params?: ManagerSoftwareFilters) {
    const { data } = await api.get<PaginatedResponse<ManagerSoftwareProgram>>('/manager/software', { params })
    return data
  },
  async createProgram(payload: CreateManagerSoftwareData) {
    const { data } = await api.post<{ data: ManagerSoftwareProgram }>('/manager/software', payload)
    return data
  },
  async updateProgram(id: number, payload: UpdateManagerSoftwareData) {
    const { data } = await api.put<{ data: ManagerSoftwareProgram }>(`/manager/software/${id}`, payload)
    return data
  },
  async deleteProgram(id: number) {
    const { data } = await api.delete<{ message: string }>(`/manager/software/${id}`)
    return data
  },
  async activateProgram(id: number, payload: ActivateManagerSoftwareData) {
    const { data } = await api.post<{ data: ManagerSoftwareProgram }>(`/manager/software/${id}/activate`, payload)
    return data
  },
  async getFinancialReports(params: ReportRangeFilters) {
    const paramKey = JSON.stringify(params)
    const cacheKey = `manager:reports:financial:${paramKey}`
    const cached = apiCache.get<{ data: FinancialReportData }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: FinancialReportData }>('/manager/reports/financial', { params })
    apiCache.set(cacheKey, data, CACHE_TTL.REPORT)
    return data
  },
  async getActivationRate(params: ReportRangeFilters) {
    const paramKey = JSON.stringify(params)
    const cacheKey = `manager:reports:activation-rate:${paramKey}`
    const cached = apiCache.get<{ data: Array<{ label: string; count: number; percentage: number }> }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: Array<{ label: string; count: number; percentage: number }> }>('/manager/reports/activation-rate', { params })
    apiCache.set(cacheKey, data, CACHE_TTL.REPORT)
    return data
  },
  async getRetention(params: ReportRangeFilters) {
    const paramKey = JSON.stringify(params)
    const cacheKey = `manager:reports:retention:${paramKey}`
    const cached = apiCache.get<{ data: Array<{ month: string; customers: number; activations: number }> }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: Array<{ month: string; customers: number; activations: number }> }>('/manager/reports/retention', { params })
    apiCache.set(cacheKey, data, CACHE_TTL.REPORT)
    return data
  },
  async exportFinancialCsv(params: ReportRangeFilters) {
    await downloadFile('/manager/reports/export/csv', 'manager-tenant-financial.csv', params)
  },
  async exportFinancialPdf(params: ReportRangeFilters) {
    await downloadFile('/manager/reports/export/pdf', 'manager-tenant-financial.pdf', params)
  },
  async exportCsv(params: ReportRangeFilters) {
    await managerService.exportFinancialCsv(params)
  },
  async exportPdf(params: ReportRangeFilters) {
    await managerService.exportFinancialPdf(params)
  },
  async getActivity(params: RoleActivityFilters) {
    const { data } = await api.get<PaginatedResponse<RoleActivityEntry>>('/manager/activity', { params })
    return data
  },
  async exportActivity(params: ReportRangeFilters) {
    await downloadFile('/manager/activity/export', 'manager-activity.csv', params)
  },
  async getSellerLogs(params?: { page?: number; per_page?: number; seller_id?: number | ''; action?: string; from?: string; to?: string }) {
    const { data } = await api.get<{ data: ManagerSellerLogEntry[]; summary: ManagerSellerLogSummary; meta: { page: number; per_page: number; total: number; last_page: number; has_next_page: boolean; next_page: number | null } }>('/manager/reseller-logs', { params })
    return data
  },
  async getOnlineUsers() {
    const { data } = await api.get<{ data: Array<{ masked_name: string; role: string }> }>('/manager/online-users')
    return data
  },
}
