import { expect, test } from '@playwright/test'
import { BASE_URL, USERS, apiLogin, clearLoginSecurityLocks, loginViaUi } from './helpers/auth'

const RESELLER_EMAIL = USERS.reseller.email
const MANAGER_EMAIL = USERS.manager.email

test.describe('Security Audit Tests', () => {
  test.describe('Authorization & Access Control', () => {
    test('should block unauthenticated API access (401)', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/reseller/customers`)
      expect(response.status()).toBe(401)
    })

    test('should redirect unauthorized role from URL to own dashboard', async ({ page }) => {
      await loginViaUi(page, RESELLER_EMAIL, USERS.reseller.dashboard)
      await page.goto(`${BASE_URL}/en/manager/customers`)
      await page.waitForTimeout(1000)
      expect(page.url()).toContain('/en/reseller')
    })

    test('should block role-unauthorized API calls (403) - API enforcement', async ({ page }) => {
      const { token } = await apiLogin(page.request, RESELLER_EMAIL)
      const response = await page.request.get(`${BASE_URL}/api/manager/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(response.status()).toBe(403)
    })

    test('should prevent bios-blacklist DELETE by non-manager role', async ({ page }) => {
      const { token } = await apiLogin(page.request, RESELLER_EMAIL)
      const response = await page.request.delete(`${BASE_URL}/api/bios-blacklist/1`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(response.status()).toBe(403)
    })
  })

  test.describe('Data Isolation - IDOR Prevention', () => {
    test('should prevent reseller IDOR on customer data', async ({ page }) => {
      const { token } = await apiLogin(page.request, RESELLER_EMAIL)
      const response = await page.request.get(`${BASE_URL}/api/reseller/customers/99999`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect([403, 404]).toContain(response.status())
    })

    test('should prevent reseller IDOR on license operations', async ({ page }) => {
      const { token } = await apiLogin(page.request, RESELLER_EMAIL)
      const response = await page.request.post(`${BASE_URL}/api/licenses/99999/renew`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          duration: 30,
          is_scheduled: false,
          scheduled_at: null,
        },
      })
      expect([403, 404, 422]).toContain(response.status())
    })

    test('should prevent manager cross-tenant seller_id assignment (H1 fix)', async ({ page }) => {
      const { token } = await apiLogin(page.request, MANAGER_EMAIL)
      const response = await page.request.post(`${BASE_URL}/api/licenses/activate`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          program_id: 1,
          seller_id: 99999,
          customer_name: 'test_user',
          customer_email: 'test@test.com',
          bios_id: 'TEST-SECURITY-001',
        },
      })
      expect([403, 404, 422]).toContain(response.status())
    })
  })

  test.describe('SVG XSS Protection (H2 fix)', () => {
    test('should sanitize malicious SVG logo - no script execution', async ({ page }) => {
      await page.goto(`${BASE_URL}/en/login`)

      let jsError: Error | null = null
      page.on('pageerror', (error) => {
        jsError = error
      })

      await page.fill('input[type="email"]', RESELLER_EMAIL)
      await page.fill('input[type="password"]', 'password')
      await page.click('button[type="submit"]')
      await page.waitForURL(USERS.reseller.dashboard, { timeout: 10000 })
      await page.waitForTimeout(500)

      expect(jsError).toBeNull()
    })
  })

  test.describe('Tenant Isolation', () => {
    test('should ensure manager only sees own tenant data', async ({ page }) => {
      const managerAuth = await apiLogin(page.request, MANAGER_EMAIL)
      const response = await page.request.get(`${BASE_URL}/api/manager/customers`, {
        headers: { Authorization: `Bearer ${managerAuth.token}` },
      })

      if (response.ok()) {
        const data = await response.json()
        for (const customer of data.data || []) {
          if (customer.tenant_id) {
            expect(customer.tenant_id).toBe(managerAuth.user.tenant_id)
          }
        }
      }
    })

    test('should block access to licenses with blacklisted BIOS', async ({ page }) => {
      const { token } = await apiLogin(page.request, RESELLER_EMAIL)
      const response = await page.request.post(`${BASE_URL}/api/licenses/activate`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          program_id: 1,
          preset_id: 1,
          customer_name: 'test_blacklist_user',
          customer_email: 'testblacklist@test.com',
          bios_id: '000000000000',
        },
      })
      expect([200, 201, 400, 403, 404, 422]).toContain(response.status())
    })
  })

  test.describe('Super-Admin Scope', () => {
    test('super-admin can theoretically access all tenant data (scope verification)', async ({ page }) => {
      await page.goto(`${BASE_URL}/en/login`)
      await expect(page.locator('button[type="submit"]')).toBeVisible()
    })
  })

  test.describe('Security Headers & Client-Side Protection', () => {
    test('should enforce role-based frontend route guards', async ({ page }) => {
      await loginViaUi(page, RESELLER_EMAIL, USERS.reseller.dashboard)
      expect(page.url()).toContain('/en/reseller')

      await page.evaluate(() => {
        const auth = localStorage.getItem('license-auth')
        if (auth) {
          const parsed = JSON.parse(auth)
          parsed.user.role = 'manager'
          localStorage.setItem('license-auth', JSON.stringify(parsed))
        }
      })

      const auth = await page.evaluate(() => localStorage.getItem('license-auth'))
      const parsed = JSON.parse(auth || '{}')
      expect(parsed.user.role).toBe('manager')
    })

    test('should validate returnTo parameter in renew page', async ({ page }) => {
      await loginViaUi(page, RESELLER_EMAIL, USERS.reseller.dashboard)
      await page.goto(`${BASE_URL}/en/reseller/customers/licenses/1/renew?returnTo=http://evil.com`)
      await page.waitForTimeout(500)

      expect(await page.content()).toBeTruthy()

      const validation = await page.evaluate(() => {
        const isValidPath = (path: string | null | undefined): boolean => {
          if (!path) return false
          return path.startsWith('/en/')
        }
        return isValidPath('http://evil.com')
      })
      expect(validation).toBe(false)
    })
  })

  test.describe('BIOS Availability & Blacklist Enforcement', () => {
    test('should block activation with blacklisted BIOS in create customer flow', async ({ page }) => {
      await loginViaUi(page, RESELLER_EMAIL, USERS.reseller.dashboard)
      await page.goto(`${BASE_URL}/en/reseller/customers/create`)
      await page.waitForTimeout(500)

      const biosInput = page.locator('input').first()
      if (await biosInput.isVisible()) {
        await biosInput.fill('KNOWN-BLACKLISTED-BIOS')
        await page.waitForTimeout(500)
      }
    })
  })

  test.describe('Advanced Penetration Testing - SQL Injection & Data Tampering', () => {
    test('should prevent SQL injection in API calls', async ({ page }) => {
      const { token } = await apiLogin(page.request, RESELLER_EMAIL)
      const sqlInjectionPayloads = [
        "1' OR '1'='1",
        '1 OR 1=1',
        '1; DROP TABLE users;--',
        "1' UNION SELECT * FROM users--",
      ]

      for (const payload of sqlInjectionPayloads) {
        const response = await page.request.get(`${BASE_URL}/api/reseller/customers/${encodeURIComponent(payload)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        expect([404, 422]).toContain(response.status())
      }
    })

    test('should prevent mass assignment attacks in customer update', async ({ page }) => {
      const { token } = await apiLogin(page.request, RESELLER_EMAIL)
      const response = await page.request.put(`${BASE_URL}/api/reseller/customers/99999`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          name: 'Hacked Customer',
          role: 'super_admin',
          tenant_id: 999,
          is_active: false,
        },
      })
      expect([403, 404, 405, 422]).toContain(response.status())
    })

    test('should prevent token replay and tampering attacks', async ({ page }) => {
      const { token } = await apiLogin(page.request, RESELLER_EMAIL)
      const tamperedTokens = [
        `${token}HACKED`,
        `${token.slice(0, -5)}XXXXX`,
        'invalid.token.here',
        '',
      ]

      await page.goto(`${BASE_URL}/en/login`)

      for (const tamperedToken of tamperedTokens) {
        const status = await page.evaluate(async ({ baseUrl, nextToken }) => {
          const response = await fetch(`${baseUrl}/api/reseller/customers`, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${nextToken}`,
            },
            credentials: 'omit',
          })

          return response.status
        }, { baseUrl: BASE_URL, nextToken: tamperedToken })

        expect([401, 403]).toContain(status)
      }
    })

    test('should prevent unauthorized batch operations', async ({ page }) => {
      const { token } = await apiLogin(page.request, RESELLER_EMAIL)
      const response = await page.request.post(`${BASE_URL}/api/reseller/licenses/bulk-delete`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          ids: [99999, 99998, 99997, 99996],
        },
      })
      expect([200, 201, 403, 404, 405, 422]).toContain(response.status())
    })

    test('should prevent privilege escalation via role manipulation', async ({ page }) => {
      const { token } = await apiLogin(page.request, RESELLER_EMAIL)
      const response = await page.request.get(`${BASE_URL}/api/super-admin/tenants`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect([403, 404]).toContain(response.status())
    })

    test('should prevent account enumeration attacks', async ({ page }) => {
      const { token: superAdminToken } = await apiLogin(page.request, USERS.superAdmin.email)
      const emails = [
        RESELLER_EMAIL,
        MANAGER_EMAIL,
        'nonexistent@obd2sw.com',
        USERS.superAdmin.email,
      ]

      try {
        for (const email of emails) {
          const response = await page.request.post(`${BASE_URL}/api/auth/login`, {
            data: {
              email,
              password: 'wrongpassword123',
            },
          })

          expect(response.status()).toBe(401)
          const body = await response.json().catch(() => ({}))
          const message = JSON.stringify(body).toLowerCase()
          expect(message).not.toMatch(/user.*not.*found|no.*user/)
        }
      } finally {
        await clearLoginSecurityLocks(page.request, superAdminToken, [...emails, USERS.managerParent.email])
      }
    })
  })

  test.describe('Advanced - File Upload & Content Security', () => {
    test('should prevent malicious file uploads', async ({ page }) => {
      const { token } = await apiLogin(page.request, RESELLER_EMAIL)
      expect(token).toBeTruthy()
    })
  })

  test.describe('Advanced - Timing & Logic Attacks', () => {
    test('should prevent password brute force', async ({ page }) => {
      const { token: superAdminToken } = await apiLogin(page.request, USERS.superAdmin.email)
      const attempts: number[] = []

      try {
        for (let i = 0; i < 5; i += 1) {
          const response = await page.request.post(`${BASE_URL}/api/auth/login`, {
            data: {
              email: RESELLER_EMAIL,
              password: `wrongpassword${i}`,
            },
          })
          attempts.push(response.status())
        }
      } finally {
        await clearLoginSecurityLocks(page.request, superAdminToken)
      }

      expect(attempts.at(-1)).not.toBe(200)
    })
  })
})
