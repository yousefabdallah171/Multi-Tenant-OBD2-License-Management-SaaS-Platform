import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
export const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL ?? BASE_URL
export const PASSWORD = 'password'

export const USERS = {
  superAdmin: { email: 'admin@obd2sw.com', dashboard: /\/en\/super-admin\/dashboard/ },
  managerParent: { email: 'manager@obd2sw.com', dashboard: /\/en\/dashboard/ },
  manager: { email: 'reseller2@obd2sw.com', dashboard: /\/en\/manager\/dashboard/ },
  reseller: { email: 'reseller1@obd2sw.com', dashboard: /\/en\/reseller\/dashboard/ },
} as const

export async function loginViaUi(
  page: Page,
  email: string,
  dashboardPattern: RegExp,
  rememberMe = true,
) {
  await page.goto(`${BASE_URL}/en/login`)
  await page.fill('#email', email)
  await page.fill('#password', PASSWORD)

  const rememberCheckbox = page.locator('input[type="checkbox"]')
  if (await rememberCheckbox.count()) {
    const isChecked = await rememberCheckbox.isChecked()
    if (isChecked !== rememberMe) {
      await rememberCheckbox.click()
    }
  }

  await page.click('button[type="submit"]')
  await page.waitForURL(dashboardPattern, { timeout: 30000 })
}

export async function apiLogin(request: APIRequestContext, email: string) {
  const response = await request.post(`${API_BASE_URL}/api/auth/login`, {
    data: { email, password: PASSWORD },
  })

  expect(response.ok(), `login failed for ${email}: ${response.status()} ${await response.text()}`).toBeTruthy()
  return await response.json() as {
    token: string
    user: {
      id: number
      email: string
      role: string
      tenant_id: number | null
    }
  }
}

export async function clearLoginSecurityLocks(
  request: APIRequestContext,
  adminToken: string,
  emails: string[] = [USERS.reseller.email, USERS.manager.email, USERS.managerParent.email, USERS.superAdmin.email],
) {
  const headers = { Authorization: `Bearer ${adminToken}` }

  for (const ip of ['127.0.0.1', '::1']) {
    await request.post(`${API_BASE_URL}/api/super-admin/security/unblock-ip`, {
      headers,
      data: { ip },
    })
  }

  for (const email of emails) {
    await request.post(`${API_BASE_URL}/api/super-admin/security/unblock-email`, {
      headers,
      data: { email },
    })
  }
}
