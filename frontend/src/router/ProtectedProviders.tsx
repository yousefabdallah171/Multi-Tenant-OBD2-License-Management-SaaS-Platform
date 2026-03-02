import { QueryClientProvider } from '@tanstack/react-query'
import { Outlet } from 'react-router-dom'
import { queryClient } from '@/lib/queryClient'

export function ProtectedProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  )
}
