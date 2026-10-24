# Coincela development rules

Read `docs/MASTER_PLAN.md` completely before initial work; it is the authoritative specification. Before each milestone read this file, PROJECT_SPEC.md, context.md, docs/DECISIONS.md, docs/STATUS.md, docs/ARCHITECTURE.md and docs/DESIGN.md.

Work on one explicitly authorized milestone only. Current authorization: Milestone 1, requested after completion of Milestone 0. Stop after reporting it. Do not start Milestone 2 without the user's instruction.

Use a modular monolith and the specified stack. Preserve compatible code. Separate HTTP, validation, business logic and SQL. Use parameterized queries. Never expose secrets in Vite variables, logs or errors. Do not implement mock financial functionality.

Future financial work must use integer pence/BigInt and string API boundaries, explicit PostgreSQL transactions, workspace ownership constraints and authorization. Lock bank transactions first, then invoices in deterministic identifier order; recalculate balances while locked. Require explicit confirmation, idempotency and atomic audit events. Preserve allocations through reasoned, unique reversals. Never allocate from suggestions alone or trust client balances.

Keep the UI calm and task-focused with progressive disclosure, semantic HTML, visible focus, keyboard access and understandable errors. Never hide financial consequences.

Run relevant unit/API, real PostgreSQL integration, browser tests, typecheck, lint and builds. Report actual commands, failures, skips and infrastructure limitations. Do not claim completion with required checks unexecuted. Update context, status and relevant decisions after each milestone. Never claim a public deployment without checking its URL.

Use `npm ci`, `npm run dev`, `npm test`, `npm run test:integration`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e`. Integration tests require a separate TEST_DATABASE_URL; migration commands use DATABASE_URL. See docs/TESTING.md.
