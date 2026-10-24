# Engineering decisions

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
