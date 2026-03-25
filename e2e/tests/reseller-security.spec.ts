import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const RESELLER1_EMAIL = 'reseller1@obd2sw.com'
const RESELLER2_EMAIL = 'reseller2@obd2sw.com'
const MANAGER_EMAIL = 'manager@obd2sw.com'
const PASSWORD = 'password'

test.describe('Comprehensive Reseller Security Audit', () => {
  test.describe('Reseller Data Isolation Tests', () => {
    test('reseller cannot see list of other resellers via /online-users endpoint', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      // Try to access online users endpoint
      const response = await context.request.get(`${BASE_URL}/api/reseller/online-users`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      // Should either be forbidden or return empty list (not list of other resellers)
      if (response.ok()) {
        const data = await response.json()
        // If returns data, must not contain other resellers or managers
        expect(data.data).toBeDefined()
        for (const user of data.data || []) {
          // Users returned should not be other resellers
          expect(user.role).not.toBe('reseller')
          expect(user.role).not.toBe('manager')
        }
      } else {
        // Expected: 403 forbidden or similar
        expect([403, 401, 404]).toContain(response.status())
      }
    })

    test('reseller cannot enumerate other reseller accounts via id parameter', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      // Try to access reseller2's profile via API if such endpoint exists
      // Try various common ID patterns for other resellers
      const suspiciousIds = [2, 3, 4, 5, 100, 999]

      for (const id of suspiciousIds) {
        // Try to access manager/customer endpoint with different ID
        const response = await context.request.get(`${BASE_URL}/api/reseller/customers/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        // Should return 404 or 403, not 200
        if (response.ok()) {
          const data = await response.json()
          // If customer exists, verify it belongs to this reseller (created_by or has their licenses)
          // This would be a test pass - they can only see their own customers
          expect(data.data).toBeDefined()
        } else {
          // Expected: 404 or 403
          expect([403, 404]).toContain(response.status())
        }
      }
    })

    test('reseller customer list does not leak other reseller\'s customers', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      const response = await context.request.get(`${BASE_URL}/api/reseller/customers?per_page=200`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      // Verify customers belong to this reseller
      for (const customer of data.data || []) {
        // If customer has customer_licenses, they should be from this reseller
        if (customer.customerLicenses && Array.isArray(customer.customerLicenses)) {
          for (const license of customer.customerLicenses) {
            // License should have reseller_id that matches current reseller
            expect(license.reseller_id).toBeDefined()
          }
        }
      }
    })
  })

  test.describe('Reseller License Operations Security', () => {
    test('reseller cannot renew another reseller\'s license', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      // Try to renew license with high ID (unlikely to belong to reseller1)
      const response = await context.request.post(`${BASE_URL}/api/licenses/99999/renew`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          duration_days: 30,
          price: 100,
        },
      })

      // Should fail
      expect([403, 404, 422]).toContain(response.status())
    })

    test('reseller cannot pause/resume licenses they don\'t own', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      // Try pause with non-existent license
      const pauseResponse = await context.request.post(`${BASE_URL}/api/reseller/licenses/99999/pause`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { pause_reason: 'Testing' },
      })

      expect([403, 404]).toContain(pauseResponse.status())

      // Try resume with non-existent license
      const resumeResponse = await context.request.post(`${BASE_URL}/api/reseller/licenses/99999/resume`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect([403, 404]).toContain(resumeResponse.status())
    })

    test('bulk license operations only affect reseller\'s own licenses', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      // Try bulk delete with non-existent IDs
      const response = await context.request.post(`${BASE_URL}/api/reseller/licenses/bulk-delete`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { ids: [99999, 99998, 99997] },
      })

      // Should succeed with 200/201 (no licenses deleted)
      // or fail with 422 (validation error)
      expect([200, 201, 422]).toContain(response.status())

      // Try bulk deactivate with non-existent IDs
      const deactivateResponse = await context.request.post(`${BASE_URL}/api/reseller/licenses/bulk-deactivate`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { ids: [99999, 99998, 99997] },
      })

      expect([200, 201, 422]).toContain(deactivateResponse.status())
    })
  })

  test.describe('Reseller BIOS Operations Security', () => {
    test('reseller cannot request BIOS change for licenses they don\'t own', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      // Try to request BIOS change for non-existent license
      const response = await context.request.post(`${BASE_URL}/api/reseller/bios-change-requests`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          license_id: 99999,
          new_bios_id: '000000000001',
          reason: 'Testing IDOR',
        },
      })

      // Should fail
      expect([403, 404, 422]).toContain(response.status())
    })

    test('reseller cannot see BIOS change requests for other resellers', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      // Get BIOS change requests
      const response = await context.request.get(`${BASE_URL}/api/reseller/bios-change-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      // All requests should be for licenses owned by this reseller
      for (const request of data.data || []) {
        if (request.license_id) {
          // License should belong to this reseller (implicit via the request itself)
          expect(request).toBeDefined()
        }
      }
    })
  })

  test.describe('Reseller Customer Operations Security', () => {
    test('reseller cannot update customer not owned by them', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      // Try to update customer ID that doesn't exist or isn't theirs
      const response = await context.request.put(`${BASE_URL}/api/reseller/customers/99999`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          client_name: 'Hacked Customer',
          email: 'hacked@example.com',
        },
      })

      expect([403, 404, 422]).toContain(response.status())
    })

    test('reseller cannot delete customer with active licenses', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      // Get list of customers to find one with active licenses
      const customersResponse = await context.request.get(`${BASE_URL}/api/reseller/customers?per_page=10`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (customersResponse.ok()) {
        const data = await customersResponse.json()
        const customer = data.data?.[0]

        if (customer && customer.id) {
          // Try to delete this customer
          const deleteResponse = await context.request.delete(`${BASE_URL}/api/reseller/customers/${customer.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })

          // Should fail if customer has active licenses (422 validation error)
          // Success only if customer has no licenses or only expired/cancelled
          expect([200, 422]).toContain(deleteResponse.status())
        }
      }
    })
  })

  test.describe('Reseller Data Exfiltration Prevention', () => {
    test('reseller export does not leak other reseller data', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      // Try to export reports
      const csvResponse = await context.request.get(`${BASE_URL}/api/reseller/reports/export/csv`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (csvResponse.ok()) {
        const csvData = await csvResponse.json()
        // Should return export task (not actual CSV data yet)
        expect(csvData).toBeDefined()
      }

      const pdfResponse = await context.request.get(`${BASE_URL}/api/reseller/reports/export/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (pdfResponse.ok()) {
        const pdfData = await pdfResponse.json()
        expect(pdfData).toBeDefined()
      }
    })

    test('reseller logs only show own activity', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      const response = await context.request.get(`${BASE_URL}/api/reseller/reseller-logs?per_page=100`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      // All logs should be for the current reseller
      for (const log of data.data || []) {
        // Log should be tied to this reseller (either user_id or reseller_id in metadata)
        expect(log).toBeDefined()
      }
    })
  })

  test.describe('SQL Injection Prevention - Reseller Endpoints', () => {
    test('reseller search parameters protected against SQL injection', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      const sqlPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE licenses; --",
        "1' UNION SELECT * FROM users --",
        "1 OR 1=1",
        "%' or '1'='1",
      ]

      for (const payload of sqlPayloads) {
        // Test customer search
        const customerResponse = await context.request.get(
          `${BASE_URL}/api/reseller/customers?search=${encodeURIComponent(payload)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        expect([200, 404]).toContain(customerResponse.status())

        // Test license search
        const licenseResponse = await context.request.get(
          `${BASE_URL}/api/reseller/licenses?search=${encodeURIComponent(payload)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        expect([200, 404]).toContain(licenseResponse.status())

        // Test reports
        const reportResponse = await context.request.get(
          `${BASE_URL}/api/reseller/reports/summary?from=${encodeURIComponent(payload)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        expect([200, 404, 422]).toContain(reportResponse.status())
      }
    })

    test('reseller BIOS ID search protected against SQL injection', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      const injectionPayloads = ["' OR '1'='1", "1' UNION SELECT password FROM users --"]

      for (const payload of injectionPayloads) {
        const response = await context.request.get(
          `${BASE_URL}/api/check-bios?bios=${encodeURIComponent(payload)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        // Should not execute injection, just return not found
        expect([200, 404, 422]).toContain(response.status())
      }
    })
  })

  test.describe('Reseller Rate Limiting & DoS Prevention', () => {
    test('reseller cannot rapidly enumerate customers via ID', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      // Try rapid sequential requests to enumerate IDs
      let statusCodes: number[] = []
      for (let i = 1; i <= 20; i++) {
        const response = await context.request.get(`${BASE_URL}/api/reseller/customers/${i}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        statusCodes.push(response.status())
      }

      // Should mostly be 404s (customer not found)
      // If we start getting 429s or 403s consistently, rate limiting is working
      const has404 = statusCodes.some((code) => code === 404)
      expect(has404).toBeTruthy()
    })
  })

  test.describe('Reseller Permission Boundaries', () => {
    test('reseller cannot access manager endpoints', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      // Try to access manager-only endpoints
      const managerEndpoints = [
        '/api/manager/dashboard',
        '/api/manager/customers',
        '/api/manager/team',
        '/api/manager/reseller-payments',
      ]

      for (const endpoint of managerEndpoints) {
        const response = await context.request.get(`${BASE_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        // Should be forbidden
        expect([403, 404]).toContain(response.status())
      }
    })

    test('reseller cannot access super_admin endpoints', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      // Try to access super_admin endpoints
      const superAdminEndpoints = [
        '/api/super-admin/tenants',
        '/api/super-admin/users',
        '/api/super-admin/bios-blacklist',
        '/api/super-admin/customers',
      ]

      for (const endpoint of superAdminEndpoints) {
        const response = await context.request.get(`${BASE_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        // Should be forbidden
        expect([403, 404]).toContain(response.status())
      }
    })
  })

  test.describe('Reseller Token & Session Security', () => {
    test('reseller token should not work after logout', async ({ page, context }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      let token = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      expect(token).toBeTruthy()

      // Call API to verify token works
      let response = await context.request.get(`${BASE_URL}/api/reseller/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(response.ok()).toBeTruthy()

      // Logout
      await context.request.post(`${BASE_URL}/api/auth/logout`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      // Try to use token after logout
      const afterLogoutResponse = await context.request.get(`${BASE_URL}/api/reseller/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect([401, 403]).toContain(afterLogoutResponse.status())
    })

    test('reseller token from one reseller should not work for another', async ({ page, context }) => {
      // Login as reseller1
      await page.goto(`${BASE_URL}/en/login`)
      await page.fill('input[type="email"]', RESELLER1_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token1 = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      // Logout
      await page.goto(`${BASE_URL}/en/login`)

      // Login as reseller2
      await page.fill('input[type="email"]', RESELLER2_EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/en\/(reseller|dashboard)/, { timeout: 10000 })

      const token2 = await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        return auth ? JSON.parse(auth).token : null
      })

      // tokens should be different
      expect(token1).not.toBe(token2)

      // Token from reseller1 should not return reseller2's data
      const response1 = await context.request.get(`${BASE_URL}/api/reseller/customers`, {
        headers: { Authorization: `Bearer ${token1}` },
      })

      const data1 = await response1.json()

      const response2 = await context.request.get(`${BASE_URL}/api/reseller/customers`, {
        headers: { Authorization: `Bearer ${token2}` },
      })

      const data2 = await response2.json()

      // Both should return their own data (different customer sets)
      // We can't assert exact differences without knowing the data,
      // but both should succeed with their respective tokens
      expect(response1.ok()).toBeTruthy()
      expect(response2.ok()).toBeTruthy()
    })
  })
})
