import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardPage } from '@/pages/super-admin/Dashboard'
import { LogsPage } from '@/pages/super-admin/Logs'
import { ReportsPage } from '@/pages/super-admin/Reports'
import { TenantsPage } from '@/pages/super-admin/Tenants'
import { UsersPage } from '@/pages/super-admin/Users'
import { logService } from '@/services/log.service'
import { reportService } from '@/services/report.service'
import { tenantService } from '@/services/tenant.service'
import { userService } from '@/services/user.service'
import { renderWithProviders } from './testUtils'

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
  },
}))

jest.mock('@/components/charts/RevenueChart', () => ({
  RevenueChart: ({ title }: { title: string }) => <div data-testid="chart">{title}</div>,
}))

jest.mock('@/components/charts/TenantComparisonChart', () => ({
  TenantComparisonChart: ({ title }: { title: string }) => <div data-testid="chart">{title}</div>,
}))

jest.mock('@/components/charts/ActivationTimeline', () => ({
  ActivationTimeline: ({ title }: { title: string }) => <div data-testid="chart">{title}</div>,
}))

jest.mock('@/components/charts/LineChartWidget', () => ({
  LineChartWidget: ({ title }: { title: string }) => <div data-testid="chart">{title}</div>,
}))

jest.mock('@/components/charts/BarChartWidget', () => ({
  BarChartWidget: ({ title }: { title: string }) => <div data-testid="chart">{title}</div>,
}))

jest.mock('@/components/charts/AreaChartWidget', () => ({
  AreaChartWidget: ({ title }: { title: string }) => <div data-testid="chart">{title}</div>,
}))

jest.mock('@/components/charts/PieChartWidget', () => ({
  PieChartWidget: ({ title }: { title: string }) => <div data-testid="chart">{title}</div>,
}))

jest.mock('@/services/report.service', () => ({
  reportService: {
    getDashboardStats: jest.fn(),
    getRevenueTrend: jest.fn(),
    getTenantComparison: jest.fn(),
    getLicenseTimeline: jest.fn(),
    getRecentActivity: jest.fn(),
    getRevenue: jest.fn(),
    getActivations: jest.fn(),
    getGrowth: jest.fn(),
    getTopResellers: jest.fn(),
    exportCsv: jest.fn(),
    exportPdf: jest.fn(),
  },
}))

jest.mock('@/services/tenant.service', () => ({
  tenantService: {
    getAll: jest.fn(),
    getStats: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}))

jest.mock('@/services/user.service', () => ({
  userService: {
    getAll: jest.fn(),
    updateStatus: jest.fn(),
    delete: jest.fn(),
  },
}))

jest.mock('@/services/log.service', () => ({
  logService: {
    getAll: jest.fn(),
    getById: jest.fn(),
  },
}))

const mockReportService = jest.mocked(reportService)
const mockTenantService = jest.mocked(tenantService)
const mockUserService = jest.mocked(userService)
const mockLogService = jest.mocked(logService)

beforeEach(() => {
  jest.clearAllMocks()

  mockReportService.getDashboardStats.mockResolvedValue({
    data: {
      stats: {
        total_tenants: 7,
        total_revenue: 1234.5,
        active_licenses: 88,
        total_users: 54,
        ip_country_map: [{ country: 'EG', count: 4 }],
      },
    },
  })
  mockReportService.getRevenueTrend.mockResolvedValue({ data: [{ month: 'Jan', revenue: 300 }] })
  mockReportService.getTenantComparison.mockResolvedValue({ data: [{ id: 1, name: 'Tenant One', revenue: 400, active_licenses: 12 }] })
  mockReportService.getLicenseTimeline.mockResolvedValue({ data: [{ date: '2026-02-28', label: '28 Feb', count: 9 }] })
  mockReportService.getRecentActivity.mockResolvedValue({
    data: [{ id: 1, action: 'Activation synced', description: 'Synced tenant data', user: 'Admin', tenant: 'Tenant One', created_at: '2026-02-28T10:00:00Z' }],
  })
  mockReportService.getRevenue.mockResolvedValue({ data: [{ tenant: 'Tenant One', revenue: 450 }] })
  mockReportService.getActivations.mockResolvedValue({ data: [{ month: 'Tenant One', activations: 15 }] })
  mockReportService.getGrowth.mockResolvedValue({ data: [{ month: 'Jan', users: 6 }] })
  mockReportService.getTopResellers.mockResolvedValue({ data: [{ reseller: 'Reseller A', tenant: 'Tenant One', activations: 12, revenue: 340 }] })

  mockTenantService.getAll.mockResolvedValue({
    data: [
      {
        id: 1,
        name: 'Tenant One',
        slug: 'tenant-one',
        status: 'active',
        settings: null,
        managers_count: 2,
        resellers_count: 3,
        customers_count: 12,
        active_licenses_count: 9,
        revenue: 400,
        created_at: '2026-02-28T10:00:00Z',
      },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 },
  })
  mockTenantService.getStats.mockResolvedValue({
    data: {
      users: 17,
      resellers: 3,
      customers: 12,
      licenses: 20,
      active_licenses: 9,
      revenue: 400,
    },
  })

  mockUserService.getAll.mockResolvedValue({
    data: [
      {
        id: 1,
        name: 'Reseller User',
        email: 'reseller@example.com',
        username: 'reseller-a',
        role: 'reseller',
        status: 'active',
        username_locked: false,
        tenant: { id: 1, name: 'Tenant One' },
        created_at: '2026-02-28T10:00:00Z',
      },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 },
    role_counts: { super_admin: 1, manager_parent: 2, manager: 3, reseller: 4, customer: 5 },
  })

  mockLogService.getAll.mockResolvedValue({
    data: [
      {
        id: 10,
        tenant: 'Tenant One',
        user: 'Admin',
        endpoint: '/api/super-admin/logs',
        method: 'GET',
        status_code: 200,
        response_time_ms: 120,
        created_at: '2026-02-28T10:00:00Z',
      },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 },
  })
  mockLogService.getById.mockResolvedValue({
    data: {
      id: 10,
      tenant: 'Tenant One',
      user: 'Admin',
      endpoint: '/api/super-admin/logs',
      method: 'GET',
      status_code: 200,
      response_time_ms: 120,
      request_body: { filter: 'all' },
      response_body: { ok: true },
      created_at: '2026-02-28T10:00:00Z',
    },
  })
})

test('Dashboard page renders stats, charts, and recent activity', async () => {
  await renderWithProviders(<DashboardPage />, { route: '/en/super-admin/dashboard' })

  await waitFor(() => expect(mockReportService.getDashboardStats).toHaveBeenCalled())

  expect(screen.getByText('7')).toBeInTheDocument()
  expect(screen.getByText('Synced tenant data')).toBeInTheDocument()
  expect(screen.getAllByTestId('chart')).toHaveLength(4)
})

test('Dashboard page shows loading skeletons while queries are pending', async () => {
  mockReportService.getDashboardStats.mockImplementation(() => new Promise(() => undefined))
  mockReportService.getRevenueTrend.mockImplementation(() => new Promise(() => undefined))
  mockReportService.getTenantComparison.mockImplementation(() => new Promise(() => undefined))
  mockReportService.getRecentActivity.mockImplementation(() => new Promise(() => undefined))

  const view = await renderWithProviders(<DashboardPage />, { route: '/en/super-admin/dashboard' })

  expect(view.container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
})

test('Tenants page renders tenant data and opens the add tenant modal', async () => {
  const user = userEvent.setup()

  await renderWithProviders(<TenantsPage />, { route: '/en/super-admin/tenants' })

  expect(await screen.findByText('Tenant One')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /add/i }))

  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText(/manager parent name/i)).toBeInTheDocument()
})

test('Users page renders role counts and filter controls', async () => {
  await renderWithProviders(<UsersPage />, { route: '/en/super-admin/users' })

  await waitFor(() => expect(mockUserService.getAll).toHaveBeenCalled())

  expect(screen.getByText('Reseller User')).toBeInTheDocument()
  expect(screen.getByText('4')).toBeInTheDocument()
  expect(screen.getByRole('option', { name: /reseller/i })).toBeInTheDocument()
})

test('Reports page renders charts, table data, and export actions', async () => {
  const user = userEvent.setup()

  await renderWithProviders(<ReportsPage />, { route: '/en/super-admin/reports' })

  await waitFor(() => expect(mockReportService.getRevenue).toHaveBeenCalled())

  expect(screen.getByText('Reseller A')).toBeInTheDocument()
  expect(screen.getAllByTestId('chart')).toHaveLength(3)

  await user.click(screen.getByRole('button', { name: 'CSV' }))
  await user.click(screen.getByRole('button', { name: 'PDF' }))

  expect(mockReportService.exportCsv).toHaveBeenCalledTimes(1)
  expect(mockReportService.exportPdf).toHaveBeenCalledTimes(1)
})

test('Reports page applies the selected date range to report queries', async () => {
  await renderWithProviders(<ReportsPage />, { route: '/en/super-admin/reports' })

  fireEvent.change(screen.getByLabelText(/^from$/i), { target: { value: '2026-02-01' } })
  fireEvent.change(screen.getByLabelText(/^to$/i), { target: { value: '2026-02-28' } })

  await waitFor(() =>
    expect(mockReportService.getRevenue).toHaveBeenLastCalledWith({
      from: '2026-02-01',
      to: '2026-02-28',
    }),
  )
})

test('Logs page renders log rows and expands JSON details', async () => {
  const user = userEvent.setup()

  await renderWithProviders(<LogsPage />, { route: '/en/super-admin/logs' })

  expect(await screen.findByText('/api/super-admin/logs')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /view/i }))

  await waitFor(() => expect(mockLogService.getById).toHaveBeenCalledWith(10))
  expect(await screen.findByText(/"filter": "all"/i)).toBeInTheDocument()
  expect(screen.getByText(/"ok": true/i)).toBeInTheDocument()
})

test('Logs page sends tenant, method, status range, and date range filters', async () => {
  const user = userEvent.setup()

  await renderWithProviders(<LogsPage />, { route: '/en/super-admin/logs' })

  const tenantOption = await screen.findByRole('option', { name: 'Tenant One' })
  const selects = screen.getAllByRole('combobox')

  await user.selectOptions(selects[0], tenantOption)
  await user.selectOptions(selects[1], 'GET')
  fireEvent.change(screen.getByPlaceholderText(/from/i), { target: { value: '200' } })
  fireEvent.change(screen.getByPlaceholderText(/to/i), { target: { value: '299' } })
  fireEvent.change(screen.getByLabelText(/^From$/i), { target: { value: '2026-02-01' } })
  fireEvent.change(screen.getByLabelText(/^To$/i), { target: { value: '2026-02-28' } })

  await waitFor(() => {
    expect(mockLogService.getAll).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        per_page: 10,
        tenant_id: 1,
        endpoint: '',
        method: 'GET',
        status_from: 200,
        status_to: 299,
      }),
    )
  })

  expect(screen.getByLabelText(/^From$/i)).toHaveValue('2026-02-01')
  expect(screen.getByLabelText(/^To$/i)).toHaveValue('2026-02-28')
})
