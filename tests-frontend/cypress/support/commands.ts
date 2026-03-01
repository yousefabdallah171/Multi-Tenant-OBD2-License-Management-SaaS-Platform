type LoginRole = 'super_admin' | 'manager_parent' | 'manager' | 'reseller'
type ExternalApiMock = 'success' | 'failure' | 'timeout'

const dashboardByRole: Record<LoginRole, string> = {
  super_admin: '/en/super-admin/dashboard',
  manager_parent: '/en/dashboard',
  manager: '/en/manager/dashboard',
  reseller: '/en/reseller/dashboard',
}

Cypress.Commands.add('login', (role: LoginRole) => {
  cy.fixture('users').then((users) => {
    const selected = users[role]

    cy.request('POST', '/api/auth/login', {
      email: selected.email,
      password: selected.password,
    }).then((response) => {
      const payload = response.body as { token: string; user: unknown }
      window.localStorage.setItem('license-auth', JSON.stringify({
        token: payload.token,
        user: payload.user,
      }))
    })
  })

  cy.visit(dashboardByRole[role])
})

Cypress.Commands.add('mockExternalApi', (response: ExternalApiMock) => {
  if (response === 'timeout') {
    cy.intercept('POST', '/api/licenses/activate', {
      forceNetworkError: true,
    }).as('externalActivate')
    return
  }

  const statusCode = response === 'success' ? 200 : 422
  const body = response === 'success'
    ? { message: 'Activated', data: { id: 1 } }
    : { message: 'The activation request was rejected by the external service.' }

  cy.intercept('POST', '/api/licenses/activate', {
    statusCode,
    body,
  }).as('externalActivate')
})

export {}
