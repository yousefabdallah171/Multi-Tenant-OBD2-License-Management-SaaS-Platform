import { screen } from '@testing-library/react'
import { AreaChartWidget } from '@/components/charts/AreaChartWidget'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { PieChartWidget } from '@/components/charts/PieChartWidget'
import { renderWithProviders } from '../../../utils/test-utils'

const data = [
  { month: 'Jan', value: 10, other: 5, name: 'A' },
  { month: 'Feb', value: 20, other: 9, name: 'B' },
]

describe('LineChartWidget', () => {
  test('renders chart title when data exists', async () => {
    await renderWithProviders(
      <LineChartWidget
        title="Line chart"
        data={data}
        xKey="month"
        series={[{ key: 'value', label: 'Value' }]}
      />,
      { route: '/en/login' },
    )
    expect(screen.getByText('Line chart')).toBeInTheDocument()
  })

  test('shows loading skeleton when loading', async () => {
    await renderWithProviders(
      <LineChartWidget
        title="Line loading"
        data={data}
        xKey="month"
        isLoading
        series={[{ key: 'value', label: 'Value' }]}
      />,
      { route: '/en/login' },
    )
    expect(screen.getByText('Line loading')).toBeInTheDocument()
  })

  test('shows empty state when data is empty', async () => {
    await renderWithProviders(
      <LineChartWidget
        title="Line empty"
        data={[]}
        xKey="month"
        series={[{ key: 'value', label: 'Value' }]}
      />,
      { route: '/en/login' },
    )
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })
})

describe('BarChartWidget', () => {
  test('renders bars widget with title', async () => {
    await renderWithProviders(
      <BarChartWidget
        title="Bar chart"
        data={data}
        xKey="month"
        series={[{ key: 'value', label: 'Value' }]}
      />,
      { route: '/en/login' },
    )
    expect(screen.getByText('Bar chart')).toBeInTheDocument()
  })

  test('supports horizontal orientation', async () => {
    await renderWithProviders(
      <BarChartWidget
        title="Bar horizontal"
        data={data}
        xKey="month"
        horizontal
        series={[{ key: 'value', label: 'Value' }]}
      />,
      { route: '/en/login' },
    )
    expect(screen.getByText('Bar horizontal')).toBeInTheDocument()
  })

  test('shows loading skeleton when loading', async () => {
    await renderWithProviders(
      <BarChartWidget
        title="Bar loading"
        data={data}
        xKey="month"
        isLoading
        series={[{ key: 'value', label: 'Value' }]}
      />,
      { route: '/en/login' },
    )
    expect(screen.getByText('Bar loading')).toBeInTheDocument()
  })
})

describe('PieChartWidget', () => {
  test('renders pie widget title', async () => {
    await renderWithProviders(
      <PieChartWidget title="Pie chart" data={data} nameKey="name" valueKey="value" />,
      { route: '/en/login' },
    )
    expect(screen.getByText('Pie chart')).toBeInTheDocument()
  })

  test('renders legend labels', async () => {
    await renderWithProviders(
      <PieChartWidget title="Pie legend" data={data} nameKey="name" valueKey="value" />,
      { route: '/en/login' },
    )
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  test('shows loading skeleton when loading', async () => {
    await renderWithProviders(
      <PieChartWidget title="Pie loading" data={data} isLoading nameKey="name" valueKey="value" />,
      { route: '/en/login' },
    )
    expect(screen.getByText('Pie loading')).toBeInTheDocument()
  })
})

describe('AreaChartWidget', () => {
  test('renders area widget title', async () => {
    await renderWithProviders(
      <AreaChartWidget
        title="Area chart"
        data={data}
        xKey="month"
        series={[{ key: 'value', label: 'Value' }]}
      />,
      { route: '/en/login' },
    )
    expect(screen.getByText('Area chart')).toBeInTheDocument()
  })

  test('shows loading skeleton when loading', async () => {
    await renderWithProviders(
      <AreaChartWidget
        title="Area loading"
        data={data}
        xKey="month"
        isLoading
        series={[{ key: 'value', label: 'Value' }]}
      />,
      { route: '/en/login' },
    )
    expect(screen.getByText('Area loading')).toBeInTheDocument()
  })

  test('shows empty state when data is empty', async () => {
    await renderWithProviders(
      <AreaChartWidget
        title="Area empty"
        data={[]}
        xKey="month"
        series={[{ key: 'value', label: 'Value' }]}
      />,
      { route: '/en/login' },
    )
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })
})
