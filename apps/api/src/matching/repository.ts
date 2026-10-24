import type pg from 'pg';
import { createHash } from 'node:crypto';
import { ENGINE_VERSION, type Category, type Invoice, type Payment } from './engine.js';
import { HttpError } from '../errors.js';
export const paymentSelect = `SELECT t.id,t.transaction_date::text,t.description,t.amount_pence::text,t.currency,t.payment_reference,t.payer_name,t.requires_duplicate_review,
  (t.amount_pence-COALESCE((SELECT sum(a.amount_pence) FROM payment_allocations a WHERE a.workspace_id=t.workspace_id AND a.bank_transaction_id=t.id AND NOT EXISTS (SELECT 1 FROM allocation_reversals r WHERE r.workspace_id=a.workspace_id AND r.allocation_id=a.id)),0))::text AS unallocated_pence FROM bank_transactions t`;
export async function readSnapshot(client: pg.PoolClient, workspaceId: string, paymentId: string) {
  const payment = (await client.query<Payment>(`${paymentSelect} WHERE t.workspace_id=$1 AND t.id=$2`, [workspaceId, paymentId])).rows[0];
  if (!payment) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Payment not found.');
  const evidence = await readWorkspaceEvidence(client, workspaceId);
  return { payment, invoices: evidence.invoices, hash: snapshotHash(payment, evidence) };
}
export async function readWorkspaceEvidence(client: pg.PoolClient, workspaceId: string) {
  const invoices = (await client.query<Invoice>(`SELECT i.id,i.invoice_number,i.customer_name,i.issue_date::text,i.due_date::text,i.total_pence::text,i.currency,
    (i.total_pence-COALESCE((SELECT sum(a.amount_pence) FROM payment_allocations a WHERE a.workspace_id=i.workspace_id AND a.invoice_id=i.id AND NOT EXISTS (SELECT 1 FROM allocation_reversals r WHERE r.workspace_id=a.workspace_id AND r.allocation_id=a.id)),0))::text AS outstanding_pence
    FROM invoices i WHERE i.workspace_id=$1 ORDER BY i.id`, [workspaceId])).rows;
  // Include ledger identities, not just totals: a reversal/reallocation must not revive an old snapshot.
  const ledger = (await client.query(`SELECT a.id,a.bank_transaction_id,a.invoice_id,a.amount_pence::text,r.id AS reversal_id FROM payment_allocations a LEFT JOIN allocation_reversals r ON r.workspace_id=a.workspace_id AND r.allocation_id=a.id WHERE a.workspace_id=$1 ORDER BY a.id`, [workspaceId])).rows;
  return { invoices, ledger };
}
export function snapshotHash(payment: Payment, evidence: Awaited<ReturnType<typeof readWorkspaceEvidence>>) {
  return createHash('sha256').update(JSON.stringify({ version: ENGINE_VERSION, payment, invoices: evidence.invoices, ledger: evidence.ledger })).digest('hex');
}
export async function readRun(client: pg.PoolClient, workspaceId: string, paymentId: string, hash: string) {
  const run = (await client.query<{ id: string; outcome: Category; explanation: string; warnings: string[]; created_at: Date }>('SELECT id,outcome,explanation,warnings,created_at FROM matching_runs WHERE workspace_id=$1 AND bank_transaction_id=$2 AND snapshot_hash=$3', [workspaceId, paymentId, hash])).rows[0];
  if (!run) return null;
  const candidates = (await client.query<{ id: string; invoice_id: string; suggestedPence: string; category: Category; evidence: string[]; warnings: string[]; explanation: string; reviewStatus: string }>('SELECT id,invoice_id,suggested_pence::text AS "suggestedPence",category,evidence,warnings,explanation,review_status AS "reviewStatus" FROM match_suggestions WHERE workspace_id=$1 AND run_id=$2 ORDER BY position,id', [workspaceId, run.id])).rows;
  return { ...run, candidates };
}
