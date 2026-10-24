# Coincela

**Every payment accounted for.**

An invoice and payment reconciliation workspace for freelancers, consultants and small service businesses moving beyond manual spreadsheets.

Current state: **Milestone 5 — reversals and audit history**. Secure accounts/workspaces support atomic CSV imports, explainable matching, confirmed full/partial/split allocations and reasoned reversals. Financial transactions recheck locked balances and atomically persist records, idempotent results and audit events. Activity shows preserved allocation/reversal history, current balances, actors and reasons. No live deployment has been verified.

The current workflow is import invoices → import incoming payments → review suggestions or choose invoices manually → explicitly confirm allocations → inspect balances/history → reverse mistakes with a reason. GBP only. Integer pence, bank-first/sorted-invoice locking, idempotency and atomic audits protect allocations and reversals; tests exercise overlapping PostgreSQL transactions, forced rollback and lost-response recovery.

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

The [master plan](docs/MASTER_PLAN.md) is authoritative. [Project scope](PROJECT_SPEC.md), [architecture](docs/ARCHITECTURE.md), [design](docs/DESIGN.md) and [decisions](docs/DECISIONS.md) distinguish current behavior from future requirements. Complete product UX, benchmarks, full accessibility audit and public deployment remain later work.

Configured repository: [abbasikhadija/Coincela](https://github.com/abbasikhadija/Coincela). The remote is configured locally. Milestone 1 is committed as 104014a; Milestone 2 is included in the local commit feat: add atomic CSV import workflow. No push was requested.

Create an account with email, a 12–128 character password and workspace name. Settings allows renaming the GBP workspace. Sessions expire after 30 minutes; sign out revokes the active session. Tokens use memory/sessionStorage for refresh continuity, never localStorage or cross-site cookies. Browser-readable tokens remain exposed to XSS; see docs/DECISIONS.md.

## Import records

Open Import after signing in. Download a synthetic sample, import invoices, then choose or add a named bank account and import incoming payments. Files must be UTF-8 CSV up to 1 MiB and 1,000 rows, with GBP decimal amounts and YYYY-MM-DD dates. All rows are validated before new records are committed. Exact repeated files and reliable duplicate identities are reported as skipped; uncertain identical-looking payments are retained with review warnings. Fix rejected files using row errors and retry. See [CSV formats and duplicate policy](docs/IMPORTS.md).

## Review payment suggestions

After importing, open Review Payments and select one incoming payment. Generate suggestions, inspect invoice/customer/reference evidence and visible amount/date/duplicate warnings, and reject unsuitable candidates. Equal amounts alone are weak evidence; multiple plausible invoices are marked Ambiguous. Unmatched payments are valid. Refresh detects stale financial inputs and requires regeneration. Suggestions never allocate money. See [matching rules and API](docs/RECONCILIATION.md).

## Confirm allocations

Use Review allocation for an invoice suggestion, or Choose invoices to allocate for manual/split allocation. Enter GBP amounts, review each invoice remainder and payment remainder, acknowledge the details and Confirm allocation. The server checks current ownership and balances while locked. An unknown response retains the same confirmation identifier for safe retry, including after reload/reopening the form. Keep the tab until the result is known. Success shows the recorded result and refreshes current balances; Invoices and incoming payments show outstanding/unallocated amounts. See [allocation API, transaction guarantees and retry limits](docs/ALLOCATIONS.md).

## Correct an allocation and inspect history

Open Activity, select a financial event and inspect its allocations and related timeline. Review reversal opens the selected allocation's current/restored balances. Enter a reason, acknowledge the consequences and Confirm reversal. Only that allocation is reversed in full; sibling split rows stay active. This does not refund money at your bank. Original allocations and audit records remain visible with reversal reasons and actors. Retry an unknown outcome with the same stored confirmation; after reload, reopen the event and use Check reversal confirmation. Restored amounts may then be explicitly allocated again. See [reversal API, history and recovery](docs/REVERSALS.md).
