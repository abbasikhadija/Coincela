import { beforeAll, afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { runner } from 'node-pg-migrate';
import { resolve } from 'node:path';
import request from 'supertest';
import type pg from 'pg';
import { createPool, checkDatabase } from '../src/db.js';
import { readConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
const schema = `imports_${randomUUID().replaceAll('-', '')}`;
let pool: pg.Pool; let admin: pg.Pool; let app: ReturnType<typeof createApp>;
let token: string; let otherToken: string; let bankId: string; let otherBankId: string;
const invoices = 'invoice_number,customer_name,issue_date,due_date,currency,total_amount\n';
const payments = 'transaction_date,description,amount,currency,external_transaction_id,payment_reference,payer_name\n';
const invoice = (id: string, amount = '120.50') => `${id},Customer,2026-10-01,2026-10-31,GBP,${amount}\n`;
const payment = (id = '', description = 'Payment', amount = '120.50') => `2026-10-10,${description},${amount},GBP,${id},INV-1,Customer\n`;
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw Error('TEST_DATABASE_URL required');
  admin = createPool(process.env.TEST_DATABASE_URL); await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('options', `-c search_path=${schema}`);
  pool = createPool(url.toString()); const client = await pool.connect();
  try { await runner({ dbClient: client, lockValue: Number.parseInt(schema.slice(-12), 16), schema, migrationsSchema: schema, migrationsTable: 'pgmigrations', dir: resolve('migrations'), direction: 'up', log: () => {} }); } finally { client.release(); }
  app = createApp(readConfig({ DATABASE_URL: url.toString(), CORS_ORIGINS: 'https://frontend.example' }), () => checkDatabase(pool), pool);
  async function account() {
    const response = await request(app).post('/auth/register').send({ email: `${randomUUID()}@example.test`, password: 'Synthetic import passphrase!', workspaceName: 'Import tests' });
    expect(response.status).toBe(201); return response.body.token;
  }
  token = await account(); otherToken = await account();
  bankId = (await request(app).post('/bank-accounts').set('Authorization', `Bearer ${token}`).send({ name: 'Test current account' })).body.account.id;
  otherBankId = (await request(app).post('/bank-accounts').set('Authorization', `Bearer ${otherToken}`).send({ name: 'Other account' })).body.account.id;
}, 25000);
afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); } });
function upload(kind: 'invoices' | 'transactions', csv: string | Buffer, auth = token, bank = bankId) {
  return request(app).post(`/imports/${kind}`).set('Authorization', `Bearer ${auth}`).set('Content-Type', 'text/csv').set('X-Bank-Account-Id', bank).send(csv);
}
async function listing(resource: string, auth = token) { return request(app).get(`/${resource}`).set('Authorization', `Bearer ${auth}`); }
it('imports exact large monetary values and lists normalized dates and string pence', async () => {
  const response = await upload('invoices', invoices + invoice('INV-LARGE', '90071992547409.93'));
  expect(response.status).toBe(201); expect(response.body.insertedCount).toBe(1);
  const records = (await listing('invoices')).body.records;
  expect(records.find((row: { invoice_number: string }) => row.invoice_number === 'INV-LARGE')).toMatchObject({ total_pence: '9007199254740993', issue_date: '2026-10-01' });
});
it('recognizes exact repeated files and duplicate invoice identities explicitly', async () => {
  const csv = invoices + invoice('INV-DUP');
  expect((await upload('invoices', csv)).body.insertedCount).toBe(1);
  const repeat = await upload('invoices', csv); expect(repeat.status).toBe(200); expect(repeat.body).toMatchObject({ insertedCount: 0, duplicateCount: 1, repeatedFile: true });
  const overlap = await upload('invoices', invoices + invoice('INV-DUP') + invoice('INV-NEW'));
  expect(overlap.body).toMatchObject({ insertedCount: 1, duplicateCount: 1 });
  const conflict = await upload('invoices', invoices + invoice('INV-DUP', '130.00') + invoice('INV-MUST-NOT-INSERT'));
  expect(conflict.status).toBe(422); expect(conflict.body.errors[0].field).toBe('invoice_number');
  expect((await pool.query("SELECT id FROM invoices WHERE invoice_number='INV-MUST-NOT-INSERT'")).rowCount).toBe(0);
});
it('reports repeated invoice rows within one file and rejects conflicting details', async () => {
  const response = await upload('invoices', invoices + invoice('INV-INFILE') + invoice('INV-INFILE'));
  expect(response.body).toMatchObject({ insertedCount: 1, duplicateCount: 1 });
  const conflict = await upload('invoices', invoices + invoice('INV-CONFLICT') + invoice('INV-CONFLICT', '12.00'));
  expect(conflict.status).toBe(422); expect(conflict.body.insertedCount).toBe(0);
});
it('validates a complete file atomically and records row errors/history', async () => {
  const response = await upload('invoices', invoices + invoice('INV-VALID-REJECTED') + invoice('INV-INVALID', '-1'));
  expect(response.status).toBe(422); expect(response.body).toMatchObject({ insertedCount: 0, rowCount: 2, status: 'rejected' });
  expect(response.body.errors[0]).toMatchObject({ row: 3, field: 'total_amount' });
  expect((await pool.query("SELECT id FROM invoices WHERE invoice_number='INV-VALID-REJECTED'")).rowCount).toBe(0);
  const errors = await listing(`imports/${response.body.batchId}/errors`); expect(errors.body.errors.length).toBeGreaterThan(0);
  const history = await listing('imports'); expect(history.body.records.some((batch: { id: string }) => batch.id === response.body.batchId)).toBe(true);
});
it.each([
  'bad,headers\n1,2', invoices + 'INV-X,"broken',
  invoices + 'INV-X,Customer,2026-02-30,2026-10-31,GBP,1',
  invoices + 'INV-X,Customer,2026-10-01,2026-10-31,EUR,1',
  invoices + invoice('INV-X', '1.001'),
])('rejects malformed/invalid imports with no insertion', async csv => {
  const count = (await pool.query('SELECT count(*) FROM invoices')).rows[0].count;
  expect((await upload('invoices', csv)).status).toBe(422);
  expect((await pool.query('SELECT count(*) FROM invoices')).rows[0].count).toBe(count);
});
it('imports payments and skips reliable duplicate external IDs', async () => {
  const initial = await upload('transactions', payments + payment('EXT-1'));
  expect(initial.body.insertedCount).toBe(1);
  const repeat = await upload('transactions', payments + payment('EXT-1') + payment('EXT-2'));
  expect(repeat.body).toMatchObject({ insertedCount: 1, duplicateCount: 1, reviewCount: 1 });
  expect((await upload('transactions', payments + payment('EXT-1', 'Different details'))).status).toBe(422);
  expect((await listing('transactions')).body.records[0].amount_pence).toBe('12050');
});
it('keeps legitimate identical-looking payments and flags uncertain candidates', async () => {
  const result = await upload('transactions', payments + payment('', 'Identical transfer') + payment('', 'Identical transfer'));
  expect(result.body).toMatchObject({ insertedCount: 2, duplicateCount: 0, reviewCount: 2 });
  const next = await upload('transactions', payments + payment('', 'Identical transfer'));
  expect(next.body).toMatchObject({ insertedCount: 1, duplicateCount: 0, reviewCount: 1 });
  const rows = (await pool.query("SELECT * FROM bank_transactions WHERE description='Identical transfer'")).rows;
  expect(rows.length).toBe(3); expect(rows.every(row => row.requires_duplicate_review)).toBe(true);
});
it('rejects outgoing and zero payments and requires a workspace-owned named account', async () => {
  expect((await upload('transactions', payments + payment('NEG', 'Outgoing', '-1'))).status).toBe(422);
  expect((await upload('transactions', payments + payment('ZERO', 'Zero', '0'))).status).toBe(422);
  expect((await upload('transactions', payments + payment('FOREIGN'), token, otherBankId)).status).toBe(404);
  expect((await upload('transactions', payments + payment('MISSING'), token, '')).status).toBe(400);
});
it('scopes listings, errors and bank accounts and rejects unauthenticated uploads', async () => {
  expect((await listing('invoices', otherToken)).body.records).toEqual([]);
  expect((await listing('transactions', otherToken)).body.records).toEqual([]);
  expect((await listing('bank-accounts', otherToken)).body.accounts.map((row: { id: string }) => row.id)).toEqual([otherBankId]);
  const rejected = await upload('invoices', invoices + invoice('INVALID-SCOPE', '-1'));
  expect((await listing(`imports/${rejected.body.batchId}/errors`, otherToken)).status).toBe(404);
  expect((await request(app).post('/imports/invoices').set('Content-Type', 'text/csv').send(invoices + invoice('NO-AUTH'))).status).toBe(401);
  expect((await upload('invoices', invoices + invoice('OTHER-WORKSPACE'), otherToken)).status).toBe(201);
});
it('bounds transport and rows, and rejects unsupported content types', async () => {
  expect((await upload('invoices', Buffer.alloc(1024 * 1024 + 1, 65))).status).toBe(413);
  const rows = await upload('invoices', invoices + invoice('TOO-MANY').repeat(1001)); expect(rows.status).toBe(422); expect(rows.body.errors[0].message).toContain('1,000');
  expect((await request(app).post('/imports/invoices').set('Authorization', `Bearer ${token}`).send({ csv: 'not a CSV body' })).status).toBe(415);
});
it('serializes overlapping imports to prevent duplicate effects', async () => {
  const csv = invoices + invoice('CONCURRENT-IMPORT');
  const results = await Promise.all([upload('invoices', csv), upload('invoices', csv)]);
  expect(results.map(response => response.body.insertedCount).sort()).toEqual([0, 1]);
  expect((await pool.query("SELECT id FROM invoices WHERE invoice_number='CONCURRENT-IMPORT'")).rowCount).toBe(1);
});
it('paginates scoped records, validates page input and reuses named accounts', async () => {
  const csv = invoices + Array.from({ length: 55 }, (_, index) => invoice(`PAGED-${index}`)).join('');
  expect((await upload('invoices', csv)).body.insertedCount).toBe(55);
  const first = (await listing('invoices?page=1')).body;
  const second = (await listing('invoices?page=2')).body;
  expect(first.records).toHaveLength(50); expect(first.hasMore).toBe(true);
  expect(second.records.length).toBeGreaterThan(0);
  const ids = first.records.map((row: { id: string }) => row.id);
  expect(second.records.every((row: { id: string }) => !ids.includes(row.id))).toBe(true);
  expect((await listing('invoices?page=0')).status).toBe(400);
  expect((await listing('transactions?page=invalid')).status).toBe(400);
  const account = await request(app).post('/bank-accounts').set('Authorization', `Bearer ${token}`).send({ name: 'Test current account' });
  expect(account.body.account.id).toBe(bankId);
});
it('rolls back all financial rows and metadata on forced insertion failure', async () => {
  await pool.query("CREATE FUNCTION fail_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.invoice_number='FAIL-SECOND' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_import BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION fail_import()");
  const before = (await pool.query('SELECT count(*) FROM import_batches')).rows[0].count;
  try {
    const response = await upload('invoices', invoices + invoice('ROLLBACK-FIRST') + invoice('FAIL-SECOND'));
    expect(response.status).toBe(500); expect(response.text).not.toContain('synthetic failure');
    expect((await pool.query("SELECT id FROM invoices WHERE invoice_number='ROLLBACK-FIRST'")).rowCount).toBe(0);
    expect((await pool.query('SELECT count(*) FROM import_batches')).rows[0].count).toBe(before);
  } finally { await pool.query('DROP TRIGGER fail_import ON invoices; DROP FUNCTION fail_import()'); }
});
