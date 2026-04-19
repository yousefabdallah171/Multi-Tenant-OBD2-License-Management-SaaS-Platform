import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, ShieldCheck, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { ExportButtons } from '@/components/shared/ExportButtons'
import { RoleIdentity } from '@/components/shared/RoleIdentity'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { useLanguage, type SupportedLanguage } from '@/hooks/useLanguage'
import { localizeMonthLabel } from '@/lib/chart-labels'
import { formatCurrency } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'
import type { ResellerPaymentRow } from '@/types/manager-reseller.types'
import type { UserRole } from '@/types/user.types'

export function ReportsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [range, setRange] = useState<DateRangeValue>(() => resolvePresetRange(365))

  const reportQuery = useQuery({
    queryKey: ['manager', 'financial-reports', range.from, range.to],
    queryFn: () => managerService.getFinancialReports(range),
  })
  const retentionQuery = useQuery({
    queryKey: ['manager', 'reports', 'retention', range.from, range.to],
    queryFn: () => managerService.getRetention(range),
  })
  const paymentRowsQuery = useQuery({
    queryKey: ['manager', 'reports', 'reseller-payments-table'],
    queryFn: () => managerService.getResellerPayments(),
  })

  const report = reportQuery.data?.data
  const paymentRows = paymentRowsQuery.data?.data ?? []
  const monthlyRevenueSeries = (report?.monthly_revenue ?? []).map((item) => ({
    ...item,
    month: item.month ? localizeMonthLabel(item.month, locale) : item.month,
  }))
  const retentionSeries = (retentionQuery.data?.data ?? []).map((item) => ({
    ...item,
    month: item.month ? localizeMonthLabel(item.month, locale) : item.month,
  }))
  const columns = useMemo<Array<DataTableColumn<ResellerPaymentRow>>>(
    () => [
      {
        key: 'reseller_name',
        label: t('managerParent.pages.financialReports.columns.seller'),
        sortable: true,
        sortValue: (row) => row.reseller_name,
        render: (row) => (
          <RoleIdentity
            name={row.reseller_name}
            role={resolveUserRole(row.reseller_role)}
            href={getManagerSellerDetailPath(lang, row.reseller_id, row.reseller_role)}
          />
        ),
      },
      { key: 'total_sales', label: t('payments.columns.sales', { defaultValue: 'Sales' }), sortable: true, sortValue: (row) => row.total_sales, render: (row) => formatCurrency(row.total_sales, 'USD', locale) },
      { key: 'commission_owed', label: t('payments.columns.owed', { defaultValue: 'Commission Owed' }), sortable: true, sortValue: (row) => row.commission_owed, render: (row) => formatCurrency(row.commission_owed, 'USD', locale) },
      { key: 'amount_paid', label: t('payments.columns.paid', { defaultValue: 'Amount Paid' }), sortable: true, sortValue: (row) => row.amount_paid, render: (row) => formatCurrency(row.amount_paid, 'USD', locale) },
      { key: 'outstanding', label: t('payments.columns.outstanding', { defaultValue: 'Outstanding' }), sortable: true, sortValue: (row) => row.outstanding, render: (row) => formatCurrency(row.outstanding, 'USD', locale) },
    ],
    [lang, locale, t],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('manager.layout.eyebrow')}
        title={t('managerParent.pages.financialReports.title')}
        description={t('managerParent.pages.financialReports.description')}
        actions={<ExportButtons onExportCsv={() => managerService.exportFinancialCsv(range)} onExportPdf={() => managerService.exportFinancialPdf(range)} />}
      />

      <Card>
        <CardContent className="p-4">
          <DateRangePicker value={range} onChange={setRange} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatsCard title={t('managerParent.pages.financialReports.totalTenantRevenue')} value={formatCurrency(report?.summary.total_revenue ?? 0, 'USD', locale)} icon={Banknote} color="emerald" />
        <button type="button" className="w-full text-start" onClick={() => navigate(routePaths.manager.customers(lang))}>
          <StatsCard title={t('managerParent.pages.financialReports.totalCustomers')} value={report?.summary.total_customers ?? 0} icon={Users} color="sky" />
        </button>
        <button type="button" className="w-full text-start" onClick={() => navigate(`${routePaths.manager.customers(lang)}?status=active`)}>
          <StatsCard title={t('managerParent.pages.financialReports.activeCustomers')} value={report?.summary.active_customers ?? report?.summary.active_licenses ?? 0} icon={ShieldCheck} color="amber" />
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <BarChartWidget
          title={t('managerParent.pages.financialReports.revenueByReseller')}
          data={report?.revenue_by_reseller ?? []}
          isLoading={reportQuery.isLoading}
          xKey="reseller"
          horizontal
          showLabels
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <BarChartWidget
          title={t('managerParent.pages.financialReports.revenueByProgram')}
          data={report?.revenue_by_program ?? []}
          isLoading={reportQuery.isLoading}
          xKey="program"
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LineChartWidget
          title={t('managerParent.pages.financialReports.monthlyRevenueTrend')}
          data={monthlyRevenueSeries}
          isLoading={reportQuery.isLoading}
          xKey="month"
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <BarChartWidget
          title={t('managerParent.pages.financialReports.stillNotPaidBySeller')}
          description={t('managerParent.pages.financialReports.stillNotPaidHint')}
          data={paymentRows}
          isLoading={paymentRowsQuery.isLoading}
          xKey="reseller_name"
          horizontal
          showLabels
          series={[{ key: 'outstanding', label: t('payments.columns.outstanding', { defaultValue: 'Outstanding' }) }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
      </div>

      <LineChartWidget
        title={t('managerParent.pages.reports.customerRetention')}
        data={retentionSeries}
        isLoading={retentionQuery.isLoading}
        xKey="month"
        series={[{ key: 'customers', label: t('managerParent.pages.reports.customersLabel') }]}
      />

      <Card>
        <CardContent className="p-6">
          <h3 className="mb-2 text-lg font-semibold">{t('managerParent.pages.financialReports.stillNotPaidBySeller')}</h3>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.financialReports.stillNotPaidHint')}</p>
          <DataTable tableKey="manager_reports_balances" columns={columns} data={paymentRows} rowKey={(row) => row.reseller_id} isLoading={paymentRowsQuery.isLoading} />
        </CardContent>
      </Card>
    </div>
  )
}

function resolveUserRole(role?: string | null): UserRole | null {
  if (role === 'super_admin' || role === 'manager_parent' || role === 'manager' || role === 'reseller' || role === 'customer') {
    return role
  }

  return null
}

function getManagerSellerDetailPath(lang: SupportedLanguage, id: number, role?: string | null) {
  if (!id || role !== 'reseller') {
    return undefined
  }

  return routePaths.manager.teamMemberDetail(lang, id)
}

function resolvePresetRange(days: number): DateRangeValue {
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - (days - 1))

  return {
    from: formatDateInput(from),
    to: formatDateInput(today),
  }
}

function formatDateInput(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
