import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/hooks/useLanguage'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { liveQueryOptions } from '@/lib/live-query'
import { formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { superAdminBcrService } from '@/services/super-admin-bcr.service'
import type { BiosChangeRequest } from '@/types/manager-reseller.types'

type StatusFilter = '' | 'pending' | 'approved' | 'rejected'

export function BiosChangeRequestsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(15)
  const [status, setStatus] = useState<StatusFilter>('pending')
  const [rejectTarget, setRejectTarget] = useState<BiosChangeRequest | null>(null)
  const [reviewerNotes, setReviewerNotes] = useState('')

  const query = useQuery({
    queryKey: ['super-admin', 'bios-change-requests', page, perPage, status],
    queryFn: () => superAdminBcrService.getBiosChangeRequests({ page, per_page: perPage, status }),
    ...liveQueryOptions(5_000),
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) => superAdminBcrService.approveBiosChangeRequest(id),
    onSuccess: (response) => {
      toast.success(response.message ?? t('biosChangeRequests.approved'))
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'bios-change-requests'] })
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) => superAdminBcrService.rejectBiosChangeRequest(id, notes),
    onSuccess: (response) => {
      toast.success(response.message ?? t('biosChangeRequests.rejected'))
      setRejectTarget(null)
      setReviewerNotes('')
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'bios-change-requests'] })
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  useEffect(() => { setPage(1) }, [status])

  const columns = useMemo<Array<DataTableColumn<BiosChangeRequest>>>(() => [
    {
      key: 'customer_name',
      label: t('common.customer'),
      sortable: true,
      sortValue: (row) => row.customer_name ?? '',
      render: (row) => row.customer_id ? (
        <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.superAdmin.customerDetail(lang, row.customer_id)}>
          {row.customer_name ?? '-'}
        </Link>
      ) : (row.customer_name ?? '-'),
    },
    {
      key: 'old_bios_id',
      label: t('biosChangeRequests.oldBios'),
      sortable: true,
      sortValue: (row) => row.old_bios_id,
      render: (row) => <span className="font-mono">{row.old_bios_id}</span>,
    },
    {
      key: 'new_bios_id',
      label: t('biosChangeRequests.newBios'),
      sortable: true,
      sortValue: (row) => row.new_bios_id,
      render: (row) => <span className="font-mono">{row.new_bios_id}</span>,
    },
    {
      key: 'reason',
      label: t('common.reason'),
      render: (row) => <p className="max-w-xs whitespace-pre-wrap">{row.reason || '-'}</p>,
    },
    {
      key: 'reseller_name',
      label: t('common.reseller'),
      sortable: true,
      sortValue: (row) => row.reseller_name ?? '',
      render: (row) => row.reseller_name ?? '-',
    },
    {
      key: 'created_at',
      label: t('common.date'),
      sortable: true,
      sortValue: (row) => row.created_at ?? '',
      render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-'),
    },
    {
      key: 'status',
      label: t('common.status'),
      sortable: true,
      sortValue: (row) => row.status,
      render: (row) => <StatusPill status={row.status} t={t} />,
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          {row.status === 'pending' ? (
            <>
              <Button type="button" size="sm" onClick={() => approveMutation.mutate(row.id)} disabled={approveMutation.isPending}>
                {t('biosChangeRequests.approve')}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setRejectTarget(row)} disabled={rejectMutation.isPending}>
                {t('biosChangeRequests.reject')}
              </Button>
            </>
          ) : (
            <span className="text-sm text-slate-500 dark:text-slate-400">-</span>
          )}
        </div>
      ),
    },
  ], [approveMutation.isPending, lang, locale, rejectMutation.isPending, t])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="OBD2SW"
        title={t('biosChangeRequests.title')}
        description={t('biosChangeRequests.description')}
      />

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[260px_auto]">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('common.allStatuses')}</option>
            <option value="pending">{t('biosChangeRequests.status.pending')}</option>
            <option value="approved">{t('biosChangeRequests.status.approved')}</option>
            <option value="rejected">{t('biosChangeRequests.status.rejected')}</option>
          </select>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={query.data?.data ?? []}
        isLoading={query.isLoading}
        emptyMessage={t('biosChangeRequests.empty')}
        rowKey={(row) => row.id}
        pagination={{
          page,
          lastPage: query.data?.meta.last_page ?? 1,
          total: query.data?.meta.total ?? 0,
          perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={setPerPage}
      />

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => {
        if (!open) { setRejectTarget(null); setReviewerNotes('') }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('biosChangeRequests.rejectTitle')}</DialogTitle>
            <DialogDescription>{rejectTarget?.customer_name ?? t('biosChangeRequests.description')}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reviewerNotes}
            onChange={(event) => setReviewerNotes(event.target.value)}
            placeholder={t('biosChangeRequests.rejectPlaceholder')}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => { setRejectTarget(null); setReviewerNotes('') }}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectMutation.isPending}
              onClick={() => {
                if (!rejectTarget) return
                if (reviewerNotes.trim().length < 3) { toast.error(t('biosChangeRequests.rejectValidation')); return }
                rejectMutation.mutate({ id: rejectTarget.id, notes: reviewerNotes.trim() })
              }}
            >
              {t('biosChangeRequests.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusPill({ status, t }: { status: BiosChangeRequest['status']; t: (key: string) => string }) {
  const styles: Record<BiosChangeRequest['status'], string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  }
  const labels: Record<BiosChangeRequest['status'], string> = {
    pending: t('biosChangeRequests.status.pending'),
    approved: t('biosChangeRequests.status.approved'),
    rejected: t('biosChangeRequests.status.rejected'),
  }
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>
}
