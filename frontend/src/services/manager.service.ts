import { api } from '@/services/api'
import type { PaginatedResponse } from '@/types/manager-parent.types'
import type {
  ActivateManagerSoftwareData,
  CreateManagerSoftwareData,
  DashboardSeriesPoint,
  ManagerActivationPoint,
  ManagerCustomerDetails,
  ManagerCustomerFilters,
  ManagerCustomerSummary,
  ManagerDashboardStats,
  ManagerRevenueRow,
  ManagerSoftwareFilters,
  ManagerSoftwareProgram,
  ManagerTeamFilters,
  ManagerTeamReseller,
  ManagerTeamResellerDetail,
  ManagerTopResellerRow,
  ReportRangeFilters,
  RoleActivityEntry,
  RoleActivityFilters,
  TeamManagedUser,
  TeamManagedUserFilters,
  UpdateManagerSoftwareData,
} from '@/types/manager-reseller.types'
import type { LicenseFilters, LicenseSummary } from '@/types/manager-reseller.types'
import { downloadFile } from '@/utils/download'

export const managerService = {
  async getDashboardStats() {
    const { data } = await api.get<{ stats: ManagerDashboardStats }>('/manager/dashboard/stats')
    return data
  },
  async getActivationsChart() {
    const { data } = await api.get<{ data: DashboardSeriesPoint[] }>('/manager/dashboard/activations-chart')
    return data
  },
  async getRevenueChart() {
    const { data } = await api.get<{ data: DashboardSeriesPoint[] }>('/manager/dashboard/revenue-chart')
    return data
  },
  async getRecentActivity() {
    const { data } = await api.get<{ data: RoleActivityEntry[] }>('/manager/dashboard/recent-activity')
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
  async resetPassword(id: number, password?: string) {
    const { data } = await api.post<{ message: string; temporary_password: string }>(`/manager/username-management/${id}/reset-password`, { password })
    return data
  },
  async getCustomers(params: ManagerCustomerFilters) {
    const { data } = await api.get<PaginatedResponse<ManagerCustomerSummary>>('/manager/customers', { params })
    return data
  },
  async getCustomer(id: number) {
    const { data } = await api.get<{ data: ManagerCustomerDetails }>(`/manager/customers/${id}`)
    return data
  },
  async getLicenses(params?: LicenseFilters) {
    const { data } = await api.get<PaginatedResponse<LicenseSummary>>('/manager/licenses', { params })
    return data
  },
  async getLicensesExpiring() {
    const { data } = await api.get<{ data: { day1: number; day3: number; day7: number } }>('/manager/licenses/expiring')
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
  async getRevenueReport(params: ReportRangeFilters) {
    const { data } = await api.get<{ data: ManagerRevenueRow[] }>('/manager/reports/revenue', { params })
    return data
  },
  async getActivationsReport(params: ReportRangeFilters) {
    const { data } = await api.get<{ data: ManagerActivationPoint[] }>('/manager/reports/activations', { params })
    return data
  },
  async getTopResellers(params: ReportRangeFilters) {
    const { data } = await api.get<{ data: ManagerTopResellerRow[] }>('/manager/reports/top-resellers', { params })
    return data
  },
  async exportCsv(params: ReportRangeFilters) {
    await downloadFile('/manager/reports/export/csv', 'manager-team-report.csv', params)
  },
  async exportPdf(params: ReportRangeFilters) {
    await downloadFile('/manager/reports/export/pdf', 'manager-team-report.pdf', params)
  },
  async getActivity(params: RoleActivityFilters) {
    const { data } = await api.get<PaginatedResponse<RoleActivityEntry>>('/manager/activity', { params })
    return data
  },
  async getOnlineUsers() {
    const { data } = await api.get<{ data: Array<{ masked_name: string; role: string }> }>('/manager/online-users')
    return data
  },
}
