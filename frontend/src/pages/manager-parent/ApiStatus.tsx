import { useEffect, useState } from 'react'
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
  const [programId, setProgramId] = useState<number | undefined>(undefined)

  const programsQuery = useQuery({
    queryKey: ['manager-parent', 'api-status-programs'],
    queryFn: () => managerParentService.getProgramsWithExternalApi(),
  })

  useEffect(() => {
    if (!programsQuery.data || programsQuery.data.length === 0 || programId !== undefined) {
      return
    }

    setProgramId(programsQuery.data[0].id)
  }, [programId, programsQuery.data])

  const statusQuery = useQuery({
    queryKey: ['manager-parent', 'api-status', programId],
    queryFn: () => managerParentService.getApiStatus(programId),
  })

  const pingMutation = useMutation({
    mutationFn: () => managerParentService.pingApiStatus(programId),
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
        <div className="max-w-sm">
          <select
            value={programId ?? ''}
            onChange={(event) => setProgramId(event.target.value ? Number(event.target.value) : undefined)}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            {programsQuery.data?.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </div>
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
        <CardContent className="space-y-4">          <div className="flex items-center justify-between rounded-2xl bg-slate-100 p-4 dark:bg-slate-900">
            <span>{t('software.externalSoftwareId')}</span>
            <code>{status?.software_id ?? '-'}</code>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-slate-100 p-4 dark:bg-slate-900">
            <span>{t('common.status')}</span>
            {status ? <StatusBadge status={status.status} /> : '-'}
          </div>
          {status?.message ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              {status.message}
            </div>
          ) : null}
          <Button type="button" onClick={() => pingMutation.mutate()} disabled={pingMutation.isPending}>
            {t('managerParent.pages.apiStatus.pingNow')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}


