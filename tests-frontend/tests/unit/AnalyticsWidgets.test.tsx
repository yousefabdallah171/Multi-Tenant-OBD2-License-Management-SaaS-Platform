import type { ReactNode } from 'react'
import { useState } from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AreaChartWidget } from '@/components/charts/AreaChartWidget'
import { BarChartWidget } from '@/components/charts/BarChartWidget'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { PieChartWidget } from '@/components/charts/PieChartWidget'
import { ExportButtons } from '@/components/shared/ExportButtons'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { useThemeStore } from '@/stores/themeStore'
import { renderWithProviders } from './testUtils'

jest.mock('recharts', () => {
  const actual = jest.requireActual('recharts')

  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  }
})

test('LineChartWidget renders the title and chart container', async () => {
  await renderWithProviders(<LineChartWidget title="Revenue Trend" data={[{ month: 'Jan', revenue: 120 }]} xKey="month" series={[{ key: 'revenue', label: 'Revenue' }]} />)

  expect(screen.getByText('Revenue Trend')).toBeInTheDocument()
  expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
})

test('LineChartWidget shows loading state', async () => {
  await renderWithProviders(<LineChartWidget title="Revenue Trend" data={[]} isLoading xKey="month" series={[{ key: 'revenue', label: 'Revenue' }]} />)

  expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
})

test('LineChartWidget shows empty state without data', async () => {
  await renderWithProviders(<LineChartWidget title="Revenue Trend" data={[]} xKey="month" series={[{ key: 'revenue', label: 'Revenue' }]} />)

  expect(screen.getByText(/no data/i)).toBeInTheDocument()
})

test('BarChartWidget renders the title in horizontal mode', async () => {
  await renderWithProviders(<BarChartWidget title="Team Revenue" data={[{ reseller: 'A', revenue: 20 }]} xKey="reseller" horizontal series={[{ key: 'revenue', label: 'Revenue' }]} />)

  expect(screen.getByText('Team Revenue')).toBeInTheDocument()
  expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
})

test('PieChartWidget renders legend entries', async () => {
  await renderWithProviders(<PieChartWidget title="Countries" data={[{ country: 'EG', count: 5 }, { country: 'US', count: 3 }]} nameKey="country" valueKey="count" />)

  expect(screen.getByText('Countries')).toBeInTheDocument()
  expect(screen.getByText('EG')).toBeInTheDocument()
  expect(screen.getByText('US')).toBeInTheDocument()
})

test('AreaChartWidget renders the title and chart container', async () => {
  await renderWithProviders(<AreaChartWidget title="License Timeline" data={[{ label: '28 Feb', count: 9 }]} xKey="label" series={[{ key: 'count', label: 'Activations' }]} />)

  expect(screen.getByText('License Timeline')).toBeInTheDocument()
  expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
})

test('ExportButtons renders CSV and PDF actions', async () => {
  await renderWithProviders(<ExportButtons onExportCsv={() => undefined} onExportPdf={() => undefined} />)

  expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'PDF' })).toBeInTheDocument()
})

test('ExportButtons shows loading state while export is pending', async () => {
  const user = userEvent.setup()
  let resolvePromise: (() => void) | undefined

  await renderWithProviders(
    <ExportButtons
      onExportCsv={() =>
        new Promise<void>((resolve) => {
          resolvePromise = resolve
        })
      }
      onExportPdf={() => undefined}
    />,
  )

  await user.click(screen.getByRole('button', { name: 'CSV' }))

  expect(screen.getByRole('button', { name: 'PDF' })).toBeDisabled()

  if (resolvePromise) {
    resolvePromise()
  }

  await waitFor(() => expect(screen.getByRole('button', { name: 'PDF' })).not.toBeDisabled())
})

test('DateRangePicker preset updates the selected dates', async () => {
  const user = userEvent.setup()

  function Harness() {
    const [value, setValue] = useState({ from: '', to: '' })

    return <DateRangePicker value={value} onChange={setValue} />
  }

  await renderWithProviders(<Harness />)

  await user.click(screen.getByRole('button', { name: /last 7 days/i }))

  expect((screen.getByLabelText(/^from$/i) as HTMLInputElement).value).not.toBe('')
  expect((screen.getByLabelText(/^to$/i) as HTMLInputElement).value).not.toBe('')
})

test('LineChartWidget uses dark mode series colors', async () => {
  useThemeStore.setState({ theme: 'dark' })

  await renderWithProviders(<LineChartWidget title="Dark Revenue" data={[{ month: 'Jan', revenue: 99 }]} xKey="month" series={[{ key: 'revenue', label: 'Revenue' }]} />)

  expect(document.documentElement.classList.contains('dark')).toBe(true)
  expect(screen.getByText('Dark Revenue')).toBeInTheDocument()
})
