# Milestone status

Updated 2026-10-24 (Asia/Karachi). Authority: MASTER_PLAN.md. Authorized scope: Milestone 0 only.

## Milestone 0 — Foundation, design system, and deployment preparation

Implementation and local verification completed. No Milestone 1 work has begun.

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

Milestone 1: secure authentication and financial data foundation. **Not started. Await explicit user instruction.**
