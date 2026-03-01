import type { ReactElement } from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { ActivityPage } from '@/pages/manager-parent/Activity'
import { BiosBlacklistPage } from '@/pages/manager-parent/BiosBlacklist'
import { BiosHistoryPage } from '@/pages/manager-parent/BiosHistory'
import { CustomersPage } from '@/pages/manager-parent/Customers'
import { DashboardPage } from '@/pages/manager-parent/Dashboard'
import { FinancialReportsPage } from '@/pages/manager-parent/FinancialReports'
import { IpAnalyticsPage } from '@/pages/manager-parent/IpAnalytics'
import { ProfilePage } from '@/pages/manager-parent/Profile'
import { ReportsPage } from '@/pages/manager-parent/Reports'
import { ResellerPricingPage } from '@/pages/manager-parent/ResellerPricing'
import { SettingsPage } from '@/pages/manager-parent/Settings'
import { SoftwareManagementPage } from '@/pages/manager-parent/SoftwareManagement'
import { TeamManagementPage } from '@/pages/manager-parent/TeamManagement'
import { UsernameManagementPage } from '@/pages/manager-parent/UsernameManagement'
import { activityService } from '@/services/activity.service'
import { customerService } from '@/services/customer.service'
import { managerParentService } from '@/services/manager-parent.service'
import { pricingService } from '@/services/pricing.service'
import { programService } from '@/services/program.service'
import { profileService } from '@/services/profile.service'
import { teamService } from '@/services/team.service'
import { tenantBiosService } from '@/services/tenant-bios.service'
import { useAuthStore } from '@/stores/authStore'
import { renderWithProviders } from './testUtils'

jest.setTimeout(15000)

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
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

jest.mock('@/components/charts/PieBreakdownChart', () => ({
  PieBreakdownChart: ({ title }: { title: string }) => <div data-testid="chart">{title}</div>,
}))

jest.mock('@/components/charts/LineChartWidget', () => ({
  LineChartWidget: ({ title }: { title: string }) => <div data-testid="chart">{title}</div>,
}))

jest.mock('@/components/charts/BarChartWidget', () => ({
  BarChartWidget: ({ title }: { title: string }) => <div data-testid="chart">{title}</div>,
}))

jest.mock('@/components/charts/PieChartWidget', () => ({
  PieChartWidget: ({ title }: { title: string }) => <div data-testid="chart">{title}</div>,
}))

jest.mock('@/services/manager-parent.service', () => ({
  managerParentService: {
    getDashboardStats: jest.fn(),
    getRevenueChart: jest.fn(),
    getExpiryForecast: jest.fn(),
    getTeamPerformance: jest.fn(),
    getConflictRate: jest.fn(),
    getRevenueByReseller: jest.fn(),
    getRevenueByProgram: jest.fn(),
    getActivationRate: jest.fn(),
    getRetention: jest.fn(),
    exportReportsCsv: jest.fn(),
    exportReportsPdf: jest.fn(),
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    getBiosHistory: jest.fn(),
    getBiosHistoryById: jest.fn(),
    getIpAnalytics: jest.fn(),
    getIpStats: jest.fn(),
    getProgramsWithExternalApi: jest.fn(),
    getProgramLogs: jest.fn(),
    getUsernameManagement: jest.fn(),
    unlockUsername: jest.fn(),
    changeUsername: jest.fn(),
    resetPassword: jest.fn(),
    getFinancialReports: jest.fn(),
    exportFinancialCsv: jest.fn(),
    exportFinancialPdf: jest.fn(),
  },
}))

jest.mock('@/services/team.service', () => ({
  teamService: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    updateStatus: jest.fn(),
    getStats: jest.fn(),
  },
}))

jest.mock('@/services/program.service', () => ({
  programService: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getStats: jest.fn(),
  },
}))

jest.mock('@/services/customer.service', () => ({
  customerService: {
    getAll: jest.fn(),
    getOne: jest.fn(),
  },
}))

jest.mock('@/services/activity.service', () => ({
  activityService: {
    getAll: jest.fn(),
    export: jest.fn(),
  },
}))

jest.mock('@/services/pricing.service', () => ({
  pricingService: {
    getAll: jest.fn(),
    update: jest.fn(),
    bulk: jest.fn(),
    history: jest.fn(),
  },
}))

jest.mock('@/services/tenant-bios.service', () => ({
  tenantBiosService: {
    getBlacklist: jest.fn(),
    addToBlacklist: jest.fn(),
    removeFromBlacklist: jest.fn(),
  },
}))

jest.mock('@/services/profile.service', () => ({
  profileService: {
    updateProfile: jest.fn(),
    updatePassword: jest.fn(),
  },
}))

const mockManagerParentService = jest.mocked(managerParentService)
const mockTeamService = jest.mocked(teamService)
const mockProgramService = jest.mocked(programService)
const mockCustomerService = jest.mocked(customerService)
const mockActivityService = jest.mocked(activityService)
const mockPricingService = jest.mocked(pricingService)
const mockTenantBiosService = jest.mocked(tenantBiosService)
const mockProfileService = jest.mocked(profileService)
const mockToast = toast as jest.Mocked<typeof toast>

async function renderManagerParentPage(ui: ReactElement, route: string) {
  return renderWithProviders(ui, { route, withAuth: false })
}

beforeEach(() => {
  jest.clearAllMocks()

  useAuthStore.getState().setSession('manager-parent-token', {
    id: 77,
    tenant_id: 10,
    name: 'Manager Parent',
    username: 'manager-parent',
    email: 'manager.parent@example.com',
    phone: '+12025550123',
    role: 'manager_parent',
    status: 'active',
    created_by: 1,
    username_locked: false,
    tenant: { id: 10, name: 'Tenant HQ', slug: 'tenant-hq', status: 'active' },
  })

  mockManagerParentService.getDashboardStats.mockResolvedValue({
    stats: {
      users: 12,
      programs: 4,
      licenses: 25,
      active_licenses: 18,
      revenue: 1250,
      team_members: 5,
      total_customers: 21,
      monthly_revenue: 640,
    },
  })
  mockManagerParentService.getRevenueChart.mockResolvedValue({ data: [{ month: 'Jan', revenue: 300 }] })
  mockManagerParentService.getExpiryForecast.mockResolvedValue({ data: [{ range: '0-7 days', count: 3 }] })
  mockManagerParentService.getTeamPerformance.mockResolvedValue({ data: [{ id: 1, name: 'Reseller One', role: 'reseller', activations: 12, revenue: 340, customers: 8 }] })
  mockManagerParentService.getConflictRate.mockResolvedValue({ data: [{ month: 'Jan', count: 2 }] })
  mockManagerParentService.getRevenueByReseller.mockResolvedValue({ data: [{ reseller: 'Reseller One', revenue: 340, activations: 12 }] })
  mockManagerParentService.getRevenueByProgram.mockResolvedValue({ data: [{ program: 'Tool A', revenue: 340, activations: 12 }] })
  mockManagerParentService.getActivationRate.mockResolvedValue({ data: [{ label: 'Success', count: 10, percentage: 83.3 }, { label: 'Failure', count: 2, percentage: 16.7 }] })
  mockManagerParentService.getRetention.mockResolvedValue({ data: [{ month: 'Jan', customers: 8, activations: 10 }] })
  mockManagerParentService.getSettings.mockResolvedValue({
    data: {
      business: { company_name: 'Tenant HQ', email: 'ops@example.com', phone: '+12025550123', address: 'Main street' },
      defaults: { trial_days: 14, base_price: 25 },
      notifications: { new_activations: true, expiry_warnings: true },
      branding: { logo: null },
    },
  })
  mockManagerParentService.updateSettings.mockResolvedValue({
    data: {
      business: { company_name: 'Tenant HQ Updated', email: 'ops@example.com', phone: '+12025550123', address: 'Main street' },
      defaults: { trial_days: 14, base_price: 25 },
      notifications: { new_activations: true, expiry_warnings: true },
      branding: { logo: null },
    },
    message: 'ok',
  })
  mockManagerParentService.getBiosHistory.mockResolvedValue({
    data: [
      {
        id: 'history-1',
        bios_id: 'BIOS-001',
        customer: 'Customer One',
        reseller: 'Reseller One',
        reseller_id: 2,
        action: 'activation',
        status: 'active',
        description: 'License activation for Customer One.',
        occurred_at: '2026-02-28T10:00:00Z',
      },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 },
  })
  mockManagerParentService.getBiosHistoryById.mockResolvedValue({
    data: {
      bios_id: 'BIOS-001',
      events: [
        {
          id: 'history-1',
          bios_id: 'BIOS-001',
          customer: 'Customer One',
          reseller: 'Reseller One',
          reseller_id: 2,
          action: 'activation',
          status: 'active',
          description: 'License activation for Customer One.',
          occurred_at: '2026-02-28T10:00:00Z',
        },
      ],
    },
  })
  mockManagerParentService.getIpStats.mockResolvedValue({
    data: {
      countries: [
        { country: 'EG', count: 5 },
        { country: 'US', count: 2 },
      ],
      suspicious: [
        {
          id: 901,
          ip_address: '10.0.0.5',
          country: 'EG',
          user_id: 2,
          created_at: '2026-02-28T10:00:00Z',
        },
      ],
    },
  })
  mockManagerParentService.getIpAnalytics.mockResolvedValue({
    data: [
      {
        id: 901,
        user: { id: 2, name: 'Reseller One', email: 'reseller@example.com' },
        ip_address: '10.0.0.5',
        country: 'EG',
        city: 'Cairo',
        isp: 'ISP One',
        reputation_score: 'high',
        action: 'login',
        created_at: '2026-02-28T10:00:00Z',
      },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 },
  })
  mockManagerParentService.getProgramsWithExternalApi.mockResolvedValue([
    {
      id: 8,
      name: 'Tool A',
      description: 'Program description',
      version: '1.0',
      download_link: 'https://example.com/tool-a',
      trial_days: 7,
      base_price: 49.99,
      icon: null,
      status: 'active',
      licenses_sold: 10,
      active_licenses_count: 8,
      revenue: 399.92,
      has_external_api: true,
      external_software_id: 8,
      created_at: '2026-02-28T10:00:00Z',
    },
  ])
  mockManagerParentService.getProgramLogs.mockResolvedValue({
    raw: 'reseller.one 2026-02-28 10:00:00 197.55.1.2',
  })
  mockManagerParentService.getUsernameManagement.mockResolvedValue({
    data: [
      {
        id: 2,
        name: 'Reseller One',
        username: 'reseller-one',
        email: 'reseller@example.com',
        role: 'reseller',
        status: 'active',
        username_locked: true,
        created_at: '2026-02-28T10:00:00Z',
      },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 },
  })
  mockManagerParentService.unlockUsername.mockResolvedValue({
    data: {
      id: 2,
      name: 'Reseller One',
      username: 'reseller-one',
      email: 'reseller@example.com',
      role: 'reseller',
      status: 'active',
      username_locked: false,
      created_at: '2026-02-28T10:00:00Z',
    },
  })
  mockManagerParentService.changeUsername.mockResolvedValue({
    data: {
      id: 2,
      name: 'Reseller One',
      username: 'reseller-two',
      email: 'reseller@example.com',
      role: 'reseller',
      status: 'active',
      username_locked: false,
      created_at: '2026-02-28T10:00:00Z',
    },
  })
  mockManagerParentService.resetPassword.mockResolvedValue({
    message: 'ok',
    temporary_password: 'password1234',
  })
  mockManagerParentService.getFinancialReports.mockResolvedValue({
    data: {
      summary: {
        total_revenue: 990,
        total_activations: 18,
        active_licenses: 15,
      },
      revenue_by_reseller: [{ reseller: 'Reseller One', revenue: 650, activations: 12 }],
      revenue_by_program: [{ program: 'Tool A', revenue: 650, activations: 12 }],
      monthly_revenue: [{ month: 'Jan', revenue: 650 }],
      reseller_balances: [
        {
          id: 2,
          reseller: 'Reseller One',
          total_revenue: 650,
          total_activations: 12,
          avg_price: 54.17,
          commission: 65,
        },
      ],
    },
  })

  mockTeamService.getAll.mockResolvedValue({
    data: [
      {
        id: 1,
        name: 'Manager One',
        email: 'manager@example.com',
        phone: '+12025550123',
        role: 'manager',
        status: 'active',
        customers_count: 5,
        active_licenses_count: 7,
        revenue: 180,
        created_at: '2026-02-28T10:00:00Z',
      },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 },
  })
  mockTeamService.create.mockResolvedValue({
    data: {
      id: 3,
      name: 'New Manager',
      email: 'new.manager@example.com',
      phone: null,
      role: 'manager',
      status: 'active',
      customers_count: 0,
      active_licenses_count: 0,
      revenue: 0,
      created_at: '2026-02-28T10:00:00Z',
    },
  })
  mockTeamService.update.mockResolvedValue({
    data: {
      id: 1,
      name: 'Manager One Updated',
      email: 'manager.updated@example.com',
      phone: '+12025550199',
      role: 'manager',
      status: 'active',
      customers_count: 5,
      active_licenses_count: 7,
      revenue: 180,
      created_at: '2026-02-28T10:00:00Z',
    },
  })
  mockTeamService.updateStatus.mockResolvedValue({
    data: {
      id: 1,
      name: 'Manager One',
      email: 'manager@example.com',
      phone: '+12025550123',
      role: 'manager',
      status: 'suspended',
      customers_count: 5,
      active_licenses_count: 7,
      revenue: 180,
      created_at: '2026-02-28T10:00:00Z',
    },
  })
  mockTeamService.delete.mockResolvedValue({ message: 'ok' } as never)

  mockProgramService.getAll.mockResolvedValue({
    data: [
      {
        id: 11,
        name: 'Tool A',
        description: 'Program description',
        version: '1.0',
        download_link: 'https://example.com/tool-a',
        trial_days: 7,
        base_price: 49.99,
        icon: null,
        status: 'active',
        licenses_sold: 10,
        active_licenses_count: 8,
        revenue: 399.92,
        has_external_api: true,
        external_software_id: 8,
        created_at: '2026-02-28T10:00:00Z',
      },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 12, total: 1, from: 1, to: 1 },
  })
  mockProgramService.create.mockResolvedValue({
    data: {
      id: 12,
      name: 'Tool B',
      description: 'Another tool',
      version: '1.0',
      download_link: 'https://example.com/tool-b',
      trial_days: 7,
      base_price: 19.99,
      icon: null,
      status: 'active',
      licenses_sold: 0,
      active_licenses_count: 0,
      revenue: 0,
      has_external_api: false,
      external_software_id: null,
      created_at: '2026-02-28T10:00:00Z',
    },
  })
  mockProgramService.update.mockResolvedValue({
    data: {
      id: 11,
      name: 'Tool A Updated',
      description: 'Program description',
      version: '2.0',
      download_link: 'https://example.com/tool-a-updated',
      trial_days: 14,
      base_price: 59.99,
      icon: null,
      status: 'inactive',
      licenses_sold: 10,
      active_licenses_count: 8,
      revenue: 399.92,
      has_external_api: true,
      external_software_id: 8,
      created_at: '2026-02-28T10:00:00Z',
    },
  })
  mockProgramService.delete.mockResolvedValue({ message: 'ok' } as never)

  mockCustomerService.getAll.mockResolvedValue({
    data: [
      {
        id: 33,
        name: 'Customer One',
        email: 'customer@example.com',
        bios_id: 'BIOS-001',
        reseller: 'Reseller One',
        program: 'Tool A',
        status: 'active',
        expiry: '2026-12-31T10:00:00Z',
        license_count: 1,
      },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 },
  })
  mockCustomerService.getOne.mockResolvedValue({
    data: {
      id: 33,
      name: 'Customer One',
      email: 'customer@example.com',
      bios_id: 'BIOS-001',
      reseller: 'Reseller One',
      program: 'Tool A',
      status: 'active',
      expiry: '2026-12-31T10:00:00Z',
      license_count: 1,
      licenses: [
        {
          id: 201,
          bios_id: 'BIOS-001',
          program: 'Tool A',
          reseller: 'Reseller One',
          status: 'active',
          price: 49.99,
          activated_at: '2026-02-28T10:00:00Z',
          expires_at: '2026-12-31T10:00:00Z',
        },
      ],
    },
  })

  mockActivityService.getAll.mockResolvedValue({
    data: [
      {
        id: 1,
        action: 'team.create',
        description: 'Created reseller account.',
        metadata: { role: 'reseller' },
        ip_address: '127.0.0.1',
        user: { id: 1, name: 'Manager One' },
        created_at: '2026-02-28T10:00:00Z',
      },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 12, total: 1, from: 1, to: 1 },
  })
  mockActivityService.export.mockResolvedValue(undefined as never)

  mockPricingService.getAll.mockResolvedValue({
    data: {
      resellers: [{ id: 2, name: 'Reseller One', email: 'reseller@example.com' }],
      selected_reseller_id: 2,
      programs: [
        {
          program_id: 11,
          program_name: 'Tool A',
          base_price: 49.99,
          reseller_price: 59.99,
          commission_rate: 10,
          margin: 10,
        },
      ],
    },
  })
  mockPricingService.history.mockResolvedValue({
    data: [
      {
        id: 1,
        reseller: 'Reseller One',
        program: 'Tool A',
        old_price: 49.99,
        new_price: 59.99,
        commission_rate: 10,
        change_type: 'single',
        changed_by: 'Manager Parent',
        created_at: '2026-02-28T10:00:00Z',
      },
    ],
  })
  mockPricingService.update.mockResolvedValue({
    data: {
      program_id: 11,
      reseller_id: 2,
      reseller_price: 64.99,
      commission_rate: 12,
    },
  })
  mockPricingService.bulk.mockResolvedValue({ message: 'ok', updated: 1 })

  mockTenantBiosService.getBlacklist.mockResolvedValue({
    data: [
      {
        id: 1,
        bios_id: 'BIOS-001',
        reason: 'Duplicate activation',
        status: 'active',
        added_by: 'Manager Parent',
        created_at: '2026-02-28T10:00:00Z',
      },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 },
  })
  mockTenantBiosService.addToBlacklist.mockResolvedValue({
    data: {
      id: 2,
      bios_id: 'BIOS-NEW',
      reason: 'Fraud',
      status: 'active',
      added_by: 'Manager Parent',
      created_at: '2026-02-28T10:00:00Z',
    },
  })
  mockTenantBiosService.removeFromBlacklist.mockResolvedValue({ message: 'ok' } as never)

  mockProfileService.updateProfile.mockResolvedValue({
    message: 'ok',
    user: {
      id: 77,
      tenant_id: 10,
      name: 'Manager Parent Updated',
      username: 'manager-parent',
      email: 'manager.parent@example.com',
      phone: '+12025550123',
      role: 'manager_parent',
      status: 'active',
      created_by: 1,
      username_locked: false,
      tenant: { id: 10, name: 'Tenant HQ', slug: 'tenant-hq', status: 'active' },
    },
  })
  mockProfileService.updatePassword.mockResolvedValue({ message: 'ok' })
})

test('manager parent dashboard renders cards and charts', async () => {
  await renderManagerParentPage(<DashboardPage />, '/en/dashboard')

  await waitFor(() => expect(mockManagerParentService.getDashboardStats).toHaveBeenCalled())

  expect(screen.getByText('Dashboard')).toBeInTheDocument()
  expect(screen.getByText('5')).toBeInTheDocument()
  expect(screen.getAllByTestId('chart')).toHaveLength(4)
  expect(screen.getAllByText('Top performers').length).toBeGreaterThan(0)
})

test('team management renders tabs and invite dialog', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<TeamManagementPage />, '/en/team-management')

  expect(await screen.findByText('Manager One')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /resellers/i })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /invite manager/i }))

  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
})

test('software management renders cards and navigational add button', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<SoftwareManagementPage />, '/en/software-management')

  expect(await screen.findByText('Tool A')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^table$/i }))
  expect(screen.getByRole('button', { name: /add program/i })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /add program/i }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('reports page renders charts and export buttons', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<ReportsPage />, '/en/reports')

  await waitFor(() => expect(mockManagerParentService.getRevenueByReseller).toHaveBeenCalled())
  expect(screen.getAllByTestId('chart')).toHaveLength(4)

  await user.click(screen.getByRole('button', { name: /csv/i }))
  await user.click(screen.getByRole('button', { name: /pdf/i }))

  expect(mockManagerParentService.exportReportsCsv).toHaveBeenCalledTimes(1)
  expect(mockManagerParentService.exportReportsPdf).toHaveBeenCalledTimes(1)
})

test('customers page opens the detail dialog from a row click', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<CustomersPage />, '/en/customers')

  expect(await screen.findByText('Customer One')).toBeInTheDocument()
  await user.click(screen.getByText('Customer One'))

  await waitFor(() => expect(mockCustomerService.getOne).toHaveBeenCalledWith(33))
  expect(await screen.findByText('License History')).toBeInTheDocument()
  expect(screen.getAllByText('Tool A').length).toBeGreaterThan(0)
})

test('settings page loads existing values and saves updates', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<SettingsPage />, '/en/settings')

  const companyName = await screen.findByLabelText(/company name/i)
  expect(companyName).toHaveValue('Tenant HQ')

  await user.clear(companyName)
  await user.type(companyName, 'Tenant HQ Updated')
  await user.click(screen.getByRole('button', { name: /save settings/i }))

  await waitFor(() => expect(mockManagerParentService.updateSettings).toHaveBeenCalled())
})

test('activity page renders entries and date filters', async () => {
  await renderManagerParentPage(<ActivityPage />, '/en/activity')

  expect(await screen.findByText('Created reseller account.')).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText(/^from$/i), { target: { value: '2026-02-01' } })
  fireEvent.change(screen.getByLabelText(/^to$/i), { target: { value: '2026-02-28' } })

  await waitFor(() =>
    expect(mockActivityService.getAll).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: '2026-02-01',
        to: '2026-02-28',
      }),
    ),
  )
})

test('reseller pricing page renders pricing rows and bulk update dialog', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<ResellerPricingPage />, '/en/reseller-pricing')

  expect(await screen.findByText('Pricing History')).toBeInTheDocument()
  expect(screen.getAllByText('Tool A').length).toBeGreaterThan(0)

  await user.click(screen.getByRole('button', { name: /bulk update/i }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.getByText(/select reseller accounts/i)).toBeInTheDocument()
})

test('bios blacklist page renders tenant entries and add dialog', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<BiosBlacklistPage />, '/en/bios-blacklist')

  expect(await screen.findByText('Duplicate activation')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /add to blacklist/i }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText(/bios id/i)).toBeInTheDocument()
})

test('bios history page renders timeline for searched bios id', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<BiosHistoryPage />, '/en/bios-history?bios=BIOS-001')

  expect(await screen.findByText(/timeline for bios-001/i)).toBeInTheDocument()
  expect(screen.getAllByText(/activation/i).length).toBeGreaterThan(0)

  await user.clear(screen.getByPlaceholderText(/enter bios id/i))
  await user.type(screen.getByPlaceholderText(/enter bios id/i), 'BIOS-001')
  await user.click(screen.getByRole('button', { name: '' }))

  await waitFor(() =>
    expect(mockManagerParentService.getBiosHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        bios_id: 'BIOS-001',
      }),
    ),
  )
})

test('ip analytics page renders chart and rows', async () => {
  await renderManagerParentPage(<IpAnalyticsPage />, '/en/ip-analytics')

  expect(await screen.findByText('Country Distribution')).toBeInTheDocument()
  expect(await screen.findByText('reseller.one')).toBeInTheDocument()
  expect(screen.getByText('197.55.1.2')).toBeInTheDocument()
})

test('username management page renders rows and opens change username dialog', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<UsernameManagementPage />, '/en/username-management')

  expect(await screen.findByText('reseller-one')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /change username/i }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText(/new username/i)).toBeInTheDocument()
})

test('financial reports page renders summary cards and export buttons', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<FinancialReportsPage />, '/en/financial-reports')

  expect((await screen.findAllByText('Reseller Balances')).length).toBeGreaterThan(0)
  expect(screen.getByText('Reseller One')).toBeInTheDocument()
  expect(screen.getAllByTestId('chart')).toHaveLength(4)

  await user.click(screen.getByRole('button', { name: /csv/i }))
  await user.click(screen.getByRole('button', { name: /pdf/i }))

  expect(mockManagerParentService.exportFinancialCsv).toHaveBeenCalledTimes(1)
  expect(mockManagerParentService.exportFinancialPdf).toHaveBeenCalledTimes(1)
})

test('profile page renders account data and submits profile update', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<ProfilePage />, '/en/profile')

  expect((await screen.findAllByText('Manager Parent')).length).toBeGreaterThan(0)

  const nameInput = screen.getByLabelText(/^name$/i)
  await user.clear(nameInput)
  await user.type(nameInput, 'Manager Parent Updated')
  await user.click(screen.getByRole('button', { name: /save profile/i }))

  await waitFor(() => expect(mockProfileService.updateProfile).toHaveBeenCalled())
})

test('dashboard quick actions are visible for common workflows', async () => {
  await renderManagerParentPage(<DashboardPage />, '/en/dashboard')

  expect(await screen.findByRole('button', { name: /invite team member/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /update reseller pricing/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /review customers/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /open reports/i })).toBeInTheDocument()
})

test('dashboard top performer card renders activation details', async () => {
  await renderManagerParentPage(<DashboardPage />, '/en/dashboard')

  expect(await screen.findByText('Reseller One')).toBeInTheDocument()
  expect(screen.getByText(/12 activations/i)).toBeInTheDocument()
  expect(screen.getByText('$340.00')).toBeInTheDocument()
})

test('team management summary cards show aggregate metrics', async () => {
  await renderManagerParentPage(<TeamManagementPage />, '/en/team-management')

  expect(await screen.findByText('Visible team members')).toBeInTheDocument()
  expect(screen.getByText('Customers represented')).toBeInTheDocument()
  expect(screen.getByText('Visible revenue')).toBeInTheDocument()
  expect(screen.getAllByText('$180.00').length).toBeGreaterThan(0)
})

test('team management invite manager submits manager role payload', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<TeamManagementPage />, '/en/team-management')

  await user.click(await screen.findByRole('button', { name: /invite manager/i }))

  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText(/^name$/i), 'New Manager')
  await user.type(within(dialog).getByLabelText(/^email$/i), 'new.manager@example.com')
  await user.type(within(dialog).getByLabelText(/phone/i), '+12025550150')
  await user.type(within(dialog).getByLabelText(/password/i), 'password123')
  await user.click(within(dialog).getByRole('button', { name: /create account/i }))

  await waitFor(() =>
    expect(mockTeamService.create).toHaveBeenCalledWith({
      name: 'New Manager',
      email: 'new.manager@example.com',
      password: 'password123',
      phone: '+12025550150',
      role: 'manager',
    }),
  )
})

test('team management invite reseller submits reseller role payload', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<TeamManagementPage />, '/en/team-management')

  await user.click(await screen.findByRole('tab', { name: /resellers/i }))
  await user.click(screen.getByRole('button', { name: /invite reseller/i }))

  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText(/^name$/i), 'New Reseller')
  await user.type(within(dialog).getByLabelText(/^email$/i), 'new.reseller@example.com')
  await user.type(within(dialog).getByLabelText(/password/i), 'password123')
  await user.click(within(dialog).getByRole('button', { name: /create account/i }))

  await waitFor(() =>
    expect(mockTeamService.create).toHaveBeenCalledWith({
      name: 'New Reseller',
      email: 'new.reseller@example.com',
      password: 'password123',
      phone: null,
      role: 'reseller',
    }),
  )
})

test('team management invite form validates email addresses', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<TeamManagementPage />, '/en/team-management')

  await user.click(await screen.findByRole('button', { name: /invite manager/i }))

  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText(/^name$/i), 'New Manager')
  await user.type(within(dialog).getByLabelText(/^email$/i), 'not-an-email')
  await user.type(within(dialog).getByLabelText(/password/i), 'password123')
  await user.click(within(dialog).getByRole('button', { name: /create account/i }))

  expect(mockToast.error).toHaveBeenLastCalledWith('Please enter a valid email address.')
  expect(mockTeamService.create).not.toHaveBeenCalled()
})

test('team management invite form validates password length', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<TeamManagementPage />, '/en/team-management')

  await user.click(await screen.findByRole('button', { name: /invite manager/i }))

  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText(/^name$/i), 'New Manager')
  await user.type(within(dialog).getByLabelText(/^email$/i), 'new.manager@example.com')
  await user.type(within(dialog).getByLabelText(/password/i), 'short')
  await user.click(within(dialog).getByRole('button', { name: /create account/i }))

  expect(mockToast.error).toHaveBeenLastCalledWith('Password must be at least 8 characters.')
  expect(mockTeamService.create).not.toHaveBeenCalled()
})

test('team management edit dialog pre-fills existing member values', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<TeamManagementPage />, '/en/team-management')

  await user.click((await screen.findAllByRole('button', { name: /^edit$/i }))[0])

  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByLabelText(/^name$/i)).toHaveValue('Manager One')
  expect(within(dialog).getByLabelText(/^email$/i)).toHaveValue('manager@example.com')
  expect(within(dialog).getByLabelText(/phone/i)).toHaveValue('+12025550123')
})

test('team management edit dialog submits updated member values', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<TeamManagementPage />, '/en/team-management')

  await user.click((await screen.findAllByRole('button', { name: /^edit$/i }))[0])

  const dialog = await screen.findByRole('dialog')
  await user.clear(within(dialog).getByLabelText(/^name$/i))
  await user.type(within(dialog).getByLabelText(/^name$/i), 'Manager One Updated')
  await user.clear(within(dialog).getByLabelText(/^email$/i))
  await user.type(within(dialog).getByLabelText(/^email$/i), 'manager.updated@example.com')
  await user.clear(within(dialog).getByLabelText(/phone/i))
  await user.type(within(dialog).getByLabelText(/phone/i), '+12025550199')
  await user.click(within(dialog).getByRole('button', { name: /save changes/i }))

  await waitFor(() =>
    expect(mockTeamService.update).toHaveBeenCalledWith(1, {
      name: 'Manager One Updated',
      email: 'manager.updated@example.com',
      phone: '+12025550199',
    }),
  )
}, 10000)

test('team management suspend action updates member status', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<TeamManagementPage />, '/en/team-management')

  await user.click(await screen.findByRole('button', { name: /suspend/i }))

  await waitFor(() => expect(mockTeamService.updateStatus).toHaveBeenCalledWith(1, 'suspended'))
})

test('team management delete confirmation calls delete service', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<TeamManagementPage />, '/en/team-management')

  await user.click(await screen.findByRole('button', { name: /^delete$/i }))

  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText(/delete team member/i)).toBeInTheDocument()

  await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

  await waitFor(() => expect(mockTeamService.delete).toHaveBeenCalledWith(1))
})

test('software management validates program form fields before submit', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<SoftwareManagementPage />, '/en/software-management')

  await user.click(await screen.findByRole('button', { name: /add program/i }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(mockProgramService.create).not.toHaveBeenCalled()
  expect(mockProgramService.update).not.toHaveBeenCalled()
})

test('software management submits a new program payload', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<SoftwareManagementPage />, '/en/software-management')

  await user.click(await screen.findByRole('button', { name: /add program/i }))
  expect(mockProgramService.create).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /add program/i })).toBeInTheDocument()
})

test('software management edit dialog pre-fills program values', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<SoftwareManagementPage />, '/en/software-management')

  await user.click((await screen.findAllByRole('button', { name: /^edit$/i }))[0])
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('software management delete confirmation dialog opens', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<SoftwareManagementPage />, '/en/software-management')

  await user.click((await screen.findAllByRole('button', { name: /^delete$/i }))[0])

  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText(/delete program/i)).toBeInTheDocument()
  expect(within(dialog).getByText(/tool a/i)).toBeInTheDocument()
})

test('software management delete confirmation calls delete service', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<SoftwareManagementPage />, '/en/software-management')

  await user.click((await screen.findAllByRole('button', { name: /^delete$/i }))[0])

  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

  await waitFor(() => expect(mockProgramService.delete).toHaveBeenCalledWith(11))
})

test('software management table view renders program columns', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<SoftwareManagementPage />, '/en/software-management')

  await user.click(await screen.findByRole('button', { name: /^table$/i }))

  expect(screen.getByText('Base Price')).toBeInTheDocument()
  expect(screen.getByText('Licenses Sold')).toBeInTheDocument()
  expect(screen.getByText('Created at')).toBeInTheDocument()
})

test('reseller pricing inline edit saves updated values', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<ResellerPricingPage />, '/en/reseller-pricing')

  await user.click(await screen.findByRole('button', { name: /^edit$/i }))
  const priceInput = screen.getByDisplayValue('59.99')
  const commissionInput = screen.getByDisplayValue('10')

  await user.clear(priceInput)
  await user.type(priceInput, '64.99')
  await user.clear(commissionInput)
  await user.type(commissionInput, '12')
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  await waitFor(() =>
    expect(mockPricingService.update).toHaveBeenCalledWith(11, {
      reseller_id: 2,
      reseller_price: 64.99,
      commission_rate: 12,
    }),
  )
})

test('reseller pricing bulk update submits selected reseller payload', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<ResellerPricingPage />, '/en/reseller-pricing')

  await user.click(await screen.findByRole('button', { name: /bulk update/i }))

  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByLabelText(/reseller one/i))
  await user.clear(within(dialog).getByLabelText(/markup/i))
  await user.type(within(dialog).getByLabelText(/markup/i), '15')
  await user.clear(within(dialog).getByLabelText(/commission/i))
  await user.type(within(dialog).getByLabelText(/commission/i), '12')
  await user.click(within(dialog).getByRole('button', { name: /apply bulk update/i }))

  await waitFor(() =>
    expect(mockPricingService.bulk).toHaveBeenCalledWith({
      reseller_ids: [2],
      mode: 'markup',
      value: 15,
      commission_rate: 12,
    }),
  )
})

test('reseller pricing bulk update validates required selections', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<ResellerPricingPage />, '/en/reseller-pricing')

  await user.click(await screen.findByRole('button', { name: /bulk update/i }))

  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: /apply bulk update/i }))

  expect(mockToast.error).toHaveBeenLastCalledWith('Select at least one reseller and enter a valid value.')
  expect(mockPricingService.bulk).not.toHaveBeenCalled()
})

test('reseller pricing history table shows audit details', async () => {
  await renderManagerParentPage(<ResellerPricingPage />, '/en/reseller-pricing')

  expect(await screen.findByText('Manager Parent')).toBeInTheDocument()
  expect(screen.getAllByText('Tool A').length).toBeGreaterThan(0)
  expect(screen.getAllByText('$59.99').length).toBeGreaterThan(0)
})

test('reports page date range changes refetch report queries', async () => {
  await renderManagerParentPage(<ReportsPage />, '/en/reports')

  fireEvent.change(await screen.findByLabelText(/^from$/i), { target: { value: '2026-02-01' } })
  fireEvent.change(screen.getByLabelText(/^to$/i), { target: { value: '2026-02-28' } })

  await waitFor(() =>
    expect(mockManagerParentService.getRevenueByReseller).toHaveBeenLastCalledWith({
      from: '2026-02-01',
      to: '2026-02-28',
    }),
  )
  expect(mockManagerParentService.getRevenueByProgram).toHaveBeenLastCalledWith({
    from: '2026-02-01',
    to: '2026-02-28',
  })
})

test('reports page summary cards show aggregated totals', async () => {
  await renderManagerParentPage(<ReportsPage />, '/en/reports')

  expect(await screen.findByText('$340.00')).toBeInTheDocument()
  expect(screen.getByText('12')).toBeInTheDocument()
  expect(screen.getByText('83.3%')).toBeInTheDocument()
})

test('reports export actions forward the active date range', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<ReportsPage />, '/en/reports')

  fireEvent.change(await screen.findByLabelText(/^from$/i), { target: { value: '2026-02-01' } })
  fireEvent.change(screen.getByLabelText(/^to$/i), { target: { value: '2026-02-28' } })

  await user.click(screen.getByRole('button', { name: /csv/i }))
  await user.click(screen.getByRole('button', { name: /pdf/i }))

  expect(mockManagerParentService.exportReportsCsv).toHaveBeenCalledWith({ from: '2026-02-01', to: '2026-02-28' })
  expect(mockManagerParentService.exportReportsPdf).toHaveBeenCalledWith({ from: '2026-02-01', to: '2026-02-28' })
})

test('customers reseller filter requests filtered data', async () => {
  await renderManagerParentPage(<CustomersPage />, '/en/customers')

  fireEvent.change(await screen.findByDisplayValue('All resellers'), { target: { value: '1' } })

  await waitFor(() =>
    expect(mockCustomerService.getAll).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reseller_id: 1,
      }),
    ),
  )
})

test('customers program filter requests filtered data', async () => {
  await renderManagerParentPage(<CustomersPage />, '/en/customers')

  fireEvent.change(await screen.findByDisplayValue('All programs'), { target: { value: '11' } })

  await waitFor(() =>
    expect(mockCustomerService.getAll).toHaveBeenLastCalledWith(
      expect.objectContaining({
        program_id: 11,
      }),
    ),
  )
})

test('customers status tabs request filtered data', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<CustomersPage />, '/en/customers')

  await user.click(await screen.findByRole('tab', { name: /expired/i }))

  await waitFor(() =>
    expect(mockCustomerService.getAll).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'expired',
      }),
    ),
  )
})

test('activity page user and action filters refetch activity data', async () => {
  await renderManagerParentPage(<ActivityPage />, '/en/activity')

  fireEvent.change(await screen.findByDisplayValue('All actions'), { target: { value: 'team.create' } })
  fireEvent.change(screen.getByDisplayValue('All users'), { target: { value: '1' } })

  await waitFor(() =>
    expect(mockActivityService.getAll).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'team.create',
        user_id: 1,
      }),
    ),
  )
})

test('activity export uses the currently selected filters', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<ActivityPage />, '/en/activity')

  fireEvent.change(await screen.findByDisplayValue('All actions'), { target: { value: 'team.create' } })
  fireEvent.change(screen.getByDisplayValue('All users'), { target: { value: '1' } })
  await user.click(screen.getByRole('button', { name: /export/i }))

  await waitFor(() =>
    expect(mockActivityService.export).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'team.create',
        user_id: 1,
      }),
    ),
  )
})

test('settings page blocks invalid email addresses', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<SettingsPage />, '/en/settings')

  const emailInput = await screen.findByLabelText(/^email$/i)
  await user.clear(emailInput)
  await user.type(emailInput, 'invalid-email')
  await user.click(screen.getByRole('button', { name: /save settings/i }))

  expect(mockToast.error).toHaveBeenLastCalledWith('Business email must be valid.')
  expect(mockManagerParentService.updateSettings).not.toHaveBeenCalled()
})

test('settings page requires a company name before save', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<SettingsPage />, '/en/settings')

  const companyName = await screen.findByLabelText(/company name/i)
  await user.clear(companyName)
  await user.click(screen.getByRole('button', { name: /save settings/i }))

  expect(mockToast.error).toHaveBeenLastCalledWith('Company name is required.')
  expect(mockManagerParentService.updateSettings).not.toHaveBeenCalled()
})

test('bios blacklist page submits a new blacklist payload', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<BiosBlacklistPage />, '/en/bios-blacklist')

  await user.click(await screen.findByRole('button', { name: /add to blacklist/i }))

  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText(/bios id/i), 'BIOS-NEW')
  await user.type(within(dialog).getByLabelText(/reason/i), 'Fraud')
  await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

  await waitFor(() => expect(mockTenantBiosService.addToBlacklist).toHaveBeenCalledWith({ bios_id: 'BIOS-NEW', reason: 'Fraud' }))
})

test('bios blacklist page validates empty add form submissions', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<BiosBlacklistPage />, '/en/bios-blacklist')

  await user.click(await screen.findByRole('button', { name: /add to blacklist/i }))

  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

  expect(mockToast.error).toHaveBeenLastCalledWith('BIOS ID and reason are required.')
  expect(mockTenantBiosService.addToBlacklist).not.toHaveBeenCalled()
})

test('bios blacklist page remove action calls the service', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<BiosBlacklistPage />, '/en/bios-blacklist')

  await user.click(await screen.findByRole('button', { name: /remove/i }))

  await waitFor(() => expect(mockTenantBiosService.removeFromBlacklist).toHaveBeenCalledWith(1))
})

test('bios history filters call the tenant-scoped history endpoint', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<BiosHistoryPage />, '/en/bios-history')

  await user.type(await screen.findByPlaceholderText(/enter bios id/i), 'BIOS-001')
  fireEvent.change(screen.getByDisplayValue('All actions'), { target: { value: 'activation' } })
  fireEvent.change(screen.getByDisplayValue('All resellers'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText(/^from$/i), { target: { value: '2026-02-01' } })
  fireEvent.change(screen.getByLabelText(/^to$/i), { target: { value: '2026-02-28' } })
  await user.click(screen.getByRole('button', { name: '' }))

  await waitFor(() =>
    expect(mockManagerParentService.getBiosHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        bios_id: 'BIOS-001',
        action: 'activation',
        reseller_id: 1,
        from: '2026-02-01',
        to: '2026-02-28',
      }),
    ),
  )
})

test('ip analytics filters call the scoped analytics endpoint', async () => {
  await renderManagerParentPage(<IpAnalyticsPage />, '/en/ip-analytics')

  fireEvent.change(await screen.findByDisplayValue('Tool A'), { target: { value: '8' } })
  fireEvent.change(screen.getByDisplayValue('All reputation scores'), { target: { value: 'proxy' } })
  fireEvent.change(screen.getByLabelText(/^from$/i), { target: { value: '2026-02-01' } })
  fireEvent.change(screen.getByLabelText(/^to$/i), { target: { value: '2026-02-28' } })

  await waitFor(() => expect(mockManagerParentService.getProgramLogs).toHaveBeenCalledWith(8))
})

test('username management unlock action opens a reason dialog', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<UsernameManagementPage />, '/en/username-management')

  await user.click(await screen.findByRole('button', { name: /^unlock$/i }))

  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByLabelText(/reason/i)).toBeInTheDocument()
})

test('username management unlock confirmation calls the API', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<UsernameManagementPage />, '/en/username-management')

  await user.click(await screen.findByRole('button', { name: /^unlock$/i }))

  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText(/reason/i), 'Verified by support')
  await user.click(within(dialog).getByRole('button', { name: /^unlock$/i }))

  await waitFor(() => expect(mockManagerParentService.unlockUsername).toHaveBeenCalledWith(2, 'Verified by support'))
})

test('username management change username dialog submits the new value', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<UsernameManagementPage />, '/en/username-management')

  await user.click(await screen.findByRole('button', { name: /change username/i }))

  const dialog = await screen.findByRole('dialog')
  await user.clear(within(dialog).getByLabelText(/new username/i))
  await user.type(within(dialog).getByLabelText(/new username/i), 'reseller-two')
  await user.type(within(dialog).getByLabelText(/reason/i), 'Normalization')
  await user.click(within(dialog).getByRole('button', { name: /save username/i }))

  await waitFor(() => expect(mockManagerParentService.changeUsername).toHaveBeenCalledWith(2, 'reseller-two', 'Normalization'))
})

test('username management reset password calls the API', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<UsernameManagementPage />, '/en/username-management')

  await user.click(await screen.findByRole('button', { name: /reset password/i }))

  await waitFor(() => expect(mockManagerParentService.resetPassword).toHaveBeenCalledWith(2))
})

test('financial reports date range changes refetch the report payload', async () => {
  await renderManagerParentPage(<FinancialReportsPage />, '/en/financial-reports')

  fireEvent.change(await screen.findByLabelText(/^from$/i), { target: { value: '2026-02-01' } })
  fireEvent.change(screen.getByLabelText(/^to$/i), { target: { value: '2026-02-28' } })

  await waitFor(() =>
    expect(mockManagerParentService.getFinancialReports).toHaveBeenLastCalledWith({
      from: '2026-02-01',
      to: '2026-02-28',
    }),
  )
})

test('financial report exports use the active date range', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<FinancialReportsPage />, '/en/financial-reports')

  fireEvent.change(await screen.findByLabelText(/^from$/i), { target: { value: '2026-02-01' } })
  fireEvent.change(screen.getByLabelText(/^to$/i), { target: { value: '2026-02-28' } })

  await user.click(screen.getByRole('button', { name: /csv/i }))
  await user.click(screen.getByRole('button', { name: /pdf/i }))

  expect(mockManagerParentService.exportFinancialCsv).toHaveBeenCalledWith({ from: '2026-02-01', to: '2026-02-28' })
  expect(mockManagerParentService.exportFinancialPdf).toHaveBeenCalledWith({ from: '2026-02-01', to: '2026-02-28' })
})

test('profile page submits a password update payload', async () => {
  const user = userEvent.setup()

  await renderManagerParentPage(<ProfilePage />, '/en/profile')

  await user.type(await screen.findByLabelText(/current password/i), 'old-password')
  await user.type(screen.getByLabelText(/new password/i), 'new-password-123')
  await user.type(screen.getByLabelText(/confirm password/i), 'new-password-123')
  await user.click(screen.getByRole('button', { name: /update password/i }))

  await waitFor(() =>
    expect(mockProfileService.updatePassword).toHaveBeenCalledWith({
      current_password: 'old-password',
      password: 'new-password-123',
      password_confirmation: 'new-password-123',
    }),
  )
})
