import type { ReactNode } from 'react'
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { BaseChart } from '@/components/charts/BaseChart'
import { ChartCard } from '@/components/charts/ChartCard'
import { type ChartSeries, formatChartNumber, resolveSeriesColor, useChartTheme } from '@/components/charts/chart-theme'

type ChartRow = object
type ValueFormatter<TData extends ChartRow> = (value: number | string, seriesKey: string, payload: TData) => string

interface LineChartWidgetProps<TData extends ChartRow = ChartRow> {
  title: string
  description?: string
  data: TData[]
  xKey: string
  series: ChartSeries[]
  isLoading?: boolean
  actions?: ReactNode
  heightClassName?: string
  emptyDescription?: string
  showLegend?: boolean
  valueFormatter?: ValueFormatter<TData>
  xAxisFormatter?: (value: string | number) => string
  tooltipLabelFormatter?: (value: string | number) => string
}

export function LineChartWidget<TData extends ChartRow>({
  title,
  description,
  data,
  xKey,
  series,
  isLoading = false,
  actions,
  heightClassName,
  emptyDescription,
  showLegend,
  valueFormatter,
  xAxisFormatter,
  tooltipLabelFormatter,
}: LineChartWidgetProps<TData>) {
  const { palette, seriesColors, locale, isRtl } = useChartTheme()

  return (
    <ChartCard title={title} description={description} actions={actions}>
      <BaseChart data={data} isLoading={isLoading} heightClassName={heightClassName} emptyDescription={emptyDescription}>
        <LineChart data={data} margin={{ top: 8, right: isRtl ? 12 : 20, left: isRtl ? 20 : 12, bottom: 0 }}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey={xKey} stroke={palette.axis} tickLine={false} axisLine={false} tickMargin={10} tickFormatter={xAxisFormatter} />
          <YAxis
            stroke={palette.axis}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value) => formatChartNumber(value, locale)}
          />
          <Tooltip
            contentStyle={{ backgroundColor: palette.tooltipBackground, borderColor: palette.tooltipBorder, borderRadius: 16 }}
            labelStyle={{ color: palette.axis }}
            formatter={(value: number | string | undefined, name: string | undefined, item) => {
              const payload = item.payload as TData
              const label = series.find((entry) => entry.key === name)?.label ?? name ?? ''
              const resolvedValue = value ?? 0
              const formatted = valueFormatter ? valueFormatter(resolvedValue, name ?? '', payload) : formatChartNumber(resolvedValue, locale)

              return [formatted, label]
            }}
            labelFormatter={(value) => (tooltipLabelFormatter ? tooltipLabelFormatter(value) : xAxisFormatter ? xAxisFormatter(value) : String(value))}
          />
          {(showLegend ?? series.length > 1) ? <Legend /> : null}
          {series.map((entry, index) => (
            <Line
              key={entry.key}
              type="monotone"
              dataKey={entry.key}
              name={entry.label ?? entry.key}
              stroke={resolveSeriesColor(entry, index, seriesColors)}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </BaseChart>
    </ChartCard>
  )
}
