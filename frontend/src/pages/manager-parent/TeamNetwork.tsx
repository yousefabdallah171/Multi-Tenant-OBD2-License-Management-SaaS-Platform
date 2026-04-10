import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactFlowInstance } from '@xyflow/react'
import { RefreshCcw, RotateCcw, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { NetworkCanvas } from '@/components/team-network/NetworkCanvas'
import { useNetworkLayout } from '@/components/team-network/hooks/useNetworkLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'

export function TeamNetworkPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const { user } = useAuth()
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null)

  const teamNetworkQuery = useQuery({
    queryKey: ['manager-parent', 'team-network'],
    queryFn: () => managerParentService.getTeamNetwork(),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchInterval: 10_000,
  })

  const payload = teamNetworkQuery.data?.data
  const { nodes, edges } = useNetworkLayout(payload, lang)
  const isEmpty = payload ? payload.managers.length === 0 && payload.resellers.length === 0 : false

  const actions = useMemo(() => (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team-network'] })
        }}
      >
        <RefreshCcw className="size-4" />
        {t('managerParent.pages.teamNetwork.refreshBtn')}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          flowInstance?.fitView({ padding: 0.16, duration: 200 })
        }}
        disabled={!flowInstance}
      >
        <RotateCcw className="size-4" />
        {t('managerParent.pages.teamNetwork.resetViewBtn')}
      </Button>
    </>
  ), [flowInstance, queryClient, t])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('managerParent.pages.teamNetwork.title')}
        description={t('managerParent.pages.teamNetwork.description')}
        actions={actions}
      />

      {teamNetworkQuery.isFetching && payload ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('common.loading')}
        </p>
      ) : null}

      {teamNetworkQuery.isLoading && !payload ? <LoadingState text={t('managerParent.pages.teamNetwork.loading')} /> : null}

      {teamNetworkQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('common.errorPages.serverError.title')}</CardTitle>
            <CardDescription>{t('common.errorPages.serverError.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button type="button" onClick={() => void teamNetworkQuery.refetch()}>
              {t('common.tryAgain')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!teamNetworkQuery.isLoading && !teamNetworkQuery.isError && payload && isEmpty ? (
        <Card>
          <CardContent className="flex min-h-80 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <Users className="size-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{t('managerParent.pages.teamNetwork.empty')}</h3>
              <p className="max-w-xl text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.teamNetwork.emptyDescription')}</p>
            </div>
            <Button type="button" onClick={() => navigate(routePaths.managerParent.teamManagement(lang))}>
              {t('managerParent.pages.teamNetwork.goToTeam')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!teamNetworkQuery.isLoading && !teamNetworkQuery.isError && payload && !isEmpty ? (
        <Card className="overflow-hidden">
          <CardContent className="h-[calc(100dvh-16rem)] p-0">
            <div dir="ltr" className="h-full">
              <NetworkCanvas
                nodes={nodes}
                edges={edges}
                storageKey={user ? `team-network:${user.id}:${user.tenant_id ?? 'global'}` : 'team-network:guest'}
                onInit={(instance) => {
                  setFlowInstance(instance)
                  const key = user ? `team-network:${user.id}:${user.tenant_id ?? 'global'}:viewport` : 'team-network:guest:viewport'
                  const hasStoredViewport = !!window.localStorage.getItem(key)
                  if (!hasStoredViewport) {
                    instance.fitView({ padding: 0.16 })
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function LoadingState({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="h-[calc(100dvh-16rem)] p-6">
        <div className="flex h-full gap-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950">
          <div className="w-[22%] space-y-4">
            <div className="h-40 animate-pulse rounded-2xl bg-purple-200/60 dark:bg-purple-900/30" />
          </div>
          <div className="w-[28%] space-y-6">
            <div className="h-32 animate-pulse rounded-2xl bg-indigo-200/60 dark:bg-indigo-900/30" />
            <div className="h-32 animate-pulse rounded-2xl bg-indigo-200/60 dark:bg-indigo-900/30" />
          </div>
          <div className="flex-1 space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div className="h-28 animate-pulse rounded-2xl bg-emerald-200/60 dark:bg-emerald-900/30" />
              <div className="h-28 animate-pulse rounded-2xl bg-emerald-200/60 dark:bg-emerald-900/30" />
              <div className="h-28 animate-pulse rounded-2xl bg-emerald-200/60 dark:bg-emerald-900/30" />
              <div className="h-28 animate-pulse rounded-2xl bg-emerald-200/60 dark:bg-emerald-900/30" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
