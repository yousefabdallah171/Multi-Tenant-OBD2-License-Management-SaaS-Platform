import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatsCard } from '@/components/shared/StatsCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiStatusService } from '@/services/api-status.service'
import type { ApiEndpointStatus } from '@/types/super-admin.types'

export function ApiStatusPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const statusQuery = useQuery({
    queryKey: ['super-admin', 'api-status'],
    queryFn: () => apiStatusService.getStatus(),
  })

  const historyQuery = useQuery({
    queryKey: ['super-admin', 'api-status', 'history'],
    queryFn: () => apiStatusService.getHistory(),
  })

  const pingMutation = useMutation({
    mutationFn: () => apiStatusService.ping(),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.apiStatus.pingSuccess'))
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'api-status'] })
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'api-status', 'history'] })
    },
  })

  const columns: Array<DataTableColumn<ApiEndpointStatus>> = [
    { key: 'endpoint', label: t('superAdmin.pages.apiStatus.endpoint'), sortable: true, sortValue: (row) => row.endpoint, render: (row) => <code>{row.endpoint}</code> },
    { key: 'status', label: t('common.status'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
    { key: 'code', label: t('superAdmin.pages.logs.statusCode'), sortable: true, sortValue: (row) => row.status_code ?? 0, render: (row) => row.status_code ?? '-' },
    { key: 'last', label: t('common.lastChecked'), sortable: true, sortValue: (row) => row.last_checked_at ?? '', render: (row) => row.last_checked_at ?? '-' },
  ]

  const summary = statusQuery.data?.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold">{t('superAdmin.pages.apiStatus.title')}</h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.apiStatus.description')}</p>
        </div>
        <Button type="button" onClick={() => pingMutation.mutate()} disabled={pingMutation.isPending}>
          <Activity className="me-2 h-4 w-4" />
          {t('superAdmin.pages.apiStatus.pingNow')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title={t('common.status')}
          value={t(`common.${summary?.status ?? 'unknown'}`)}
          icon={Activity}
          color={summary?.status === 'online' ? 'emerald' : summary?.status === 'degraded' ? 'amber' : 'rose'}
        />
        <StatsCard title={t('superAdmin.pages.apiStatus.responseTime')} value={`${summary?.response_time_ms ?? 0}ms`} icon={Activity} color="sky" />
        <StatsCard title={t('superAdmin.pages.apiStatus.uptime24')} value={`${summary?.uptime['24h'] ?? 0}%`} icon={Activity} color="emerald" />
        <StatsCard title={t('superAdmin.pages.apiStatus.uptime30')} value={`${summary?.uptime['30d'] ?? 0}%`} icon={Activity} color="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <RevenueChart
          title={t('superAdmin.pages.apiStatus.historyTitle')}
          data={(historyQuery.data?.data ?? []).map((item) => ({ month: item.time, revenue: item.response_time_ms }))}
          dataKey="revenue"
        />
        <Card>
          <CardHeader>
            <CardTitle>{t('superAdmin.pages.apiStatus.summaryTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-slate-100 p-4 dark:bg-slate-900">
              <span>{t('common.status')}</span>
              {summary ? <StatusBadge status={summary.status} /> : null}
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-100 p-4 dark:bg-slate-900">
              <span>{t('common.lastChecked')}</span>
              <span>{summary?.last_check_at ?? '-'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable columns={columns} data={summary?.endpoints ?? []} rowKey={(row) => row.endpoint} />
    </div>
  )
}
