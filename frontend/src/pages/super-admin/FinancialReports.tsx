import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, CircleDollarSign, Globe2, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { TenantComparisonChart } from '@/components/charts/TenantComparisonChart'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { ExportButtons } from '@/components/shared/ExportButtons'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/utils'
import { reportService } from '@/services/report.service'
import type { FinancialReportPayload } from '@/types/super-admin.types'

export function FinancialReportsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const params = { from: from || undefined, to: to || undefined }

  const financialQuery = useQuery({
    queryKey: ['super-admin', 'financial-reports', params],
    queryFn: () => reportService.getFinancialReports(params),
  })

  const balancesColumns: Array<DataTableColumn<FinancialReportPayload['reseller_balances'][number]>> = [
    { key: 'reseller', label: t('roles.reseller'), sortable: true, sortValue: (row) => row.reseller ?? '', render: (row) => row.reseller ?? '-' },
    { key: 'tenant', label: t('common.tenant'), sortable: true, sortValue: (row) => row.tenant ?? '', render: (row) => row.tenant ?? '-' },
    { key: 'revenue', label: t('common.revenue'), sortable: true, sortValue: (row) => row.total_revenue, render: (row) => formatCurrency(row.total_revenue, 'USD', locale) },
    { key: 'activations', label: t('common.activations'), sortable: true, sortValue: (row) => row.total_activations, render: (row) => row.total_activations },
    { key: 'avg', label: t('superAdmin.pages.financialReports.avgPrice'), sortable: true, sortValue: (row) => row.avg_price, render: (row) => formatCurrency(row.avg_price, 'USD', locale) },
    { key: 'balance', label: t('superAdmin.pages.financialReports.balance'), sortable: true, sortValue: (row) => row.balance, render: (row) => formatCurrency(row.balance, 'USD', locale) },
  ]

  const data = financialQuery.data?.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold">{t('superAdmin.pages.financialReports.title')}</h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.financialReports.description')}</p>
        </div>
        <ExportButtons onExportCsv={() => void reportService.exportFinancialCsv(params)} onExportPdf={() => void reportService.exportFinancialPdf(params)} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title={t('superAdmin.pages.financialReports.totalPlatformRevenue')} value={formatCurrency(data?.summary.total_platform_revenue ?? 0, 'USD', locale)} icon={Banknote} color="emerald" />
        <StatsCard title={t('superAdmin.pages.financialReports.totalActivations')} value={data?.summary.total_activations ?? 0} icon={Globe2} color="sky" />
        <StatsCard title={t('superAdmin.pages.financialReports.activeLicenses')} value={data?.summary.active_licenses ?? 0} icon={Users} color="amber" />
        <StatsCard title={t('superAdmin.pages.financialReports.avgRevenuePerTenant')} value={formatCurrency(data?.summary.avg_revenue_per_tenant ?? 0, 'USD', locale)} icon={CircleDollarSign} color="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TenantComparisonChart title={t('superAdmin.pages.financialReports.revenueByTenant')} data={data?.revenue_by_tenant ?? []} />
        <TenantComparisonChart title={t('superAdmin.pages.financialReports.revenueByProgram')} data={data?.revenue_by_program ?? []} dataKey="revenue" xKey="program" />
        <RevenueChart title={t('superAdmin.pages.financialReports.monthlyRevenue')} data={data?.monthly_revenue ?? []} />
      </div>

      <DataTable columns={balancesColumns} data={data?.reseller_balances ?? []} rowKey={(row) => row.id} />
    </div>
  )
}
