import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminManagementPage } from '@/pages/super-admin/AdminManagement'
import { ApiStatusPage } from '@/pages/super-admin/ApiStatus'
import { BiosBlacklistPage } from '@/pages/super-admin/BiosBlacklist'
import { BiosHistoryPage } from '@/pages/super-admin/BiosHistory'
import { FinancialReportsPage } from '@/pages/super-admin/FinancialReports'
import { ProfilePage } from '@/pages/super-admin/Profile'
import { SettingsPage } from '@/pages/super-admin/Settings'
import { UsernameManagementPage } from '@/pages/super-admin/UsernameManagement'
import { adminService } from '@/services/admin.service'
import { apiStatusService } from '@/services/api-status.service'
import { biosService } from '@/services/bios.service'
import { profileService } from '@/services/profile.service'
import { reportService } from '@/services/report.service'
import { settingsService } from '@/services/settings.service'
import { tenantService } from '@/services/tenant.service'
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

jest.mock('@/components/charts/LineChartWidget', () => ({
  LineChartWidget: ({ title }: { title: string }) => <div data-testid="chart">{title}</div>,
}))

jest.mock('@/components/charts/BarChartWidget', () => ({
  BarChartWidget: ({ title }: { title: string }) => <div data-testid="chart">{title}</div>,
}))

jest.mock('@/services/api-status.service', () => ({
  apiStatusService: {
    getStatus: jest.fn(),
    getHistory: jest.fn(),
    ping: jest.fn(),
  },
}))

jest.mock('@/services/settings.service', () => ({
  settingsService: {
    get: jest.fn(),
    update: jest.fn(),
  },
}))

jest.mock('@/services/profile.service', () => ({
  profileService: {
    updateProfile: jest.fn(),
    updatePassword: jest.fn(),
  },
}))

jest.mock('@/services/admin.service', () => ({
  adminService: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    resetPassword: jest.fn(),
  },
}))

jest.mock('@/services/tenant.service', () => ({
  tenantService: {
    getAll: jest.fn(),
  },
}))

jest.mock('@/services/bios.service', () => ({
  biosService: {
    getBlacklist: jest.fn(),
    getBlacklistStats: jest.fn(),
    addToBlacklist: jest.fn(),
    removeFromBlacklist: jest.fn(),
    exportBlacklist: jest.fn(),
    importBlacklist: jest.fn(),
    getHistory: jest.fn(),
    getHistoryById: jest.fn(),
    getUsernameManagement: jest.fn(),
    unlockUsername: jest.fn(),
    changeUsername: jest.fn(),
    resetUserPassword: jest.fn(),
  },
}))

jest.mock('@/services/report.service', () => ({
  reportService: {
    getFinancialReports: jest.fn(),
    exportFinancialCsv: jest.fn(),
    exportFinancialPdf: jest.fn(),
  },
}))

const mockApiStatusService = jest.mocked(apiStatusService)
const mockSettingsService = jest.mocked(settingsService)
const mockProfileService = jest.mocked(profileService)
const mockAdminService = jest.mocked(adminService)
const mockTenantService = jest.mocked(tenantService)
const mockBiosService = jest.mocked(biosService)
const mockReportService = jest.mocked(reportService)

beforeEach(() => {
  jest.clearAllMocks()

  mockApiStatusService.getStatus.mockResolvedValue({
    data: {
      status: 'online',
      last_check_at: '2026-02-28 12:00:00',
      response_time_ms: 142,
      uptime: { '24h': 99.9, '7d': 99.5, '30d': 98.7 },
      endpoints: [{ endpoint: '/health', status: 'online', status_code: 200, last_checked_at: '2026-02-28 12:00:00' }],
    },
  })
  mockApiStatusService.getHistory.mockResolvedValue({
    data: [{ time: '12:00', response_time_ms: 142, status_code: 200 }],
  })
  mockApiStatusService.ping.mockResolvedValue({ data: { status: 'online', status_code: 200, response_time_ms: 150, payload: {} } })

  mockSettingsService.get.mockResolvedValue({
    data: {
      general: { platform_name: 'OBD2SW', default_trial_days: 7, maintenance_mode: false },
      api: { url: 'https://api.example.test', key: 'secret-key', timeout: 30, retries: 2 },
      notifications: { email_enabled: true, pusher_enabled: false },
      security: { min_password_length: 8, session_timeout: 120 },
      widgets: { show_online_widget_to_resellers: true },
    },
  })
  mockSettingsService.update.mockResolvedValue({
    message: 'saved',
    data: {
      general: { platform_name: 'OBD2SW', default_trial_days: 7, maintenance_mode: false },
      api: { url: 'https://api.example.test', key: 'secret-key', timeout: 30, retries: 2 },
      notifications: { email_enabled: true, pusher_enabled: false },
      security: { min_password_length: 8, session_timeout: 120 },
      widgets: { show_online_widget_to_resellers: true },
    },
  })

  mockProfileService.updateProfile.mockResolvedValue({
    message: 'updated',
    user: { id: 1, tenant_id: null, name: 'Super Admin', username: 'super-admin', email: 'admin@example.com', phone: null, role: 'super_admin', status: 'active', created_by: null, username_locked: false, tenant: null },
  })
  mockProfileService.updatePassword.mockResolvedValue({ message: 'updated' })

  mockAdminService.getAll.mockResolvedValue({
    data: [
      { id: 3, name: 'Manager Parent', email: 'mp@example.com', username: 'mp', phone: null, role: 'manager_parent', status: 'active', tenant: { id: 1, name: 'Tenant One' }, created_at: '2026-02-28T10:00:00Z' },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 },
  })
  mockAdminService.update.mockResolvedValue({
    data: { id: 3, name: 'Manager Parent', email: 'mp@example.com', username: 'mp', phone: null, role: 'manager_parent', status: 'suspended', tenant: { id: 1, name: 'Tenant One' }, created_at: '2026-02-28T10:00:00Z' },
  })
  mockAdminService.delete.mockResolvedValue({ message: 'deleted' })
  mockAdminService.resetPassword.mockResolvedValue({ message: 'ok', temporary_password: 'Temp1234!' })

  mockTenantService.getAll.mockResolvedValue({
    data: [
      { id: 1, name: 'Tenant One', slug: 'tenant-one', status: 'active', settings: null, managers_count: 0, resellers_count: 0, customers_count: 0, active_licenses_count: 0, revenue: 0, created_at: '2026-02-28T10:00:00Z' },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 100, total: 1, from: 1, to: 1 },
  })

  mockBiosService.getBlacklist.mockResolvedValue({
    data: [{ id: 5, bios_id: 'BIOS-001', reason: 'Fraud', status: 'active', added_by: 'Admin', created_at: '2026-02-28T10:00:00Z' }],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 },
  })
  mockBiosService.getBlacklistStats.mockResolvedValue({ data: [{ month: 'Jan 2026', additions: 1, removals: 0 }] })
  mockBiosService.importBlacklist.mockResolvedValue({ message: 'ok', created: 1 })
  mockBiosService.getHistory.mockResolvedValue({
    data: [{ id: 'evt-1', bios_id: 'BIOS-001', tenant_id: 1, tenant: 'Tenant One', customer: 'Customer A', action: 'activation', status: 'active', description: 'Activated license', occurred_at: '2026-02-28T10:00:00Z' }],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 },
  })
  mockBiosService.getHistoryById.mockResolvedValue({
    data: {
      bios_id: 'BIOS-001',
      events: [{ id: 'evt-1', bios_id: 'BIOS-001', tenant_id: 1, tenant: 'Tenant One', customer: 'Customer A', action: 'activation', status: 'active', description: 'Activated license', occurred_at: '2026-02-28T10:00:00Z' }],
    },
  })
  mockBiosService.getUsernameManagement.mockResolvedValue({
    data: [{ id: 8, name: 'Locked User', email: 'locked@example.com', username: 'locked-user', role: 'customer', status: 'active', username_locked: true, tenant: { id: 1, name: 'Tenant One' }, created_at: '2026-02-28T10:00:00Z' }],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 },
  })
  mockBiosService.resetUserPassword.mockResolvedValue({ message: 'ok', temporary_password: 'Temp1234!' })

  mockReportService.getFinancialReports.mockResolvedValue({
    data: {
      summary: {
        total_platform_revenue: 2500,
        total_activations: 99,
        active_licenses: 44,
        avg_revenue_per_tenant: 1250,
      },
      revenue_by_tenant: [{ tenant: 'Tenant One', revenue: 1200 }],
      revenue_by_program: [{ program: 'Stage 1', revenue: 800, activations: 20 }],
      revenue_breakdown: [{ tenant: 'Tenant One', 'Stage 1': 800 }],
      revenue_breakdown_series: ['Stage 1'],
      monthly_revenue: [{ month: 'Jan', revenue: 1200 }],
      reseller_balances: [{ id: 1, reseller: 'Reseller A', tenant: 'Tenant One', total_revenue: 800, total_activations: 20, avg_price: 40, balance: 200 }],
    },
  })
})

test('API Status page renders the system status and endpoint list', async () => {
  await renderWithProviders(<ApiStatusPage />, { route: '/en/super-admin/api-status' })

  await waitFor(() => expect(mockApiStatusService.getStatus).toHaveBeenCalled())

  expect(screen.getAllByText('Online').length).toBeGreaterThan(0)
  expect(screen.getByText('/health')).toBeInTheDocument()
  expect(screen.getAllByTestId('chart')).toHaveLength(1)
})

test('Settings page renders the tabbed settings form', async () => {
  const user = userEvent.setup()

  await renderWithProviders(<SettingsPage />, { route: '/en/super-admin/settings' })

  expect(await screen.findByDisplayValue('OBD2SW')).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: /api/i }))

  expect(await screen.findByDisplayValue('https://api.example.test')).toBeInTheDocument()
})

test('Settings page keeps the API URL readonly', async () => {
  const user = userEvent.setup()

  await renderWithProviders(<SettingsPage />, { route: '/en/super-admin/settings' })

  await user.click(await screen.findByRole('tab', { name: /api/i }))

  expect(await screen.findByDisplayValue('https://api.example.test')).toHaveAttribute('readonly')
})

test('Profile page renders profile details and edit form fields', async () => {
  await renderWithProviders(<ProfilePage />, { route: '/en/super-admin/profile' })

  expect(screen.getByDisplayValue('Super Admin')).toBeInTheDocument()
  expect(screen.getByDisplayValue('admin@example.com')).toBeInTheDocument()
  expect(screen.getAllByText(/super admin/i).length).toBeGreaterThan(0)
})

test('Admin Management page renders admin data and opens the add admin modal', async () => {
  const user = userEvent.setup()

  await renderWithProviders(<AdminManagementPage />, { route: '/en/super-admin/admin-management' })

  expect(await screen.findByText('Manager Parent')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /add/i }))

  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
})

test('Admin Management bulk suspend updates selected admins', async () => {
  const user = userEvent.setup()

  await renderWithProviders(<AdminManagementPage />, { route: '/en/super-admin/admin-management' })

  await user.click(await screen.findByRole('checkbox', { name: /select manager parent/i }))
  await user.click(screen.getByRole('button', { name: /suspend selected/i }))

  await waitFor(() => expect(mockAdminService.update).toHaveBeenCalledWith(3, { status: 'suspended' }))
})

test('BIOS Blacklist page renders rows and opens the add dialog', async () => {
  const user = userEvent.setup()

  await renderWithProviders(<BiosBlacklistPage />, { route: '/en/super-admin/bios-blacklist' })

  expect(await screen.findByText('BIOS-001')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /add bios/i }))

  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText(/bios id/i)).toBeInTheDocument()
})

test('BIOS Blacklist page imports CSV entries and exposes history action', async () => {
  const user = userEvent.setup()

  const view = await renderWithProviders(<BiosBlacklistPage />, { route: '/en/super-admin/bios-blacklist' })

  const file = new File(['BIOS-001,Fraud'], 'bios-blacklist.csv', { type: 'text/csv' })
  const fileInput = view.container.querySelector('input[type="file"]') as HTMLInputElement

  await user.upload(fileInput, file)

  await waitFor(() => expect(mockBiosService.importBlacklist).toHaveBeenCalledWith(file))

  const actionButtons = screen.getAllByRole('button', { name: /actions/i })

  await user.click(actionButtons[actionButtons.length - 1])

  expect(await screen.findByText(/view history/i)).toBeInTheDocument()
})

test('BIOS History page renders the search results and timeline', async () => {
  const user = userEvent.setup()

  await renderWithProviders(<BiosHistoryPage />, { route: '/en/super-admin/bios-history' })

  expect(await screen.findByText('BIOS-001')).toBeInTheDocument()

  await user.type(screen.getAllByRole('textbox')[0], 'BIOS-001')

  await waitFor(() => expect(mockBiosService.getHistoryById).toHaveBeenCalledWith('BIOS-001'))
  expect(await screen.findByText('Activated license')).toBeInTheDocument()
})

test('Username Management page renders lock status and opens the unlock dialog', async () => {
  const user = userEvent.setup()

  await renderWithProviders(<UsernameManagementPage />, { route: '/en/super-admin/username-management' })

  expect(await screen.findByText('Locked User')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /unlock/i }))

  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText(/reason/i)).toBeInTheDocument()
})

test('Username Management page opens the change username dialog', async () => {
  const user = userEvent.setup()

  await renderWithProviders(<UsernameManagementPage />, { route: '/en/super-admin/username-management' })

  await user.click(await screen.findByRole('button', { name: /change username/i }))

  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.getByDisplayValue('locked-user')).toBeInTheDocument()
})

test('Financial Reports page renders charts, balances, and export actions', async () => {
  const user = userEvent.setup()

  await renderWithProviders(<FinancialReportsPage />, { route: '/en/super-admin/financial-reports' })

  await waitFor(() => expect(mockReportService.getFinancialReports).toHaveBeenCalled())

  expect(screen.getByText('Reseller A')).toBeInTheDocument()
  expect(screen.getAllByTestId('chart')).toHaveLength(3)

  await user.click(screen.getByRole('button', { name: 'CSV' }))
  await user.click(screen.getByRole('button', { name: 'PDF' }))

  expect(mockReportService.exportFinancialCsv).toHaveBeenCalledTimes(1)
  expect(mockReportService.exportFinancialPdf).toHaveBeenCalledTimes(1)
})
