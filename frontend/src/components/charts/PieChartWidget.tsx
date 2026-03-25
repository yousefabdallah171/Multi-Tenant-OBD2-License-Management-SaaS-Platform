import type { ReactNode } from 'react'
import { Cell, Label, Pie, PieChart, Tooltip } from 'recharts'
import { BaseChart } from '@/components/charts/BaseChart'
import { ChartCard } from '@/components/charts/ChartCard'
import { formatChartNumber, useChartTheme } from '@/components/charts/chart-theme'

type ChartRow = object
type ValueFormatter<TData extends ChartRow> = (value: number | string, payload: TData) => string

interface PieChartWidgetProps<TData extends ChartRow = ChartRow> {
  title: string
  description?: string
  data: TData[]
  nameKey: string
  valueKey: string
  isLoading?: boolean
  actions?: ReactNode
  heightClassName?: string
  emptyDescription?: string
  colors?: string[]
  donut?: boolean
  totalLabel?: string
  legendLabelFormatter?: (payload: TData) => string
  valueFormatter?: ValueFormatter<TData>
}

export function PieChartWidget<TData extends ChartRow>({
  title,
  description,
  data,
  nameKey,
  valueKey,
  isLoading = false,
  actions,
  heightClassName = 'h-80',
  emptyDescription,
  colors,
  donut = true,
  totalLabel = 'Total',
  legendLabelFormatter,
  valueFormatter,
}: PieChartWidgetProps<TData>) {
  const { palette, seriesColors, locale } = useChartTheme()
  const activeColors = colors ?? seriesColors
  const total = data.reduce((sum, entry) => {
    const row = entry as Record<string, string | number | null | undefined>

    return sum + (Number(row[valueKey] ?? 0) || 0)
  }, 0)

  return (
    <ChartCard title={title} description={description} actions={actions}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <BaseChart data={data} isLoading={isLoading} heightClassName={heightClassName} emptyDescription={emptyDescription}>
          <PieChart>
            <Tooltip
              contentStyle={{ backgroundColor: palette.tooltipBackground, borderColor: palette.tooltipBorder, borderRadius: 16 }}
              labelStyle={{ color: palette.axis }}
              itemStyle={{ color: palette.axis }}
              formatter={(value: number | string | undefined, _name, item) => {
                const payload = item.payload as TData
                const row = payload as Record<string, string | number | null | undefined>
                const label = legendLabelFormatter ? legendLabelFormatter(payload) : String(row[nameKey] ?? '')
                const resolvedValue = value ?? 0
                const formatted = valueFormatter ? valueFormatter(resolvedValue, payload) : formatChartNumber(resolvedValue, locale)

                return [formatted, label]
              }}
            />
            <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={donut ? 68 : 0} outerRadius={110} paddingAngle={3}>
              {data.map((item, index) => (
                <Cell key={`${String((item as Record<string, string | number | null | undefined>)[nameKey] ?? index)}-${index}`} fill={activeColors[index % activeColors.length]} />
              ))}
              <Label
                position="center"
                content={({ viewBox }) => {
                  if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) {
                    return null
                  }

                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} dy="-8" fill={palette.axis} fontSize="12">
                        {totalLabel}
                      </tspan>
                      <tspan x={viewBox.cx} dy="22" fill={palette.primary} fontSize="22" fontWeight="700">
                        {formatChartNumber(total, locale)}
                      </tspan>
                    </text>
                  )
                }}
              />
            </Pie>
          </PieChart>
        </BaseChart>

        {data.length > 0 ? (
          <div className="space-y-2">
            {data.map((item, index) => {
              const row = item as Record<string, string | number | null | undefined>
              const value = Number(row[valueKey] ?? 0) || 0
              const percentage = total > 0 ? (value / total) * 100 : 0
              const label = legendLabelFormatter ? legendLabelFormatter(item) : String(row[nameKey] ?? '')

              return (
                <div key={`${label}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: activeColors[index % activeColors.length] }} />
                    <span className="truncate text-slate-700 dark:text-slate-200">{label}</span>
                  </div>
                  <div className="text-end text-slate-500 dark:text-slate-400">
                    <div>{formatChartNumber(percentage, locale, { maximumFractionDigits: 1 })}%</div>
                    <div className="text-xs">{valueFormatter ? valueFormatter(value, item) : formatChartNumber(value, locale)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </ChartCard>
  )
}
