import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'

const POLL_INTERVAL = 30_000 // 30 seconds

/**
 * Polls pending BIOS change request count for manager_parent.
 * - On first load (or coming back online): fires a toast if count > 0.
 * - While online: fires a toast whenever the count increases (new request arrived).
 *
 * The query is shared with Navbar and Sidebar via the same query key so no
 * extra network requests are made — React Query deduplicates them.
 */
export function useBcrNotification(enabled: boolean) {
  const { lang } = useLanguage()
  const navigate = useNavigate()

  const prevCountRef = useRef<number | null>(null)
  const initializedRef = useRef(false)

  const { data } = useQuery({
    queryKey: ['manager-parent', 'bios-change-requests', 'pending-count'],
    queryFn: () => managerParentService.getPendingBiosChangeRequestCount(),
    enabled,
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: false, // only poll when tab is visible
    refetchOnWindowFocus: true,
  })

  const count = data?.count ?? 0

  useEffect(() => {
    if (!enabled || data === undefined) return

    const isFirstLoad = !initializedRef.current
    initializedRef.current = true

    const prev = prevCountRef.current
    prevCountRef.current = count

    const shouldNotify =
      // First load / came back online: show if there are pending requests
      (isFirstLoad && count > 0) ||
      // While online: show when count increased (new request arrived)
      (prev !== null && count > prev)

    if (!shouldNotify) return

    const newCount = isFirstLoad ? count : count - (prev ?? 0)
    const message =
      lang === 'ar'
        ? `${isFirstLoad ? 'لديك' : 'وصل'} ${count} طلب${count > 1 ? 'ات' : ''} تغيير BIOS معلق${count > 1 ? 'ة' : ''}`
        : isFirstLoad
          ? `You have ${count} pending BIOS change request${count > 1 ? 's' : ''}`
          : `${newCount} new BIOS change request${newCount > 1 ? 's' : ''} received`

    toast(message, {
      action: {
        label: lang === 'ar' ? 'عرض' : 'View',
        onClick: () => navigate(routePaths.managerParent.biosChangeRequests(lang)),
      },
      duration: 10_000,
    })
  }, [count, data, enabled, lang, navigate])
}
