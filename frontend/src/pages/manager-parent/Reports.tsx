import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Banknote, CheckCircle2, Download } from 'lucide-react'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { PieBreakdownChart } from '@/components/charts/PieBreakdownChart'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { TenantComparisonChart } from '@/components/charts/TenantComparisonChart'
import { StatsCard } from '@/components/shared/StatsCard'
import { Button } from '@/components/ui/button'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/utils'
import { managerParentService } from '@/services/manager-parent.service'

function CardSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900/95">
      {children}
    </div>
  )
}

export function ReportsPage() {
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })

  const revenueByResellerQuery = useQuery({
    queryKey: ['manager-parent', 'reports', 'revenue-by-reseller', range.from, range.to],
    queryFn: () => managerParentService.getRevenueByReseller(range),
  })

  const revenueByProgramQuery = useQuery({
    queryKey: ['manager-parent', 'reports', 'revenue-by-program', range.from, range.to],
    queryFn: () => managerParentService.getRevenueByProgram(range),
  })

  const activationRateQuery = useQuery({
    queryKey: ['manager-parent', 'reports', 'activation-rate', range.from, range.to],
    queryFn: () => managerParentService.getActivationRate(range),
  })

  const retentionQuery = useQuery({
    queryKey: ['manager-parent', 'reports', 'retention', range.from, range.to],
    queryFn: () => managerParentService.getRetention(range),
  })

  const totalRevenue = useMemo(() => (revenueByResellerQuery.data?.data ?? []).reduce((sum, item) => sum + item.revenue, 0), [revenueByResellerQuery.data?.data])
  const totalActivations = useMemo(() => (revenueByResellerQuery.data?.data ?? []).reduce((sum, item) => sum + item.activations, 0), [revenueByResellerQuery.data?.data])
  const successRate = activationRateQuery.data?.data.find((item) => item.label === 'Success')?.percentage ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Analyze reseller and program revenue, activation quality, and customer retention for the selected date range."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => void managerParentService.exportReportsCsv(range)}>
              <Download className="me-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button type="button" onClick={() => void managerParentService.exportReportsPdf(range)}>
              <Download className="me-2 h-4 w-4" />
              Export PDF
            </Button>
          </>
        }
      />

      <CardSection>
        <DateRangePicker value={range} onChange={setRange} />
      </CardSection>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard title="Total Revenue" value={formatCurrency(totalRevenue, 'USD', locale)} icon={Banknote} color="emerald" />
        <StatsCard title="Total Activations" value={totalActivations} icon={Activity} color="sky" />
        <StatsCard title="Success Rate" value={`${successRate.toFixed(1)}%`} icon={CheckCircle2} color="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PieBreakdownChart title="Revenue by Reseller" data={revenueByResellerQuery.data?.data ?? []} nameKey="reseller" dataKey="revenue" isLoading={revenueByResellerQuery.isLoading} />
        <TenantComparisonChart title="Revenue by Program" data={revenueByProgramQuery.data?.data ?? []} dataKey="revenue" xKey="program" isLoading={revenueByProgramQuery.isLoading} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PieBreakdownChart title="Activation Success / Failure" data={activationRateQuery.data?.data ?? []} nameKey="label" dataKey="count" isLoading={activationRateQuery.isLoading} />
        <RevenueChart title="Customer Retention" data={retentionQuery.data?.data ?? []} dataKey="customers" xKey="month" isLoading={retentionQuery.isLoading} />
      </div>
    </div>
  )
}
