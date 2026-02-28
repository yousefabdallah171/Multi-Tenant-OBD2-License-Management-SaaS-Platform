# PHASE 00: Setup (Monorepo) - TODO List

**Status:** Complete  
**Updated:** 2026-02-28  

---

## Repository Structure

- [x] Repository root contains `docs-organized/`
- [x] Repository root contains `README.md`
- [x] Base folders exist: `backend/`, `frontend/`, `nginx/`, `scripts/`
- [x] Root `.gitignore` covers backend, frontend, and `tests-frontend/` artifacts

## Docker and Infrastructure Files

- [x] `docker-compose.yml` exists
- [x] `backend/Dockerfile` exists
- [x] `frontend/Dockerfile` exists
- [x] `nginx/default.conf` exists
- [x] MySQL volume is defined in Docker config
- [x] Shared network is defined in Docker config

## Backend Bootstrap

- [x] Laravel backend exists in `backend/`
- [x] Backend `.env.example` is present and updated
- [x] Sanctum is installed
- [x] JWT package is installed and config is published
- [x] Swagger dev dependency is installed
- [x] External API config exists
- [x] CORS is configured for frontend origins
- [x] Backend boots without fatal errors

## Frontend Bootstrap

- [x] React + Vite + TypeScript app exists in `frontend/`
- [x] Runtime dependencies are installed
- [x] Tailwind is configured
- [x] Aliases are configured
- [x] React Query provider is configured
- [x] i18n is configured with `/:lang/...` routing
- [x] Frontend folder structure exists for production code

## Separate Frontend Testing Workspace

- [x] `tests-frontend/` exists
- [x] `tests-frontend/package.json` exists
- [x] `tests-frontend/jest.config.ts` exists
- [x] `tests-frontend/cypress.config.ts` exists
- [x] Frontend unit tests run outside `frontend/`

## Setup Scripts

- [x] `scripts/setup.ps1` exists and installs backend, frontend, and `tests-frontend`
- [x] `scripts/setup.sh` exists and installs backend, frontend, and `tests-frontend`
- [x] Setup scripts run migrations and seeders

## Local Runtime Verification

- [x] Backend is working through Laragon at `http://license.test`
- [x] Frontend is working through Vite at `http://localhost:3000`
- [x] Frontend can call backend API successfully
- [x] MySQL connection succeeds in the current local setup
- [x] Backend tests pass
- [x] Frontend lint passes
- [x] Frontend type-check passes
- [x] Frontend Jest tests pass from `tests-frontend/`

## Docker Runtime Note

- [x] Docker scaffolding is prepared
- [x] Docker verification is deferred to a machine with Docker CLI installed

---

## Definition of Done

- [x] Full monorepo scaffold exists
- [x] Backend is installed and operational
- [x] Frontend is installed and operational
- [x] Separate frontend testing workspace is operational
- [x] Setup is reproducible from a clean clone using the provided scripts
- [x] Project is ready for feature development
