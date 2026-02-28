import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardPage as ManagerDashboardPage } from '@/pages/manager/Dashboard'
import { DashboardPage as ResellerDashboardPage } from '@/pages/reseller/Dashboard'
import { ReportsPage as ResellerReportsPage } from '@/pages/reseller/Reports'
import { managerService } from '@/services/manager.service'
import { resellerService } from '@/services/reseller.service'
import { renderWithProviders } from './testUtils'

jest.mock('@/components/charts/LineChartWidget', () => ({
  LineChartWidget: ({ title }: { title: string }) => <div data-testid="chart">{title}</div>,
}))

jest.mock('@/components/charts/BarChartWidget', () => ({
  BarChartWidget: ({ title }: { title: string }) => <div data-testid="chart">{title}</div>,
}))

jest.mock('@/services/manager.service', () => ({
  managerService: {
    getDashboardStats: jest.fn(),
    getActivationsChart: jest.fn(),
    getRevenueChart: jest.fn(),
    getRecentActivity: jest.fn(),
    exportCsv: jest.fn(),
    exportPdf: jest.fn(),
  },
}))

jest.mock('@/services/reseller.service', () => ({
  resellerService: {
    getDashboardStats: jest.fn(),
    getActivationsChart: jest.fn(),
    getRevenueChart: jest.fn(),
    getRecentActivity: jest.fn(),
    getRevenueReport: jest.fn(),
    getActivationsReport: jest.fn(),
    getTopPrograms: jest.fn(),
    exportCsv: jest.fn(),
    exportPdf: jest.fn(),
  },
}))

const mockManagerService = jest.mocked(managerService)
const mockResellerService = jest.mocked(resellerService)

beforeEach(() => {
  jest.clearAllMocks()

  mockManagerService.getDashboardStats.mockResolvedValue({
    stats: {
      team_resellers: 4,
      team_customers: 12,
      active_licenses: 18,
      team_revenue: 950,
      monthly_activations: 7,
    },
  })
  mockManagerService.getActivationsChart.mockResolvedValue({ data: [{ month: 'Jan 2026', count: 7 }] })
  mockManagerService.getRevenueChart.mockResolvedValue({ data: [{ reseller: 'Reseller One', revenue: 300 }] })
  mockManagerService.getRecentActivity.mockResolvedValue({
    data: [
      {
        id: 1,
        action: 'Created customer',
        description: 'Added a new customer record.',
        metadata: {},
        user: { id: 1, name: 'Manager One' },
        created_at: '2026-02-28T10:00:00Z',
      },
    ],
  })

  mockResellerService.getDashboardStats.mockResolvedValue({
    stats: {
      customers: 9,
      active_licenses: 6,
      revenue: 450,
      monthly_activations: 3,
    },
  })
  mockResellerService.getActivationsChart.mockResolvedValue({ data: [{ month: 'Jan 2026', count: 3 }] })
  mockResellerService.getRevenueChart.mockResolvedValue({ data: [{ month: 'Jan 2026', revenue: 450 }] })
  mockResellerService.getRecentActivity.mockResolvedValue({
    data: [
      {
        id: 2,
        action: 'Renewed license',
        description: 'Renewed an annual license.',
        metadata: {},
        created_at: '2026-02-28T10:00:00Z',
      },
    ],
  })
  mockResellerService.getRevenueReport.mockResolvedValue({ data: [{ period: 'Jan', revenue: 450, count: 3 }] })
  mockResellerService.getActivationsReport.mockResolvedValue({ data: [{ period: 'Jan', revenue: 450, count: 3 }] })
  mockResellerService.getTopPrograms.mockResolvedValue({ data: [{ program: 'Tool A', count: 3, revenue: 450 }] })
})

test('manager dashboard renders cards, charts, and team activity', async () => {
  await renderWithProviders(<ManagerDashboardPage />, { route: '/en/manager/dashboard', withAuth: false })

  await waitFor(() => expect(mockManagerService.getDashboardStats).toHaveBeenCalled())

  expect(screen.getByText('Dashboard')).toBeInTheDocument()
  expect(screen.getByText('Manager One')).toBeInTheDocument()
  expect(screen.getAllByTestId('chart')).toHaveLength(2)
})

test('manager dashboard uses Arabic translations on RTL routes', async () => {
  await renderWithProviders(<ManagerDashboardPage />, { route: '/ar/manager/dashboard', withAuth: false })

  await waitFor(() => expect(mockManagerService.getDashboardStats).toHaveBeenCalled())

  expect(screen.getByText('لوحة التحكم')).toBeInTheDocument()
  expect(screen.getByText('موزعو الفريق')).toBeInTheDocument()
  expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
})

test('reseller dashboard renders cards, charts, and recent activity', async () => {
  await renderWithProviders(<ResellerDashboardPage />, { route: '/en/reseller/dashboard', withAuth: false })

  await waitFor(() => expect(mockResellerService.getDashboardStats).toHaveBeenCalled())

  expect(screen.getByText('Dashboard')).toBeInTheDocument()
  expect(screen.getByText('Renewed license')).toBeInTheDocument()
  expect(screen.getAllByTestId('chart')).toHaveLength(2)
})

test('reseller reports update queries when range and period change', async () => {
  await renderWithProviders(<ResellerReportsPage />, { route: '/en/reseller/reports', withAuth: false })

  fireEvent.change(await screen.findByLabelText(/^from$/i), { target: { value: '2026-02-01' } })
  fireEvent.change(screen.getByLabelText(/^to$/i), { target: { value: '2026-02-28' } })
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'weekly' } })

  await waitFor(() =>
    expect(mockResellerService.getRevenueReport).toHaveBeenLastCalledWith({
      from: '2026-02-01',
      to: '2026-02-28',
      period: 'weekly',
    }),
  )

  expect(mockResellerService.getActivationsReport).toHaveBeenLastCalledWith({
    from: '2026-02-01',
    to: '2026-02-28',
    period: 'weekly',
  })
})

test('reseller reports export actions use the active filters', async () => {
  const user = userEvent.setup()

  await renderWithProviders(<ResellerReportsPage />, { route: '/en/reseller/reports', withAuth: false })

  fireEvent.change(await screen.findByLabelText(/^from$/i), { target: { value: '2026-02-01' } })
  fireEvent.change(screen.getByLabelText(/^to$/i), { target: { value: '2026-02-28' } })
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'daily' } })

  await user.click(screen.getByRole('button', { name: 'CSV' }))
  await user.click(screen.getByRole('button', { name: 'PDF' }))

  expect(mockResellerService.exportCsv).toHaveBeenCalledWith({
    from: '2026-02-01',
    to: '2026-02-28',
    period: 'daily',
  })
  expect(mockResellerService.exportPdf).toHaveBeenCalledWith({
    from: '2026-02-01',
    to: '2026-02-28',
    period: 'daily',
  })
})
