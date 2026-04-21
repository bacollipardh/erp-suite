# ERP Suite

Single-company ERP for Kosovo-focused operations, built with NestJS, Prisma, PostgreSQL, and Next.js.

## What is in the repo

- `backend/`: NestJS API, Prisma schema/migrations, auth, RBAC, documents, stock logic, reporting, fiscalization workflow, PDF generation.
- `frontend/`: Next.js admin app with protected routes, httpOnly cookie auth, role-aware navigation, dashboard, reports, CRUD screens, POS, stock operations.
- `docker-compose.yml`: local Docker stack for Postgres, backend, and frontend.
- `scripts/smoke-auth.mjs`: smoke validation for health, login, session, and dashboard summary.
- `scripts/smoke-suite.mjs`: end-to-end smoke validation for core document, stock, report, and frontend flows.

## Current implementation baseline

- Fresh backend/frontend builds pass in this workspace.
- Auth uses a safer flow: the frontend stores the JWT in an httpOnly cookie via Next route handlers instead of a JS-readable browser cookie.
- RBAC is enforced on core API endpoints and reflected in sidebar visibility.
- Sales, purchase, and return documents now have paginated list endpoints, better detail relations for PDF/detail pages, payment tracking, due dates, and fiscal status fields.
- Dashboard and reports use backend aggregation endpoints instead of loading full datasets in the frontend.
- Stock now has operational workflows for adjustments, warehouse transfers, and stock counting, with audit logging.
- Fiscalization has a controlled internal workflow with audit logging and a sandbox adapter contract.
- CI now covers install, build, tests, and a Docker smoke workflow.

## Default users

All seeded users use password `Admin123!`.

- `admin@erp.local`
- `manager@erp.local`
- `sales@erp.local`
- `purchase@erp.local`

## Local setup

### 1. Backend env

Copy `backend/.env.example` to `backend/.env`.

Recommended local values:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/erpdb?schema=public
PORT=3000
CORS_ORIGIN=http://localhost:3001
JWT_SECRET=change-this-to-a-long-random-secret
```

### 2. Frontend env

Copy `frontend/.env.example` to `frontend/.env.local`.

Recommended local values:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
INTERNAL_API_BASE_URL=http://localhost:3000/api
```

### 3. Install dependencies

From repo root:

```bash
npm run install:all
```

### 4. Generate Prisma client

```bash
npm run prisma:generate
```

### 5. Run migrations and seed

```bash
cd backend
npx prisma migrate deploy
npm run seed
```

### 6. Start locally

In two terminals:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

Frontend: `http://localhost:3001`

Backend API: `http://localhost:3000/api`

Swagger: `http://localhost:3000/api/docs`

## Docker setup

`docker-compose.yml` now reads the backend secret from `backend/.env`, so set `JWT_SECRET` there before starting the stack.

To run the full stack with Docker:

```bash
npm run dev
```

After the containers are healthy, seed the database:

```bash
docker compose exec -T backend npm run seed
```

## Useful scripts

From repo root:

```bash
npm run build
npm run typecheck
npm run test
npm run seed
npm run smoke:auth
npm run smoke:full
```

## Free live deploy

For a zero-cost live demo, the cleanest setup for this repo is:

- `frontend` on Render free web service
- `backend` on Render free web service
- PostgreSQL on Neon free

The repo now includes [render.yaml](C:\Users\fatbardh.pacolli\Desktop\erp-suite - codex\render.yaml) so Render can create both app services from the repo automatically. The frontend can discover the backend over Render's internal network through `BACKEND_HOSTPORT`, which means the browser continues using the frontend's `/api/*` routes and does not need to talk to the backend directly.

### 1. Create a Neon database

Create a free Neon Postgres project and copy its connection string.

Recommended value for `DATABASE_URL`:

```env
postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

### 2. Deploy the app services on Render

In Render:

1. Create a new Blueprint and point it to this repository.
2. Render will detect [render.yaml](C:\Users\fatbardh.pacolli\Desktop\erp-suite - codex\render.yaml) and create:
   - `erp-suite-backend`
   - `erp-suite-frontend`
3. Before the first successful backend deploy, set these environment variables in Render:
   - `DATABASE_URL` = your Neon connection string
   - `CORS_ORIGIN` = your frontend Render URL after it is assigned, for example `https://erp-suite-frontend.onrender.com`
4. Leave `JWT_SECRET` as the generated secret unless you want to manage your own.

The frontend usually works without a manual `INTERNAL_API_BASE_URL` because it can derive the backend address from `BACKEND_HOSTPORT`. If you ever want to override it manually, set:

```env
INTERNAL_API_BASE_URL=https://your-backend-host/api
NEXT_PUBLIC_API_BASE_URL=https://your-backend-host/api
```

### 3. Run migrations and seed the live database

The backend container already runs `prisma migrate deploy` on startup. For demo data, run the seed from your machine against the same Neon database:

```powershell
cd backend
$env:DATABASE_URL='your-neon-connection-string'
npx prisma migrate deploy
npm run seed
```

### 4. Open the live app

Once Render finishes both deploys, open the frontend URL and log in with:

- `admin@erp.local / Admin123!`
- `manager@erp.local / Admin123!`
- `sales@erp.local / Admin123!`
- `purchase@erp.local / Admin123!`

### 5. Important free-tier notes

- Render free web services spin down after 15 minutes without traffic, so the first request after idle can take around a minute.
- Render free Postgres expires after 30 days, which is why Neon is the better free database choice for this repo.
- If you only want the fastest possible preview and do not care about the 30-day database limit, you can also swap Neon for a free Render Postgres instance.

## API changes worth knowing

- Document list endpoints now support paginated responses:
  - `GET /purchase-invoices`
  - `GET /sales-invoices`
  - `GET /sales-returns`
- New aggregated endpoints:
  - `GET /dashboard/summary`
  - `GET /reports/sales-summary`
  - `GET /reports/receivables-aging`
  - `GET /reports/payables-aging`
- New payment endpoints:
  - `POST /purchase-invoices/:id/payments`
  - `POST /sales-invoices/:id/payments`
- New fiscalization endpoints:
  - `POST /fiscalization/sales-invoices/:id/submit`
  - `POST /fiscalization/sales-returns/:id/submit`
- New stock operation endpoints:
  - `POST /stock/adjustments`
  - `POST /stock/transfers`
  - `POST /stock/counts`

## Fiscalization status

The repo includes the internal fiscalization contract and audit trail.

- `SANDBOX` mode is supported through a stub adapter.
- `LIVE` mode is intentionally blocked until a real provider adapter is configured.
- Company fiscal configuration is stored in `company_profile`.

## Smoke validation

With backend and frontend running, execute:

```bash
npm run smoke:auth
```

This validates:

- health endpoint
- login
- `auth/me`
- dashboard summary access

For the fuller release smoke:

```bash
npm run smoke:full
```

This covers:

- purchase invoice create, post, and payment
- sales invoice create, post, payment, and detail fetch
- sales return create, post, and fiscalization
- stock adjustment, transfer, and counting
- dashboard, reports, audit logs, and stock movement endpoints
- frontend login, session, proxy access, document page rendering, and logout

## What is still next

The repo is materially stronger than the original baseline, but these areas still remain for the next cycle:

- customer receipt and supplier payment ledgers beyond document-level payment capture
- richer reporting slices and export workflows
- deeper backend tests for posting and returns edge cases
- frontend e2e coverage for critical user journeys
- production-ready live fiscalization adapter
