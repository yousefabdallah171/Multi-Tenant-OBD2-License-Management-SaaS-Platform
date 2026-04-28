import { expect, test } from '@playwright/test'
import { API_BASE_URL, BASE_URL, USERS, apiLogin, loginViaUi } from './helpers/auth'

const SELECTED_FONT_NAME = 'Alexandria'
const DEFAULT_APPEARANCE = {
  font_family: "'Cairo', ui-sans-serif, system-ui, -apple-system, sans-serif",
  font_sizes: {
    display_px: 28,
    heading_px: 18,
    body_px: 14,
    label_px: 13,
    table_header_px: 14,
    table_cell_px: 14,
    helper_px: 12,
  },
  font_weights: {
    display: 800,
    heading: 700,
    body: 500,
    label: 600,
    table_header: 700,
  },
  surfaces: {
    cards: { opacity_percent: 100, brightness_percent: 100 },
    charts: { opacity_percent: 100, brightness_percent: 100 },
    badges: { opacity_percent: 100, brightness_percent: 100 },
  },
}

const FONT_ROLES = [
  {
    key: 'superAdmin',
    user: USERS.superAdmin,
    routes: [
      '/en/super-admin/dashboard',
      '/en/super-admin/customers',
      '/en/super-admin/reports',
    ],
  },
  {
    key: 'managerParent',
    user: USERS.managerParent,
    routes: [
      '/en/dashboard',
      '/en/customers',
      '/en/reports',
    ],
  },
  {
    key: 'manager',
    user: USERS.manager,
    routes: [
      '/en/manager/dashboard',
      '/en/manager/customers',
      '/en/manager/reports',
    ],
  },
  {
    key: 'reseller',
    user: USERS.reseller,
    routes: [
      '/en/reseller/dashboard',
      '/en/reseller/customers',
      '/en/reseller/reports',
    ],
  },
] as const

async function clearBrowserAuth(page: Parameters<typeof loginViaUi>[0]) {
  await page.goto(`${BASE_URL}/en/login`)
  await page.context().clearCookies()
  await page.evaluate(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
}

async function updateAppearance(request: Parameters<typeof apiLogin>[0], appearance: typeof DEFAULT_APPEARANCE) {
  const { token } = await apiLogin(request, USERS.superAdmin.email)
  const response = await request.put(`${API_BASE_URL}/api/super-admin/settings`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      appearance: {
        dashboard: appearance,
      },
    },
  })

  expect(response.ok(), await response.text()).toBeTruthy()
}

async function assertDashboardFontApplied(
  page: Parameters<typeof loginViaUi>[0],
  expectedFontName: string,
) {
  await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-dashboard-appearance'))).toBe('active')
  await expect.poll(async () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dashboard-font-family').trim())).toContain(expectedFontName)
  await expect.poll(async () => page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(expectedFontName)
  await expect.poll(async () => page.evaluate((activeFont) => document.fonts.check(`16px "${activeFont}"`), expectedFontName)).toBe(true)
  await expect.poll(async () => page.locator('.dashboard-app').first().evaluate((element) => getComputedStyle(element).fontFamily)).toContain(expectedFontName)
}

async function assertDashboardPageReady(page: Parameters<typeof loginViaUi>[0]) {
  await expect(page.locator('.dashboard-app').first()).toBeVisible({ timeout: 15000 })
  await expect(page.locator('#dashboard-main-content')).toBeVisible({ timeout: 15000 })
}

async function assertUserMenuFontApplied(
  page: Parameters<typeof loginViaUi>[0],
  email: string,
  expectedFontName: string,
) {
  await page.getByRole('button', { name: 'Open user menu' }).click()

  const dropdownIdentity = page.getByText(email, { exact: true }).last()
  await expect(dropdownIdentity).toBeVisible()
  await expect.poll(async () => dropdownIdentity.evaluate((element) => getComputedStyle(element).fontFamily)).toContain(expectedFontName)

  await page.keyboard.press('Escape')
}

async function verifyRoleFontCoverage(
  page: Parameters<typeof loginViaUi>[0],
  role: typeof FONT_ROLES[number],
) {
  await clearBrowserAuth(page)
  await loginViaUi(page, role.user.email, role.user.dashboard)

  for (const route of role.routes) {
    await page.goto(`${BASE_URL}${route}`)
    await assertDashboardPageReady(page)
    await assertDashboardFontApplied(page, SELECTED_FONT_NAME)
  }

  await assertUserMenuFontApplied(page, role.user.email, SELECTED_FONT_NAME)
}

test.describe.serial('Dashboard appearance settings', () => {
  test.afterEach(async ({ request }) => {
    await updateAppearance(request, DEFAULT_APPEARANCE)
  })

  test('super admin preview and save persist typography tokens', async ({ page, request }) => {
    test.setTimeout(60000)

    await updateAppearance(request, DEFAULT_APPEARANCE)

    await loginViaUi(page, USERS.superAdmin.email, USERS.superAdmin.dashboard)
    await page.goto(`${BASE_URL}/en/super-admin/settings`)
    await page.getByRole('tab', { name: 'Appearance' }).click()

    await page.selectOption('#appearance-font-family', { label: SELECTED_FONT_NAME })

    const preview = page.getByTestId('dashboard-appearance-preview')
    const previewTitle = preview.getByRole('heading', { name: 'Dashboard typography and surfaces' })

    await expect.poll(async () => preview.evaluate((element) => getComputedStyle(element).getPropertyValue('--dashboard-font-family').trim())).toContain(SELECTED_FONT_NAME)
    await expect.poll(async () => previewTitle.evaluate((element) => getComputedStyle(element).fontFamily)).toContain(SELECTED_FONT_NAME)

    await page.getByRole('button', { name: 'Save' }).last().click()
    await expect(page.getByText('Settings saved successfully.')).toBeVisible({ timeout: 15000 })
    await expect.poll(async () => page.evaluate(() => window.localStorage.getItem('dashboard-appearance:v1') ?? '')).toContain(SELECTED_FONT_NAME)

    await page.reload()
    await expect.poll(async () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dashboard-font-family').trim())).toContain(SELECTED_FONT_NAME)
    await expect.poll(async () => page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(SELECTED_FONT_NAME)

    const { token } = await apiLogin(request, USERS.superAdmin.email)
    const response = await request.get(`${API_BASE_URL}/api/dashboard-appearance/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.ok(), await response.text()).toBeTruthy()

    const body = await response.json()
    expect(body?.data?.font_family).toContain(SELECTED_FONT_NAME)
  })

  for (const role of FONT_ROLES) {
    test(`${role.key} inherits the selected font across representative dashboard pages`, async ({ page, request }) => {
      test.setTimeout(60000)

      await updateAppearance(request, {
        ...DEFAULT_APPEARANCE,
        font_family: `'${SELECTED_FONT_NAME}', ui-sans-serif, system-ui, -apple-system, sans-serif`,
      })

      await verifyRoleFontCoverage(page, role)
    })
  }

  test('selected font applies across all active dashboard roles and representative pages', async ({ page, request }) => {
    test.setTimeout(120000)

    await updateAppearance(request, {
      ...DEFAULT_APPEARANCE,
      font_family: `'${SELECTED_FONT_NAME}', ui-sans-serif, system-ui, -apple-system, sans-serif`,
    })

    for (const role of FONT_ROLES) {
      await verifyRoleFontCoverage(page, role)
    }
  })
})
