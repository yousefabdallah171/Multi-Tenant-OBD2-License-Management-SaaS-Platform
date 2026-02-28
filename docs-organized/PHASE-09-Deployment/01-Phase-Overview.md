# PHASE 09: Deployment

**Duration:** Day 12-13
**Status:** Pending
**Tests Target:** Production smoke tests
**Depends On:** Phase 08 (All tests passing)

---

## Goals

- Deploy to Hostinger VPS (Ubuntu 22.04)
- Configure Nginx as reverse proxy with SSL
- Set up Redis for caching and sessions
- Create CI/CD pipeline with GitHub Actions
- Configure automated database backups
- Set up monitoring with UptimeRobot

---

## Server Specifications

| Resource | Spec |
|----------|------|
| Provider | Hostinger VPS |
| OS | Ubuntu 22.04 LTS |
| CPU | 2+ vCPU |
| RAM | 4+ GB |
| Storage | 50+ GB SSD |
| Domain | obd2sw.com |

---

## Production Stack

```
Ubuntu 22.04
├── Nginx 1.24            # Reverse proxy + SSL termination + static files
├── PHP 8.3-FPM           # Laravel API runtime
├── MySQL 8.0             # Database
├── Redis 7               # Cache + Sessions + Queues
├── Node.js 20            # Frontend build (build-time only)
├── Certbot               # Let's Encrypt SSL auto-renewal
├── Supervisor             # Queue workers + scheduler
├── UFW                   # Firewall
└── Cron                  # Laravel scheduler + backups
```

---

## Directory Structure (Server)

```
/var/www/obd2sw/
├── backend/               # Laravel application
│   ├── public/            # API entry point (index.php)
│   ├── storage/
│   │   ├── app/
│   │   ├── logs/
│   │   └── framework/
│   └── .env               # Production environment
├── frontend/
│   └── dist/              # Vite production build (static files)
├── backups/               # Daily MySQL backups
└── logs/                  # Nginx access/error logs
```

---

## Nginx Configuration

```nginx
# /etc/nginx/sites-available/obd2sw.com
server {
    listen 80;
    server_name obd2sw.com www.obd2sw.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name obd2sw.com www.obd2sw.com;

    # SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/obd2sw.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/obd2sw.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;

    # Frontend (React SPA)
    location / {
        root /var/www/obd2sw/frontend/dist;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Sanctum CSRF
    location /sanctum {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Block dotfiles
    location ~ /\. {
        deny all;
    }

    # Logs
    access_log /var/www/obd2sw/logs/nginx-access.log;
    error_log /var/www/obd2sw/logs/nginx-error.log;
}
```

---

## CI/CD Pipeline (GitHub Actions)

### Workflow: Test + Deploy

```yaml
# .github/workflows/deploy.yml
name: Test & Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_DATABASE: obd2sw_test
          MYSQL_ROOT_PASSWORD: secret
        ports: ["3306:3306"]
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]

    steps:
      - uses: actions/checkout@v4

      # Backend tests
      - uses: shivammathur/setup-php@v2
        with: { php-version: "8.3" }
      - run: cd backend && composer install --no-interaction
      - run: cd backend && cp .env.testing .env
      - run: cd backend && php artisan migrate --seed
      - run: cd backend && php artisan test

      # Frontend tests (from tests-frontend/)
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: cd tests-frontend && npm ci
      - run: cd tests-frontend && npm run test:unit -- --watchAll=false
      # Frontend build (from frontend/ - production only)
      - run: cd frontend && npm ci && npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      # Build frontend
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: cd frontend && npm ci && npm run build

      # Deploy via SSH
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /var/www/obd2sw
            git pull origin main
            cd backend && composer install --no-dev --optimize-autoloader
            php artisan migrate --force
            php artisan config:cache
            php artisan route:cache
            php artisan view:cache
            php artisan queue:restart
            cd ../frontend && npm ci && npm run build
            sudo systemctl reload nginx
            sudo supervisorctl restart obd2sw-worker:*
```

---

## Supervisor Configuration

```ini
# /etc/supervisor/conf.d/obd2sw-worker.conf
[program:obd2sw-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/obd2sw/backend/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasignal=QUIT
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/obd2sw/logs/worker.log
stopwaitsecs=3600
```

---

## Automated Backups

```bash
# /etc/cron.d/obd2sw-backup
# Daily at 3:00 AM
0 3 * * * root /var/www/obd2sw/scripts/backup.sh

# /var/www/obd2sw/scripts/backup.sh
#!/bin/bash
DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_DIR=/var/www/obd2sw/backups

# MySQL dump
mysqldump -u obd2sw_user -p'$DB_PASSWORD' obd2sw | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Keep last 30 days only
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

# Optional: upload to external storage
# rclone copy $BACKUP_DIR/db_$DATE.sql.gz remote:obd2sw-backups/
```

---

## Monitoring

### UptimeRobot

| Monitor | URL | Interval | Alert |
|---------|-----|----------|-------|
| Website | https://obd2sw.com | 5 min | Email + Telegram |
| API | https://obd2sw.com/api/external/status | 5 min | Email |
| SSL | https://obd2sw.com | Daily | 14 days before expiry |

### Laravel Log Monitoring

```php
// config/logging.php - daily log rotation
'daily' => [
    'driver' => 'daily',
    'path' => storage_path('logs/laravel.log'),
    'days' => 14,
],
```

---

## Security Checklist

- [ ] UFW firewall: allow only 22 (SSH), 80 (HTTP), 443 (HTTPS)
- [ ] SSH: key-only auth, disable password login
- [ ] MySQL: bind to localhost only
- [ ] Redis: bind to localhost, require password
- [ ] .env file: permission 600 (owner read/write only)
- [ ] storage/ and bootstrap/cache/: permission 775
- [ ] APP_DEBUG=false in production
- [ ] APP_ENV=production
- [ ] HTTPS forced (Nginx redirect)
- [ ] Security headers set (X-Frame-Options, CSP, HSTS)
- [ ] Rate limiting on login endpoint
- [ ] API key for external API stored in .env only

---

## Acceptance Criteria

- [ ] Application accessible at https://obd2sw.com
- [ ] SSL certificate valid (HTTPS green lock)
- [ ] All 5 roles can log in successfully
- [ ] License activation works in production
- [ ] External API calls succeed through proxy
- [ ] Frontend loads in < 3 seconds
- [ ] CI/CD: push to main triggers automated deploy
- [ ] Automated backups running daily
- [ ] UptimeRobot monitoring active
- [ ] No server errors in logs after 1 hour of testing
