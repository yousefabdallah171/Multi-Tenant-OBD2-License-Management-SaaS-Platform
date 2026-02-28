/// <reference types="cypress" />

export {}

const AUTH_KEY = 'license-auth'

const superAdminUser = {
  id: 1,
  name: 'Super Admin',
  username: 'super.admin',
  email: 'admin@obd2sw.com',
  phone: '555-0001',
  role: 'super_admin',
  status: 'active',
  tenant_id: null,
}

const managerParentUser = {
  id: 10,
  tenant_id: 1,
  name: 'Manager Parent',
  username: 'manager.parent',
  email: 'manager-parent@obd2sw.com',
  phone: '555-0010',
  role: 'manager_parent',
  status: 'active',
  created_by: 1,
}

const customerUser = {
  id: 50,
  tenant_id: 1,
  name: 'Customer User',
  username: 'customer.main',
  email: 'customer@obd2sw.com',
  phone: '555-0050',
  role: 'customer',
  status: 'active',
  created_by: 30,
}

const pageMeta = { current_page: 1, last_page: 1, per_page: 10, total: 1 }

const programs = [
  {
    id: 1,
    name: 'OBD2 Master',
    description: 'Diagnostic suite',
    version: '5.2',
    download_link: 'https://example.com/obd2-master',
    installation_guide_url: 'https://example.com/install-guide',
    file_size: '245 MB',
    system_requirements: 'Windows 10',
    trial_days: 7,
    base_price: 99,
    icon: null,
    status: 'active',
    licenses_sold: 30,
    active_licenses_count: 20,
    revenue: 2970,
    created_at: '2026-02-01T00:00:00Z',
  },
]

const tenant = {
  id: 1,
  name: 'Tenant One',
  slug: 'tenant-one',
  status: 'active',
  settings: { timezone: 'UTC' },
  managers_count: 1,
  resellers_count: 1,
  customers_count: 2,
  active_licenses_count: 3,
  revenue: 1200,
  created_at: '2026-02-01T00:00:00Z',
}

const managedUser = {
  id: 2,
  name: 'Manager Parent One',
  email: 'manager-parent@example.com',
  username: 'manager.parent',
  phone: '555-0101',
  role: 'manager_parent',
  status: 'active',
  username_locked: false,
  tenant: { id: 1, name: 'Tenant One', slug: 'tenant-one', status: 'active' },
  created_at: '2026-02-01T00:00:00Z',
}

const teamMember = {
  id: 12,
  name: 'Reseller One',
  email: 'reseller.one@example.com',
  phone: '555-0112',
  role: 'reseller',
  status: 'active',
  customers_count: 8,
  active_licenses_count: 5,
  revenue: 320,
  created_at: '2026-02-01T00:00:00Z',
}

function setSession(path: string, user: typeof superAdminUser | typeof managerParentUser | typeof customerUser) {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem(AUTH_KEY, JSON.stringify({ token: 'test-token', user }))
    },
  })
}

function assertHealthyPage(path: string) {
  cy.location('pathname').should('eq', path)
  cy.get('main', { timeout: 10000 }).should('exist')
  cy.get('main').find('h1, h2').its('length').should('be.gte', 1)
  cy.get('body').should('not.contain.text', 'Something went wrong')
  cy.get('body').should('not.contain.text', 'حدث خطأ غير متوقع')
}

function mockSuperAdminRoutes() {
  cy.intercept('GET', '**/api/super-admin/dashboard/stats', {
    data: {
      stats: {
        total_tenants: 1,
        total_revenue: 1200,
        active_licenses: 3,
        total_users: 4,
        ip_country_map: [
          { country: 'United States', count: 2 },
          { country: 'Saudi Arabia', count: 1 },
        ],
      },
    },
  })
  cy.intercept('GET', '**/api/super-admin/dashboard/revenue-trend', {
    data: [{ month: 'Jan 2026', revenue: 1200 }],
  })
  cy.intercept('GET', '**/api/super-admin/dashboard/tenant-comparison', {
    data: [{ id: 1, name: 'Tenant One', revenue: 1200, active_licenses: 3 }],
  })
  cy.intercept('GET', '**/api/super-admin/dashboard/license-timeline', {
    data: [{ date: '2026-02-01', label: 'Feb 2026', count: 3 }],
  })
  cy.intercept('GET', '**/api/super-admin/dashboard/recent-activity', {
    data: [{ id: 1, action: 'license.activate', description: 'Activated BIOS-12345', user: 'Super Admin', tenant: 'Tenant One', created_at: '2026-02-10T00:00:00Z' }],
  })
  cy.intercept('GET', /\/api\/super-admin\/tenants(\?.*)?$/, {
    data: [tenant],
    meta: pageMeta,
  })
  cy.intercept('GET', '**/api/super-admin/tenants/1/stats', {
    data: { users: 4, resellers: 1, customers: 2, licenses: 3, active_licenses: 3, revenue: 1200 },
  })
  cy.intercept('GET', /\/api\/super-admin\/users(\?.*)?$/, {
    data: [managedUser],
    meta: pageMeta,
    role_counts: { super_admin: 1, manager_parent: 1, manager: 1, reseller: 1, customer: 1 },
  })
  cy.intercept('GET', /\/api\/super-admin\/admin-management(\?.*)?$/, {
    data: [managedUser],
    meta: pageMeta,
  })
  cy.intercept('GET', /\/api\/super-admin\/bios-blacklist\/stats(\?.*)?$/, {
    data: [{ month: 'Feb 2026', additions: 1, removals: 0 }],
  })
  cy.intercept('GET', /\/api\/super-admin\/bios-blacklist(\?.*)?$/, {
    data: [{ id: 1, bios_id: 'BIOS-12345', reason: 'Duplicate device', status: 'active', added_by: 'Super Admin', created_at: '2026-02-01T00:00:00Z' }],
    meta: pageMeta,
  })
  cy.intercept('GET', /\/api\/super-admin\/bios-history\/[^/?]+$/, {
    data: {
      bios_id: 'BIOS-12345',
      events: [{ id: '1', bios_id: 'BIOS-12345', tenant_id: 1, tenant: 'Tenant One', customer: 'Customer One', action: 'activation', status: 'success', description: 'Activated', occurred_at: '2026-02-10T00:00:00Z' }],
    },
  })
  cy.intercept('GET', /\/api\/super-admin\/bios-history(\?.*)?$/, {
    data: [{ id: '1', bios_id: 'BIOS-12345', tenant_id: 1, tenant: 'Tenant One', customer: 'Customer One', action: 'activation', status: 'success', description: 'Activated', occurred_at: '2026-02-10T00:00:00Z' }],
    meta: pageMeta,
  })
  cy.intercept('GET', /\/api\/super-admin\/username-management(\?.*)?$/, {
    data: [{ ...managedUser, role: 'reseller', username_locked: false }],
    meta: pageMeta,
  })
  cy.intercept('GET', '**/api/super-admin/financial-reports*', {
    data: {
      summary: {
        total_platform_revenue: 1200,
        total_activations: 20,
        active_licenses: 3,
        avg_revenue_per_tenant: 1200,
      },
      revenue_by_tenant: [{ tenant: 'Tenant One', revenue: 1200 }],
      revenue_by_program: [{ program: 'OBD2 Master', revenue: 1200, activations: 20 }],
      revenue_breakdown: [{ tenant: 'Tenant One', 'OBD2 Master': 1200 }],
      revenue_breakdown_series: ['OBD2 Master'],
      monthly_revenue: [{ month: 'Jan 2026', revenue: 1200 }],
      reseller_balances: [{ id: 1, reseller: 'Reseller One', tenant: 'Tenant One', total_revenue: 800, total_activations: 20, avg_price: 40, balance: 200 }],
    },
  })
  cy.intercept('GET', '**/api/super-admin/reports/revenue*', {
    data: [{ tenant: 'Tenant One', revenue: 1200 }],
  })
  cy.intercept('GET', '**/api/super-admin/reports/activations*', {
    data: [{ month: 'Jan 2026', count: 20 }],
  })
  cy.intercept('GET', '**/api/super-admin/reports/growth*', {
    data: [{ month: 'Jan 2026', users: 4 }],
  })
  cy.intercept('GET', '**/api/super-admin/reports/top-resellers*', {
    data: [{ reseller: 'Reseller One', tenant: 'Tenant One', activations: 20, revenue: 800 }],
  })
  cy.intercept('GET', /\/api\/super-admin\/logs(\?.*)?$/, {
    data: [{ id: 1, tenant: 'Tenant One', user: 'Super Admin', endpoint: '/health', method: 'GET', status_code: 200, response_time_ms: 142, request_body: {}, response_body: {}, created_at: '2026-02-10T00:00:00Z' }],
    meta: pageMeta,
  })
  cy.intercept('GET', '**/api/super-admin/api-status/history', {
    data: [{ time: '10:00', response_time_ms: 142, status_code: 200 }],
  })
  cy.intercept('GET', '**/api/super-admin/api-status', {
    data: {
      status: 'online',
      last_check_at: '2026-02-10T10:00:00Z',
      response_time_ms: 142,
      uptime: { '24h': 99.9, '7d': 99.5, '30d': 99.2 },
      endpoints: [{ endpoint: '/health', status: 'online', status_code: 200, last_checked_at: '2026-02-10T10:00:00Z' }],
    },
  })
  cy.intercept('GET', '**/api/super-admin/settings', {
    data: {
      general: { platform_name: 'OBD2SW', default_trial_days: 7, maintenance_mode: false },
      api: { url: 'https://api.example.com', key: 'secret-key', timeout: 30, retries: 3 },
      notifications: { email_enabled: true, pusher_enabled: true },
      security: { min_password_length: 8, session_timeout: 60 },
    },
  })
}

function mockManagerParentRoutes() {
  cy.intercept('GET', /\/api\/dashboard\/stats(\?.*)?$/, {
    stats: {
      team_members: 2,
      total_customers: 8,
      active_licenses: 5,
      monthly_revenue: 320,
    },
  })
  cy.intercept('GET', /\/api\/dashboard\/revenue-chart(\?.*)?$/, {
    data: [{ month: 'Feb 2026', revenue: 320 }],
  })
  cy.intercept('GET', /\/api\/dashboard\/expiry-forecast(\?.*)?$/, {
    data: [{ range: '0-30 days', count: 2 }, { range: '31-60 days', count: 1 }],
  })
  cy.intercept('GET', /\/api\/dashboard\/team-performance(\?.*)?$/, {
    data: [{ id: 12, name: 'Reseller One', role: 'reseller', activations: 5, revenue: 320, customers: 8 }],
  })
  cy.intercept('GET', /\/api\/dashboard\/conflict-rate(\?.*)?$/, {
    data: [{ month: 'Feb 2026', count: 1 }],
  })
  cy.intercept('GET', /\/api\/team(\?.*)?$/, {
    data: [teamMember],
    meta: pageMeta,
  })
  cy.intercept('GET', /\/api\/pricing\/history(\?.*)?$/, {
    data: [{ id: 1, reseller: 'Reseller One', program: 'OBD2 Master', old_price: 99, new_price: 120, commission_rate: 10, change_type: 'single', changed_by: 'Manager Parent', created_at: '2026-02-10T00:00:00Z' }],
  })
  cy.intercept('GET', /\/api\/pricing(\?.*)?$/, {
    data: {
      resellers: [{ id: 12, name: 'Reseller One', email: 'reseller.one@example.com' }],
      selected_reseller_id: 12,
      programs: [{ program_id: 1, program_name: 'OBD2 Master', base_price: 99, reseller_price: 120, commission_rate: 10, margin: 21.21 }],
    },
  })
  cy.intercept('GET', /\/api\/programs(\?.*)?$/, {
    data: programs,
    meta: { current_page: 1, last_page: 1, per_page: 100, total: programs.length },
  })
  cy.intercept('GET', /\/api\/bios-blacklist(\?.*)?$/, {
    data: [{ id: 1, bios_id: 'BIOS-12345', reason: 'Blocked device', status: 'active', added_by: 'Manager Parent', created_at: '2026-02-01T00:00:00Z' }],
    meta: pageMeta,
  })
  cy.intercept('GET', /\/api\/bios-history\/[^/?]+$/, {
    data: {
      bios_id: 'BIOS-12345',
      events: [{ id: '1', bios_id: 'BIOS-12345', customer: 'Customer One', reseller: 'Reseller One', reseller_id: 12, action: 'activation', status: 'success', description: 'Activated', occurred_at: '2026-02-10T00:00:00Z' }],
    },
  })
  cy.intercept('GET', /\/api\/bios-history(\?.*)?$/, {
    data: [{ id: '1', bios_id: 'BIOS-12345', customer: 'Customer One', reseller: 'Reseller One', reseller_id: 12, action: 'activation', status: 'success', description: 'Activated', occurred_at: '2026-02-10T00:00:00Z' }],
    meta: pageMeta,
  })
  cy.intercept('GET', /\/api\/ip-analytics\/stats(\?.*)?$/, {
    data: {
      countries: [{ country: 'United States', count: 2 }],
      suspicious: [{ id: 1, ip_address: '192.168.1.10', country: 'United States', user_id: 12, created_at: '2026-02-10T00:00:00Z' }],
    },
  })
  cy.intercept('GET', /\/api\/ip-analytics(\?.*)?$/, {
    data: [{ id: 1, user: { id: 12, name: 'Reseller One', email: 'reseller.one@example.com' }, ip_address: '192.168.1.10', country: 'United States', city: 'Austin', isp: 'Example ISP', reputation_score: 'low', action: 'login', created_at: '2026-02-10T00:00:00Z' }],
    meta: pageMeta,
  })
  cy.intercept('GET', /\/api\/username-management(\?.*)?$/, {
    data: [{ id: 12, name: 'Reseller One', username: 'reseller.one', email: 'reseller.one@example.com', role: 'reseller', status: 'active', username_locked: false, created_at: '2026-02-01T00:00:00Z' }],
    meta: pageMeta,
  })
  cy.intercept('GET', '**/api/financial-reports*', {
    data: {
      summary: { total_revenue: 320, total_activations: 5, active_licenses: 5 },
      revenue_by_reseller: [{ reseller: 'Reseller One', revenue: 320, activations: 5 }],
      revenue_by_program: [{ program: 'OBD2 Master', revenue: 320, activations: 5 }],
      monthly_revenue: [{ month: 'Feb 2026', revenue: 320 }],
      reseller_balances: [{ id: 12, reseller: 'Reseller One', total_revenue: 320, total_activations: 5, avg_price: 64, commission: 10 }],
    },
  })
  cy.intercept('GET', '**/api/reports/revenue-by-reseller*', {
    data: [{ reseller: 'Reseller One', revenue: 320, activations: 5 }],
  })
  cy.intercept('GET', '**/api/reports/revenue-by-program*', {
    data: [{ program: 'OBD2 Master', revenue: 320, activations: 5 }],
  })
  cy.intercept('GET', '**/api/reports/activation-rate*', {
    data: [{ label: 'success', count: 5, percentage: 100 }],
  })
  cy.intercept('GET', '**/api/reports/retention*', {
    data: [{ month: 'Feb 2026', customers: 8, activations: 5 }],
  })
  cy.intercept('GET', /\/api\/activity(\?.*)?$/, {
    data: [{ id: 1, action: 'license.activate', description: 'Activated BIOS-12345', metadata: {}, ip_address: '192.168.1.10', user: { id: 12, name: 'Reseller One' }, created_at: '2026-02-10T00:00:00Z' }],
    meta: pageMeta,
  })
  cy.intercept('GET', /\/api\/customers\/401$/, {
    data: {
      id: 401,
      name: 'Customer One',
      email: 'customer1@example.com',
      bios_id: 'BIOS-12345',
      reseller: 'Reseller One',
      program: 'OBD2 Master',
      status: 'active',
      expiry: '2026-03-12T00:00:00Z',
      license_count: 1,
      licenses: [{ id: 1, bios_id: 'BIOS-12345', program: 'OBD2 Master', reseller: 'Reseller One', status: 'active', price: 120, activated_at: '2026-02-10T00:00:00Z', expires_at: '2026-03-12T00:00:00Z' }],
    },
  })
  cy.intercept('GET', /\/api\/customers(\?.*)?$/, {
    data: [{ id: 401, name: 'Customer One', email: 'customer1@example.com', bios_id: 'BIOS-12345', reseller: 'Reseller One', program: 'OBD2 Master', status: 'active', expiry: '2026-03-12T00:00:00Z', license_count: 1 }],
    meta: pageMeta,
  })
  cy.intercept('GET', /\/api\/settings(\?.*)?$/, {
    data: {
      business: { company_name: 'Tenant One', email: 'tenant@example.com', phone: '555-0101', address: 'Main Street' },
      defaults: { trial_days: 7, base_price: 99 },
      notifications: { new_activations: true, expiry_warnings: true },
      branding: { logo: null },
    },
  })
}

function mockCustomerRoutes() {
  cy.intercept('GET', '**/api/customer/dashboard', {
    data: {
      summary: { total_licenses: 1, active_licenses: 1, expired_licenses: 0 },
      licenses: [{
        id: 1,
        program_id: 1,
        program_name: 'OBD2 Master',
        program_description: 'Diagnostic suite',
        program_version: '5.2',
        program_icon: null,
        bios_id: 'BIOS-12345',
        status: 'active',
        activated_at: '2026-02-10T00:00:00Z',
        expires_at: '2026-03-12T00:00:00Z',
        days_remaining: 30,
        percentage_remaining: 80,
        download_link: 'https://example.com/obd2-master',
        reseller_name: 'Reseller One',
        reseller_email: 'reseller.one@example.com',
        can_download: true,
      }],
    },
  })
  cy.intercept('GET', '**/api/customer/software', {
    data: [{
      id: 1,
      license_id: 1,
      program_id: 1,
      name: 'OBD2 Master',
      description: 'Diagnostic suite',
      version: '5.2',
      icon: null,
      status: 'active',
      download_link: 'https://example.com/obd2-master',
      file_size: '245 MB',
      system_requirements: 'Windows 10',
      installation_guide_url: 'https://example.com/install-guide',
      expires_at: '2026-03-12T00:00:00Z',
      days_remaining: 30,
      can_download: true,
    }],
  })
  cy.intercept('GET', '**/api/customer/downloads', {
    data: [{
      id: 1,
      license_id: 1,
      program_id: 1,
      program_name: 'OBD2 Master',
      version: '5.2',
      download_link: 'https://example.com/obd2-master',
      file_size: '245 MB',
      last_downloaded_at: '2026-02-10T00:00:00Z',
      system_requirements: 'Windows 10',
      installation_guide_url: 'https://example.com/install-guide',
      status: 'active',
      days_remaining: 30,
      can_download: true,
    }],
  })
}

describe('Phase 7 Route Smoke', () => {
  it('renders guest auth routes', () => {
    cy.visit('/en/login')
    cy.contains('Sign in').should('exist')

    cy.visit('/en/forgot-password')
    cy.contains('Send reset link').should('exist')
  })

  it('smoke-tests all super admin routes', () => {
    cy.viewport(1440, 900)
    mockSuperAdminRoutes()

    const routes = [
      '/en/super-admin/dashboard',
      '/en/super-admin/tenants',
      '/en/super-admin/users',
      '/en/super-admin/admin-management',
      '/en/super-admin/bios-blacklist',
      '/en/super-admin/bios-history',
      '/en/super-admin/username-management',
      '/en/super-admin/financial-reports',
      '/en/super-admin/reports',
      '/en/super-admin/logs',
      '/en/super-admin/api-status',
      '/en/super-admin/settings',
      '/en/super-admin/profile',
    ]

    routes.forEach((path) => {
      setSession(path, superAdminUser)
      assertHealthyPage(path)
    })
  })

  it('smoke-tests all manager parent routes', () => {
    cy.viewport(1440, 900)
    mockManagerParentRoutes()

    const routes = [
      '/en/dashboard',
      '/en/team-management',
      '/en/reseller-pricing',
      '/en/software-management',
      '/en/bios-blacklist',
      '/en/bios-history',
      '/en/ip-analytics',
      '/en/username-management',
      '/en/financial-reports',
      '/en/reports',
      '/en/activity',
      '/en/customers',
      '/en/settings',
      '/en/profile',
    ]

    routes.forEach((path) => {
      setSession(path, managerParentUser)
      assertHealthyPage(path)
    })
  })

  it('smoke-tests all customer portal routes', () => {
    cy.viewport(1280, 800)
    mockCustomerRoutes()

    const routes = [
      '/en/customer/dashboard',
      '/en/customer/software',
      '/en/customer/download',
    ]

    routes.forEach((path) => {
      setSession(path, customerUser)
      assertHealthyPage(path)
    })
  })
})
