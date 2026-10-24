import { beforeAll, afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { runner } from 'node-pg-migrate';
import request from 'supertest';
import type pg from 'pg';
import { createPool, checkDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
const schema = `matching_${randomUUID().replaceAll('-', '')}`;
let pool: pg.Pool; let admin: pg.Pool; let app: ReturnType<typeof createApp>;
let token: string; let otherToken: string; let workspaceId: string; let bankId: string;
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw Error('TEST_DATABASE_URL required');
  admin = createPool(process.env.TEST_DATABASE_URL); await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('options', `-c search_path=${schema}`);
  pool = createPool(url.toString()); const client = await pool.connect();
  try { await runner({ dbClient: client, lockValue: Number.parseInt(schema.slice(-12), 16), schema, migrationsSchema: schema, migrationsTable: 'pgmigrations', dir: resolve('migrations'), direction: 'up', log: () => {} }); } finally { client.release(); }
  app = createApp(readConfig({ DATABASE_URL: url.toString(), CORS_ORIGINS: 'https://frontend.example' }), () => checkDatabase(pool), pool);
  const first = await request(app).post('/auth/register').send({ email: `${randomUUID()}@example.test`, password: 'Synthetic matching passphrase!', workspaceName: 'Matching studio' });
  expect(first.status).toBe(201); token = first.body.token; workspaceId = first.body.workspace.id;
  const other = await request(app).post('/auth/register').send({ email: `${randomUUID()}@example.test`, password: 'Synthetic matching passphrase!', workspaceName: 'Foreign studio' });
  otherToken = other.body.token;
  bankId = (await pool.query('INSERT INTO bank_accounts(workspace_id,name) VALUES ($1,$2) RETURNING id', [workspaceId, 'Test bank'])).rows[0].id;
  await invoice('INV-100', 'Amber Studio', '10000');
  await invoice('INV-101', 'Birch Consulting', '10000');
}, 25000);
afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); } });
async function invoice(number: string, name: string, amount: string) {
  return (await pool.query("INSERT INTO invoices(workspace_id,invoice_number,customer_name,issue_date,due_date,total_pence) VALUES ($1,$2,$3,'2026-10-01','2026-10-31',$4) RETURNING id", [workspaceId, number, name, amount])).rows[0].id as string;
}
async function payment(reference: string | null, amount = '10000', description = 'Matching payment') {
  return (await pool.query("INSERT INTO bank_transactions(workspace_id,bank_account_id,transaction_date,description,amount_pence,payment_reference) VALUES ($1,$2,'2026-10-10',$3,$4,$5) RETURNING id", [workspaceId, bankId, description, amount, reference])).rows[0].id as string;
}
function get(path: string, auth = token) { return request(app).get(path).set('Authorization', `Bearer ${auth}`); }
function post(path: string, auth = token) { return request(app).post(path).set('Authorization', `Bearer ${auth}`); }
async function financialState() {
  const result = await pool.query("SELECT (SELECT jsonb_agg(i ORDER BY id) FROM invoices i) AS invoices,(SELECT jsonb_agg(t ORDER BY id) FROM bank_transactions t) AS payments,(SELECT count(*) FROM payment_allocations)::text AS allocations,(SELECT count(*) FROM allocation_reversals)::text AS reversals,(SELECT count(*) FROM audit_events)::text AS audits");
  return result.rows[0];
}
it('generates exact, explained, pending suggestions without changing financial records', async () => {
  const id = await payment('INV-100'); const before = await financialState();
  expect((await get(`/matching/payments/${id}`)).body.state).toBe('not_generated');
  const response = await post(`/matching/payments/${id}`);
  expect(response.status).toBe(200); expect(response.body.state).toBe('current');
  expect(response.body.result.outcome).toBe('exact_reference');
  expect(response.body.result.candidates).toHaveLength(1);
  expect(response.body.result.candidates[0]).toMatchObject({ suggestedPence: '10000', reviewStatus: 'pending', invoice: { invoice_number: 'INV-100', outstanding_pence: '10000' } });
  expect(response.body.result.candidates[0].evidence.join()).toContain('INV-100');
  expect(await financialState()).toEqual(before);
  const repeated = await post(`/matching/payments/${id}`); expect(repeated.body.result.id).toBe(response.body.result.id);
  expect((await get('/matching/payments')).body.payments.find((payment: { id: string }) => payment.id === id).reviewState).toBe('exact_reference');
  expect((await get(`/matching/payments/${id}`)).body.result.id).toBe(response.body.result.id);
});
it('marks identical-amount candidates ambiguous and persists unmatched outcomes', async () => {
  const id = await payment(null);
  const response = await post(`/matching/payments/${id}`);
  expect(response.body.result.outcome).toBe('ambiguous'); expect(response.body.result.candidates).toHaveLength(2);
  expect(response.body.result.candidates.every((candidate: { category: string }) => candidate.category === 'ambiguous')).toBe(true);
  const unmatched = await payment('UNKNOWN', '777');
  const result = await post(`/matching/payments/${unmatched}`);
  expect(result.body.result).toMatchObject({ outcome: 'no_match', candidates: [] });
  expect((await get(`/matching/payments/${unmatched}`)).body.state).toBe('current');
});
it('rejects suggestions idempotently without changing balances or reactivating them', async () => {
  const id = await payment('INV-100');
  const generated = await post(`/matching/payments/${id}`); const suggestionId = generated.body.result.candidates[0].id;
  const before = await financialState();
  expect((await post(`/matching/suggestions/${suggestionId}/reject`)).body.reviewStatus).toBe('rejected');
  expect((await post(`/matching/suggestions/${suggestionId}/reject`)).status).toBe(200);
  expect((await post(`/matching/payments/${id}`)).body.result.candidates[0].reviewStatus).toBe('rejected');
  expect((await get('/matching/payments')).body.payments.find((payment: { id: string }) => payment.id === id).reviewState).toBe('rejected');
  expect(await financialState()).toEqual(before);
});
it('detects stale results after imported invoice evidence changes and rejects stale review', async () => {
  const id = await payment('INV-100'); const original = await post(`/matching/payments/${id}`);
  const priorId = original.body.result.candidates[0].id;
  await invoice('NEW-EVIDENCE', 'New Customer', '12345');
  const stale = await get(`/matching/payments/${id}`);
  expect(stale.body).toMatchObject({ state: 'stale', result: null });
  expect((await get('/matching/payments')).body.payments.find((payment: { id: string }) => payment.id === id).reviewState).toBe('stale');
  expect((await post(`/matching/suggestions/${priorId}/reject`)).status).toBe(409);
  const regenerated = await post(`/matching/payments/${id}`);
  expect(regenerated.body.state).toBe('current'); expect(regenerated.body.result.id).not.toBe(original.body.result.id);
  expect((await pool.query('SELECT id FROM match_suggestions WHERE id=$1', [priorId])).rowCount).toBe(1);
});
it('derives balances from active allocations, detects ledger changes and excludes closed invoices', async () => {
  const invoiceId = await invoice('PART-1', 'Partial Customer', '20000');
  const id = await payment('PART-1', '25000');
  const initial = await post(`/matching/payments/${id}`); expect(initial.body.result.candidates[0].suggestedPence).toBe('20000');
  const operation = (await pool.query("INSERT INTO financial_operations(workspace_id,operation_key,kind,request_hash,result) VALUES ($1,$2,'allocation',$3,'{}') RETURNING id", [workspaceId, randomUUID(), '0'.repeat(64)])).rows[0].id;
  // Fixture-only SQL represents later-service outcomes; no allocation API is added.
  const allocation = (await pool.query('INSERT INTO payment_allocations(workspace_id,operation_id,bank_transaction_id,invoice_id,amount_pence) VALUES ($1,$2,$3,$4,5000) RETURNING id', [workspaceId, operation, id, invoiceId])).rows[0].id;
  expect((await get(`/matching/payments/${id}`)).body.state).toBe('stale');
  const partial = await post(`/matching/payments/${id}`);
  expect(partial.body.payment.unallocated_pence).toBe('20000');
  expect(partial.body.result.candidates[0]).toMatchObject({ suggestedPence: '15000', invoice: { total_pence: '20000', outstanding_pence: '15000' } });
  await pool.query('INSERT INTO allocation_reversals(workspace_id,allocation_id,operation_id,reason) VALUES ($1,$2,$3,$4)', [workspaceId, allocation, operation, 'Synthetic correction']);
  expect((await get(`/matching/payments/${id}`)).body.state).toBe('stale');
  const restored = await post(`/matching/payments/${id}`);
  expect(restored.body.result.id).not.toBe(initial.body.result.id);
  expect(restored.body.result.candidates[0].invoice.outstanding_pence).toBe('20000');
  await pool.query('INSERT INTO payment_allocations(workspace_id,operation_id,bank_transaction_id,invoice_id,amount_pence) VALUES ($1,$2,$3,$4,20000)', [workspaceId, (await pool.query("INSERT INTO financial_operations(workspace_id,operation_key,kind,request_hash,result) VALUES ($1,$2,'allocation',$3,'{}') RETURNING id", [workspaceId, randomUUID(), '1'.repeat(64)])).rows[0].id, id, invoiceId]);
  const closed = await post(`/matching/payments/${id}`);
  expect(closed.body.result.outcome).toBe('no_match');
});
it('scopes generation, detail, list and rejection to the authenticated workspace', async () => {
  const id = await payment('INV-100'); const result = await post(`/matching/payments/${id}`); const suggestionId = result.body.result.candidates[0].id;
  expect((await get('/matching/payments', otherToken)).body.payments).toEqual([]);
  expect((await get(`/matching/payments/${id}`, otherToken)).status).toBe(404);
  expect((await post(`/matching/payments/${id}`, otherToken)).status).toBe(404);
  expect((await post(`/matching/suggestions/${suggestionId}/reject`, otherToken)).status).toBe(404);
  expect((await request(app).post(`/matching/payments/${id}`)).status).toBe(401);
  expect((await get('/matching/payments/invalid')).status).toBe(404);
  expect((await get('/matching/payments?page=0')).status).toBe(400);
});
it('serializes repeated concurrent generation without duplicate runs or suggestions', async () => {
  const id = await payment('INV-100');
  const responses = await Promise.all([post(`/matching/payments/${id}`), post(`/matching/payments/${id}`)]);
  expect(responses.map(response => response.status)).toEqual([200, 200]);
  expect(responses[0]!.body.result.id).toBe(responses[1]!.body.result.id);
  expect((await pool.query('SELECT id FROM matching_runs WHERE bank_transaction_id=$1', [id])).rowCount).toBe(1);
  expect((await pool.query('SELECT id FROM match_suggestions WHERE bank_transaction_id=$1', [id])).rowCount).toBe(1);
});
it('rolls review metadata back on insertion failure and leaves all financial records unchanged', async () => {
  const id = await payment('INV-100'); const before = await financialState();
  await pool.query("CREATE FUNCTION fail_matching() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$; CREATE TRIGGER fail_matching BEFORE INSERT ON match_suggestions FOR EACH ROW EXECUTE FUNCTION fail_matching()");
  try {
    const response = await post(`/matching/payments/${id}`); expect(response.status).toBe(500); expect(response.text).not.toContain('synthetic failure');
    expect((await pool.query('SELECT id FROM matching_runs WHERE bank_transaction_id=$1', [id])).rowCount).toBe(0);
    expect(await financialState()).toEqual(before);
  } finally { await pool.query('DROP TRIGGER fail_matching ON match_suggestions; DROP FUNCTION fail_matching()'); }
});
it('paginates payments with stable ordering', async () => {
  await pool.query("INSERT INTO bank_transactions(workspace_id,bank_account_id,transaction_date,description,amount_pence) SELECT $1,$2,'2026-10-10','Paged payment ' || n,100 FROM generate_series(1,30) n", [workspaceId, bankId]);
  const first = (await get('/matching/payments?page=1')).body; const second = (await get('/matching/payments?page=2')).body;
  expect(first.payments).toHaveLength(25); expect(first.hasMore).toBe(true);
  expect(second.payments.length).toBeGreaterThan(0);
  expect(second.payments.every((payment: { id: string }) => !first.payments.some((prior: { id: string }) => prior.id === payment.id))).toBe(true);
});
