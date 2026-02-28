import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KeyRound, LogIn, ShieldOff, ShieldPlus, Undo2 } from 'lucide-react'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { resellerService } from '@/services/reseller.service'
import { formatDate } from '@/lib/utils'

export function ActivityPage() {
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const text = lang === 'ar'
    ? {
        eyebrow: 'موزع',
        title: 'النشاط',
        description: 'راجع إجراءات التفعيل والتجديد والإلغاء وتسجيل الدخول الخاصة بك.',
        filters: [
          { value: '', label: 'كل الإجراءات' },
          { value: 'license.activate', label: 'تفعيل' },
          { value: 'license.renew', label: 'تجديد' },
          { value: 'license.deactivate', label: 'إلغاء' },
          { value: 'auth.login', label: 'تسجيل الدخول' },
        ],
        empty: 'لا يوجد نشاط شخصي مطابق للفلاتر الحالية.',
        totalEntries: 'إجمالي السجلات',
        rows: 'الصفوف',
        previous: 'السابق',
        next: 'التالي',
      }
    : {
        eyebrow: 'Reseller',
        title: 'Activity',
        description: 'Review your activation, renewal, deactivation, and sign-in actions.',
        filters: [
          { value: '', label: 'All Actions' },
          { value: 'license.activate', label: 'Activation' },
          { value: 'license.renew', label: 'Renewal' },
          { value: 'license.deactivate', label: 'Deactivation' },
          { value: 'auth.login', label: 'Login' },
        ],
        empty: 'No personal activity matches the current filters.',
        totalEntries: 'Total entries',
        rows: 'Rows',
        previous: 'Previous',
        next: 'Next',
      }
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(12)
  const [action, setAction] = useState('')

  const activityQuery = useQuery({
    queryKey: ['reseller', 'activity', page, perPage, action],
    queryFn: () => resellerService.getActivity({ page, per_page: perPage, action }),
  })

  const entries = useMemo(() => activityQuery.data?.data ?? [], [activityQuery.data?.data])
  const meta = activityQuery.data?.meta
  const totalPages = meta?.last_page ?? 1

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} />

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
            {text.filters.map((filter) => (
              <option key={filter.label} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {entries.map((entry) => {
          const icon = resolveActivityIcon(entry.action)

          return (
            <Card key={entry.id}>
              <CardContent className="flex gap-4 p-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                  {icon}
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                        {entry.action}
                      </span>
                      {entry.description ? <p className="text-sm text-slate-600 dark:text-slate-300">{entry.description}</p> : null}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(entry.metadata ?? {}).slice(0, 5).map(([key, value]) => (
                      <span key={key} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {key}: {String(value)}
                      </span>
                    ))}
                    {entry.ip_address ? <span className="rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">{entry.ip_address}</span> : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {!activityQuery.isLoading && entries.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{text.empty}</CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-slate-500 dark:text-slate-400">
          <span>{text.totalEntries}: {meta?.total ?? 0}</span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <span>{text.rows}</span>
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
              {text.previous}
            </Button>
            <span>
              {page} / {totalPages}
            </span>
            <Button type="button" variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
              {text.next}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function resolveActivityIcon(action: string) {
  if (action.includes('activate')) {
    return <ShieldPlus className="h-5 w-5" />
  }

  if (action.includes('deactivate')) {
    return <ShieldOff className="h-5 w-5" />
  }

  if (action.includes('renew')) {
    return <Undo2 className="h-5 w-5" />
  }

  if (action.includes('login')) {
    return <LogIn className="h-5 w-5" />
  }

  return <KeyRound className="h-5 w-5" />
}
