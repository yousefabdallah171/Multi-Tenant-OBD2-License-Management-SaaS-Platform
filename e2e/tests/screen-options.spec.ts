import { expect, test } from '@playwright/test'
import { BASE_URL, USERS, loginViaUi } from './helpers/auth'

const ROLE_PAGES = {
  superAdmin: { email: USERS.superAdmin.email, dashboard: USERS.superAdmin.dashboard, customers: '/en/super-admin/customers' },
  managerParent: { email: USERS.managerParent.email, dashboard: USERS.managerParent.dashboard, customers: '/en/customers' },
  manager: { email: USERS.manager.email, dashboard: USERS.manager.dashboard, customers: '/en/manager/customers' },
  reseller: { email: USERS.reseller.email, dashboard: USERS.reseller.dashboard, customers: '/en/reseller/customers' },
} as const

test('super-admin customer screen options persist hidden columns and page size', async ({ page }) => {
  await loginViaUi(page, ROLE_PAGES.superAdmin.email, ROLE_PAGES.superAdmin.dashboard)
  await page.goto(`${BASE_URL}${ROLE_PAGES.superAdmin.customers}`)

  const screenOptions = page.getByRole('button', { name: 'Screen Options' })
  await expect(screenOptions).toBeVisible()
  await screenOptions.click()
  await page.getByRole('button', { name: /^Phone$/i }).click()
  await page.getByRole('button', { name: '50' }).dispatchEvent('click')
  await expect(page.getByRole('columnheader', { name: 'Phone' })).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('columnheader', { name: 'Phone' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Screen Options' }).click()
  await expect(page.getByRole('button', { name: '50' })).toBeVisible()
})

for (const [role, config] of Object.entries(ROLE_PAGES)) {
  test(`${role} customer page shows screen options`, async ({ page }) => {
    await loginViaUi(page, config.email, config.dashboard)
    await page.goto(`${BASE_URL}${config.customers}`)
    await expect(page.getByRole('button', { name: 'Screen Options' })).toBeVisible()
  })
}

test('super-admin users page shows screen options', async ({ page }) => {
  await loginViaUi(page, ROLE_PAGES.superAdmin.email, ROLE_PAGES.superAdmin.dashboard)
  await page.goto(`${BASE_URL}/en/super-admin/users`)
  await expect(page.getByRole('button', { name: 'Screen Options' })).toBeVisible()
})

test('super-admin admin management page shows screen options', async ({ page }) => {
  await loginViaUi(page, ROLE_PAGES.superAdmin.email, ROLE_PAGES.superAdmin.dashboard)
  await page.goto(`${BASE_URL}/en/super-admin/admin-management`)
  await expect(page.getByRole('button', { name: 'Screen Options' })).toBeVisible()
})

test('super-admin bios history page shows screen options', async ({ page }) => {
  await loginViaUi(page, ROLE_PAGES.superAdmin.email, ROLE_PAGES.superAdmin.dashboard)
  await page.goto(`${BASE_URL}/en/super-admin/bios-history`)
  await expect(page.getByRole('button', { name: 'Screen Options' })).toBeVisible()
})

test('super-admin security locks page shows screen options on the raw-table tabs', async ({ page }) => {
  await loginViaUi(page, ROLE_PAGES.superAdmin.email, ROLE_PAGES.superAdmin.dashboard)
  await page.goto(`${BASE_URL}/en/super-admin/security-locks`)
  await expect(page.getByRole('button', { name: 'Screen Options' })).toBeVisible()
})
