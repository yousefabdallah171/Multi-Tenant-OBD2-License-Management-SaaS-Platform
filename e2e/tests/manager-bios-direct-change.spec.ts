import { test, expect } from '@playwright/test';

const MANAGER_EMAIL = 'manager2@obd2sw.com';
const MANAGER_PASSWORD = 'manager2@obd2sw.com';

test('manager can direct-change BIOS ID from request page', async ({ page }) => {
  await page.goto('/en/login');
  await page.fill('input[type="email"]', MANAGER_EMAIL);
  await page.fill('input[type="password"]', MANAGER_PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/en\/(manager|dashboard)/);

  await page.goto('/en/manager/customers/49/request-bios-change');
  await expect(page.getByRole('heading', { name: 'Change BIOS ID', exact: true })).toBeVisible();

  const newBiosId = `m${Date.now().toString().slice(-8)}`;
  const biosInput = page.getByPlaceholder('Enter the new BIOS ID');
  await biosInput.fill(newBiosId);

  await expect(page.locator('text=ok Available')).toBeVisible();

  const responsePromise = page.waitForResponse((response) => {
    return response.url().includes('/api/manager/bios-change-requests/direct')
      && response.request().method() === 'POST';
  });

  await page.getByRole('button', { name: 'Apply Change' }).click();
  const response = await responsePromise;

  const status = response.status();
  const bodyText = await response.text();

  if (status !== 200) {
    throw new Error(`BIOS direct-change failed with ${status}: ${bodyText}`);
  }
});
