# CSV imports — Milestone 2

Use the Import Center after signing in. Start with invoices, then import incoming payments into a selected named bank account. Samples under apps/web/public/samples contain synthetic records only. Downloads use the Vite base path and work under /Coincela/.

## Formats

Invoice header (all required):

```csv
invoice_number,customer_name,issue_date,due_date,currency,total_amount
```

Payment header (all required):

```csv
transaction_date,description,amount,currency
```

Payment optional columns: external_transaction_id, payment_reference, payer_name. Headers are case-sensitive, unique and may be reordered. Unknown columns are rejected to catch mapping mistakes. Whitespace at field boundaries is trimmed. Quote fields containing commas/newlines and double embedded quote characters. UTF-8 with or without BOM is accepted; malformed UTF-8 is rejected. Error row numbers refer to physical line numbers at the end of each CSV record (including multiline quoted records).

Limits: 1 MiB decoded CSV bytes, 1,000 nonempty data records, 16,000 characters per parser record, 500 characters for names/references/descriptions, and no null characters in those fields. A header plus at least one record is required. Dates must be real YYYY-MM-DD dates; invoice due dates cannot precede issue dates. Currency must be GBP. Amounts are unsigned decimal strings with at most two decimals, no exponent/comma notation and no unsafe numeric conversion. Invoice totals may be zero; payments must be positive incoming credits. Amounts must fit PostgreSQL BIGINT pence. Outgoing payments, refunds and other currencies are unsupported.

## Atomicity and duplicates

1. Parse/validate the complete bounded upload before committing financial records.
2. Lock the authenticated workspace row for the duration of duplicate inspection and insertion. Imports within a workspace serialize; different workspaces remain independent.
3. SHA-256 of exact uploaded CSV bytes identifies an already completed file for that workspace/kind/account. Return its original batch and explicit repeated-file/skipped counts without a second financial insertion or duplicate batch. This identity includes raw whitespace/BOM, not filename.
4. Invoice number within a workspace and external payment ID within a workspace/bank account are reliable identities. Identical normalized details are skipped and counted. Conflicting details reject the entire file and require correction. The same policy covers repeated identifiers inside one file.
5. Identical-looking payments without a repeated reliable identifier are retained. Visible date/description/amount candidates are marked for duplicate review, including earlier candidates in that account. No review action, deletion or financial allocation is performed at this milestone.
6. Persist new records, successful batch metadata and candidate review flags in one PostgreSQL transaction. On SQL failure roll everything back. Validation/identity conflicts create a rejected batch and row/file errors, with zero financial insertions. Malformed structure has unknown row count, recorded as zero. Transport failures (oversized, unsupported content type), invalid bank selection and authorization failures do not create batches.

No uploaded CSV or filename is stored on disk. Import history stores kind, content hash, status, counts, timestamps and validation errors; original raw file contents are not retained. Repeated exact completed uploads reference the original history record. Rejected files can be corrected and retried. Same visible payment fields alone never cause a skip.

## API

All routes require a bearer session and derive workspace ownership from it. Prefix /api only when using the development Vite proxy; production API paths are at root.

- GET /bank-accounts returns this workspace's accounts. POST with JSON {name} creates or returns the same named account, fixed GBP.
- POST /imports/invoices or /imports/transactions with Content-Type: text/csv and raw file bytes. Payment imports require X-Bank-Account-Id with a workspace-owned UUID. CORS permits this header for allowed origins only.
- Success: 201 (new batch) or 200 (exact completed file repeat). Validation rejection: 422. Body includes batchId, status, rowCount, insertedCount, duplicateCount, reviewCount, repeatedFile, errors [{row,field,message}]. Unknown database failures return sanitized 500 with no partial records.
- GET /imports?page=1, /invoices?page=1, /transactions?page=1 return {records,page,hasMore}, with 50 records per page ordered newest first, then ID. Pagination rejects invalid values.
- GET /imports/:id/errors returns this workspace's errors; foreign/unknown batch IDs return 404.

Listings expose imported totals/amounts as string pence. No allocation or matching occurs during import. Financial balances and invoice reconciliation status are later-service concerns.

The bounded synchronous parser and info records follow the official [csv-parse sync API](https://csv.js.org/parse/api/sync/) and [info option](https://csv.js.org/parse/options/info/). This deliberately favors a small explicit workflow rather than arbitrary large-file streaming.
