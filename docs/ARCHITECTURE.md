# Architecture

Current scope: Milestones 0 and 1. A modular monolith with authentication, owned workspaces and a migrated financial schema. Import, matching, allocation and reversal APIs do not exist yet.

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
