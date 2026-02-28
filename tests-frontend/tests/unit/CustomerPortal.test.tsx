import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LicenseCard } from '@/components/customer/LicenseCard'
import { LicenseProgress } from '@/components/customer/LicenseProgress'
import { CustomerLayout } from '@/components/layout/CustomerLayout'
import { DashboardPage } from '@/pages/customer/Dashboard'
import { DownloadPage } from '@/pages/customer/Download'
import { SoftwarePage } from '@/pages/customer/Software'
import { THEME_STORAGE_KEY } from '@/lib/constants'
import { customerPortalService } from '@/services/customer.service'
import { useThemeStore } from '@/stores/themeStore'
import { createTestQueryClient, setLanguage } from './testUtils'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/user.types'

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
  Toaster: () => null,
}))

jest.mock('@/services/customer.service', () => ({
  customerService: {
    getAll: jest.fn(),
    getOne: jest.fn(),
  },
  customerPortalService: {
    getDashboard: jest.fn(),
    getSoftware: jest.fn(),
    getDownloads: jest.fn(),
    logDownload: jest.fn(),
  },
}))

function fakeCustomer(): User {
  return {
    id: 55,
    tenant_id: 10,
    name: 'Customer User',
    username: 'bios-locked-user',
    email: 'customer@example.com',
    phone: null,
    role: 'customer',
    status: 'active',
    created_by: 20,
    username_locked: true,
    tenant: { id: 10, name: 'Tenant', slug: 'tenant', status: 'active' },
  }
}

async function renderCustomer(ui: React.ReactElement, route = '/en/customer/dashboard') {
  await setLanguage(route.startsWith('/ar/') ? 'ar' : 'en')
  useAuthStore.getState().setSession('customer-token', fakeCustomer())

  const queryClient = createTestQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/:lang/*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const mockCustomerPortalService = jest.mocked(customerPortalService)

beforeEach(() => {
  mockCustomerPortalService.getDashboard.mockReset()
  mockCustomerPortalService.getSoftware.mockReset()
  mockCustomerPortalService.getDownloads.mockReset()
  mockCustomerPortalService.logDownload.mockReset()
  useThemeStore.getState().setTheme('light')
  window.localStorage.removeItem(THEME_STORAGE_KEY)
  document.documentElement.classList.remove('dark')
})

test('license progress shows days remaining and green progress for active licenses', async () => {
  await renderCustomer(<LicenseProgress percentage={68} daysRemaining={45} />, '/en/customer/dashboard')

  expect(screen.getByText(/45 days remaining/i)).toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '68')
  expect(screen.getByRole('progressbar').firstChild).toHaveClass('bg-emerald-500')
})

test('license progress shows expired state when there is no time remaining', async () => {
  await renderCustomer(<LicenseProgress percentage={4} daysRemaining={0} />, '/en/customer/dashboard')

  expect(screen.getByText(/expired/i)).toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  expect(screen.getByRole('progressbar').firstChild).toHaveClass('bg-rose-500')
})

test('license card renders program information and enables downloads for active licenses', async () => {
  await renderCustomer(
    <LicenseCard
      licenseId={101}
      programName="HaynesPro"
      programVersion="2.1"
      biosId="ABC-123-XYZ"
      status="active"
      activatedAt="2026-01-10T00:00:00Z"
      expiresAt="2026-03-10T00:00:00Z"
      daysRemaining={45}
      percentageRemaining={68}
      downloadLink="https://example.com/haynespro.exe"
      onRequestRenewal={() => undefined}
    />,
    '/en/customer/dashboard',
  )

  expect(screen.getByText(/HaynesPro/i)).toBeInTheDocument()
  expect(screen.getByText(/v2.1/i)).toBeInTheDocument()
  expect(screen.getByText(/ABC-123-XYZ/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /download software/i })).toBeEnabled()
})

test('license card shows an active badge with green styling', async () => {
  await renderCustomer(
    <LicenseCard
      licenseId={101}
      programName="HaynesPro"
      biosId="ABC-123-XYZ"
      status="active"
      activatedAt="2026-01-10T00:00:00Z"
      expiresAt="2026-03-10T00:00:00Z"
      daysRemaining={45}
      percentageRemaining={68}
      downloadLink="https://example.com/haynespro.exe"
      onRequestRenewal={() => undefined}
    />,
    '/en/customer/dashboard',
  )

  const activeBadge = screen.getAllByText('Active').find((element) => element.className.includes('bg-emerald-100'))

  expect(activeBadge).toHaveClass('bg-emerald-100', 'text-emerald-700')
})

test('license card shows an expired badge with red styling', async () => {
  await renderCustomer(
    <LicenseCard
      licenseId={101}
      programName="HaynesPro"
      biosId="ABC-123-XYZ"
      status="expired"
      activatedAt="2025-01-10T00:00:00Z"
      expiresAt="2025-03-10T00:00:00Z"
      daysRemaining={0}
      percentageRemaining={0}
      downloadLink="https://example.com/haynespro.exe"
      onRequestRenewal={() => undefined}
    />,
    '/en/customer/dashboard',
  )

  const expiredBadge = screen.getAllByText('Expired').find((element) => element.className.includes('bg-rose-100'))

  expect(expiredBadge).toHaveClass('bg-rose-100', 'text-rose-700')
})

test('license card disables downloads for expired licenses', async () => {
  await renderCustomer(
    <LicenseCard
      licenseId={101}
      programName="HaynesPro"
      biosId="ABC-123-XYZ"
      status="expired"
      activatedAt="2025-01-10T00:00:00Z"
      expiresAt="2025-03-10T00:00:00Z"
      daysRemaining={0}
      percentageRemaining={0}
      downloadLink="https://example.com/haynespro.exe"
      onRequestRenewal={() => undefined}
    />,
    '/en/customer/dashboard',
  )

  expect(screen.getByRole('button', { name: /download software/i })).toBeDisabled()
  expect(screen.getByRole('button', { name: /download software/i })).toHaveAttribute(
    'title',
    'This download is unavailable because the license is not active.',
  )
})

test('download button logs the download before opening the installer', async () => {
  mockCustomerPortalService.logDownload.mockResolvedValue({ message: 'Download logged successfully.', logged_at: '2026-02-28T10:00:00Z' })

  const openMock = jest.spyOn(window, 'open').mockImplementation(() => ({ location: { href: '' } }) as Window)
  const user = userEvent.setup()

  await renderCustomer(
    <LicenseCard
      licenseId={202}
      programName="OBD2 Master"
      biosId="BIOS-202"
      status="active"
      activatedAt="2026-02-01T00:00:00Z"
      expiresAt="2026-04-01T00:00:00Z"
      daysRemaining={30}
      percentageRemaining={50}
      downloadLink="https://example.com/obd2-master.exe"
      onRequestRenewal={() => undefined}
    />,
    '/en/customer/dashboard',
  )

  await user.click(screen.getByRole('button', { name: /download software/i }))

  await waitFor(() => expect(mockCustomerPortalService.logDownload).toHaveBeenCalledWith(202))
  expect(openMock).toHaveBeenCalled()

  openMock.mockRestore()
})

test('dashboard page renders stats and license cards', async () => {
  mockCustomerPortalService.getDashboard.mockResolvedValue({
    summary: {
      total_licenses: 3,
      active_licenses: 2,
      expired_licenses: 1,
    },
    licenses: [
      {
        id: 1,
        program_id: 8,
        program_name: 'HaynesPro',
        program_description: 'Diagnostic suite',
        program_version: '2.1',
        program_icon: null,
        bios_id: 'BIOS-111',
        status: 'active',
        activated_at: '2026-01-01T00:00:00Z',
        expires_at: '2026-04-01T00:00:00Z',
        days_remaining: 30,
        percentage_remaining: 50,
        download_link: 'https://example.com/haynespro.exe',
        reseller_name: 'Reseller One',
        can_download: true,
      },
    ],
  })

  await renderCustomer(<DashboardPage />, '/en/customer/dashboard')

  expect(await screen.findByText(/License Dashboard/i)).toBeInTheDocument()
  expect(screen.getByText('3')).toBeInTheDocument()
  expect(screen.getByText(/HaynesPro/i)).toBeInTheDocument()
  expect(screen.getAllByTestId('license-card')).toHaveLength(1)
})

test('dashboard page uses responsive license grid classes', async () => {
  mockCustomerPortalService.getDashboard.mockResolvedValue({
    summary: {
      total_licenses: 1,
      active_licenses: 1,
      expired_licenses: 0,
    },
    licenses: [
      {
        id: 1,
        program_id: 8,
        program_name: 'HaynesPro',
        program_description: 'Diagnostic suite',
        program_version: '2.1',
        program_icon: null,
        bios_id: 'BIOS-111',
        status: 'active',
        activated_at: '2026-01-01T00:00:00Z',
        expires_at: '2026-04-01T00:00:00Z',
        days_remaining: 30,
        percentage_remaining: 50,
        download_link: 'https://example.com/haynespro.exe',
        reseller_name: 'Reseller One',
        can_download: true,
      },
    ],
  })

  await renderCustomer(<DashboardPage />, '/en/customer/dashboard')

  const grid = await screen.findByTestId('customer-dashboard-grid')

  expect(grid).toHaveClass('grid', 'md:grid-cols-2', 'xl:grid-cols-3')
})

test('dashboard page shows the empty state when there are no licenses', async () => {
  mockCustomerPortalService.getDashboard.mockResolvedValue({
    summary: {
      total_licenses: 0,
      active_licenses: 0,
      expired_licenses: 0,
    },
    licenses: [],
  })

  await renderCustomer(<DashboardPage />, '/en/customer/dashboard')

  expect(await screen.findByText(/No active licenses/i)).toBeInTheDocument()
})

test('software page renders program cards and filters by search', async () => {
  mockCustomerPortalService.getSoftware.mockResolvedValue([
    {
      id: 8,
      license_id: 1,
      program_id: 8,
      name: 'HaynesPro',
      description: 'Vehicle diagnostics',
      version: '2.1',
      icon: null,
      status: 'active',
      download_link: 'https://example.com/haynespro.exe',
      expires_at: '2026-04-01T00:00:00Z',
      days_remaining: 30,
      can_download: true,
    },
    {
      id: 9,
      license_id: 2,
      program_id: 9,
      name: 'OBD2 Master',
      description: 'Flash tools',
      version: '4.0',
      icon: null,
      status: 'active',
      download_link: 'https://example.com/obd2-master.exe',
      expires_at: '2026-04-10T00:00:00Z',
      days_remaining: 40,
      can_download: true,
    },
  ])

  const user = userEvent.setup()

  await renderCustomer(<SoftwarePage />, '/en/customer/software')

  expect(await screen.findByText(/Available Software/i)).toBeInTheDocument()
  expect(screen.getByText(/HaynesPro/i)).toBeInTheDocument()

  await user.type(screen.getByPlaceholderText(/Search by program name/i), 'master')

  expect(screen.queryByText(/HaynesPro/i)).not.toBeInTheDocument()
  expect(screen.getByText(/OBD2 Master/i)).toBeInTheDocument()
})

test('download page renders available downloads', async () => {
  mockCustomerPortalService.getDownloads.mockResolvedValue([
    {
      id: 1,
      license_id: 1,
      program_id: 8,
      program_name: 'HaynesPro',
      version: '2.1',
      download_link: 'https://example.com/haynespro.exe',
      file_size: null,
      last_downloaded_at: '2026-02-20T08:00:00Z',
      system_requirements: null,
      installation_guide_url: null,
      status: 'active',
      days_remaining: 25,
      can_download: true,
    },
  ])

  await renderCustomer(<DownloadPage />, '/en/customer/download')

  expect(await screen.findByText(/Download Center/i)).toBeInTheDocument()
  expect(screen.getByText(/HaynesPro/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /download now/i })).toBeEnabled()
})

test('customer layout renders top navigation links', async () => {
  await renderCustomer(<CustomerLayout />, '/en/customer/dashboard')

  expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Software/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Download Center/i })).toBeInTheDocument()
})

test('customer layout opens the mobile navigation menu', async () => {
  const user = userEvent.setup()

  await renderCustomer(<CustomerLayout />, '/en/customer/dashboard')

  await user.click(screen.getByRole('button', { name: /open navigation menu/i }))

  expect(await screen.findByText(/Customer navigation/i)).toBeInTheDocument()
})

test('customer layout toggles the dark mode class correctly', async () => {
  const user = userEvent.setup()

  await renderCustomer(<CustomerLayout />, '/en/customer/dashboard')

  const toggle = screen.getByRole('button', { name: /dark mode/i })

  expect(document.documentElement).not.toHaveClass('dark')

  await user.click(toggle)

  await waitFor(() => expect(document.documentElement).toHaveClass('dark'))
  expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
})
