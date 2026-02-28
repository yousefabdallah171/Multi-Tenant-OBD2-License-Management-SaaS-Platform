import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Banknote, Download, Target } from 'lucide-react'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { TenantComparisonChart } from '@/components/charts/TenantComparisonChart'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { StatsCard } from '@/components/shared/StatsCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { resellerService } from '@/services/reseller.service'
import { formatCurrency } from '@/lib/utils'

export function ReportsPage() {
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')

  const revenueQuery = useQuery({
    queryKey: ['reseller', 'reports', 'revenue', range.from, range.to, period],
    queryFn: () => resellerService.getRevenueReport({ ...range, period }),
  })

  const activationsQuery = useQuery({
    queryKey: ['reseller', 'reports', 'activations', range.from, range.to, period],
    queryFn: () => resellerService.getActivationsReport({ ...range, period }),
  })

  const programsQuery = useQuery({
    queryKey: ['reseller', 'reports', 'top-programs', range.from, range.to],
    queryFn: () => resellerService.getTopPrograms(range),
  })

  const statsQuery = useQuery({
    queryKey: ['reseller', 'reports', 'dashboard-stats'],
    queryFn: () => resellerService.getDashboardStats(),
  })

  const totalRevenue = useMemo(() => (revenueQuery.data?.data ?? []).reduce((sum, item) => sum + item.revenue, 0), [revenueQuery.data?.data])
  const totalActivations = useMemo(() => (activationsQuery.data?.data ?? []).reduce((sum, item) => sum + item.count, 0), [activationsQuery.data?.data])
  const avgPrice = totalActivations > 0 ? totalRevenue / totalActivations : 0
  const successRate = totalActivations > 0 ? ((statsQuery.data?.stats.active_licenses ?? 0) / totalActivations) * 100 : 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reseller"
        title="Reports"
        description="Analyze personal reseller revenue, activation volume, and top-selling programs across the selected date range."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => void resellerService.exportCsv({ ...range, period })}>
              <Download className="me-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button type="button" onClick={() => void resellerService.exportPdf({ ...range, period })}>
              <Download className="me-2 h-4 w-4" />
              Export PDF
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <DateRangePicker value={range} onChange={setRange} />
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as 'daily' | 'weekly' | 'monthly')}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={Banknote} color="emerald" />
        <StatsCard title="Total Activations" value={totalActivations} icon={Activity} color="sky" />
        <StatsCard title="Avg Price" value={formatCurrency(avgPrice)} icon={Target} color="amber" />
        <StatsCard title="Success Rate" value={`${Math.max(0, Math.min(100, successRate)).toFixed(1)}%`} icon={Target} color="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RevenueChart title="Revenue" data={revenueQuery.data?.data ?? []} dataKey="revenue" xKey="period" isLoading={revenueQuery.isLoading} />
        <TenantComparisonChart title="Activation Count" data={activationsQuery.data?.data ?? []} dataKey="count" xKey="period" isLoading={activationsQuery.isLoading} />
      </div>

      <Card>
        <CardContent className="h-96 p-4">
          <h3 className="mb-4 text-lg font-semibold">Top Programs by Sales</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={programsQuery.data?.data ?? []} layout="vertical" margin={{ left: 40, right: 20, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis type="number" stroke="#64748b" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="program" stroke="#64748b" tickLine={false} axisLine={false} width={120} />
              <Tooltip />
              <Bar dataKey="revenue" fill="#0f766e" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
