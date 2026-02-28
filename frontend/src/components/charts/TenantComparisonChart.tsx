import { BarChartWidget } from '@/components/charts/BarChartWidget'

interface TenantComparisonChartProps {
  title: string
  data: object[]
  isLoading?: boolean
  dataKey?: string
  xKey?: string
}

export function TenantComparisonChart({ title, data, isLoading = false, dataKey = 'revenue', xKey = 'tenant' }: TenantComparisonChartProps) {
  return (
    <BarChartWidget title={title} data={data} isLoading={isLoading} xKey={xKey} series={[{ key: dataKey, label: title }]} />
  )
}
