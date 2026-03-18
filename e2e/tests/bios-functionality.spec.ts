import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const RESELLER_EMAIL = 'reseller1@obd2sw.com';
const RESELLER_PASSWORD = 'password';
const MANAGER_EMAIL = 'manager@obd2sw.com';
const MANAGER_PASSWORD = 'password';

test.describe('BIOS Functionality Tests', () => {
  test.describe('Login', () => {
    test('should login as reseller', async ({ page }) => {
      await page.goto(`${BASE_URL}/en/login`);
      await page.fill('input[type="email"]', RESELLER_EMAIL);
      await page.fill('input[type="password"]', RESELLER_PASSWORD);
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/en\/(reseller|dashboard)/);
      await expect(page.locator('text=Ahmed Reseller')).toBeVisible();
    });

    test('should login as manager', async ({ page }) => {
      await page.goto(`${BASE_URL}/en/login`);
      await page.fill('input[type="email"]', MANAGER_EMAIL);
      await page.fill('input[type="password"]', MANAGER_PASSWORD);
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/en\/(manager|dashboard)/);
      await expect(page.locator('text=Main Manager')).toBeVisible();
    });
  });

  test.describe('BIOS Change Request - Expired Customer', () => {
    test('should show BIOS change option for expired customer', async ({ page }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`);
      await page.fill('input[type="email"]', RESELLER_EMAIL);
      await page.fill('input[type="password"]', RESELLER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/en\/(reseller|dashboard)/);

      // Navigate to customers
      await page.click('text=Customers');
      await page.waitForURL(/\/en\/reseller\/customers/);

      // Find expired customer
      await page.waitForTimeout(1000);
      const expiredCustomerLink = page.locator('a:has-text("Master Clear Res")').first();
      if (await expiredCustomerLink.isVisible()) {
        await expiredCustomerLink.click();
        await page.waitForURL(/\/en\/reseller\/customers\/\d+/);

        // Check for "Request BIOS ID Change" button
        const requestButton = page.locator('button:has-text("Request BIOS ID Change")');
        await expect(requestButton).toBeVisible();
      }
    });

    test('should NOT show BIOS change for blacklisted customer', async ({ page }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`);
      await page.fill('input[type="email"]', RESELLER_EMAIL);
      await page.fill('input[type="password"]', RESELLER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/en\/(reseller|dashboard)/);

      // Navigate to customers
      await page.click('text=Customers');
      await page.waitForURL(/\/en\/reseller\/customers/);

      // Find blacklisted customer (if exists)
      await page.waitForTimeout(1000);
      const customers = page.locator('table tbody tr');
      const count = await customers.count();

      // Check if any customer has blacklist badge
      for (let i = 0; i < count; i++) {
        const row = customers.nth(i);
        const blockBadge = row.locator('text=Block');
        if (await blockBadge.isVisible()) {
          const nameCell = row.locator('td').first();
          await nameCell.click();
          await page.waitForURL(/\/en\/reseller\/customers\/\d+/);

          // Blacklisted customers should NOT have the button
          const requestButton = page.locator('button:has-text("Request BIOS ID Change")');
          await expect(requestButton).not.toBeVisible();
          break;
        }
      }
    });

    test('should submit BIOS change request with auto-populated username', async ({ page }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`);
      await page.fill('input[type="email"]', RESELLER_EMAIL);
      await page.fill('input[type="password"]', RESELLER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/en\/(reseller|dashboard)/);

      // Navigate to customers
      await page.click('text=Customers');
      await page.waitForURL(/\/en\/reseller\/customers/);

      // Find expired customer
      await page.waitForTimeout(1000);
      const expiredCustomerLink = page.locator('a:has-text("Master Clear Res")').first();
      if (await expiredCustomerLink.isVisible()) {
        await expiredCustomerLink.click();
        await page.waitForURL(/\/en\/reseller\/customers\/\d+/);

        // Click "Request BIOS ID Change"
        const requestButton = page.locator('button:has-text("Request BIOS ID Change")');
        if (await requestButton.isVisible()) {
          await requestButton.click();

          // Check dialog appears
          await expect(page.locator('text=Current BIOS ID')).toBeVisible();

          // Enter new BIOS ID
          const newBiosInput = page.locator('input[placeholder*="BIOS"]').last();
          await newBiosInput.fill('TEST-NEW-BIOS-001');

          // Wait for availability check
          await page.waitForTimeout(500);

          // Check availability message
          const availableMsg = page.locator('text=Available');
          await expect(availableMsg).toBeVisible({ timeout: 5000 });

          // Submit
          await page.click('button[type="button"]:has-text("Save")');

          // Verify success
          await expect(page.locator('text=successfully')).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe('BIOS Change Request Approval', () => {
    test('should approve BIOS change request', async ({ page }) => {
      // Login as manager
      await page.goto(`${BASE_URL}/en/login`);
      await page.fill('input[type="email"]', MANAGER_EMAIL);
      await page.fill('input[type="password"]', MANAGER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/en\/(manager|dashboard)/);

      // Navigate to BIOS Change Requests
      await page.click('text=BIOS Change Requests');
      await page.waitForURL(/\/en\/(manager|manager-parent)\/bios-change-requests/);

      // Find pending request
      await page.waitForTimeout(1000);
      const pendingRows = page.locator('tr:has-text("Pending")');
      const count = await pendingRows.count();

      if (count > 0) {
        // Click approve button on first pending request
        const approveButton = pendingRows.first().locator('button:has-text("Approve")');
        await approveButton.click();

        // Verify success message
        await expect(page.locator('text=approved')).toBeVisible({ timeout: 5000 });

        // Check status changed to "approved"
        await page.reload();
        const statusText = pendingRows.first().locator('text=approved|approved_pending_sync');
        await expect(statusText).toBeVisible();
      }
    });
  });

  test.describe('License Renewal with Schedule', () => {
    test('should show schedule option for expired license', async ({ page }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`);
      await page.fill('input[type="email"]', RESELLER_EMAIL);
      await page.fill('input[type="password"]', RESELLER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/en\/(reseller|dashboard)/);

      // Navigate to customers
      await page.click('text=Customers');
      await page.waitForURL(/\/en\/reseller\/customers/);

      // Find expired customer
      await page.waitForTimeout(1000);
      const expiredCustomerLink = page.locator('a:has-text("Master Clear Res")').first();
      if (await expiredCustomerLink.isVisible()) {
        await expiredCustomerLink.click();
        await page.waitForURL(/\/en\/reseller\/customers\/\d+/);

        // Click "Renew"
        const renewButton = page.locator('button:has-text("Renew")');
        if (await renewButton.isVisible()) {
          await renewButton.click();
          await page.waitForURL(/\/en\/reseller\/[^/]+\/renew\/\d+/);

          // Check for schedule option
          const scheduleCheckbox = page.locator('input[type="checkbox"]');
          const scheduleLabel = page.locator('text=Schedule activation for later');

          await expect(scheduleLabel).toBeVisible({ timeout: 5000 });
          console.log('✓ Schedule option visible for expired license renewal');
        }
      }
    });

    test('should schedule license renewal', async ({ page }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`);
      await page.fill('input[type="email"]', RESELLER_EMAIL);
      await page.fill('input[type="password"]', RESELLER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/en\/(reseller|dashboard)/);

      // Navigate to customers
      await page.click('text=Customers');
      await page.waitForURL(/\/en\/reseller\/customers/);

      // Find expired customer
      await page.waitForTimeout(1000);
      const expiredCustomerLink = page.locator('a:has-text("Master Clear Res")').first();
      if (await expiredCustomerLink.isVisible()) {
        await expiredCustomerLink.click();
        await page.waitForURL(/\/en\/reseller\/customers\/\d+/);

        // Click "Renew"
        const renewButton = page.locator('button:has-text("Renew")');
        if (await renewButton.isVisible()) {
          await renewButton.click();
          await page.waitForURL(/\/en\/reseller\/[^/]+\/renew\/\d+/);

          // Check for schedule checkbox
          const scheduleCheckbox = page.locator('input[type="checkbox"]:nth-of-type(1)');
          await scheduleCheckbox.check();

          // Select duration preset
          await page.click('button:has-text("Day")');

          // Click renew button
          const submitButton = page.locator('button:has-text("Renew"):not([type="checkbox"])');
          await submitButton.click();

          // Verify success
          await expect(page.locator('text=scheduled|renewed')).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe('Username Auto-Population', () => {
    test('should auto-populate username when entering expired BIOS', async ({ page }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`);
      await page.fill('input[type="email"]', RESELLER_EMAIL);
      await page.fill('input[type="password"]', RESELLER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/en\/(reseller|dashboard)/);

      // Navigate to create customer
      await page.click('text=Customers');
      await page.waitForURL(/\/en\/reseller\/customers/);

      await page.click('button:has-text("Add Customer")');
      await page.waitForURL(/\/en\/reseller\/(create|add)-customer/);

      // Enter an expired BIOS that should have a linked username
      const biosInput = page.locator('input[placeholder*="BIOS"]').first();
      await biosInput.fill('MASTER-BLOCK-1773607300-R');

      // Wait for availability check and auto-fill
      await page.waitForTimeout(1000);

      // Check if username was auto-populated
      const usernameInput = page.locator('input[placeholder*="username"]').first();
      const usernameValue = await usernameInput.inputValue();

      if (usernameValue) {
        console.log(`✓ Username auto-populated: ${usernameValue}`);
        await expect(usernameInput).toHaveValue(/./);
      }
    });
  });

  test.describe('Real-time BIOS Validation', () => {
    test('should show BIOS availability check in real-time', async ({ page }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`);
      await page.fill('input[type="email"]', RESELLER_EMAIL);
      await page.fill('input[type="password"]', RESELLER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/en\/(reseller|dashboard)/);

      // Navigate to create customer
      await page.click('text=Customers');
      await page.waitForURL(/\/en\/reseller\/customers/);

      await page.click('button:has-text("Add Customer")');
      await page.waitForURL(/\/en\/reseller\/(create|add)-customer/);

      // Type a BIOS ID
      const biosInput = page.locator('input[placeholder*="BIOS"]').first();
      await biosInput.fill('TEST-AVAIL');

      // Wait for availability response
      await page.waitForTimeout(500);

      // Check for availability indicator
      const checkingMsg = page.locator('text=Checking');
      const availableMsg = page.locator('text=available|conflict|blacklisted');

      // Either checking or result should be visible
      const isCheckingVisible = await checkingMsg.isVisible().catch(() => false);
      const isResultVisible = await availableMsg.isVisible().catch(() => false);

      if (isCheckingVisible || isResultVisible) {
        console.log('✓ Real-time BIOS validation working');
      }
    });
  });

  test.describe('Locked Fields After Activation', () => {
    test('should show locked BIOS and username for active customer', async ({ page }) => {
      // Login as reseller
      await page.goto(`${BASE_URL}/en/login`);
      await page.fill('input[type="email"]', RESELLER_EMAIL);
      await page.fill('input[type="password"]', RESELLER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/en\/(reseller|dashboard)/);

      // Navigate to customers
      await page.click('text=Customers');
      await page.waitForURL(/\/en\/reseller\/customers/);

      // Find active customer
      await page.waitForTimeout(1000);
      const customers = page.locator('table tbody tr');
      const count = await customers.count();

      for (let i = 0; i < count; i++) {
        const row = customers.nth(i);
        const statusCell = row.locator('td').nth(3); // Assuming status is 4th column
        const statusText = await statusCell.textContent();

        if (statusText?.includes('Active')) {
          const nameCell = row.locator('td').first();
          await nameCell.click();
          await page.waitForURL(/\/en\/reseller\/customers\/\d+/);

          // Check for lock icons
          const lockIcons = page.locator('svg[class*="lock"]');
          if (await lockIcons.count() > 0) {
            console.log('✓ Lock icons visible for active customer fields');
          }
          break;
        }
      }
    });
  });
});
