# Testing

From project root after npm ci:

1. npm test: API/environment, exact money parsing and password unit tests; frontend route protection, registration, restoration/expiry/401, retry and logout failure tests.
2. npm run typecheck and npm run lint.
3. npm run test:integration with TEST_DATABASE_URL set to isolated PostgreSQL. Missing configuration fails. The suite checks real API auth, ownership, CORS, concurrent duplicates, registration rollback and database constraints. Auth tests create a random schema, run migrations up/down/up and drop only that schema afterward. They never truncate public application tables.
4. npm run db:migrate with DATABASE_URL for the target environment. Review MIGRATIONS.md before any destructive rollback.
5. Set VITE_API_URL=https://api.coincela.test, then npm run build for both applications.
6. npx playwright install chromium; set TEST_DATABASE_URL to a disposable browser-test database, then npm run test:e2e. Playwright migrates that database and starts API port 3002 and production preview port 4173. It forwards the test-only HTTPS hostname to the actual local Express API using route.fetch, preserving real responses. No auth/health responses are simulated. Tests leave their uniquely named synthetic accounts in this disposable DB.

Desktop/mobile Chromium tests cover registration, settings, refresh continuity, wrong-password feedback, logout/login, server-expired sessions, private routes, production asset paths, hash refresh, active navigation, no viewport overflow, keyboard skip focus and connectivity recovery. The expiry test changes only its own generated session using its token hash through the isolated DB; no product testing endpoint exists. Screenshots are written under ignored test-results/ for visual review.

PowerShell example for the installed native PostgreSQL cluster:

```powershell
$env:TEST_DATABASE_URL='postgres://coincela_test@127.0.0.1:55432/coincela_test'
npm run test:integration
$env:VITE_API_URL='https://api.coincela.test'
npm run build
# Create coincela_e2e as a separate disposable database first.
$env:TEST_DATABASE_URL='postgres://coincela_test@127.0.0.1:55432/coincela_e2e'
npm run test:e2e
```

Deployment artifacts must be rebuilt with the actual public HTTPS VITE_API_URL or an empty value, never the test hostname. CI uses isolated PostgreSQL 18 and the same checks. Docker is unavailable locally; native PostgreSQL 18 provides real database verification. Financial service/concurrency tests remain due in their own milestones. Actual latest results and resolved failures are in STATUS.md.

Milestone 2 adds import-parser.test.ts (UTF-8/BOM, quoted fields, dates, decimals, headers, limits), imports.integration.test.ts (real PostgreSQL import atomicity, identity/file duplication, legitimate identical transfers, account/workspace scope, history/errors, transport limits, overlapping imports and forced rollback), frontend imports.test.tsx (file limits, row feedback, first action, retry, exact display), and desktop/mobile imports.spec.ts (sample download, keyboard upload, correction, repeated file, accounts, invoice/payment lists, reload and history).

Integration runners use schema-specific advisory lock IDs to allow independent random-schema suites to run concurrently; production migration locking is unchanged. This avoids a false test failure caused by competing database-wide migration locks. Browser tests still use real API and SQL responses, not mocked imports. No future matching/allocation tests are claimed.

Milestone 3 adds matching.test.ts and a hand-authored JSON fixture with 16 independent cases, covering exact/missing/incorrect/prefix references, customer evidence, equal amounts across customers, ambiguity, partial/excess payments, closed invoices and unmatched payments. Additional unit assertions cover dates, duplicate/payer warnings, immutable inputs and values beyond Number safety. Frontend review.test.tsx covers empty/error recovery, unconfirmed evidence/amounts, ambiguity, stale regeneration and rejection.

matching.integration.test.ts uses its own random PostgreSQL schema to check saved outcomes, metadata idempotency, current/rejected/stale list states, SQL-derived active allocation/reversal balances, foreign workspace isolation, concurrent generation, forced metadata rollback and unchanged financial records. Test-only SQL seeds later-service states without adding any financial endpoint. The migration round-trip suite now rolls down and reapplies both migrations. Browser matching.spec.ts imports synthetic records through real HTTP, then inspects exact/ambiguous/unmatched/stale results, rejection/refresh/regeneration, keyboard generation, mobile back navigation and a database assertion of zero allocations. Screenshots are saved as review-ambiguous.png under ignored test-results/.
