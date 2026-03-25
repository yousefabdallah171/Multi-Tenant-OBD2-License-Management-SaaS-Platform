import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { settingsService } from '@/services/settings.service'
import { useAuthStore } from '@/stores/authStore'
import { persistServerTimezone, readBrowserTimezone, resolveDisplayTimezone } from '@/lib/timezones'

export function useResolvedTimezone(preferred?: string | null) {
  const userTimezone = useAuthStore((state) => state.user?.timezone ?? null)
  const browserTimezone = useMemo(() => readBrowserTimezone(), [])
  const serverTimezoneQuery = useQuery({
    queryKey: ['settings', 'online-widget'],
    queryFn: () => settingsService.getOnlineWidgetSettings(),
    staleTime: 300000,
  })
  const serverTimezone = serverTimezoneQuery.data?.data.server_timezone ?? 'UTC'

  useEffect(() => {
    persistServerTimezone(serverTimezone)
  }, [serverTimezone])

  const timezone = useMemo(
    () => resolveDisplayTimezone({
      preferred,
    userTimezone,
    browserTimezone,
    serverTimezone,
  }),
    [preferred, userTimezone, browserTimezone, serverTimezone],
  )

  return {
    timezone,
    userTimezone,
    browserTimezone,
    serverTimezone,
    isLoadingServerTimezone: serverTimezoneQuery.isLoading,
  }
}
