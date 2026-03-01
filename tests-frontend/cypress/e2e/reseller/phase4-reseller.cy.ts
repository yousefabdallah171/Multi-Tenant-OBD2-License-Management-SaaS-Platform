/// <reference types="cypress" />

export {}

const AUTH_KEY = 'license-auth'

const resellerUser = {
  id: 30,
  tenant_id: 1,
  name: 'Reseller User',
  username: 'reseller.main',
  email: 'reseller@obd2sw.com',
  phone: '123456789',
  role: 'reseller',
  status: 'active',
  created_by: 20,
  username_locked: false,
}

const dashboardStats = {
  customers: 12,
  active_licenses: 9,
  revenue: 1860,
  monthly_activations: 5,
}

const dashboardSeries = [
  { month: 'Jan 2026', count: 2, revenue: 420 },
  { month: 'Feb 2026', count: 5, revenue: 930 },
]

const programs = [
  {
    id: 1,
    name: 'OBD2 Master',
    description: 'Primary diagnostic suite.',
    version: '5.2',
    download_link: 'https://example.com/obd2-master',
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

function setSession(path: string) {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem(AUTH_KEY, JSON.stringify({ token: 'test-token', user: resellerUser }))
    },
  })
}

function mockResellerDashboard() {
  cy.intercept('GET', '**/api/reseller/dashboard/stats', { stats: dashboardStats }).as('dashboardStats')
  cy.intercept('GET', '**/api/reseller/dashboard/activations-chart', { data: dashboardSeries }).as('dashboardActivations')
  cy.intercept('GET', '**/api/reseller/dashboard/revenue-chart', { data: dashboardSeries }).as('dashboardRevenue')
  cy.intercept('GET', '**/api/reseller/dashboard/recent-activity', {
    data: [
      { id: 1, action: 'license.activate', description: 'Activated BIOS-12345', metadata: {}, created_at: '2026-02-12T00:00:00Z' },
    ],
  }).as('dashboardActivity')
}

function mockCustomers() {
  cy.intercept('GET', '**/api/programs*', {
    data: programs,
    meta: { current_page: 1, last_page: 1, per_page: 100, total: programs.length },
  }).as('programs')
  cy.intercept('GET', '**/api/reseller/customers*', {
    data: [
      {
        id: 401,
        name: 'Customer One',
        email: 'customer1@example.com',
        phone: '555-0101',
        license_id: 1,
        bios_id: 'BIOS-12345',
        program: 'OBD2 Master',
        status: 'active',
        price: 120,
        expiry: '2026-03-12T00:00:00Z',
        license_count: 1,
      },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 10, total: 1 },
  }).as('customers')
}

function mockLicenses() {
  const licenses = [
    {
      id: 1,
      customer_id: 401,
      customer_name: 'Customer One',
      customer_email: 'customer1@example.com',
      bios_id: 'BIOS-12345',
      external_username: 'customer.one',
      program: 'OBD2 Master',
      program_id: 1,
      duration_days: 30,
      price: 120,
      activated_at: '2026-02-10T00:00:00Z',
      expires_at: '2026-03-12T00:00:00Z',
      status: 'active',
    },
  ]

  cy.intercept('GET', /\/api\/reseller\/licenses\/expiring(\?.*)?$/, { data: licenses }).as('expiringLicenses')
  cy.intercept('GET', /\/api\/reseller\/licenses(\?.*)?$/, {
    data: licenses,
    meta: { current_page: 1, last_page: 1, per_page: 10, total: licenses.length },
  }).as('licenses')
}

describe('Phase 4 Reseller', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  it('logs in and sees reseller dashboard at /reseller/dashboard', () => {
    mockResellerDashboard()
    cy.intercept('POST', '**/api/auth/login', { token: 'test-token', user: resellerUser }).as('login')
    cy.visit('/en/login')
    cy.get('#email').clear().type('reseller@obd2sw.com')
    cy.get('#password').clear().type('password')
    cy.get('button[type="submit"]').click()
    cy.wait('@login')
    cy.url().should('include', '/en/reseller/dashboard')
    cy.contains(/customers/i).should('exist')
    cy.contains(/revenue/i).should('exist')
  })

  it('cannot access /super-admin routes and is redirected to /reseller/dashboard', () => {
    mockResellerDashboard()
    setSession('/en/super-admin/dashboard')
    cy.url().should('include', '/en/reseller/dashboard')
  })

  it('cannot access /manager routes and is redirected to /reseller/dashboard', () => {
    mockResellerDashboard()
    setSession('/en/manager/dashboard')
    cy.url().should('include', '/en/reseller/dashboard')
  })

  it('opens add customer dialog and loads customer table', () => {
    mockCustomers()
    setSession('/en/reseller/customers')
    cy.wait('@customers')
    cy.contains('Customer One').should('exist')
    cy.contains('button', /add customer/i).click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.contains(/customer info/i).should('exist')
  })

  it('loads licenses page with actions', () => {
    mockLicenses()
    setSession('/en/reseller/licenses')
    cy.wait(['@licenses', '@expiringLicenses'])
    cy.contains('Customer One').should('exist')
    cy.contains('button', /view/i).should('exist')
    cy.contains('button', /renew/i).should('exist')
    cy.contains('button', /deactivate/i).should('exist')
  })

  it('shows software catalog without edit/delete controls', () => {
    cy.intercept('GET', '**/api/programs*', {
      data: programs,
      meta: { current_page: 1, last_page: 1, per_page: 100, total: programs.length },
    }).as('softwarePrograms')
    setSession('/en/reseller/software')
    cy.wait('@softwarePrograms')
    cy.contains('OBD2 Master').should('exist')
    cy.contains('button', 'Edit').should('not.exist')
    cy.contains('button', 'Delete').should('not.exist')
  })

  it('renders reseller reports with export controls', () => {
    cy.intercept('GET', '**/api/reseller/reports/revenue*', { data: [{ period: '2026-02', revenue: 930, count: 930 }] }).as('revenueReport')
    cy.intercept('GET', '**/api/reseller/reports/activations*', { data: [{ period: '2026-02', revenue: 5, count: 5 }] }).as('activationsReport')
    cy.intercept('GET', '**/api/reseller/reports/top-programs*', { data: [{ program: 'OBD2 Master', count: 8, revenue: 960 }] }).as('topPrograms')
    cy.intercept('GET', '**/api/reseller/dashboard/stats', { stats: dashboardStats }).as('reportStats')
    setSession('/en/reseller/reports')
    cy.wait(['@revenueReport', '@activationsReport', '@topPrograms', '@reportStats'])
    cy.contains(/total revenue/i).should('exist')
    cy.contains(/top programs/i).should('exist')
    cy.contains('button', /^csv$/i).should('exist')
  })
})
