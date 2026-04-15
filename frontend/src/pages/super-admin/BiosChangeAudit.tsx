import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { superAdminPlatformService } from '@/services/super-admin-platform.service'
import type { BiosChangeAuditEntry } from '@/types/manager-parent.types'

const SUMMARY_CARD_STYLES = {
  sky: 'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-950/60 dark:bg-sky-950/20 dark:text-sky-100',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-950/60 dark:bg-emerald-950/20 dark:text-emerald-100',
  rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-950/60 dark:bg-rose-950/20 dark:text-rose-100',
  amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-950/60 dark:bg-amber-950/20 dark:text-amber-100',
  violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-950/60 dark:bg-violet-950/20 dark:text-violet-100',
} as const

export function BiosChangeAuditPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(15)
  const [managerId, setManagerId] = useState<number | ''>('')
  const [resellerId, setResellerId] = useState<number | ''>('')
  const [type, setType] = useState<'request' | 'direct_change' | ''>('')
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'completed' | 'failed' | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  useEffect(() => {
    setPage(1)
  }, [managerId, resellerId, type, status, dateFrom, dateTo])

  const summaryQuery = useQuery({
    queryKey: ['super-admin', 'bios-change-audit', 'summary'],
    queryFn: () => superAdminPlatformService.getBiosChangeAuditSummary(),
    staleTime: 120_000,
  })

  const listQuery = useQuery({
    queryKey: ['super-admin', 'bios-change-audit', page, perPage, managerId, resellerId, type, status, dateFrom, dateTo],
    queryFn: () => superAdminPlatformService.getBiosChangeAudit({
      page,
      per_page: perPage,
      manager_id: managerId || undefined,
      reseller_id: resellerId || undefined,
      type: type || undefined,
      status: status || undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

  const managersQuery = useQuery({
    queryKey: ['super-admin', 'bios-change-audit', 'managers'],
    queryFn: () => superAdminPlatformService.getSellers({ role: 'manager', per_page: 100 }),
    staleTime: 300_000,
  })

  const resellersQuery = useQuery({
    queryKey: ['super-admin', 'bios-change-audit', 'resellers'],
    queryFn: () => superAdminPlatformService.getSellers({ role: 'reseller', per_page: 100 }),
    staleTime: 300_000,
  })

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const hasResults = rows.length > 0
  const managers = useMemo(() => managersQuery.data?.data ?? [], [managersQuery.data])
  const resellers = useMemo(() => resellersQuery.data?.data ?? [], [resellersQuery.data])

  const summaryCards = useMemo(() => [
    { key: 'total_requests', title: t('biosChangeAudit.totalRequests'), value: summaryQuery.data?.total_requests ?? 0, tone: 'sky' as const },
    { key: 'approved', title: t('biosChangeAudit.approved'), value: summaryQuery.data?.approved ?? 0, tone: 'emerald' as const },
    { key: 'rejected', title: t('biosChangeAudit.rejected'), value: summaryQuery.data?.rejected ?? 0, tone: 'rose' as const },
    { key: 'pending', title: t('biosChangeAudit.pending'), value: summaryQuery.data?.pending ?? 0, tone: 'amber' as const },
    { key: 'direct_changes', title: t('biosChangeAudit.directChanges'), value: summaryQuery.data?.direct_changes ?? 0, tone: 'violet' as const },
  ], [summaryQuery.data, t])

  const resetFilters = () => {
    setManagerId('')
    setResellerId('')
    setType('')
    setStatus('')
    setDateFrom('')
    setDateTo('')
    setExpandedRow(null)
    setPage(1)
    setPerPage(15)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('superAdmin.layout.eyebrow')}
        title={t('biosChangeAudit.title')}
        description={t('biosChangeAudit.description')}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <Card key={card.key} className={SUMMARY_CARD_STYLES[card.tone]}>
            <CardContent className="space-y-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">{card.title}</p>
              <p className="text-3xl font-bold tabular-nums">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-3 xl:grid-cols-7">
          <select
            value={managerId}
            onChange={(event) => setManagerId(event.target.value ? Number(event.target.value) : '')}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('biosChangeAudit.allManagers')}</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name}
              </option>
            ))}
          </select>

          <select
            value={resellerId}
            onChange={(event) => setResellerId(event.target.value ? Number(event.target.value) : '')}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('biosChangeAudit.allResellers')}</option>
            {resellers.map((reseller) => (
              <option key={reseller.id} value={reseller.id}>
                {reseller.name}
              </option>
            ))}
          </select>

          <select
            value={type}
            onChange={(event) => setType(event.target.value as 'request' | 'direct_change' | '')}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('biosChangeAudit.allTypes')}</option>
            <option value="request">{t('biosChangeAudit.typeRequest')}</option>
            <option value="direct_change">{t('biosChangeAudit.typeDirectChange')}</option>
          </select>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('common.allStatuses')}</option>
            <option value="pending">{t('common.pending')}</option>
            <option value="approved">{t('biosChangeAudit.approved')}</option>
            <option value="rejected">{t('biosChangeAudit.rejected')}</option>
            <option value="completed">{t('biosChangeAudit.statusCompleted')}</option>
            <option value="failed">{t('biosChangeAudit.statusFailed')}</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            aria-label={t('common.from')}
          />

          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            aria-label={t('common.to')}
          />

          <Button type="button" variant="outline" onClick={resetFilters} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            {t('biosChangeAudit.reset')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {listQuery.isError ? (
            <div className="p-6 text-sm text-rose-600 dark:text-rose-300">{t('common.error')}</div>
          ) : !listQuery.isLoading && !listQuery.isFetching && !hasResults ? (
            <EmptyState title={t('biosChangeAudit.noHistory')} description={t('biosChangeAudit.noHistoryDesc')} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr className="text-start">
                      <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('biosChangeAudit.type')}</th>
                      <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('biosChangeAudit.reseller')}</th>
                      <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('biosChangeAudit.manager')}</th>
                      <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('biosChangeAudit.oldBios')}</th>
                      <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('biosChangeAudit.newBios')}</th>
                      <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('common.status')}</th>
                      <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('common.date')}</th>
                      <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('biosChangeAudit.details')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {listQuery.isLoading && !listQuery.data ? Array.from({ length: perPage }).map((_, index) => (
                      <tr key={`skeleton-${index}`} className="animate-pulse">
                        <td className="px-4 py-4" colSpan={8}>
                          <div className="h-5 rounded bg-slate-100 dark:bg-slate-800" />
                        </td>
                      </tr>
                    )) : rows.map((row) => (
                      <AuditTableRow
                        key={row.id}
                        row={row}
                        locale={locale}
                        expanded={expandedRow === row.id}
                        onToggle={() => setExpandedRow((current) => current === row.id ? null : row.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-sm dark:border-slate-800 md:flex-row md:items-center md:justify-between">
                <div className="text-slate-500 dark:text-slate-400">
                  {t('common.totalCount', { count: meta?.total ?? 0 })}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400">{t('common.rowsPerPage')}</span>
                    <select
                      value={perPage}
                      onChange={(event) => {
                        setPerPage(Number(event.target.value))
                        setPage(1)
                      }}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    >
                      {[10, 15, 25, 50].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={(meta?.current_page ?? 1) <= 1} onClick={() => setPage((current) => current - 1)}>
                      {t('common.previous')}
                    </Button>
                    <span className="min-w-20 text-center text-slate-500 dark:text-slate-400">
                      {(meta?.current_page ?? 1)} / {(meta?.last_page ?? 1)}
                    </span>
                    <Button type="button" variant="outline" size="sm" disabled={(meta?.current_page ?? 1) >= (meta?.last_page ?? 1)} onClick={() => setPage((current) => current + 1)}>
                      {t('common.next')}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AuditTableRow({
  row,
  locale,
  expanded,
  onToggle,
}: {
  row: BiosChangeAuditEntry
  locale: string
  expanded: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <tr className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
        <td className="px-4 py-4"><TypeBadge type={row.type} /></td>
        <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">{row.reseller_name ?? '--'}</td>
        <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">{row.manager_name ?? '--'}</td>
        <td className="px-4 py-4 text-sm"><code className="rounded bg-slate-100 px-2 py-1 text-slate-800 dark:bg-slate-900 dark:text-slate-200">{row.old_bios_id}</code></td>
        <td className="px-4 py-4 text-sm"><code className="rounded bg-slate-100 px-2 py-1 text-slate-800 dark:bg-slate-900 dark:text-slate-200">{row.new_bios_id}</code></td>
        <td className="px-4 py-4"><AuditStatusBadge status={row.status} /></td>
        <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{row.occurred_at ? formatDate(row.occurred_at, locale) : '--'}</td>
        <td className="px-4 py-4 text-end">
          <Button type="button" variant="ghost" size="sm" onClick={onToggle} className="gap-1">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {t('biosChangeAudit.details')}
          </Button>
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-slate-50/60 dark:bg-slate-950/40">
          <td colSpan={8} className="px-4 pb-4 pt-0">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900/40">
              <div className="grid gap-3 md:grid-cols-2">
                <AuditDetail label={t('common.customer')} value={row.customer_name} />
                <AuditDetail label={t('common.program')} value={row.program_name} />
                <AuditDetail label={t('biosChangeAudit.licenseId')} value={row.license_id ? `#${row.license_id}` : null} />
                <AuditDetail label={t('biosChangeAudit.reason')} value={row.reason} />
                <AuditDetail label={t('biosChangeAudit.reviewerNotes')} value={row.reviewer_notes} className="md:col-span-2" />
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function AuditDetail({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-sm text-slate-700 dark:text-slate-300">{value || '--'}</p>
    </div>
  )
}

function TypeBadge({ type }: { type: BiosChangeAuditEntry['type'] }) {
  const { t } = useTranslation()

  if (type === 'direct_change') {
    return <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-sm font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">{t('biosChangeAudit.typeDirectChange')}</span>
  }

  return <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-sm font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">{t('biosChangeAudit.typeRequest')}</span>
}

function AuditStatusBadge({ status }: { status: BiosChangeAuditEntry['status'] }) {
  const { t } = useTranslation()

  const styles: Record<BiosChangeAuditEntry['status'], string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
    completed: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    failed: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }

  const labels: Record<BiosChangeAuditEntry['status'], string> = {
    pending: t('common.pending'),
    approved: t('biosChangeAudit.approved'),
    rejected: t('biosChangeAudit.rejected'),
    completed: t('biosChangeAudit.statusCompleted'),
    failed: t('biosChangeAudit.statusFailed'),
  }

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-sm font-semibold ${styles[status]}`}>{labels[status]}</span>
}
