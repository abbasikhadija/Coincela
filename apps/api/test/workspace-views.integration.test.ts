import { beforeAll, afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { runner } from 'node-pg-migrate';
import request from 'supertest';
import type pg from 'pg';
import { createPool, checkDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
const schema = `views_${randomUUID().replaceAll('-', '')}`;
let pool: pg.Pool; let admin: pg.Pool; let app: ReturnType<typeof createApp>; let token: string; let otherToken: string; let workspace: string; let bank: string; let invoiceId: string; let paymentId: string;
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw Error('TEST_DATABASE_URL required');
  admin = createPool(process.env.TEST_DATABASE_URL); await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('options', `-c search_path=${schema}`); pool = createPool(url.toString()); const client = await pool.connect();
  try { await runner({ dbClient: client, lockValue: Number.parseInt(schema.slice(-12), 16), schema, migrationsSchema: schema, migrationsTable: 'pgmigrations', dir: resolve('migrations'), direction: 'up', log: () => {} }); } finally { client.release(); }
  app = createApp(readConfig({ DATABASE_URL: url.toString(), CORS_ORIGINS: 'https://frontend.example' }), () => checkDatabase(pool), pool);
  const register = () => request(app).post('/auth/register').send({ email: `${randomUUID()}@example.test`, password: 'Synthetic workspace view passphrase!', workspaceName: 'View studio' });
  const owner = await register(); expect(owner.status).toBe(201); token = owner.body.token; workspace = owner.body.workspace.id; otherToken = (await register()).body.token;
  bank = (await pool.query("INSERT INTO bank_accounts(workspace_id,name) VALUES ($1,'Named test account') RETURNING id", [workspace])).rows[0].id;
}, 25000);
afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); } });
function get(path: string, auth = token) { return request(app).get(path).set('Authorization', `Bearer ${auth}`); }
function post(path: string, body: object) { return request(app).post(path).set('Authorization', `Bearer ${token}`).send(body); }
it('starts with an honest empty summary and guides invoice then payment import', async () => {
  expect((await get('/overview')).body).toMatchObject({ invoiceCount: 0, paymentCount: 0, outstandingPence: '0', paymentsToReview: 0, next: 'import_invoices', recent: [] });
  invoiceId = (await pool.query("INSERT INTO invoices(workspace_id,invoice_number,customer_name,issue_date,due_date,total_pence) VALUES ($1,'VIEW-1','View Customer','2026-10-01','2026-10-31',10000) RETURNING id", [workspace])).rows[0].id;
  expect((await get('/overview')).body).toMatchObject({ invoiceCount: 1, outstandingPence: '10000', next: 'import_payments' });
  paymentId = (await pool.query("INSERT INTO bank_transactions(workspace_id,bank_account_id,transaction_date,description,amount_pence,requires_duplicate_review) VALUES ($1,$2,'2026-10-10','View transfer',10000,true) RETURNING id", [workspace, bank])).rows[0].id;
  expect((await get('/overview')).body).toMatchObject({ next: 'review', paymentsToReview: 1, unallocatedPence: '10000' });
});
it('reflects active and reversed balances with linked record history, bank context and compact activity', async () => {
  const allocate = async (amountPence: string) => post('/allocations', { operationKey: randomUUID(), paymentId, confirmed: true, allocations: [{ invoiceId, amountPence }] });
  const partial = await allocate('4000'); expect(partial.status).toBe(200);
  expect((await get('/overview')).body).toMatchObject({ outstandingPence: '6000', paymentsToReview: 1, unallocatedPence: '6000' });
  const detail = await get(`/transactions/${paymentId}`); expect(detail.body.accountName).toBe('Named test account'); expect(detail.body.record.requires_duplicate_review).toBe(true);
  expect(detail.body.allocations[0]).toMatchObject({ amountPence: '4000', invoiceId, operationId: partial.body.operationId, reversalId: null });
  expect((await get(`/invoices/${invoiceId}`)).body.record).toMatchObject({ total_pence: '10000', outstanding_pence: '6000' });
  const rest = await allocate('6000'); expect(rest.status).toBe(200);
  expect((await get('/overview')).body).toMatchObject({ outstandingPence: '0', paymentsToReview: 0, next: 'activity' });
  const reversed = await post('/reversals', { operationKey: randomUUID(), allocationId: partial.body.allocations[0].id, confirmed: true, reason: 'Correct invoice selection' }); expect(reversed.status).toBe(200);
  const summary = (await get('/overview')).body; expect(summary).toMatchObject({ outstandingPence: '4000', unallocatedPence: '4000', paymentsToReview: 1, next: 'review' }); expect(summary.recent[0].eventType).toBe('allocation_reversed'); expect(summary.recent.length).toBeLessThanOrEqual(5);
  const history = (await get(`/invoices/${invoiceId}`)).body; expect(history.allocations).toHaveLength(2); expect(history.allocations.find((row: { reversalId: string }) => row.reversalId)).toMatchObject({ reason: 'Correct invoice selection', reversalOperationId: reversed.body.operationId });
});
it('isolates summary/detail/history and validates IDs and pagination without financial writes', async () => {
  const before = (await pool.query('SELECT (SELECT count(*) FROM financial_operations)::text AS operations,(SELECT count(*) FROM audit_events)::text AS audits')).rows[0];
  expect((await get('/overview', otherToken)).body).toMatchObject({ invoiceCount: 0, paymentCount: 0, recent: [] });
  expect((await get(`/invoices/${invoiceId}`, otherToken)).status).toBe(404); expect((await get(`/transactions/${paymentId}`, otherToken)).status).toBe(404);
  for (const kind of ['invoices', 'transactions']) { expect((await get(`/${kind}/invalid`)).status).toBe(404); expect((await get(`/${kind}/${randomUUID()}`)).status).toBe(404); expect((await get(`/${kind}/${kind === 'invoices' ? invoiceId : paymentId}?page=0`)).status).toBe(400); }
  expect((await request(app).get('/overview')).status).toBe(401); expect((await request(app).get(`/invoices/${invoiceId}`)).status).toBe(401);
  expect((await pool.query('SELECT (SELECT count(*) FROM financial_operations)::text AS operations,(SELECT count(*) FROM audit_events)::text AS audits')).rows[0]).toEqual(before);
});
it('paginates linked allocation history with stable ordering', async () => {
  const i = (await pool.query("INSERT INTO invoices(workspace_id,invoice_number,customer_name,issue_date,due_date,total_pence) VALUES ($1,'PAGED-VIEW','Paging customer','2026-10-01','2026-10-31',10000) RETURNING id", [workspace])).rows[0].id;
  const p = (await pool.query("INSERT INTO bank_transactions(workspace_id,bank_account_id,transaction_date,description,amount_pence) VALUES ($1,$2,'2026-10-10','Paging view payment',10000) RETURNING id", [workspace, bank])).rows[0].id;
  for (let n = 0; n < 51; n++) expect((await post('/allocations', { operationKey: randomUUID(), paymentId: p, confirmed: true, allocations: [{ invoiceId: i, amountPence: '1' }] })).status).toBe(200);
  const first = (await get(`/invoices/${i}?page=1`)).body; const second = (await get(`/invoices/${i}?page=2`)).body;
  expect(first.allocations).toHaveLength(50); expect(first.hasMore).toBe(true); expect(second.allocations).toHaveLength(1); expect(second.hasMore).toBe(false);
  expect(new Set([...first.allocations, ...second.allocations].map(row => row.id)).size).toBe(51); expect(first.record.outstanding_pence).toBe('9949');
}, 20000);
it('aggregates exact workspace totals beyond a single BIGINT without Number conversion', async () => {
  const before = BigInt((await get('/overview')).body.outstandingPence);
  await pool.query("INSERT INTO invoices(workspace_id,invoice_number,customer_name,issue_date,due_date,total_pence) SELECT $1,'LARGE-VIEW-' || n,'Large values','2026-10-01','2026-10-31',9223372036854775807 FROM generate_series(1,2) n", [workspace]);
  expect((await get('/overview')).body.outstandingPence).toBe((before + 2n * 9223372036854775807n).toString());
});
