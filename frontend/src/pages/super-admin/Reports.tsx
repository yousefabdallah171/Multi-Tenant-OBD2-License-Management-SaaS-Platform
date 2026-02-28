import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { ExportButtons } from '@/components/shared/ExportButtons'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/utils'
import { reportService } from '@/services/report.service'

export function ReportsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const params = useMemo(
    () => ({
      from: dateRange.from || undefined,
      to: dateRange.to || undefined,
    }),
    [dateRange],
  )

  const revenueQuery = useQuery({
    queryKey: ['super-admin', 'reports', 'revenue', params],
    queryFn: () => reportService.getRevenue(params),
  })

  const activationsQuery = useQuery({
    queryKey: ['super-admin', 'reports', 'activations', params],
    queryFn: () => reportService.getActivations(params),
  })

  const growthQuery = useQuery({
    queryKey: ['super-admin', 'reports', 'growth', params],
    queryFn: () => reportService.getGrowth(params),
  })

  const topResellersQuery = useQuery({
    queryKey: ['super-admin', 'reports', 'top-resellers', params],
    queryFn: () => reportService.getTopResellers(params),
  })

  const resellerColumns: Array<DataTableColumn<{ reseller: string; tenant: string; activations: number; revenue: number }>> = [
    { key: 'reseller', label: t('superAdmin.pages.reports.topResellers'), sortable: true, sortValue: (row) => row.reseller, render: (row) => row.reseller },
    { key: 'tenant', label: t('common.tenant'), sortable: true, sortValue: (row) => row.tenant, render: (row) => row.tenant },
    { key: 'activations', label: t('common.activations'), sortable: true, sortValue: (row) => row.activations, render: (row) => row.activations },
    { key: 'revenue', label: t('common.revenue'), sortable: true, sortValue: (row) => row.revenue, render: (row) => formatCurrency(row.revenue, 'USD', locale) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold">{t('superAdmin.pages.reports.title')}</h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.reports.description')}</p>
        </div>
        <ExportButtons onExportCsv={() => reportService.exportCsv(params)} onExportPdf={() => reportService.exportPdf(params)} />
      </div>

      <Card>
        <CardContent className="p-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <BarChartWidget
          title={t('superAdmin.pages.reports.revenueByTenant')}
          data={revenueQuery.data?.data ?? []}
          isLoading={revenueQuery.isLoading}
          xKey="tenant"
          horizontal
          showLabels
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <BarChartWidget
          title={t('superAdmin.pages.reports.activationsByTenant')}
          data={activationsQuery.data?.data ?? []}
          isLoading={activationsQuery.isLoading}
          xKey="tenant"
          series={[{ key: 'activations', label: t('common.activations') }]}
        />
      </div>

      <LineChartWidget
        title={t('superAdmin.pages.reports.growthTrend')}
        data={growthQuery.data?.data ?? []}
        isLoading={growthQuery.isLoading}
        xKey="month"
        series={[{ key: 'users', label: t('common.users') }]}
      />

      <DataTable columns={resellerColumns} data={topResellersQuery.data?.data ?? []} rowKey={(row) => `${row.tenant}-${row.reseller}`} isLoading={topResellersQuery.isLoading} />
    </div>
  )
}
