# Coincela accepted specification

Authority: [MASTER_PLAN.md](docs/MASTER_PLAN.md). Tagline: **Every payment accounted for.** Target users are freelancers, consultants and small service businesses reconciling spreadsheet invoices with incoming bank transfers.

The accepted MVP is GBP-only: one workspace per user; registration/login with 30-minute opaque bearer sessions (hashed server records; memory/sessionStorage client); CSV invoice and named-bank-account imports with bounded validation and explicit duplicate reporting; deterministic explainable suggestions; explicitly confirmed full, partial and split allocations; derived balances; idempotency; concurrency protection; reversals and audit history. No banking/payment integrations, accounting ledger, AI, currency conversion, teams or billing.

Financial acceptance: integer pence with safe string boundaries; nonnegative bounded balances; atomic allocations plus audits; bank-first deterministic locking; revalidation under locks; no cross-workspace access; same operation identifier returns identical results or rejects conflicting payloads; one reasoned reversal per original allocation. No silent reconciliation.

Stack: React/TypeScript/Vite/Tailwind/HashRouter; Node/Express/TypeScript/Zod/pg/node-pg-migrate/csv-parse; PostgreSQL; npm workspaces; Docker Compose; Vitest/Supertest/Playwright; GitHub Actions. Eventual deployment: GitHub Pages → Render → Neon over HTTPS with strict CORS.

Milestone sequence: 0 foundation, design system and deployment preparation; 1 authentication and financial model; 2 CSV imports; 3 suggestions; 4 transactional allocations; 5 reversals/audit; 6 complete UX; 7 reliability, benchmarks and public deployment. Only Milestone 0 is authorized.

Milestone 0 acceptance: runnable API with health/errors/environment validation/connection pool/migration commands; runnable calm responsive frontend shell with Overview, navigation, reusable styles and API indicator; Pages base and hash routing; independent production build; env examples; CI and official Pages deployment; unit/API/real database/browser verification plus lint/typechecks/build. No hosting credentials required. All required tests must pass before declaring this milestone complete.
