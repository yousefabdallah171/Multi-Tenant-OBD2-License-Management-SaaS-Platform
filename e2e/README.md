# E2E Tests for BIOS Functionality

This directory contains comprehensive end-to-end tests using Playwright to verify all BIOS management features.

## Features Tested

### 1. Login
- ✅ Login as Reseller
- ✅ Login as Manager

### 2. BIOS Change Request (Expired Customers)
- ✅ Show BIOS change option for expired customer
- ✅ Hide BIOS change for blacklisted customer
- ✅ Submit BIOS change request with auto-populated username
- ✅ Real-time availability check shows "Available" status

### 3. BIOS Change Request Approval
- ✅ Manager can approve BIOS change request
- ✅ Status updates to "approved" or "approved_pending_sync"
- ✅ BIOS ID is updated in database

### 4. License Renewal with Schedule
- ✅ Show "Schedule activation for later" option for expired licenses
- ✅ Allow scheduling license renewal
- ✅ Duration presets working (2 Hours, Day, Week, Month)

### 5. Username Auto-Population
- ✅ When entering expired BIOS, username auto-populates from history
- ✅ Username field shows "Auto-filled from BIOS history" hint
- ✅ Field is locked/disabled when auto-filled

### 6. Real-time BIOS Validation
- ✅ Shows "Checking..." while verifying BIOS
- ✅ Shows "Available" or error message after check
- ✅ Real-time response for blocked BIOS IDs
- ✅ Real-time response for blacklisted BIOS IDs

### 7. Locked Fields After Activation
- ✅ Active customer's BIOS ID field shows lock icon
- ✅ Active customer's username field shows lock icon
- ✅ Tooltip says "Locked after activation"

## Installation

The Playwright test suite is already installed. No additional setup required.

## Running Tests

### Run all tests in headless mode
```bash
npm test
```

### Run tests with UI (visual mode)
```bash
npm run test:ui
```

### Run tests in debug mode
```bash
npm run test:debug
```

### View test report
```bash
npm run test:report
```

### Run specific test file
```bash
npx playwright test e2e/tests/bios-functionality.spec.ts
```

### Run specific test case
```bash
npx playwright test -g "should show BIOS change option for expired customer"
```

## Configuration

The tests are configured in `playwright.config.ts`:

- **Browser**: Chrome (Chromium)
- **Base URL**: http://localhost:3000
- **Screenshots**: On failure
- **Videos**: On failure
- **Traces**: On first retry

## Test Data Requirements

The tests assume the following users and customers exist:

### Users
- **Reseller**: reseller1@obd2sw.com / password
- **Manager**: manager@obd2sw.com / password

### Customers
- **Expired Customer**: "Master Clear Res" with BIOS "MASTER-BLOCK-1773607300-R"
- **Active Customer**: Any active customer for testing locked fields
- **Blacklisted Customer** (optional): A customer with a blocked BIOS

## Expected Results

All tests should pass with the following behavior:

✅ **BIOS Availability Check**
- Active BIOS → Shows "already working with another reseller"
- Expired BIOS → Shows "Available"
- Blacklisted BIOS → Shows "blacklisted"

✅ **BIOS Change for Expired Customer**
- Status changes to "approved"
- BIOS ID is updated in database
- Username link is transferred to new BIOS

✅ **Renewal Scheduling**
- Expired licenses can be scheduled
- Schedule option appears in renewal form
- Renewal successfully completes with scheduled date

✅ **Username Auto-Fill**
- Works for expired BIOS (cross-reseller)
- Field becomes disabled/read-only
- Hint text appears

## Troubleshooting

### Tests fail with "Cannot find element"
- Ensure the test data (users, customers) exist in the database
- Check that the frontend is running on port 3000
- Check that the backend is running on port 8000

### Tests timeout
- Increase timeout in playwright.config.ts
- Check if services are responding slowly
- Run `npm run test:debug` to see what's happening

### Authentication fails
- Verify user credentials are correct
- Check that the login page is accessible
- Ensure backend is processing login requests

## Continuous Integration

These tests can be run in CI/CD pipelines:

```bash
CI=true npm test
```

This will:
- Retry failed tests up to 2 times
- Run tests serially (one at a time)
- Collect screenshots and videos for debugging
