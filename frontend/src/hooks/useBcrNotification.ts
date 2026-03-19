import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'
import { managerService } from '@/services/manager.service'
import { superAdminBcrService } from '@/services/super-admin-bcr.service'

const POLL_INTERVAL = 5_000 // 5 seconds — near real-time without WebSocket

type BcrRole = 'manager_parent' | 'manager' | 'super_admin' | false

/**
 * Polls pending BIOS change request count for manager_parent, manager, and super_admin.
 * - On first successful load: fires a toast if count > 0.
 * - While online: fires a toast whenever the count increases (new request arrived).
 *
 * Shares the same React Query key with Navbar and Sidebar — zero extra requests.
 */
export function useBcrNotification(role: BcrRole) {
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // null = not yet loaded; number = last known count
  const prevCountRef = useRef<number | null>(null)

  const queryKey =
    role === 'manager_parent'
      ? ['manager-parent', 'bios-change-requests', 'pending-count']
      : role === 'manager'
        ? ['manager', 'bios-change-requests', 'pending-count']
        : ['super-admin', 'bios-change-requests', 'pending-count']

  const queryFn =
    role === 'manager_parent'
      ? () => managerParentService.getPendingBiosChangeRequestCount()
      : role === 'manager'
        ? () => managerService.getPendingBiosChangeRequestCount()
        : () => superAdminBcrService.getPendingBiosChangeRequestCount()

  const bcrPath =
    role === 'manager_parent'
      ? routePaths.managerParent.biosChangeRequests(lang)
      : role === 'manager'
        ? routePaths.manager.biosChangeRequests(lang)
        : routePaths.superAdmin.biosChangeRequests(lang)

  const invalidateKey =
    role === 'manager_parent'
      ? ['manager-parent', 'bios-change-requests']
      : role === 'manager'
        ? ['manager', 'bios-change-requests']
        : ['super-admin', 'bios-change-requests']

  const { data } = useQuery({
    queryKey,
    queryFn,
    enabled: role !== false,
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!role || data === undefined) return

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
            onClick: () => navigate(bcrPath),
          },
          duration: 10_000,
        },
      )
      return
    }

    // Subsequent polls: notify only when count goes UP
    if (count <= prev) return

    // Invalidate the BCR list and panel so the table refreshes immediately
    void queryClient.invalidateQueries({ queryKey: invalidateKey, exact: false })

    const newCount = count - prev
    toast(
      lang === 'ar'
        ? `وصل ${newCount} طلب${newCount > 1 ? 'ات' : ''} تغيير BIOS جديد${newCount > 1 ? 'ة' : ''}`
        : `${newCount} new BIOS change request${newCount > 1 ? 's' : ''} received`,
      {
        action: {
          label: lang === 'ar' ? 'عرض' : 'View',
          onClick: () => navigate(bcrPath),
        },
        duration: 10_000,
      },
    )
  }, [data, role, lang, navigate, queryClient, bcrPath, invalidateKey])
}
