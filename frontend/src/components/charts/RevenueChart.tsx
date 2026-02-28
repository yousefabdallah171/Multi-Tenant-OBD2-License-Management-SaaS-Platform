import { LineChartWidget } from '@/components/charts/LineChartWidget'

interface RevenueChartProps {
  title: string
  data: object[]
  isLoading?: boolean
  dataKey?: string
  xKey?: string
}

export function RevenueChart({ title, data, isLoading = false, dataKey = 'revenue', xKey = 'month' }: RevenueChartProps) {
  return (
    <LineChartWidget title={title} data={data} isLoading={isLoading} xKey={xKey} series={[{ key: dataKey, label: title }]} />
  )
}
