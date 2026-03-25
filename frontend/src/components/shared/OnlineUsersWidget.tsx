import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Circle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'
import { managerParentService } from '@/services/manager-parent.service'
import { managerService } from '@/services/manager.service'
import { onlineService, type OnlineUser } from '@/services/online.service'
import { settingsService } from '@/services/settings.service'
import { formatDate } from '@/lib/utils'

export function OnlineUsersWidget() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(true)

  const visibilityQuery = useQuery({
    queryKey: ['online-widget', 'visibility'],
    queryFn: () => settingsService.getOnlineWidgetSettings(),
    enabled: user?.role === 'reseller',
  })

  const canView = useMemo(() => {
    if (!user) {
      return false
    }
    if (user.role === 'super_admin' || user.role === 'manager_parent' || user.role === 'manager') {
      return true
    }
    if (user.role === 'reseller') {
      return Boolean(visibilityQuery.data?.data.show_online_widget_to_resellers)
    }
    return false
  }, [user, visibilityQuery.data?.data.show_online_widget_to_resellers])

  const usersQuery = useQuery({
    queryKey: ['online-users', user?.role],
    queryFn: async () => {
      if (user?.role === 'manager_parent') {
        const response = await managerParentService.getOnlineUsers()
        return response.data as OnlineUser[]
      }
      if (user?.role === 'manager') {
        const response = await managerService.getOnlineUsers()
        return response.data as OnlineUser[]
      }
      if (user?.role === 'super_admin') {
        return onlineService.getOnlineUsers('/super-admin/online-users')
      }
      if (user?.role === 'reseller') {
        return onlineService.getOnlineUsers('/reseller/online-users')
      }
      return []
    },
    enabled: canView,
    refetchInterval: 30_000,
  })

  const rows = usersQuery.data ?? []
  if (!canView) {
    return null
  }

  return (
    <div className={cn('fixed bottom-4 z-50', lang === 'ar' ? 'left-4' : 'right-4')}>
      {collapsed ? (
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          onClick={() => setCollapsed(false)}
        >
          <Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
          {t('onlineWidget.collapsed', { count: rows.length })}
        </button>
      ) : (
        <div className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-700"
            onClick={() => setCollapsed(true)}
          >
            <span>{t('onlineWidget.title')} ({rows.length})</span>
            <ChevronDown className="h-4 w-4 rotate-180" />
          </button>
          <div className="max-h-64 space-y-2 overflow-y-auto p-3">
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('onlineWidget.empty')}</p>
            ) : rows.map((entry, index) => (
              <div key={`${entry.masked_name}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{entry.masked_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('onlineWidget.lastSeen')}: {entry.last_seen_at ? formatDate(entry.last_seen_at, lang === 'ar' ? 'ar-EG' : 'en-US') : '-'}
                  </p>
                </div>
                <RoleBadge role={entry.role} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
