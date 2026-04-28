import { api } from '@/services/api'
import { apiCache } from '@/lib/apiCache'
import type { IpAnalyticsEntry, PaginatedResponse } from '@/types/manager-parent.types'
import type {
  BiosChangeHistoryItem,
  DashboardSeriesPoint,
  ReportRangeFilters,
  ResellerCustomerDetails,
  ResellerCustomerFilters,
  ResellerCustomerSummary,
  ResellerDashboardStats,
  ResellerReportFilters,
  ResellerReportPoint,
  ResellerReportSummary,
  ResellerSoftwareProgram,
  RoleActivityEntry,
  SubmitBiosChangeRequestData,
  TopProgramRow,
  ResellerPaymentStatusData,
  ResellerSellerLogEntry,
  ResellerSellerLogSummary,
} from '@/types/manager-reseller.types'
import { downloadFile } from '@/utils/download'

/**
 * Cache TTL values (in milliseconds)
 */
const CACHE_TTL = {
  STATS: 45 * 1000, // 45 seconds
  CHART: 30 * 1000, // 30 seconds
  ACTIVITY: 60 * 1000, // 60 seconds
  REPORT: 90 * 1000, // 90 seconds
  CUSTOMERS: 60 * 1000, // 60 seconds
}

export const resellerService = {
  async getDashboardStats() {
    const cacheKey = 'reseller:dashboard:stats'
    const cached = apiCache.get<{ stats: ResellerDashboardStats }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ stats: ResellerDashboardStats }>('/reseller/dashboard/stats')
    apiCache.set(cacheKey, data, CACHE_TTL.STATS)
    return data
  },
  async getActivationsChart() {
    const cacheKey = 'reseller:dashboard:activations-chart'
    const cached = apiCache.get<{ data: DashboardSeriesPoint[] }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: DashboardSeriesPoint[] }>('/reseller/dashboard/activations-chart')
    apiCache.set(cacheKey, data, CACHE_TTL.CHART)
    return data
  },
  async getRevenueChart() {
    const cacheKey = 'reseller:dashboard:revenue-chart'
    const cached = apiCache.get<{ data: DashboardSeriesPoint[] }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: DashboardSeriesPoint[] }>('/reseller/dashboard/revenue-chart')
    apiCache.set(cacheKey, data, CACHE_TTL.CHART)
    return data
  },
  async getRecentActivity() {
    const cacheKey = 'reseller:dashboard:recent-activity'
    const cached = apiCache.get<{ data: RoleActivityEntry[] }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: RoleActivityEntry[] }>('/reseller/dashboard/recent-activity')
    apiCache.set(cacheKey, data, CACHE_TTL.ACTIVITY)
    return data
  },
  async getCustomers(params: ResellerCustomerFilters) {
    const { data } = await api.get<PaginatedResponse<ResellerCustomerSummary>>('/reseller/customers', { params })
    return data
  },
  async getCustomerCountries(params: Omit<ResellerCustomerFilters, 'page' | 'per_page' | 'country_name'>) {
    const { data } = await api.get<{ data: Array<{ country_name: string; count: number }> }>('/reseller/customers/countries', { params })
    return data
  },
  async exportCustomersXlsx(params: ResellerCustomerFilters) {
    await downloadFile('/reseller/customers/export/csv', 'reseller-customers.xlsx', params)
  },
  async exportCustomersPdf(params: ResellerCustomerFilters) {
    await downloadFile('/reseller/customers/export/pdf', 'reseller-customers.pdf', params)
  },
  async createCustomer(payload: { name: string; client_name?: string; email?: string; phone?: string; country_name?: string; bios_id?: string; program_id?: number }) {
    const { data } = await api.post<{ data: ResellerCustomerSummary }>('/reseller/customers', payload)
    // Invalidate dashboard cache after mutation
    apiCache.clearPattern(/^reseller:dashboard:/)
    apiCache.clearPattern(/^reseller:reports:/)
    return data
  },
  async getCustomer(id: number) {
    const { data } = await api.get<{ data: ResellerCustomerDetails }>(`/reseller/customers/${id}`)
    return data
  },
  async getCustomerBiosChangeHistory(id: number) {
    const { data } = await api.get<{ data: BiosChangeHistoryItem[] }>(`/reseller/customers/${id}/bios-change-history`)
    return data
  },
  async submitBiosChangeRequest(payload: SubmitBiosChangeRequestData) {
    const { data } = await api.post<{ data: unknown; message: string }>('/reseller/bios-change-requests', payload)
    return data
  },
  async getPaymentStatus() {
    const { data } = await api.get<{ data: ResellerPaymentStatusData }>('/reseller/payment-status')
    return data
  },
  async updateCustomer(id: number, payload: { client_name: string; email?: string; phone?: string }) {
    const { data } = await api.put<{ data: ResellerCustomerSummary }>(`/reseller/customers/${id}`, payload)
    // Invalidate cache after mutation
    apiCache.clearPattern(/^reseller:dashboard:/)
    apiCache.clearPattern(/^reseller:reports:/)
    return data
  },
  async deleteCustomer(id: number) {
    const { data } = await api.delete<{ message: string }>(`/reseller/customers/${id}`)
    // Invalidate cache after mutation
    apiCache.clearPattern(/^reseller:dashboard:/)
    apiCache.clearPattern(/^reseller:reports:/)
    return data
  },
  async getSoftware() {
    const { data } = await api.get<{ data: ResellerSoftwareProgram[] }>('/reseller/software')
    return data
  },
  async getRevenueReport(params: ResellerReportFilters) {
    const paramKey = JSON.stringify(params)
    const cacheKey = `reseller:reports:revenue:${paramKey}`
    const cached = apiCache.get<{ data: ResellerReportPoint[] }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: ResellerReportPoint[] }>('/reseller/reports/revenue', { params })
    apiCache.set(cacheKey, data, CACHE_TTL.REPORT)
    return data
  },
  async getReportSummary(params: ResellerReportFilters) {
    const paramKey = JSON.stringify(params)
    const cacheKey = `reseller:reports:summary:${paramKey}`
    const cached = apiCache.get<{ data: ResellerReportSummary }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: ResellerReportSummary }>('/reseller/reports/summary', { params })
    apiCache.set(cacheKey, data, CACHE_TTL.REPORT)
    return data
  },
  async getActivationsReport(params: ResellerReportFilters) {
    const paramKey = JSON.stringify(params)
    const cacheKey = `reseller:reports:activations:${paramKey}`
    const cached = apiCache.get<{ data: ResellerReportPoint[] }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: ResellerReportPoint[] }>('/reseller/reports/activations', { params })
    apiCache.set(cacheKey, data, CACHE_TTL.REPORT)
    return data
  },
  async getTopPrograms(params: ReportRangeFilters) {
    const paramKey = JSON.stringify(params)
    const cacheKey = `reseller:reports:top-programs:${paramKey}`
    const cached = apiCache.get<{ data: TopProgramRow[] }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: TopProgramRow[] }>('/reseller/reports/top-programs', { params })
    apiCache.set(cacheKey, data, CACHE_TTL.REPORT)
    return data
  },
  async getSellerLogs(params?: { page?: number; per_page?: number; action?: string; from?: string; to?: string }) {
    const { data } = await api.get<{ data: ResellerSellerLogEntry[]; summary: ResellerSellerLogSummary; meta: { page: number; per_page: number; total: number; last_page: number; has_next_page: boolean; next_page: number | null } }>('/reseller/reseller-logs', { params })
    return data
  },
  async getIpAnalytics(params: { page?: number; per_page?: number; search?: string; reputation?: 'all' | 'safe' | 'proxy'; from?: string; to?: string; country?: string; program_id?: number }) {
    const { data } = await api.get<{ data: IpAnalyticsEntry[]; meta: { page: number; per_page: number; total: number; last_page: number; has_next_page: boolean; next_page: number | null } }>('/reseller/ip-analytics', { params })
    return data
  },
  async exportCsv(params: ResellerReportFilters) {
    await downloadFile('/reseller/reports/export/csv', 'reseller-report.xlsx', params)
  },
  async exportPdf(params: ResellerReportFilters) {
    await downloadFile('/reseller/reports/export/pdf', 'reseller-report.pdf', params)
  },
}
