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

const managerDashboardStats = {
  team_resellers: 4,
  team_customers: 28,
  active_licenses: 21,
  team_revenue: 4200,
  monthly_activations: 7,
}

function setSession(path: string) {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem(AUTH_KEY, JSON.stringify({ token: 'test-token', user: managerUser }))
    },
  })
}

function mockManagerDashboard() {
  cy.intercept('GET', '**/api/manager/dashboard/stats', { stats: managerDashboardStats }).as('managerStats')
  cy.intercept('GET', '**/api/manager/dashboard/activations-chart', { data: [{ month: 'Feb 2026', count: 7, revenue: 7 }] }).as('managerActivations')
  cy.intercept('GET', '**/api/manager/dashboard/revenue-chart', { data: [{ month: 'Feb 2026', count: 4200, revenue: 4200 }] }).as('managerRevenue')
  cy.intercept('GET', '**/api/manager/dashboard/recent-activity', {
    data: [{ id: 1, action: 'username.unlock', description: 'Unlocked username for reseller@obd2sw.com.', metadata: {}, user: { id: 20, name: 'Manager User' }, created_at: '2026-02-10T00:00:00Z' }],
  }).as('managerActivity')
}

describe('Phase 4 Manager', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  it('logs in and sees a separate manager dashboard at /manager/dashboard', () => {
    mockManagerDashboard()
    cy.intercept('POST', '**/api/auth/login', { token: 'test-token', user: managerUser }).as('login')
    cy.visit('/en/login')
    cy.get('#email').clear().type('manager@obd2sw.com')
    cy.get('#password').clear().type('password')
    cy.get('button[type="submit"]').click()
    cy.wait('@login')
    cy.url().should('include', '/en/manager/dashboard')
    cy.contains('Team Resellers').should('exist')
  })

  it('cannot access reseller routes and is redirected to /manager/dashboard', () => {
    mockManagerDashboard()
    setSession('/en/reseller/dashboard')
    cy.url().should('include', '/en/manager/dashboard')
  })

  it('shows team resellers on the team page without edit controls', () => {
    cy.intercept('GET', '**/api/manager/team*', {
      data: [
        { id: 31, name: 'Reseller One', email: 'one@example.com', phone: '555-0101', status: 'active', customers_count: 11, active_licenses_count: 8, revenue: 1200, created_at: '2026-02-01T00:00:00Z' },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 10, total: 1 },
    }).as('team')
    cy.intercept('GET', '**/api/manager/team/31', {
      data: {
        id: 31,
        name: 'Reseller One',
        email: 'one@example.com',
        phone: '555-0101',
        status: 'active',
        customers_count: 11,
        active_licenses_count: 8,
        revenue: 1200,
        created_at: '2026-02-01T00:00:00Z',
        recent_licenses: [
          { id: 1, customer: { id: 1, name: 'Customer One', email: 'customer1@example.com' }, program: 'OBD2 Master', bios_id: 'BIOS-12345', status: 'active', price: 120, expires_at: '2026-03-10T00:00:00Z' },
        ],
      },
    }).as('teamDetail')
    setSession('/en/manager/team')
    cy.wait('@team')
    cy.contains('Reseller One').click()
    cy.wait('@teamDetail')
    cy.contains('Recent Licenses').should('exist')
    cy.contains('button', 'Edit').should('not.exist')
    cy.contains('button', 'Delete').should('not.exist')
  })

  it('renders username management for team users', () => {
    cy.intercept('GET', '**/api/manager/username-management*', {
      data: [
        { id: 31, name: 'Reseller One', username: 'reseller.one', email: 'one@example.com', role: 'reseller', status: 'active', username_locked: true, created_at: '2026-02-01T00:00:00Z' },
        { id: 41, name: 'Customer One', username: 'cust.one', email: 'customer1@example.com', role: 'customer', status: 'active', username_locked: false, created_at: '2026-02-02T00:00:00Z' },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 10, total: 2 },
    }).as('usernameManagement')
    setSession('/en/manager/username-management')
    cy.wait('@usernameManagement')
    cy.contains('Reseller One').should('exist')
    cy.contains('Customer One').should('exist')
  })

  it('opens unlock workflow with required reason field', () => {
    let locked = true

    cy.intercept('GET', '**/api/manager/username-management*', {
      data: [
        { id: 31, name: 'Reseller One', username: 'reseller.one', email: 'one@example.com', role: 'reseller', status: 'active', username_locked: locked, created_at: '2026-02-01T00:00:00Z' },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 10, total: 1 },
    }).as('usernameListing')

    setSession('/en/manager/username-management')
    cy.wait('@usernameListing')
    cy.contains('tr', 'Reseller One').within(() => {
      cy.get('button').first().click()
    })
    cy.get('[role="dialog"]').should('be.visible')
    cy.get('#unlock-reason').should('be.visible').then(($textarea) => {
      const element = $textarea.get(0) as HTMLTextAreaElement
      element.value = 'Verified reseller identity.'
      element.dispatchEvent(new Event('input', { bubbles: true }))
    })
    cy.get('[role="dialog"]').within(() => {
      cy.get('div.mt-6 button').eq(1).should('be.visible')
    })
  })

  it('shows aggregated customers on the customer overview page', () => {
    cy.intercept('GET', '**/api/manager/team*', {
      data: [{ id: 31, name: 'Reseller One', email: 'one@example.com', phone: '555-0101', status: 'active', customers_count: 11, active_licenses_count: 8, revenue: 1200, created_at: '2026-02-01T00:00:00Z' }],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 },
    }).as('customerTeam')
    cy.intercept('GET', '**/api/programs*', {
      data: [{ id: 1, name: 'OBD2 Master', description: 'Diagnostic suite', version: '5.2', download_link: 'https://example.com', trial_days: 7, base_price: 99, icon: null, status: 'active', licenses_sold: 30, active_licenses_count: 20, revenue: 2970, created_at: '2026-02-01T00:00:00Z' }],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 },
    }).as('programs')
    cy.intercept('GET', '**/api/manager/customers*', {
      data: [
        { id: 41, name: 'Customer One', email: 'customer1@example.com', bios_id: 'BIOS-12345', reseller: 'Reseller One', reseller_id: 31, program: 'OBD2 Master', status: 'active', expiry: '2026-03-12T00:00:00Z', license_count: 1 },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 10, total: 1 },
    }).as('customers')
    setSession('/en/manager/customers')
    cy.wait(['@customerTeam', '@programs', '@customers'])
    cy.contains('Customer One').should('exist')
    cy.contains('button', /renew/i).should('exist')
    cy.contains('button', /deactivate/i).should('exist')
  })
})
