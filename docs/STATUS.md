# Milestone status

Updated 2026-10-24 (Asia/Karachi). Authority: MASTER_PLAN.md. Current authorized scope: Milestone 6 complete user experience. Earlier milestone reports below are historical; see the latest M6 report at the end. Do not start M7 without explicit instruction.

## Milestone 0 — Foundation, design system, and deployment preparation

Historical Milestone 0 report: implementation and local verification completed. The current Milestone 1 recovery report follows below.

Implemented npm workspaces; Express/TypeScript API; liveness and real database readiness endpoints; sanitized JSON errors; Zod environment validation; bounded pg pool; graceful process shutdown; migration/rollback commands; PostgreSQL 18 Compose setup. React/TypeScript/Vite/Tailwind shell includes HashRouter, Overview, navigation placeholders, reusable Button/Field/Panel, locally bundled Inter, responsive design tokens, focus styles, keyboard skip link, API liveness/retry feedback and explicit unconfigured production state.

Documentation: AGENTS.md, PROJECT_SPEC.md, context.md, README.md, ARCHITECTURE.md, DESIGN.md, DECISIONS.md, DEPLOYMENT.md, TESTING.md and MIGRATIONS.md. MASTER_PLAN.md was read completely and preserved.

Deployment preparation: `/Coincela/` Vite base, public API env examples and GitHub Actions verification with isolated PostgreSQL and official Pages upload/deploy actions. Failed checks gate deployment. A separate final build uses public deployment configuration rather than test settings.

### Verification results

| Command / check | Actual result |
| --- | --- |
| `npm install`, dependency updates and deduplication | Succeeded; versions aligned to Node 22.14 |
| `npm ci` | Clean lockfile install passed, 0 known vulnerabilities |
| `npm test` | 20 passed: 14 API/environment; 6 frontend/client/components |
| `npm run test:integration` | 1 passed against real PostgreSQL 18, including HTTP readiness |
| `npm run db:migrate` | Passed against isolated DB; no domain migrations to run |
| `npm run db:rollback` | Passed against isolated DB; no domain migrations to revert |
| `npm run typecheck` | Passed for both workspaces |
| `npm run lint` | Passed |
| `npm run build` with `VITE_API_URL=https://api.coincela.test` | Both production builds passed |
| `npm run build -w @coincela/web` with empty VITE_API_URL | Independent production frontend build passed without backend credentials |
| `npx playwright install chromium` | Succeeded |
| `npm run test:e2e` | 4 passed: desktop/mobile built assets, real local API, hash navigation and refresh, active route, no viewport overflow, skip link focus, unavailable/retry |
| `npm audit --audit-level=low` | 0 known vulnerabilities |
| Compose and Actions YAML parse via installed `js-yaml` | Both valid YAML; workflow reviewed for check/deploy dependency |
| Desktop/mobile screenshots | Visually inspected; readable layout, working hierarchy and no content overflow |
| `npm run dev` and local HTTP smoke check | Both servers started; frontend 200, API ok, database connected, Vite API proxy returned coincela-api |

Latest required test runs: **25 passed, 0 failed, 0 skipped** (20 unit/API/UI + 1 database integration + 4 browser). Browser tests forward the test-only HTTPS hostname to the actual local Express process; they do not simulate health responses. No financial, auth or concurrency tests are claimed at this stage.

Initial failures were resolved: unsupported Testing Library query option; unused Express error-handler argument; README incorrectly loaded as a migration; incompatible duplicate Vite plugin types. Initial dependency audit findings were resolved with compatible package updates. An auxiliary YAML validation attempt failed because `yaml` was absent; rerun using existing `js-yaml` succeeded. Earlier failed runs are not counted as the final passing results.

### Engineering and UX decisions

Explicit app factory and separate liveness/readiness make failures testable. PostgreSQL remains the future financial authority. No domain migrations or money logic were introduced. HTTPS production configuration and no Vite secrets preserve the deployment boundary. The UI clearly labels its preview status and future workflows, uses one primary action, visible focus, text-based connection status and a sequential mobile layout.

### Limitations and remaining external checks

- Docker is not installed, so Compose execution could not be verified locally. Equivalent connectivity was verified using a disposable loopback-only native PostgreSQL 18 cluster at port 55432 in ignored `.local/postgres`, database/role coincela_test. CI has its own PostgreSQL service.
- Coincela is nested under an unrelated user-profile Git root; no dedicated Coincela remote has been verified. No broad Git staging or parent-repository changes were made.
- GitHub Actions execution, repository Pages settings and public deployment cannot be claimed from local YAML validation. No verified public URLs exist. Render and Neon provisioning are intentionally deferred; credentials are not required for Milestone 0.
- Accessibility checks cover foundation semantics, focus, keyboard interaction and responsive layout; they do not establish full WCAG conformance.
- Current navigation destinations are explicit placeholders. Authentication, domain schema, imports, matching, allocations and reversals are not implemented.

### Next milestone

At the end of Milestone 0, Milestone 1 required authorization. It was subsequently authorized and implemented; see the current report below.

## Milestone 1 — Authentication and financial data foundation

Recovered after interruption on 2026-10-24 (Asia/Karachi). The interrupted task was final verification/documentation of Milestone 1. It was not a Git push operation. Existing working implementations, migrations, tests and documentation were preserved. Recovery found stale context, status and README content rather than missing application functionality.

### Implemented and recovered

- Registration atomically creates user, single owned workspace and session. Normalized email uniqueness handles duplicates, including simultaneous requests. Failure during session creation rolls back the account/workspace.
- Asynchronous salted scrypt password hashing, secure random 32-byte opaque tokens, SHA-256 token hashes only in PostgreSQL, fixed 30-minute server expiry, logout revocation, protected identity and workspace routes.
- Strict origin rejection before mutation and Authorization preflight without cookies; bounded registration/login attempts; owner-scoped workspace reads/renames.
- Registration/login screens, authenticated shell, sign out, basic workspace settings, refresh restoration, expiry/401 recovery and temporary-outage feedback. Tokens use memory/sessionStorage only.
- Initial relational financial schema with workspace-scoped foreign keys, GBP/BIGINT constraints, duplicate identity and reversal constraints. Exact BigInt money parsing and explicit string serialization. No import/matching/allocation/reversal services are implemented.

Important files: apps/api/src/auth/*, apps/api/src/money.ts, apps/api/migrations/1792843200000-foundation.cjs, apps/web/src/auth.tsx, apps/web/src/AuthPages.tsx, apps/web/src/App.tsx, API/UI test suites, tests/e2e/auth.spec.ts and docs/DATABASE.md.

### Milestone status

**Milestone 1 complete, locally verified.** No required Milestone 1 functionality remains outstanding. External deployment verification remains unclaimed.

### Fresh recovery verification

| Command | Actual result |
| --- | --- |
| npm test | 50 passed: 37 API/environment/password/money + 13 frontend/client tests |
| npm run test:integration with isolated TEST_DATABASE_URL | 12 passed against native PostgreSQL 18, including migration up/down/up, auth/ownership, CORS, constraints, concurrent duplicate registration and injected-failure rollback |
| npm run build with VITE_API_URL=https://api.coincela.test | API and production frontend builds passed |
| npm run test:e2e with coincela_e2e disposable DB | 8 passed, desktop/mobile Chromium; actual Express API and PostgreSQL, settings/refresh/logout/login/server expiry, protected routes, hash refresh, asset paths, keyboard skip focus and network retry |
| npm run typecheck | Both workspaces passed |
| npm run lint | Passed |
| npm run build -w @coincela/web with empty VITE_API_URL | Passed independently without backend credentials |
| node .local/visual-check.mjs | Development Vite proxy registration/settings/logout passed; mobile registration and settings screenshots visually reviewed |
| npm audit --audit-level=low | 0 known vulnerabilities |
| git diff --check | Passed; only Git LF/CRLF conversion notices |

All 70 automated tests passed, zero failures and zero skips in these fresh recovery runs. No previous success was assumed. The earlier interrupted run had resolved obsolete public-overview expectations and a mistaken test matcher; these did not recur. Browser tests forward a test-only HTTPS hostname to the real local API; they do not fake authentication responses. Financial allocation/concurrency guarantees are intentionally not claimed by Milestone 1.

### Engineering and UX decisions

Existing documented decisions were retained: fixed server-backed bearer sessions, ownership checks in SQL plus composite schema keys, exact pence arithmetic, safe errors and atomic registration. The existing calm design, minimal account fields, separate settings and plain recovery messages were preserved. No new architectural decision was needed during recovery.

### Git and external limitations

Git recovery inspection found a dedicated C:/Users/User/Coincela repository, branch main, latest commit 5cfb882 (chore: initialize Coincela milestone 0), and origin https://github.com/abbasikhadija/Coincela.git. The old user-profile Git-root warning is obsolete. All Milestone 1 modifications and untracked additions remain preserved and uncommitted. Recovery did not reset, clean, discard, commit, modify remotes or push.

Docker remains unavailable locally; real database verification used native PostgreSQL 18 on loopback port 55432. GitHub Actions execution, Pages settings, Render/Neon and public HTTPS deployment were not verified. Browser-readable token storage retains documented XSS risk. Full WCAG conformance and host-specific proxy/shared rate-limit configuration remain later production review work. Aggregate financial invariants require the later locked transactional services; those endpoints are not exposed now.

### Remaining scope

Milestone 2 (CSV imports) is not started and requires explicit instruction. No Milestone 2 functionality was added during recovery.

## Milestone 2 — CSV import workflow

Completed and locally verified on 2026-10-24 (Asia/Karachi). Milestone 1 was committed before this work as 104014a. Milestone 3 was not started.

### Implemented

- Protected invoice and incoming-payment CSV upload, strict file/header/row validation, real dates, exact GBP pence normalization, quoted/escaped/multiline fields, fatal UTF-8 validation and meaningful file/row errors.
- Limits: 1 MiB decoded CSV, 1,000 data rows, 16,000-character parser record and 500-character text fields. Invoice amounts cannot be negative; payments must be positive incoming credits.
- Full-file atomic import policy. Workspace locking serializes imports and duplicate inspection. New records, batch metadata and uncertain-payment review flags commit together. Rejected files store history/errors and insert no financial records; SQL failure rolls back all records and metadata.
- Explicit completed-file hash repeats; reliable invoice/external-payment identity skips; conflicting identities reject the file. Legitimate identical-looking transfers remain stored and require duplicate review, including prior candidates. No silent financial discard or allocation.
- Named workspace-owned bank accounts; paginated import history, invoice and contextual incoming-payment lists; scoped error retrieval. No raw uploaded files persist on disk.
- Import Center with synthetic sample downloads, native labeled file input, account selection/creation, row validation feedback, inserted/skipped/review summary, next steps, history and record browsing. Overview directs users to invoice import. Matching remains explicitly unavailable.

Important files: apps/api/src/imports/parser.ts, service.ts and routes.ts; apps/api/test/import-parser.test.ts and imports.integration.test.ts; apps/web/src/ImportCenter.tsx, src/test/imports.test.tsx and public/samples/*.csv; tests/e2e/imports.spec.ts; docs/IMPORTS.md. Reused existing schema and auth middleware without modifying the committed migration. Updated AGENTS, PROJECT_SPEC, context, README, architecture, design, database, testing, deployment and decisions.

### Verification

| Command/check | Actual final result |
| --- | --- |
| npm test | 77 passed: 59 API/environment/password/money/CSV parser; 18 frontend/client/component tests |
| npm run test:integration with isolated TEST_DATABASE_URL | 29 passed against native PostgreSQL 18, including import atomicity, errors/history, duplicate identities/files, legitimate identical payments, unauthorized/foreign account rejection, exact money, pagination, overlapping imports and forced rollback |
| npm run typecheck | Both workspaces passed |
| npm run lint | Passed |
| npm run build with VITE_API_URL=https://api.coincela.test | API and production frontend passed |
| npm run test:e2e with disposable coincela_e2e database | 10 passed, desktop/mobile Chromium, actual API/PostgreSQL responses; invoice/payment uploads, sample download, keyboard submission, invalid-file correction, file repeat, bank selection, duplicate warnings, lists, refresh, history/errors plus existing auth/connectivity/navigation checks |
| npm run build -w @coincela/web with empty VITE_API_URL | Independent build without backend credentials checked separately |
| npm audit --audit-level=low | 0 known vulnerabilities |
| Desktop/mobile import screenshots | Visually reviewed; visible guidance/errors/warnings and local horizontal table scrolling; no viewport overflow in browser assertions |

Final automated total: **116 passed, 0 failed, 0 skipped**. Test data is synthetic. No financial matching/allocation or performance benchmark claims are made.

Resolved earlier failures: the parser's info-enabled return type needed an explicit typed assertion; lint found a mutable declaration and an unavailable hook-rule suppression; frontend test queries contained an unsupported exact option. Independent integration suites initially competed for node-pg-migrate's shared advisory lock, causing one suite to skip after setup failure; random-schema-derived test lock IDs resolved that conflict while leaving production locking intact. Browser tests found stale payment-list state reused as invoice rows on route change; distinct route keys fixed it. One repeat browser attempt used the previous bundle after a failed typecheck/build; final verification was rerun only after a successful rebuild. These failed runs are not hidden or counted as final passing results.

### Engineering and UX decisions

Raw text/csv uploads avoid multipart/filesystem dependencies. Strict bounded synchronous CSV parsing is adequate for this narrow upload size. Exact file identity is scoped by workspace, kind and bank account. The workspace lock makes identity checks and inserts atomic across simultaneous imports. Visible payment similarity requires review rather than dropping data. Import history retains rejected outcomes and explicit errors. Page-based lists return 50 records and stable newest-first ordering.

The UI uses one type selector and upload action, reveals bank-account setup only for payments, shows format limits up front, and gives plain corrective errors and next steps. Native labels, keyboard form submission and status/error announcements preserve accessibility. Payment browsing stays contextual, and lists display string pence with BigInt arithmetic. Table containers scroll on mobile; no extra primary navigation was added.

### Limitations

Docker is unavailable locally; database verification used real native PostgreSQL 18 on loopback 55432. Hosted CI and public deployment remain unverified. Large-file streaming, arbitrary bank-specific column mapping and outgoing transfers are intentionally unsupported. Completed exact file reuploads reference their original history batch; transport/auth/account-selection failures and unexpected SQL rollbacks do not produce separate batch records. No duplicate-resolution mutation or matching suggestion service exists yet. Full WCAG conformance is not claimed.

After verification, the user requested a local commit. Milestone 2 is included in feat: add atomic CSV import workflow; no push was requested. Existing work was preserved. Next milestone: **3 — explainable matching engine**, awaiting explicit instruction. Stop here.

## Milestone 3 — Explainable matching engine

**Completed and locally verified, 2026-10-24 (Asia/Karachi).** Scope followed the next incomplete milestone after ba9839a. Milestone 4 was not started.

### Implemented

- Pure deterministic rules: exact reference priority with identifier boundaries; normalized payer/customer/description evidence; exact current-balance amount comparisons; date context; stable evidence ranking and invoice-ID tie order.
- Exact reference, strong, possible, ambiguous and no-match outcomes. Multiple plausible candidates remain visibly ambiguous. Closed invoices and fully allocated payments do not generate candidates. Partial/excess amounts, duplicate risk, payer disagreement, early dates and amount-only weakness are explained without numerical confidence percentages.
- PostgreSQL-derived outstanding/unallocated balances exclude reversed allocations. Repeatable-read snapshots plus engine/payment/invoice/ledger fingerprints detect stale evidence. Old candidates are hidden, regeneration creates current metadata, and stale rejection returns 409. Reads and payment-list review states use current snapshot evidence.
- matching_runs persists overall outcomes including No match. Scoped run/candidate keys and ordered positions make repeated generation idempotent. Concurrent generation retries metadata races in fresh transactions. Rejected status is preserved for the same snapshot; previous run history is retained after changes.
- Protected matching list/detail/generate/reject endpoints; workspace isolation, structured errors and sanitized failures. Generation/rejection only write review metadata and do not alter invoices, payments, allocations, reversals, financial operations or audits.
- Review Payments desktop master-detail and sequential mobile UI: one selected payment, current amounts, payer/reference/date, invoice totals/outstanding/suggested amounts, evidence/warnings, review labels, rejection, refresh and regeneration. Selected payment survives refresh through the route query. Five candidates show initially with progressive reveal. Import completion links to review. No allocation confirmation control exists.

Important files: apps/api/src/matching/{engine,repository,service,routes}.ts; apps/api/migrations/1792843300000-matching-runs.cjs; apps/api/test/fixtures/matching.json; matching.test.ts and matching.integration.test.ts; apps/web/src/ReviewPayments.tsx and src/test/review.test.tsx; tests/e2e/matching.spec.ts; docs/RECONCILIATION.md. Existing initial migration was preserved. Updated project instructions/spec, context, README, architecture/schema/design/testing/migration/deployment docs and decisions.

### Actual verification

| Command/check | Final result |
| --- | --- |
| npm test | 102 passed: 78 API/environment/password/money/CSV/matching unit tests; 24 frontend/client/component tests |
| npm run test:integration with isolated TEST_DATABASE_URL | 38 passed against native PostgreSQL 18, including matching snapshots/outcomes, current/rejected/stale list states, derived active allocation/reversal balances, concurrent generation, metadata rollback, scoped access and unchanged financial records |
| npm run typecheck | Both workspaces passed |
| npm run lint | Passed |
| npm run build with VITE_API_URL=https://api.coincela.test | API and production frontend passed |
| npm run test:e2e with isolated coincela_e2e DB | 12 passed, desktop/mobile Chromium, actual Express/PostgreSQL. Matching flow covers exact, ambiguous and unmatched suggestions, visible evidence/warnings, rejection, refresh continuity, new-import staleness, regeneration, keyboard generation, mobile navigation and zero allocations |
| npm run db:migrate against local coincela_test | New matching migration applied successfully |
| npm run build -w @coincela/web with empty VITE_API_URL | Passed without backend configuration |
| npm audit --audit-level=low | 0 known vulnerabilities |
| Review screenshots | Desktop/mobile ambiguity/evidence/amounts/warnings and unconfirmed status visually inspected; no viewport overflow in browser assertions |

**152 passed, 0 final failures, 0 skipped.** Independent hand-authored fixture covers 16 matching cases; additional unit tests verify warning details, deterministic input-order independence, immutable inputs and large exact values. Real database tests seed later financial states only through fixture SQL, without adding financial mutation endpoints. Both schema migrations are exercised through disposable-schema down/up verification. Repeated testing followed material list-state changes; no failed tests were ignored.

Initial typechecks found an untyped PostgreSQL candidate result and a missing JSON import attribute under NodeNext. Both were corrected; final checks passed. No dependency changes were needed. No failed/ignored financial tests, synthetic accuracy claims or hosted deployment claims are made.

### Engineering and UX decisions

Keep the matching engine pure and separate from future allocations. Persist a matching run for No match and use conservative full-workspace invoice/ledger fingerprints to make staleness explicit. Store candidate order rather than relying on random suggestion IDs. Metadata transactions never substitute for Milestone 4 financial locks/validation. Workspace row locking serializes with imports; bounded retries handle concurrent generation safely.

Show only the selected payment as the focus. Keep amounts/evidence/warnings visible and suggestions unconfirmed. Mobile uses sequential navigation with retained query selection and page context. Ambiguity remains explicit even after rejecting one candidate. Manual refresh detects changed data; no hidden automatic allocation or polling occurs.

### Remaining limitations

Matching is deliberately conservative, uses normalized exact names rather than fuzzy/AI identity, and may return false candidates or no match. A current response is as of its snapshot and can become stale after it returns; manual refresh/reload rechecks. Unrelated invoice imports can invalidate prior results. Rejection is specific to its snapshot; changed snapshots require review again. No split/confirmation/allocation or reversal workflow is implemented. The future allocation service must acquire bank-first/sorted-invoice locks, recalculate balances and atomically commit idempotent financial effects plus audits.

Docker unavailable locally; verification used native PostgreSQL 18. Public deployment, hosted CI and full WCAG conformance remain unverified. No performance/precision/recall benchmark was run in this milestone. Milestone 3 changes remain uncommitted; no commit/push requested or performed.

Next milestone: **4 — transactional payment allocation**, awaiting explicit instruction. Stop here.

### Recovery verification — 2026-10-24

Recovery after the unresponsive chat found the M3 implementation and completion documentation already present on main at base ba9839a, with all M3 changes uncommitted. The existing Playwright last-run record was passed (21:41:59 local time), with desktop/mobile review screenshots. No active milestone verification runner was found. Evidence therefore indicates M3 had finished verification before the chat became unresponsive; the exact cause of the chat failure cannot be determined from repository artifacts.

Fresh bounded checks verified the existing work without restarting implementation:

| Command | Recovery result |
| --- | --- |
| npm test | 102 passed (78 API/unit, 24 frontend), no skips |
| npm run test:integration | 38 passed against real PostgreSQL, no skips; includes stale-result detection, workspace isolation, concurrent generation, rollback, unchanged financial records and migration round trips |
| npm run typecheck | Passed both workspaces |
| npm run lint | Passed |
| npm run build with VITE_API_URL=https://api.coincela.test | Passed API and frontend |
| npm run test:e2e -- --global-timeout=180000 --timeout=30000 --workers=2 | 12 passed in 51.4 seconds, desktop/mobile Chromium, real API/PostgreSQL; no skips |
| npm run build -w @coincela/web with empty VITE_API_URL | Passed after browser tests, removing the test hostname from the local build |
| git diff --check | Passed, with only LF/CRLF notices |

Final fresh total: **152 passed, zero final failures or skips**. Desktop/mobile review screenshots were visually inspected. Matching API, engine, repository, migration, review UI and test coverage were inspected; no incomplete M3 functionality required a code change.

The first integration attempt failed with ECONNREFUSED on port 55432 (1 failed, 37 skipped due to setup failure). The existing local test cluster was stopped. A first pg_ctl start used its default port and failed to bind; restarting the same preserved cluster with explicit loopback port 55432 succeeded within its 30-second bound. The integration rerun then passed all 38 tests. No database reinitialization or data deletion occurred. Test/lint/build processes had 120–210 second outer limits; no limit was reached.

npm ci, npm run dev and npm audit were not repeated: installed dependencies were usable, no dependency changes existed, and Playwright started its own real API/production preview. The earlier audit result above remains historical, not a new audit claim. Public deployment and hosted CI remain unverified. Recovery changed documentation only; no reset, clean, commit, push or M4 work occurred. **M3 is complete and locally verified; stop here.**

## Milestone 4 — Transactional payment allocation

**Complete and locally verified, 2026-10-24 (Asia/Karachi).** The user explicitly requested the next incomplete milestone after M3. Work started from clean main at da9f848. M5 was not started.

### Implemented

- Protected allocation options and confirmation APIs, strict explicit confirmation and canonical positive string-pence validation. Supports manual and suggested full/partial allocations, multiple payments per invoice, repeated use of payment remainders, and atomic splits across 1–50 distinct invoices. Excess remains unallocated.
- Bank-first then UUID-sorted invoice row locks; READ COMMITTED balance recalculation after lock acquisition. Workspace ownership, GBP, exact BigInt amounts, per-invoice and total-payment limits are checked under locks. No client balance is accepted. Original financial records remain intact.
- Workspace/operation-key advisory mutex, canonical request hashes and unique persisted operations. Identical/reordered retries return the saved result; conflicting keys fail. Operations, all split allocation rows, supplied suggestion confirmation and actor-owned audit event commit atomically. Two-second lock waits return retryable conflicts.
- Suggested confirmation independently checks identity, ownership, pending status and current evidence; stale/rejected suggestions fail. Manual allocations are available for unmatched payments. Matching generation/rejection remains metadata-only. Engine version rules-2 updates ambiguity wording for previously partially allocated payments without changing ranking; previous runs safely become stale.
- Focused AllocationForm in Review Payments with invoice search/pagination, editable amounts, evidence/ambiguity/duplicate warnings, visible invoice/payment remainders, explicit acknowledgment reset by edits, confirmation/result feedback and safe same-key recovery after unknown responses and reload. Original review controls hide during the allocation task. Receipt balances are labeled as of confirmation. Invoice/payment lists show current derived outstanding/unallocated columns.
- Reused existing schema/indexes; no dependency or released migration changes. No allocation deletes, mock financial results, reversal service or Activity history UI were added.

Important files: apps/api/src/allocations/{routes,validation,service,repository}.ts; apps/api/test/allocations.test.ts and allocations.integration.test.ts; apps/web/src/AllocationForm.tsx, ReviewPayments.tsx, ImportCenter.tsx and styles.css; frontend allocations.test.tsx; tests/e2e/allocations.spec.ts; docs/ALLOCATIONS.md. Project instructions/spec, README, context, architecture/database/design/decisions/testing/migrations/reconciliation/deployment docs were updated.

### Final verification

| Command/check | Actual result |
| --- | --- |
| npm ci | Passed, 387 packages installed, 0 known vulnerabilities; deprecation notices for whatwg-encoding and the pinned ESLint version |
| npm test | 108 passed: 80 API/unit + 28 frontend, no skips |
| npm run test:integration with TEST_DATABASE_URL=postgres://coincela_test@127.0.0.1:55432/coincela_test | 54 passed against real native PostgreSQL 18, no skips |
| npm run typecheck | Passed both workspaces |
| npm run lint | Passed |
| npm run build with VITE_API_URL=https://api.coincela.test | Passed API and frontend after final source changes |
| npm run test:e2e -- --global-timeout=180000 --timeout=30000 --workers=2, TEST_DATABASE_URL selecting coincela_e2e | 14 passed in 45.7 seconds, desktop/mobile Chromium, actual API/PostgreSQL; no skips |
| npm run build -w @coincela/web with empty VITE_API_URL | Passed afterward, removing test hostname from local dist |
| npm run dev, bounded to 45 seconds | Frontend HTTP 200, /health/ready database connected, Vite /api/health proxy returned coincela-api; only the smoke-test process tree was stopped at the bound |
| Desktop/mobile allocation screenshots | Visually reviewed after input-style correction; visible amounts/warnings/confirmation and no viewport overflow in browser assertions |
| git diff --check | Passed; LF/CRLF conversion notices only |

Final automated total: **176 passed, zero final failures and zero skips**. No failures were ignored. Tests cover exact BIGINT maximum, malformed/zero/negative/overflow amounts, full/partial/split/excess, exact remaining balance, multiple payments per invoice, idempotency/conflicts, stale/rejected/foreign suggestions and workspace isolation. Option tests cover literal search, pagination, query validation and derived balances.

Concurrency tests hold a real bank/invoice row, start both HTTP requests, observe two distinct waiting PostgreSQL backends via pg_stat_activity, and then release the blocker. Shared-invoice, shared-payment, opposing-order overlapping splits and identical-key retries assert final balances and row counts. Forced failure at final audit insertion proves complete rollback of split rows, operation and suggestion confirmation. Browser tests commit to the actual API, deliberately lose its response, reload/reopen and retrieve the saved result without duplicating allocations or audits. Matching tests continue to prove zero financial effects from generation/rejection.

Initial failures resolved: the test helper accepted unknown where Supertest requires object/string; web test queries incorrectly included Testing Library's unsupported exact option, blocking typecheck/build. Initial unit/integration runs found that Zod refinement attempted BigInt on malformed decimal text (one unit and one integration failure); a guarded canonical-pence predicate fixed validation to return 400. The first browser run had 12 passes and two import-test failures because total and outstanding now both display the same initial amount; tests now explicitly assert the new column and both values. Screenshot inspection found bare inputs missing the existing Field styles; explicit accessible input styles were added and screenshots reviewed again. Final runs followed all relevant changes. One intermediate browser run used the direct Playwright CLI to ensure bounded arguments; the final npm command above also passed with explicit bounds.

### Decisions, limits and next milestone

Keep financial validation independent of matching. An operation-key mutex precedes bank/invoice locks and protects cross-payment conflicting retries without serializing the whole workspace. READ COMMITTED plus fresh statements after locks prevents stale balance validation. One atomic audit records the explicit request and complete outcome. All consequences stay visible before confirmation; ambiguous evidence is not silently promoted, edits reset acknowledgment, and uncertain responses cannot change their confirmed payload/key.

Unknown-result recovery is tab/sessionStorage-scoped: keep the tab until the result is resolved. Clearing browser storage or deliberately using another operation key is outside the retry guarantee. Stored receipt balances describe the original confirmation; refreshed live data may differ. Direct SQL can bypass service aggregate invariants. Future reversal writes must follow the same locks, reason/uniqueness/idempotency and atomic audit policy.

Docker is unavailable; real tests used native PostgreSQL 18. Public deployment, hosted CI, full WCAG conformance and performance/precision/recall benchmarks remain unverified. No new architectural infrastructure was introduced. Existing work was preserved; M4 changes remain uncommitted, with no reset/clean/commit/push performed.

Next milestone: **5 — reversals and audit history**, awaiting explicit instruction. Stop here.

## Milestone 5 — Reversals and audit history

**Complete and locally verified, 2026-10-24 (Asia/Karachi).** The user requested the next incomplete milestone after M4. Work started from clean main at 9102dda (feat: add transactional payment allocation workflow). The earlier M4 uncommitted wording above is historical; that work was subsequently committed at the user's request. M6 was not started.

### Implemented

- Protected reversal preview and explicit confirmation APIs. Reverse one original allocation in full with a required trimmed 1–1000-character reason; reject unsafe controls, untrusted amounts/ownership fields and missing confirmation. Other allocations in a split stay active. Original allocation and audit rows are preserved.
- Shared operation-key mutex, bank-first/sorted-invoice row locks, fresh READ COMMITTED reversal-status/balance reads and exact BigInt restoration from the stored original amount. Unique allocation_id prevents a second reversal. Identical retries return the saved result; conflicting reason/allocation/kind keys fail. Different keys cannot restore an allocation twice.
- Atomically persist reversal operation, reasoned reversal row, saved outcome and actor-owned allocation_reversed audit event with original-operation/allocation links. Audit failure rolls back every new effect and leaves original history untouched. Reallocation of restored funds is supported through the existing explicit allocation service. Matching evidence becomes stale through reversal ledger identities; historical suggestion confirmation is preserved.
- Activity replaces the placeholder with 25-event pages, selected operation query continuity, actor/timestamps/amounts, original allocation details, active/reversed status, current balances and related audit timeline. Reversal events link back to original confirmations; reversed rows retain their reason/time and a link to the reversal event.
- Focused secondary reversal review: original invoice/payment/customer/reference, current and restored balances, reason input, explicit acknowledgment reset on edits and keyboard confirmation. Explain single split-row reversal and no bank refund. Unknown responses retain the exact confirmed request in workspace/allocation-scoped sessionStorage for reload/reopen/same-key recovery; reversed rows offer Check reversal confirmation. Success refreshes history and distinguishes recorded from current balances. Allocation receipts link to Activity.
- Existing schema/indexes and infrastructure reused; no dependency or released migration changes. No financial deletion, reason editing, audit deletion, mock finance or M6 features were added.

Important files: apps/api/src/reversals/{validation,repository,service}.ts; apps/api/src/activity/{routes,repository,service}.ts; shared operation primitives in apps/api/src/allocations/repository.ts; apps/api/test/reversals.test.ts and reversals.integration.test.ts; apps/web/src/Activity.tsx and ReversalForm.tsx; frontend activity/reversal tests; tests/e2e/reversals.spec.ts; docs/REVERSALS.md. Updated AGENTS, PROJECT_SPEC, README, context, architecture/database/design/decisions/testing/migrations/deployment/allocation/reconciliation docs.

### Verification

| Command/check | Actual final result |
| --- | --- |
| npm ci | Passed; 387 packages installed, 0 known vulnerabilities; deprecation notices for whatwg-encoding and the pinned ESLint version |
| npm test | 117 passed: 82 API/unit + 35 frontend, no skips |
| npm run test:integration with TEST_DATABASE_URL selecting isolated coincela_test on 127.0.0.1:55432 | 65 passed against real native PostgreSQL 18, no skips; includes 11 new reversal/history cases plus existing suites |
| npm run typecheck | Both workspaces passed |
| npm run lint | Passed after reason-validator correction |
| npm run build with VITE_API_URL=https://api.coincela.test | API and production frontend passed after source changes |
| npm run test:e2e -- --global-timeout=180000 --timeout=30000 --workers=2 with disposable coincela_e2e DB | 16 passed in 1.2 minutes on final run, desktop/mobile Chromium; real API/PostgreSQL and no skips |
| npm run build -w @coincela/web with empty VITE_API_URL | Independent frontend rebuild performed after browser checks; local dist omits test hostname |
| npm run dev, bounded to 45 seconds | Frontend HTTP 200; /health/ready database connected; Vite /api/health returned coincela-api. Only this smoke-test process tree was stopped at the bound |
| Desktop/mobile reversal screenshots | Visually inspected for readable balances, visible consequences/reason/confirmation and keyboard focus; browser assertions also check no viewport overflow with a 1000-character unbroken reason |
| git diff --check | Passed, with LF/CRLF conversion notices only |

Final automated total: **198 passed, zero final failures and zero skips**. No required checks were omitted. Database tests compare complete original allocation/audit JSON before and after reversal, inspect saved reason/actor/original-operation links, restore exact BIGINT maximum values, reallocate after reversal, reject foreign reads/mutations and verify stale matching. Final audit failure injection proves rollback of reversal, parent operation, result and audit while preserving the original financial history.

Real overlapping transactions are demonstrated with separate PostgreSQL blockers and pg_stat_activity observations of at least two distinct waiting backend PIDs before release. Cases include different-key reversals of one allocation (one winner), identical concurrent retries (one outcome), reversal versus allocation on one payment, and separate-payment reversals sharing one invoice. Final balances/counts are checked rather than inferring safety from request statuses.

Browser reversal tests create actual audited split allocations, confirm by keyboard, deliberately lose only an actual committed API response, reload/reopen, retry identically, inspect preserved reason/timeline and reallocate the restored amount. SQL assertions verify allocation/reversal/audit counts and active amounts. A sibling reversal with a maximum-length unbroken reason verifies responsive history rendering. No success response is simulated and no test-only financial mutation endpoint exists.

Initial failures resolved: first integration run had 64 passes and one pagination-test failure because preceding real operations produced 23 events rather than the assumed 25+. The fixture now creates enough actual audited operations explicitly before asserting page boundaries. Initial lint rejected control-code escapes in the reason-validation regex; equivalent character-code checks preserve validation without a lint suppression. The first browser run passed all 16; testing was repeated after adding explicit long-reason layout coverage and wrapping styles. No financial failure was ignored or skipped.

### Decisions, limitations and next milestone

Reversal is an append-only correction of one full allocation, never deletion or a bank refund. Reuse the existing financial lock/idempotency policy and reject duplicate reversals independently of request identifiers. Separate recorded audit values from current derived balances and keep reasons/actors discoverable without exposing raw technical payloads by default. Details/preview use read-only repeatable-read snapshots; submission always rechecks under financial locks.

Unknown-outcome recovery remains tab/sessionStorage-scoped. Keep the tab until resolved; clearing storage is outside browser retry recovery, though the database still prevents a second reversal of the same allocation. Individual allocations can be reversed only in full; use explicit fresh reallocation for a corrected amount. Pages may shift if new events arrive between reads. Direct SQL/administrators can bypass application history policies; no tamper-proof external audit system is claimed.

Docker remains unavailable locally; real checks used native PostgreSQL 18. Hosted CI, public Pages/Render/Neon deployment, full WCAG conformance and performance/accuracy benchmarks remain unverified. M5 changes remain uncommitted. No reset, clean, commit or push was performed during this milestone.

Next milestone: **6 — complete user experience**, awaiting explicit instruction. Stop here.

## Milestone 6 — Complete user experience

**Complete and locally verified, 2026-10-24 (Asia/Karachi).** The user requested the next incomplete milestone after M5. Work started from clean main at cc00b82 (feat: add reasoned allocation reversals and audit history); earlier M5 uncommitted wording is historical. M7 benchmarking, hosted reliability review and deployment were not started.

### Implemented

- Signed-out public landing explaining audience, CSV reconciliation, control/confirmation, correction history and product boundaries, with account/sign-in actions and native synthetic sample downloads. Signed-in users retain Overview at the existing root route; private resource routes and session recovery remain protected.
- Live owned-workspace Overview with one contextual next action, five-step guide, outstanding invoice balance, payments with positive unallocated amounts and up to five recent financial events. Empty workspaces show guidance rather than empty metric cards. PostgreSQL numeric/text aggregates and BigInt formatting remain exact beyond a single BIGINT. Review count is explained rather than presented as confidence.
- Read-only invoice/payment detail APIs and views with original/current amounts, invoice paid/part-paid/unpaid and payment allocation status, dates/customer/reference/bank context, duplicate warning, refresh/retry and 50-row preserved allocation/reversal history. Lists and related records link into detail, review and Activity. Reversed rows retain reason and audit links.
- Direct payment-import onboarding through query selection, retained kind on reload, and old file/result reset on kind changes. Existing upload correction, duplicate, matching, confirmation, reversal and unknown-response recovery workflows remain in place. Main focus moves after pathname navigation; existing query-selection focus behavior and keyboard skip access remain. Route navigation updates titles; no extra primary navigation or decorative charts were added.
- Separate protected HTTP validation, workspace-view service snapshots and parameterized repository reads. Overview/detail responses use read-only repeatable-read transactions and owner-derived workspace constraints. No finance mutation, dependency, schema migration or released migration edit was introduced.

Important files: apps/api/src/workspace-views/{routes,service,repository}.ts; apps/api/test/workspace-views.integration.test.ts; apps/web/src/{Landing,Overview,RecordDetails}.tsx; App.tsx, ImportCenter.tsx, ReviewPayments.tsx and styles.css; src/test/workspace-views.test.tsx; tests/e2e/journey.spec.ts; docs/WORKSPACE_UX.md. Updated AGENTS/spec/context/README, status, decisions, architecture, design, database, testing, migrations, deployment and reversal docs.

### Verification

| Command/check | Actual final result |
| --- | --- |
| npm ci | Passed; 387 packages installed, 0 known vulnerabilities; existing whatwg-encoding/ESLint deprecation notices |
| npm test | 123 passed: 82 API/unit + 41 frontend, no skips |
| npm run test:integration with TEST_DATABASE_URL selecting isolated coincela_test on 127.0.0.1:55432 | 70 passed on real PostgreSQL 18, no skips; five new workspace-view cases plus existing finance/concurrency suites |
| npm run typecheck | Both workspaces passed |
| npm run lint | Passed |
| npm run build with VITE_API_URL=https://api.coincela.test | API and production frontend passed after final source changes |
| npm run test:e2e -- --global-timeout=210000 --timeout=30000 --workers=2 with disposable coincela_e2e DB | 18 passed in 1.4 minutes, desktop/mobile Chromium, real API/PostgreSQL; no skips. New full journey has a 60-second case limit |
| npm run build -w @coincela/web with empty VITE_API_URL | Passed afterward; current local dist does not contain the test-only API hostname |
| npm run dev bounded to 45 seconds | Frontend HTTP 200, database-connected readiness and working Vite /api/health proxy; only the smoke-test process tree stopped at the bound (forced-stop child exit output is cleanup, not an application startup failure) |
| New desktop/mobile screenshots | Landing, live Overview and payment details visually inspected for hierarchy, readable amounts/history, visible guidance and responsive wrapping; browser assertions verify no viewport overflow |
| git diff --check | Passed, with LF/CRLF conversion notices only |

Final automated total: **211 passed, zero final failures and zero skips**. The read integration suite verifies empty/onboarding states, allocation/reversal-derived totals, bank context, preserved linked history, workspace isolation, missing/invalid IDs, query bounds, stable 50-row pagination, no financial writes and exact aggregates beyond one BIGINT. Pagination uses real audited one-penny allocations. Existing M4/M5 concurrency, idempotency, rollback, original preservation and lost-response checks still pass.

The new desktop/mobile journey starts at the public landing, downloads a sample, registers, imports invoices through the native upload UI, returns through Overview to direct payment import, creates a named account, imports the payment, generates real suggestions, confirms a partial allocation followed by a split, reverses one split row with a reason, follows preserved invoice/payment history, reloads details, checks current Overview balances and recovers from an actual Overview network outage. It uses no simulated financial success or test-only mutation endpoint. Existing browser tests cover login/settings/logout, session expiry, import correction, ambiguity, financial warnings, keyboard controls and safe response-loss retries.

Initial failures resolved: an old unit expectation assumed the signed-out root always rendered sign-in, which no longer matches the authorized public landing. The test was updated while private-route/session checks remained. A build/typecheck found a possibly-null data access in the detail identity guard; an explicit data check fixed it. Final tests followed these changes. No financial test failed or was skipped.

### UX review, decisions and remaining limits

WORKSPACE_UX.md records the screen-by-screen review. The first task is explicit without technical documentation; imported records advance the next action. Experienced users retain all primary navigation. Current versus recorded balances, unconfirmed suggestions, ambiguity, partial/split consequences and correction reasons remain distinct. Detail/history links make related payment, invoice and audit context discoverable. Error paths retain retry/back controls and never fabricate financial values. Native labels, semantic landmarks, visible focus and keyboard/mobile behavior were reviewed.

Summary and detail reads are snapshots, not reservations; confirmation continues to revalidate under the existing financial locks. Detail pages may shift after new activity between page reads. Due dates are displayed separately; invoice status reports balance state, not a collection/overdue prediction. No background-polling freshness guarantee is made.

Docker is unavailable locally; native PostgreSQL 18 supplied real database verification. Full WCAG conformance, measured end-user research, performance/precision/recall benchmarks, hosted CI and public Pages/Render/Neon deployment remain unverified. Public landing implementation is not a claim of public hosting. M6 changes remain uncommitted; no reset/clean/commit/push was performed.

Next milestone: **7 — reliability, benchmarks and production deployment**, awaiting explicit instruction. Stop here.
