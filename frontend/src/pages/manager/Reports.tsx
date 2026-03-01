import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Banknote, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { PieChartWidget } from '@/components/charts/PieChartWidget'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { ExportButtons } from '@/components/shared/ExportButtons'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { useLanguage } from '@/hooks/useLanguage'
import { localizeMonthLabel } from '@/lib/chart-labels'
import { formatCurrency } from '@/lib/utils'
import { managerService } from '@/services/manager.service'
import type { ManagerTopResellerRow } from '@/types/manager-reseller.types'

export function ReportsPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })

  const revenueQuery = useQuery({
    queryKey: ['manager', 'reports', 'revenue', range.from, range.to],
    queryFn: () => managerService.getRevenueReport(range),
  })

  const activationsQuery = useQuery({
    queryKey: ['manager', 'reports', 'activations', range.from, range.to],
    queryFn: () => managerService.getActivationsReport(range),
  })

  const topResellersQuery = useQuery({
    queryKey: ['manager', 'reports', 'top-resellers', range.from, range.to],
    queryFn: () => managerService.getTopResellers(range),
  })

  const totalRevenue = useMemo(() => (revenueQuery.data?.data ?? []).reduce((sum, item) => sum + item.revenue, 0), [revenueQuery.data?.data])
  const totalActivations = useMemo(() => (activationsQuery.data?.data ?? []).reduce((sum, item) => sum + (item.count ?? 0), 0), [activationsQuery.data?.data])
  const trackedResellers = topResellersQuery.data?.data.length ?? 0
  const avgRevenue = totalActivations > 0 ? totalRevenue / totalActivations : 0
  const activationSeries = (activationsQuery.data?.data ?? []).map((point) => ({
    ...point,
    month: point.month ? localizeMonthLabel(point.month, locale) : point.month,
  }))

  const columns = useMemo<Array<DataTableColumn<ManagerTopResellerRow>>>(
    () => [
      { key: 'reseller', label: t('manager.pages.reports.columns.reseller'), sortable: true, sortValue: (row) => row.reseller, render: (row) => row.reseller },
      { key: 'revenue', label: t('common.revenue'), sortable: true, sortValue: (row) => row.revenue, render: (row) => formatCurrency(row.revenue, 'USD', locale) },
      { key: 'activations', label: t('common.activations'), sortable: true, sortValue: (row) => row.activations, render: (row) => row.activations },
      { key: 'customers', label: t('manager.pages.dashboard.teamCustomers'), sortable: true, sortValue: (row) => row.customers, render: (row) => row.customers },
    ],
    [locale, t],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('manager.layout.eyebrow')}
        title={t('manager.pages.reports.title')}
        description={t('manager.pages.reports.description')}
        actions={<ExportButtons onExportCsv={() => managerService.exportCsv(range)} onExportPdf={() => managerService.exportPdf(range)} />}
      />

      <Card>
        <CardContent className="p-4">
          <DateRangePicker value={range} onChange={setRange} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatsCard title={t('manager.pages.reports.totalRevenue')} value={formatCurrency(totalRevenue, 'USD', locale)} icon={Banknote} color="emerald" />
        <StatsCard title={t('manager.pages.reports.totalActivations')} value={totalActivations} icon={Activity} color="sky" />
        <StatsCard title={t('manager.pages.reports.avgRevenue')} value={formatCurrency(avgRevenue, 'USD', locale)} icon={Banknote} color="amber" />
        <StatsCard title={t('manager.pages.reports.trackedResellers')} value={trackedResellers} icon={Users} color="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PieChartWidget
          title={t('manager.pages.reports.revenueByReseller')}
          data={revenueQuery.data?.data ?? []}
          isLoading={revenueQuery.isLoading}
          nameKey="reseller"
          valueKey="revenue"
          totalLabel={t('common.revenue')}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <LineChartWidget
          title={t('manager.pages.reports.teamActivations')}
          data={activationSeries}
          isLoading={activationsQuery.isLoading}
          xKey="month"
          series={[{ key: 'count', label: t('common.activations') }]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <BarChartWidget
          title={t('manager.pages.reports.topResellersByRevenue')}
          data={(topResellersQuery.data?.data ?? []).map((row) => ({ reseller: row.reseller, revenue: row.revenue }))}
          isLoading={topResellersQuery.isLoading}
          xKey="reseller"
          horizontal
          showLabels
          series={[{ key: 'revenue', label: t('common.revenue') }]}
          valueFormatter={(value) => formatCurrency(Number(value), 'USD', locale)}
        />
        <DataTable columns={columns} data={topResellersQuery.data?.data ?? []} rowKey={(row) => row.id ?? row.reseller} isLoading={topResellersQuery.isLoading} />
      </div>
    </div>
  )
}
