import { useMutation, useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatsCard } from '@/components/shared/StatsCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { managerParentService } from '@/services/manager-parent.service'

export function ApiStatusPage() {
  const { t } = useTranslation()

  const statusQuery = useQuery({
    queryKey: ['manager-parent', 'api-status'],
    queryFn: () => managerParentService.getApiStatus(),
  })

  const pingMutation = useMutation({
    mutationFn: () => managerParentService.pingApiStatus(),
    onSuccess: () => {
      toast.success(t('managerParent.pages.apiStatus.pingNow'))
      void statusQuery.refetch()
    },
  })

  const status = statusQuery.data?.data

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('managerParent.pages.apiStatus.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.apiStatus.description')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatsCard
          title={t('common.status')}
          value={t(`common.${status?.status ?? 'unknown'}`)}
          icon={Activity}
          color={status?.status === 'online' ? 'emerald' : status?.status === 'degraded' ? 'amber' : 'rose'}
        />
        <StatsCard title={t('managerParent.pages.apiStatus.responseTime')} value={`${status?.response_time_ms ?? 0}ms`} icon={Activity} color="sky" />
        <StatsCard title={t('common.lastChecked')} value={status?.last_checked ?? '-'} icon={Activity} color="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('managerParent.pages.apiStatus.summaryTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-slate-100 p-4 dark:bg-slate-900">
            <span>{t('managerParent.pages.apiStatus.endpoint')}</span>
            <code>{status?.external_url ?? 'http://72.60.69.185'}</code>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-slate-100 p-4 dark:bg-slate-900">
            <span>{t('common.status')}</span>
            {status ? <StatusBadge status={status.status} /> : '-'}
          </div>
          <Button type="button" onClick={() => pingMutation.mutate()} disabled={pingMutation.isPending}>
            {t('managerParent.pages.apiStatus.pingNow')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
