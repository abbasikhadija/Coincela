import type pg from 'pg';
import type { Principal } from '../auth/repository.js';
import { HttpError } from '../errors.js';
import { createOperation, findOperation, finishOperation, lockFinancialRows, lockOperation, readInvoices, readPayment } from '../allocations/repository.js';
import { findAllocation, insertReversal } from './repository.js';
import { reversalHash, reversalRequest, type ReversalInput } from './validation.js';
export interface ReversalResult {
  operationId: string; reversalId: string; allocationId: string; originalOperationId: string; paymentId: string; invoiceId: string;
  invoiceNumber: string; customerName: string; restoredPence: string; paymentUnallocatedPence: string; invoiceOutstandingPence: string; reason: string; createdAt: string;
}
export class ReversalService {
  constructor(private pool: pg.Pool) {}
  async preview(workspaceId: string, allocationId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const allocation = await findAllocation(client, workspaceId, allocationId);
      if (!allocation) throw new HttpError(404, 'ALLOCATION_NOT_FOUND', 'Allocation not found.');
      const payment = (await readPayment(client, workspaceId, allocation.bank_transaction_id))!;
      const invoice = (await readInvoices(client, workspaceId, [allocation.invoice_id]))[0]!;
      await client.query('COMMIT'); return { allocation, payment, invoice };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async reverse(principal: Principal, input: ReversalInput) {
    const { workspaceId, userId } = principal; const client = await this.pool.connect(); const hash = reversalHash(input);
    try {
      await client.query('BEGIN'); await client.query("SET LOCAL lock_timeout='2000ms'");
      await lockOperation(client, workspaceId, input.operationKey);
      const existing = await findOperation<ReversalResult>(client, workspaceId, input.operationKey);
      if (existing) {
        if (existing.kind !== 'reversal' || existing.request_hash !== hash) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'This confirmation identifier was already used for different details. Refresh and review again.');
        await client.query('COMMIT'); return existing.result;
      }
      // Immutable allocation lookup locates financial rows; never lock allocation before the bank.
      const located = await findAllocation(client, workspaceId, input.allocationId);
      if (!located) throw new HttpError(404, 'ALLOCATION_NOT_FOUND', 'Allocation not found.');
      await lockFinancialRows(client, workspaceId, located.bank_transaction_id, [located.invoice_id]);
      const allocation = (await findAllocation(client, workspaceId, input.allocationId))!;
      if (allocation.reversal_id) throw new HttpError(409, 'ALREADY_REVERSED', 'This allocation has already been reversed. Refresh its history.');
      const payment = (await readPayment(client, workspaceId, allocation.bank_transaction_id))!;
      const invoice = (await readInvoices(client, workspaceId, [allocation.invoice_id]))[0]!;
      const amount = BigInt(allocation.amount_pence); const available = BigInt(payment.unallocated_pence); const outstanding = BigInt(invoice.outstanding_pence);
      if (amount <= 0n || available < 0n || outstanding < 0n || available + amount > BigInt(payment.amount_pence) || outstanding + amount > BigInt(invoice.total_pence) || invoice.currency !== payment.currency) throw Error('Invalid derived financial balance');
      const operationId = await createOperation(client, workspaceId, input.operationKey, hash, 'reversal');
      const reversal = await insertReversal(client, workspaceId, allocation.id, operationId, input.reason);
      const result: ReversalResult = { operationId, reversalId: reversal.id, allocationId: allocation.id, originalOperationId: allocation.operation_id,
        paymentId: payment.id, invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, customerName: invoice.customer_name,
        restoredPence: amount.toString(), paymentUnallocatedPence: (available + amount).toString(), invoiceOutstandingPence: (outstanding + amount).toString(), reason: input.reason, createdAt: reversal.created_at.toISOString() };
      await finishOperation(client, workspaceId, userId, result, { ...result, request: reversalRequest(input) }, 'allocation_reversed');
      await client.query('COMMIT'); return result;
    } catch (error) {
      await client.query('ROLLBACK');
      if (typeof error === 'object' && error !== null && 'code' in error && ['55P03', '40P01'].includes(String(error.code))) throw new HttpError(409, 'REVERSAL_BUSY', 'Another confirmation is in progress. Retry with the same reversal details.');
      throw error;
    } finally { client.release(); }
  }
}
