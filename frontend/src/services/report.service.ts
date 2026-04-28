import { api } from '@/services/api'
import { apiCache } from '@/lib/apiCache'
import type { FinancialReportPayload, SuperAdminDashboardStats, TrendPoint } from '@/types/super-admin.types'
import { downloadFile } from '@/utils/download'

export interface RangeParams {
  from?: string
  to?: string
}

const CACHE_TTL = {
  STATS: 60 * 1000,
  CHART: 60 * 1000,
  REPORT: 90 * 1000,
  FINANCIAL: 90 * 1000,
} as const

export const reportService = {
  async getDashboardStats() {
    const cacheKey = 'super-admin:dashboard:stats'
    const cached = apiCache.get<{ data: { stats: SuperAdminDashboardStats } }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: { stats: SuperAdminDashboardStats } }>('/super-admin/dashboard/stats')
    apiCache.set(cacheKey, data, CACHE_TTL.STATS)
    return data
  },
  async getRevenueTrend() {
    const cacheKey = 'super-admin:dashboard:revenue-trend'
    const cached = apiCache.get<{ data: TrendPoint[] }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: TrendPoint[] }>('/super-admin/dashboard/revenue-trend')
    apiCache.set(cacheKey, data, CACHE_TTL.CHART)
    return data
  },
  async getTenantComparison() {
    const cacheKey = 'super-admin:dashboard:tenant-comparison'
    const cached = apiCache.get<{ data: Array<{ id: number; name: string; revenue: number; active_licenses: number }> }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: Array<{ id: number; name: string; revenue: number; active_licenses: number }> }>('/super-admin/dashboard/tenant-comparison')
    apiCache.set(cacheKey, data, CACHE_TTL.CHART)
    return data
  },
  async getLicenseTimeline() {
    const cacheKey = 'super-admin:dashboard:license-timeline'
    const cached = apiCache.get<{ data: TrendPoint[] }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: TrendPoint[] }>('/super-admin/dashboard/license-timeline')
    apiCache.set(cacheKey, data, CACHE_TTL.CHART)
    return data
  },
  async getRecentActivity() {
    const cacheKey = 'super-admin:dashboard:recent-activity'
    const cached = apiCache.get<{ data: Array<{ id: number; action: string; description: string | null; user: string | null; tenant: string | null; metadata?: Record<string, unknown>; created_at: string | null }> }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: Array<{ id: number; action: string; description: string | null; user: string | null; tenant: string | null; metadata?: Record<string, unknown>; created_at: string | null }> }>(
      '/super-admin/dashboard/recent-activity',
    )
    apiCache.set(cacheKey, data, CACHE_TTL.CHART)
    return data
  },
  async getRevenue(params: RangeParams) {
    const paramKey = JSON.stringify(params)
    const cacheKey = `super-admin:reports:revenue:${paramKey}`
    const cached = apiCache.get<{ data: Array<{ tenant: string; revenue: number }> }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: Array<{ tenant: string; revenue: number }> }>('/super-admin/reports/revenue', { params })
    apiCache.set(cacheKey, data, CACHE_TTL.REPORT)
    return data
  },
  async getActivations(params: RangeParams) {
    const paramKey = JSON.stringify(params)
    const cacheKey = `super-admin:reports:activations:${paramKey}`
    const cached = apiCache.get<{ data: TrendPoint[] }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: TrendPoint[] }>('/super-admin/reports/activations', { params })
    apiCache.set(cacheKey, data, CACHE_TTL.REPORT)
    return data
  },
  async getGrowth(params: RangeParams) {
    const paramKey = JSON.stringify(params)
    const cacheKey = `super-admin:reports:growth:${paramKey}`
    const cached = apiCache.get<{ data: TrendPoint[] }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: TrendPoint[] }>('/super-admin/reports/growth', { params })
    apiCache.set(cacheKey, data, CACHE_TTL.REPORT)
    return data
  },
  async getTopResellers(params: RangeParams) {
    const paramKey = JSON.stringify(params)
    const cacheKey = `super-admin:reports:top-resellers:${paramKey}`
    const cached = apiCache.get<{ data: Array<{ reseller: string; tenant: string; activations: number; revenue: number }> }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: Array<{ reseller: string; tenant: string; activations: number; revenue: number }> }>('/super-admin/reports/top-resellers', { params })
    apiCache.set(cacheKey, data, CACHE_TTL.REPORT)
    return data
  },
  async exportCsv(params: RangeParams) {
    await downloadFile('/super-admin/reports/export/csv', 'super-admin-reports.xlsx', params)
  },
  async exportPdf(params: RangeParams) {
    await downloadFile('/super-admin/reports/export/pdf', 'super-admin-reports.pdf', params)
  },
  async getFinancialReports(params: RangeParams) {
    const paramKey = JSON.stringify(params)
    const cacheKey = `super-admin:financial:${paramKey}`
    const cached = apiCache.get<{ data: FinancialReportPayload }>(cacheKey)
    if (cached) return cached

    const { data } = await api.get<{ data: FinancialReportPayload }>('/super-admin/financial-reports', { params })
    apiCache.set(cacheKey, data, CACHE_TTL.FINANCIAL)
    return data
  },
  async exportFinancialCsv(params: RangeParams) {
    await downloadFile('/super-admin/financial-reports/export/csv', 'super-admin-financial.xlsx', params)
  },
  async exportFinancialPdf(params: RangeParams) {
    await downloadFile('/super-admin/financial-reports/export/pdf', 'super-admin-financial.pdf', params)
  },
}
