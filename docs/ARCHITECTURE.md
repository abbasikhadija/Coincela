# Architecture

Milestone 0: a modular monolith foundation, with no financial domain implementation.

```text
React + HashRouter (GitHub Pages)
    | public API URL / HTTPS in production
Express API (eventually Render)
    | pg connection pool
PostgreSQL (eventually Neon)
```

apps/web owns routes, reusable shell components, CSS/Tailwind tokens and API connectivity. apps/api separates validated configuration, application factory, HTTP errors, database connection and process lifecycle. The application factory permits isolated API tests without opening a listener. `/health` reports process liveness; `/health/ready` runs SELECT 1 and reports 503 without leaking database errors. The UI indicator reports API liveness, not database readiness. Connections and queries have timeouts. Shutdown stops accepting HTTP connections and drains the pool with a deadline.

Only public health endpoints exist. CORS grants configured origins only; CORS is not authentication. Private endpoints and bearer sessions start in Milestone 1. Never put database settings in Vite env. pg reads TLS parameters from DATABASE_URL; production must verify certificates.

Planned modules: auth, workspaces, bank-accounts, invoices, transactions, imports, matching, allocations, audit, dashboard. Planned entities: users, workspaces, sessions, bank_accounts, invoices, bank_transactions, import_batches, import_errors, match_suggestions, payment_allocations, allocation_reversals, audit_events. These are not created yet.

Future data design requires composite workspace foreign keys and unique constraints alongside server authorization, BIGINT pence with string API serialization, derived balances from active allocations and reversals, positive allocations, one reversal per allocation and operation-id uniqueness. Every financial transaction locks bank records first, then invoice identifiers in deterministic order, recomputes balances, validates, writes allocations/reversals and audit events, then commits; any failure rolls back everything. Matching never mutates financial state. Full schema and constraints will be documented when implemented in the authorized milestone.
