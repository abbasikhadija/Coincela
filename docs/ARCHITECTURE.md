# Architecture

Current scope: Milestones 0–3. A modular monolith with authentication, owned workspaces, validated CSV imports and deterministic matching suggestions. Allocation and reversal APIs do not exist yet.

```text
React + HashRouter (GitHub Pages)
    | HTTPS + Authorization: Bearer <opaque token>
Express API (eventually Render)
    | pg pool / parameterized SQL
PostgreSQL (eventually Neon)
```

apps/web owns the shell, route protection, AuthProvider, forms/settings and public API connectivity. AuthProvider keeps token metadata in memory and sessionStorage only, restores identity through /auth/me, expires the session at its fixed deadline and clears it on protected-request 401. Temporary network failures preserve refresh credentials and offer retry. Logout clears local state only after API revocation. No cookies or localStorage authentication are used.

apps/api separates validated process configuration, HTTP routes/validation, auth service/repository, password hashing, money utilities, connection pool and lifecycle. The application factory accepts a pool for tests. /health reports process liveness; /health/ready checks real PostgreSQL. Both are public. Safe error responses never expose SQL, password hashes, tokens or connection strings. Auth responses use Cache-Control: no-store.

Passwords use asynchronous scrypt with random 16-byte salts, N=32768/r=8/p=3 and constant-time derived-key comparison. Unknown accounts perform the same expensive derivation. Tokens contain 32 random bytes; only SHA-256 hashes are stored. Session expiry uses PostgreSQL time, defaults to 30 minutes and does not slide on access. Revoked, expired and unknown tokens cannot resolve a principal. Private handlers derive identity from that principal, never a supplied owner ID.

Registration hashes before opening a transaction, then atomically inserts user, workspace and session. Unique normalized email and owner constraints handle duplicate/concurrent requests; any failure rolls back all three records. Login verifies credentials before inserting a new independent session. Logout revokes only the authenticated session. Workspace reads/updates include both resource ID and authenticated owner in SQL; other workspaces return 404. Rename is one atomic SQL statement. Financial references use composite workspace keys; see DATABASE.md.

Origins are checked before request processing: unlisted origins receive 403, including mutation requests. CORS explicitly supports Content-Type/Authorization and GET/POST/PATCH/OPTIONS without credentials. Missing Origin permits non-browser clients but never replaces bearer authentication. Production frontend/origin configuration requires HTTPS. A bounded per-process limiter allows 30 combined registration/login attempts per IP per 15 minutes. Proxy headers are not trusted by default; host-specific proxy trust and shared limits need review before production scaling.

Future financial transactions must lock bank records first, then invoices in deterministic identifier order, recompute balances under locks, validate, write allocations/reversals and audit events, then commit atomically. Matching does not mutate money. The current schema establishes structural constraints, not aggregate balance enforcement; financial mutation endpoints remain unavailable.

## Milestone 2 import module

imports/parser.ts validates bounded UTF-8 CSV into normalized records without touching SQL. imports/service.ts hashes files, opens a transaction, locks the owned workspace, checks bank scope/duplicates, and persists either rejected metadata/errors or all valid new records plus batch metadata. A SQL failure rolls back all effects. imports/routes.ts handles protected HTTP transport, named accounts, paginated imports/invoices/transactions and scoped batch errors. It is mounted after existing session middleware. See IMPORTS.md for exact contracts and limits.

The frontend ImportCenter provides samples, file/bank selection, validation errors, explicit skipped/review counts, import history and sequential next actions. RecordList renders invoice and payment rows with exact BigInt decimal formatting. Distinct route keys prevent stale payment rows rendering as invoices. Matching and financial allocation services remain absent; Milestone 3 is not started.

## Milestone 3 matching module

matching/engine.ts is a pure deterministic rules engine with no database or allocation capability. repository.ts reads exact derived balances and stable workspace evidence; service.ts manages repeatable-read snapshots, idempotent matching runs, ordered suggestions, stale checks and review-only rejection. routes.ts exposes protected matching list/detail/generate/reject endpoints. GET transactions are read-only; POST writes matching metadata only, with workspace row locking and bounded generation retries. It never calls financial mutation services. See RECONCILIATION.md for rule/version/fingerprint contracts.

The new matching-runs migration preserves the released initial migration. matching_runs represents no-match and current snapshot outcomes; match_suggestions references a scoped run and stores candidate position/evidence/status. Repeat generation reuses identical snapshots; changed snapshots preserve prior runs. Fingerprints conservatively include all workspace invoice evidence and allocation/reversal identities. A response is current as of its read snapshot and must not substitute for later locked allocation validation.

The frontend ReviewPayments workspace uses selected payment query parameters for refresh continuity, one focused master-detail layout on desktop and sequential list/detail navigation on mobile. Evidence/warnings and amounts remain visible. Rejection never promotes a candidate automatically. No confirmation controls or financial mutation API are exposed.
