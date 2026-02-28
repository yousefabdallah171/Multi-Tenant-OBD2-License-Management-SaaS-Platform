import { PieChartWidget } from '@/components/charts/PieChartWidget'

interface PieBreakdownChartProps {
  title: string
  data: object[]
  dataKey?: string
  nameKey?: string
  isLoading?: boolean
}

export function PieBreakdownChart({ title, data, dataKey = 'count', nameKey = 'label', isLoading = false }: PieBreakdownChartProps) {
  return <PieChartWidget title={title} data={data} valueKey={dataKey} nameKey={nameKey} isLoading={isLoading} />
}
