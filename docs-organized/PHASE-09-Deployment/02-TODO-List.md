# PHASE 09: Deployment - TODO List

**Duration:** Day 12-13
**Deadline:** End of Day 13

---

## Day 12: Server Setup

### VPS Initial Setup

- [ ] SSH into Hostinger VPS: `ssh root@<VPS_IP>`
- [ ] Update system:
  ```bash
  apt update && apt upgrade -y
  ```
- [ ] Create deploy user:
  ```bash
  adduser deploy
  usermod -aG sudo deploy
  ```
- [ ] Set up SSH key auth for deploy user
- [ ] Disable password SSH login:
  ```bash
  # /etc/ssh/sshd_config
  PasswordAuthentication no
  systemctl restart sshd
  ```

### Firewall (UFW)

- [ ] Configure UFW:
  ```bash
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp    # SSH
  ufw allow 80/tcp    # HTTP
  ufw allow 443/tcp   # HTTPS
  ufw enable
  ufw status
  ```

### Install Software Stack

- [ ] Install Nginx:
  ```bash
  apt install nginx -y
  systemctl enable nginx
  ```
- [ ] Install PHP 8.3:
  ```bash
  add-apt-repository ppa:ondrej/php -y
  apt install php8.3-fpm php8.3-mysql php8.3-redis php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-gd -y
  ```
- [ ] Install MySQL 8.0:
  ```bash
  apt install mysql-server -y
  mysql_secure_installation
  ```
- [ ] Install Redis:
  ```bash
  apt install redis-server -y
  # Set password in /etc/redis/redis.conf
  # requirepass your_redis_password
  # bind 127.0.0.1
  systemctl restart redis
  ```
- [ ] Install Node.js 20:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install nodejs -y
  ```
- [ ] Install Composer:
  ```bash
  curl -sS https://getcomposer.org/installer | php
  mv composer.phar /usr/local/bin/composer
  ```
- [ ] Install Supervisor:
  ```bash
  apt install supervisor -y
  systemctl enable supervisor
  ```
- [ ] Install Certbot:
  ```bash
  apt install certbot python3-certbot-nginx -y
  ```
- [ ] Install Git:
  ```bash
  apt install git -y
  ```

### Database Setup

- [ ] Create database and user:
  ```sql
  CREATE DATABASE obd2sw CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'obd2sw_user'@'localhost' IDENTIFIED BY 'secure_password_here';
  GRANT ALL PRIVILEGES ON obd2sw.* TO 'obd2sw_user'@'localhost';
  FLUSH PRIVILEGES;
  ```
- [ ] Verify connection: `mysql -u obd2sw_user -p obd2sw`

### Application Deployment

- [ ] Create directory structure:
  ```bash
  mkdir -p /var/www/obd2sw/{backups,logs,scripts}
  chown -R deploy:www-data /var/www/obd2sw
  ```
- [ ] Clone repository:
  ```bash
  cd /var/www/obd2sw
  git clone https://github.com/yousef-abdallah/obd2sw.git .
  ```
- [ ] Backend setup:
  ```bash
  cd /var/www/obd2sw/backend
  composer install --no-dev --optimize-autoloader
  cp .env.example .env
  # Edit .env with production values:
  # APP_ENV=production
  # APP_DEBUG=false
  # APP_URL=https://obd2sw.com
  # DB_HOST=127.0.0.1
  # DB_DATABASE=obd2sw
  # DB_USERNAME=obd2sw_user
  # DB_PASSWORD=secure_password_here
  # REDIS_HOST=127.0.0.1
  # REDIS_PASSWORD=your_redis_password
  # EXTERNAL_API_URL=http://EXTERNAL_API_HOST
  # EXTERNAL_API_KEY=L9H2F7Q8XK6M4A
  php artisan key:generate
  php artisan migrate --force
  php artisan db:seed --class=SuperAdminSeeder --force
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache
  php artisan storage:link
  ```
- [ ] Set permissions:
  ```bash
  chown -R deploy:www-data /var/www/obd2sw/backend
  chmod -R 775 /var/www/obd2sw/backend/storage
  chmod -R 775 /var/www/obd2sw/backend/bootstrap/cache
  chmod 600 /var/www/obd2sw/backend/.env
  ```
- [ ] Frontend build (production — no tests-frontend/ on server):
  ```bash
  cd /var/www/obd2sw/frontend
  npm ci
  # Create .env with production API URL
  echo "VITE_API_URL=https://obd2sw.com/api" > .env
  echo "VITE_PUSHER_KEY=your_key" >> .env
  npm run build
  # Note: tests-frontend/ is NOT deployed to production
  # It is only used in CI/CD pipeline and deleted before deploy
  ```

---

## Day 12: Nginx + SSL

### Nginx Site Configuration

- [ ] Create site config:
  ```bash
  nano /etc/nginx/sites-available/obd2sw.com
  # Paste the full Nginx config from 01-Phase-Overview.md
  ```
- [ ] Enable site:
  ```bash
  ln -s /etc/nginx/sites-available/obd2sw.com /etc/nginx/sites-enabled/
  rm /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
  ```

### SSL Certificate

- [ ] Point domain DNS to VPS IP (A record: obd2sw.com -> VPS_IP)
- [ ] Wait for DNS propagation (check: `dig obd2sw.com`)
- [ ] Obtain SSL certificate:
  ```bash
  certbot --nginx -d obd2sw.com -d www.obd2sw.com --non-interactive --agree-tos -m admin@obd2sw.com
  ```
- [ ] Verify auto-renewal:
  ```bash
  certbot renew --dry-run
  ```
- [ ] Test HTTPS: `curl -I https://obd2sw.com`

### PHP-FPM Configuration

- [ ] Optimize PHP-FPM pool:
  ```bash
  nano /etc/php/8.3/fpm/pool.d/www.conf
  # pm = dynamic
  # pm.max_children = 20
  # pm.start_servers = 5
  # pm.min_spare_servers = 3
  # pm.max_spare_servers = 10
  ```
- [ ] Restart: `systemctl restart php8.3-fpm`

---

## Day 13: Queue Workers + Backups + CI/CD

### Supervisor (Queue Workers)

- [ ] Create config:
  ```bash
  nano /etc/supervisor/conf.d/obd2sw-worker.conf
  # Paste config from 01-Phase-Overview.md
  ```
- [ ] Start workers:
  ```bash
  supervisorctl reread
  supervisorctl update
  supervisorctl start obd2sw-worker:*
  supervisorctl status
  ```

### Laravel Scheduler (Cron)

- [ ] Add cron job:
  ```bash
  crontab -e -u deploy
  # Add:
  * * * * * cd /var/www/obd2sw/backend && php artisan schedule:run >> /dev/null 2>&1
  ```

### Automated Backups

- [ ] Create backup script:
  ```bash
  nano /var/www/obd2sw/scripts/backup.sh
  chmod +x /var/www/obd2sw/scripts/backup.sh
  ```
  ```bash
  #!/bin/bash
  DATE=$(date +%Y-%m-%d_%H-%M)
  BACKUP_DIR=/var/www/obd2sw/backups
  DB_USER=obd2sw_user
  DB_PASS="secure_password_here"
  DB_NAME=obd2sw

  # MySQL dump
  mysqldump -u $DB_USER -p"$DB_PASS" $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

  # Keep last 30 days
  find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

  echo "Backup completed: db_$DATE.sql.gz"
  ```
- [ ] Add to cron (daily at 3 AM):
  ```bash
  echo "0 3 * * * /var/www/obd2sw/scripts/backup.sh" | crontab -
  ```
- [ ] Test backup: `bash /var/www/obd2sw/scripts/backup.sh`
- [ ] Verify: `ls -la /var/www/obd2sw/backups/`

### CI/CD Pipeline

- [ ] Create `.github/workflows/deploy.yml` (content from Overview)
- [ ] Add GitHub Secrets:
  - `VPS_HOST`: VPS IP address
  - `VPS_USER`: deploy
  - `VPS_SSH_KEY`: deploy user's private SSH key
- [ ] Create deploy SSH key on VPS:
  ```bash
  ssh-keygen -t ed25519 -C "github-actions"
  cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
  # Copy private key to GitHub secret
  ```
- [ ] Test: push to main branch -> verify automated deployment
- [ ] Verify: check GitHub Actions tab for green pipeline

### Monitoring

- [ ] Create UptimeRobot account
- [ ] Add monitors:
  - [ ] HTTPS monitor: https://obd2sw.com (5 min interval)
  - [ ] API monitor: https://obd2sw.com/api/external/status (5 min)
  - [ ] SSL monitor: obd2sw.com (daily)
- [ ] Configure alerts: email notification
- [ ] Test: stop nginx briefly, verify alert received

---

## Production Smoke Tests

After deployment, manually verify:

### Authentication
- [ ] Login as Super Admin (admin@obd2sw.com)
- [ ] Login as Manager Parent
- [ ] Login as Reseller
- [ ] Login as Customer
- [ ] Forgot password sends email

### Core Features
- [ ] Super Admin: Create a new tenant
- [ ] Manager Parent: Add a new program with download link
- [ ] Manager Parent: Invite a reseller
- [ ] Reseller: Activate a customer via BIOS ID
- [ ] Customer: See license status and download link
- [ ] Customer: Download EXE

### External API
- [ ] API Status page shows "Online"
- [ ] BIOS activation calls external API successfully
- [ ] API logs show the request in Super Admin logs

### UI/UX
- [ ] Arabic RTL layout works
- [ ] Dark mode works
- [ ] Mobile responsive (test on real phone)
- [ ] All charts load with data

### Performance
- [ ] Page load < 3 seconds
- [ ] No 500 errors in nginx logs
- [ ] No errors in Laravel logs

---

## Rollback Plan

If deployment fails:

```bash
# 1. Revert to previous commit
cd /var/www/obd2sw
git log --oneline -5    # Find previous good commit
git checkout <commit>

# 2. Restore database from backup
gunzip < /var/www/obd2sw/backups/db_<date>.sql.gz | mysql -u obd2sw_user -p obd2sw

# 3. Rebuild frontend
cd frontend && npm run build

# 4. Clear caches
cd backend
php artisan config:clear
php artisan route:clear
php artisan cache:clear

# 5. Restart services
sudo systemctl restart php8.3-fpm
sudo systemctl reload nginx
sudo supervisorctl restart obd2sw-worker:*
```

---

## Verification (End of Day 13)

```bash
# Website live
curl -I https://obd2sw.com
# Should return: HTTP/2 200

# SSL valid
curl -vI https://obd2sw.com 2>&1 | grep "SSL certificate verify ok"

# API responding
curl https://obd2sw.com/api/external/status
# Should return JSON with status

# CI/CD working
# Push a small change -> GitHub Actions deploys automatically

# Backups
ls -la /var/www/obd2sw/backups/
# Should show today's backup file

# Monitoring
# UptimeRobot dashboard shows all green
```

**Phase 09 complete. Proceed to PHASE-10-Documentation.**
