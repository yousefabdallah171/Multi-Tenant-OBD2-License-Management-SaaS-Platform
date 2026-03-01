declare namespace Cypress {
  interface Chainable {
    login(role: 'super_admin' | 'manager_parent' | 'manager' | 'reseller'): Chainable<void>
    mockExternalApi(response: 'success' | 'failure' | 'timeout'): Chainable<void>
  }
}
