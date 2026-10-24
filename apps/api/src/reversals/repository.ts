import type pg from 'pg';
export interface StoredAllocation {
  id: string; operation_id: string; bank_transaction_id: string; invoice_id: string; amount_pence: string; created_at: Date;
  invoice_number: string; customer_name: string;
  reversal_id: string | null; reversal_operation_id: string | null; reversal_reason: string | null; reversed_at: Date | null;
}
const allocationSelect = `SELECT a.id,a.operation_id,a.bank_transaction_id,a.invoice_id,a.amount_pence::text,a.created_at,
 i.invoice_number,i.customer_name,r.id AS reversal_id,r.operation_id AS reversal_operation_id,r.reason AS reversal_reason,r.created_at AS reversed_at
 FROM payment_allocations a JOIN invoices i ON i.workspace_id=a.workspace_id AND i.id=a.invoice_id
 LEFT JOIN allocation_reversals r ON r.workspace_id=a.workspace_id AND r.allocation_id=a.id`;
export async function findAllocation(client: pg.PoolClient, workspaceId: string, id: string) {
  return (await client.query<StoredAllocation>(`${allocationSelect} WHERE a.workspace_id=$1 AND a.id=$2`, [workspaceId, id])).rows[0];
}
export async function allocationsForOperation(client: pg.PoolClient, workspaceId: string, operationId: string) {
  return (await client.query<StoredAllocation>(`${allocationSelect} WHERE a.workspace_id=$1 AND (a.operation_id=$2 OR r.operation_id=$2) ORDER BY a.invoice_id,a.id`, [workspaceId, operationId])).rows;
}
export async function insertReversal(client: pg.PoolClient, workspaceId: string, allocationId: string, operationId: string, reason: string) {
  return (await client.query<{ id: string; created_at: Date }>('INSERT INTO allocation_reversals(workspace_id,allocation_id,operation_id,reason) VALUES ($1,$2,$3,$4) RETURNING id,created_at', [workspaceId, allocationId, operationId, reason])).rows[0]!;
}
