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
const schema = `allocation_${randomUUID().replaceAll('-', '')}`;
let pool: pg.Pool; let admin: pg.Pool; let app: ReturnType<typeof createApp>;
let token: string; let foreignToken: string; let workspace: string; let bank: string;
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw Error('TEST_DATABASE_URL required');
  admin = createPool(process.env.TEST_DATABASE_URL); await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('options', `-c search_path=${schema} -c application_name=${schema}`);
  pool = createPool(url.toString()); const client = await pool.connect();
  try { await runner({ dbClient: client, lockValue: Number.parseInt(schema.slice(-12), 16), schema, migrationsSchema: schema, migrationsTable: 'pgmigrations', dir: resolve('migrations'), direction: 'up', log: () => {} }); } finally { client.release(); }
  app = createApp(readConfig({ DATABASE_URL: url.toString(), CORS_ORIGINS: 'https://frontend.example' }), () => checkDatabase(pool), pool);
  const register = () => request(app).post('/auth/register').send({ email: `${randomUUID()}@example.test`, password: 'Synthetic allocation passphrase!', workspaceName: 'Allocation studio' });
  const owner = await register(); expect(owner.status).toBe(201); token = owner.body.token; workspace = owner.body.workspace.id;
  foreignToken = (await register()).body.token;
  bank = (await pool.query('INSERT INTO bank_accounts(workspace_id,name) VALUES ($1,$2) RETURNING id', [workspace, 'Allocation bank'])).rows[0].id;
}, 25000);
afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); } });
async function invoice(amount = '10000') { return (await pool.query("INSERT INTO invoices(workspace_id,invoice_number,customer_name,issue_date,due_date,total_pence) VALUES ($1,$2,'Test customer','2026-10-01','2026-10-31',$3) RETURNING id", [workspace, randomUUID(), amount])).rows[0].id as string; }
async function payment(amount = '10000') { return (await pool.query("INSERT INTO bank_transactions(workspace_id,bank_account_id,transaction_date,description,amount_pence) VALUES ($1,$2,'2026-10-10','Test payment',$3) RETURNING id", [workspace, bank, amount])).rows[0].id as string; }
function input(paymentId: string, allocations: { invoiceId: string; amountPence: string; suggestionId?: string }[]) { return { operationKey: randomUUID(), paymentId, confirmed: true, allocations }; }
function post(body: object, auth = token) { return request(app).post('/allocations').set('Authorization', `Bearer ${auth}`).send(body); }
function get(path: string, auth = token) { return request(app).get(path).set('Authorization', `Bearer ${auth}`); }
async function balance(invoiceId: string) {
  return (await pool.query('SELECT (i.total_pence-COALESCE(sum(a.amount_pence) FILTER (WHERE r.id IS NULL),0))::text AS balance FROM invoices i LEFT JOIN payment_allocations a ON a.invoice_id=i.id LEFT JOIN allocation_reversals r ON r.allocation_id=a.id WHERE i.id=$1 GROUP BY i.id', [invoiceId])).rows[0].balance;
}
async function counts() { return (await pool.query('SELECT (SELECT count(*)::int FROM payment_allocations) AS allocations,(SELECT count(*)::int FROM financial_operations) AS operations,(SELECT count(*)::int FROM audit_events) AS audits')).rows[0]; }
it('commits a full allocation with actor, audit, exact result and derived balances', async () => {
  const i = await invoice(); const p = await payment(); const before = await counts();
  const response = await post(input(p, [{ invoiceId: i, amountPence: '10000' }]));
  expect(response.status).toBe(200); expect(response.body).toMatchObject({ allocatedPence: '10000', remainingPence: '0', allocations: [{ invoiceId: i, remainingPence: '0' }] });
  expect(await balance(i)).toBe('0'); expect(await counts()).toEqual({ allocations: before.allocations + 1, operations: before.operations + 1, audits: before.audits + 1 });
  const principal = (await findSession(pool, token))!;
  const audit = (await pool.query('SELECT actor_user_id,event_type,details FROM audit_events WHERE operation_id=$1', [response.body.operationId])).rows[0];
  expect(audit.actor_user_id).toBe(principal.userId); expect(audit.event_type).toBe('payment_allocated'); expect(audit.details.allocatedPence).toBe('10000');
  expect((await get(`/allocations/payments/${p}`)).body.payment.unallocated_pence).toBe('0');
});
it('supports partial payments, several payments per invoice and exact remaining balances', async () => {
  const i = await invoice('15000'); const p = await payment('10000');
  expect((await post(input(p, [{ invoiceId: i, amountPence: '4000' }]))).body).toMatchObject({ remainingPence: '6000', allocations: [{ remainingPence: '11000' }] });
  expect((await post(input(await payment('11000'), [{ invoiceId: i, amountPence: '11000' }]))).status).toBe(200);
  expect(await balance(i)).toBe('0');
  expect((await post(input(p, [{ invoiceId: i, amountPence: '1' }]))).status).toBe(409);
});
it('splits one payment atomically and retains excess', async () => {
  const a = await invoice('3000'); const b = await invoice('6000'); const p = await payment('10000');
  const response = await post(input(p, [{ invoiceId: b, amountPence: '6000' }, { invoiceId: a, amountPence: '3000' }]));
  expect(response.status).toBe(200); expect(response.body.remainingPence).toBe('1000'); expect(await balance(a)).toBe('0'); expect(await balance(b)).toBe('0');
});
it('rejects payment and invoice over-allocation with no partial effects', async () => {
  const i = await invoice('5000'); const p = await payment('6000'); const before = await counts();
  expect((await post(input(p, [{ invoiceId: i, amountPence: '5001' }]))).status).toBe(409);
  expect((await post(input(p, [{ invoiceId: await invoice(), amountPence: '6001' }]))).status).toBe(409);
  expect(await counts()).toEqual(before); expect(await balance(i)).toBe('5000');
});
it('rejects negative, zero, numeric, overflowing and duplicate rows or missing confirmation', async () => {
  const i = await invoice(); const p = await payment(); const before = await counts();
  for (const amountPence of ['0', '-1', 1, '1.5', '9223372036854775808']) expect((await post(input(p, [{ invoiceId: i, amountPence: amountPence as string }]))).status).toBe(400);
  expect((await post({ ...input(p, [{ invoiceId: i, amountPence: '1' }]), confirmed: false })).status).toBe(400);
  expect((await post(input(p, [{ invoiceId: i, amountPence: '1' }, { invoiceId: i, amountPence: '1' }]))).status).toBe(400);
  expect(await counts()).toEqual(before);
});
it('retries identical/reordered requests without duplicating effects, rejects conflicting keys', async () => {
  const a = await invoice(); const b = await invoice(); const body = input(await payment('20000'), [{ invoiceId: a, amountPence: '10000' }, { invoiceId: b, amountPence: '10000' }]);
  const first = await post(body); const before = await counts(); const retry = await post({ ...body, allocations: [...body.allocations].reverse() });
  expect(retry.status).toBe(200); expect(retry.body).toEqual(first.body); expect(await counts()).toEqual(before);
  expect((await post({ ...body, paymentId: await payment() })).status).toBe(409);
  expect((await post({ ...body, allocations: [{ invoiceId: a, amountPence: '1' }] })).status).toBe(409);
});
it('scopes all allocation resources and mutations to the authenticated workspace', async () => {
  const i = await invoice(); const p = await payment(); const before = await counts();
  expect((await get(`/allocations/payments/${p}`, foreignToken)).status).toBe(404);
  expect((await post(input(p, [{ invoiceId: i, amountPence: '1' }]), foreignToken)).status).toBe(404);
  const otherWorkspace = (await findSession(pool, foreignToken))!.workspaceId;
  const foreignInvoice = (await pool.query("INSERT INTO invoices(workspace_id,invoice_number,customer_name,issue_date,due_date,total_pence) VALUES ($1,'FOREIGN','Foreign','2026-10-01','2026-10-31',10000) RETURNING id", [otherWorkspace])).rows[0].id;
  expect((await post(input(p, [{ invoiceId: foreignInvoice, amountPence: '1' }]))).status).toBe(404);
  expect((await request(app).post('/allocations').send(input(p, [{ invoiceId: i, amountPence: '1' }]))).status).toBe(401);
  expect((await post(input(p, [{ invoiceId: randomUUID(), amountPence: '1' }]))).status).toBe(404); expect(await counts()).toEqual(before);
  expect((await get(`/allocations/payments/${p}?search=FOREIGN`)).body.invoices).toEqual([]);
});
it('confirms current suggestions only after explicit allocation review and keeps retry results', async () => {
  const i = await invoice(); const p = await payment();
  await pool.query('UPDATE bank_transactions SET payment_reference=(SELECT invoice_number FROM invoices WHERE id=$1) WHERE id=$2', [i, p]);
  const generated = await request(app).post(`/matching/payments/${p}`).set('Authorization', `Bearer ${token}`);
  const suggestion = generated.body.result.candidates[0].id;
  const body = input(p, [{ invoiceId: i, amountPence: '5000', suggestionId: suggestion }]);
  const response = await post(body); expect(response.status).toBe(200);
  expect((await pool.query('SELECT review_status FROM match_suggestions WHERE id=$1', [suggestion])).rows[0].review_status).toBe('confirmed');
  expect((await post(body)).body).toEqual(response.body);
  expect((await get(`/matching/payments/${p}`)).body.state).toBe('stale');
});
it('rejects stale, rejected and unrelated suggestion confirmation without money changes', async () => {
  const i = await invoice(); const p = await payment();
  await pool.query('UPDATE bank_transactions SET payment_reference=(SELECT invoice_number FROM invoices WHERE id=$1) WHERE id=$2', [i, p]);
  const generate = async () => (await request(app).post(`/matching/payments/${p}`).set('Authorization', `Bearer ${token}`)).body.result.candidates[0].id as string;
  const suggestion = await generate(); await invoice(); const before = await counts();
  expect((await post(input(p, [{ invoiceId: i, amountPence: '1', suggestionId: suggestion }]))).status).toBe(409);
  const fresh = await generate(); await request(app).post(`/matching/suggestions/${fresh}/reject`).set('Authorization', `Bearer ${token}`);
  expect((await post(input(p, [{ invoiceId: i, amountPence: '1', suggestionId: fresh }]))).status).toBe(409);
  expect((await post(input(p, [{ invoiceId: i, amountPence: '1', suggestionId: randomUUID() }]))).status).toBe(404); expect(await counts()).toEqual(before);
});
it('rolls back split allocations, operation, suggestion status and audit when audit insertion fails', async () => {
  const a = await invoice(); const b = await invoice(); const p = await payment('20000'); const before = await counts();
  await pool.query('UPDATE bank_transactions SET payment_reference=(SELECT invoice_number FROM invoices WHERE id=$1) WHERE id=$2', [a, p]);
  const generated = await request(app).post(`/matching/payments/${p}`).set('Authorization', `Bearer ${token}`); const suggestion = generated.body.result.candidates[0].id;
  await pool.query("CREATE FUNCTION fail_allocation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic secret failure'; END $$; CREATE TRIGGER fail_allocation_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_allocation_audit()");
  const body = input(p, [{ invoiceId: a, amountPence: '10000', suggestionId: suggestion }, { invoiceId: b, amountPence: '10000' }]);
  try {
    const response = await post(body); expect(response.status).toBe(500); expect(response.text).not.toContain('synthetic secret'); expect(await counts()).toEqual(before);
    expect(await balance(a)).toBe('10000'); expect(await balance(b)).toBe('10000');
    expect((await pool.query('SELECT review_status FROM match_suggestions WHERE id=$1', [suggestion])).rows[0].review_status).toBe('pending');
  } finally { await pool.query('DROP TRIGGER fail_allocation_audit ON audit_events; DROP FUNCTION fail_allocation_audit()'); }
  expect((await post(body)).status).toBe(200);
});
// Hold a real financial row so both HTTP requests enter transactions on distinct
// PostgreSQL backends and demonstrably overlap before releasing the blocker.
async function concurrent(block: string, id: string, bodies: ReturnType<typeof input>[]) {
  const blocker = await pool.connect(); let calls: Promise<request.Response>[] = [];
  try {
    await blocker.query('BEGIN'); await blocker.query(`SELECT id FROM ${block} WHERE id=$1 FOR UPDATE`, [id]);
    calls = bodies.map(body => post(body).then(response => response));
    const deadline = Date.now() + 1400; let waiting = 0;
    while (Date.now() < deadline) {
      waiting = (await admin.query("SELECT count(DISTINCT pid)::int AS count FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [schema])).rows[0].count;
      if (waiting >= 2) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(waiting).toBeGreaterThanOrEqual(2);
  } finally { await blocker.query('ROLLBACK'); blocker.release(); }
  return await Promise.all(calls);
}
it('protects one invoice under genuinely overlapping payments on distinct connections', async () => {
  const i = await invoice(); const before = await counts();
  const responses = await concurrent('invoices', i, [input(await payment(), [{ invoiceId: i, amountPence: '10000' }]), input(await payment(), [{ invoiceId: i, amountPence: '10000' }])]);
  expect(responses.map(r => r.status).sort()).toEqual([200, 409]); expect(await balance(i)).toBe('0'); expect((await counts()).allocations).toBe(before.allocations + 1);
});
it('protects one payment against simultaneous allocations to different invoices', async () => {
  const p = await payment(); const a = await invoice(); const b = await invoice(); const before = await counts();
  const responses = await concurrent('bank_transactions', p, [input(p, [{ invoiceId: a, amountPence: '10000' }]), input(p, [{ invoiceId: b, amountPence: '10000' }])]);
  expect(responses.map(r => r.status).sort()).toEqual([200, 409]); expect((await get(`/allocations/payments/${p}`)).body.payment.unallocated_pence).toBe('0'); expect((await counts()).allocations).toBe(before.allocations + 1);
});
it('orders overlapping split invoice locks and rolls back the losing split entirely', async () => {
  const ids = [await invoice(), await invoice()].sort(); const before = await counts();
  const responses = await concurrent('invoices', ids[0]!, [input(await payment('20000'), ids.map(invoiceId => ({ invoiceId, amountPence: '10000' }))), input(await payment('20000'), [...ids].reverse().map(invoiceId => ({ invoiceId, amountPence: '10000' })))]);
  expect(responses.map(r => r.status).sort()).toEqual([200, 409]); expect(await balance(ids[0]!)).toBe('0'); expect(await balance(ids[1]!)).toBe('0'); expect((await counts()).allocations).toBe(before.allocations + 2);
});
it('serializes identical concurrent retries into a single operation and audit', async () => {
  const p = await payment(); const body = input(p, [{ invoiceId: await invoice(), amountPence: '10000' }]); const before = await counts();
  const responses = await concurrent('bank_transactions', p, [body, body]);
  expect(responses.map(r => r.status)).toEqual([200, 200]); expect(responses[0]!.body).toEqual(responses[1]!.body); expect(await counts()).toEqual({ allocations: before.allocations + 1, operations: before.operations + 1, audits: before.audits + 1 });
});
it('preserves exact PostgreSQL BIGINT amounts beyond Number safety', async () => {
  const value = '9223372036854775807'; const i = await invoice(value); const p = await payment(value);
  const response = await post(input(p, [{ invoiceId: i, amountPence: value }])); expect(response.status).toBe(200); expect(response.body.allocatedPence).toBe(value); expect(await balance(i)).toBe('0');
});
it('paginates and searches owned invoices with exact derived balances and validates queries', async () => {
  const prefix = `PAGED-${randomUUID()}`; const p = await payment();
  await pool.query("INSERT INTO invoices(workspace_id,invoice_number,customer_name,issue_date,due_date,total_pence) SELECT $1,$2 || n,'Paging customer','2026-10-01','2026-10-31',100 FROM generate_series(1,60) n", [workspace, prefix]);
  const first = await get(`/allocations/payments/${p}?search=${prefix}&page=1`); const second = await get(`/allocations/payments/${p}?search=${prefix}&page=2`);
  expect(first.status).toBe(200); expect(first.body.invoices).toHaveLength(50); expect(first.body.hasMore).toBe(true);
  expect(second.body.invoices).toHaveLength(10); expect(second.body.hasMore).toBe(false);
  expect(new Set([...first.body.invoices, ...second.body.invoices].map(row => row.id)).size).toBe(60);
  expect((await get(`/allocations/payments/${p}?search=${encodeURIComponent("' OR 1=1 --")}`)).body.invoices).toEqual([]);
  expect((await get(`/allocations/payments/${p}?page=0`)).status).toBe(400);
  expect((await get('/allocations/payments/invalid')).status).toBe(404);
  const i = first.body.invoices[0].id;
  expect((await post(input(p, [{ invoiceId: i, amountPence: '40' }]))).status).toBe(200);
  const current = await get(`/allocations/payments/${p}?search=${prefix}`);
  expect(current.body.payment.unallocated_pence).toBe('9960'); expect(current.body.invoices.find((row: { id: string }) => row.id === i).outstanding_pence).toBe('60');
  expect((await get('/invoices')).body.records.find((row: { id: string }) => row.id === i)?.outstanding_pence ?? (await get('/invoices?page=2')).body.records.find((row: { id: string }) => row.id === i)?.outstanding_pence).toBe('60');
});
