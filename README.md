# Coincela

**Every payment accounted for.**

An invoice and payment reconciliation workspace for freelancers, consultants and small service businesses moving beyond manual spreadsheets.

Current state: **Milestone 3 — explainable matching engine**. Secure accounts/workspaces support atomic CSV imports and deterministic payment-to-invoice suggestions. Review Payments shows exact-reference, strong, possible, ambiguous and no-match outcomes, supporting evidence, warnings, current balances and stale-result handling. Suggestions can be rejected without changing money. Financial allocations and reversals are not implemented. No live deployment has been verified.

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

Configured repository: [abbasikhadija/Coincela](https://github.com/abbasikhadija/Coincela). The remote is configured locally. Milestone 1 is committed as 104014a; Milestone 2 is included in the local commit feat: add atomic CSV import workflow. No push was requested.

Create an account with email, a 12–128 character password and workspace name. Settings allows renaming the GBP workspace. Sessions expire after 30 minutes; sign out revokes the active session. Tokens use memory/sessionStorage for refresh continuity, never localStorage or cross-site cookies. Browser-readable tokens remain exposed to XSS; see docs/DECISIONS.md.

## Import records

Open Import after signing in. Download a synthetic sample, import invoices, then choose or add a named bank account and import incoming payments. Files must be UTF-8 CSV up to 1 MiB and 1,000 rows, with GBP decimal amounts and YYYY-MM-DD dates. All rows are validated before new records are committed. Exact repeated files and reliable duplicate identities are reported as skipped; uncertain identical-looking payments are retained with review warnings. Fix rejected files using row errors and retry. See [CSV formats and duplicate policy](docs/IMPORTS.md).

## Review payment suggestions

After importing, open Review Payments and select one incoming payment. Generate suggestions, inspect invoice/customer/reference evidence and visible amount/date/duplicate warnings, and reject unsuitable candidates. Equal amounts alone are weak evidence; multiple plausible invoices are marked Ambiguous. Unmatched payments are valid. Refresh detects stale financial inputs and requires regeneration. Suggestions never allocate money; confirmation is a later milestone. See [matching rules and API](docs/RECONCILIATION.md).
