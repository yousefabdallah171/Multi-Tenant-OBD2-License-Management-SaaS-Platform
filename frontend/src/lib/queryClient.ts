import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds - data is fresh for 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes - keep unused data for 5 minutes
      retry: 2, // Retry failed requests up to 2 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * Query key factories for dashboard and reporting endpoints
 * Helps maintain consistent cache keys across the app
 */
export const queryKeys = {
  reseller: {
    all: ['reseller'] as const,
    dashboard: () => [...queryKeys.reseller.all, 'dashboard'] as const,
    dashboardStats: () => [...queryKeys.reseller.dashboard(), 'stats'] as const,
    activationsChart: () => [...queryKeys.reseller.dashboard(), 'activations-chart'] as const,
    revenueChart: () => [...queryKeys.reseller.dashboard(), 'revenue-chart'] as const,
    recentActivity: () => [...queryKeys.reseller.dashboard(), 'recent-activity'] as const,

    reports: () => [...queryKeys.reseller.all, 'reports'] as const,
    revenueReport: (filters?: Record<string, any>) => [...queryKeys.reseller.reports(), 'revenue', filters] as const,
    activationsReport: (filters?: Record<string, any>) => [...queryKeys.reseller.reports(), 'activations', filters] as const,
    topPrograms: (filters?: Record<string, any>) => [...queryKeys.reseller.reports(), 'top-programs', filters] as const,

    customers: () => [...queryKeys.reseller.all, 'customers'] as const,
  },

  manager: {
    all: ['manager'] as const,
    dashboard: () => [...queryKeys.manager.all, 'dashboard'] as const,
    dashboardStats: () => [...queryKeys.manager.dashboard(), 'stats'] as const,
    reports: () => [...queryKeys.manager.all, 'reports'] as const,
  },

  managerParent: {
    all: ['manager-parent'] as const,
    dashboard: () => [...queryKeys.managerParent.all, 'dashboard'] as const,
    dashboardStats: () => [...queryKeys.managerParent.dashboard(), 'stats'] as const,
    reports: () => [...queryKeys.managerParent.all, 'reports'] as const,
  },

  superAdmin: {
    all: ['super-admin'] as const,
    dashboard: () => [...queryKeys.superAdmin.all, 'dashboard'] as const,
    dashboardStats: () => [...queryKeys.superAdmin.dashboard(), 'stats'] as const,
    reports: () => [...queryKeys.superAdmin.all, 'reports'] as const,
  },
}
