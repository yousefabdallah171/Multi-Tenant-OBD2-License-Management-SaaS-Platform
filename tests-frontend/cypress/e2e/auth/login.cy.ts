describe('Auth Login Role Redirects', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  function mockLogin(role: 'super_admin' | 'manager_parent' | 'manager' | 'reseller') {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 200,
      body: {
        token: `token-${role}`,
        user: {
          id: 1,
          name: role,
          email: `${role}@obd2sw.com`,
          role,
          status: 'active',
          tenant_id: role === 'super_admin' ? null : 1,
          username: role,
          phone: null,
          created_by: null,
          username_locked: false,
          tenant: role === 'super_admin' ? null : { id: 1, name: 'Tenant', slug: 'tenant', status: 'active' },
        },
      },
    }).as('login')
  }

  function submitLogin(email: string) {
    cy.visit('/en/login', {
      onBeforeLoad(win) {
        win.localStorage.removeItem('license-auth')
      },
    })
    cy.get('#email').type(email)
    cy.get('#password').type('password')
    cy.contains('button', /sign in/i).click()
    cy.wait('@login')
  }

  it('super admin login redirects to /en/super-admin/dashboard', () => {
    mockLogin('super_admin')
    submitLogin('super_admin@obd2sw.com')
    cy.location('pathname').should('eq', '/en/super-admin/dashboard')
  })

  it('manager parent login redirects to /en/dashboard', () => {
    mockLogin('manager_parent')
    submitLogin('manager_parent@obd2sw.com')
    cy.location('pathname').should('eq', '/en/dashboard')
  })

  it('manager login redirects to /en/manager/dashboard', () => {
    mockLogin('manager')
    submitLogin('manager@obd2sw.com')
    cy.location('pathname').should('eq', '/en/manager/dashboard')
  })

  it('reseller login redirects to /en/reseller/dashboard', () => {
    mockLogin('reseller')
    submitLogin('reseller@obd2sw.com')
    cy.location('pathname').should('eq', '/en/reseller/dashboard')
  })
})
