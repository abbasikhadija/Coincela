# Current development context

Milestones 0 and 1 are implemented. The interrupted operation was final Milestone 1 verification/documentation, not a Git push. Resume recovery preserved all application changes and tests; no reset, clean, commit, remote change or push was performed. Do not start Milestone 2 until explicitly requested.

Repository root: C:/Users/User/Coincela. Git now resolves to this directory (the old user-profile-root note is obsolete). Current branch main; latest commit 5cfb882, chore: initialize Coincela milestone 0. Configured origin: https://github.com/abbasikhadija/Coincela.git. Milestone 1 source, tests and docs remain modified/untracked and must be preserved. No remote synchronization or public deployment is claimed.

Architecture: npm workspaces apps/api and apps/web; Node 22.14; React/Vite/Tailwind/HashRouter at /Coincela/. Development API 3001, Vite 5173; browser-test API 3002 and production preview 4173. Vite proxies /api to the API root. Production requires public HTTPS VITE_API_URL, or explicitly reports missing configuration. Never place database secrets in Vite settings.

Milestone 1 adds scrypt password hashes, atomic user/workspace/session registration, login/logout, SHA-256-hashed opaque random bearer sessions with fixed 30-minute expiry, protected identity/workspace endpoints and strict CORS. Client tokens live in memory/sessionStorage; server expiry/revocation is authoritative. Workspace reads/renames enforce owner IDs in SQL. Registration/login attempts have a bounded per-process limiter. Public health/readiness remain available.

The initial migration creates auth/workspace and required financial tables with workspace-scoped foreign keys, GBP and BIGINT pence constraints, duplicate identifiers and reversal uniqueness. money.ts uses BigInt and explicit string serialization. Aggregate financial balance rules, locked allocation transactions, matching/import/reversal services and audit immutability are later milestone work; no such mutation APIs are exposed. See docs/DATABASE.md and docs/ARCHITECTURE.md.

PostgreSQL 18 native binaries: C:/Program Files/PostgreSQL/18/bin. Ignored .local/postgres runs loopback port 55432, database/role coincela_test; coincela_e2e is disposable browser-test data. Local trust authentication is for synthetic test data only, never production. Docker remains unavailable. Integration tests create/drop only random test schemas and exercise migration up/down/up. Browser tests migrate the separate disposable DB and use real API responses. Test usernames/accounts are synthetic.

Latest recovery verification and actual commands are recorded in docs/STATUS.md. Development servers may already be running; inspect ports before starting another instance. The existing local QA helper .local/visual-check.mjs can smoke-test registration/settings/logout via the Vite proxy and save mobile form screenshots. Do not assume earlier test logs prove current success.

Next: Milestone 2 CSV imports, not authorized in this recovery execution. Preserve docs/MASTER_PLAN.md and the unrelated empty text file. No new architectural decisions were needed during recovery.
