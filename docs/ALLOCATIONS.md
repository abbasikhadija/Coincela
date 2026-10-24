# Transactional payment allocation — Milestone 4

Review Payments supports manually choosing invoices or starting with a current suggestion, then editing amounts and explicitly confirming. Full, partial and split payments use the same service. One request targets one payment and 1–50 distinct invoices. Multiple requests can allocate separate payments to the same invoice or use the remaining part of a payment. Excess stays unallocated; an unpaid invoice balance remains due. Nothing is written by previewing, generating or rejecting suggestions.

## HTTP contract

All endpoints require a valid bearer session, derive workspace and actor from that session, use parameterized SQL, return no-store JSON and encode pence as strings.

- `GET /allocations/payments/:id?page=1&search=` returns the owned payment/current unallocated amount and 50 invoices with total/outstanding pence, customer, reference and dates, plus page/hasMore. Search is a literal case-insensitive substring of invoice number or customer (up to 100 characters). Closed invoices are visible but cannot receive allocations. Options are a consistent read-only snapshot, never a reserved balance.
- `POST /allocations` accepts the following strict JSON. No client balance, owner, currency or audit identity is accepted. Amounts must be canonical positive integer-pence strings within PostgreSQL BIGINT. Duplicate invoices, unsupported fields, zero/negative/decimal/numeric amounts and missing explicit confirmation return 400.

```json
{
  "operationKey": "c38044c0-1d1c-4fd7-9b2a-44fd22afcf1d",
  "paymentId": "a04348a1-dcd2-4abc-b48e-6821477f558e",
  "confirmed": true,
  "allocations": [
    { "invoiceId": "455691c4-cce2-4ae3-a618-25bfbeb61387", "amountPence": "4000" }
  ]
}
```

Each row may include suggestionId. It must belong to the payment/invoice/workspace, remain pending and have a current financial fingerprint. Stale/rejected/confirmed evidence returns 409. A suggestion does not supply authorization or a trusted amount. The entered amount is independently validated against current locked balances. A manual allocation deliberately omits suggestionId; it is an explicit financial decision, including for unmatched payments.

Success (200, including retry) returns operationId, paymentId, allocatedPence, remainingPence and allocations containing ID, invoice/customer, amountPence and remainingPence. These are the balances recorded at that confirmation; an old retry response is not a new live-balance response. Unknown/foreign resources return 404. Changed/insufficient balances, conflicting operation keys and lock contention return 409. Unexpected failures return sanitized 500 responses. Retry uncertain failures with the same operation key and identical payload.

## Atomicity, locks and idempotency

1. BEGIN at PostgreSQL READ COMMITTED, with a two-second lock timeout.
2. Acquire a transaction-scoped advisory mutex derived from workspace + operation UUID, before financial row locks. This serializes concurrent retries even when a conflicting request names another payment. Hash collisions only cause extra serialization; the unique workspace/key constraint and full request hash remain authoritative.
3. Read an existing financial_operations result. Identical canonical payload returns the stored result without new allocations/audits; differing kind/payload returns 409. Canonicalization sorts split rows by invoice ID and includes payment, explicit confirmation, amounts and suggestion IDs.
4. Lock the owned bank transaction with FOR UPDATE, then all affected owned invoices in deterministic UUID order. No workspace-wide mutex serializes financial operations.
5. After lock acquisition, use new statements to recalculate payment and invoice balances from original amounts minus allocations that have no reversal. READ COMMITTED sees the previous lock holder's commit. Never trust a balance read before the locks.
6. Validate ownership, GBP, positive bounded amounts, each invoice balance, total available payment and any supplied suggestion. Lock supplied suggestion metadata after the financial rows.
7. Insert the operation, allocations and optional suggestion confirmations; persist the complete result and one actor-scoped payment_allocated audit event with request and result. COMMIT all effects together. Every error rolls back everything. No original allocation is updated or deleted.

Original migrations already contain the required constraints/indexes; M4 adds no schema migration. Direct SQL can bypass service aggregate invariants, so application writes must use the locked service. Future reversals must preserve the same bank-first/sorted-invoice lock policy, unique reversal records, reason requirements and atomic audit/idempotency rules. No reversal endpoint or Activity history UI is provided in M4.

## Confirmation and recovery UX

The form shows payment/customer/reference, invoice totals/outstanding balances, editable GBP amounts, each invoice remainder and total/payment remainder. Seeded suggestion evidence, ambiguity and warnings remain visible. A separate checkbox acknowledges the exact current draft; editing resets it. The Confirm action stays disabled for invalid/over-limit amounts or without acknowledgment. The server always rechecks current state. Currency conversion and automatic allocation are unsupported.

The browser saves the exact confirmed payload/key in workspace/payment-scoped sessionStorage before submission. Unknown network/server outcomes retain it, lock editing and offer Retry same confirmation, including after reload/reopening the allocation form. Known client/conflict responses allow correction and a new reviewed confirmation. Successful receipts clear the pending request and refresh current payment/list data. Session storage is tab-scoped: keep that tab until uncertain results are resolved. Clearing browser storage or deliberately starting a distinct operation is outside the retry guarantee. Tokens never appear in this stored request.

Keyboard labels, visible focus, native checkbox/buttons, error/status announcements and sequential mobile navigation are included. Reversal unavailability is visible before confirming. This is not a complete WCAG conformance claim.
