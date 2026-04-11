import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { BaseChart } from '@/components/charts/BaseChart'
import { ChartCard } from '@/components/charts/ChartCard'
import { type ChartSeries, formatChartNumber, resolveSeriesColor, useChartTheme } from '@/components/charts/chart-theme'

type ChartRow = object
type ValueFormatter<TData extends ChartRow> = (value: number | string, seriesKey: string, payload: TData) => string
type TooltipLabelFormatter<TData extends ChartRow> = (value: string | number, payload?: TData) => string

interface BarChartWidgetProps<TData extends ChartRow = ChartRow> {
  title: string
  description?: string
  data: TData[]
  xKey: string
  series: ChartSeries[]
  isLoading?: boolean
  actions?: ReactNode
  heightClassName?: string
  emptyDescription?: string
  horizontal?: boolean
  showLegend?: boolean
  showLabels?: boolean
  xAxisFormatter?: (value: string | number) => string
  tooltipLabelFormatter?: TooltipLabelFormatter<TData>
  valueFormatter?: ValueFormatter<TData>
  colorByEntry?: (payload: TData, index: number) => string | undefined
  onEntryClick?: (payload: TData) => void
}

export function BarChartWidget<TData extends ChartRow>({
  title,
  description,
  data,
  xKey,
  series,
  isLoading = false,
  actions,
  heightClassName,
  emptyDescription,
  horizontal = false,
  showLegend,
  showLabels = false,
  xAxisFormatter,
  tooltipLabelFormatter,
  valueFormatter,
  colorByEntry,
  onEntryClick,
}: BarChartWidgetProps<TData>) {
  const { palette, seriesColors, locale, isRtl } = useChartTheme()
  const layout = horizontal ? 'vertical' : 'horizontal'

  return (
    <ChartCard title={title} description={description} actions={actions}>
      <BaseChart data={data} isLoading={isLoading} heightClassName={heightClassName} emptyDescription={emptyDescription}>
        <BarChart data={data} layout={layout} margin={{ top: 8, right: isRtl ? 12 : 20, left: isRtl ? 20 : 12, bottom: 0 }} barGap={8}>
          <CartesianGrid stroke={palette.grid} strokeDasharray="4 4" vertical={!horizontal} horizontal />
          {horizontal ? (
            <>
              <XAxis type="number" stroke={palette.axis} tickLine={false} axisLine={false} minTickGap={24} tick={{ fontSize: 12 }} tickFormatter={(value) => formatChartNumber(value, locale)} />
              <YAxis type="category" dataKey={xKey} stroke={palette.axis} tickLine={false} axisLine={false} width={96} tick={{ fontSize: 12 }} tickFormatter={xAxisFormatter} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} stroke={palette.axis} tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} tick={{ fontSize: 12 }} tickFormatter={xAxisFormatter} />
              <YAxis stroke={palette.axis} tickLine={false} axisLine={false} width={52} tick={{ fontSize: 12 }} tickFormatter={(value) => formatChartNumber(value, locale)} />
            </>
          )}
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
            <Bar
              key={entry.key}
              dataKey={entry.key}
              name={entry.label ?? entry.key}
              stackId={entry.stackId}
              fill={resolveSeriesColor(entry, index, seriesColors)}
              radius={horizontal ? [0, 10, 10, 0] : [10, 10, 0, 0]}
              onClick={onEntryClick ? (entry) => onEntryClick((entry as { payload: TData }).payload) : undefined}
            >
              {colorByEntry && series.length === 1
                ? data.map((item, itemIndex) => <Cell key={`${entry.key}-${itemIndex}`} fill={colorByEntry(item, itemIndex) ?? resolveSeriesColor(entry, index, seriesColors)} />)
                : null}
              {showLabels ? <LabelList dataKey={entry.key} position={horizontal ? 'right' : 'top'} formatter={(value) => formatChartNumber(value == null ? 0 : String(value), locale)} /> : null}
            </Bar>
          ))}
        </BarChart>
      </BaseChart>
    </ChartCard>
  )
}
