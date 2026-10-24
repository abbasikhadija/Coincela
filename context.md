# Current context

Scope: Milestone 0 only. The complete master plan has been read (2,023 lines). No pre-existing application code was present. Preserve docs/MASTER_PLAN.md and the unrelated empty text file.

Repository root for all commands is `C:/Users/User/Coincela`. The enclosing Git repository resolves to `C:/Users/User`; do not stage, clean or otherwise operate broadly on that parent. No Coincela remote or deployment has been verified.

Implementation: npm workspaces in apps/api and apps/web. Node 22.14; API port 3001; Vite port 5173; production preview 4173; Pages base `/Coincela/`; HashRouter. Development Vite proxies `/api`. Production requires public VITE_API_URL or displays an explicit unconfigured state. Only health/readiness endpoints exist; domain pages are labeled placeholders. No authentication, domain tables, CSV operations or financial mutations exist.

PostgreSQL 18 binaries exist under `C:/Program Files/PostgreSQL/18/bin`. Docker is unavailable in this environment. A disposable loopback-only test cluster is under ignored `.local/postgres`, port 55432, database/role coincela_test. It uses local trust authentication for test data only. Never use that configuration for production. Local development servers were left running on ports 3001 and 5173 with this isolated database configured through process environment. Latest local checks: 25 tests pass, lint/typecheck/build/clean npm ci pass, zero known audit findings. Independent production frontend builds without backend configuration. See STATUS for commands and external limitations.

Next milestone is 1, authentication and financial data foundation, and must await explicit authorization.
