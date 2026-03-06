import { api } from '@/services/api'
import type { PaginatedResponse } from '@/types/manager-parent.types'
import type {
  DashboardSeriesPoint,
  ReportRangeFilters,
  ResellerCustomerDetails,
  ResellerCustomerFilters,
  ResellerCustomerSummary,
  ResellerDashboardStats,
  ResellerReportFilters,
  ResellerReportPoint,
  ResellerSoftwareProgram,
  RoleActivityEntry,
  RoleActivityFilters,
  TopProgramRow,
} from '@/types/manager-reseller.types'
import { downloadFile } from '@/utils/download'

export const resellerService = {
  async getDashboardStats() {
    const { data } = await api.get<{ stats: ResellerDashboardStats }>('/reseller/dashboard/stats')
    return data
  },
  async getActivationsChart() {
    const { data } = await api.get<{ data: DashboardSeriesPoint[] }>('/reseller/dashboard/activations-chart')
    return data
  },
  async getRevenueChart() {
    const { data } = await api.get<{ data: DashboardSeriesPoint[] }>('/reseller/dashboard/revenue-chart')
    return data
  },
  async getRecentActivity() {
    const { data } = await api.get<{ data: RoleActivityEntry[] }>('/reseller/dashboard/recent-activity')
    return data
  },
  async getCustomers(params: ResellerCustomerFilters) {
    const { data } = await api.get<PaginatedResponse<ResellerCustomerSummary>>('/reseller/customers', { params })
    return data
  },
  async createCustomer(payload: { name: string; client_name?: string; email?: string; phone?: string; bios_id?: string; program_id?: number }) {
    const { data } = await api.post<{ data: ResellerCustomerSummary }>('/reseller/customers', payload)
    return data
  },
  async getCustomer(id: number) {
    const { data } = await api.get<{ data: ResellerCustomerDetails }>(`/reseller/customers/${id}`)
    return data
  },
  async updateCustomer(id: number, payload: { client_name: string }) {
    const { data } = await api.put<{ data: ResellerCustomerSummary }>(`/reseller/customers/${id}`, payload)
    return data
  },
  async deleteCustomer(id: number) {
    const { data } = await api.delete<{ message: string }>(`/reseller/customers/${id}`)
    return data
  },
  async getSoftware() {
    const { data } = await api.get<{ data: ResellerSoftwareProgram[] }>('/reseller/software')
    return data
  },
  async getRevenueReport(params: ResellerReportFilters) {
    const { data } = await api.get<{ data: ResellerReportPoint[] }>('/reseller/reports/revenue', { params })
    return data
  },
  async getActivationsReport(params: ResellerReportFilters) {
    const { data } = await api.get<{ data: ResellerReportPoint[] }>('/reseller/reports/activations', { params })
    return data
  },
  async getTopPrograms(params: ReportRangeFilters) {
    const { data } = await api.get<{ data: TopProgramRow[] }>('/reseller/reports/top-programs', { params })
    return data
  },
  async getActivity(params: RoleActivityFilters) {
    const { data } = await api.get<PaginatedResponse<RoleActivityEntry>>('/reseller/activity', { params })
    return data
  },
  async exportCsv(params: ResellerReportFilters) {
    await downloadFile('/reseller/reports/export/csv', 'reseller-report.csv', params)
  },
  async exportPdf(params: ResellerReportFilters) {
    await downloadFile('/reseller/reports/export/pdf', 'reseller-report.pdf', params)
  },
}
