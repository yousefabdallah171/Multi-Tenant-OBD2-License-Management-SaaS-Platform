import { AreaChartWidget } from '@/components/charts/AreaChartWidget'

interface ActivationTimelineProps {
  title: string
  data: object[]
  isLoading?: boolean
  dataKey?: string
  xKey?: string
}

export function ActivationTimeline({ title, data, isLoading = false, dataKey = 'activations', xKey = 'month' }: ActivationTimelineProps) {
  return (
    <AreaChartWidget title={title} data={data} isLoading={isLoading} xKey={xKey} series={[{ key: dataKey, label: title }]} />
  )
}
