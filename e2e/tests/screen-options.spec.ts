import { expect, test, type Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const PASSWORD = 'password'

const USERS = {
  superAdmin: { email: 'admin@obd2sw.com', dashboard: /\/en\/super-admin\/dashboard/, customers: '/en/super-admin/customers' },
  managerParent: { email: 'parent@obd2sw.com', dashboard: /\/en\/dashboard/, customers: '/en/customers' },
  manager: { email: 'manager@obd2sw.com', dashboard: /\/en\/manager\/dashboard/, customers: '/en/manager/customers' },
  reseller: { email: 'reseller@obd2sw.com', dashboard: /\/en\/reseller\/dashboard/, customers: '/en/reseller/customers' },
} as const

async function login(page: Page, email: string, dashboardPattern: RegExp) {
  const response = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password: PASSWORD },
  })
  expect(response.ok()).toBeTruthy()
  const body = await response.json()

  await page.addInitScript((user) => {
    window.localStorage.setItem('license-auth', JSON.stringify({ user }))
  }, body.user)

  await page.goto(`${BASE_URL}/en/login`)
  await page.waitForURL(dashboardPattern, { timeout: 15000 })
}

test('super-admin customer screen options persist hidden columns and page size', async ({ page }) => {
  await login(page, USERS.superAdmin.email, USERS.superAdmin.dashboard)
  await page.goto(`${BASE_URL}${USERS.superAdmin.customers}`)

  const screenOptions = page.getByRole('button', { name: 'Screen Options' })
  await expect(screenOptions).toBeVisible()
  await screenOptions.click()
  await page.getByRole('menuitem', { name: /Phone/i }).click()
  await page.getByRole('button', { name: '50' }).click()
  await expect(page.getByRole('columnheader', { name: 'Phone' })).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('columnheader', { name: 'Phone' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Screen Options' }).click()
  await expect(page.getByRole('button', { name: '50' })).toBeVisible()
})

for (const [role, config] of Object.entries(USERS)) {
  test(`${role} customer page shows screen options`, async ({ page }) => {
    await login(page, config.email, config.dashboard)
    await page.goto(`${BASE_URL}${config.customers}`)
    await expect(page.getByRole('button', { name: 'Screen Options' })).toBeVisible()
  })
}

test('super-admin users page shows screen options', async ({ page }) => {
  await login(page, USERS.superAdmin.email, USERS.superAdmin.dashboard)
  await page.goto(`${BASE_URL}/en/super-admin/users`)
  await expect(page.getByRole('button', { name: 'Screen Options' })).toBeVisible()
})

test('super-admin admin management page shows screen options', async ({ page }) => {
  await login(page, USERS.superAdmin.email, USERS.superAdmin.dashboard)
  await page.goto(`${BASE_URL}/en/super-admin/admin-management`)
  await expect(page.getByRole('button', { name: 'Screen Options' })).toBeVisible()
})

test('super-admin bios history page shows screen options', async ({ page }) => {
  await login(page, USERS.superAdmin.email, USERS.superAdmin.dashboard)
  await page.goto(`${BASE_URL}/en/super-admin/bios-history`)
  await expect(page.getByRole('button', { name: 'Screen Options' })).toBeVisible()
})

test('super-admin security locks page shows screen options on the raw-table tabs', async ({ page }) => {
  await login(page, USERS.superAdmin.email, USERS.superAdmin.dashboard)
  await page.goto(`${BASE_URL}/en/super-admin/security-locks`)
  await expect(page.getByRole('button', { name: 'Screen Options' })).toBeVisible()
})
