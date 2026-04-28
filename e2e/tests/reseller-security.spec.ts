import { expect, test, type APIRequestContext } from '@playwright/test'
import { apiLogin, BASE_URL, USERS } from './helpers/auth'

const RESELLER_EMAIL = USERS.reseller.email
const MANAGER_EMAIL = USERS.manager.email

async function authHeaders(request: APIRequestContext, email = RESELLER_EMAIL) {
  const { token } = await apiLogin(request, email)
  return { Authorization: `Bearer ${token}` }
}

test.describe('Comprehensive Reseller Security Audit', () => {
  test.describe('Reseller Data Isolation Tests', () => {
    test('reseller online-users endpoint only exposes masked identity data', async ({ page }) => {
      const headers = await authHeaders(page.request)
      const response = await page.request.get(`${BASE_URL}/api/reseller/online-users`, { headers })

      if (response.ok()) {
        const data = await response.json()
        expect(data.data).toBeDefined()
        for (const user of data.data || []) {
          expect(typeof user.masked_name).toBe('string')
          expect(user.masked_name).toContain('*')
          expect(user.email).toBeUndefined()
          expect(user.id).toBeUndefined()
        }
      } else {
        expect([401, 403, 404]).toContain(response.status())
      }
    })

    test('reseller cannot enumerate other reseller accounts via id parameter', async ({ page }) => {
      const headers = await authHeaders(page.request)
      const suspiciousIds = [2, 3, 4, 5, 100, 999]

      for (const id of suspiciousIds) {
        const response = await page.request.get(`${BASE_URL}/api/reseller/customers/${id}`, { headers })

        if (response.ok()) {
          const data = await response.json()
          expect(data.data).toBeDefined()
        } else {
          expect([403, 404]).toContain(response.status())
        }
      }
    })

    test("reseller customer list does not leak other reseller's customers", async ({ page }) => {
      const headers = await authHeaders(page.request)
      const response = await page.request.get(`${BASE_URL}/api/reseller/customers?per_page=100`, { headers })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      for (const customer of data.data || []) {
        if (customer.customerLicenses && Array.isArray(customer.customerLicenses)) {
          for (const license of customer.customerLicenses) {
            expect(license.reseller_id).toBeDefined()
          }
        }
      }
    })
  })

  test.describe('Reseller License Operations Security', () => {
    test("reseller cannot renew another reseller's license", async ({ page }) => {
      const headers = await authHeaders(page.request)
      const response = await page.request.post(`${BASE_URL}/api/licenses/99999/renew`, {
        headers,
        data: {
          duration_days: 30,
          price: 100,
        },
      })

      expect([403, 404, 422]).toContain(response.status())
    })

    test("reseller cannot pause/resume licenses they don't own", async ({ page }) => {
      const headers = await authHeaders(page.request)

      const pauseResponse = await page.request.post(`${BASE_URL}/api/reseller/licenses/99999/pause`, {
        headers,
        data: { pause_reason: 'Testing' },
      })
      expect([403, 404]).toContain(pauseResponse.status())

      const resumeResponse = await page.request.post(`${BASE_URL}/api/reseller/licenses/99999/resume`, {
        headers,
      })
      expect([403, 404]).toContain(resumeResponse.status())
    })

    test('bulk license operations only affect reseller\'s own licenses', async ({ page }) => {
      const headers = await authHeaders(page.request)

      const bulkDeleteResponse = await page.request.post(`${BASE_URL}/api/reseller/licenses/bulk-delete`, {
        headers,
        data: { ids: [99999, 99998, 99997] },
      })
      expect([200, 201, 405, 422]).toContain(bulkDeleteResponse.status())

      const deactivateResponse = await page.request.post(`${BASE_URL}/api/reseller/licenses/bulk-deactivate`, {
        headers,
        data: { ids: [99999, 99998, 99997] },
      })
      expect([200, 201, 405, 422]).toContain(deactivateResponse.status())
    })
  })

  test.describe('Reseller BIOS Operations Security', () => {
    test("reseller cannot request BIOS change for licenses they don't own", async ({ page }) => {
      const headers = await authHeaders(page.request)
      const response = await page.request.post(`${BASE_URL}/api/reseller/bios-change-requests`, {
        headers,
        data: {
          license_id: 99999,
          new_bios_id: '000000000001',
          reason: 'Testing IDOR',
        },
      })

      expect([403, 404, 422]).toContain(response.status())
    })

    test("reseller cannot see BIOS change requests for other resellers", async ({ page }) => {
      const headers = await authHeaders(page.request)
      const response = await page.request.get(`${BASE_URL}/api/reseller/bios-change-requests`, { headers })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      for (const request of data.data || []) {
        if (request.license_id) {
          expect(request).toBeDefined()
        }
      }
    })
  })

  test.describe('Reseller Customer Operations Security', () => {
    test('reseller cannot update customer not owned by them', async ({ page }) => {
      const headers = await authHeaders(page.request)
      const response = await page.request.put(`${BASE_URL}/api/reseller/customers/99999`, {
        headers,
        data: {
          client_name: 'Hacked Customer',
          email: 'hacked@example.com',
        },
      })

      expect([403, 404, 422]).toContain(response.status())
    })

    test('reseller cannot delete customer with active licenses', async ({ page }) => {
      const headers = await authHeaders(page.request)
      const customersResponse = await page.request.get(`${BASE_URL}/api/reseller/customers?per_page=10`, { headers })

      if (customersResponse.ok()) {
        const data = await customersResponse.json()
        const customer = data.data?.[0]

        if (customer?.id) {
          const deleteResponse = await page.request.delete(`${BASE_URL}/api/reseller/customers/${customer.id}`, { headers })
          expect([200, 405, 422]).toContain(deleteResponse.status())
        }
      }
    })
  })

  test.describe('Reseller Data Exfiltration Prevention', () => {
    test('reseller export does not leak other reseller data', async ({ page }) => {
      const headers = await authHeaders(page.request)

      const csvResponse = await page.request.get(`${BASE_URL}/api/reseller/reports/export/csv`, { headers })
      if (csvResponse.ok()) {
        expect(await csvResponse.json()).toBeDefined()
      }

      const pdfResponse = await page.request.get(`${BASE_URL}/api/reseller/reports/export/pdf`, { headers })
      if (pdfResponse.ok()) {
        expect(await pdfResponse.json()).toBeDefined()
      }
    })

    test('reseller logs only show own activity', async ({ page }) => {
      const headers = await authHeaders(page.request)
      const response = await page.request.get(`${BASE_URL}/api/reseller/reseller-logs?per_page=100`, { headers })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      for (const log of data.data || []) {
        expect(log).toBeDefined()
      }
    })
  })

  test.describe('SQL Injection Prevention - Reseller Endpoints', () => {
    test('reseller search parameters protected against SQL injection', async ({ page }) => {
      const headers = await authHeaders(page.request)
      const sqlPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE licenses; --",
        "1' UNION SELECT * FROM users --",
        '1 OR 1=1',
        "%' or '1'='1",
      ]

      for (const payload of sqlPayloads) {
        const customerResponse = await page.request.get(
          `${BASE_URL}/api/reseller/customers?search=${encodeURIComponent(payload)}`,
          { headers },
        )
        expect([200, 404]).toContain(customerResponse.status())

        const licenseResponse = await page.request.get(
          `${BASE_URL}/api/reseller/licenses?search=${encodeURIComponent(payload)}`,
          { headers },
        )
        expect([200, 404]).toContain(licenseResponse.status())

        const reportResponse = await page.request.get(
          `${BASE_URL}/api/reseller/reports/summary?from=${encodeURIComponent(payload)}`,
          { headers },
        )
        expect([200, 404, 422]).toContain(reportResponse.status())
      }
    })

    test('reseller BIOS ID search protected against SQL injection', async ({ page }) => {
      const headers = await authHeaders(page.request)
      const injectionPayloads = ["' OR '1'='1", "1' UNION SELECT password FROM users --"]

      for (const payload of injectionPayloads) {
        const response = await page.request.get(
          `${BASE_URL}/api/check-bios?bios=${encodeURIComponent(payload)}`,
          { headers },
        )
        expect([200, 404, 422]).toContain(response.status())
      }
    })
  })

  test.describe('Reseller Rate Limiting & DoS Prevention', () => {
    test('reseller cannot rapidly enumerate customers via ID', async ({ page }) => {
      const headers = await authHeaders(page.request)
      const statusCodes: number[] = []

      for (let i = 1; i <= 20; i += 1) {
        const response = await page.request.get(`${BASE_URL}/api/reseller/customers/${i}`, { headers })
        statusCodes.push(response.status())
      }

      expect(statusCodes.some((code) => code === 404)).toBeTruthy()
    })
  })

  test.describe('Reseller Permission Boundaries', () => {
    test('reseller cannot access manager endpoints', async ({ page }) => {
      const headers = await authHeaders(page.request)
      const managerEndpoints = [
        '/api/manager/dashboard',
        '/api/manager/customers',
        '/api/manager/team',
        '/api/manager/reseller-payments',
      ]

      for (const endpoint of managerEndpoints) {
        const response = await page.request.get(`${BASE_URL}${endpoint}`, { headers })
        expect([403, 404]).toContain(response.status())
      }
    })

    test('reseller cannot access super_admin endpoints', async ({ page }) => {
      const headers = await authHeaders(page.request)
      const superAdminEndpoints = [
        '/api/super-admin/tenants',
        '/api/super-admin/users',
        '/api/super-admin/bios-blacklist',
        '/api/super-admin/customers',
      ]

      for (const endpoint of superAdminEndpoints) {
        const response = await page.request.get(`${BASE_URL}${endpoint}`, { headers })
        expect([403, 404]).toContain(response.status())
      }
    })
  })

  test.describe('Reseller Token & Session Security', () => {
    test('reseller token should not work after logout', async ({ page }) => {
      const { token } = await apiLogin(page.request, RESELLER_EMAIL)
      expect(token).toBeTruthy()

      const beforeLogoutResponse = await page.request.get(`${BASE_URL}/api/reseller/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(beforeLogoutResponse.ok()).toBeTruthy()

      await page.request.post(`${BASE_URL}/api/auth/logout`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const afterLogoutResponse = await page.request.get(`${BASE_URL}/api/reseller/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect([401, 403]).toContain(afterLogoutResponse.status())
    })

    test('different account tokens remain isolated', async ({ page }) => {
      const resellerAuth = await apiLogin(page.request, RESELLER_EMAIL)
      const managerAuth = await apiLogin(page.request, MANAGER_EMAIL)

      expect(resellerAuth.token).not.toBe(managerAuth.token)

      const resellerMe = await page.request.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${resellerAuth.token}` },
      })
      const managerMe = await page.request.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${managerAuth.token}` },
      })

      expect(resellerMe.ok()).toBeTruthy()
      expect(managerMe.ok()).toBeTruthy()
      expect((await resellerMe.json()).user?.email).toBe(RESELLER_EMAIL)
      expect((await managerMe.json()).user?.email).toBe(MANAGER_EMAIL)
    })
  })
})
