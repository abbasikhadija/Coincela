import type pg from 'pg';
import { HttpError } from '../errors.js';
import { readInvoices, readPayment } from '../allocations/repository.js';
import { listEvents } from '../activity/repository.js';
import { bankName, overviewTotals, recordAllocations } from './repository.js';
export class WorkspaceViewsService {
  constructor(private pool: pg.Pool) {}
  async overview(workspaceId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const totals = await overviewTotals(client, workspaceId); const recent = (await listEvents(client, workspaceId, 1)).slice(0, 5);
      const next = totals.invoiceCount === 0 ? 'import_invoices' : totals.paymentCount === 0 ? 'import_payments' : totals.paymentsToReview > 0 ? 'review' : BigInt(totals.outstandingPence) > 0n ? 'invoices' : 'activity';
      await client.query('COMMIT'); return { ...totals, next, recent };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async detail(workspaceId: string, kind: 'invoices' | 'transactions', id: string, page: number) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const record = kind === 'invoices' ? (await readInvoices(client, workspaceId, [id]))[0] : await readPayment(client, workspaceId, id);
      if (!record) throw new HttpError(404, 'RECORD_NOT_FOUND', kind === 'invoices' ? 'Invoice not found.' : 'Payment not found.');
      const allocations = await recordAllocations(client, workspaceId, kind, id, page);
      const accountName = kind === 'transactions' ? await bankName(client, workspaceId, id) : undefined;
      await client.query('COMMIT'); return { record, accountName, allocations: allocations.slice(0, 50), hasMore: allocations.length > 50, page };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}
