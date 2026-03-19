import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'

const POLL_INTERVAL = 5_000 // 5 seconds — near real-time without WebSocket

/**
 * Polls pending BIOS change request count for manager_parent.
 * - On first successful load: fires a toast if count > 0.
 * - While online: fires a toast whenever the count increases (new request arrived).
 *
 * Shares the same React Query key with Navbar and Sidebar — zero extra requests.
 */
export function useBcrNotification(enabled: boolean) {
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // null = not yet loaded; number = last known count
  const prevCountRef = useRef<number | null>(null)

  const { data } = useQuery({
    queryKey: ['manager-parent', 'bios-change-requests', 'pending-count'],
    queryFn: () => managerParentService.getPendingBiosChangeRequestCount(),
    enabled,
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!enabled || data === undefined) return

    const count = data.count ?? 0
    const prev = prevCountRef.current
    const isFirstLoad = prev === null

    prevCountRef.current = count

    // First load: notify if there are pending requests
    if (isFirstLoad) {
      if (count === 0) return
      toast(
        lang === 'ar'
          ? `لديك ${count} طلب${count > 1 ? 'ات' : ''} تغيير BIOS معلق${count > 1 ? 'ة' : ''}`
          : `You have ${count} pending BIOS change request${count > 1 ? 's' : ''}`,
        {
          action: {
            label: lang === 'ar' ? 'عرض' : 'View',
            onClick: () => navigate(routePaths.managerParent.biosChangeRequests(lang)),
          },
          duration: 10_000,
        },
      )
      return
    }

    // Subsequent polls: notify only when count goes UP
    if (count <= prev) return

    // Invalidate the BCR list and panel so the table refreshes immediately
    void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'bios-change-requests'], exact: false })

    const newCount = count - prev
    toast(
      lang === 'ar'
        ? `وصل ${newCount} طلب${newCount > 1 ? 'ات' : ''} تغيير BIOS جديد${newCount > 1 ? 'ة' : ''}`
        : `${newCount} new BIOS change request${newCount > 1 ? 's' : ''} received`,
      {
        action: {
          label: lang === 'ar' ? 'عرض' : 'View',
          onClick: () => navigate(routePaths.managerParent.biosChangeRequests(lang)),
        },
        duration: 10_000,
      },
    )
  }, [data, enabled, lang, navigate, queryClient])
}
