# BIOS ID + Username Global Linking — Playwright Test Suite

This document defines comprehensive test scenarios for the BIOS ID and Username linking system across all roles and tenants.

## Test Setup

**Database**: Fresh test database
**Roles tested**: Reseller, Manager, Manager-Parent, Super-Admin
**Browsers**: Chrome (Chromium)
**Base URL**: http://localhost:3000

### Test Data Setup

Before running test suite, seed test data:

```bash
# Create test tenants
POST /api/tenants { name: "Test Tenant A", slug: "test-a" }
POST /api/tenants { name: "Test Tenant B", slug: "test-b" }

# Create resellers in Tenant A
POST /api/super-admin/team { tenant_id: 1, role: "reseller", name: "Reseller A", email: "reseller-a@test.local" }
POST /api/super-admin/team { tenant_id: 1, role: "reseller", name: "Reseller B", email: "reseller-b@test.local" }

# Create manager in Tenant A
POST /api/super-admin/team { tenant_id: 1, role: "manager", name: "Manager A", email: "manager-a@test.local" }

# Create active program
POST /api/super-admin/programs { name: "Test Program", status: "active", api_key: "test-key" }
```

---

## SCENARIO 1: Active BIOS blocked globally

**Objective**: Verify that an active BIOS ID in one reseller blocks another reseller from using the same BIOS.

**Steps**:
1. Login as Reseller A (Tenant A)
2. Navigate to `/en/reseller/customers/create`
3. Fill form:
   - Username: `test_user_001`
   - BIOS ID: `global_bios_001`
   - Program: "Test Program"
   - Duration: 30 days
4. Submit → Activate license
5. Verify: Customer created, license active
6. Logout, login as Reseller B (same Tenant A)
7. Navigate to `/en/reseller/customers/create`
8. Fill form:
   - Username: `test_user_002`
   - BIOS ID: `global_bios_001` (same BIOS)
   - Program: "Test Program"
   - Duration: 30 days
9. Type BIOS ID slowly, wait 400ms after typing stops
10. Expected: Real-time error appears under BIOS ID field: "✗ BIOS ID is already working with another reseller"
11. Expected: Submit button disabled
12. Try typing different BIOS: `global_bios_002`
13. Expected: After 400ms, check shows "✓ BIOS ID is available"

**Assertion**:
```javascript
await expect(page.locator('[data-testid="bios-conflict-error"]')).toBeVisible();
await expect(page.locator('button[type="submit"]')).toBeDisabled();
```

---

## SCENARIO 2: Expired BIOS reuse — same reseller, username auto-populated

**Objective**: Verify that when a BIOS expires, the same reseller can reuse it with auto-filled username.

**Steps**:
1. Login as Reseller A (Tenant A)
2. Create customer with:
   - Username: `expired_test_user`
   - BIOS ID: `expired_bios_001`
   - Program: "Test Program"
   - Duration: 1 minute (or manipulate `expires_at` in DB to be in past)
3. Wait for license to expire (or fast-forward DB)
4. Create new customer:
   - Username field left blank
   - BIOS ID: `expired_bios_001` (same BIOS)
   - Program: "Test Program"
5. Type BIOS ID slowly
6. After 400ms: Expected check shows "✓ BIOS ID is available" + username field auto-fills with `expired_test_user`
7. Username field shows hint: "Username auto-filled from BIOS history"
8. Username field is read-only (cannot edit)
9. Submit form → Activate
10. Expected: Success, new customer created with same username

**Assertion**:
```javascript
await expect(page.locator('input[id="customer-name"]')).toHaveValue('expired_test_user');
await expect(page.locator('input[id="customer-name"]')).toBeDisabled();
await expect(page.locator('[data-testid="bios-linked-hint"]')).toContainText('auto-filled');
```

---

## SCENARIO 3: Expired BIOS reuse — different reseller, username auto-populated

**Objective**: Verify that when BIOS from Reseller A's expired customer is used by Reseller B, username transfers.

**Steps**:
1. Login as Reseller A
2. Create customer:
   - Username: `cross_user_001`
   - BIOS ID: `cross_bios_001`
   - Duration: 1 minute (expire it)
3. Wait for expiry
4. Logout, login as Reseller B (same tenant or different tenant)
5. Create customer:
   - BIOS ID: `cross_bios_001`
6. Type BIOS ID
7. After 400ms: Expected "✓ Available" + username auto-fills with `cross_user_001`
8. Submit and activate
9. Expected: Reseller B's customer created with inherited username `cross_user_001`

**Assertion**:
```javascript
const biosCheck = await page.locator('[data-testid="bios-check-result"]').textContent();
expect(biosCheck).toContain('Available');
await expect(page.locator('input[id="customer-name"]')).toHaveValue('cross_user_001');
```

---

## SCENARIO 4: Concurrent pending BIOS conflict

**Objective**: Verify that a pending (not yet activated) BIOS also blocks other resellers.

**Steps**:
1. Login as Reseller A
2. Create customer with BIOS `pending_bios_001` (save as pending, don't activate)
3. Logout, login as Reseller B
4. Try to create customer with same BIOS `pending_bios_001`
5. Type BIOS ID
6. Expected: After 400ms, error shows "✗ BIOS ID is already working with another reseller"
7. Expected: Submit button disabled
8. Logout, login as Reseller A
9. Activate the pending customer
10. Logout, login as Reseller B
11. Try again with same BIOS
12. Expected: Still blocked (now it's active, not pending)

**Assertion**:
```javascript
await expect(page.locator('[data-testid="bios-conflict-error"]')).toBeVisible();
await expect(page.locator('button[type="submit"]')).toBeDisabled();
```

---

## SCENARIO 5: BIOS case-insensitivity

**Objective**: Verify that BIOS IDs are case-insensitive globally.

**Steps**:
1. Reseller A activates BIOS `CASE_TEST_BIOS` (uppercase)
2. Reseller B tries to create with BIOS `case_test_bios` (lowercase)
3. Type BIOS: `case_test_bios`
4. Expected: After 400ms, conflict error appears (case-insensitive match)
5. Try uppercase variant `CASE_TEST_BIOS`
6. Expected: Same conflict error
7. Try different: `case_test_bios_002`
8. Expected: "✓ Available"

**Assertion**:
```javascript
// Lowercase input
await page.fill('input[id="bios-id"]', 'case_test_bios');
await page.waitForTimeout(500);
const errorLower = await page.locator('[data-testid="bios-conflict-error"]').isVisible();
expect(errorLower).toBe(true);

// Different BIOS
await page.fill('input[id="bios-id"]', 'case_test_bios_002');
await page.waitForTimeout(500);
const availableDiff = await page.locator('[data-testid="bios-check-available"]').isVisible();
expect(availableDiff).toBe(true);
```

---

## SCENARIO 6: Username globally unique when active

**Objective**: Verify that a username can only be active once globally.

**Steps**:
1. Reseller A creates customer with username `shared_username_001`
2. Activate it
3. Logout, login as Reseller B (same or different tenant)
4. Try to create customer with same username `shared_username_001`
5. Fill BIOS: `unique_bios_002`
6. Fill username: `shared_username_001`
7. Click away from username field or wait 400ms
8. Expected: Username check error appears: "✗ Username is already active with another customer"
9. Change username to `shared_username_002`
10. Wait 400ms
11. Expected: "✓ Username is available"

**Assertion**:
```javascript
await page.fill('input[id="customer-name"]', 'shared_username_001');
await page.waitForTimeout(500);
const usernameTakenError = await page.locator('[data-testid="username-taken-error"]').isVisible();
expect(usernameTakenError).toBe(true);

// Different username
await page.fill('input[id="customer-name"]', 'shared_username_002');
await page.waitForTimeout(500);
const usernameAvailable = await page.locator('[data-testid="username-available"]').isVisible();
expect(usernameAvailable).toBe(true);
```

---

## SCENARIO 7: BIOS Change Request — username link transfers

**Objective**: Verify that when a BIOS change request is approved, the username link transfers to the new BIOS.

**Steps**:
1. Reseller A creates and activates:
   - Username: `link_transfer_user`
   - BIOS: `old_link_bios`
   - Program: "Test Program"
2. Reseller A navigates to customer detail
3. Clicks "Request BIOS Change"
4. Enters new BIOS: `new_link_bios`
5. Submits request
6. Logout, login as Manager A
7. Navigate to "BIOS Change Requests"
8. Find request for `old_link_bios` → `new_link_bios`
9. Click "Approve"
10. Expected: Request status changes to "Approved"
11. Logout, login as Reseller B
12. Try to create customer with old BIOS `old_link_bios`
13. Type it
14. Expected: After 400ms, "✓ Available" (link removed from old BIOS)
15. Try with new BIOS `new_link_bios`
16. Expected: After 400ms, "✗ BIOS ID is already working with another reseller" (link transferred, still active)

**Assertion**:
```javascript
// Old BIOS available after link transfer
await page.fill('input[id="bios-id"]', 'old_link_bios');
await page.waitForTimeout(500);
const oldBiosAvailable = await page.locator('[data-testid="bios-check-available"]').isVisible();
expect(oldBiosAvailable).toBe(true);

// New BIOS still blocked
await page.fill('input[id="bios-id"]', 'new_link_bios');
await page.waitForTimeout(500);
const newBiosBlocked = await page.locator('[data-testid="bios-conflict-error"]').isVisible();
expect(newBiosBlocked).toBe(true);
```

---

## SCENARIO 8: Manager full override — approve pending customer

**Objective**: Verify that a manager can approve and activate a pending customer created by a reseller.

**Steps**:
1. Reseller A creates customer with BIOS `manager_override_bios` (save pending, don't activate)
2. Logout, login as Manager A
3. Navigate to `/en/manager/customers`
4. Find customer created by Reseller A
5. Click customer or "Activate" button
6. Verify: Customer detail shows "Pending" status
7. Click "Activate License"
8. Fill activation form (should pre-populate from pending data)
9. Submit
10. Expected: License activates successfully
11. Logout, login as Reseller A
12. Navigate to same customer
13. Expected: Status changed to "Active"

**Assertion**:
```javascript
// Manager view
await page.goto('/en/manager/customers');
const customerRow = page.locator('text=Manager override customer');
await expect(customerRow).toContainText('Pending');

// Activate as manager
await page.locator('button:has-text("Activate")').first().click();
await page.fill('input[id="duration-value"]', '30');
await page.locator('button[type="submit"]:has-text("Activate")').click();
await expect(page.locator('text=activated successfully')).toBeVisible();

// Verify in reseller view
await page.goto('/en/reseller/customers');
await expect(customerRow).toContainText('Active');
```

---

## SCENARIO 9: Super-admin force-activate

**Objective**: Verify that super-admin can force-activate a BIOS, deactivating the old license.

**Steps**:
1. Reseller A has active license:
   - BIOS: `force_activate_bios`
   - Status: "Active"
2. Logout, login as Super-Admin
3. Navigate to `/en/super-admin/customers/create`
4. Create and activate new customer with:
   - BIOS: `force_activate_bios` (same BIOS)
   - Program: "Test Program"
5. Expected: Normally would get error, but super-admin has force-activate option
6. Click "Force Activate" or similar override button
7. Expected: New license activates
8. Logout, login as Reseller A
9. Find the original customer with same BIOS
10. Expected: License status changed to "Cancelled" (deactivated)

**Note**: Force-activate endpoint depends on implementation. This scenario may need UI button or dedicated endpoint.

**Assertion**:
```javascript
// Super-admin activates same BIOS
const originalLicenseId = 123; // from setup
await page.goto('/en/super-admin/customers/create');
// ... fill form with force_activate_bios ...
// POST /api/super-admin/licenses/force-activate or similar
const response = await page.request.post('/api/super-admin/licenses/force-activate', {
  data: { bios_id: 'force_activate_bios', program_id: 1 },
});
expect(response.ok()).toBe(true);

// Old license cancelled
const oldLicense = await page.goto(`/api/licenses/${originalLicenseId}`);
const status = (await oldLicense.json()).data.status;
expect(status).toBe('cancelled');
```

---

## SCENARIO 10: Locked fields after activation

**Objective**: Verify that BIOS ID and username fields are locked (read-only) after activation.

**Steps**:
1. Reseller A creates and activates customer with:
   - Username: `lock_test_user`
   - BIOS: `lock_test_bios`
2. Navigate to customer detail page
3. Click "Edit" or view customer details
4. Expected: BIOS ID field is read-only (disabled, grayed out)
5. Expected: Username field is read-only (disabled, grayed out)
6. Expected: Lock icon appears next to both fields
7. Expected: Tooltip on lock icon: "Locked after activation — use BIOS Change Request to update BIOS ID"
8. Try to click and edit field: expected no change
9. Verify: Only BIOS Change Request can modify BIOS

**Assertion**:
```javascript
await page.goto('/en/reseller/customers/lock-test-customer-id');
const biosField = page.locator('input[id="bios-id"]');
const usernameField = page.locator('input[id="customer-name"]');

// Fields disabled
await expect(biosField).toBeDisabled();
await expect(usernameField).toBeDisabled();

// Lock icons visible
await expect(page.locator('svg.lock-icon')).toHaveCount(2);

// Hover lock icon for tooltip
await page.locator('svg.lock-icon').first().hover();
await expect(page.locator('[role="tooltip"]')).toContainText('Locked after activation');
```

---

## SCENARIO 11: Real-time validation UX

**Objective**: Verify debouncing, spinners, and status indicators work correctly during typing.

**Steps**:
1. Navigate to customer create page
2. Focus on BIOS ID input
3. Type character by character: `r` → `e` → `a` → `l` → `_` → `t` → `i` → `m` → `e` (9 keystrokes)
4. Expected: No validation fires until 400ms after last keystroke
5. After 400ms: "Checking..." spinner appears
6. Wait for API response
7. Expected: Spinner disappears, status indicator appears
   - If available: "✓ BIOS ID is available" (green)
   - If taken: "✗ BIOS ID is already working with another reseller" (red)
8. Type more characters: clear and type new BIOS
9. Expected: Spinner appears again after 400ms of inactivity
10. Status indicator updates with new check result

**Assertion**:
```javascript
const biosInput = page.locator('input[id="bios-id"]');

// Type slowly without waiting (no validation)
for (const char of ['r', 'e', 'a', 'l']) {
  await biosInput.type(char, { delay: 50 });
}
const spinnerBefore = page.locator('[data-testid="bios-checking"]');
await expect(spinnerBefore).not.toBeVisible();

// Wait for debounce + API
await page.waitForTimeout(600);
const spinnerAfter = page.locator('[data-testid="bios-checking"]');
await expect(spinnerAfter).toBeVisible({ timeout: 100 }).then(() =>
  expect(spinnerAfter).not.toBeVisible({ timeout: 2000 })
);

// Result visible
const result = page.locator('[data-testid="bios-check-result"]');
await expect(result).toBeVisible();
```

---

## SCENARIO 12: Arabic RTL — all new UI elements

**Objective**: Verify all new BIOS linking UI elements render correctly in Arabic RTL mode.

**Steps**:
1. Navigate to `/ar/reseller/customers/create`
2. Verify page direction: `html { dir: rtl; }`
3. Verify layout:
   - BIOS ID input on right side (form items RTL-aligned)
   - Label on right of input
   - Status indicators on right below input
   - Lock icon on correct side (right end of field when locked)
4. Type BIOS ID (e.g., `ar_bios_test`)
5. After 400ms, verify status message appears in Arabic:
   - Checking: "جارٍ التحقق من توفر BIOS..."
   - Available: "معرف BIOS متاح"
   - Conflict: "معرف BIOS يعمل بالفعل مع موزع آخر"
   - Username auto-filled hint: "تم ملء اسم المستخدم تلقائياً من سجل BIOS"
6. Verify RTL text alignment (text right-aligned, not left)
7. Fill form and submit
8. Verify success toast in Arabic

**Assertion**:
```javascript
await page.goto('/ar/reseller/customers/create');

// RTL direction
const htmlDir = await page.locator('html').getAttribute('dir');
expect(htmlDir).toBe('rtl');

// Status messages in Arabic
await page.fill('input[id="bios-id"]', 'ar_bios_001');
await page.waitForTimeout(500);
const statusText = await page.locator('[data-testid="bios-check-result"]').textContent();
expect(statusText).toMatch(/جارٍ|متاح|يعمل/); // Contains Arabic text

// Verify text direction (CSS check)
const statusElement = page.locator('[data-testid="bios-check-result"]');
const direction = await statusElement.evaluate((el) => window.getComputedStyle(el).direction);
expect(direction).toBe('rtl');
```

---

## Test Execution

### Running All Tests

```bash
npx playwright test tests/bios-username-linking.spec.ts
```

### Running Specific Scenario

```bash
npx playwright test tests/bios-username-linking.spec.ts -g "SCENARIO 1"
```

### Debug Mode

```bash
npx playwright test tests/bios-username-linking.spec.ts --debug
```

### With Headed Browser

```bash
npx playwright test tests/bios-username-linking.spec.ts --headed
```

---

## Cleanup

After tests, verify test data is cleaned:

```bash
DELETE /api/super-admin/customers (all test customers)
DELETE /api/super-admin/users (all test users)
```

Or restore database from snapshot.

---

## Known Issues & Workarounds

**Issue 1**: Debounce timing may vary if API is slow
- **Workaround**: Add `await page.waitForLoadState('networkidle')` after typing

**Issue 2**: Arabic locale may not load immediately
- **Workaround**: Pre-load `/ar/` page before test or add `waitForLoadState`

**Issue 3**: Lock icon may not appear if CSS not loaded
- **Workaround**: Add `await page.waitForLoadState('networkidle')` before lock icon check

---

## Test Maintenance

- Update test data setup if database schema changes
- Add new scenarios when new BIOS linking features are added
- Verify translations match `en.json` and `ar.json` updates
- Review debounce timing if API performance changes
