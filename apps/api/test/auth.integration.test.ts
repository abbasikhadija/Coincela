import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { runner } from 'node-pg-migrate';
import { resolve } from 'node:path';
import { createPool, checkDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { hashToken } from '../src/auth/repository.js';
import type pg from 'pg';

const schema = `test_${randomUUID().replaceAll('-', '')}`;
let pool: pg.Pool;
let admin: pg.Pool;
let app: ReturnType<typeof createApp>;
async function migrate(direction: 'up' | 'down') {
  const client = await pool.connect();
  try { return await runner({ dbClient: client, lockValue: Number.parseInt(schema.slice(-12), 16), schema, migrationsSchema: schema, migrationsTable: 'pgmigrations', dir: resolve('migrations'), direction, count: direction === 'down' ? 1 : undefined, log: () => {} }); }
  finally { client.release(); }
}
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw Error('TEST_DATABASE_URL is required; use isolated PostgreSQL');
  admin = createPool(process.env.TEST_DATABASE_URL);
  await admin.query(`CREATE SCHEMA ${schema}`); // Generated hex identifier, never user input.
  const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('options', `-c search_path=${schema}`);
  pool = createPool(url.toString());
  await migrate('up');
  app = createApp(readConfig({ DATABASE_URL: url.toString(), CORS_ORIGINS: 'https://frontend.example' }), () => checkDatabase(pool), pool);
}, 20000);
afterAll(async () => {
  if (pool) await pool.end();
  if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
});
const password = 'A long synthetic passphrase!';
async function register(email = `${randomUUID()}@example.test`) {
  const response = await request(app).post('/auth/register').send({ email, password, workspaceName: 'Synthetic studio' });
  expect(response.status).toBe(201); return response.body;
}
const bearer = (token: string) => `Bearer ${token}`;
describe('migrations and authentication with PostgreSQL', () => {
  it('applies once, rolls back and reapplies the complete schema', async () => {
    expect(await migrate('up')).toHaveLength(0);
    expect((await pool.query('SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema=$1 AND table_name IN (\'users\',\'payment_allocations\',\'audit_events\')', [schema])).rows[0].count).toBe(3);
    await migrate('down');
    expect((await pool.query('SELECT to_regclass($1) AS table', [`${schema}.users`])).rows[0].table).toBeNull();
    expect(await migrate('up')).toHaveLength(1);
  });
  it('registers exactly one workspace, uses password hashes and stores only token hashes', async () => {
    const account = await register('  OWNER@example.test  ');
    expect(account.user.email).toBe('owner@example.test'); expect(account.workspace.currency).toBe('GBP');
    expect(account.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const record = (await pool.query('SELECT u.password_hash, s.token_hash, extract(epoch FROM s.expires_at-s.created_at) AS seconds FROM users u JOIN sessions s ON u.id=s.user_id WHERE u.id=$1', [account.user.id])).rows[0];
    expect(record.password_hash).toMatch(/^scrypt\$/); expect(record.password_hash).not.toContain(password);
    expect(record.token_hash).toBe(hashToken(account.token)); expect(record.token_hash).not.toBe(account.token);
    expect(Number(record.seconds)).toBeCloseTo(1800, 0);
    const me = await request(app).get('/auth/me').set('Authorization', bearer(account.token));
    expect(me.status).toBe(200); expect(me.headers['cache-control']).toBe('no-store');
    expect(me.body.user.email).toBe('owner@example.test'); expect(me.body.token).toBeUndefined();
  });
  it('rejects a duplicate normalized email without another workspace/session', async () => {
    const account = await register();
    const duplicate = await request(app).post('/auth/register').send({ email: account.user.email.toUpperCase(), password, workspaceName: 'Other' });
    expect(duplicate.status).toBe(409);
    const counts = (await pool.query('SELECT (SELECT count(*) FROM workspaces WHERE owner_user_id=$1)::int AS workspaces, (SELECT count(*) FROM sessions WHERE user_id=$1)::int AS sessions', [account.user.id])).rows[0];
    expect(counts).toEqual({ workspaces: 1, sessions: 1 });
  });
  it('handles simultaneous duplicate registrations atomically', async () => {
    const email = `${randomUUID()}@example.test`;
    const responses = await Promise.all([1, 2].map(() => request(app).post('/auth/register').send({ email, password, workspaceName: 'Concurrent' })));
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    expect((await pool.query('SELECT count(*)::int AS count FROM workspaces w JOIN users u ON u.id=w.owner_user_id WHERE u.email=$1', [email])).rows[0].count).toBe(1);
  });
  it('logs in, rejects wrong passwords/unknown emails uniformly and revokes logout', async () => {
    const account = await register();
    const login = await request(app).post('/auth/login').send({ email: account.user.email, password });
    expect(login.status).toBe(200); expect(login.body.token).not.toBe(account.token);
    const wrong = await request(app).post('/auth/login').send({ email: account.user.email, password: 'wrong' });
    const unknown = await request(app).post('/auth/login').send({ email: 'unknown@example.test', password: 'wrong' });
    expect(wrong.status).toBe(401); expect(unknown.body).toEqual(wrong.body);
    expect((await request(app).post('/auth/logout').set('Authorization', bearer(login.body.token))).status).toBe(204);
    expect((await request(app).get('/auth/me').set('Authorization', bearer(login.body.token))).status).toBe(401);
    expect((await request(app).get('/auth/me').set('Authorization', bearer(account.token))).status).toBe(200);
  });
  it('denies expired, missing, malformed and unknown bearer sessions', async () => {
    const account = await register();
    await pool.query("UPDATE sessions SET created_at=clock_timestamp()-interval '1 hour', expires_at=clock_timestamp()-interval '1 second' WHERE token_hash=$1", [hashToken(account.token)]);
    for (const token of ['', 'Bearer malformed', bearer('a'.repeat(43)), bearer(account.token)]) {
      const response = await request(app).get('/auth/me').set('Authorization', token);
      expect(response.status).toBe(401); expect(response.body.error.code).toBe('SESSION_EXPIRED');
    }
  });
  it('isolates workspace reads/updates and validates workspace input', async () => {
    const first = await register(); const second = await register();
    const path = `/workspaces/${first.workspace.id}`;
    expect((await request(app).get(path).set('Authorization', bearer(second.token))).status).toBe(404);
    expect((await request(app).patch(path).set('Authorization', bearer(second.token)).send({ name: 'Stolen' })).status).toBe(404);
    expect((await request(app).patch(path).set('Authorization', bearer(first.token)).send({ name: ' ' })).status).toBe(400);
    expect((await request(app).patch(path).set('Authorization', bearer(first.token)).send({ name: 'Saved studio', currency: 'USD' })).status).toBe(400);
    const response = await request(app).patch(path).set('Authorization', bearer(first.token)).send({ name: 'Saved studio' });
    expect(response.status).toBe(200); expect(response.body.workspace.name).toBe('Saved studio');
    expect((await request(app).get(`/workspaces/not-a-uuid`).set('Authorization', bearer(first.token))).status).toBe(404);
    expect((await request(app).get(path)).status).toBe(401);
  });
  it('rejects invalid origins before mutation and supports Authorization preflight', async () => {
    const response = await request(app).post('/auth/register').set('Origin', 'https://evil.example').send({ email: 'cors@example.test', password, workspaceName: 'Cors' });
    expect(response.status).toBe(403);
    expect((await pool.query('SELECT id FROM users WHERE email=$1', ['cors@example.test'])).rowCount).toBe(0);
    const preflight = await request(app).options('/auth/me').set('Origin', 'https://frontend.example').set('Access-Control-Request-Method', 'GET').set('Access-Control-Request-Headers', 'Authorization');
    expect(preflight.status).toBe(204); expect(preflight.headers['access-control-allow-origin']).toBe('https://frontend.example');
    expect(preflight.headers['access-control-allow-headers']).toContain('Authorization'); expect(preflight.headers['access-control-allow-credentials']).toBeUndefined();
  });
  it('rejects invalid auth payloads and bounds attempts', async () => {
    const limited = createApp(readConfig({ DATABASE_URL: 'postgres://unused@localhost/test', CORS_ORIGINS: 'https://frontend.example' }), () => checkDatabase(pool), pool);
    for (let count = 0; count < 30; count++) expect((await request(limited).post('/auth/register').send({ email: 'invalid', password: 'short', workspaceName: '' })).status).toBe(400);
    const blocked = await request(limited).post('/auth/register').send({});
    expect(blocked.status).toBe(429); expect(blocked.headers['retry-after']).toBeDefined();
  });
  it('rolls registration back when creating its session fails', async () => {
    await pool.query("CREATE FUNCTION reject_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$; CREATE TRIGGER reject_session BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION reject_session()");
    const email = `${randomUUID()}@example.test`;
    try {
      const response = await request(app).post('/auth/register').send({ email, password, workspaceName: 'Must roll back' });
      expect(response.status).toBe(500); expect(response.text).not.toContain('synthetic failure');
      expect((await pool.query('SELECT id FROM users WHERE email=$1', [email])).rowCount).toBe(0);
      expect((await pool.query("SELECT id FROM workspaces WHERE name='Must roll back'")).rowCount).toBe(0);
    } finally { await pool.query('DROP TRIGGER reject_session ON sessions; DROP FUNCTION reject_session()'); }
  });
  it('enforces financial bounds, workspace foreign keys and stable duplicate identities', async () => {
    const first = await register(); const second = await register();
    await expect(pool.query('INSERT INTO workspaces(owner_user_id,name) VALUES ($1,$2)', [first.user.id, 'Extra'])).rejects.toMatchObject({ code: '23505' });
    const bank = (await pool.query('INSERT INTO bank_accounts(workspace_id,name) VALUES ($1,$2) RETURNING id', [first.workspace.id, 'Test bank'])).rows[0];
    const invoiceSql = "INSERT INTO invoices(workspace_id,invoice_number,customer_name,issue_date,due_date,total_pence,currency) VALUES ($1,$2,'Synthetic','2026-10-01','2026-10-31',$3,$4) RETURNING id";
    const invoice = (await pool.query(invoiceSql, [first.workspace.id, 'INV-1', '9223372036854775807', 'GBP'])).rows[0];
    expect((await pool.query('SELECT total_pence FROM invoices WHERE id=$1', [invoice.id])).rows[0].total_pence).toBe('9223372036854775807');
    await expect(pool.query(invoiceSql, [first.workspace.id, 'INV-NEG', '-1', 'GBP'])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query(invoiceSql, [first.workspace.id, 'INV-USD', '100', 'USD'])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query(invoiceSql, [first.workspace.id, 'INV-OVER', '9223372036854775808', 'GBP'])).rejects.toMatchObject({ code: '22003' });
    await expect(pool.query(invoiceSql, [first.workspace.id, 'INV-1', '1', 'GBP'])).rejects.toMatchObject({ code: '23505' });
    const txSql = "INSERT INTO bank_transactions(workspace_id,bank_account_id,transaction_date,description,amount_pence,external_transaction_id) VALUES ($1,$2,'2026-10-01','Same visible fields',$3,$4) RETURNING id";
    const tx = (await pool.query(txSql, [first.workspace.id, bank.id, '100', 'EXT-1'])).rows[0];
    await expect(pool.query(txSql, [first.workspace.id, bank.id, '0', null])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query(txSql, [second.workspace.id, bank.id, '100', null])).rejects.toMatchObject({ code: '23503' });
    await expect(pool.query(txSql, [first.workspace.id, bank.id, '100', 'EXT-1'])).rejects.toMatchObject({ code: '23505' });
    await pool.query(txSql, [first.workspace.id, bank.id, '100', null]); await pool.query(txSql, [first.workspace.id, bank.id, '100', null]);
    const operation = (await pool.query("INSERT INTO financial_operations(workspace_id,operation_key,kind,request_hash,result) VALUES ($1,$2,'allocation',$3,'{}') RETURNING id", [first.workspace.id, randomUUID(), '0'.repeat(64)])).rows[0];
    const allocSql = 'INSERT INTO payment_allocations(workspace_id,operation_id,bank_transaction_id,invoice_id,amount_pence) VALUES ($1,$2,$3,$4,$5) RETURNING id';
    await expect(pool.query(allocSql, [first.workspace.id, operation.id, tx.id, invoice.id, '0'])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query(allocSql, [second.workspace.id, operation.id, tx.id, invoice.id, '1'])).rejects.toMatchObject({ code: '23503' });
    const allocation = (await pool.query(allocSql, [first.workspace.id, operation.id, tx.id, invoice.id, '1'])).rows[0];
    const revSql = 'INSERT INTO allocation_reversals(workspace_id,allocation_id,operation_id,reason) VALUES ($1,$2,$3,$4)';
    await expect(pool.query(revSql, [first.workspace.id, allocation.id, operation.id, ' '])).rejects.toMatchObject({ code: '23514' });
    await pool.query(revSql, [first.workspace.id, allocation.id, operation.id, 'Synthetic correction']);
    await expect(pool.query(revSql, [first.workspace.id, allocation.id, operation.id, 'Repeated'])).rejects.toMatchObject({ code: '23505' });
    await expect(pool.query("INSERT INTO audit_events(workspace_id,actor_user_id,event_type,details) VALUES ($1,$2,'test','{}')", [first.workspace.id, second.user.id])).rejects.toMatchObject({ code: '23503' });
  });
});
