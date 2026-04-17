import type { ReactNode } from 'react'
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { BaseChart } from '@/components/charts/BaseChart'
import { ChartCard } from '@/components/charts/ChartCard'
import { type ChartSeries, formatChartNumber, resolveSeriesColor, useChartTheme } from '@/components/charts/chart-theme'

type ChartRow = object
type ValueFormatter<TData extends ChartRow> = (value: number | string, seriesKey: string, payload: TData) => string

type TooltipLabelFormatter<TData extends ChartRow> = (value: string | number, payload?: TData) => string

function resolveTooltipValue(value: unknown): number | string {
  if (typeof value === 'number' || typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    const firstPrimitive = value.find((item) => typeof item === 'number' || typeof item === 'string')

    if (typeof firstPrimitive === 'number' || typeof firstPrimitive === 'string') {
      return firstPrimitive
    }
  }

  return 0
}

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
  tooltipLabelFormatter?: TooltipLabelFormatter<TData>
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
          <XAxis dataKey={xKey} stroke={palette.axis} tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} tick={{ fontSize: 12 }} tickFormatter={xAxisFormatter} />
          <YAxis
            stroke={palette.axis}
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => formatChartNumber(value, locale)}
          />
          <Tooltip
            contentStyle={{ backgroundColor: palette.tooltipBackground, borderColor: palette.tooltipBorder, borderRadius: 16 }}
            labelStyle={{ color: palette.axis }}
            formatter={(value, name, item) => {
              const payload = item.payload as TData
              const seriesKey = String(name ?? '')
              const label = series.find((entry) => entry.key === seriesKey)?.label ?? seriesKey
              const resolvedValue = resolveTooltipValue(value)
              const formatted = valueFormatter ? valueFormatter(resolvedValue, seriesKey, payload) : formatChartNumber(resolvedValue, locale)

              return [formatted, label]
            }}
            labelFormatter={(value, payload) => {
              const row = (payload?.[0]?.payload as TData | undefined)
              if (tooltipLabelFormatter) {
                return tooltipLabelFormatter(value, row)
              }
              return xAxisFormatter ? xAxisFormatter(value) : String(value)
            }}
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
