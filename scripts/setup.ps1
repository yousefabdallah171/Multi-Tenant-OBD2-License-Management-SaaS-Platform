$ErrorActionPreference = "Stop"

Write-Host "== OBD2SW setup (Windows) =="

if (-not (Test-Path "backend/.env")) {
  Copy-Item "backend/.env.example" "backend/.env"
}

if (-not (Test-Path "frontend/.env")) {
  Copy-Item "frontend/.env.example" "frontend/.env"
}

if (-not (Test-Path "tests-frontend")) {
  New-Item -ItemType Directory -Path "tests-frontend" | Out-Null
}

Push-Location backend
composer install
php artisan key:generate
php artisan migrate --seed --force
Pop-Location

Push-Location frontend
npm install
Pop-Location

Push-Location tests-frontend
npm install
Pop-Location

Write-Host "Setup completed."
Write-Host "Run backend:  php artisan serve --host=127.0.0.1 --port=8000 (from backend)"
Write-Host "Run frontend: npm run dev (from frontend)"
Write-Host "Run tests:   npm run test:unit (from tests-frontend)"
