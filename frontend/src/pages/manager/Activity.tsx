import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { managerService } from '@/services/manager.service'

export function ActivityPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(12)
  const [userId, setUserId] = useState<number | ''>('')
  const [action, setAction] = useState('')
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })

  const activityQuery = useQuery({
    queryKey: ['manager', 'activity', page, perPage, userId, action, range.from, range.to],
    queryFn: () => managerService.getActivity({ page, per_page: perPage, user_id: userId, action, from: range.from, to: range.to }),
  })

  const teamQuery = useQuery({
    queryKey: ['manager', 'activity', 'team-users'],
    queryFn: () => managerService.getTeam({ per_page: 100 }),
  })

  const meta = activityQuery.data?.meta
  const entries = useMemo(() => activityQuery.data?.data ?? [], [activityQuery.data?.data])
  const totalPages = useMemo(() => meta?.last_page ?? 1, [meta?.last_page])
  const actionOptions = useMemo(() => Array.from(new Set(entries.map((entry) => entry.action))).sort(), [entries])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('manager.layout.eyebrow')}
        title={t('manager.pages.activity.title')}
        description={t('manager.pages.activity.description')}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setRange({ from: '', to: '' })}>
              {t('manager.pages.activity.clearDates')}
            </Button>
            <Button type="button" onClick={() => void managerService.exportActivity(range)}>
              <Download className="me-2 h-4 w-4" />
              {t('manager.pages.activity.exportReport')}
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px_minmax(0,0.9fr)]">
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('manager.pages.activity.allActions')}</option>
            {actionOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value ? Number(event.target.value) : '')
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('manager.pages.activity.allResellers')}</option>
            {(teamQuery.data?.data ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <DateRangePicker value={range} onChange={setRange} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardContent className="flex gap-4 p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-white">{entry.user?.name ?? t('manager.layout.eyebrow')}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{entry.action}</p>
                    {entry.description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{entry.description}</p> : null}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(entry.metadata ?? {})
                    .filter(([key]) => !['license_id', 'program_id', 'customer_id', 'request_id', 'bios_conflict_id', 'bios_change_id', 'reviewer_id', 'reseller_id'].includes(key))
                    .slice(0, 6)
                    .map(([key, value]) => (
                      <span key={key} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {key}: {String(value)}
                      </span>
                    ))}
                  {entry.ip_address ? <span className="rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">{entry.ip_address}</span> : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {!activityQuery.isLoading && entries.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{t('manager.pages.activity.noMatches')}</CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-slate-500 dark:text-slate-400">
          <span>{t('manager.pages.activity.totalEntries', { count: meta?.total ?? 0 })}</span>
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
