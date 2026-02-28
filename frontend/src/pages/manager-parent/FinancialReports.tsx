import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Banknote, Download, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { TenantComparisonChart } from '@/components/charts/TenantComparisonChart'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatsCard } from '@/components/shared/StatsCard'
import { Button } from '@/components/ui/button'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/utils'
import { managerParentService } from '@/services/manager-parent.service'
import type { FinancialReportData } from '@/types/manager-parent.types'

function FilterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900/95">
      {children}
    </div>
  )
}

export function FinancialReportsPage() {
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })

  const reportQuery = useQuery({
    queryKey: ['manager-parent', 'financial-reports', range.from, range.to],
    queryFn: () => managerParentService.getFinancialReports(range),
  })

  const report = reportQuery.data?.data

  const columns = useMemo<Array<DataTableColumn<FinancialReportData['reseller_balances'][number]>>>(
    () => [
      { key: 'reseller', label: 'Reseller', sortable: true, sortValue: (row) => row.reseller, render: (row) => row.reseller },
      { key: 'revenue', label: 'Total Revenue', sortable: true, sortValue: (row) => row.total_revenue, render: (row) => formatCurrency(row.total_revenue, 'USD', locale) },
      { key: 'activations', label: 'Activations', sortable: true, sortValue: (row) => row.total_activations, render: (row) => row.total_activations },
      { key: 'avgPrice', label: 'Avg Price', sortable: true, sortValue: (row) => row.avg_price, render: (row) => formatCurrency(row.avg_price, 'USD', locale) },
      { key: 'commission', label: 'Commission', sortable: true, sortValue: (row) => row.commission, render: (row) => formatCurrency(row.commission, 'USD', locale) },
    ],
    [locale],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Reports"
        description="Review tenant revenue, reseller balances, activation volume, and export the current financial view."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => void managerParentService.exportFinancialCsv(range)}>
              <Download className="me-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button type="button" onClick={() => void managerParentService.exportFinancialPdf(range)}>
              <Download className="me-2 h-4 w-4" />
              Export PDF
            </Button>
          </>
        }
      />

      <FilterCard>
        <DateRangePicker value={range} onChange={setRange} />
      </FilterCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard title="Total Tenant Revenue" value={formatCurrency(report?.summary.total_revenue ?? 0, 'USD', locale)} icon={Banknote} color="emerald" />
        <StatsCard title="Total Activations" value={report?.summary.total_activations ?? 0} icon={Activity} color="sky" />
        <StatsCard title="Active Licenses" value={report?.summary.active_licenses ?? 0} icon={ShieldCheck} color="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TenantComparisonChart title="Revenue by Reseller" data={report?.revenue_by_reseller ?? []} dataKey="revenue" xKey="reseller" isLoading={reportQuery.isLoading} />
        <TenantComparisonChart title="Revenue by Program" data={report?.revenue_by_program ?? []} dataKey="revenue" xKey="program" isLoading={reportQuery.isLoading} />
      </div>

      <RevenueChart title="Monthly Revenue Trend" data={report?.monthly_revenue ?? []} dataKey="revenue" xKey="month" isLoading={reportQuery.isLoading} />

      <FilterCard>
        <h3 className="mb-4 text-lg font-semibold">Reseller Balances</h3>
        <DataTable columns={columns} data={report?.reseller_balances ?? []} rowKey={(row) => row.id} isLoading={reportQuery.isLoading} />
      </FilterCard>
    </div>
  )
}
