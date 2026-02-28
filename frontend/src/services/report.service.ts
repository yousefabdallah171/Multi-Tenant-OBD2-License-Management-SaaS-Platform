import { api } from '@/services/api'
import type { FinancialReportPayload, SuperAdminDashboardStats, TrendPoint } from '@/types/super-admin.types'

export interface RangeParams {
  from?: string
  to?: string
}

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

export const reportService = {
  async getDashboardStats() {
    const { data } = await api.get<{ data: { stats: SuperAdminDashboardStats } }>('/super-admin/dashboard/stats')
    return data
  },
  async getRevenueTrend() {
    const { data } = await api.get<{ data: TrendPoint[] }>('/super-admin/dashboard/revenue-trend')
    return data
  },
  async getTenantComparison() {
    const { data } = await api.get<{ data: Array<{ id: number; name: string; revenue: number; active_licenses: number }> }>('/super-admin/dashboard/tenant-comparison')
    return data
  },
  async getRecentActivity() {
    const { data } = await api.get<{ data: Array<{ id: number; action: string; description: string | null; user: string | null; tenant: string | null; created_at: string | null }> }>(
      '/super-admin/dashboard/recent-activity',
    )
    return data
  },
  async getRevenue(params: RangeParams) {
    const { data } = await api.get<{ data: Array<{ tenant: string; revenue: number }> }>('/super-admin/reports/revenue', { params })
    return data
  },
  async getActivations(params: RangeParams) {
    const { data } = await api.get<{ data: TrendPoint[] }>('/super-admin/reports/activations', { params })
    return data
  },
  async getGrowth(params: RangeParams) {
    const { data } = await api.get<{ data: TrendPoint[] }>('/super-admin/reports/growth', { params })
    return data
  },
  async getTopResellers(params: RangeParams) {
    const { data } = await api.get<{ data: Array<{ reseller: string; tenant: string; activations: number; revenue: number }> }>('/super-admin/reports/top-resellers', { params })
    return data
  },
  async exportCsv(params: RangeParams) {
    await downloadFile('/super-admin/reports/export/csv', 'super-admin-reports.csv', params)
  },
  async exportPdf(params: RangeParams) {
    await downloadFile('/super-admin/reports/export/pdf', 'super-admin-reports.pdf', params)
  },
  async getFinancialReports(params: RangeParams) {
    const { data } = await api.get<{ data: FinancialReportPayload }>('/super-admin/financial-reports', { params })
    return data
  },
  async exportFinancialCsv(params: RangeParams) {
    await downloadFile('/super-admin/financial-reports/export/csv', 'super-admin-financial.csv', params)
  },
  async exportFinancialPdf(params: RangeParams) {
    await downloadFile('/super-admin/financial-reports/export/pdf', 'super-admin-financial.pdf', params)
  },
}
