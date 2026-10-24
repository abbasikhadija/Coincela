# Coincela

**Every payment accounted for.**

An invoice and payment reconciliation workspace for freelancers, consultants and small service businesses moving beyond manual spreadsheets.

Current state: **Milestone 0 foundation**. React application shell, real API connectivity, PostgreSQL readiness and deployment/testing infrastructure. Authentication, imports, matching and financial allocations are not implemented. No live demo or Coincela repository URL has been verified.

The intended workflow is import invoices → import incoming payments → review explainable suggestions → explicitly confirm allocations → track balances and reversals. GBP only. Financial correctness will use integer pence, transactional balance validation, deterministic locks, idempotency and immutable audit history. No financial or concurrency claims are made at this stage.

```text
GitHub Pages: React / TypeScript / Vite / Tailwind / HashRouter
    → Render: Node / Express / Zod / pg / node-pg-migrate / csv-parse
    → Neon: PostgreSQL
```

## Local setup

Requires Node 22.14+ within version 22, npm and PostgreSQL 18 (Docker Compose recommended).

```powershell
npm ci
Copy-Item apps/api/.env.example apps/api/.env
docker compose up -d
npm run db:migrate
npm run dev
```

Open http://127.0.0.1:5173/Coincela/. API health: http://127.0.0.1:3001/health; database readiness: http://127.0.0.1:3001/health/ready. If using native PostgreSQL, set DATABASE_URL in apps/api/.env instead of running Compose. Vite proxies local API calls; frontend .env is optional locally. Production frontend uses public VITE_API_URL; no database credentials belong there.

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. See [testing](docs/TESTING.md) for required real PostgreSQL and browser checks, and [status](docs/STATUS.md) for actual results. See [deployment](docs/DEPLOYMENT.md) for Pages, Render and Neon preparation. Deployment configuration exists; no hosting has been executed or verified.

The [master plan](docs/MASTER_PLAN.md) is authoritative. [Project scope](PROJECT_SPEC.md), [architecture](docs/ARCHITECTURE.md), [design](docs/DESIGN.md) and [decisions](docs/DECISIONS.md) distinguish current behavior from future requirements. Benchmarks, financial workflows, full accessibility audit and synthetic product screenshots belong to later milestones.
