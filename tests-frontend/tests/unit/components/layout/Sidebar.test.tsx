import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { useAuthStore } from '@/stores/authStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import type { User } from '@/types/user.types'
import { setLanguage } from '../../../utils/test-utils'

function makeUser(role: User['role']): User {
  return {
    id: 1,
    tenant_id: role === 'super_admin' ? null : 1,
    name: 'Nav User',
    username: 'nav-user',
    email: 'nav@obd2sw.com',
    phone: null,
    role,
    status: 'active',
    created_by: null,
    username_locked: false,
    tenant: role === 'super_admin' ? null : { id: 1, name: 'Tenant', slug: 'tenant', status: 'active' },
  }
}

function renderSidebar(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/:lang/*" element={<Sidebar />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Sidebar', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession()
    useSidebarStore.setState({ collapsed: false })
  })

  test('renders super_admin nav including Security Locks and active route', async () => {
    await setLanguage('en')
    useAuthStore.getState().setSession('token', makeUser('super_admin'))
    renderSidebar('/en/super-admin/security-locks')

    const links = screen.getAllByRole('link', { name: /security locks/i })
    expect(links.length).toBeGreaterThan(0)
    expect(links[0]).toHaveAttribute('aria-current', 'page')
  })

  test('manager_parent sidebar includes Program Logs', async () => {
    await setLanguage('en')
    useAuthStore.getState().setSession('token', makeUser('manager_parent'))
    renderSidebar('/en/program-logs')

    expect(screen.getAllByRole('link', { name: /program logs/i }).length).toBeGreaterThan(0)
  })

  test('reseller sidebar does not render super admin item', async () => {
    await setLanguage('en')
    useAuthStore.getState().setSession('token', makeUser('reseller'))
    renderSidebar('/en/reseller/dashboard')

    expect(screen.queryByRole('link', { name: /security locks/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /software/i }).length).toBeGreaterThan(0)
  })

  test('does not render customer portal nav labels for active roles', async () => {
    await setLanguage('en')
    useAuthStore.getState().setSession('token', makeUser('manager'))
    renderSidebar('/en/manager/dashboard')

    expect(screen.queryByText(/customer portal/i)).not.toBeInTheDocument()
  })

  test('collapses to icon mode when collapsed state is true', async () => {
    await setLanguage('en')
    useAuthStore.getState().setSession('token', makeUser('manager'))
    useSidebarStore.setState({ collapsed: true })
    renderSidebar('/en/manager/dashboard')

    const shell = screen.getByTestId('desktop-sidebar-shell')
    expect(shell.className).toMatch(/lg:w-24/)
  })

  test('rtl places desktop sidebar on right side', async () => {
    await setLanguage('ar')
    useAuthStore.getState().setSession('token', makeUser('super_admin'))
    renderSidebar('/ar/super-admin/dashboard')

    const desktop = screen.getByTestId('desktop-sidebar')
    expect(desktop.className).toMatch(/border-l/)
  })

  test('mobile overlay backdrop click closes sidebar', async () => {
    const user = userEvent.setup()
    await setLanguage('en')
    useAuthStore.getState().setSession('token', makeUser('super_admin'))
    useSidebarStore.setState({ collapsed: false })
    renderSidebar('/en/super-admin/dashboard')

    const closeBackdrop = screen.getByRole('button', { name: /close navigation/i })
    await user.click(closeBackdrop)
    expect(useSidebarStore.getState().collapsed).toBe(true)
  })
})
