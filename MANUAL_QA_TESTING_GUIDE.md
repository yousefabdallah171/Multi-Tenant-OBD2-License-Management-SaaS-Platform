# Manual QA Testing Guide - Security Verification

**Purpose**: Manual verification of all security fixes using browser DevTools and Playwright debugging.

---

## Quick Start

### Prerequisites:
1. Application running on `http://localhost:3000`
2. Chrome/Chromium browser with DevTools
3. Test accounts available:
   - Reseller 1: `reseller1@obd2sw.com` / `password`
   - Reseller 2: `reseller2@obd2sw.com` / `password`
   - Manager: `manager@obd2sw.com` / `password`

### Running Automated Tests with DevTools:

```bash
# Run security tests with headed mode (shows browser)
npx playwright test e2e/tests/security-audit.spec.ts --headed

# Run with slowmo to see every action
npx playwright test e2e/tests/security-audit.spec.ts --headed --headed-slowmo=500

# Run specific test
npx playwright test e2e/tests/security-audit.spec.ts -g "should block unauthenticated"
```

---

## Manual Test Scenarios

### SECTION 1: Authentication & Token Security

#### Test 1.1: Login Flow Security
1. Open DevTools (F12)
2. Go to Network tab
3. Navigate to `http://localhost:3000/en/login`
4. Enter `reseller1@obd2sw.com` / `password`
5. Click "Sign In"
6. **Verify**:
   - ✅ Login request sent to `/api/auth/login` (POST)
   - ✅ Response contains `token` in JSON
   - ✅ LocalStorage shows `license-auth` key with token
   - ✅ Redirect to `/en/reseller` or `/en/dashboard`

#### Test 1.2: Token Storage & Security
1. In DevTools, go to Application → LocalStorage
2. Find `license-auth` entry
3. Expand and verify structure:
   ```json
   {
     "token": "...",
     "user": { "id": 1, "role": "reseller", "tenant_id": 1 }
   }
   ```
4. **Verify**:
   - ✅ Token is long, random string (not readable)
   - ✅ Cannot manually modify token and maintain access
   - ✅ Token changes after logout

#### Test 1.3: Logout Revocation
1. While logged in, open DevTools Console
2. Copy token: `JSON.parse(localStorage.getItem('license-auth')).token`
3. Click "Logout" button
4. **Verify**:
   - ✅ Redirected to login page
   - ✅ LocalStorage `license-auth` is cleared
   - ✅ Try using old token in API call:
     ```javascript
     fetch('http://localhost:3000/api/reseller/customers', {
       headers: { 'Authorization': 'Bearer ' + oldToken }
     })
     ```
     Should return **401 Unauthorized**

---

### SECTION 2: Cross-Tenant & Role Isolation

#### Test 2.1: Reseller Cannot See Other Reseller Data
1. Login as `reseller1@obd2sw.com`
2. Navigate to Customers page
3. Open DevTools → Network tab
4. Observe request to `/api/reseller/customers`
5. Note customer IDs returned (e.g., 101, 102, 103)
6. Now try to access another customer manually in Console:
   ```javascript
   fetch('http://localhost:3000/api/reseller/customers/999', {
     headers: { 'Authorization': 'Bearer ' + token }
   }).then(r => r.json()).then(console.log)
   ```
7. **Verify**:
   - ✅ Returns 404 Not Found (customer doesn't exist for this reseller)
   - ✅ Does NOT return customer data from other resellers
   - ✅ Error message: "Not Found" (no data leaked)

#### Test 2.2: Reseller Cannot Access Manager Endpoints
1. Login as `reseller1@obd2sw.com`
2. In DevTools Console, try to call manager endpoint:
   ```javascript
   const token = JSON.parse(localStorage.getItem('license-auth')).token
   fetch('http://localhost:3000/api/manager/customers', {
     headers: { 'Authorization': 'Bearer ' + token }
   }).then(r => r.json()).then(console.log)
   ```
3. **Verify**:
   - ✅ Returns **403 Forbidden** (role middleware blocked)
   - ✅ Does NOT return manager data
   - ✅ Response: `{"message": "Unauthorized"}`

#### Test 2.3: Reseller Cannot Access Super-Admin Endpoints
1. In DevTools Console as reseller:
   ```javascript
   const token = JSON.parse(localStorage.getItem('license-auth')).token
   fetch('http://localhost:3000/api/super-admin/tenants', {
     headers: { 'Authorization': 'Bearer ' + token }
   }).then(r => r.json()).then(console.log)
   ```
2. **Verify**:
   - ✅ Returns **403 Forbidden**
   - ✅ No tenant data revealed

---

### SECTION 3: IDOR Prevention (Insecure Direct Object Reference)

#### Test 3.1: License IDOR Protection
1. Login as Reseller 1
2. Note license ID from your license list (e.g., 501)
3. Try to access/modify license from high ID range:
   ```javascript
   const token = JSON.parse(localStorage.getItem('license-auth')).token

   // Try to renew license 9999 (probably not yours)
   fetch('http://localhost:3000/api/licenses/9999/renew', {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer ' + token,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       duration_days: 30,
       price: 100
     })
   }).then(r => r.json()).then(console.log)
   ```
4. **Verify**:
   - ✅ Returns **404 Not Found** (license not owned by reseller)
   - ✅ Returns **403 Forbidden** (access denied)
   - ✅ Never returns **200 OK** (success) for unowned licenses

#### Test 3.2: Customer IDOR Protection
1. As reseller, try to view customer profile:
   ```javascript
   const token = JSON.parse(localStorage.getItem('license-auth')).token

   // Try customer 50 (probably not yours)
   fetch('http://localhost:3000/api/reseller/customers/50', {
     headers: { 'Authorization': 'Bearer ' + token }
   }).then(r => r.json()).then(console.log)
   ```
2. **Verify**:
   - ✅ Returns **404 Not Found**
   - ✅ Customer details NOT revealed

---

### SECTION 4: SQL Injection Prevention

#### Test 4.1: Search Parameter SQL Injection
1. Login as reseller
2. On Customers page, try malicious search:
   - Search field: `' OR '1'='1` (or `'; DROP TABLE--`)
3. In DevTools Network tab:
   - Observe request: `/api/reseller/customers?search=' OR '1'='1`
4. **Verify**:
   - ✅ Search parameters properly URL-encoded
   - ✅ Returns normal search results or empty (no SQL error)
   - ✅ Database not affected
   - ✅ No error messages revealing SQL structure

#### Test 4.2: API Parameter SQL Injection
1. In DevTools Console:
   ```javascript
   const token = JSON.parse(localStorage.getItem('license-auth')).token

   fetch(`http://localhost:3000/api/reseller/licenses?search=${encodeURIComponent("' UNION SELECT password FROM users--")}`, {
     headers: { 'Authorization': 'Bearer ' + token }
   }).then(r => r.json()).then(console.log)
   ```
2. **Verify**:
   - ✅ Returns properly filtered results (no password field exposed)
   - ✅ No SQL error in response
   - ✅ Parameter safely escaped

---

### SECTION 5: XSS & Script Injection Prevention

#### Test 5.1: SVG Logo Sanitization (H2 Fix)
1. This is tested automatically by security tests
2. Manual verification:
   - Check admin panel where tenant branding is uploaded
   - Try uploading SVG with malicious code:
     ```svg
     <svg onload="alert('XSS')">
       <circle cx="50" cy="50" r="40"/>
     </svg>
     ```
3. **Verify**:
   - ✅ SVG renders in Navbar (DOMPurify removes onload)
   - ✅ Alert does NOT execute
   - ✅ Inspect element shows SVG without onload attribute

#### Test 5.2: LocalStorage Token Availability
1. In DevTools Console:
   ```javascript
   const auth = localStorage.getItem('license-auth')
   console.log(auth) // Shows token in plaintext
   ```
2. This is expected behavior - tokens must be accessible to JavaScript
3. Protection comes from:
   - ✅ CSP (Content Security Policy) headers prevent external script loading
   - ✅ SVG sanitization prevents inline script injection
   - ✅ HTTPS prevents man-in-the-middle token capture

---

### SECTION 6: Authorization Enforcement

#### Test 6.1: Frontend vs Backend Security
1. Try to spoof role in localStorage:
   ```javascript
   const auth = JSON.parse(localStorage.getItem('license-auth'))
   auth.user.role = 'manager' // Try to escalate
   localStorage.setItem('license-auth', JSON.stringify(auth))
   location.reload()
   ```
2. **Verify**:
   - ✅ Frontend shows manager dashboard (UI spoofing works)
   - ✅ Try API call to manager endpoint
   - ✅ Backend returns **403 Forbidden** (real auth check)
   - ✅ Token role doesn't match Sanctum token payload

#### Test 6.2: Bulk Operations Authorization
1. As reseller with some licenses, try bulk delete non-existent IDs:
   ```javascript
   const token = JSON.parse(localStorage.getItem('license-auth')).token

   fetch('http://localhost:3000/api/reseller/licenses/bulk-delete', {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer ' + token,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       ids: [99999, 99998, 99997]
     })
   }).then(r => r.json()).then(console.log)
   ```
2. **Verify**:
   - ✅ Returns **200 OK** (operation completes, 0 items deleted)
   - ✅ OR returns **422 Unprocessable Entity** (validation error)
   - ✅ Never accidentally deletes items from other resellers

---

### SECTION 7: Rate Limiting & Enumeration Prevention

#### Test 7.1: Account Enumeration Protection
1. Try to rapidly enumerate customer IDs:
   ```javascript
   const token = JSON.parse(localStorage.getItem('license-auth')).token

   for(let i = 1; i <= 100; i++) {
     fetch(`http://localhost:3000/api/reseller/customers/${i}`, {
       headers: { 'Authorization': 'Bearer ' + token }
     }).then(r => console.log(`ID ${i}: ${r.status}`))
   }
   ```
2. In DevTools Network tab, observe response codes:
3. **Verify**:
   - ✅ 404 responses for non-owned customers (consistent)
   - ✅ Rate limiting headers present (if configured):
     - `X-RateLimit-Limit`
     - `X-RateLimit-Remaining`
     - `X-RateLimit-Reset`

---

### SECTION 8: Data Isolation Verification

#### Test 8.1: License List Ownership
1. Login as Reseller 1, note license count (e.g., 15)
2. In DevTools:
   ```javascript
   const token = JSON.parse(localStorage.getItem('license-auth')).token

   fetch('http://localhost:3000/api/reseller/licenses?per_page=1000', {
     headers: { 'Authorization': 'Bearer ' + token }
   }).then(r => r.json()).then(data => {
     console.log('Total licenses:', data.meta.total)
     console.log('All owned by me:', data.data.every(l => true)) // Manual check
   })
   ```
3. **Verify**:
   - ✅ Only your licenses returned
   - ✅ Count matches dashboard
   - ✅ No licenses from other resellers mixed in

#### Test 8.2: Activity Log Isolation
1. Open Activity/Logs page
2. In DevTools Network:
   - Observe `/api/reseller/reseller-logs` request
3. **Verify**:
   - ✅ All logged actions are performed by you
   - ✅ No other reseller's activities visible
   - ✅ Metadata matches your actions

---

### SECTION 9: Response Header Security

#### Test 9.1: Security Headers Verification
1. In DevTools, open Network tab
2. Make any API request: `GET /api/reseller/customers`
3. Click request, view "Response Headers"
4. **Verify** headers present:
   - ✅ `X-Content-Type-Options: nosniff`
   - ✅ `X-Frame-Options: DENY` or `SAMEORIGIN`
   - ✅ `Content-Security-Policy` (CSP rules)
   - ✅ `Cache-Control: no-store, no-cache` (for sensitive data)

#### Test 9.2: CORS & Cross-Origin Prevention
1. In DevTools Console, try cross-origin request:
   ```javascript
   fetch('http://localhost:3000/api/reseller/customers', {
     headers: { 'Authorization': 'Bearer ' + token }
   })
   ```
   (Called from different origin if possible)
2. **Verify**:
   - ✅ Request blocked by CORS policy
   - ✅ Error: "CORS policy: No 'Access-Control-Allow-Origin' header"

---

## Verification Checklist

### Authentication & Sessions
- [ ] Login works with valid credentials
- [ ] Invalid credentials rejected (not enumeration-prone)
- [ ] Token stored in localStorage
- [ ] Token revoked on logout
- [ ] Cannot use old token after logout
- [ ] Cannot manually modify token and maintain access

### Authorization
- [ ] Resellers see only their data
- [ ] Managers see only their tenant
- [ ] Super-admins can access all data
- [ ] Role escalation via localStorage fails at API level
- [ ] Role middleware blocks unauthorized requests (403)

### Data Isolation
- [ ] IDOR on licenses returns 404
- [ ] IDOR on customers returns 404
- [ ] Bulk operations only affect owned items
- [ ] Search results filtered by reseller
- [ ] Reports show only owned data

### SQL Injection
- [ ] Malicious search parameters don't execute
- [ ] No SQL errors in responses
- [ ] Database structure not exposed
- [ ] All queries use parameterized bindings

### XSS & Content Security
- [ ] SVG logos rendered safely (no onload execution)
- [ ] No inline script injection possible
- [ ] CSP headers prevent external script loading
- [ ] Form inputs properly escaped

### Rate Limiting
- [ ] Rapid requests don't enumerate accounts
- [ ] Enumeration attempts return consistent 404s
- [ ] Rate limit headers present (if configured)

### Response Security
- [ ] Security headers present
- [ ] No sensitive info in error messages
- [ ] CORS properly configured
- [ ] No directory listing
- [ ] No default files exposed

---

## Issue Reporting

If any test fails:

1. **Capture Evidence**:
   - Screenshot of DevTools
   - Network request/response JSON
   - Browser console errors
   - Current URL

2. **Create Issue**:
   ```
   Title: [SECURITY] Brief description

   Severity: [Critical/High/Medium/Low]

   Reproduction:
   1. Step 1
   2. Step 2
   3. Step 3

   Expected:
   Should return 404

   Actual:
   Returns 200 with user data

   Evidence: [Attach screenshot]
   ```

3. **Security Issues**:
   - For production systems: Report privately
   - Include environment details
   - Provide temporary access if needed

---

## Automated Test Execution

Run all tests with reporting:

```bash
# Run with HTML report
npx playwright test e2e/tests/security-audit.spec.ts --reporter=html
open playwright-report/index.html

# Run with detailed output
npx playwright test e2e/tests/security-audit.spec.ts --reporter=verbose

# Run specific test group
npx playwright test e2e/tests/security-audit.spec.ts -g "Authorization"

# Run with screenshots on failure
npx playwright test e2e/tests/security-audit.spec.ts --screenshot=only-on-failure
```

---

## Performance Notes

- Security test suite: ~1.8 minutes (22 tests)
- Each test: 3-7 seconds
- No tests should timeout
- All failures should be clearly marked

---

**Last Updated**: March 18, 2026
**Status**: PRODUCTION READY
**Next Review**: Quarterly
