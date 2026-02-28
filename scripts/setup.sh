#!/usr/bin/env bash
set -euo pipefail

echo "== OBD2SW setup (Unix) =="

[[ -f backend/.env ]] || cp backend/.env.example backend/.env
[[ -f frontend/.env ]] || cp frontend/.env.example frontend/.env
mkdir -p tests-frontend

pushd backend >/dev/null
composer install
php artisan key:generate
php artisan migrate --seed --force
popd >/dev/null

pushd frontend >/dev/null
npm install
popd >/dev/null

pushd tests-frontend >/dev/null
npm install
popd >/dev/null

echo "Setup completed."
echo "Run backend:  php artisan serve --host=127.0.0.1 --port=8000 (from backend)"
echo "Run frontend: npm run dev (from frontend)"
echo "Run tests:   npm run test:unit (from tests-frontend)"
