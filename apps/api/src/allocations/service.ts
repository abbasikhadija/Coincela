import type pg from 'pg';
import type { Principal } from '../auth/repository.js';
import { HttpError } from '../errors.js';
import { canonicalRequest, requestHash, type AllocationInput } from './validation.js';
import { confirmSuggestion, createOperation, findOperation, finishOperation, insertAllocation, listInvoices, lockFinancialRows, lockOperation, lockSuggestion, readInvoices, readPayment } from './repository.js';
import { readSnapshot } from '../matching/repository.js';
export interface AllocationResult {
  operationId: string; paymentId: string; allocatedPence: string; remainingPence: string;
  allocations: { id: string; invoiceId: string; invoiceNumber: string; customerName: string; amountPence: string; remainingPence: string }[];
}
export class AllocationService {
  constructor(private pool: pg.Pool) {}
  async options(workspaceId: string, paymentId: string, page: number, search: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const payment = await readPayment(client, workspaceId, paymentId);
      if (!payment) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Payment not found.');
      const invoices = await listInvoices(client, workspaceId, page, search);
      await client.query('COMMIT'); return { payment, invoices: invoices.slice(0, 50), hasMore: invoices.length > 50, page };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async allocate(principal: Principal, input: AllocationInput) {
    const { workspaceId, userId } = principal;
    const client = await this.pool.connect();
    const hash = requestHash(input);
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout='2000ms'");
      // This operation-key mutex precedes financial row locks. It serializes retries even
      // when a conflicting payload names a different payment; it is not a workspace lock.
      await lockOperation(client, workspaceId, input.operationKey);
      const existing = await findOperation(client, workspaceId, input.operationKey);
      if (existing) {
        if (existing.kind !== 'allocation' || existing.request_hash !== hash) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'This confirmation identifier was already used for different details. Start a new allocation.');
        await client.query('COMMIT'); return existing.result;
      }
      const rows = canonicalRequest(input).allocations;
      const ids = rows.map(row => row.invoiceId);
      if (!await lockFinancialRows(client, workspaceId, input.paymentId, ids)) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Payment not found.');
      // Separate statements after locks are acquired see all prior commits under READ COMMITTED.
      const payment = (await readPayment(client, workspaceId, input.paymentId))!;
      const invoices = await readInvoices(client, workspaceId, ids);
      if (invoices.length !== rows.length) throw new HttpError(404, 'INVOICE_NOT_FOUND', 'An invoice was not found in your workspace. Refresh and choose again.');
      const total = rows.reduce((sum, row) => sum + BigInt(row.amountPence), 0n);
      if (BigInt(payment.unallocated_pence) < 0n || BigInt(payment.unallocated_pence) > BigInt(payment.amount_pence)) throw Error('Invalid derived payment balance');
      if (total > BigInt(payment.unallocated_pence)) throw new HttpError(409, 'PAYMENT_BALANCE_CHANGED', 'The allocation exceeds the available payment. Refresh and review the amounts.');
      const snapshot = rows.some(row => row.suggestionId) ? await readSnapshot(client, workspaceId, input.paymentId) : null;
      for (const row of rows) {
        const invoice = invoices.find(invoice => invoice.id === row.invoiceId)!;
        const balance = BigInt(invoice.outstanding_pence);
        if (balance < 0n || balance > BigInt(invoice.total_pence)) throw Error('Invalid derived invoice balance');
        if (invoice.currency !== payment.currency || BigInt(row.amountPence) > balance) throw new HttpError(409, 'INVOICE_BALANCE_CHANGED', `The amount exceeds the outstanding balance for ${invoice.invoice_number}. Refresh and review the amounts.`);
        if (row.suggestionId) {
          const suggestion = await lockSuggestion(client, workspaceId, row.suggestionId);
          if (!suggestion || suggestion.invoice_id !== row.invoiceId || suggestion.bank_transaction_id !== input.paymentId) throw new HttpError(404, 'SUGGESTION_NOT_FOUND', 'Suggestion not found for this payment and invoice.');
          if (suggestion.review_status !== 'pending' || suggestion.snapshot_hash !== snapshot!.hash) throw new HttpError(409, 'STALE_SUGGESTION', 'This suggestion is no longer current. Refresh and regenerate before confirming.');
        }
      }
      const operationId = await createOperation(client, workspaceId, input.operationKey, hash);
      const result: AllocationResult = { operationId, paymentId: input.paymentId, allocatedPence: total.toString(), remainingPence: (BigInt(payment.unallocated_pence) - total).toString(), allocations: [] };
      for (const row of rows) {
        const invoice = invoices.find(invoice => invoice.id === row.invoiceId)!;
        const id = await insertAllocation(client, workspaceId, operationId, input.paymentId, row.invoiceId, row.amountPence);
        result.allocations.push({ id, invoiceId: row.invoiceId, invoiceNumber: invoice.invoice_number, customerName: invoice.customer_name, amountPence: row.amountPence, remainingPence: (BigInt(invoice.outstanding_pence) - BigInt(row.amountPence)).toString() });
        if (row.suggestionId) await confirmSuggestion(client, workspaceId, row.suggestionId);
      }
      await finishOperation(client, workspaceId, userId, result, { ...result, request: canonicalRequest(input) });
      await client.query('COMMIT'); return result;
    } catch (error) {
      await client.query('ROLLBACK');
      if (typeof error === 'object' && error !== null && 'code' in error && ['55P03', '40P01'].includes(String(error.code))) throw new HttpError(409, 'ALLOCATION_BUSY', 'Another confirmation is in progress. Retry this confirmation with the same details.');
      throw error;
    } finally { client.release(); }
  }
}
