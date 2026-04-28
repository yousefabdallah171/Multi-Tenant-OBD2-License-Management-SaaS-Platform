import { QueryClientProvider } from '@tanstack/react-query'
import { Outlet } from 'react-router-dom'
import { DashboardAppearanceProvider } from '@/hooks/useDashboardAppearance'
import { queryClient } from '@/lib/queryClient'

export function ProtectedProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardAppearanceProvider>
        <Outlet />
      </DashboardAppearanceProvider>
    </QueryClientProvider>
  )
}
