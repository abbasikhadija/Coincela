import type pg from 'pg';
import { HttpError } from '../errors.js';
import { allocationsForOperation } from '../reversals/repository.js';
import { readInvoices, readPayment } from '../allocations/repository.js';
import { findEvent, listEvents, timeline } from './repository.js';
export class ActivityService {
  constructor(private pool: pg.Pool) {}
  async list(workspaceId: string, page: number) {
    const client = await this.pool.connect();
    try { const events = await listEvents(client, workspaceId, page); return { events: events.slice(0, 25), hasMore: events.length > 25, page }; } finally { client.release(); }
  }
  async detail(workspaceId: string, operationId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const event = await findEvent(client, workspaceId, operationId);
      if (!event) throw new HttpError(404, 'ACTIVITY_NOT_FOUND', 'Activity record not found.');
      const allocations = await allocationsForOperation(client, workspaceId, operationId);
      const invoices = await readInvoices(client, workspaceId, allocations.map(row => row.invoice_id));
      const payment = allocations.length ? await readPayment(client, workspaceId, allocations[0]!.bank_transaction_id) : null;
      const related = [...new Set([operationId, ...allocations.flatMap(row => [row.operation_id, ...(row.reversal_operation_id ? [row.reversal_operation_id] : [])])])];
      const events = await timeline(client, workspaceId, related);
      await client.query('COMMIT');
      return { event, payment, allocations: allocations.map(row => ({ ...row, invoice: invoices.find(invoice => invoice.id === row.invoice_id) })), timeline: events };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}
