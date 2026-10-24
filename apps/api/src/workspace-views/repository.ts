import type pg from 'pg';
import { invoiceSelect } from '../allocations/repository.js';
import { paymentSelect } from '../matching/repository.js';
export interface OverviewTotals { invoiceCount: number; paymentCount: number; outstandingPence: string; paymentsToReview: number; unallocatedPence: string }
export async function overviewTotals(client: pg.PoolClient, workspaceId: string) {
  return (await client.query<OverviewTotals>(`WITH owned_invoices AS (${invoiceSelect} WHERE i.workspace_id=$1), owned_payments AS (${paymentSelect} WHERE t.workspace_id=$1)
    SELECT (SELECT count(*)::int FROM owned_invoices) AS "invoiceCount",(SELECT count(*)::int FROM owned_payments) AS "paymentCount",
    (SELECT COALESCE(sum(outstanding_pence::numeric),0)::text FROM owned_invoices) AS "outstandingPence",
    (SELECT count(*)::int FROM owned_payments WHERE unallocated_pence::numeric>0) AS "paymentsToReview",
    (SELECT COALESCE(sum(unallocated_pence::numeric),0)::text FROM owned_payments) AS "unallocatedPence"`, [workspaceId])).rows[0]!;
}
export interface RecordAllocation { id: string; operationId: string; paymentId: string; invoiceId: string; invoiceNumber: string; customerName: string; description: string; amountPence: string; createdAt: Date; reversalId: string | null; reversalOperationId: string | null; reason: string | null }
export async function recordAllocations(client: pg.PoolClient, workspaceId: string, kind: 'invoices' | 'transactions', id: string, page: number) {
  const column = kind === 'invoices' ? 'invoice_id' : 'bank_transaction_id';
  return (await client.query<RecordAllocation>(`SELECT a.id,a.operation_id AS "operationId",a.bank_transaction_id AS "paymentId",a.invoice_id AS "invoiceId",i.invoice_number AS "invoiceNumber",i.customer_name AS "customerName",t.description,a.amount_pence::text AS "amountPence",a.created_at AS "createdAt",r.id AS "reversalId",r.operation_id AS "reversalOperationId",r.reason
    FROM payment_allocations a JOIN invoices i ON i.workspace_id=a.workspace_id AND i.id=a.invoice_id
    JOIN bank_transactions t ON t.workspace_id=a.workspace_id AND t.id=a.bank_transaction_id
    LEFT JOIN allocation_reversals r ON r.workspace_id=a.workspace_id AND r.allocation_id=a.id
    WHERE a.workspace_id=$1 AND a.${column}=$2 ORDER BY a.created_at DESC,a.id DESC LIMIT 51 OFFSET $3`, [workspaceId, id, (page - 1) * 50])).rows;
}
export async function bankName(client: pg.PoolClient, workspaceId: string, paymentId: string) {
  return (await client.query<{ name: string }>('SELECT b.name FROM bank_accounts b JOIN bank_transactions t ON t.workspace_id=b.workspace_id AND t.bank_account_id=b.id WHERE t.workspace_id=$1 AND t.id=$2', [workspaceId, paymentId])).rows[0]!.name;
}
