import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BadgeDollarSign, Banknote, ReceiptText, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatsCard } from '@/components/shared/StatsCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/hooks/useLanguage'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { RecordPaymentPayload, ResellerCommission, ResellerPayment, ResellerPaymentDetailData, StoreCommissionPayload } from '@/types/manager-reseller.types'

interface RoleResellerPaymentDetailPageProps {
  eyebrow: string
  queryKeyPrefix: string
  listPath: (lang: 'ar' | 'en') => string
  fetchDetail: (resellerId: number) => Promise<{ data: ResellerPaymentDetailData }>
  recordPayment: (payload: RecordPaymentPayload) => Promise<{ message?: string }>
  updatePayment: (paymentId: number, payload: RecordPaymentPayload) => Promise<{ message?: string }>
  storeCommission: (payload: StoreCommissionPayload) => Promise<{ message?: string }>
}

type PaymentDialogState = { mode: 'create' | 'edit'; payment?: ResellerPayment } | null
type CommissionDialogState = { mode: 'create' | 'edit'; commission?: ResellerCommission } | null

export function RoleResellerPaymentDetailPage({
  eyebrow,
  queryKeyPrefix,
  listPath,
  fetchDetail,
  recordPayment,
  updatePayment,
  storeCommission,
}: RoleResellerPaymentDetailPageProps) {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const { resellerId } = useParams<{ resellerId: string }>()
  const resolvedResellerId = Number(resellerId)
  const [paymentDialog, setPaymentDialog] = useState<PaymentDialogState>(null)
  const [commissionDialog, setCommissionDialog] = useState<CommissionDialogState>(null)
  const [paymentForm, setPaymentForm] = useState({
    commission_id: 0,
    amount: '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'bank_transfer' as RecordPaymentPayload['payment_method'],
    reference: '',
    notes: '',
  })
  const [commissionForm, setCommissionForm] = useState({
    period: new Date().toISOString().slice(0, 7),
    total_sales: '',
    commission_rate: '',
    commission_owed: '',
    notes: '',
  })

  const query = useQuery({
    queryKey: [queryKeyPrefix, 'reseller-payment-detail', resolvedResellerId],
    queryFn: () => fetchDetail(resolvedResellerId),
    enabled: Number.isFinite(resolvedResellerId),
  })

  const detail = query.data?.data

  const paymentMutation = useMutation({
    mutationFn: (payload: { paymentId?: number; body: RecordPaymentPayload }) => {
      if (payload.paymentId) {
        return updatePayment(payload.paymentId, payload.body)
      }

      return recordPayment(payload.body)
    },
    onSuccess: (response) => {
      toast.success(response.message ?? t('payments.messages.paymentSaved'))
      setPaymentDialog(null)
      resetPaymentForm()
      void queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, 'reseller-payments'] })
      void queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, 'reseller-payment-detail', resolvedResellerId] })
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  const commissionMutation = useMutation({
    mutationFn: (payload: StoreCommissionPayload) => storeCommission(payload),
    onSuccess: (response) => {
      toast.success(response.message ?? t('payments.messages.commissionSaved'))
      setCommissionDialog(null)
      resetCommissionForm()
      void queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, 'reseller-payments'] })
      void queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, 'reseller-payment-detail', resolvedResellerId] })
    },
    onError: (error) => toast.error(resolveApiErrorMessage(error, t('common.error'))),
  })

  const commissionColumns = useMemo<Array<DataTableColumn<ResellerCommission>>>(() => [
    { key: 'period', label: t('payments.columns.period'), sortable: true, sortValue: (row) => row.period, render: (row) => row.period },
    { key: 'total_sales', label: t('payments.columns.sales'), sortable: true, sortValue: (row) => row.total_sales, render: (row) => formatCurrency(row.total_sales, 'USD', locale) },
    { key: 'commission_rate', label: t('payments.columns.rate'), sortable: true, sortValue: (row) => row.commission_rate, render: (row) => `${row.commission_rate}%` },
    { key: 'commission_owed', label: t('payments.columns.owed'), sortable: true, sortValue: (row) => row.commission_owed, render: (row) => formatCurrency(row.commission_owed, 'USD', locale) },
    { key: 'amount_paid', label: t('payments.columns.paid'), sortable: true, sortValue: (row) => row.amount_paid, render: (row) => formatCurrency(row.amount_paid, 'USD', locale) },
    { key: 'outstanding', label: t('payments.columns.outstanding'), sortable: true, sortValue: (row) => row.outstanding, render: (row) => formatCurrency(row.outstanding, 'USD', locale) },
    { key: 'status', label: t('common.status'), render: (row) => <PaymentStatusPill status={row.status} /> },
    { key: 'actions', label: t('common.actions'), render: (row) => <Button type="button" size="sm" variant="outline" onClick={() => openCommissionDialog('edit', row)}>{t('payments.actions.editCommission')}</Button> },
  ], [locale, t])

  const paymentColumns = useMemo<Array<DataTableColumn<ResellerPayment>>>(() => [
    { key: 'payment_date', label: t('payments.columns.date'), sortable: true, sortValue: (row) => row.payment_date ?? '', render: (row) => (row.payment_date ? formatDate(row.payment_date, locale) : '-') },
    { key: 'period', label: t('payments.columns.period'), render: (row) => row.period ?? '-' },
    { key: 'amount', label: t('payments.columns.amount'), sortable: true, sortValue: (row) => row.amount, render: (row) => formatCurrency(row.amount, 'USD', locale) },
    { key: 'payment_method', label: t('payments.columns.method'), render: (row) => t(`payments.methods.${row.payment_method}`) },
    { key: 'reference', label: t('payments.columns.reference'), render: (row) => row.reference || '-' },
    { key: 'notes', label: t('payments.columns.notes'), render: (row) => row.notes || '-' },
    { key: 'actions', label: t('common.actions'), render: (row) => <Button type="button" size="sm" variant="outline" onClick={() => openPaymentDialog('edit', row)}>{t('payments.actions.editPayment')}</Button> },
  ], [locale, t])

  function resetPaymentForm() {
    setPaymentForm({
      commission_id: detail?.commissions[0]?.id ?? 0,
      amount: '',
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: 'bank_transfer',
      reference: '',
      notes: '',
    })
  }

  function resetCommissionForm() {
    setCommissionForm({
      period: new Date().toISOString().slice(0, 7),
      total_sales: '',
      commission_rate: '',
      commission_owed: '',
      notes: '',
    })
  }

  function openPaymentDialog(mode: 'create' | 'edit', payment?: ResellerPayment) {
    setPaymentDialog({ mode, payment })

    if (mode === 'edit' && payment) {
      setPaymentForm({
        commission_id: payment.commission_id,
        amount: String(payment.amount),
        payment_date: payment.payment_date ?? new Date().toISOString().slice(0, 10),
        payment_method: payment.payment_method,
        reference: payment.reference ?? '',
        notes: payment.notes ?? '',
      })
      return
    }

    resetPaymentForm()
  }

  function openCommissionDialog(mode: 'create' | 'edit', commission?: ResellerCommission) {
    setCommissionDialog({ mode, commission })

    if (mode === 'edit' && commission) {
      setCommissionForm({
        period: commission.period,
        total_sales: String(commission.total_sales),
        commission_rate: String(commission.commission_rate),
        commission_owed: String(commission.commission_owed),
        notes: commission.notes ?? '',
      })
      return
    }

    resetCommissionForm()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-start">
        <Button type="button" variant="outline" onClick={() => navigate(listPath(lang))}>
          <ArrowLeft className="me-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>

      <PageHeader
        eyebrow={eyebrow}
        title={detail?.reseller.name ?? t('payments.title')}
        description={detail?.reseller.email ?? t('payments.description')}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <StatsCard title={t('payments.summary.totalSales', { defaultValue: 'Total Sales' })} value={formatCurrency(detail?.summary.total_sales ?? 0, 'USD', locale)} icon={BadgeDollarSign} color="sky" />
        <StatsCard title={t('payments.summary.totalOwedFromReseller', { defaultValue: 'Total Owed by Reseller' })} value={formatCurrency(detail?.summary.total_owed ?? 0, 'USD', locale)} icon={ReceiptText} color="amber" />
        <StatsCard title={t('payments.summary.totalPaidByReseller', { defaultValue: 'Total Paid by Reseller' })} value={formatCurrency(detail?.summary.total_paid ?? 0, 'USD', locale)} icon={Banknote} color="emerald" />
        <StatsCard title={t('payments.summary.remainingFromReseller', { defaultValue: 'Still Not Paid' })} value={formatCurrency(detail?.summary.total_outstanding ?? 0, 'USD', locale)} icon={Wallet} color="rose" />
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>{t('payments.sections.amountsOwedByPeriod', { defaultValue: 'Amounts Owed by Period' })}</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('payments.sections.amountsOwedByPeriodHint', { defaultValue: 'Each row shows what this reseller sold, what they owe for that period, what they already paid, and what is still left.' })}
          </p>
        </CardHeader>
        <CardContent>
          <DataTable columns={commissionColumns} data={detail?.commissions ?? []} rowKey={(row) => row.id} isLoading={query.isLoading} emptyMessage={t('payments.empty.commissions')} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>{t('payments.sections.history')}</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('payments.sections.managerHistoryHint', { defaultValue: 'These are the payments this reseller already paid to you.' })}
          </p>
        </CardHeader>
        <CardContent>
          <DataTable columns={paymentColumns} data={detail?.payments ?? []} rowKey={(row) => row.id} isLoading={query.isLoading} emptyMessage={t('payments.empty.payments')} />
        </CardContent>
      </Card>

      <Dialog open={Boolean(paymentDialog)} onOpenChange={(open) => { if (!open) { setPaymentDialog(null); resetPaymentForm() } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{paymentDialog?.mode === 'edit' ? t('payments.dialogs.editPayment') : t('payments.dialogs.recordPayment')}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-medium">{t('payments.fields.commission')}</span>
              <select value={paymentForm.commission_id} onChange={(event) => setPaymentForm((current) => ({ ...current, commission_id: Number(event.target.value) }))} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                {(detail?.commissions ?? []).map((commission) => <option key={commission.id} value={commission.id}>{commission.period} - {formatCurrency(commission.outstanding, 'USD', locale)}</option>)}
              </select>
            </label>
            <Input value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} placeholder={t('payments.fields.amount')} />
            <Input type="date" value={paymentForm.payment_date} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_date: event.target.value }))} />
            <select value={paymentForm.payment_method} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_method: event.target.value as RecordPaymentPayload['payment_method'] }))} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="bank_transfer">{t('payments.methods.bank_transfer')}</option>
              <option value="cash">{t('payments.methods.cash')}</option>
              <option value="other">{t('payments.methods.other')}</option>
            </select>
            <Input value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} placeholder={t('payments.fields.reference')} />
            <Textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} placeholder={t('payments.fields.notes')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => { setPaymentDialog(null); resetPaymentForm() }}>{t('common.cancel')}</Button>
            <Button type="button" disabled={paymentMutation.isPending} onClick={() => {
              if (!detail || !paymentForm.commission_id || Number(paymentForm.amount) <= 0 || paymentForm.payment_date === '') {
                toast.error(t('payments.validation.payment'))
                return
              }

              paymentMutation.mutate({
                paymentId: paymentDialog?.payment?.id,
                body: {
                  commission_id: paymentForm.commission_id,
                  reseller_id: detail.reseller.id,
                  amount: Number(paymentForm.amount),
                  payment_date: paymentForm.payment_date,
                  payment_method: paymentForm.payment_method,
                  reference: paymentForm.reference.trim() || undefined,
                  notes: paymentForm.notes.trim() || undefined,
                },
              })
            }}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(commissionDialog)} onOpenChange={(open) => { if (!open) { setCommissionDialog(null); resetCommissionForm() } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{commissionDialog?.mode === 'edit' ? t('payments.dialogs.editCommission') : t('payments.dialogs.addCommission')}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Input type="month" value={commissionForm.period} onChange={(event) => setCommissionForm((current) => ({ ...current, period: event.target.value }))} />
            <Input value={commissionForm.total_sales} onChange={(event) => setCommissionForm((current) => ({ ...current, total_sales: event.target.value }))} placeholder={t('payments.fields.totalSales')} />
            <Input value={commissionForm.commission_rate} onChange={(event) => setCommissionForm((current) => ({ ...current, commission_rate: event.target.value }))} placeholder={t('payments.fields.commissionRate')} />
            <Input value={commissionForm.commission_owed} onChange={(event) => setCommissionForm((current) => ({ ...current, commission_owed: event.target.value }))} placeholder={t('payments.fields.commissionOwed')} />
            <Textarea value={commissionForm.notes} onChange={(event) => setCommissionForm((current) => ({ ...current, notes: event.target.value }))} placeholder={t('payments.fields.notes')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => { setCommissionDialog(null); resetCommissionForm() }}>{t('common.cancel')}</Button>
            <Button type="button" disabled={commissionMutation.isPending} onClick={() => {
              if (!detail || commissionForm.period === '' || Number(commissionForm.commission_rate) < 0 || Number(commissionForm.commission_owed) < 0) {
                toast.error(t('payments.validation.commission'))
                return
              }

              commissionMutation.mutate({
                reseller_id: detail.reseller.id,
                period: commissionForm.period,
                total_sales: Number(commissionForm.total_sales || 0),
                commission_rate: Number(commissionForm.commission_rate || 0),
                commission_owed: Number(commissionForm.commission_owed || 0),
                notes: commissionForm.notes.trim() || undefined,
              })
            }}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PaymentStatusPill({ status }: { status: ResellerCommission['status'] }) {
  const { t } = useTranslation()

  const tone = {
    unpaid: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    partial: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  }[status]

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{t(`payments.status.${status}`)}</span>
}
