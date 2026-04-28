# Security Hardening Checklist

This repository now includes a dedicated security regression layer for the Laravel backend and shared app surface.

## What Was Added

- Backend authorization hardening for manager team boundaries:
  - managers can no longer resolve or act on resellers outside their own team through shared resolver paths
  - seller resolution during license activation is now role-safe for manager and reseller actors
- API log hardening:
  - passwords, temporary passwords, tokens, and API keys stay redacted
  - attachment and large response bodies are no longer copied into `api_logs`
- Revenue analytics SQL portability improvements so the security suite can run locally on SQLite and in CI on MySQL
- Backend security regression tests under [tests/Feature/Security](/c:/laragon/www/LIcense/backend/tests/Feature/Security)
- Larastan / PHPStan at level 6 with a generated baseline for existing legacy debt
- Custom Semgrep rules in [.semgrep/security.yml](/c:/laragon/www/LIcense/.semgrep/security.yml)
- Sensitive route middleware audit script in [check-sensitive-routes.php](/c:/laragon/www/LIcense/backend/scripts/check-sensitive-routes.php)
- GitHub Actions security workflow in [security.yml](/c:/laragon/www/LIcense/.github/workflows/security.yml)

## Local Commands

Backend static analysis:

```bash
cd backend
composer analyse
```

Backend security regression suite:

```bash
cd backend
composer test:security
```

Sensitive route middleware audit:

```bash
cd backend
composer security:routes
```

Backend dependency audit:

```bash
cd backend
composer audit --locked --format=plain
```

Frontend dependency audit:

```bash
cd frontend
npm ci
npm audit --audit-level=high --omit=dev
```

Semgrep:

```bash
python -m pip install semgrep --default-timeout=1000
semgrep scan --metrics=off --error --config p/php --config p/owasp-top-ten --config .semgrep/security.yml backend/app backend/routes
```

ZAP baseline locally:

```bash
cd backend
cp .env.example .env
php artisan key:generate
php artisan migrate --force
php artisan serve --host=127.0.0.1 --port=8000
```

In another shell:

```bash
cd frontend
npm ci
VITE_API_URL=http://127.0.0.1:8000/api npm run build
npx vite preview --host 127.0.0.1 --port 4173
```

Then run ZAP against `http://127.0.0.1:4173` using the same baseline profile as CI.

## What CI Enforces

Blocking checks in `.github/workflows/security.yml`:

- backend security feature tests
- PHPStan / Larastan
- Semgrep PHP security scan plus repo custom rules
- Composer audit
- npm audit
- OWASP Dependency-Check with `--failOnCVSS 7`

Advisory only for now:

- OWASP ZAP baseline scan against a locally started app surface

## Regression-Protected Areas

- manager-to-manager horizontal isolation on license access
- manager and reseller seller-scope enforcement during activation
- role boundaries on password reset, unlock, username change, reseller payments, and balance adjustments
- customer silent-deny login behavior
- SQL-like payload regression on BIOS availability search
- API log redaction for request and response payloads
- token revocation during password reset

## Remaining Manual Review

- `jwt-auth` is still installed and configured, but current app behavior appears to use Sanctum. Remove it only after confirming there are no external clients depending on legacy token behavior.
- Destructive tenant reset / backup / restore flows still need manual scenario review beyond automated coverage.
- File upload and logo handling should be reviewed for MIME/content validation and storage policy.
- Production deployment headers, TLS, cookie flags on HTTPS, and secret handling still require environment-level review.
- ZAP is currently unauthenticated and advisory. Authenticated crawl coverage and tuned rules should be added after the baseline is understood.
- PHPStan uses a baseline because the legacy type-safety backlog is large. New code must stay clean, but the baseline should be burned down over time instead of treated as permanent.
