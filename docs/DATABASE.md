# PostgreSQL schema — Milestone 1

Migration: apps/api/migrations/1792843200000-foundation.cjs. IDs use UUIDs, business dates use date, and event timestamps use timestamptz. No financial records are seeded. node-pg-migrate uses transactions, advisory locking and pgmigrations history. Rollback of the initial migration drops domain tables and destroys their data; use disposable data or a reviewed recovery plan.

| Table | Purpose and enforced constraints |
| --- | --- |
| users | Unique normalized lowercase email; password hash; creation timestamp |
| workspaces | Unique owner FK to users (one workspace per user); nonblank name up to 100 characters; GBP only; unique (id,owner) |
| sessions | User FK; unique 64-hex token hash; expiry after creation; optional revocation; user/expiry indexes |
| bank_accounts | Workspace FK; unique name per workspace; GBP; unique (workspace,id) |
| import_batches | Composite workspace/account FK; invoice/transaction account consistency; nonnegative bounded outcome counts; completed-file hash uniqueness per workspace/kind/account, including null invoice account |
| import_errors | Composite workspace/batch FK; positive row number when present |
| invoices | Composite workspace/batch FK; unique invoice number per workspace; nonnegative BIGINT pence; GBP; due date at or after issue date |
| bank_transactions | Composite workspace/account and batch FKs; positive BIGINT pence; GBP; unique external ID within workspace/account; null IDs allow legitimate identical-looking transfers |
| match_suggestions | Composite workspace/transaction and invoice FKs; positive suggested pence; constrained category/status; explanation, evidence and warnings |
| financial_operations | Unique workspace-scoped operation key; request hash and JSON result; allocation/reversal kind; parent for future split-operation idempotency |
| payment_allocations | Composite workspace/operation, transaction and invoice FKs; positive BIGINT pence; unique operation/transaction/invoice row |
| allocation_reversals | Composite workspace/allocation and operation FKs; unique original allocation; nonblank reason up to 1000 characters |
| audit_events | Composite workspace/actor FK ensures actor owns that workspace; optional workspace/operation FK; event details/timestamp |

Referenced workspace entities have unique (workspace_id,id) keys. PostgreSQL rejects cross-workspace relationships independently of the frontend. Current workspace endpoints additionally enforce authenticated ownership in every query. Foreign keys never cascade-delete financial history. No financial DELETE or UPDATE service exists.

Money uses integer pence bounded by signed PostgreSQL BIGINT (maximum 9223372036854775807). pg returns BIGINT as strings. money.ts uses BigInt, rejects malformed decimals, unsupported currencies and overflow, and explicitly serializes minor units as strings. Do not convert money to JavaScript Number.

Future balances are invoice total minus active allocations and incoming payment minus active allocations, each between zero and its total. These aggregate invariants require locked transactional services in Milestone 4; a row CHECK cannot enforce them. Direct SQL can currently insert inconsistent aggregate balances. This foundation does not claim a working allocation service. Immutability policies and transaction-bound audit writes must accompany the later services; those services must never delete original allocations.

Integration tests apply, reapply, roll back and reapply migrations in a random isolated schema, then remove only that schema. Checks include ownership FKs, exact BIGINT round-trip/overflow, currency and positive-amount constraints, duplicate identities, single-workspace ownership, reversal reason/uniqueness and audit actor ownership. Registration failure injection verifies rollback when session insertion fails.
