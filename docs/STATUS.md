# Milestone status

Updated 2026-10-24 (Asia/Karachi). Authority: MASTER_PLAN.md. Current authorized scope: Milestone 3 explainable matching. Milestone 4 is not started.

## Milestone 0 — Foundation, design system, and deployment preparation

Historical Milestone 0 report: implementation and local verification completed. The current Milestone 1 recovery report follows below.

Implemented npm workspaces; Express/TypeScript API; liveness and real database readiness endpoints; sanitized JSON errors; Zod environment validation; bounded pg pool; graceful process shutdown; migration/rollback commands; PostgreSQL 18 Compose setup. React/TypeScript/Vite/Tailwind shell includes HashRouter, Overview, navigation placeholders, reusable Button/Field/Panel, locally bundled Inter, responsive design tokens, focus styles, keyboard skip link, API liveness/retry feedback and explicit unconfigured production state.

Documentation: AGENTS.md, PROJECT_SPEC.md, context.md, README.md, ARCHITECTURE.md, DESIGN.md, DECISIONS.md, DEPLOYMENT.md, TESTING.md and MIGRATIONS.md. MASTER_PLAN.md was read completely and preserved.

Deployment preparation: `/Coincela/` Vite base, public API env examples and GitHub Actions verification with isolated PostgreSQL and official Pages upload/deploy actions. Failed checks gate deployment. A separate final build uses public deployment configuration rather than test settings.

### Verification results

| Command / check | Actual result |
| --- | --- |
| `npm install`, dependency updates and deduplication | Succeeded; versions aligned to Node 22.14 |
| `npm ci` | Clean lockfile install passed, 0 known vulnerabilities |
| `npm test` | 20 passed: 14 API/environment; 6 frontend/client/components |
| `npm run test:integration` | 1 passed against real PostgreSQL 18, including HTTP readiness |
| `npm run db:migrate` | Passed against isolated DB; no domain migrations to run |
| `npm run db:rollback` | Passed against isolated DB; no domain migrations to revert |
| `npm run typecheck` | Passed for both workspaces |
| `npm run lint` | Passed |
| `npm run build` with `VITE_API_URL=https://api.coincela.test` | Both production builds passed |
| `npm run build -w @coincela/web` with empty VITE_API_URL | Independent production frontend build passed without backend credentials |
| `npx playwright install chromium` | Succeeded |
| `npm run test:e2e` | 4 passed: desktop/mobile built assets, real local API, hash navigation and refresh, active route, no viewport overflow, skip link focus, unavailable/retry |
| `npm audit --audit-level=low` | 0 known vulnerabilities |
| Compose and Actions YAML parse via installed `js-yaml` | Both valid YAML; workflow reviewed for check/deploy dependency |
| Desktop/mobile screenshots | Visually inspected; readable layout, working hierarchy and no content overflow |
| `npm run dev` and local HTTP smoke check | Both servers started; frontend 200, API ok, database connected, Vite API proxy returned coincela-api |

Latest required test runs: **25 passed, 0 failed, 0 skipped** (20 unit/API/UI + 1 database integration + 4 browser). Browser tests forward the test-only HTTPS hostname to the actual local Express process; they do not simulate health responses. No financial, auth or concurrency tests are claimed at this stage.

Initial failures were resolved: unsupported Testing Library query option; unused Express error-handler argument; README incorrectly loaded as a migration; incompatible duplicate Vite plugin types. Initial dependency audit findings were resolved with compatible package updates. An auxiliary YAML validation attempt failed because `yaml` was absent; rerun using existing `js-yaml` succeeded. Earlier failed runs are not counted as the final passing results.

### Engineering and UX decisions

Explicit app factory and separate liveness/readiness make failures testable. PostgreSQL remains the future financial authority. No domain migrations or money logic were introduced. HTTPS production configuration and no Vite secrets preserve the deployment boundary. The UI clearly labels its preview status and future workflows, uses one primary action, visible focus, text-based connection status and a sequential mobile layout.

### Limitations and remaining external checks

- Docker is not installed, so Compose execution could not be verified locally. Equivalent connectivity was verified using a disposable loopback-only native PostgreSQL 18 cluster at port 55432 in ignored `.local/postgres`, database/role coincela_test. CI has its own PostgreSQL service.
- Coincela is nested under an unrelated user-profile Git root; no dedicated Coincela remote has been verified. No broad Git staging or parent-repository changes were made.
- GitHub Actions execution, repository Pages settings and public deployment cannot be claimed from local YAML validation. No verified public URLs exist. Render and Neon provisioning are intentionally deferred; credentials are not required for Milestone 0.
- Accessibility checks cover foundation semantics, focus, keyboard interaction and responsive layout; they do not establish full WCAG conformance.
- Current navigation destinations are explicit placeholders. Authentication, domain schema, imports, matching, allocations and reversals are not implemented.

### Next milestone

At the end of Milestone 0, Milestone 1 required authorization. It was subsequently authorized and implemented; see the current report below.

## Milestone 1 — Authentication and financial data foundation

Recovered after interruption on 2026-10-24 (Asia/Karachi). The interrupted task was final verification/documentation of Milestone 1. It was not a Git push operation. Existing working implementations, migrations, tests and documentation were preserved. Recovery found stale context, status and README content rather than missing application functionality.

### Implemented and recovered

- Registration atomically creates user, single owned workspace and session. Normalized email uniqueness handles duplicates, including simultaneous requests. Failure during session creation rolls back the account/workspace.
- Asynchronous salted scrypt password hashing, secure random 32-byte opaque tokens, SHA-256 token hashes only in PostgreSQL, fixed 30-minute server expiry, logout revocation, protected identity and workspace routes.
- Strict origin rejection before mutation and Authorization preflight without cookies; bounded registration/login attempts; owner-scoped workspace reads/renames.
- Registration/login screens, authenticated shell, sign out, basic workspace settings, refresh restoration, expiry/401 recovery and temporary-outage feedback. Tokens use memory/sessionStorage only.
- Initial relational financial schema with workspace-scoped foreign keys, GBP/BIGINT constraints, duplicate identity and reversal constraints. Exact BigInt money parsing and explicit string serialization. No import/matching/allocation/reversal services are implemented.

Important files: apps/api/src/auth/*, apps/api/src/money.ts, apps/api/migrations/1792843200000-foundation.cjs, apps/web/src/auth.tsx, apps/web/src/AuthPages.tsx, apps/web/src/App.tsx, API/UI test suites, tests/e2e/auth.spec.ts and docs/DATABASE.md.

### Milestone status

**Milestone 1 complete, locally verified.** No required Milestone 1 functionality remains outstanding. External deployment verification remains unclaimed.

### Fresh recovery verification

| Command | Actual result |
| --- | --- |
| npm test | 50 passed: 37 API/environment/password/money + 13 frontend/client tests |
| npm run test:integration with isolated TEST_DATABASE_URL | 12 passed against native PostgreSQL 18, including migration up/down/up, auth/ownership, CORS, constraints, concurrent duplicate registration and injected-failure rollback |
| npm run build with VITE_API_URL=https://api.coincela.test | API and production frontend builds passed |
| npm run test:e2e with coincela_e2e disposable DB | 8 passed, desktop/mobile Chromium; actual Express API and PostgreSQL, settings/refresh/logout/login/server expiry, protected routes, hash refresh, asset paths, keyboard skip focus and network retry |
| npm run typecheck | Both workspaces passed |
| npm run lint | Passed |
| npm run build -w @coincela/web with empty VITE_API_URL | Passed independently without backend credentials |
| node .local/visual-check.mjs | Development Vite proxy registration/settings/logout passed; mobile registration and settings screenshots visually reviewed |
| npm audit --audit-level=low | 0 known vulnerabilities |
| git diff --check | Passed; only Git LF/CRLF conversion notices |

All 70 automated tests passed, zero failures and zero skips in these fresh recovery runs. No previous success was assumed. The earlier interrupted run had resolved obsolete public-overview expectations and a mistaken test matcher; these did not recur. Browser tests forward a test-only HTTPS hostname to the real local API; they do not fake authentication responses. Financial allocation/concurrency guarantees are intentionally not claimed by Milestone 1.

### Engineering and UX decisions

Existing documented decisions were retained: fixed server-backed bearer sessions, ownership checks in SQL plus composite schema keys, exact pence arithmetic, safe errors and atomic registration. The existing calm design, minimal account fields, separate settings and plain recovery messages were preserved. No new architectural decision was needed during recovery.

### Git and external limitations

Git recovery inspection found a dedicated C:/Users/User/Coincela repository, branch main, latest commit 5cfb882 (chore: initialize Coincela milestone 0), and origin https://github.com/abbasikhadija/Coincela.git. The old user-profile Git-root warning is obsolete. All Milestone 1 modifications and untracked additions remain preserved and uncommitted. Recovery did not reset, clean, discard, commit, modify remotes or push.

Docker remains unavailable locally; real database verification used native PostgreSQL 18 on loopback port 55432. GitHub Actions execution, Pages settings, Render/Neon and public HTTPS deployment were not verified. Browser-readable token storage retains documented XSS risk. Full WCAG conformance and host-specific proxy/shared rate-limit configuration remain later production review work. Aggregate financial invariants require the later locked transactional services; those endpoints are not exposed now.

### Remaining scope

Milestone 2 (CSV imports) is not started and requires explicit instruction. No Milestone 2 functionality was added during recovery.

## Milestone 2 — CSV import workflow

Completed and locally verified on 2026-10-24 (Asia/Karachi). Milestone 1 was committed before this work as 104014a. Milestone 3 was not started.

### Implemented

- Protected invoice and incoming-payment CSV upload, strict file/header/row validation, real dates, exact GBP pence normalization, quoted/escaped/multiline fields, fatal UTF-8 validation and meaningful file/row errors.
- Limits: 1 MiB decoded CSV, 1,000 data rows, 16,000-character parser record and 500-character text fields. Invoice amounts cannot be negative; payments must be positive incoming credits.
- Full-file atomic import policy. Workspace locking serializes imports and duplicate inspection. New records, batch metadata and uncertain-payment review flags commit together. Rejected files store history/errors and insert no financial records; SQL failure rolls back all records and metadata.
- Explicit completed-file hash repeats; reliable invoice/external-payment identity skips; conflicting identities reject the file. Legitimate identical-looking transfers remain stored and require duplicate review, including prior candidates. No silent financial discard or allocation.
- Named workspace-owned bank accounts; paginated import history, invoice and contextual incoming-payment lists; scoped error retrieval. No raw uploaded files persist on disk.
- Import Center with synthetic sample downloads, native labeled file input, account selection/creation, row validation feedback, inserted/skipped/review summary, next steps, history and record browsing. Overview directs users to invoice import. Matching remains explicitly unavailable.

Important files: apps/api/src/imports/parser.ts, service.ts and routes.ts; apps/api/test/import-parser.test.ts and imports.integration.test.ts; apps/web/src/ImportCenter.tsx, src/test/imports.test.tsx and public/samples/*.csv; tests/e2e/imports.spec.ts; docs/IMPORTS.md. Reused existing schema and auth middleware without modifying the committed migration. Updated AGENTS, PROJECT_SPEC, context, README, architecture, design, database, testing, deployment and decisions.

### Verification

| Command/check | Actual final result |
| --- | --- |
| npm test | 77 passed: 59 API/environment/password/money/CSV parser; 18 frontend/client/component tests |
| npm run test:integration with isolated TEST_DATABASE_URL | 29 passed against native PostgreSQL 18, including import atomicity, errors/history, duplicate identities/files, legitimate identical payments, unauthorized/foreign account rejection, exact money, pagination, overlapping imports and forced rollback |
| npm run typecheck | Both workspaces passed |
| npm run lint | Passed |
| npm run build with VITE_API_URL=https://api.coincela.test | API and production frontend passed |
| npm run test:e2e with disposable coincela_e2e database | 10 passed, desktop/mobile Chromium, actual API/PostgreSQL responses; invoice/payment uploads, sample download, keyboard submission, invalid-file correction, file repeat, bank selection, duplicate warnings, lists, refresh, history/errors plus existing auth/connectivity/navigation checks |
| npm run build -w @coincela/web with empty VITE_API_URL | Independent build without backend credentials checked separately |
| npm audit --audit-level=low | 0 known vulnerabilities |
| Desktop/mobile import screenshots | Visually reviewed; visible guidance/errors/warnings and local horizontal table scrolling; no viewport overflow in browser assertions |

Final automated total: **116 passed, 0 failed, 0 skipped**. Test data is synthetic. No financial matching/allocation or performance benchmark claims are made.

Resolved earlier failures: the parser's info-enabled return type needed an explicit typed assertion; lint found a mutable declaration and an unavailable hook-rule suppression; frontend test queries contained an unsupported exact option. Independent integration suites initially competed for node-pg-migrate's shared advisory lock, causing one suite to skip after setup failure; random-schema-derived test lock IDs resolved that conflict while leaving production locking intact. Browser tests found stale payment-list state reused as invoice rows on route change; distinct route keys fixed it. One repeat browser attempt used the previous bundle after a failed typecheck/build; final verification was rerun only after a successful rebuild. These failed runs are not hidden or counted as final passing results.

### Engineering and UX decisions

Raw text/csv uploads avoid multipart/filesystem dependencies. Strict bounded synchronous CSV parsing is adequate for this narrow upload size. Exact file identity is scoped by workspace, kind and bank account. The workspace lock makes identity checks and inserts atomic across simultaneous imports. Visible payment similarity requires review rather than dropping data. Import history retains rejected outcomes and explicit errors. Page-based lists return 50 records and stable newest-first ordering.

The UI uses one type selector and upload action, reveals bank-account setup only for payments, shows format limits up front, and gives plain corrective errors and next steps. Native labels, keyboard form submission and status/error announcements preserve accessibility. Payment browsing stays contextual, and lists display string pence with BigInt arithmetic. Table containers scroll on mobile; no extra primary navigation was added.

### Limitations

Docker is unavailable locally; database verification used real native PostgreSQL 18 on loopback 55432. Hosted CI and public deployment remain unverified. Large-file streaming, arbitrary bank-specific column mapping and outgoing transfers are intentionally unsupported. Completed exact file reuploads reference their original history batch; transport/auth/account-selection failures and unexpected SQL rollbacks do not produce separate batch records. No duplicate-resolution mutation or matching suggestion service exists yet. Full WCAG conformance is not claimed.

After verification, the user requested a local commit. Milestone 2 is included in feat: add atomic CSV import workflow; no push was requested. Existing work was preserved. Next milestone: **3 — explainable matching engine**, awaiting explicit instruction. Stop here.

## Milestone 3 — Explainable matching engine

**Completed and locally verified, 2026-10-24 (Asia/Karachi).** Scope followed the next incomplete milestone after ba9839a. Milestone 4 was not started.

### Implemented

- Pure deterministic rules: exact reference priority with identifier boundaries; normalized payer/customer/description evidence; exact current-balance amount comparisons; date context; stable evidence ranking and invoice-ID tie order.
- Exact reference, strong, possible, ambiguous and no-match outcomes. Multiple plausible candidates remain visibly ambiguous. Closed invoices and fully allocated payments do not generate candidates. Partial/excess amounts, duplicate risk, payer disagreement, early dates and amount-only weakness are explained without numerical confidence percentages.
- PostgreSQL-derived outstanding/unallocated balances exclude reversed allocations. Repeatable-read snapshots plus engine/payment/invoice/ledger fingerprints detect stale evidence. Old candidates are hidden, regeneration creates current metadata, and stale rejection returns 409. Reads and payment-list review states use current snapshot evidence.
- matching_runs persists overall outcomes including No match. Scoped run/candidate keys and ordered positions make repeated generation idempotent. Concurrent generation retries metadata races in fresh transactions. Rejected status is preserved for the same snapshot; previous run history is retained after changes.
- Protected matching list/detail/generate/reject endpoints; workspace isolation, structured errors and sanitized failures. Generation/rejection only write review metadata and do not alter invoices, payments, allocations, reversals, financial operations or audits.
- Review Payments desktop master-detail and sequential mobile UI: one selected payment, current amounts, payer/reference/date, invoice totals/outstanding/suggested amounts, evidence/warnings, review labels, rejection, refresh and regeneration. Selected payment survives refresh through the route query. Five candidates show initially with progressive reveal. Import completion links to review. No allocation confirmation control exists.

Important files: apps/api/src/matching/{engine,repository,service,routes}.ts; apps/api/migrations/1792843300000-matching-runs.cjs; apps/api/test/fixtures/matching.json; matching.test.ts and matching.integration.test.ts; apps/web/src/ReviewPayments.tsx and src/test/review.test.tsx; tests/e2e/matching.spec.ts; docs/RECONCILIATION.md. Existing initial migration was preserved. Updated project instructions/spec, context, README, architecture/schema/design/testing/migration/deployment docs and decisions.

### Actual verification

| Command/check | Final result |
| --- | --- |
| npm test | 102 passed: 78 API/environment/password/money/CSV/matching unit tests; 24 frontend/client/component tests |
| npm run test:integration with isolated TEST_DATABASE_URL | 38 passed against native PostgreSQL 18, including matching snapshots/outcomes, current/rejected/stale list states, derived active allocation/reversal balances, concurrent generation, metadata rollback, scoped access and unchanged financial records |
| npm run typecheck | Both workspaces passed |
| npm run lint | Passed |
| npm run build with VITE_API_URL=https://api.coincela.test | API and production frontend passed |
| npm run test:e2e with isolated coincela_e2e DB | 12 passed, desktop/mobile Chromium, actual Express/PostgreSQL. Matching flow covers exact, ambiguous and unmatched suggestions, visible evidence/warnings, rejection, refresh continuity, new-import staleness, regeneration, keyboard generation, mobile navigation and zero allocations |
| npm run db:migrate against local coincela_test | New matching migration applied successfully |
| npm run build -w @coincela/web with empty VITE_API_URL | Passed without backend configuration |
| npm audit --audit-level=low | 0 known vulnerabilities |
| Review screenshots | Desktop/mobile ambiguity/evidence/amounts/warnings and unconfirmed status visually inspected; no viewport overflow in browser assertions |

**152 passed, 0 final failures, 0 skipped.** Independent hand-authored fixture covers 16 matching cases; additional unit tests verify warning details, deterministic input-order independence, immutable inputs and large exact values. Real database tests seed later financial states only through fixture SQL, without adding financial mutation endpoints. Both schema migrations are exercised through disposable-schema down/up verification. Repeated testing followed material list-state changes; no failed tests were ignored.

Initial typechecks found an untyped PostgreSQL candidate result and a missing JSON import attribute under NodeNext. Both were corrected; final checks passed. No dependency changes were needed. No failed/ignored financial tests, synthetic accuracy claims or hosted deployment claims are made.

### Engineering and UX decisions

Keep the matching engine pure and separate from future allocations. Persist a matching run for No match and use conservative full-workspace invoice/ledger fingerprints to make staleness explicit. Store candidate order rather than relying on random suggestion IDs. Metadata transactions never substitute for Milestone 4 financial locks/validation. Workspace row locking serializes with imports; bounded retries handle concurrent generation safely.

Show only the selected payment as the focus. Keep amounts/evidence/warnings visible and suggestions unconfirmed. Mobile uses sequential navigation with retained query selection and page context. Ambiguity remains explicit even after rejecting one candidate. Manual refresh detects changed data; no hidden automatic allocation or polling occurs.

### Remaining limitations

Matching is deliberately conservative, uses normalized exact names rather than fuzzy/AI identity, and may return false candidates or no match. A current response is as of its snapshot and can become stale after it returns; manual refresh/reload rechecks. Unrelated invoice imports can invalidate prior results. Rejection is specific to its snapshot; changed snapshots require review again. No split/confirmation/allocation or reversal workflow is implemented. The future allocation service must acquire bank-first/sorted-invoice locks, recalculate balances and atomically commit idempotent financial effects plus audits.

Docker unavailable locally; verification used native PostgreSQL 18. Public deployment, hosted CI and full WCAG conformance remain unverified. No performance/precision/recall benchmark was run in this milestone. Milestone 3 changes remain uncommitted; no commit/push requested or performed.

Next milestone: **4 — transactional payment allocation**, awaiting explicit instruction. Stop here.

### Recovery verification — 2026-10-24

Recovery after the unresponsive chat found the M3 implementation and completion documentation already present on main at base ba9839a, with all M3 changes uncommitted. The existing Playwright last-run record was passed (21:41:59 local time), with desktop/mobile review screenshots. No active milestone verification runner was found. Evidence therefore indicates M3 had finished verification before the chat became unresponsive; the exact cause of the chat failure cannot be determined from repository artifacts.

Fresh bounded checks verified the existing work without restarting implementation:

| Command | Recovery result |
| --- | --- |
| npm test | 102 passed (78 API/unit, 24 frontend), no skips |
| npm run test:integration | 38 passed against real PostgreSQL, no skips; includes stale-result detection, workspace isolation, concurrent generation, rollback, unchanged financial records and migration round trips |
| npm run typecheck | Passed both workspaces |
| npm run lint | Passed |
| npm run build with VITE_API_URL=https://api.coincela.test | Passed API and frontend |
| npm run test:e2e -- --global-timeout=180000 --timeout=30000 --workers=2 | 12 passed in 51.4 seconds, desktop/mobile Chromium, real API/PostgreSQL; no skips |
| npm run build -w @coincela/web with empty VITE_API_URL | Passed after browser tests, removing the test hostname from the local build |
| git diff --check | Passed, with only LF/CRLF notices |

Final fresh total: **152 passed, zero final failures or skips**. Desktop/mobile review screenshots were visually inspected. Matching API, engine, repository, migration, review UI and test coverage were inspected; no incomplete M3 functionality required a code change.

The first integration attempt failed with ECONNREFUSED on port 55432 (1 failed, 37 skipped due to setup failure). The existing local test cluster was stopped. A first pg_ctl start used its default port and failed to bind; restarting the same preserved cluster with explicit loopback port 55432 succeeded within its 30-second bound. The integration rerun then passed all 38 tests. No database reinitialization or data deletion occurred. Test/lint/build processes had 120–210 second outer limits; no limit was reached.

npm ci, npm run dev and npm audit were not repeated: installed dependencies were usable, no dependency changes existed, and Playwright started its own real API/production preview. The earlier audit result above remains historical, not a new audit claim. Public deployment and hosted CI remain unverified. Recovery changed documentation only; no reset, clean, commit, push or M4 work occurred. **M3 is complete and locally verified; stop here.**
