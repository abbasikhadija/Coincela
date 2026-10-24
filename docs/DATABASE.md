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

Balances are invoice total minus active allocations and incoming payment minus active allocations, each between zero and its total. Allocation/reversal services enforce these aggregate invariants under bank-first/sorted-invoice row locks; a row CHECK cannot enforce them. Direct SQL can bypass the services and insert inconsistent aggregate balances. Financial writes and audit events commit atomically, without deleting/updating original allocations.

Integration tests apply, reapply, roll back and reapply migrations in a random isolated schema, then remove only that schema. Checks include ownership FKs, exact BIGINT round-trip/overflow, currency and positive-amount constraints, duplicate identities, single-workspace ownership, reversal reason/uniqueness and audit actor ownership. Registration failure injection verifies rollback when session insertion fails.

Milestone 2 uses the existing tables without a schema migration. imports/service.ts writes import_batches/import_errors plus invoices or bank_transactions and candidate review flags in one workspace-serialized transaction. No editable balance columns were introduced. Rejected imports persist metadata/errors only; unexpected SQL failures roll back the whole transaction. Exact completed file repeats reuse the original batch. Existing composite foreign keys and workspace-scoped lookups enforce bank/batch isolation. See IMPORTS.md for matching identities and transport limits.

## Milestone 3 schema extension

1792843300000-matching-runs.cjs adds matching_runs with workspace/transaction composite ownership, a 64-hex snapshot hash, constrained outcome, explanation/warnings, timestamp and uniqueness on workspace/payment/fingerprint. match_suggestions gains nullable run_id for compatibility, a scoped run FK, nonnegative position and unique (run_id,invoice_id). Earlier suggestions remain intact; no released migration is edited.

Current reads derive unallocated/outstanding values by excluding reversed allocations. matching metadata is transactional but separate from financial state. Old run/suggestion records are retained when input changes; stale is derived on reads and stale rejection returns 409. The migration's down removes its generated suggestion/run metadata and columns, leaving financial data and original tables intact. Initial migration down still destroys all domain data. Automated random-schema tests verify both migrations down/up; never roll either back against production without a reviewed recovery plan.

## Milestone 4 transactional writes

No schema change is needed. financial_operations now stores canonical allocation request hashes and complete results; payment_allocations stores one row per selected invoice; audit_events stores one actor/workspace/operation-linked payment_allocated event with request/result. All rows and optional suggestion review_status=confirmed changes share one explicit transaction. Unique workspace/operation keys prevent duplicate effects; scoped composite FKs remain a second ownership boundary. Existing ledger indexes support current balance reads. Original invoices/payment amounts remain immutable. See ALLOCATIONS.md for lock order, isolation and idempotency behavior. Matching/list reads and import record lists derive balances from the same active-allocation rule.

## Milestone 5 reversal writes and history

The existing allocation_reversals table records one full reversal per original allocation through its unique allocation_id, scoped allocation/operation FKs and required reason. Reversal financial_operations rows hold the canonical reason/allocation hash and saved restoration result. One allocation_reversed audit records the owner actor, original operation/allocation links, reason and restored balances in the same transaction. No original allocation or prior audit is updated/deleted. Reversal retries use the same workspace/operation-key namespace as allocations, including cross-kind conflict detection.

Activity summaries/details and related timelines read actual audit events and preserved allocation/reversal rows. Current balances exclude reversed allocations; recorded audit balances retain their historical values. No schema migration or released migration edit is needed. Direct SQL administrators can bypass application history policies; no tamper-proof external log is claimed. See REVERSALS.md for transaction and read contracts.

## Milestone 6 read views

Overview and invoice/payment details add no schema or write path. A read-only repeatable-read transaction derives owned current balances, recent financial events and linked allocation/reversal history. Overview sums integer-pence strings as PostgreSQL numeric and returns text, preserving exact workspace aggregates even beyond one BIGINT. Record history is scoped through the original allocation workspace and joined entities, includes reversed rows and pages at 50. Existing balance/ledger constraints and M4/M5 mutation rules remain unchanged. See WORKSPACE_UX.md.
