/// <reference types="cypress" />

export {}

const AUTH_KEY = 'license-auth'

const managerUser = {
  id: 20,
  tenant_id: 1,
  name: 'Manager User',
  username: 'manager.team',
  email: 'manager@obd2sw.com',
  phone: '123456789',
  role: 'manager',
  status: 'active',
  created_by: 10,
  username_locked: false,
}

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

const programs = [
  {
    id: 1,
    name: 'OBD2 Master',
    description: 'Primary diagnostic suite.',
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

function setSession(path: string, user: typeof managerUser | typeof resellerUser) {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem(AUTH_KEY, JSON.stringify({ token: 'test-token', user }))
    },
  })
}

function mockManagerDashboard() {
  cy.intercept('GET', '**/api/manager/dashboard/stats', {
    stats: {
      team_resellers: 1,
      team_customers: 1,
      active_licenses: 2,
      team_revenue: 109.97,
      monthly_activations: 3,
    },
  }).as('managerStats')
  cy.intercept('GET', '**/api/manager/dashboard/activations-chart', {
    data: [{ month: 'Feb 2026', count: 3, revenue: 3 }],
  }).as('managerActivations')
  cy.intercept('GET', '**/api/manager/dashboard/revenue-chart', {
    data: [{ month: 'Feb 2026', count: 109.97, revenue: 109.97 }],
  }).as('managerRevenue')
  cy.intercept('GET', '**/api/manager/dashboard/recent-activity', {
    data: [{ id: 1, action: 'username.unlock', description: 'Unlocked username.', metadata: {}, user: { id: 20, name: 'Manager User' }, created_at: '2026-02-10T00:00:00Z' }],
  }).as('managerActivity')
}

function mockResellerCustomers() {
  cy.intercept('GET', '**/api/programs*', {
    data: programs,
    meta: { current_page: 1, last_page: 1, per_page: 100, total: programs.length },
  }).as('resellerPrograms')
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
  }).as('resellerCustomers')
}

function mockResellerLicenses() {
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

  cy.intercept('GET', /\/api\/reseller\/licenses\/expiring(\?.*)?$/, {
    data: licenses,
  }).as('expiringLicenses')

  cy.intercept('GET', /\/api\/reseller\/licenses(\?.*)?$/, {
    data: licenses,
    meta: { current_page: 1, last_page: 1, per_page: 10, total: licenses.length },
  }).as('resellerLicenses')
}

describe('Phase 7 UI/UX', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  it('keeps Arabic manager desktop shell and no English dashboard leak', () => {
    cy.viewport(1440, 900)
    mockManagerDashboard()
    setSession('/ar/manager/dashboard', managerUser)
    cy.wait(['@managerStats', '@managerActivations', '@managerRevenue', '@managerActivity'])

    cy.get('[data-testid="desktop-sidebar-shell"]').should('be.visible')
    cy.get('[data-testid="desktop-sidebar"]').should('be.visible')
    cy.contains(/^Dashboard$/).should('not.exist')
  })

  it('opens and closes RTL mobile sidebar', () => {
    cy.viewport(375, 812)
    mockManagerDashboard()
    setSession('/ar/manager/dashboard', managerUser)
    cy.wait('@managerStats')

    cy.get('header button').eq(0).click({ force: true })
    cy.get('[data-testid="mobile-sidebar"]').should('have.class', 'translate-x-0').and('have.class', 'right-0')
    cy.get('header button').eq(0).click({ force: true })
    cy.get('[data-testid="mobile-sidebar"]').should('have.class', 'translate-x-full')
  })

  it('shows activation dialog and licenses table on mobile', () => {
    cy.viewport(375, 812)
    mockResellerCustomers()
    setSession('/en/reseller/customers', resellerUser)
    cy.wait('@resellerCustomers')

    cy.contains('button', /add customer/i).click()
    cy.get('[role="dialog"]').should('be.visible')

    mockResellerLicenses()
    setSession('/en/reseller/licenses', resellerUser)
    cy.wait(['@resellerLicenses', '@expiringLicenses'])
    cy.get('table').should('exist')
    cy.contains(/customer one/i).should('exist')
  })

  it('persists dark mode after reload', () => {
    cy.viewport(1280, 800)
    mockManagerDashboard()
    setSession('/en/manager/dashboard', managerUser)
    cy.wait('@managerStats')

    cy.get('html').then(($html) => {
      if (!$html.hasClass('dark')) {
        cy.get('header button[aria-label*="theme"]').click()
      }
    })
    cy.get('html').should('have.class', 'dark')

    cy.reload()
    cy.wait('@managerStats')
    cy.get('html').should('have.class', 'dark')
  })
})
