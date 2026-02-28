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
  {
    id: 2,
    name: 'Flash Pro',
    description: 'ECU flashing toolkit.',
    version: '3.8',
    download_link: 'https://example.com/flash-pro',
    trial_days: 14,
    base_price: 149,
    icon: null,
    status: 'active',
    licenses_sold: 18,
    active_licenses_count: 11,
    revenue: 2682,
    created_at: '2026-02-02T00:00:00Z',
  },
]

function buildLicense(overrides: Partial<Record<string, unknown>> = {}) {
  return {
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
    ...overrides,
  }
}

function buildCustomer(overrides: Partial<Record<string, unknown>> = {}) {
  const licenseId = typeof overrides.license_id === 'number' ? overrides.license_id : 1

  return {
    id: 401,
    name: 'Customer One',
    email: 'customer1@example.com',
    phone: '555-0101',
    license_id: licenseId,
    bios_id: 'BIOS-12345',
    program: 'OBD2 Master',
    status: 'active',
    price: 120,
    expiry: '2026-03-12T00:00:00Z',
    license_count: 1,
    ...overrides,
  }
}

function setSession(path: string, user = resellerUser) {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem(AUTH_KEY, JSON.stringify({ token: 'test-token', user }))
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
      { id: 2, action: 'license.renew', description: 'Renewed BIOS-99999', metadata: {}, created_at: '2026-02-13T00:00:00Z' },
    ],
  }).as('dashboardActivity')
}

function visitResellerDashboard() {
  mockResellerDashboard()
  setSession('/en/reseller/dashboard')
  cy.wait('@dashboardStats')
}

function visitResellerCustomers(setup?: (state: { customers: ReturnType<typeof buildCustomer>[] }) => void) {
  const state = {
    customers: [buildCustomer()],
  }

  setup?.(state)

  cy.intercept('GET', '**/api/programs*', { data: programs, meta: { current_page: 1, last_page: 1, per_page: 100, total: programs.length } }).as('programs')
  cy.intercept('GET', '**/api/reseller/customers*', {
    data: state.customers,
    meta: { current_page: 1, last_page: 1, per_page: 10, total: state.customers.length },
  }).as('customers')
  cy.intercept('GET', '**/api/reseller/customers/401', {
    data: {
      ...state.customers[0],
      licenses: [
        {
          id: 1,
          bios_id: 'BIOS-12345',
          program: 'OBD2 Master',
          status: 'active',
          price: 120,
          activated_at: '2026-02-10T00:00:00Z',
          expires_at: '2026-03-12T00:00:00Z',
        },
      ],
    },
  }).as('customerDetail')
  cy.intercept('GET', '**/api/reseller/licenses/1', {
    data: {
      ...buildLicense(),
      customer: { id: 401, name: 'Customer One', email: 'customer1@example.com', phone: '555-0101' },
      program_version: '5.2',
      download_link: 'https://example.com/obd2-master',
      activity: [{ id: 1, action: 'license.activate', description: 'Activated BIOS-12345', created_at: '2026-02-10T00:00:00Z' }],
    },
  }).as('customerLicenseDetail')
  setSession('/en/reseller/customers')
  cy.wait('@customers')
}

function visitResellerLicenses(setup?: (state: { licenses: ReturnType<typeof buildLicense>[] }) => void) {
  const state = {
    licenses: [
      buildLicense(),
      buildLicense({
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
        expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
      }),
      buildLicense({
        id: 3,
        customer_id: 403,
        customer_name: 'Customer Three',
        customer_email: 'customer3@example.com',
        bios_id: 'BIOS-33333',
        program: 'OBD2 Master',
        expires_at: '2026-01-10T00:00:00Z',
        status: 'expired',
      }),
    ],
  }

  setup?.(state)

  cy.intercept('GET', /\/api\/reseller\/licenses\/expiring(\?.*)?$/, {
    data: state.licenses.filter((license) => license.status === 'active'),
  }).as('expiringLicenses')

  cy.intercept('GET', /\/api\/reseller\/licenses(\?.*)?$/, (req) => {
    const status = typeof req.query.status === 'string' ? req.query.status : ''
    const filtered = status ? state.licenses.filter((license) => license.status === status) : state.licenses
    req.reply({
      data: filtered,
      meta: { current_page: 1, last_page: 1, per_page: 10, total: filtered.length },
    })
  }).as('licenses')

  cy.intercept('GET', '**/api/reseller/licenses/*', (req) => {
    const id = Number(req.url.split('/').pop())
    const license = state.licenses.find((entry) => entry.id === id) ?? state.licenses[0]
    req.reply({
      data: {
        ...license,
        customer: { id: license.customer_id, name: license.customer_name, email: license.customer_email, phone: '555-0101' },
        program_version: license.program_id === 1 ? '5.2' : '3.8',
        download_link: 'https://example.com/download',
        activity: [{ id: 1, action: 'license.activate', description: `Activated ${license.bios_id}`, created_at: license.activated_at }],
      },
    })
  }).as('licenseDetail')

  setSession('/en/reseller/licenses')
  cy.wait('@licenses')
}

function openActivationDialog() {
  cy.contains('button', 'Add Customer').click()
  cy.contains('Add Customer').should('be.visible')
}

function fillStep1() {
  cy.get('#customer-name').type('New Customer')
  cy.get('#customer-email').type('new.customer@example.com')
  cy.get('#customer-phone').type('555-2026')
  cy.contains('button', 'Next').click()
}

function fillStep2() {
  cy.get('#bios-id').type('BIOS-NEW-9999')
  cy.get('#program-id').select('1')
  cy.contains('button', 'Next').click()
}

function fillStep3() {
  cy.get('#duration-value').clear().type('3')
  cy.get('#duration-unit').select('months')
  cy.get('#price').clear().type('180')
  cy.contains('button', 'Next').click()
}

describe('Phase 4 Reseller', () => {
  it('logs in and sees reseller dashboard at /reseller/dashboard', () => {
    mockResellerDashboard()
    cy.intercept('POST', '**/api/auth/login', { token: 'test-token', user: resellerUser }).as('login')
    cy.visit('/en/login')
    cy.get('#email').clear().type('reseller@obd2sw.com')
    cy.get('#password').clear().type('password')
    cy.get('button[type="submit"]').click()
    cy.wait('@login')
    cy.url().should('include', '/en/reseller/dashboard')
    cy.contains('Customers').should('exist')
    cy.contains('Revenue').should('exist')
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

  it('opens the add customer dialog', () => {
    visitResellerCustomers()
    openActivationDialog()
    cy.contains('Customer Info').should('be.visible')
  })

  it('fills step 1 and navigates to step 2', () => {
    visitResellerCustomers()
    openActivationDialog()
    fillStep1()
    cy.contains('BIOS Activation').should('be.visible')
  })

  it('fills step 2 and navigates to step 3', () => {
    visitResellerCustomers()
    openActivationDialog()
    fillStep1()
    fillStep2()
    cy.contains('Pricing & Duration').should('be.visible')
    cy.contains('OBD2 Master').should('be.visible')
  })

  it('fills step 3 and navigates to step 4', () => {
    visitResellerCustomers()
    openActivationDialog()
    fillStep1()
    fillStep2()
    fillStep3()
    cy.contains('Review & Confirm').should('be.visible')
    cy.contains('3 months').should('be.visible')
  })

  it('reviews the summary and submits the activate request', () => {
    visitResellerCustomers((state) => {
      cy.intercept('POST', '**/api/licenses/activate', (req) => {
        state.customers = [
          buildCustomer({
            id: 501,
            name: 'New Customer',
            email: 'new.customer@example.com',
            phone: '555-2026',
            bios_id: 'BIOS-NEW-9999',
            price: 180,
            expiry: '2026-05-31T00:00:00Z',
          }),
          ...state.customers,
        ]
        req.reply({
          statusCode: 201,
          body: { message: 'License activated successfully.', data: buildLicense({ id: 10, customer_id: 501, customer_name: 'New Customer', customer_email: 'new.customer@example.com', bios_id: 'BIOS-NEW-9999', price: 180 }) },
        })
      }).as('activate')
    })

    openActivationDialog()
    fillStep1()
    fillStep2()
    fillStep3()
    cy.contains('button', 'Activate').click()
    cy.wait('@activate').its('request.body').should((body) => {
      expect(body.customer_name).to.equal('New Customer')
      expect(body.program_id).to.equal(1)
      expect(body.duration_days).to.equal(90)
      expect(body.price).to.equal(180)
    })
  })

  it('shows success feedback, closes the dialog, and updates the table after activation', () => {
    visitResellerCustomers((state) => {
      cy.intercept('POST', '**/api/licenses/activate', (req) => {
        state.customers = [
          buildCustomer({
            id: 501,
            name: 'New Customer',
            email: 'new.customer@example.com',
            phone: '555-2026',
            bios_id: 'BIOS-NEW-9999',
            price: 180,
            expiry: '2026-05-31T00:00:00Z',
          }),
          ...state.customers,
        ]
        req.reply({
          statusCode: 201,
          body: { message: 'License activated successfully.', data: buildLicense({ id: 10, customer_id: 501, customer_name: 'New Customer', customer_email: 'new.customer@example.com', bios_id: 'BIOS-NEW-9999', price: 180 }) },
        })
      }).as('activateSuccess')
    })

    openActivationDialog()
    fillStep1()
    fillStep2()
    fillStep3()
    cy.contains('button', 'Activate').click()
    cy.wait('@activateSuccess')
    cy.contains('Add Customer').should('not.exist')
    cy.contains('New Customer').should('exist')
  })

  it('shows an activation failure message and allows retry', () => {
    visitResellerCustomers()
    cy.intercept('POST', '**/api/licenses/activate', {
      statusCode: 500,
      body: { message: 'Activation failed.' },
    }).as('activateFailure')

    openActivationDialog()
    fillStep1()
    fillStep2()
    fillStep3()
    cy.contains('button', 'Activate').click()
    cy.wait('@activateFailure')
    cy.contains('Activation failed.').should('exist')
    cy.contains('button', 'Activate').should('exist')
  })

  it('loads the licenses page with data', () => {
    visitResellerLicenses()
    cy.contains('Customer One').should('exist')
    cy.contains('BIOS-12345').should('exist')
  })

  it('filters licenses by active status', () => {
    visitResellerLicenses()
    cy.contains('button', 'Active').click()
    cy.wait('@licenses')
    cy.contains('Customer One').should('exist')
    cy.contains('Customer Three').should('not.exist')
  })

  it('renews a license and updates the license data', () => {
    visitResellerLicenses((state) => {
      cy.intercept('POST', '**/api/licenses/1/renew', (req) => {
        state.licenses[0] = {
          ...state.licenses[0],
          duration_days: 60,
          price: 155,
          expires_at: '2026-05-12T00:00:00Z',
        }
        req.reply({ message: 'License renewed successfully.', data: state.licenses[0] })
      }).as('renewLicense')
    })

    cy.contains('button', 'Renew').first().click()
    cy.get('#renew-duration').clear().type('2')
    cy.get('#renew-unit').select('months')
    cy.get('#renew-price').clear().type('155')
    cy.contains('button', 'Renew').last().click()
    cy.wait('@renewLicense').its('request.body').should('deep.include', { duration_days: 60, price: 155 })
    cy.contains('$155.00').should('exist')
  })

  it('deactivates a license and changes the status', () => {
    visitResellerLicenses((state) => {
      cy.intercept('POST', '**/api/licenses/1/deactivate', (req) => {
        state.licenses[0] = {
          ...state.licenses[0],
          status: 'suspended',
        }
        req.reply({ message: 'License deactivated successfully.', data: state.licenses[0] })
      }).as('deactivateLicense')
    })

    cy.contains('button', 'Deactivate').first().click()
    cy.contains('button', 'Deactivate').last().click()
    cy.wait('@deactivateLicense')
    cy.contains('suspended').should('exist')
  })

  it('shows expiry warnings for licenses expiring soon', () => {
    visitResellerLicenses()
    cy.contains('Expire in 1 day').should('exist')
    cy.contains('Expire in 3 days').should('exist')
    cy.contains('Expire in 7 days').should('exist')
  })

  it('shows programs on the software page without edit buttons', () => {
    cy.intercept('GET', '**/api/programs*', { data: programs, meta: { current_page: 1, last_page: 1, per_page: 100, total: programs.length } }).as('softwarePrograms')
    setSession('/en/reseller/software')
    cy.wait('@softwarePrograms')
    cy.contains('OBD2 Master').should('exist')
    cy.contains('button', 'Edit').should('not.exist')
    cy.contains('button', 'Delete').should('not.exist')
  })

  it('renders reseller reports with charts and summary data', () => {
    cy.intercept('GET', '**/api/reseller/reports/revenue*', { data: [{ period: '2026-02', revenue: 930, count: 930 }] }).as('revenueReport')
    cy.intercept('GET', '**/api/reseller/reports/activations*', { data: [{ period: '2026-02', revenue: 5, count: 5 }] }).as('activationsReport')
    cy.intercept('GET', '**/api/reseller/reports/top-programs*', { data: [{ program: 'OBD2 Master', count: 8, revenue: 960 }] }).as('topPrograms')
    cy.intercept('GET', '**/api/reseller/dashboard/stats', { stats: dashboardStats }).as('reportStats')
    setSession('/en/reseller/reports')
    cy.wait(['@revenueReport', '@activationsReport', '@topPrograms', '@reportStats'])
    cy.contains('Total Revenue').should('exist')
    cy.contains('Top Programs by Sales').should('exist')
    cy.contains('OBD2 Master').should('exist')
  })

  it('requests a CSV export from the reports page', () => {
    cy.intercept('GET', '**/api/reseller/reports/revenue*', { data: [] })
    cy.intercept('GET', '**/api/reseller/reports/activations*', { data: [] })
    cy.intercept('GET', '**/api/reseller/reports/top-programs*', { data: [] })
    cy.intercept('GET', '**/api/reseller/dashboard/stats', { stats: dashboardStats })
    cy.intercept('GET', '**/api/reseller/reports/export/csv*', {
      headers: { 'content-type': 'text/csv' },
      body: 'Program,Activations,Revenue\nOBD2 Master,8,960\n',
    }).as('exportCsv')
    setSession('/en/reseller/reports')
    cy.contains('button', 'Export CSV').click()
    cy.wait('@exportCsv')
  })

  it('shows the correct dashboard stats cards', () => {
    visitResellerDashboard()
    cy.contains('Customers').should('exist')
    cy.contains('12').should('exist')
    cy.contains('Monthly Activations').should('exist')
    cy.contains('5').should('exist')
  })
})
