import { expect, test } from '@playwright/test'
import { BASE_URL, USERS, loginViaUi } from './helpers/auth'

test('super admin bios history handles recorded, open, and resolved statuses without crashing', async ({ page }) => {
  await page.route('**/api/super-admin/bios-history**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'access-1',
            bios_id: 'BIOS-RECORDED',
            tenant_id: 1,
            tenant: 'OBD2SW Main',
            customer: 'Recorded Customer',
            action: 'pause',
            status: 'recorded',
            description: 'Pause event recorded.',
            occurred_at: '2026-03-29T10:00:00Z',
          },
          {
            id: 'conflict-1',
            bios_id: 'BIOS-OPEN',
            tenant_id: 1,
            tenant: 'OBD2SW Main',
            customer: 'Open Conflict',
            action: 'conflict-username_bios_mismatch',
            status: 'open',
            description: 'Conflict still open.',
            occurred_at: '2026-03-29T09:00:00Z',
          },
          {
            id: 'conflict-2',
            bios_id: 'BIOS-RESOLVED',
            tenant_id: 1,
            tenant: 'OBD2SW Main',
            customer: 'Resolved Conflict',
            action: 'conflict-bios_reused',
            status: 'resolved',
            description: 'Conflict resolved.',
            occurred_at: '2026-03-29T08:00:00Z',
          },
        ],
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 10,
          total: 3,
        },
      }),
    })
  })

  await loginViaUi(page, USERS.superAdmin.email, USERS.superAdmin.dashboard)
  await page.goto(`${BASE_URL}/en/super-admin/bios-history`)

  await expect(page.getByRole('heading', { name: 'BIOS History' })).toBeVisible()
  await expect(page.getByText('Recorded', { exact: true })).toBeVisible()
  await expect(page.getByText('Open', { exact: true })).toBeVisible()
  await expect(page.getByText('Resolved', { exact: true })).toBeVisible()
  await expect(page.getByText('An unexpected error occurred while processing the request.')).toHaveCount(0)
})
