import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Banknote, Download, Users } from 'lucide-react'
import { ActivationTimeline } from '@/components/charts/ActivationTimeline'
import { PieBreakdownChart } from '@/components/charts/PieBreakdownChart'
import { TenantComparisonChart } from '@/components/charts/TenantComparisonChart'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatsCard } from '@/components/shared/StatsCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/utils'
import { managerService } from '@/services/manager.service'
import type { ManagerTopResellerRow } from '@/types/manager-reseller.types'

export function ReportsPage() {
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
  const totalActivations = useMemo(() => (activationsQuery.data?.data ?? []).reduce((sum, item) => sum + item.count, 0), [activationsQuery.data?.data])
  const trackedResellers = topResellersQuery.data?.data.length ?? 0
  const avgRevenue = totalActivations > 0 ? totalRevenue / totalActivations : 0

  const columns = useMemo<Array<DataTableColumn<ManagerTopResellerRow>>>(
    () => [
      { key: 'reseller', label: 'Reseller', sortable: true, sortValue: (row) => row.reseller, render: (row) => row.reseller },
      { key: 'revenue', label: 'Revenue', sortable: true, sortValue: (row) => row.revenue, render: (row) => formatCurrency(row.revenue, 'USD', locale) },
      { key: 'activations', label: 'Activations', sortable: true, sortValue: (row) => row.activations, render: (row) => row.activations },
      { key: 'customers', label: 'Customers', sortable: true, sortValue: (row) => row.customers, render: (row) => row.customers },
    ],
    [locale],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manager"
        title="Reports"
        description="Measure team performance by reseller, activation volume, and revenue contribution for the selected period."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => void managerService.exportCsv(range)}>
              <Download className="me-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button type="button" onClick={() => void managerService.exportPdf(range)}>
              <Download className="me-2 h-4 w-4" />
              Export PDF
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-4">
          <DateRangePicker value={range} onChange={setRange} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Total Revenue" value={formatCurrency(totalRevenue, 'USD', locale)} icon={Banknote} color="emerald" />
        <StatsCard title="Total Activations" value={totalActivations} icon={Activity} color="sky" />
        <StatsCard title="Avg Revenue" value={formatCurrency(avgRevenue, 'USD', locale)} icon={Banknote} color="amber" />
        <StatsCard title="Tracked Resellers" value={trackedResellers} icon={Users} color="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PieBreakdownChart title="Revenue by Reseller" data={revenueQuery.data?.data ?? []} dataKey="revenue" nameKey="reseller" isLoading={revenueQuery.isLoading} />
        <ActivationTimeline title="Team Activations" data={activationsQuery.data?.data ?? []} dataKey="count" xKey="month" isLoading={activationsQuery.isLoading} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TenantComparisonChart
          title="Top Resellers by Revenue"
          data={(topResellersQuery.data?.data ?? []).map((row) => ({ reseller: row.reseller, revenue: row.revenue }))}
          dataKey="revenue"
          xKey="reseller"
          isLoading={topResellersQuery.isLoading}
        />
        <DataTable columns={columns} data={topResellersQuery.data?.data ?? []} rowKey={(row) => row.id ?? row.reseller} isLoading={topResellersQuery.isLoading} />
      </div>
    </div>
  )
}
