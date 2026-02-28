import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

const COLORS = ['#0284c7', '#0f766e', '#f59e0b', '#e11d48', '#7c3aed', '#2563eb']

interface PieBreakdownChartProps {
  title: string
  data: Array<Record<string, string | number | undefined>>
  dataKey?: string
  nameKey?: string
  isLoading?: boolean
}

export function PieBreakdownChart({ title, data, dataKey = 'count', nameKey = 'label', isLoading = false }: PieBreakdownChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {isLoading ? (
          <LoadingSpinner fullPage label="Loading..." />
        ) : data.length === 0 ? (
          <EmptyState title="No data" description="No records available yet." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius={70} outerRadius={110} paddingAngle={3}>
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
