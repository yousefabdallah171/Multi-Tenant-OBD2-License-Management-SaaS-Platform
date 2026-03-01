# PHASE 09: Deployment — Full Production TODO List

**Updated for Phase 11 SaaS Refactor**
**Target:** Live at `https://obd2sw.com` — clean repo, no test files, no hardcoded secrets

---

## PRE-DEPLOY: Repository Cleanup (Do This BEFORE the Server)

### D-0.1 Remove All Hardcoded Secrets from Codebase

- [x] Run final check — zero results expected:
  ```bash
  grep -r "72\.60\.69\.185\|L9H2F7Q8XK6M4A" \
    --include="*.php" --include="*.ts" --include="*.tsx" --include="*.md" \
    backend/ frontend/ 2>/dev/null
  ```
- [x] Confirm `backend/config/external-api.php` has NO hardcoded fallbacks:
  ```php
  'url' => env('EXTERNAL_API_URL'),   // no default
  'key' => env('EXTERNAL_API_KEY'),   // no default
  ```
- [x] Confirm `backend/.env.example` uses placeholders only:
  ```
  EXTERNAL_API_URL=http://YOUR_EXTERNAL_API_HOST
  EXTERNAL_API_KEY=YOUR_EXTERNAL_API_KEY
  ```
- [x] Confirm `frontend/src/pages/manager-parent/ApiStatus.tsx` shows `—` fallback (no IP)
- [x] Confirm `backend/database/seeders/RealSoftwareSeeder.php` has no IP in description
- [x] Confirm all PHPUnit test files use `external-api.test` mock URL (not real IP)
- [x] Verify `.env` is in `.gitignore` and NOT committed to git

### D-0.2 Delete All Test Files from Repo and Server

> `tests-frontend/` is for local development only. Never deployed to production.

- [x] Verify `tests-frontend/` is in `.gitignore` OR excluded from deploy rsync
- [x] In CI/CD deploy job: ensure `tests-frontend/` is NOT copied to server
- [x] Confirm `npm run build` output in `frontend/dist/` has NO test files:
  ```bash
  cd frontend && npm run build && find dist/ -name "*.test.*" | wc -l
  # Expected: 0
  ```
- [ ] On production server after deploy: confirm directory doesn't exist:
  ```bash
  ls /var/www/obd2sw/ | grep tests
  # Expected: no output
  ```

### D-0.3 Clean Development Seeders

- [x] Delete: `backend/database/seeders/TestDataSeeder.php` (fake generated test data)
- [x] Keep: `backend/database/seeders/SuperAdminSeeder.php`
- [x] Keep: `backend/database/seeders/ProductionSeeder.php` (created below in D-0.5)
- [x] Keep: `backend/database/seeders/RealSoftwareSeeder.php`
- [x] Update `backend/database/seeders/DatabaseSeeder.php` to call only production seeders:
  ```php
  public function run(): void {
      $this->call([
          SuperAdminSeeder::class,
          ProductionSeeder::class,
      ]);
  }
  ```

### D-0.4 Verify Forgot-Password is Fully Removed

- [ ] `GET /ar/forgot-password` in browser → 404 confirmed
- [x] Confirm `ForgotPassword.tsx` file deleted from `frontend/src/pages/auth/`
- [x] Backend route list has no forgot-password entry:
  ```bash
  cd backend && php artisan route:list | grep forgot
  # Expected: zero results
  ```

### D-0.5 Create `ProductionSeeder.php` — Ready-to-Demo Data

**File:** `backend/database/seeders/ProductionSeeder.php` (NEW FILE)

Seeds realistic demo data so the app has data on first deploy — dashboards show real numbers.

- [x] Create `backend/database/seeders/ProductionSeeder.php`:
  ```php
  <?php
  namespace Database\Seeders;

  use App\Enums\UserRole;
  use App\Models\License;
  use App\Models\Program;
  use App\Models\Tenant;
  use App\Models\User;
  use Illuminate\Database\Seeder;
  use Illuminate\Support\Facades\Hash;

  class ProductionSeeder extends Seeder
  {
      public function run(): void
      {
          // 1. Tenant
          $tenant = Tenant::query()->firstOrCreate(
              ['slug' => 'obd2sw-main'],
              ['name' => 'OBD2SW Main', 'slug' => 'obd2sw-main', 'status' => 'active', 'plan' => 'enterprise']
          );

          // 2. Software / Program
          $program = Program::query()->firstOrCreate(
              ['tenant_id' => $tenant->id, 'name' => 'OBD2SW Pro'],
              [
                  'tenant_id'            => $tenant->id,
                  'name'                 => 'OBD2SW Pro',
                  'description'          => 'Professional OBD2 diagnostic software.',
                  'version'              => '2.0.0',
                  'download_link'        => 'https://obd2sw.com/download/obd2sw-pro',
                  'trial_days'           => 7,
                  'base_price'           => 25.00,
                  'status'               => 'active',
                  'external_software_id' => (int) env('EXTERNAL_SOFTWARE_ID', 0) ?: null,
                  'has_external_api'     => (bool) env('EXTERNAL_API_KEY'),
              ]
          );

          // Set API key from env (never hardcoded)
          if (env('EXTERNAL_API_KEY') && ! $program->has_external_api) {
              $program->setExternalApiKeyAttribute(env('EXTERNAL_API_KEY'));
              $program->has_external_api = true;
              $program->save();
          }

          // 3. Manager Parent
          $managerParent = User::query()->firstOrCreate(
              ['email' => 'manager@obd2sw.com'],
              [
                  'tenant_id' => $tenant->id, 'name' => 'Main Manager',
                  'email' => 'manager@obd2sw.com',
                  'password' => Hash::make(env('SEED_MANAGER_PASSWORD', 'ChangeMe123!')),
                  'role' => UserRole::MANAGER_PARENT, 'status' => 'active', 'username' => 'main_manager',
              ]
          );

          // 4. Two Resellers
          $reseller1 = User::query()->firstOrCreate(
              ['email' => 'reseller1@obd2sw.com'],
              [
                  'tenant_id' => $tenant->id, 'name' => 'Ahmed Reseller',
                  'email' => 'reseller1@obd2sw.com',
                  'password' => Hash::make(env('SEED_RESELLER_PASSWORD', 'ChangeMe123!')),
                  'role' => UserRole::RESELLER, 'status' => 'active',
                  'username' => 'ahmed_reseller', 'created_by' => $managerParent->id,
              ]
          );

          $reseller2 = User::query()->firstOrCreate(
              ['email' => 'reseller2@obd2sw.com'],
              [
                  'tenant_id' => $tenant->id, 'name' => 'Mohamed Reseller',
                  'email' => 'reseller2@obd2sw.com',
                  'password' => Hash::make(env('SEED_RESELLER_PASSWORD', 'ChangeMe123!')),
                  'role' => UserRole::RESELLER, 'status' => 'active',
                  'username' => 'mohamed_reseller', 'created_by' => $managerParent->id,
              ]
          );

          // 5. Customers + Licenses
          $customers = [
              ['name' => 'Customer One',   'email' => 'customer1@demo.com', 'bios' => 'DEMO-BIOS-001', 'days' =>  30, 'r' => $reseller1],
              ['name' => 'Customer Two',   'email' => 'customer2@demo.com', 'bios' => 'DEMO-BIOS-002', 'days' =>   7, 'r' => $reseller1],
              ['name' => 'Customer Three', 'email' => 'customer3@demo.com', 'bios' => 'DEMO-BIOS-003', 'days' =>  90, 'r' => $reseller2],
              ['name' => 'Customer Four',  'email' => 'customer4@demo.com', 'bios' => 'DEMO-BIOS-004', 'days' =>  14, 'r' => $reseller2],
              ['name' => 'Customer Five',  'email' => 'customer5@demo.com', 'bios' => 'DEMO-BIOS-005', 'days' =>  -5, 'r' => $reseller1], // expired
          ];

          foreach ($customers as $c) {
              $expired = $c['days'] < 0;
              $customer = User::query()->firstOrCreate(
                  ['email' => $c['email']],
                  [
                      'tenant_id' => $tenant->id, 'name' => $c['name'], 'email' => $c['email'],
                      'password' => Hash::make(env('SEED_CUSTOMER_PASSWORD', 'ChangeMe123!')),
                      'role' => UserRole::CUSTOMER, 'status' => 'active',
                      'username' => $c['bios'], 'created_by' => $c['r']->id,
                  ]
              );
              License::query()->firstOrCreate(
                  ['bios_id' => $c['bios'], 'program_id' => $program->id],
                  [
                      'tenant_id' => $tenant->id, 'customer_id' => $customer->id,
                      'reseller_id' => $c['r']->id, 'program_id' => $program->id,
                      'bios_id' => $c['bios'], 'external_username' => $c['bios'],
                      'duration_days' => abs($c['days']), 'price' => 25.00,
                      'activated_at' => now()->subDays(abs($c['days']) + 5),
                      'expires_at'   => $expired ? now()->subDays(abs($c['days'])) : now()->addDays($c['days']),
                      'status'       => $expired ? 'expired' : 'active',
                  ]
              );
          }

          $this->command?->info('Production seed complete — 1 tenant, 1 program, 2 resellers, 5 customers (4 active + 1 expired)');
          $this->command?->warn('!! Change all SEED_*_PASSWORD values in .env before going live !!');
      }
  }
  ```

- [x] Test locally: `php artisan migrate:fresh --seed` → dashboard shows data
- [ ] Verify Manager Parent login → dashboard has stats
- [x] Verify Reseller 1 sees 3 customers (BIOS-001, 002, 005)
- [x] Verify Reseller 2 sees 2 customers (BIOS-003, 004)

---

## Day 12: Server Setup

### D-1.1 VPS Initial Setup

- [ ] SSH into server: `ssh root@<VPS_IP>`
- [ ] Update: `apt update && apt upgrade -y`
- [ ] Create deploy user: `adduser deploy && usermod -aG sudo deploy`
- [ ] SSH key auth + disable password login: `/etc/ssh/sshd_config → PasswordAuthentication no`

### D-1.2 Firewall

```bash
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw enable && ufw status
```

### D-1.3 Install Stack

- [ ] Nginx: `apt install nginx -y && systemctl enable nginx`
- [ ] PHP 8.3: `add-apt-repository ppa:ondrej/php -y && apt install php8.3-fpm php8.3-mysql php8.3-redis php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-gd -y`
- [ ] MySQL 8.0: `apt install mysql-server -y && mysql_secure_installation`
- [ ] Redis: `apt install redis-server -y` — then set password + bind 127.0.0.1 in `/etc/redis/redis.conf`
- [ ] Node.js 20: `curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install nodejs -y`
- [ ] Composer: `curl -sS https://getcomposer.org/installer | php && mv composer.phar /usr/local/bin/composer`
- [ ] Supervisor: `apt install supervisor -y && systemctl enable supervisor`
- [ ] Certbot: `apt install certbot python3-certbot-nginx -y`

### D-1.4 Database

```sql
CREATE DATABASE obd2sw CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'obd2sw_user'@'localhost' IDENTIFIED BY '<STRONG_PASSWORD>';
GRANT ALL PRIVILEGES ON obd2sw.* TO 'obd2sw_user'@'localhost';
FLUSH PRIVILEGES;
```

---

## Day 12: Deploy Application

### D-2.1 Backend

```bash
mkdir -p /var/www/obd2sw/{backups,logs,scripts}
chown -R deploy:www-data /var/www/obd2sw
cd /var/www/obd2sw && git clone https://github.com/yousef-abdallah/obd2sw.git .
cd backend && composer install --no-dev --optimize-autoloader
cp .env.example .env
# Fill .env with all production values (see D-0.5 for required keys)
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force   # runs SuperAdminSeeder + ProductionSeeder
php artisan config:cache && php artisan route:cache && php artisan view:cache
php artisan storage:link
chown -R deploy:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache
chmod 600 .env
```

### D-2.2 Frontend (Production Build — No Tests)

```bash
cd /var/www/obd2sw/frontend
npm ci
echo "VITE_API_URL=https://obd2sw.com/api" > .env.production
npm run build
# Verify dist/ exists and is clean
ls dist/    # should show only js/css/assets
```

---

## Day 12: Nginx + SSL

### D-3.1 Nginx Config

- [ ] Create `/etc/nginx/sites-available/obd2sw.com` — paste from `01-Phase-Overview.md`
- [ ] `ln -s /etc/nginx/sites-available/obd2sw.com /etc/nginx/sites-enabled/`
- [ ] `rm /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx`

### D-3.2 SSL

- [ ] DNS A record: `obd2sw.com` → VPS IP — wait for propagation
- [ ] `certbot --nginx -d obd2sw.com -d www.obd2sw.com --non-interactive --agree-tos -m admin@obd2sw.com`
- [ ] `certbot renew --dry-run` — verify auto-renewal

---

## Day 13: Workers + Backups + CI/CD

### D-4.1 Queue Workers (for Suspicious Login Emails)

- [ ] Create `/etc/supervisor/conf.d/obd2sw-worker.conf` — paste from `01-Phase-Overview.md`
- [ ] `supervisorctl reread && supervisorctl update && supervisorctl start obd2sw-worker:*`
- [ ] Test: login from new IP → check email received within 30 seconds

### D-4.2 Cron (Laravel Scheduler)

```bash
crontab -e -u deploy
# Add: * * * * * cd /var/www/obd2sw/backend && php artisan schedule:run >> /dev/null 2>&1
```

### D-4.3 Daily DB Backups

- [ ] Create `/var/www/obd2sw/scripts/backup.sh` (content from `01-Phase-Overview.md`):
  ```bash
  #!/bin/bash
  DATE=$(date +%Y-%m-%d_%H-%M)
  BACKUP_DIR=/var/www/obd2sw/backups
  mysqldump -u obd2sw_user -p"$DB_PASS" obd2sw | gzip > $BACKUP_DIR/db_$DATE.sql.gz
  find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete
  ```
- [ ] `chmod +x /var/www/obd2sw/scripts/backup.sh`
- [ ] Add to cron: `0 3 * * * /var/www/obd2sw/scripts/backup.sh`
- [ ] Test run: `bash /var/www/obd2sw/scripts/backup.sh && ls -la /var/www/obd2sw/backups/`

### D-4.4 CI/CD (GitHub Actions)

- [ ] Create `.github/workflows/deploy.yml` — ensure it excludes `tests-frontend/` from server copy
- [ ] Add secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`
- [ ] Push to `master` → verify green pipeline + auto-deploy

### D-4.5 Monitoring

- [ ] UptimeRobot: add HTTPS + API + SSL monitors
- [ ] Test: stop nginx → alert received within 5 min

---

## Production Smoke Tests

### D-5.1 Login Security

- [ ] Super Admin login works
- [ ] Manager Parent login works → sees seeded data
- [ ] Reseller 1 login works → sees 3 customers
- [ ] Reseller 2 login works → sees 2 customers
- [ ] **Customer login → `401 "Invalid credentials."` (Silent Deny)**
- [ ] **`/ar/forgot-password` → 404**
- [ ] 5 wrong passwords → lockout banner countdown visible
- [ ] Super Admin `/en/security-locks` → shows locked account → unblock works

### D-5.2 Seeded Data

- [ ] Super Admin dashboard: 1 tenant, 5 licenses, 2 resellers, 1 program showing
- [ ] Licenses list: 4 active + 1 expired (DEMO-BIOS-005)
- [ ] All BIOS cells show BIOS ID + username subtext

### D-5.3 External API

- [ ] API Status page: shows external URL from `.env` — Online badge
- [ ] Reseller activates a new test BIOS → license created, appears in Licenses list
- [ ] Deactivate license → status changes to Suspended

### D-5.4 Security Headers

- [ ] `X-RateLimit-Remaining` visible in DevTools after failed login
- [ ] No hardcoded IP or key in any response body or page source:
  ```bash
  curl https://obd2sw.com | grep -E "72\.60|L9H2F7Q8"
  # Expected: zero results
  ```

### D-5.5 Performance

- [ ] Lighthouse Performance ≥ 95, Accessibility ≥ 90
- [ ] All pages < 3 seconds
- [ ] No 500 errors in nginx logs after 1 hour

---

## Rollback Plan

```bash
cd /var/www/obd2sw
git log --oneline -5                          # find last good commit
git checkout <commit_hash>
gunzip < backups/db_<date>.sql.gz | mysql -u obd2sw_user -p obd2sw
cd frontend && npm ci && npm run build
cd backend && php artisan config:clear && php artisan cache:clear
sudo systemctl restart php8.3-fpm
sudo systemctl reload nginx
sudo supervisorctl restart obd2sw-worker:*
```

---

## Final Checklist

```
Secrets:       grep for IP/key → 0 results in production files
Test files:    /var/www/obd2sw/ → no tests-frontend/ directory
Seed data:     5 licenses showing in dashboard, 2 resellers active
Login:         Super Admin ✓  Manager ✓  Reseller ✓  Customer → 401 ✓
Forgot-pass:   /ar/forgot-password → 404 ✓
Security:      5 wrong logins → lockout ✓  SecurityLocks page ✓
External API:  URL from env (not hardcoded) ✓  activation works ✓
SSL:           HTTPS green lock ✓  certbot renew --dry-run ✓
CI/CD:         push to master → auto deploy ✓
Backups:       daily cron running ✓
Monitoring:    UptimeRobot alerts active ✓
```

**Phase 09 complete → Proceed to PHASE-10-Documentation.**
