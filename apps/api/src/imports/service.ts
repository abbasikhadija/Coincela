import type pg from 'pg';
import { createHash } from 'node:crypto';
import { HttpError } from '../errors.js';
import { parseUpload, type ImportKind, type InvoiceRow, type PaymentRow, type ParsedRow, type RowError } from './parser.js';
function sameRow(existing: Record<string, unknown>, row: ParsedRow): boolean {
  return Object.entries(row).every(([key, value]) => existing[key] === value);
}
export class ImportService {
  constructor(private pool: pg.Pool) {}
  async import(workspaceId: string, kind: ImportKind, file: Buffer, bankAccountId: string | null) {
    const parsed = parseUpload(file, kind);
    const hash = createHash('sha256').update(file).digest('hex');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serializes imports per workspace, including exact-file and identity checks.
      await client.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [workspaceId]);
      if (kind === 'transactions') {
        const account = await client.query('SELECT id FROM bank_accounts WHERE workspace_id=$1 AND id=$2', [workspaceId, bankAccountId]);
        if (!account.rowCount) throw new HttpError(404, 'BANK_ACCOUNT_NOT_FOUND', 'Choose a bank account in your workspace.');
      }
      const previous = (await client.query('SELECT id, row_count FROM import_batches WHERE workspace_id=$1 AND kind=$2 AND bank_account_id IS NOT DISTINCT FROM $3 AND file_hash=$4 AND status=\'completed\'', [workspaceId, kind, bankAccountId, hash])).rows[0];
      if (previous) {
        await client.query('COMMIT');
        return { batchId: previous.id, status: 'completed', rowCount: previous.row_count, insertedCount: 0, duplicateCount: previous.row_count, reviewCount: 0, repeatedFile: true, errors: [] };
      }
      const errors: RowError[] = [...parsed.errors];
      const newRows: { row: ParsedRow; review: boolean }[] = [];
      let duplicateCount = 0;
      const identities = new Map<string, ParsedRow>();
      if (!errors.length) for (const [index, row] of parsed.rows.entries()) {
        const identity = kind === 'invoices' ? (row as InvoiceRow).invoice_number : (row as PaymentRow).external_transaction_id;
        let existing: Record<string, unknown> | undefined;
        if (identity) {
          existing = identities.get(identity) as unknown as Record<string, unknown> | undefined;
          if (!existing) {
            const sql = kind === 'invoices'
              ? "SELECT invoice_number,customer_name,issue_date::text,due_date::text,currency,total_pence::text FROM invoices WHERE workspace_id=$1 AND invoice_number=$2"
              : "SELECT transaction_date::text,description,amount_pence::text,currency,external_transaction_id,payment_reference,payer_name FROM bank_transactions WHERE workspace_id=$1 AND bank_account_id=$3 AND external_transaction_id=$2";
            existing = (await client.query(sql, kind === 'invoices' ? [workspaceId, identity] : [workspaceId, identity, bankAccountId])).rows[0];
          }
          if (existing) {
            if (sameRow(existing, row)) duplicateCount++;
            else errors.push({ row: parsed.rowLines[index] ?? index + 2, field: kind === 'invoices' ? 'invoice_number' : 'external_transaction_id', message: 'This identifier already has different details. Check the record before importing again. No records from this file were inserted.' });
            continue;
          }
          identities.set(identity, row);
        }
        newRows.push({ row, review: false });
      }
      if (!errors.length && kind === 'transactions') {
        // Identical visible fields are candidates for review, never proof of duplication.
        for (const entry of newRows) {
          const row = entry.row as PaymentRow;
          const candidate = await client.query('SELECT id FROM bank_transactions WHERE workspace_id=$1 AND bank_account_id=$2 AND transaction_date=$3 AND description=$4 AND amount_pence=$5 LIMIT 1', [workspaceId, bankAccountId, row.transaction_date, row.description, row.amount_pence]);
          entry.review = !!candidate.rowCount || newRows.some(other => other !== entry && (other.row as PaymentRow).transaction_date === row.transaction_date && (other.row as PaymentRow).description === row.description && (other.row as PaymentRow).amount_pence === row.amount_pence);
        }
      }
      const rejected = errors.length > 0;
      const batch = (await client.query('INSERT INTO import_batches(workspace_id,bank_account_id,kind,file_hash,status,row_count,inserted_count,duplicate_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [workspaceId, bankAccountId, kind, hash, rejected ? 'rejected' : 'completed', parsed.rowCount, rejected ? 0 : newRows.length, rejected ? 0 : duplicateCount])).rows[0];
      if (rejected) {
        for (const error of errors) await client.query('INSERT INTO import_errors(workspace_id,batch_id,row_number,field,message) VALUES ($1,$2,$3,$4,$5)', [workspaceId, batch.id, error.row, error.field, error.message]);
      } else {
        for (const entry of newRows) {
          if (kind === 'invoices') {
            const row = entry.row as InvoiceRow;
            await client.query('INSERT INTO invoices(workspace_id,import_batch_id,invoice_number,customer_name,issue_date,due_date,currency,total_pence) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [workspaceId, batch.id, row.invoice_number, row.customer_name, row.issue_date, row.due_date, row.currency, row.total_pence]);
          } else {
            const row = entry.row as PaymentRow;
            if (entry.review) await client.query('UPDATE bank_transactions SET requires_duplicate_review=true WHERE workspace_id=$1 AND bank_account_id=$2 AND transaction_date=$3 AND description=$4 AND amount_pence=$5', [workspaceId, bankAccountId, row.transaction_date, row.description, row.amount_pence]);
            await client.query('INSERT INTO bank_transactions(workspace_id,bank_account_id,import_batch_id,transaction_date,description,amount_pence,currency,external_transaction_id,payment_reference,payer_name,requires_duplicate_review) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [workspaceId, bankAccountId, batch.id, row.transaction_date, row.description, row.amount_pence, row.currency, row.external_transaction_id, row.payment_reference, row.payer_name, entry.review]);
          }
        }
      }
      await client.query('COMMIT');
      return { batchId: batch.id, status: rejected ? 'rejected' : 'completed', rowCount: parsed.rowCount, insertedCount: rejected ? 0 : newRows.length, duplicateCount: rejected ? 0 : duplicateCount, reviewCount: rejected ? 0 : newRows.filter(entry => entry.review).length, repeatedFile: false, errors };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
