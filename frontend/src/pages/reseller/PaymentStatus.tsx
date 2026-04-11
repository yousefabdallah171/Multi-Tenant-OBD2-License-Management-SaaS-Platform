import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, Wallet, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { resellerService } from '@/services/reseller.service'
import type { ResellerPayment } from '@/types/manager-reseller.types'

export function PaymentStatusPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'

  const query = useQuery({
    queryKey: ['reseller', 'payment-status'],
    queryFn: () => resellerService.getPaymentStatus(),
  })

  const data = query.data?.data
  const outstandingBalance = data?.summary.outstanding_balance ?? 0
  const hasCreditBalance = outstandingBalance < 0
  const hasDebitBalance = outstandingBalance > 0
  const balanceCardTitle = hasCreditBalance
    ? t('payments.summary.creditToReceive', { defaultValue: 'Your Advanced Payment (Your Deposit)' })
    : t('payments.summary.remainingToPay', { defaultValue: 'Still Not Paid' })
  const balanceCardValue = formatCurrency(hasCreditBalance ? Math.abs(outstandingBalance) : outstandingBalance, 'USD', locale)
  const paymentColumns = useMemo<Array<DataTableColumn<ResellerPayment>>>(() => [
    { key: 'payment_date', label: t('payments.columns.date'), sortable: true, sortValue: (row) => row.payment_date ?? '', render: (row) => (row.payment_date ? formatDate(row.payment_date, locale) : '-') },
    { key: 'amount', label: t('payments.columns.amount'), sortable: true, sortValue: (row) => row.amount, render: (row) => formatCurrency(row.amount, 'USD', locale) },
    { key: 'notes', label: t('payments.columns.notes'), render: (row) => row.notes || '-' },
  ], [locale, t])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('roles.reseller')}
        title={t('payments.statusTitle')}
        description={t('payments.statusSimpleDescription', { defaultValue: 'See your sales total, what you already paid to your manager, and what is still left to pay.' })}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <StatsCard title={t('payments.summary.totalSales')} value={formatCurrency(data?.summary.total_sales ?? 0, 'USD', locale)} icon={WalletCards} color="sky" />
        <StatsCard title={t('payments.summary.totalPaidToManager', { defaultValue: 'Amount You Paid to Manager' })} value={formatCurrency(data?.summary.total_paid ?? 0, 'USD', locale)} icon={Banknote} color="emerald" />
        <StatsCard
          title={balanceCardTitle}
          value={balanceCardValue}
          icon={Wallet}
          color={hasCreditBalance || !hasDebitBalance ? 'sky' : 'rose'}
          className={hasCreditBalance || !hasDebitBalance
            ? 'ring-1 ring-sky-300/60 shadow-[0_0_18px_rgba(56,189,248,0.35)] dark:ring-sky-500/40'
            : 'ring-1 ring-rose-300/60 shadow-[0_0_18px_rgba(244,63,94,0.35)] dark:ring-rose-500/40'}
        />
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>{t('payments.sections.history')}</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('payments.sections.historyHint', { defaultValue: 'These are the payments you already made to your manager.' })}
          </p>
        </CardHeader>
        <CardContent>
          <DataTable tableKey="reseller_payment_history" columns={paymentColumns} data={data?.payment_history ?? []} rowKey={(row) => row.id} isLoading={query.isLoading} emptyMessage={t('payments.empty.payments')} />
        </CardContent>
      </Card>
    </div>
  )
}
