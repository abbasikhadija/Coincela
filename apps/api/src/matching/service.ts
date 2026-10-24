import type pg from 'pg';
import { matchPayment } from './engine.js';
import { paymentSelect, readSnapshot, readRun, readWorkspaceEvidence, snapshotHash } from './repository.js';
import type { Payment } from './engine.js';
import { HttpError } from '../errors.js';
export class MatchingService {
  constructor(private pool: pg.Pool) {}
  async list(workspaceId: string, page: number) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const result = await client.query<Payment>(`${paymentSelect} WHERE t.workspace_id=$1 ORDER BY t.created_at DESC,t.id DESC LIMIT 26 OFFSET $2`, [workspaceId, (page - 1) * 25]);
      const evidence = await readWorkspaceEvidence(client, workspaceId);
      const payments = result.rows.slice(0, 25);
      const runs = (await client.query<{ bank_transaction_id: string; snapshot_hash: string; outcome: string; candidate_count: number; pending_count: number }>(`SELECT r.bank_transaction_id,r.snapshot_hash,r.outcome,
        (SELECT count(*)::int FROM match_suggestions s WHERE s.workspace_id=r.workspace_id AND s.run_id=r.id) AS candidate_count,
        (SELECT count(*)::int FROM match_suggestions s WHERE s.workspace_id=r.workspace_id AND s.run_id=r.id AND s.review_status='pending') AS pending_count
        FROM matching_runs r WHERE r.workspace_id=$1 AND r.bank_transaction_id=ANY($2::uuid[])`, [workspaceId, payments.map(payment => payment.id)])).rows;
      const records = payments.map(payment => {
        const hash = snapshotHash(payment, evidence);
        const run = runs.find(run => run.bank_transaction_id === payment.id && run.snapshot_hash === hash);
        return { ...payment, reviewState: run ? run.candidate_count > 0 && run.pending_count === 0 ? 'rejected' : run.outcome : runs.some(run => run.bank_transaction_id === payment.id) ? 'stale' : 'not_generated' };
      });
      await client.query('COMMIT');
      return { payments: records, hasMore: result.rows.length > 25, page };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async detail(workspaceId: string, paymentId: string, generate = false) {
    for (let attempt = 0; ; attempt++) {
      try { return await this.detailOnce(workspaceId, paymentId, generate); }
      catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
        if (!generate || attempt >= 2 || !['40001', '23505'].includes(String(code))) throw error;
        // A waiting repeatable-read transaction may have an older snapshot.
        // Retry in a fresh transaction; unique run/suggestion keys prevent duplicates.
      }
    }
  }
  private async detailOnce(workspaceId: string, paymentId: string, generate: boolean) {
    const client = await this.pool.connect();
    try {
      await client.query(generate ? 'BEGIN ISOLATION LEVEL REPEATABLE READ' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      if (generate) await client.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [workspaceId]);
      const snapshot = await readSnapshot(client, workspaceId, paymentId);
      let run = await readRun(client, workspaceId, paymentId, snapshot.hash);
      if (generate && !run) {
        const result = matchPayment(snapshot.payment, snapshot.invoices);
        const inserted = (await client.query('INSERT INTO matching_runs(workspace_id,bank_transaction_id,snapshot_hash,outcome,explanation,warnings) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id', [workspaceId, paymentId, snapshot.hash, result.outcome, result.explanation, JSON.stringify(result.warnings)])).rows[0];
        for (const [position, candidate] of result.candidates.entries()) await client.query('INSERT INTO match_suggestions(workspace_id,bank_transaction_id,invoice_id,suggested_pence,category,evidence,warnings,explanation,run_id,position) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10)', [workspaceId, paymentId, candidate.invoice.id, candidate.suggestedPence, candidate.category, JSON.stringify(candidate.evidence), JSON.stringify(candidate.warnings), candidate.explanation, inserted.id, position]);
        run = await readRun(client, workspaceId, paymentId, snapshot.hash);
      }
      const prior = !run && !!(await client.query('SELECT id FROM matching_runs WHERE workspace_id=$1 AND bank_transaction_id=$2 LIMIT 1', [workspaceId, paymentId])).rowCount;
      const candidates = run?.candidates.map(candidate => ({ ...candidate, invoice: snapshot.invoices.find(invoice => invoice.id === candidate.invoice_id) })) ?? [];
      await client.query('COMMIT');
      return { payment: snapshot.payment, state: run ? 'current' : prior ? 'stale' : 'not_generated',
        result: run ? { id: run.id, outcome: run.outcome, explanation: run.explanation, warnings: run.warnings, createdAt: run.created_at, candidates } : null };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async reject(workspaceId: string, suggestionId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      await client.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [workspaceId]);
      const suggestion = (await client.query('SELECT s.id,s.bank_transaction_id,s.review_status,r.snapshot_hash FROM match_suggestions s JOIN matching_runs r ON r.workspace_id=s.workspace_id AND r.id=s.run_id WHERE s.workspace_id=$1 AND s.id=$2', [workspaceId, suggestionId])).rows[0];
      if (!suggestion) throw new HttpError(404, 'SUGGESTION_NOT_FOUND', 'Suggestion not found.');
      const snapshot = await readSnapshot(client, workspaceId, suggestion.bank_transaction_id);
      if (snapshot.hash !== suggestion.snapshot_hash) throw new HttpError(409, 'STALE_SUGGESTION', 'Financial records have changed. Regenerate suggestions before reviewing.');
      if (!['pending', 'rejected'].includes(suggestion.review_status)) throw new HttpError(409, 'REVIEW_UNAVAILABLE', 'This suggestion can no longer be rejected. Refresh your payment.');
      await client.query("UPDATE match_suggestions SET review_status='rejected' WHERE workspace_id=$1 AND id=$2", [workspaceId, suggestionId]);
      await client.query('COMMIT');
      return { reviewStatus: 'rejected' };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
