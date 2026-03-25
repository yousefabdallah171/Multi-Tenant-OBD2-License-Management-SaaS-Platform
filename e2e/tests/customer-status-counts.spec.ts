import { test, expect, type Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const PASSWORD = 'password'

const USERS = {
  superAdmin: { email: 'admin@obd2sw.com', dashboard: /\/en\/super-admin\/dashboard/, endpoint: '/api/super-admin/customers' },
  managerParent: { email: 'manager@obd2sw.com', dashboard: /\/en\/dashboard/, endpoint: '/api/customers' },
  reseller: { email: 'reseller1@obd2sw.com', dashboard: /\/en\/reseller\/dashboard/, endpoint: '/api/reseller/customers' },
} as const

async function login(page: Page, email: string, dashboardPattern: RegExp) {
  await page.goto(`${BASE_URL}/en/login`)
  await page.fill('#email', email)
  await page.fill('#password', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(dashboardPattern, { timeout: 15000 })
}

async function getTotal(page: Page, endpoint: string, params: Record<string, string | number | undefined> = {}) {
  const search = new URLSearchParams()
  search.set('page', '1')
  search.set('per_page', '1')

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  }

  const response = await page.request.get(`${BASE_URL}${endpoint}?${search.toString()}`)
  expect(response.ok()).toBeTruthy()
  const body = await response.json()

  return Number(body?.meta?.total ?? 0)
}

async function expectPartitionedCounts(
  page: Page,
  endpoint: string,
  extraParams: Record<string, string | number | undefined> = {},
) {
  const [all, active, suspended, scheduled, expired, cancelled, pending] = await Promise.all([
    getTotal(page, endpoint, extraParams),
    getTotal(page, endpoint, { ...extraParams, status: 'active' }),
    getTotal(page, endpoint, { ...extraParams, status: 'suspended' }),
    getTotal(page, endpoint, { ...extraParams, status: 'scheduled' }),
    getTotal(page, endpoint, { ...extraParams, status: 'expired' }),
    getTotal(page, endpoint, { ...extraParams, status: 'cancelled' }),
    getTotal(page, endpoint, { ...extraParams, status: 'pending' }),
  ])

  expect(active + suspended + scheduled + expired + cancelled + pending).toBe(all)
}

test.describe('Customer status counts stay partitioned', () => {
  test('super-admin counts partition correctly for all customers and reseller filter', async ({ page }) => {
    await login(page, USERS.superAdmin.email, USERS.superAdmin.dashboard)
    await expectPartitionedCounts(page, USERS.superAdmin.endpoint)
    await expectPartitionedCounts(page, USERS.superAdmin.endpoint, { reseller_id: 3 })
  })

  test('manager-parent counts partition correctly for all customers and reseller filter', async ({ page }) => {
    await login(page, USERS.managerParent.email, USERS.managerParent.dashboard)
    await expectPartitionedCounts(page, USERS.managerParent.endpoint)
    await expectPartitionedCounts(page, USERS.managerParent.endpoint, { reseller_id: 3 })
  })

  test('reseller counts partition correctly for all customers and program filter', async ({ page }) => {
    await login(page, USERS.reseller.email, USERS.reseller.dashboard)
    await expectPartitionedCounts(page, USERS.reseller.endpoint)
    await expectPartitionedCounts(page, USERS.reseller.endpoint, { program_id: 1 })
  })
})
