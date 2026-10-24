import { beforeAll, afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { runner } from 'node-pg-migrate';
import request from 'supertest';
import type pg from 'pg';
import { createPool, checkDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { findSession } from '../src/auth/repository.js';
const schema = `reversal_${randomUUID().replaceAll('-', '')}`;
let pool: pg.Pool; let admin: pg.Pool; let app: ReturnType<typeof createApp>; let token: string; let otherToken: string; let workspace: string; let bank: string;
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw Error('TEST_DATABASE_URL required');
  admin = createPool(process.env.TEST_DATABASE_URL); await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('options', `-c search_path=${schema} -c application_name=${schema}`);
  pool = createPool(url.toString()); const client = await pool.connect();
  try { await runner({ dbClient: client, lockValue: Number.parseInt(schema.slice(-12), 16), schema, migrationsSchema: schema, migrationsTable: 'pgmigrations', dir: resolve('migrations'), direction: 'up', log: () => {} }); } finally { client.release(); }
  app = createApp(readConfig({ DATABASE_URL: url.toString(), CORS_ORIGINS: 'https://frontend.example' }), () => checkDatabase(pool), pool);
  const register = () => request(app).post('/auth/register').send({ email: `${randomUUID()}@example.test`, password: 'Synthetic reversal passphrase!', workspaceName: 'Reversal studio' });
  const owner = await register(); expect(owner.status).toBe(201); token = owner.body.token; workspace = owner.body.workspace.id;
  otherToken = (await register()).body.token;
  bank = (await pool.query('INSERT INTO bank_accounts(workspace_id,name) VALUES ($1,$2) RETURNING id', [workspace, 'Reversal bank'])).rows[0].id;
}, 25000);
afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); } });
async function invoice(amount = '10000') { return (await pool.query("INSERT INTO invoices(workspace_id,invoice_number,customer_name,issue_date,due_date,total_pence) VALUES ($1,$2,'Synthetic customer','2026-10-01','2026-10-31',$3) RETURNING id", [workspace, randomUUID(), amount])).rows[0].id as string; }
async function payment(amount = '10000') { return (await pool.query("INSERT INTO bank_transactions(workspace_id,bank_account_id,transaction_date,description,amount_pence) VALUES ($1,$2,'2026-10-10','Reversal transfer',$3) RETURNING id", [workspace, bank, amount])).rows[0].id as string; }
function post(path: string, body: object, auth = token) { return request(app).post(path).set('Authorization', `Bearer ${auth}`).send(body); }
function get(path: string, auth = token) { return request(app).get(path).set('Authorization', `Bearer ${auth}`); }
function reversal(allocationId: string) { return { operationKey: randomUUID(), allocationId, confirmed: true, reason: 'Wrong invoice selected' }; }
function allocation(paymentId: string, invoiceId: string, amountPence = '10000') { return { operationKey: randomUUID(), paymentId, confirmed: true, allocations: [{ invoiceId, amountPence }] }; }
async function allocated(amount = '10000') {
  const i = await invoice(amount); const p = await payment(amount); const response = await post('/allocations', allocation(p, i, amount)); expect(response.status).toBe(200);
  return { i, p, a: response.body.allocations[0].id as string, operation: response.body.operationId as string };
}
async function counts() { return (await pool.query('SELECT (SELECT count(*)::int FROM payment_allocations) AS allocations,(SELECT count(*)::int FROM allocation_reversals) AS reversals,(SELECT count(*)::int FROM financial_operations) AS operations,(SELECT count(*)::int FROM audit_events) AS audits')).rows[0]; }
it('restores balances atomically with an owned audit and preserves original allocation and audit records', async () => {
  const { i, p, a, operation } = await allocated(); const before = await counts();
  const original = (await pool.query('SELECT to_jsonb(a) AS record FROM payment_allocations a WHERE id=$1', [a])).rows[0].record;
  const audit = (await pool.query('SELECT to_jsonb(e) AS record FROM audit_events e WHERE operation_id=$1', [operation])).rows[0].record;
  const response = await post('/reversals', reversal(a)); expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ allocationId: a, invoiceId: i, paymentId: p, restoredPence: '10000', paymentUnallocatedPence: '10000', invoiceOutstandingPence: '10000', reason: 'Wrong invoice selected' });
  expect(await counts()).toEqual({ ...before, reversals: before.reversals + 1, operations: before.operations + 1, audits: before.audits + 1 });
  expect((await pool.query('SELECT to_jsonb(a) AS record FROM payment_allocations a WHERE id=$1', [a])).rows[0].record).toEqual(original);
  expect((await pool.query('SELECT to_jsonb(e) AS record FROM audit_events e WHERE operation_id=$1', [operation])).rows[0].record).toEqual(audit);
  const principal = (await findSession(pool, token))!; const event = (await get(`/activity/${response.body.operationId}`)).body;
  expect(event.event).toMatchObject({ actorEmail: principal.email, eventType: 'allocation_reversed', amountPence: '10000' });
  expect(event.event.details).toMatchObject({ reason: 'Wrong invoice selected', originalOperationId: operation });
  expect(event.payment.unallocated_pence).toBe('10000'); expect(event.allocations[0].invoice.outstanding_pence).toBe('10000'); expect(event.timeline.map((e: { eventType: string }) => e.eventType)).toEqual(['payment_allocated', 'allocation_reversed']);
});
it('returns the exact saved outcome on retry, conflicts on changed reasons/kinds and rejects second reversal keys', async () => {
  const { a, operation } = await allocated(); const body = reversal(a); const first = await post('/reversals', body); const before = await counts();
  expect((await post('/reversals', body)).body).toEqual(first.body);
  expect((await post('/reversals', { ...body, reason: 'Changed reason' })).status).toBe(409);
  expect((await post('/reversals', reversal(a))).body.error.code).toBe('ALREADY_REVERSED');
  const originalKey = (await pool.query('SELECT operation_key FROM financial_operations WHERE id=$1', [operation])).rows[0].operation_key;
  expect((await post('/reversals', { ...body, operationKey: originalKey })).status).toBe(409); expect(await counts()).toEqual(before);
});
it('requires reason and explicit confirmation, rejects malformed IDs and untrusted financial/ownership fields', async () => {
  const { a } = await allocated(); const before = await counts();
  for (const patch of [{ reason: '' }, { reason: '   ' }, { reason: 'x'.repeat(1001) }, { reason: 'bad\0reason' }, { confirmed: false }, { confirmed: undefined }, { amountPence: '1' }, { workspaceId: randomUUID() }]) expect((await post('/reversals', { ...reversal(a), ...patch })).status).toBe(400);
  expect((await post('/reversals', reversal('invalid'))).status).toBe(400); expect((await post('/reversals', reversal(randomUUID()))).status).toBe(404); expect(await counts()).toEqual(before);
});
it('isolates reversal preview, mutation, event history and timeline from other workspaces', async () => {
  const { a, operation } = await allocated(); const before = await counts();
  expect((await get(`/activity/${operation}`, otherToken)).status).toBe(404); expect((await get(`/reversals/allocations/${a}`, otherToken)).status).toBe(404);
  expect((await post('/reversals', reversal(a), otherToken)).status).toBe(404); expect((await get('/activity', otherToken)).body.events).toEqual([]);
  expect((await request(app).post('/reversals').send(reversal(a))).status).toBe(401); expect((await request(app).get('/activity')).status).toBe(401);
  expect((await get('/activity/invalid')).status).toBe(404); expect((await get('/activity?page=0')).status).toBe(400); expect((await get('/reversals/allocations/invalid')).status).toBe(404);
  expect(await counts()).toEqual(before);
});
it('reverses one split allocation only and permits fresh reallocation without reviving old suggestions', async () => {
  const i = await invoice('6000'); const j = await invoice('4000'); const p = await payment();
  await pool.query('UPDATE bank_transactions SET payment_reference=(SELECT invoice_number FROM invoices WHERE id=$1) WHERE id=$2', [i, p]);
  const generated = await post(`/matching/payments/${p}`, {}); expect(generated.status).toBe(200);
  const body = { ...allocation(p, i, '6000'), allocations: [{ invoiceId: i, amountPence: '6000' }, { invoiceId: j, amountPence: '4000' }] };
  const original = await post('/allocations', body); expect(original.status).toBe(200);
  const target = original.body.allocations.find((row: { invoiceId: string }) => row.invoiceId === i).id;
  const correction = reversal(target); const reversed = await post('/reversals', correction); expect(reversed.status).toBe(200);
  const detail = (await get(`/activity/${original.body.operationId}`)).body;
  expect(detail.allocations.find((row: { invoice_id: string }) => row.invoice_id === j).reversal_id).toBeNull();
  expect(detail.payment.unallocated_pence).toBe('6000');
  expect((await get(`/matching/payments/${p}`)).body.state).toBe('stale');
  const reallocated = await post('/allocations', allocation(p, i, '6000')); expect(reallocated.status).toBe(200); expect(reallocated.body.remainingPence).toBe('0');
  expect((await post('/reversals', correction)).body).toEqual(reversed.body);
  expect((await get(`/reversals/allocations/${target}`)).body.payment.unallocated_pence).toBe('0');
});
it('rolls reversal, operation and audit back on final audit failure and can safely retry', async () => {
  const { a, p } = await allocated(); const before = await counts(); const body = reversal(a);
  await pool.query("CREATE FUNCTION fail_reversal_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='allocation_reversed' THEN RAISE EXCEPTION 'synthetic private failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_reversal_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_reversal_audit()");
  try {
    const failed = await post('/reversals', body); expect(failed.status).toBe(500); expect(failed.text).not.toContain('private failure'); expect(await counts()).toEqual(before);
    expect((await get(`/allocations/payments/${p}`)).body.payment.unallocated_pence).toBe('0'); expect((await get(`/reversals/allocations/${a}`)).body.allocation.reversal_id).toBeNull();
  } finally { await pool.query('DROP TRIGGER fail_reversal_audit ON audit_events; DROP FUNCTION fail_reversal_audit()'); }
  expect((await post('/reversals', body)).status).toBe(200);
});
async function overlap(table: 'bank_transactions' | 'invoices', id: string, calls: { path: string; body: object }[]) {
  const blocker = await pool.connect(); let pending: Promise<request.Response>[] = [];
  try {
    await blocker.query('BEGIN'); await blocker.query(`SELECT id FROM ${table} WHERE id=$1 FOR UPDATE`, [id]);
    pending = calls.map(call => post(call.path, call.body).then(response => response));
    let waiting = 0; const deadline = Date.now() + 1400;
    while (Date.now() < deadline) {
      waiting = (await admin.query("SELECT count(DISTINCT pid)::int AS count FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [schema])).rows[0].count;
      if (waiting >= 2) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(waiting).toBeGreaterThanOrEqual(2);
  } finally { await blocker.query('ROLLBACK'); blocker.release(); }
  return await Promise.all(pending);
}
it('allows exactly one concurrent reversal with different identifiers and one audit', async () => {
  const { a, p } = await allocated(); const before = await counts();
  const responses = await overlap('bank_transactions', p, [{ path: '/reversals', body: reversal(a) }, { path: '/reversals', body: reversal(a) }]);
  expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
  expect(await counts()).toEqual({ ...before, reversals: before.reversals + 1, operations: before.operations + 1, audits: before.audits + 1 });
  expect((await get(`/allocations/payments/${p}`)).body.payment.unallocated_pence).toBe('10000');
});
it('serializes concurrent identical retries and returns the same reversal result', async () => {
  const { a, p } = await allocated(); const before = await counts(); const body = reversal(a);
  const responses = await overlap('bank_transactions', p, [{ path: '/reversals', body }, { path: '/reversals', body }]);
  expect(responses.map(r => r.status)).toEqual([200, 200]); expect(responses[0]!.body).toEqual(responses[1]!.body);
  expect(await counts()).toEqual({ ...before, reversals: before.reversals + 1, operations: before.operations + 1, audits: before.audits + 1 });
});
it('keeps balances correct when a reversal overlaps a new allocation on the same payment', async () => {
  const { a, p } = await allocated(); const i = await invoice();
  const responses = await overlap('bank_transactions', p, [{ path: '/reversals', body: reversal(a) }, { path: '/allocations', body: allocation(p, i) }]);
  expect(responses[0]!.status).toBe(200); expect([200, 409]).toContain(responses[1]!.status);
  const expected = responses[1]!.status === 200 ? '0' : '10000'; expect((await get(`/allocations/payments/${p}`)).body.payment.unallocated_pence).toBe(expected);
  const active = (await pool.query('SELECT sum(a.amount_pence)::text AS total FROM payment_allocations a WHERE a.bank_transaction_id=$1 AND NOT EXISTS(SELECT 1 FROM allocation_reversals r WHERE r.allocation_id=a.id)', [p])).rows[0].total;
  expect(active ?? '0').toBe(responses[1]!.status === 200 ? '10000' : '0');
});
it('serializes reversals from distinct payments sharing an invoice without lost restoration', async () => {
  const i = await invoice('20000'); const p = await payment(); const q = await payment();
  const first = await post('/allocations', allocation(p, i)); const second = await post('/allocations', allocation(q, i));
  const responses = await overlap('invoices', i, [{ path: '/reversals', body: reversal(first.body.allocations[0].id) }, { path: '/reversals', body: reversal(second.body.allocations[0].id) }]);
  expect(responses.map(r => r.status)).toEqual([200, 200]);
  expect((await get(`/reversals/allocations/${first.body.allocations[0].id}`)).body.invoice.outstanding_pence).toBe('20000');
});
it('preserves exact BIGINT restoration and deterministic paginated financial history', async () => {
  const { a } = await allocated('9223372036854775807'); const response = await post('/reversals', reversal(a));
  expect(response.status).toBe(200); expect(response.body.restoredPence).toBe('9223372036854775807'); expect(response.body.paymentUnallocatedPence).toBe('9223372036854775807');
  // Ensure the page boundary with real audited operations, independent of racing outcomes.
  for (let n = 0; n < 3; n++) await allocated('1');
  const first = await get('/activity?page=1'); const second = await get('/activity?page=2'); expect(first.status).toBe(200); expect(first.body.events).toHaveLength(25); expect(first.body.hasMore).toBe(true);
  expect(second.body.events.length).toBeGreaterThan(0); const ids = [...first.body.events, ...second.body.events].map((row: { id: string }) => row.id); expect(new Set(ids).size).toBe(ids.length);
  expect((await get('/activity?page=1')).body).toEqual(first.body);
});
