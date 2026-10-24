# Reversals and audit history — Milestone 5

A reversal corrects one allocation in full. It creates an allocation_reversals record and preserves the original payment_allocations record and original audit event. Other allocations from the same split remain active. A reason is mandatory and retained. This is a reconciliation correction, not a bank refund or movement of money. Partial reversal of an individual allocation is not supported; reverse it once, then explicitly allocate the correct amount with a new allocation operation if needed.

## Protected HTTP API

All routes derive workspace/actor from the authenticated bearer session, use parameterized SQL and return no-store JSON. Unknown/foreign resources return 404. Financial pence values remain strings; no client balance, owner, restoration amount or currency is accepted.

- `GET /reversals/allocations/:id`: a consistent read-only preview containing the original allocation, optional existing reversal identity/reason, current payment and current invoice. Existing reversed allocations remain readable for history and retry recovery. A preview reserves no balances.
- `POST /reversals`: strict JSON with operationKey UUID, allocationId UUID, confirmed:true and reason (trimmed 1–1000 characters). Tabs/newlines are allowed; NUL/other non-printing control characters are rejected. Extra fields, malformed IDs, missing confirmation or blank/oversized reason return 400.

```json
{
  "operationKey": "0c592489-49fb-49e0-97ae-0d4cfcb47dc1",
  "allocationId": "b4313b17-d108-491f-88f1-dd1b8c261d82",
  "confirmed": true,
  "reason": "The transfer belongs to another invoice; bank reference checked."
}
```

Success returns operationId, reversalId, allocationId, originalOperationId, paymentId, invoiceId, invoiceNumber, customerName, restoredPence, paymentUnallocatedPence, invoiceOutstandingPence, reason and createdAt. The balances are recorded at the successful reversal. An identical retry returns exactly that saved result even after later allocations, without restoring anything again. A different reason/allocation or operation kind under the same key returns 409. A new key against an already reversed allocation returns 409 ALREADY_REVERSED.

- `GET /activity?page=1`: 25 financial audit event summaries per page, newest timestamp then ID, with operation ID, event type, string amount, actor email and timestamp. Summaries omit request/result payloads. Pages are separate reads and may shift if new operations arrive; refresh for current history.
- `GET /activity/:operationId`: selected event with saved audit details, current payment, original allocation rows joined to any reversal, current invoice balances and related audit events ordered oldest timestamp then ID. An allocation confirmation includes all of its split rows. A reversal event includes the one corrected row and a linkable originalOperationId. Audit amounts record historical decisions; current balances are explicitly separate.

No endpoint changes/deletes an existing allocation, reason or audit event. Activity covers allocation/reversal financial events, while Import retains its own import history. Reversals do not reinstate an old suggestion as current: ledger fingerprints include reversal IDs and require fresh matching/review.

## Transaction and concurrency policy

1. BEGIN at READ COMMITTED, with two-second lock waits.
2. Acquire the same workspace/operation-key advisory mutex as allocations. Check the persisted operation kind/request hash. Identical retries return the stored outcome; conflicting payloads fail.
3. Read the owned immutable allocation only to locate the bank transaction and invoice. This lookup is not used to decide whether a reversal remains available.
4. Lock the bank transaction first, then the affected invoice through the same deterministic invoice-lock helper used by allocations. Re-read the allocation/reversal status and recalculate current derived balances in new statements after the locks.
5. Reject an already reversed allocation. Derive restoration from the original stored allocation amount. Validate that payment and invoice balances remain within their original positive/nonnegative totals; never use client-supplied amounts.
6. Insert the reversal financial operation and the unique allocation_reversals row with its reason. Persist the complete result and one actor-scoped allocation_reversed audit with original-operation/allocation links, reason, request and restored balances. COMMIT atomically. On any failure, roll back reversal, operation and audit together.

Bank/invoice locking serializes reversals with allocations and other reversals. Different request keys cannot reverse the same allocation twice; the unique allocation_id database constraint is a second boundary. The operation mutex also resolves identical retries and cross-kind key conflicts. Lock contention/deadlocks return retryable 409 responses; unexpected failures return sanitized 500 errors. No workspace-wide financial mutex is introduced. The existing schema and indexes are reused; no migration is added or edited.

Direct SQL can bypass service aggregate rules or mutate history and is outside the application's financial write policy. Application mutations must use the locked services. Database administrators and production privileges need the later production review; no tamper-proof external audit system is claimed.

## Activity and confirmation UX

Activity lists recent financial events with actor, time and amount. Selecting one preserves the operation in the hash-route query for reload continuity. Details show original allocation amounts, active/reversed status, current balances and related audit events. Reversed rows remain visible with their reason, time and original/reversal links. The secondary Review reversal action opens one focused task; normal history controls hide during that task.

Before confirmation, display customer/invoice/payment/reference, original allocation amount, current invoice/payment balances and both restored balances. The server recalculates them while locked, so preview values may change before confirmation. Require a reason and a separate acknowledgment; editing the reason resets acknowledgment. Explain that only this split row is reversed and no bank refund happens. Native labels, visible focus, textarea help, status/errors and result-heading focus support keyboard and mobile review.

Before submission, store the exact confirmed reason/allocation/key in workspace/allocation-scoped sessionStorage. Unknown network/server outcomes lock editing and permit only Retry same reversal. After reload, reopen the original activity and select Check reversal confirmation on the reversed row (or Review reversal if still active). The saved request is retried even if the read preview now shows a reversal. Known 4xx responses permit refresh/correction; successful receipts clear pending storage and refresh history. Keep the tab until an uncertain outcome is resolved. Browser storage clearing/new operation keys are outside this retry guarantee; the database still prevents a second reversal of the same allocation.

Receipts label restoration balances as of confirmation, and Activity reads current balances on refresh. M6 connects the public landing, Overview totals and invoice/payment detail history to these existing services; see WORKSPACE_UX.md. Performance benchmarks and production reliability/deployment remain M7 work.
