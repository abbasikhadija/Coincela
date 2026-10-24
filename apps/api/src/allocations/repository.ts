import type pg from 'pg';
import type { Invoice, Payment } from '../matching/engine.js';
import { paymentSelect } from '../matching/repository.js';
import type { AllocationResult } from './service.js';
export const invoiceSelect = `SELECT i.id,i.invoice_number,i.customer_name,i.issue_date::text,i.due_date::text,i.currency,i.total_pence::text,
 (i.total_pence-COALESCE((SELECT sum(a.amount_pence) FROM payment_allocations a WHERE a.workspace_id=i.workspace_id AND a.invoice_id=i.id AND NOT EXISTS (SELECT 1 FROM allocation_reversals r WHERE r.workspace_id=a.workspace_id AND r.allocation_id=a.id)),0))::text AS outstanding_pence FROM invoices i`;
export async function readPayment(client: pg.PoolClient, workspaceId: string, paymentId: string) {
  return (await client.query<Payment>(`${paymentSelect} WHERE t.workspace_id=$1 AND t.id=$2`, [workspaceId, paymentId])).rows[0];
}
export async function readInvoices(client: pg.PoolClient, workspaceId: string, ids: string[]) {
  return (await client.query<Invoice>(`${invoiceSelect} WHERE i.workspace_id=$1 AND i.id=ANY($2::uuid[]) ORDER BY i.id`, [workspaceId, ids])).rows;
}
export async function lockFinancialRows(client: pg.PoolClient, workspaceId: string, paymentId: string, ids: string[]) {
  const payment = await client.query('SELECT id FROM bank_transactions WHERE workspace_id=$1 AND id=$2 FOR UPDATE', [workspaceId, paymentId]);
  if (!payment.rowCount) return false;
  // One bank first, then every affected invoice in deterministic database UUID order.
  await client.query('SELECT id FROM invoices WHERE workspace_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE', [workspaceId, ids]);
  return true;
}
export async function listInvoices(client: pg.PoolClient, workspaceId: string, page: number, search: string) {
  return (await client.query<Invoice>(`${invoiceSelect} WHERE i.workspace_id=$1 AND (strpos(lower(i.invoice_number),lower($2))>0 OR strpos(lower(i.customer_name),lower($2))>0) ORDER BY i.invoice_number,i.id LIMIT 51 OFFSET $3`, [workspaceId, search, (page - 1) * 50])).rows;
}
export async function lockOperation(client: pg.PoolClient, workspaceId: string, key: string) {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${workspaceId}:${key}`]);
}
export async function findOperation(client: pg.PoolClient, workspaceId: string, key: string) {
  return (await client.query<{ request_hash: string; kind: string; result: AllocationResult }>('SELECT request_hash,kind,result FROM financial_operations WHERE workspace_id=$1 AND operation_key=$2', [workspaceId, key])).rows[0];
}
export async function lockSuggestion(client: pg.PoolClient, workspaceId: string, id: string) {
  return (await client.query<{ invoice_id: string; bank_transaction_id: string; review_status: string; snapshot_hash: string }>('SELECT s.invoice_id,s.bank_transaction_id,s.review_status,r.snapshot_hash FROM match_suggestions s JOIN matching_runs r ON r.workspace_id=s.workspace_id AND r.id=s.run_id WHERE s.workspace_id=$1 AND s.id=$2 FOR UPDATE OF s', [workspaceId, id])).rows[0];
}
export async function createOperation(client: pg.PoolClient, workspaceId: string, key: string, hash: string) {
  return (await client.query<{ id: string }>("INSERT INTO financial_operations(workspace_id,operation_key,kind,request_hash,result) VALUES ($1,$2,'allocation',$3,'{}') RETURNING id", [workspaceId, key, hash])).rows[0]!.id;
}
export async function insertAllocation(client: pg.PoolClient, workspaceId: string, operationId: string, paymentId: string, invoiceId: string, pence: string) {
  return (await client.query<{ id: string }>('INSERT INTO payment_allocations(workspace_id,operation_id,bank_transaction_id,invoice_id,amount_pence) VALUES ($1,$2,$3,$4,$5) RETURNING id', [workspaceId, operationId, paymentId, invoiceId, pence])).rows[0]!.id;
}
export async function confirmSuggestion(client: pg.PoolClient, workspaceId: string, id: string) {
  await client.query("UPDATE match_suggestions SET review_status='confirmed' WHERE workspace_id=$1 AND id=$2", [workspaceId, id]);
}
export async function finishOperation(client: pg.PoolClient, workspaceId: string, userId: string, result: AllocationResult, details: object) {
  await client.query('UPDATE financial_operations SET result=$1::jsonb WHERE workspace_id=$2 AND id=$3', [JSON.stringify(result), workspaceId, result.operationId]);
  await client.query("INSERT INTO audit_events(workspace_id,actor_user_id,operation_id,event_type,details) VALUES ($1,$2,$3,'payment_allocated',$4::jsonb)", [workspaceId, userId, result.operationId, JSON.stringify(details)]);
}
