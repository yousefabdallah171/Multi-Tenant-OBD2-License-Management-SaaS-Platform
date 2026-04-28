import { test, expect, type Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const PASSWORD = 'password'

const USERS = {
  superAdmin: { email: 'admin@obd2sw.com', dashboard: /\/en\/super-admin\/dashboard/, endpoint: '/api/super-admin/bios/search?query=DSA' },
  managerParent: { email: 'manager@obd2sw.com', dashboard: /\/en\/dashboard/, endpoint: '/api/bios/search?query=DSA' },
  manager: { email: 'reseller2@obd2sw.com', dashboard: /\/en\/manager\/dashboard/, endpoint: '/api/manager/bios/search?query=DSA' },
} as const

async function login(page: Page, email: string, dashboardPattern: RegExp) {
  await page.goto(`${BASE_URL}/en/login`)
  await page.fill('#email', email)
  await page.fill('#password', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(dashboardPattern, { timeout: 15000 })
}

for (const [role, config] of Object.entries(USERS)) {
  test(`${role} BIOS search returns results without server error`, async ({ page }) => {
    await login(page, config.email, config.dashboard)

    const response = await page.request.get(`${BASE_URL}${config.endpoint}`)
    expect(response.ok(), `status=${response.status()} body=${await response.text()}`).toBeTruthy()

    const body = await response.json()
    expect(Array.isArray(body?.data)).toBeTruthy()
  })
}
