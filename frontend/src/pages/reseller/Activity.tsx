import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KeyRound, LogIn, ShieldOff, ShieldPlus, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { resellerService } from '@/services/reseller.service'
import { formatActivityActionLabel, formatDate } from '@/lib/utils'

export function ActivityPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(12)
  const [action, setAction] = useState('')

  const filters = [
    { value: '', label: t('reseller.pages.activity.allActions') },
    { value: 'license.activate', label: t('reseller.pages.activity.activation') },
    { value: 'license.renew', label: t('reseller.pages.activity.renewal') },
    { value: 'license.deactivate', label: t('reseller.pages.activity.deactivation') },
    { value: 'auth.login', label: t('reseller.pages.activity.login') },
  ]

  const activityQuery = useQuery({
    queryKey: ['reseller', 'activity', page, perPage, action],
    queryFn: () => resellerService.getActivity({ page, per_page: perPage, action }),
  })

  const entries = useMemo(() => activityQuery.data?.data ?? [], [activityQuery.data?.data])
  const meta = activityQuery.data?.meta
  const totalPages = meta?.last_page ?? 1

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('roles.reseller')} title={t('reseller.pages.activity.title')} description={t('reseller.pages.activity.description')} />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
              setPage(1)
            }}
            className="h-11 min-w-[220px] rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            {filters.map((filter) => (
              <option key={filter.label} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {entries.map((entry, index) => {
          const visual = resolveActivityVisual(entry.action)

          return (
            <div key={entry.id} className="relative">
              {index < entries.length - 1 ? (
                <span className="absolute start-6 top-16 h-[calc(100%-1rem)] w-px bg-slate-200 dark:bg-slate-800" />
              ) : null}
              <Card className={visual.cardClass}>
                <CardContent className="flex gap-4 p-6">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${visual.iconWrapClass}`}>
                    {visual.icon}
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${visual.badgeClass}`}>
                          {formatActivityActionLabel(entry.action, t)}
                        </span>
                        {entry.description ? <p className="text-sm text-slate-600 dark:text-slate-300">{entry.description}</p> : null}
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(entry.metadata ?? {}).slice(0, 5).map(([key, value]) => (
                        <span key={key} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 transition-colors hover:bg-sky-100 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-sky-950/30 dark:hover:text-sky-300">
                          {key}: {String(value)}
                        </span>
                      ))}
                      {entry.ip_address ? <span className="rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-700 transition-colors hover:bg-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/50">{entry.ip_address}</span> : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}

        {!activityQuery.isLoading && entries.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{t('reseller.pages.activity.empty')}</CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-slate-500 dark:text-slate-400">
          <span>{t('reseller.pages.activity.totalEntries', { count: meta?.total ?? 0 })}</span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <span>{t('common.rowsPerPage')}</span>
              <select
                value={perPage}
                onChange={(event) => {
                  setPerPage(Number(event.target.value))
                  setPage(1)
                }}
                className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value={12}>12</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
            <Button type="button" variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              {t('common.previous')}
            </Button>
            <span>
              {page} / {totalPages}
            </span>
            <Button type="button" variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
              {t('common.next')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function resolveActivityVisual(action: string) {
  if (action.includes('activate')) {
    return {
      icon: <ShieldPlus className="h-5 w-5" />,
      iconWrapClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      cardClass: 'border-s-4 border-s-emerald-500',
      badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    }
  }

  if (action.includes('deactivate')) {
    return {
      icon: <ShieldOff className="h-5 w-5" />,
      iconWrapClass: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
      cardClass: 'border-s-4 border-s-rose-500',
      badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    }
  }

  if (action.includes('renew')) {
    return {
      icon: <Undo2 className="h-5 w-5" />,
      iconWrapClass: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
      cardClass: 'border-s-4 border-s-sky-500',
      badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
    }
  }

  if (action.includes('login')) {
    return {
      icon: <LogIn className="h-5 w-5" />,
      iconWrapClass: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      cardClass: 'border-s-4 border-s-slate-500',
      badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    }
  }

  return {
    icon: <KeyRound className="h-5 w-5" />,
    iconWrapClass: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
    cardClass: 'border-s-4 border-s-slate-400',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  }
}
