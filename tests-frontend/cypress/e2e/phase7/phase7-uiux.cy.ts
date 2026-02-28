/// <reference types="cypress" />

export {}

const AUTH_KEY = 'license-auth'
const THEME_KEY = 'license-theme'

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
    data: [
      { month: 'Jan 2026', count: 1, revenue: 1 },
      { month: 'Feb 2026', count: 3, revenue: 3 },
    ],
  }).as('managerActivations')
  cy.intercept('GET', '**/api/manager/dashboard/revenue-chart', {
    data: [{ month: 'Feb 2026', count: 109.97, revenue: 109.97 }],
  }).as('managerRevenue')
  cy.intercept('GET', '**/api/manager/dashboard/recent-activity', {
    data: [
      {
        id: 1,
        action: 'username.unlock',
        description: 'Unlocked username for reseller@obd2sw.com.',
        metadata: {},
        user: { id: 20, name: 'Manager User' },
        created_at: '2026-02-10T00:00:00Z',
      },
    ],
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
  cy.intercept('GET', '**/api/reseller/licenses/1', {
    data: {
      id: 1,
      customer_id: 401,
      customer_name: 'Customer One',
      customer_email: 'customer1@example.com',
      bios_id: 'BIOS-12345',
      program: 'OBD2 Master',
      program_id: 1,
      program_version: '5.2',
      duration_days: 30,
      price: 120,
      activated_at: '2026-02-10T00:00:00Z',
      expires_at: '2026-03-12T00:00:00Z',
      status: 'active',
      customer: { id: 401, name: 'Customer One', email: 'customer1@example.com', phone: '555-0101' },
      download_link: 'https://example.com/obd2-master',
      activity: [{ id: 1, action: 'license.activate', description: 'Activated BIOS-12345', created_at: '2026-02-10T00:00:00Z' }],
    },
  }).as('resellerCustomerLicense')
}

function mockResellerLicenses() {
  const licenses = [
    {
      id: 1,
      customer_id: 401,
      customer_name: 'Customer One',
      customer_email: 'customer1@example.com',
      bios_id: 'BIOS-12345',
      program: 'OBD2 Master',
      program_id: 1,
      duration_days: 30,
      price: 120,
      activated_at: '2026-02-10T00:00:00Z',
      expires_at: '2026-03-12T00:00:00Z',
      status: 'active',
    },
    {
      id: 2,
      customer_id: 402,
      customer_name: 'Customer Two',
      customer_email: 'customer2@example.com',
      bios_id: 'BIOS-22222',
      program: 'Flash Pro',
      program_id: 2,
      duration_days: 14,
      price: 140,
      activated_at: '2026-02-05T00:00:00Z',
      expires_at: '2026-02-18T00:00:00Z',
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
  cy.intercept('GET', '**/api/reseller/licenses/*', {
    data: {
      ...licenses[0],
      customer: { id: 401, name: 'Customer One', email: 'customer1@example.com', phone: '555-0101' },
      program_version: '5.2',
      download_link: 'https://example.com/download',
      activity: [{ id: 1, action: 'license.activate', description: 'Activated BIOS-12345', created_at: '2026-02-10T00:00:00Z' }],
    },
  }).as('resellerLicenseDetail')
}

describe('Phase 7 UI/UX', () => {
  it('keeps the Arabic manager desktop sidebar on the right and removes English dashboard leaks', () => {
    cy.viewport(1440, 900)
    mockManagerDashboard()
    setSession('/ar/manager/dashboard', managerUser)
    cy.wait(['@managerStats', '@managerActivations', '@managerRevenue', '@managerActivity'])

    cy.get('[data-testid="desktop-sidebar-shell"]')
      .should('be.visible')
      .and('not.have.class', 'lg:order-last')
      .and('not.have.class', 'lg:order-first')

    cy.get('[data-testid="desktop-sidebar"]').then(($sidebar) => {
      cy.get('#dashboard-main-content').then(($main) => {
        const sidebarRect = $sidebar[0].getBoundingClientRect()
        const mainRect = $main[0].getBoundingClientRect()

        expect(sidebarRect.left, 'rtl sidebar should be positioned to the right of the main content').to.be.greaterThan(mainRect.right - 8)
      })
    })

    cy.contains('لوحة التحكم').should('exist')
    cy.contains('الفريق').should('exist')
    cy.contains('إيراد الفريق').should('exist')
    cy.contains(/^Dashboard$/).should('not.exist')
    cy.contains('Manager Actions').should('not.exist')
  })

  it('opens and closes the RTL mobile sidebar from the right edge', () => {
    cy.viewport(375, 812)
    mockManagerDashboard()
    setSession('/ar/manager/dashboard', managerUser)
    cy.wait('@managerStats')

    cy.get('button[aria-label="فتح قائمة التنقل"]').click()
    cy.get('[data-testid="mobile-sidebar"]').should('be.visible').then(($sidebar) => {
      cy.window().then((win) => {
        const rect = $sidebar[0].getBoundingClientRect()
        expect(Math.abs(rect.right - win.innerWidth)).to.be.lessThan(3)
      })
    })

    cy.get('button[aria-label="إغلاق قائمة التنقل"]').click({ force: true })
    cy.get('[data-testid="mobile-sidebar"]').should('not.be.visible')
  })

  it('renders a mobile full-screen activation dialog and a horizontally scrollable licenses table', () => {
    cy.viewport(375, 812)
    mockResellerCustomers()
    setSession('/en/reseller/customers', resellerUser)
    cy.wait('@resellerCustomers')

    cy.contains('button', 'Add Customer').click()
    cy.get('[role="dialog"]').should('be.visible').then(($dialog) => {
      cy.window().then((win) => {
        const rect = $dialog[0].getBoundingClientRect()
        expect(rect.width).to.be.greaterThan(win.innerWidth * 0.9)
        expect(rect.height).to.be.greaterThan(win.innerHeight * 0.85)
      })
    })

    mockResellerLicenses()
    setSession('/en/reseller/licenses', resellerUser)
    cy.wait(['@resellerLicenses', '@expiringLicenses'])
    cy.get('table').parent().then(($container) => {
      expect($container[0].scrollWidth).to.be.greaterThan($container[0].clientWidth)
    })
  })

  it('persists dark mode after reload and renders the dedicated error routes', () => {
    cy.viewport(1280, 800)
    mockManagerDashboard()
    setSession('/en/manager/dashboard', managerUser)
    cy.wait('@managerStats')

    cy.contains('button', 'Dark mode').click()
    cy.get('html').should('have.class', 'dark')
    cy.window().its('localStorage').invoke('getItem', THEME_KEY).should('eq', 'dark')

    cy.reload()
    cy.wait('@managerStats')
    cy.get('html').should('have.class', 'dark')
    cy.contains('button', 'Light mode').should('exist')

    cy.visit('/en/not-found')
    cy.contains('Page not found').should('exist')

    cy.visit('/en/access-denied')
    cy.contains('Access denied').should('exist')

    cy.visit('/en/server-error')
    cy.contains('Server error').should('exist')

    cy.visit('/en/unknown-phase7-route')
    cy.contains('Page not found').should('exist')
  })
})
