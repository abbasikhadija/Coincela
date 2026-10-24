# Milestone status

Updated 2026-10-24 (Asia/Karachi). Authority: MASTER_PLAN.md. Current authorized scope: finish interrupted Milestone 1 only. Milestone 2 is not started.

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
