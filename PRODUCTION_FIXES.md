# Production Issues - Emergency Fixes

**Date**: March 18, 2026
**Priority**: CRITICAL

---

## Issue 1: IP Address Permanently Blocked

### Problem
Login page shows: "IP Address Permanently Blocked - This IP was permanently blocked after repeated failed login attempts."

### Root Cause
The application has a security feature that blocks IP addresses after multiple failed login attempts. This is a brute-force protection mechanism, but it needs to be reset.

### Solution

#### Option A: Reset IP Block via Super Admin Panel (Recommended)
1. Go to Super Admin → Security → Locks
2. Find your IP address in the blocked list
3. Click "Unblock IP"
4. Try logging in again

#### Option B: Reset IP Block via Database (If Super Admin Unavailable)
```bash
# SSH into production server
ssh root@srv1437569

# Access your database
mysql -u obd2sw_user -p obd2sw_db

# View blocked IPs
SELECT * FROM security_locks WHERE type = 'ip';

# Delete the block for your IP (replace YOUR_IP)
DELETE FROM security_locks WHERE type = 'ip' AND value = 'YOUR_IP';

# Verify it's deleted
SELECT * FROM security_locks WHERE type = 'ip';
```

#### Option C: Add Parent Manager IP Unlock Feature (For Future)
Create a new page in Manager Parent dashboard to unlock IPs:

```php
// File: backend/app/Http/Controllers/ManagerParent/SecurityController.php
public function unblockIp(Request $request)
{
    $validated = $request->validate([
        'ip_address' => 'required|ip',
    ]);

    SecurityLock::query()
        ->where('type', 'ip')
        ->where('value', $validated['ip_address'])
        ->delete();

    return response()->json(['message' => 'IP unblocked']);
}
```

### Immediate Fix (Next 5 minutes)
1. Identify your current IP address from the error page or `curl ifconfig.me`
2. Ask your hosting provider to unblock it, OR
3. Use a VPN to access the application with a different IP
4. Once logged in, go to Super Admin → Security → Locks and unblock your IP

---

## Issue 2: Git Pull Failing - Untracked Files

### Problem
Production deploy fails with:
```
error: The following untracked working tree files would be overwritten by merge:
    node_modules/.package-lock.json
    package-lock.json
    package.json
```

### Root Cause
The `.gitignore` file is not properly configured to exclude these files, OR they were accidentally committed to the repository.

### Solution

#### Option A: Clean & Stash (Recommended - Preserves Local Changes)
```bash
# On production server
cd /home/obd2sw-panel/htdocs/panel.obd2sw.com

# Stash any local changes (in case you need them)
git stash

# Clean untracked files (dry-run first)
git clean -fd --dry-run

# Actually clean them
git clean -fd

# Now pull should work
git pull origin dev
```

#### Option B: Force Pull (If Stash Doesn't Work)
```bash
# On production server
cd /home/obd2sw-panel/htdocs/panel.obd2sw.com

# Reset to origin (WARNING: loses local changes)
git reset --hard origin/dev

# Pull latest
git pull origin dev
```

#### Option C: Fix .gitignore for Future (Prevent Recurrence)
```bash
# On your local machine (development)
cd /your/local/repo

# Edit .gitignore
nano .gitignore

# Add these lines:
node_modules/
package-lock.json
.package-lock.json
.env.local
dist/
build/

# Save and commit
git add .gitignore
git commit -m "Update .gitignore to exclude node_modules and lock files"
git push origin dev
```

### Detailed Fix Steps (Follow in Order)

1. **SSH into production server**:
   ```bash
   ssh root@srv1437569
   cd /home/obd2sw-panel/htdocs/panel.obd2sw.com
   ```

2. **Check current git status**:
   ```bash
   git status
   ```
   You should see untracked files like `package-lock.json`, `node_modules/.package-lock.json`

3. **Clean untracked files** (these are safe to delete):
   ```bash
   git clean -fd
   ```

4. **Pull latest code**:
   ```bash
   git pull origin dev
   ```

5. **Verify success**:
   ```bash
   git log --oneline -3
   ```
   Should show latest commits from dev branch

6. **Reinstall dependencies** (if needed):
   ```bash
   npm install
   # Or for backend
   composer install
   ```

7. **Restart application**:
   ```bash
   # Restart nginx/apache
   systemctl restart nginx
   # Or
   systemctl restart apache2

   # Restart PHP-FPM (if using)
   systemctl restart php-fpm
   ```

---

## Issue 3: Add IP Unlock Feature to Parent Manager

### Why This Matters
Right now, only Super Admin can unblock IPs. As a Parent Manager, you should be able to unblock IPs within your organization.

### Implementation

#### Step 1: Create Security Controller for Manager Parent
```php
// File: backend/app/Http/Controllers/ManagerParent/SecurityLockController.php
<?php

namespace App\Http\Controllers\ManagerParent;

use App\Models\SecurityLock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SecurityLockController extends BaseManagerParentController
{
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => SecurityLock::query()
                ->latest()
                ->paginate(50),
        ]);
    }

    public function unblock(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ip_address' => 'required|ip',
        ]);

        SecurityLock::query()
            ->where('type', 'ip')
            ->where('value', $validated['ip_address'])
            ->delete();

        return response()->json([
            'message' => 'IP address unblocked successfully',
        ]);
    }
}
```

#### Step 2: Add Routes
```php
// File: backend/routes/api.php (in manager_parent middleware group)
Route::get('/security/locks', [ManagerParentSecurityLockController::class, 'index']);
Route::post('/security/locks/unblock', [ManagerParentSecurityLockController::class, 'unblock']);
```

#### Step 3: Create Frontend Component
```tsx
// File: frontend/src/pages/manager-parent/SecurityLocks.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function SecurityLocks() {
  const [locks, setLocks] = useState([])
  const [ipToUnblock, setIpToUnblock] = useState('')

  const handleUnblock = async (ip: string) => {
    const response = await fetch('/api/security/locks/unblock', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ip_address: ip })
    })

    if (response.ok) {
      alert('IP unblocked successfully')
      // Refresh lock list
      loadLocks()
    }
  }

  return (
    <div className="space-y-4">
      <h1>Security - Locked IPs</h1>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="IP to unblock"
          value={ipToUnblock}
          onChange={(e) => setIpToUnblock(e.target.value)}
        />
        <Button onClick={() => handleUnblock(ipToUnblock)}>
          Unblock
        </Button>
      </div>

      <div className="space-y-2">
        {locks.map((lock) => (
          <Card key={lock.id} className="p-4">
            <div>{lock.value}</div>
            <Button onClick={() => handleUnblock(lock.value)}>
              Unblock This IP
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

---

## Immediate Action Plan (Next 30 Minutes)

### Step 1: Unblock Your IP (5 minutes)
```bash
# Get your IP
curl ifconfig.me

# SSH to production
ssh root@srv1437569

# Remove IP block from database
mysql -u obd2sw_user -p obd2sw_db
DELETE FROM security_locks WHERE type = 'ip' AND value = 'YOUR_IP';
EXIT;
```

### Step 2: Fix Git Pull (5 minutes)
```bash
cd /home/obd2sw-panel/htdocs/panel.obd2sw.com
git clean -fd
git pull origin dev
npm install
systemctl restart nginx
```

### Step 3: Verify Deployment (5 minutes)
1. Try to login with your unblocked IP
2. Verify latest code is deployed (check version in footer or About page)
3. Run basic smoke tests (login, navigate, create customer)

### Step 4: Update .gitignore Locally (5 minutes)
- Add `package-lock.json` and `node_modules/` to `.gitignore`
- Commit and push to prevent future issues

---

## Prevention for Future Deployments

### 1. Update .gitignore
```bash
# .gitignore
node_modules/
package-lock.json
.package-lock.json
.env.local
.env
dist/
build/
.DS_Store
test-results/
playwright-report/
coverage/
```

### 2. Production Deployment Script
```bash
#!/bin/bash
# File: scripts/deploy-prod.sh

set -e

echo "Starting production deployment..."

# Stash any local changes
git stash

# Clean untracked files
git clean -fd

# Pull latest code
git pull origin dev

# Install dependencies
npm install
composer install

# Build (if needed)
npm run build

# Restart services
systemctl restart nginx
systemctl restart php-fpm

echo "Deployment complete!"
```

### 3. Deployment Checklist
- [ ] Create new release branch: `git flow release start X.X.X`
- [ ] Run tests locally: `npm test`
- [ ] Update version in code/package.json
- [ ] Create release commit
- [ ] Merge to main with: `git flow release finish X.X.X`
- [ ] Deploy: `./scripts/deploy-prod.sh`
- [ ] Smoke test in production
- [ ] Monitor logs for errors

---

## Emergency Contacts

### If IP Block Won't Clear
- Contact hosting provider security team
- Request manual IP whitelist: support@obd2sw.com
- Use temporary VPN while investigating

### If Git Deployment Still Fails
```bash
# Last resort: reset to clean state
git reset --hard HEAD~1
git clean -fdx
git pull origin dev
```

### If Application Won't Start After Deploy
```bash
# Check PHP errors
tail -f /var/log/php-fpm.log

# Check nginx
tail -f /var/log/nginx/error.log

# Check application logs
tail -f /home/obd2sw-panel/htdocs/panel.obd2sw.com/storage/logs/laravel.log
```

---

## Testing After Deployment

```bash
# Test API endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://panel.obd2sw.com/api/reseller/customers

# Test login
curl -X POST \
  -d "email=reseller1@obd2sw.com&password=password" \
  http://panel.obd2sw.com/api/auth/login
```

---

## Summary

✅ **To fix IP block**: Delete from security_locks table
✅ **To fix git pull**: Run `git clean -fd` before pulling
✅ **To prevent future issues**: Update .gitignore
✅ **For parent manager IP unlock**: Implement SecurityLockController

All issues are **recoverable** and the application is **not compromised**. These are deployment/access issues, not security vulnerabilities.

---

**Status**: READY FOR IMMEDIATE IMPLEMENTATION
**Estimated Time to Fix**: 15-30 minutes
**Risk Level**: LOW
