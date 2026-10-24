import { expect, it } from 'vitest';
import request from 'supertest';
import { createPool, checkDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
it('connects to real PostgreSQL and serves database readiness', async () => {
  if (!process.env.TEST_DATABASE_URL) throw Error('TEST_DATABASE_URL is required; use an isolated PostgreSQL database');
  const config = readConfig({ DATABASE_URL: process.env.TEST_DATABASE_URL, CORS_ORIGINS: 'http://localhost:5173' });
  const pool = createPool(config.DATABASE_URL);
  try {
    await checkDatabase(pool);
    const result = await pool.query('SELECT version() AS version');
    expect(result.rows[0].version).toContain('PostgreSQL');
    const response = await request(createApp(config, () => checkDatabase(pool))).get('/health/ready');
    expect(response.status).toBe(200); expect(response.body.database).toBe('connected');
  } finally { await pool.end(); }
});
