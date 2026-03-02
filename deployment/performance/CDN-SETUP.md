# CDN Setup (Static Frontend Assets)

1. Build frontend:
```bash
cd frontend
npm ci
npm run build
```

2. Upload `frontend/dist/assets/` to CDN origin storage (Cloudflare R2, S3, Bunny).

3. Set frontend base URL to CDN in `frontend/.env.production`:
```env
VITE_CDN_BASE_URL=https://cdn.example.com/assets
```

4. Configure Nginx to cache static files aggressively:
```nginx
location /assets/ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
}
```

5. Purge CDN cache on every deploy.
