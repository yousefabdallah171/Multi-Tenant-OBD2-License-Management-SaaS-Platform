import { api } from '@/services/api'
import type { PaginatedResponse } from '@/types/manager-parent.types'
import type {
  DashboardSeriesPoint,
  ManagerActivationPoint,
  ManagerCustomerDetails,
  ManagerCustomerFilters,
  ManagerCustomerSummary,
  ManagerDashboardStats,
  ManagerRevenueRow,
  ManagerTeamFilters,
  ManagerTeamReseller,
  ManagerTeamResellerDetail,
  ManagerTopResellerRow,
  ReportRangeFilters,
  RoleActivityEntry,
  RoleActivityFilters,
  TeamManagedUser,
  TeamManagedUserFilters,
} from '@/types/manager-reseller.types'

async function downloadFile(url: string, filename: string, params?: object) {
  const response = await api.get<Blob>(url, {
    params,
    responseType: 'blob',
  })

  const blobUrl = window.URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(blobUrl)
}

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
}
