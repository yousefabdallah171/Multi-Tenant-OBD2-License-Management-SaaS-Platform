import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

interface RevenueChartProps {
  title: string
  data: object[]
  isLoading?: boolean
  dataKey?: string
  xKey?: string
}

export function RevenueChart({ title, data, isLoading = false, dataKey = 'revenue', xKey = 'month' }: RevenueChartProps) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {isLoading ? (
          <LoadingSpinner fullPage label={t('common.loading')} />
        ) : data.length === 0 ? (
          <EmptyState title={t('common.noData')} description={t('superAdmin.pages.dashboard.noActivity')} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis dataKey={xKey} stroke="#64748b" tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey={dataKey} stroke="#0284c7" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
