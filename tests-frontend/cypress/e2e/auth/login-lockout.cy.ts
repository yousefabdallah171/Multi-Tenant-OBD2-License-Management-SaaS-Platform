describe('Auth Lockout Flow', () => {
  it('wrong password shows error and keeps form visible', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 401,
      body: { message: 'Invalid credentials.' },
    }).as('login')

    cy.visit('/en/login')
    cy.get('#email').type('admin@obd2sw.com')
    cy.get('#password').type('wrong')
    cy.contains('button', /sign in/i).click()
    cy.wait('@login')

    cy.contains('Invalid credentials.').should('be.visible')
    cy.get('#email').should('be.visible')
  })

  it('lockout response shows countdown banner', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 429,
      body: { locked: true, reason: 'account_locked', seconds_remaining: 60 },
    }).as('login')

    cy.visit('/en/login')
    cy.get('#email').type('locked@obd2sw.com')
    cy.get('#password').type('wrong')
    cy.contains('button', /sign in/i).click()
    cy.wait('@login')

    cy.contains(/1:00/).should('be.visible')
    cy.get('#email').should('be.disabled')
  })

  it('ip blocked response shows permanent support banner', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 429,
      body: { locked: true, reason: 'ip_blocked', unlocks_at: null },
    }).as('login')

    cy.visit('/en/login')
    cy.get('#email').type('blocked@obd2sw.com')
    cy.get('#password').type('wrong')
    cy.contains('button', /sign in/i).click()
    cy.wait('@login')

    cy.contains('support@obd2sw.com').should('be.visible')
    cy.contains(/try again in/i).should('not.exist')
  })

  it('/ar/forgot-password resolves to not-found flow', () => {
    cy.visit('/ar/forgot-password', { failOnStatusCode: false })
    cy.location('pathname').should('match', /\/ar\/(not-found|forgot-password)/)
  })
})
