import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/stores/authStore'
import { resolveThemePreference, useThemeStore } from '@/stores/themeStore'
import type { User } from '@/types/user.types'

function fakeSuperAdmin(): User {
  return {
    id: 1,
    tenant_id: null,
    name: 'Super Admin',
    username: 'super-admin',
    email: 'admin@example.com',
    phone: null,
    role: 'super_admin',
    status: 'active',
    created_by: null,
    username_locked: false,
    tenant: null,
  }
}

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
}

function renderDashboard(path: string) {
  useAuthStore.getState().setSession('test-token', fakeSuperAdmin())

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/:lang/super-admin" element={<DashboardLayout />}>
          <Route path="dashboard" element={<RouteContent label="dashboard content" />} />
          <Route path="settings" element={<RouteContent label="settings content" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function RouteContent({ label }: { label: string }) {
  const location = useLocation()

  return (
    <>
      <div>{label}</div>
      <div data-testid="current-path">{location.pathname}</div>
    </>
  )
}

test('renders the sidebar on the right for Arabic RTL routes', async () => {
  setViewport(1440)

  renderDashboard('/ar/super-admin/dashboard')

  await waitFor(() => expect(document.documentElement.dir).toBe('rtl'))

  const desktopShell = screen.getByTestId('desktop-sidebar-shell')
  const desktopSidebar = screen.getByTestId('desktop-sidebar')

  expect(desktopSidebar).toHaveClass('border-l')
  expect(desktopSidebar).not.toHaveClass('border-r')
  expect(desktopShell).not.toHaveClass('lg:order-last')
  expect(desktopShell).not.toHaveClass('lg:order-first')
  expect(screen.getByText('dashboard content')).toBeInTheDocument()
})

test('renders the sidebar on the left for English LTR routes', async () => {
  setViewport(1440)

  renderDashboard('/en/super-admin/dashboard')

  await waitFor(() => expect(document.documentElement.dir).toBe('ltr'))

  const desktopShell = screen.getByTestId('desktop-sidebar-shell')
  const desktopSidebar = screen.getByTestId('desktop-sidebar')

  expect(desktopSidebar).toHaveClass('border-r')
  expect(desktopSidebar).not.toHaveClass('border-l')
  expect(desktopShell).not.toHaveClass('lg:order-last')
  expect(desktopShell).not.toHaveClass('lg:order-first')
})

test('keeps the collapsed mobile RTL sidebar off-canvas on the right edge', async () => {
  setViewport(390)

  renderDashboard('/ar/super-admin/dashboard')

  const sidebar = screen.getByTestId('mobile-sidebar')

  await waitFor(() => expect(sidebar).toHaveClass('translate-x-full'))
  expect(sidebar).toHaveClass('right-0')
  expect(sidebar).not.toHaveClass('-translate-x-full')
})

test('highlights the active sidebar route inside the dashboard layout', async () => {
  setViewport(1440)

  renderDashboard('/en/super-admin/dashboard')

  const activeLinks = await screen.findAllByRole('link', { current: 'page' })

  expect(activeLinks[0]).toHaveAttribute('href', '/en/super-admin/dashboard')
})

test('language toggle preserves the current super admin path', async () => {
  const user = userEvent.setup()
  setViewport(1440)

  renderDashboard('/ar/super-admin/settings')

  await user.click(screen.getByRole('button', { name: /toggle language|تبديل اللغة/i }))

  await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/en/super-admin/settings'))
  await waitFor(() => expect(document.documentElement.dir).toBe('ltr'))
})

test('theme toggle applies the dark class to the document root', async () => {
  const user = userEvent.setup()
  setViewport(1440)

  renderDashboard('/en/super-admin/dashboard')

  await user.click(screen.getByRole('button', { name: /toggle theme|dark mode|تبديل السمة/i }))

  await waitFor(() => expect(document.documentElement).toHaveClass('dark'))
})

test('theme toggle preserves the dark mode class across dashboard navigation', async () => {
  const user = userEvent.setup()
  setViewport(1440)

  renderDashboard('/en/super-admin/dashboard')

  await user.click(screen.getByRole('button', { name: /toggle theme|dark mode|تبديل السمة/i }))
  await waitFor(() => expect(document.documentElement).toHaveClass('dark'))

  await user.click(screen.getAllByRole('link', { name: /settings/i })[0])

  await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/en/super-admin/settings'))
  expect(document.documentElement).toHaveClass('dark')
})

test('theme preference falls back to system dark mode on first visit', () => {
  window.localStorage.removeItem('license-theme')
  useThemeStore.setState({ theme: 'light' })

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })

  expect(resolveThemePreference()).toBe('dark')

  useThemeStore.getState().hydrateTheme()

  expect(useThemeStore.getState().theme).toBe('dark')
})
