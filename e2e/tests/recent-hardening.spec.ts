import { test, expect, type BrowserContext, type Page, type APIRequestContext } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const PASSWORD = 'password'
const AUTH_STORAGE_KEY = 'license-auth'
const AUTH_SESSION_STORAGE_KEY = 'license-auth-session'

const USERS = {
  superAdmin: { email: 'admin@obd2sw.com', rolePath: '/en/super-admin/dashboard' },
  managerParent: { email: 'manager@obd2sw.com', rolePath: '/en/dashboard' },
  reseller: { email: 'reseller1@obd2sw.com', rolePath: '/en/reseller/dashboard' },
}

const FIXTURES = {
  activeUser: { id: 119, username: 'active_user', biosId: 'TEST-BIOS-ACTIVE' },
  linkedUser: { id: 120, username: 'linked_user', biosId: 'SESSION4-LINKED-BIOS' },
  johnDoe: { id: 128, username: 'john_doe', biosId: 'TEST-LINK-JOHN-001' },
  programId: 1,
}

async function login(page: Page, email: string, rememberMe = true) {
  await page.goto(`${BASE_URL}/en/login`)
  await page.fill('#email', email)
  await page.fill('#password', PASSWORD)

  const rememberCheckbox = page.locator('input[type="checkbox"]')
  if ((await rememberCheckbox.isChecked()) !== rememberMe) {
    await rememberCheckbox.click()
  }

  await page.click('button[type="submit"]')
}

async function getAuthPayload(page: Page, key: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await page.evaluate((storageKey) => {
        const localValue = window.localStorage.getItem(storageKey)
        const sessionValue = window.sessionStorage.getItem(storageKey)

        return {
          localValue,
          sessionValue,
        }
      }, key)
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('Execution context was destroyed') || attempt === 4) {
        throw error
      }

      await page.waitForTimeout(250)
    }
  }

  throw new Error('Failed to read browser storage state.')
}

async function getAccessCookie(context: BrowserContext) {
  const cookies = await context.cookies()
  return cookies.find((cookie) => cookie.name === 'auth_token')
}

async function apiJson<T>(request: APIRequestContext, method: 'GET' | 'POST' | 'PUT', path: string, data?: unknown) {
  const response = method === 'GET'
    ? await request.get(`${BASE_URL}${path}`)
    : method === 'POST'
      ? await request.post(`${BASE_URL}${path}`, { data })
      : await request.put(`${BASE_URL}${path}`, { data })

  const body = await response.json().catch(() => ({}))

  return { response, body: body as T }
}

test.describe('Recent hardening regression checks', () => {
  test('remembered login stores only user data locally and authenticates through cookie-backed /auth/me', async ({ page, context }) => {
    await login(page, USERS.reseller.email, true)
    await page.waitForURL(new RegExp(`${USERS.reseller.rolePath.replace(/\//g, '\\/')}`), { timeout: 15000 })

    const authLocal = await getAuthPayload(page, AUTH_STORAGE_KEY)
    const authSession = await getAuthPayload(page, AUTH_SESSION_STORAGE_KEY)

    expect(authLocal.localValue).toBeTruthy()
    expect(authSession.sessionValue).toBeNull()
    expect(authLocal.localValue).not.toContain('token')

    const authCookie = await getAccessCookie(context)
    expect(authCookie?.httpOnly).toBeTruthy()

    const { response, body } = await apiJson<{ user: { email: string } | null }>(page.request, 'GET', '/api/auth/me')
    expect(response.ok()).toBeTruthy()
    expect(body.user?.email).toBe(USERS.reseller.email)
  })

  test('non-remembered login stores only session user data and clears correctly on logout', async ({ page, context }) => {
    await login(page, USERS.reseller.email, false)
    await page.waitForURL(new RegExp(`${USERS.reseller.rolePath.replace(/\//g, '\\/')}`), { timeout: 15000 })

    const authLocal = await getAuthPayload(page, AUTH_STORAGE_KEY)
    const authSession = await getAuthPayload(page, AUTH_SESSION_STORAGE_KEY)

    expect(authLocal.localValue).toBeNull()
    expect(authSession.sessionValue).toBeTruthy()
    expect(authSession.sessionValue).not.toContain('token')

    const authCookieBeforeLogout = await getAccessCookie(context)
    expect(authCookieBeforeLogout).toBeTruthy()

    await page.getByRole('button', { name: 'Open user menu' }).click()
    await page.getByRole('button', { name: 'Logout' }).click()
    await page.waitForURL(/\/en\/login/, { timeout: 15000 })
    await page.waitForLoadState('domcontentloaded')

    const authLocalAfterLogout = await getAuthPayload(page, AUTH_STORAGE_KEY)
    const authSessionAfterLogout = await getAuthPayload(page, AUTH_SESSION_STORAGE_KEY)
    expect(authLocalAfterLogout.localValue).toBeNull()
    expect(authSessionAfterLogout.sessionValue).toBeNull()

    const { response } = await apiJson(page.request, 'GET', '/api/auth/me')
    expect(response.status()).toBe(401)
  })

  test('manager-parent username unlock and rename are blocked for permanently linked users', async ({ page }) => {
    await login(page, USERS.managerParent.email, true)
    await page.waitForURL(new RegExp(`${USERS.managerParent.rolePath.replace(/\//g, '\\/')}`), { timeout: 15000 })

    const unlockResult = await apiJson<{ errors?: { username?: string[] } }>(
      page.request,
      'POST',
      `/api/username-management/${FIXTURES.linkedUser.id}/unlock`,
      { reason: 'Playwright regression check' },
    )

    expect(unlockResult.response.status()).toBe(422)
    expect(JSON.stringify(unlockResult.body).toLowerCase()).toContain('permanent bios-username link')

    const renameResult = await apiJson<{ errors?: { username?: string[] } }>(
      page.request,
      'PUT',
      `/api/username-management/${FIXTURES.linkedUser.id}/username`,
      { username: 'linked_user_new', reason: 'Playwright regression check' },
    )

    expect(renameResult.response.status()).toBe(422)
    expect(JSON.stringify(renameResult.body).toLowerCase()).toContain('permanent bios-username link')
  })

  test('super-admin force activate rejects bios-side and username-side permanent-link conflicts', async ({ page }) => {
    await login(page, USERS.superAdmin.email, true)
    await page.waitForURL(new RegExp(`${USERS.superAdmin.rolePath.replace(/\//g, '\\/')}`), { timeout: 15000 })

    const biosConflict = await apiJson<{ errors?: Record<string, string[]> }>(
      page.request,
      'POST',
      '/api/super-admin/licenses/force-activate',
      {
        customer_id: FIXTURES.activeUser.id,
        bios_id: FIXTURES.linkedUser.biosId,
        program_id: FIXTURES.programId,
        price: 100,
        duration_months: 1,
      },
    )

    expect(biosConflict.response.status()).toBe(422)
    expect(JSON.stringify(biosConflict.body).toLowerCase()).toContain('permanently linked')

    const usernameConflict = await apiJson<{ errors?: Record<string, string[]> }>(
      page.request,
      'POST',
      '/api/super-admin/licenses/force-activate',
      {
        customer_id: FIXTURES.activeUser.id,
        bios_id: FIXTURES.johnDoe.biosId,
        program_id: FIXTURES.programId,
        price: 100,
        duration_months: 1,
      },
    )

    expect(usernameConflict.response.status()).toBe(422)
    expect(JSON.stringify(usernameConflict.body).toLowerCase()).toContain('permanently linked')
  })

  test('manager-parent direct bios change warns and blocks when the new bios is linked to another username', async ({ page }) => {
    await login(page, USERS.managerParent.email, true)
    await page.waitForURL(new RegExp(`${USERS.managerParent.rolePath.replace(/\//g, '\\/')}`), { timeout: 15000 })

    await page.goto(`${BASE_URL}/en/customers/${FIXTURES.activeUser.id}`)
    await expect(page.getByRole('button', { name: 'Change BIOS ID' })).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Change BIOS ID' }).click()
    await page.getByPlaceholder(/bios/i).fill(FIXTURES.linkedUser.biosId)

    await expect(page.getByText(`This BIOS ID is linked to username "${FIXTURES.linkedUser.username}" and not this customer.`)).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Apply Change' }).click()
    await expect(page.getByText(`This BIOS ID is linked to username "${FIXTURES.linkedUser.username}" and not this customer.`).nth(0)).toBeVisible()
  })
})
