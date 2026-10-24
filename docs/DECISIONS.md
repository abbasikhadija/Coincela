# Engineering decisions

2026-10-24, Milestone 6:

- Keep the signed-out product explanation and authenticated Overview at the existing root route, with private resource routes still guarded. Preserve expiry/restoration messages and existing financial services rather than adding a separate demo finance path.
- Derive Overview totals and next actions from an owned read-only repeatable-read snapshot. Payments requiring review means positive unallocated pence; expose that definition. PostgreSQL numeric sums/string JSON and BigInt formatting handle aggregates beyond one BIGINT without floating-point loss. Show only two primary measures and at most five recent events.
- Add scoped invoice/payment detail reads and 50-row linked allocation/reversal history. Reuse existing derived-balance SQL; add no schema/mutations. Original and reversed history stays visible, with Activity as the correction/audit destination.
- Use real record counts for guided onboarding. Payment import can be deep-linked, and switching kinds clears the old file/result. Preserve the five-item primary navigation; payments remain contextual. Move focus to main on pathname navigation and keep existing query-selection focus behavior.
- Verify a full desktop/mobile browser journey through real UI uploads, partial/split confirmation, reversal and updated detail/overview balances, plus outages/retry and existing session expiry tests. Do not extend this milestone to M7 benchmarks, hosted rollout or full conformance claims.

2026-10-24, Milestone 5:

- Reverse one allocation in full with a required retained reason. Preserve original allocation and audit rows; leave sibling split allocations active. Reuse the existing unique allocation_reversals allocation_id constraint, operation ledger and audit schema without migration changes.
- Reuse M4's operation-key mutex and bank-first/sorted-invoice locking helpers. READ COMMITTED re-reads reversal state and derived balances after locks. Restore only the amount stored on the original allocation; atomically persist reversal, saved outcome and actor-owned audit. Same-key identical retries return the saved result; conflicting kinds/reasons fail and new keys cannot reverse twice.
- Activity separates lightweight 25-event summaries from selected operation details and related audit timeline. Read details in a repeatable-read, read-only snapshot. Show historical amounts separately from current balances. Preserve confirmed suggestion history; ledger fingerprints invalidate stale evidence after reversals.
- Keep reversal a secondary action with visible restored balances, reason and acknowledgment, explicitly describing the single split row and absence of a bank refund. Persist the exact confirmed request before sending; uncertain responses retry identically across reload. Already-reversed rows expose confirmation recovery without offering another reversal.
- Use actual audited allocations in history pagination tests. Concurrency tests observe distinct waiting PostgreSQL backends before releasing financial row blockers. Force final audit failure to verify reversal/operation rollback and preserved originals; browser tests lose only an actual committed response before safe retry/reallocation.

2026-10-24, Milestone 4:

- Reuse the initial operation/allocation/audit schema and existing scoped constraints. Keep allocation HTTP validation, financial business rules and parameterized repository SQL separate. No financial mutation is added to matching generation/rejection.
- Use READ COMMITTED with payment-first then UUID-sorted invoice FOR UPDATE locks. Recompute balances in statements after acquiring all locks so prior commits become visible. Use a workspace/operation advisory mutex before financial locks for cross-payment idempotency conflicts; do not serialize unrelated allocations through the workspace row. Bound lock waits to two seconds and return a retryable conflict.
- Canonical SHA-256 request hashes include selected payment, sorted invoices/amounts, suggestion identities and explicit confirmation. Existing identical keys return stored results; conflicting payloads return 409. Persist one operation, all split rows, supplied suggestion confirmations and actor-owned audit event in the same transaction.
- Current suggestions can seed editable amounts but never authorize an allocation or bypass locked validation. Manual allocations remain available for unmatched payments. Reject stale/rejected suggestion identities; preserve historical matching metadata.
- Keep confirmation as a separate focused task with visible payment/invoice remainders, evidence/warnings and a checkbox reset by edits. Persist the exact confirmed request in sessionStorage before sending; unknown outcomes can only retry that request, including after reload. Receipts label balances as of confirmation. No reversal service or history UI is introduced before M5.
- Prove overlap with real PostgreSQL lock blockers and pg_stat_activity observations of distinct waiting backends, rather than relying on Promise.all alone. Force audit failure after split writes to verify complete rollback. Browser recovery tests drop the real committed response, never simulate a financial result.

2026-10-24, Milestone 0:

- Use two npm workspaces and explicit modules without prematurely building domain abstractions.
- Pin the Node baseline to the installed 22.14.0; use Vite 8, Tailwind 4, Vitest 5, Zod 4, csv-parse 7 and node-pg-migrate 9 compatible with that runtime. Audit during setup exposed advisories in older major versions, prompting these updates. Align Vite at the workspace root to share plugin types with Vitest. Lock exact resolved dependencies in package-lock.json. Inter ships locally.
- Use `/Coincela/` base and HashRouter so deep routes survive GitHub Pages refresh. Follow [Vite's official deployment guide](https://vite.dev/guide/static-deploy) and [Tailwind's Vite plugin setup](https://tailwindcss.com/docs/installation/using-vite).
- Separate process liveness from real PostgreSQL readiness. A missing database does not falsely mark the API process dead. Error responses omit internal messages and credentials.
- Do not create domain migrations until Milestone 1. Migration tooling can initialize its own history metadata; an empty domain migration set is intentional.
- Keep production frontend independently buildable without backend credentials. Missing or invalid public API configuration produces an honest unconfigured indicator. Test builds use a dedicated local API configuration; deployment rebuilds with a repository variable.
- Use an isolated native PostgreSQL cluster for local verification because Docker is absent; retain Compose for normal local setup and service-backed CI. No existing database is modified.
- Milestone 0 deferred authentication and money handling; Milestone 1 decisions follow.

2026-10-24, Milestone 1:

- Use built-in asynchronous scrypt with N=32768/r=8/p=3, random salts and constant-time verification. These factors match an [OWASP documented configuration](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html); implementation follows the [Node 22 crypto API](https://nodejs.org/docs/latest-v22.x/api/crypto.html). Accept 12–128 characters on registration; never trim passwords.
- Issue 32 random bytes as base64url bearer tokens; store SHA-256 hashes only. PostgreSQL enforces fixed 30-minute expiry and revocation checks. Registration creates user/workspace/session atomically; unique constraints settle concurrent duplicates.
- Store token metadata in memory/sessionStorage, revalidate identity on refresh, clear on expiry/401. Browser-readable storage remains exposed to XSS: safe React output, no unsafe HTML, short expiry and dependency hygiene mitigate but cannot eliminate the risk. Do not use localStorage or cookies for auth.
- Reject unlisted origins before mutations; allow Authorization preflight without credentials. Bound login/registration attempts in process. Host-specific proxy trust and shared limits remain deployment considerations.
- Add financial_operations as the idempotency parent for future split allocations. Create domain tables now without import or financial mutation services. Aggregate balance guarantees need Milestone 4 locking/transaction validation.
- Keep workspace settings/sign out separate from primary tasks. Avoid fake balances. Preserve calm design and explicit placeholders for later workflows.
- Integration rollback tests use random schemas; browser tests use a disposable DB and API port 3002, preserving local development port 3001.

2026-10-24, Milestone 2:

- Send raw text/csv uploads instead of multipart; no new upload dependency or persistent filesystem is needed. Set a 1 MiB decoded byte limit and 1,000 rows; use csv-parse/sync with a 16,000-character record limit and strict UTF-8 decoding. Preserve quoted commas/newlines/escaped quotes and record-end line numbers.
- Use full-file validation and atomic insertion. Lock one workspace row before duplicate checks so concurrent imports cannot repeat financial effects. This import lock precedes any future financial row locks and no allocation locks/services are introduced here.
- Skip only exact completed-file repeats and repeated reliable invoice/external payment identifiers with identical normalized details. Conflicting identities reject the file. Retain identical-looking payments and mark candidates for review, including prior matching visible records. File-hash scope includes bank account; filenames are not identity.
- Rejected bounded parses create history/errors but no financial rows. Transport/auth/account failures do not create batches. SQL failures roll back metadata and rows. Exact successful repeats reference the existing batch instead of creating misleading second completed batches.
- Reuse the Milestone 1 schema without modifying released migrations. Add page-based, workspace-scoped list endpoints (50 records per page). Keep string pence at HTTP boundaries and BigInt display arithmetic.
- Test migration runners use random schema-derived advisory lock IDs so isolated suites can run together. Production migration locking remains unchanged. Browser tests exercise actual API/DB imports on desktop/mobile, including keyboard submission and correction.

2026-10-24, Milestone 3:

- Implement pure deterministic rules with exact reference priority, normalized name evidence, exact BigInt amount comparisons and explicit date/duplicate/payer/partial/excess explanations. Rank by evidence type, then stable invoice ID; report ambiguity whenever multiple candidates remain. Never invent confidence percentages or allocate money.
- Persist matching_runs separately so No match has a real saved outcome. Extend match_suggestions with a scoped run FK and ordinal position; preserve the released initial migration. Uniqueness makes repeated snapshot generation idempotent and preserves rejected statuses for that snapshot.
- Use repeatable-read financial evidence and SHA-256 fingerprints over engine version, payment, all workspace invoices and ledger/reversal identities. This is conservatively invalidated by unrelated invoice imports; it favors safe stale handling over fine-grained cache complexity. GETs remain read-only and hide obsolete candidates; stale rejection is rejected before updating status.
- Generation locks the existing workspace row to serialize with imports; retry bounded serialization/unique-run races in fresh transactions. These metadata transactions do not implement or replace Milestone 4 payment/invoice financial locks. No financial rows, audits or balances change in generation/rejection.
- Review Payments uses one selected payment, visible evidence/warnings and current amounts. Mobile switches sequentially between list and detail, preserving query selection and list page. Initially reveal five candidates, then show more on demand. No allocation confirmation control is added.
- Hand-authored JSON fixtures define independent expected relationships. Real PostgreSQL tests assert unchanged financial rows/ledger, stale inputs, concurrency/idempotency and rollback; browser tests use real imports/API/DB on desktop/mobile. Existing migration round-trip tests now reverse/reapply both migrations.
