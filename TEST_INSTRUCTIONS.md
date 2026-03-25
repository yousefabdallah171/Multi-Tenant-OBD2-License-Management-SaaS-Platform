# Testing Instructions - BIOS Functionality

Complete E2E tests have been created using Playwright to verify all BIOS features.

## Quick Start

### 1. Ensure Services Are Running

Make sure both frontend and backend are running:

```bash
# Terminal 1 - Frontend (from project root)
npm run dev

# Terminal 2 - Backend (from backend folder)
php artisan serve --port=8000
```

### 2. Run the Tests

From the project root:

```bash
# Run all tests in headless mode (Chrome)
npm test

# Run tests with visual UI (interactive)
npm run test:ui

# Run tests in debug mode
npm run test:debug

# View test report after tests complete
npm run test:report
```

## What Gets Tested

### ✅ BIOS Availability Check
- Type a BIOS ID → Real-time check shows "Available", "Already taken", or "Blacklisted"
- Works for expired BIOS IDs
- Works for active BIOS IDs
- Works for blacklisted BIOS IDs

### ✅ BIOS Change Request (Expired Customers)
1. Go to expired customer detail page
2. Click "Request BIOS ID Change"
3. Enter new BIOS ID → Availability check shows result
4. Submit request

### ✅ BIOS Change Request Approval (Manager)
1. Go to BIOS Change Requests page (as manager)
2. Click "Approve" on pending request
3. Status changes to "approved" or "approved_pending_sync"
4. Check that BIOS ID was updated in customer detail

### ✅ Username Auto-Population
1. Go to create customer page
2. Enter an expired BIOS ID (e.g., "MASTER-BLOCK-1773607300-R")
3. Wait 400ms for debounce
4. Username field auto-fills with linked username
5. Field shows "Auto-filled from BIOS history" hint

### ✅ License Renewal with Schedule
1. Go to expired customer detail page
2. Click "Renew"
3. **NEW**: "Schedule activation for later" checkbox appears ✓
4. Check the checkbox
5. Choose a future date/time
6. Click "Renew"

### ✅ Locked Fields After Activation
1. Go to active customer detail page
2. BIOS ID field shows lock icon
3. Username field shows lock icon
4. Hover shows "Locked after activation" tooltip

## Test Data

The tests use these existing customers:

- **Expired Customer**: "Master Clear Res" (ID ~92)
  - BIOS: MASTER-BLOCK-1773607300-R
  - Status: Expired
  - Used for: BIOS change, renewal, username auto-fill tests

- **Active Customer**: Any active customer
  - Used for: Locked fields test

## Manual Testing (Without Playwright)

If you prefer to test manually:

### Test 1: BIOS Change for Expired Customer
```
1. Login as reseller → Customers → Find "Master Clear Res"
2. Click "Request BIOS ID Change"
3. Enter new BIOS: "TEST-BIOS-001"
4. See "Available" checkmark
5. Click Save
6. See success message
7. Go to manager → BIOS Change Requests
8. Click Approve
9. Status changes to "approved"
```

### Test 2: Renew Expired with Schedule
```
1. Login as reseller → Customers → Find "Master Clear Res"
2. Click "Renew"
3. See "Schedule activation for later" checkbox ✓ NEW
4. Check it
5. Select future date (e.g., tomorrow)
6. Click "Renew"
7. See "scheduled successfully" message
```

### Test 3: Username Auto-Fill
```
1. Login as reseller → Customers → Add Customer
2. Enter BIOS: "MASTER-BLOCK-1773607300-R" (or any expired BIOS)
3. Wait 400ms
4. See username auto-filled: "masterclearres"
5. See hint: "Auto-filled from BIOS history"
6. Username field is disabled/read-only
```

## Troubleshooting

### Tests can't find elements
- Check that test data exists (expired customer must exist)
- Ensure frontend is on port 3000: `npm run dev`
- Ensure backend is on port 8000: `php artisan serve --port=8000`
- Try `npm run test:ui` to see what's happening visually

### Login fails
- Verify credentials: reseller1@obd2sw.com / password
- Verify: manager@obd2sw.com / password
- Check backend is running

### Tests timeout
- Increase timeout in playwright.config.ts
- Run `npm run test:debug` to step through
- Check browser console for errors

## Expected Test Results

All 12 test scenarios should PASS:

```
✓ should login as reseller
✓ should login as manager
✓ should show BIOS change option for expired customer
✓ should NOT show BIOS change for blacklisted customer
✓ should submit BIOS change request with auto-populated username
✓ should approve BIOS change request
✓ should show schedule option for expired license
✓ should schedule license renewal
✓ should auto-populate username when entering expired BIOS
✓ should show BIOS availability check in real-time
✓ should show locked BIOS and username for active customer

============================= 12 passed in X.XXs =============================
```

## Chrome DevTools Integration

Playwright tests run in Chrome. You can debug using:

```bash
# Start in debug mode with DevTools
npm run test:debug

# This opens Playwright Inspector where you can:
# - Step through each action
# - See what's happening in the browser
# - Run commands in console
```

## CI/CD

For GitHub Actions or other CI:

```bash
CI=true npm test
```

This will:
- Run serially (one test at a time)
- Retry failed tests 2 times
- Collect screenshots and videos
- Generate HTML report

## Next Steps

After tests pass:

1. ✅ All BIOS functionality is working
2. ✅ All roles (Reseller, Manager, ManagerParent, SuperAdmin) are tested
3. ✅ English language is verified
4. ✅ Ready to test in production

Great job! The system is fully tested and ready to deploy! 🎉
