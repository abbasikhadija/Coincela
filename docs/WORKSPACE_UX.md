# Complete workspace experience — Milestone 6

## Public and first-use flow

Signed-out visitors opening /Coincela/#/ see what Coincela does, who it serves, how reconciliation works and how to try it with synthetic invoice/payment CSV downloads. Create an account is the primary action; Sign in is secondary. Samples use real private workspaces and backend services, never a shared writable demo or simulated balances. GBP only; no bank connection or payment/refund capability is implied.

Signed-in users retain Overview at the same root route. Private routes still require a valid session. Expiry/rejected sessions and temporary restoration failures retain their sign-in/retry explanations. Existing account fields and 30-minute bearer/sessionStorage policy are unchanged.

Overview guides the next step from actual workspace records:

| Situation | Primary next action |
| --- | --- |
| No invoice records | Import your invoices |
| Invoices exist, no incoming payments | Import incoming payments, opening payment import directly |
| An incoming payment has unallocated pence | Review payments |
| All imported payments allocated, invoice balance remains | Review outstanding invoices |
| Invoice balances cleared and imported payments allocated | View reconciliation history |

The persistent five-step guide is invoice import → payment import → review suggestions → confirm allocations → inspect balances/history. It does not label review/confirmation complete merely because a suggestion exists. An empty workspace shows guidance without meaningless balance cards. Once records exist, show only outstanding invoice balance and number of payments requiring review, with links to the underlying records. Here review means positive unallocated pence, not a confidence score, risk verdict or a suggestion status. Show at most five recent financial events with links to Activity.

Import accepts ?kind=transactions to make the second step direct. The chosen import kind survives reload; switching kind clears the prior file/result and remounts the native file control so an invoice file is not accidentally reused for payments. Existing atomic validation, duplicate warnings and correction flow remain unchanged.

## Detail navigation

Invoice and contextual incoming-payment list rows link to /invoices/:id and /transactions/:id. Invoice lists show derived Paid/Part paid/Unpaid status. Zero-total invoices with zero balance are Paid. Payment details show Unallocated/Partly allocated/Fully allocated. These are allocation/balance states, not bank settlement claims; due dates remain visible separately.

Invoice details show customer, reference, dates, total and outstanding amount. Payment details show named bank account, date, payer, description/reference, original and unallocated amount, duplicate warning and direct payment review. Each view shows 50 allocation-history rows per page, with amount, active/reversed state, date, related invoice/payment and Activity links. Reversal reasons remain visible and reversed rows stay in history. Balances are current as of the read/refresh; audit details retain recorded historical values. Refresh and Retry actions are explicit.

Existing M4/M5 confirmation/reversal forms continue to show consequences, require acknowledgment and retain exact unknown-outcome requests for safe retries. This milestone does not introduce another financial mutation path. Summary/detail reads never allocate, reverse, edit amounts or write audit events.

## Read API

All endpoints are protected by the existing bearer principal and return no-store JSON. Workspace is derived server-side; foreign records return 404 and unauthenticated requests return 401. SQL is parameterized and separated from HTTP/business code in workspace-views/{routes,service,repository}.ts. Reads use explicit read-only repeatable-read transactions to keep totals/history within a response consistent.

- GET /overview: invoiceCount, paymentCount, outstandingPence, paymentsToReview, unallocatedPence, next and up to five recent financial-event summaries. Pence totals are PostgreSQL numeric sums returned as strings; a workspace total may exceed a single BIGINT without becoming a JavaScript Number. next is import_invoices/import_payments/review/invoices/activity.
- GET /invoices/:id?page=1: owned invoice record with derived outstanding_pence, up to 50 linked allocation/reversal history rows, page and hasMore.
- GET /transactions/:id?page=1: owned payment with derived unallocated_pence, accountName, linked allocation/reversal history, page and hasMore.

IDs must be UUIDs, page is a positive bounded integer and unknown query fields fail on detail routes. No client monetary values are accepted. Original amounts minus allocations without a reversal remain the source of balances. Pages are separate snapshots and can shift after new activity; refreshing returns current data. No schema/dependency changes are needed.

## UX review and verification boundaries

| Screen | Verified purpose and interaction |
| --- | --- |
| Landing | Clear audience/workflow/control explanation, account action, native sample download, responsive text |
| Registration/sign-in/settings | Labeled native fields, visible errors, session expiry/restoration/retry, sign out and saved settings |
| Overview | One contextual next action, sparse real balances, compact history, outage recovery without fabricated values |
| Import | Native CSV/account inputs, sequential guidance, row corrections, duplicate consequences and retained kind |
| Review Payments | One selected payment, visible evidence/ambiguity/warnings, separate explicit partial/split confirmation |
| Invoice/payment records | Linked readable lists, statuses, dates/current balances, preserved history and direct related actions |
| Activity/reversal | Recorded versus current balances, reason/actor/timeline, restored-balance review and safe unknown-result recovery |

Semantic headings/landmarks, native links/buttons/labels, visible focus, keyboard skip and focused main content after pathname navigation support keyboard/screen-reader use. Query-only payment/activity selections retain their existing focused review behavior. Route navigation updates the page title. Error/status feedback stays plain and actionable. Tables scroll within their container on mobile; new detail/history text wraps. No financial consequence is placed only inside a collapsed disclosure.

The desktop/mobile journey test uses real account registration, native CSV uploads, the actual matching/allocation/reversal APIs and PostgreSQL. It covers a partial then split allocation, reversal, linked record details/reload, updated Overview balances and an actual network-outage/retry. Existing browser checks retain expiry, keyboard, ambiguity, import error, concurrency-backed finance and lost-response recovery coverage. Screenshots use synthetic data. This does not establish full WCAG conformance or measured user research; no performance/precision/recall benchmark or public deployment is claimed. Those remain M7 work.
