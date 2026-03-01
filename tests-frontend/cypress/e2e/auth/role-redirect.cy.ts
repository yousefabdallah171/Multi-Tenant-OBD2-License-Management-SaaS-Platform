describe('Role Boundaries', () => {
  it('reseller visiting super-admin route redirects to reseller dashboard', () => {
    cy.visit('/en/super-admin/dashboard', {
      onBeforeLoad(win) {
        win.localStorage.setItem('license-auth', JSON.stringify({
          token: 'token-reseller',
          user: {
            id: 1,
            tenant_id: 1,
            name: 'Reseller',
            username: 'reseller',
            email: 'reseller@obd2sw.com',
            phone: null,
            role: 'reseller',
            status: 'active',
            created_by: null,
            username_locked: false,
            tenant: { id: 1, name: 'Tenant', slug: 'tenant', status: 'active' },
          },
        }))
      },
    })
    cy.location('pathname').should('eq', '/en/reseller/dashboard')
  })

  it('unauthenticated user is redirected to /en/login', () => {
    cy.visit('/en/reseller/dashboard', {
      onBeforeLoad(win) {
        win.localStorage.removeItem('license-auth')
      },
    })
    cy.location('pathname').should('eq', '/en/login')
  })

  it('customer credentials receive silent deny', () => {
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      failOnStatusCode: false,
      body: { email: 'customer@obd2sw.com', password: 'password' },
    }).then((response) => {
      expect(response.status).to.eq(401)
      expect(response.body.message).to.eq('Invalid credentials.')
    })
  })
})
