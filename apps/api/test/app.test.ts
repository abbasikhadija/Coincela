import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { errorHandler } from '../src/errors.js';
const config = readConfig({ DATABASE_URL: 'postgres://test:test@localhost/test', CORS_ORIGINS: 'http://localhost:5173' });
describe('HTTP foundation', () => {
  it('returns public liveness without a database dependency', async () => {
    const response = await request(createApp(config, async () => { throw Error('offline'); })).get('/health');
    expect(response.status).toBe(200); expect(response.body).toEqual({ status: 'ok', service: 'coincela-api' });
  });
  it('checks readiness and sanitizes database failures', async () => {
    const healthy = await request(createApp(config, async () => {})).get('/health/ready');
    expect(healthy.body.database).toBe('connected');
    const response = await request(createApp(config, async () => { throw Error('postgres://secret'); })).get('/health/ready');
    expect(response.status).toBe(503); expect(response.text).not.toContain('secret');
  });
  it('returns structured 404 and malformed JSON errors', async () => {
    const app = createApp(config, async () => {});
    expect((await request(app).get('/missing')).status).toBe(404);
    const response = await request(app).post('/missing').set('Content-Type', 'application/json').send('{');
    expect(response.status).toBe(400); expect(response.body.error.code).toBe('INVALID_JSON');
  });
  it('sanitizes unexpected exceptions', async () => {
    const app = express(); app.get('/', () => { throw Error('private stack and password'); }); app.use(errorHandler);
    const response = await request(app).get('/');
    expect(response.status).toBe(500); expect(response.text).not.toContain('password');
  });
  it('bounds JSON requests', async () => {
    expect((await request(createApp(config, async () => {})).post('/').send({ text: 'a'.repeat(17000) })).status).toBe(413);
  });
  it('only grants CORS to configured origins', async () => {
    const app = createApp(config, async () => {});
    expect((await request(app).get('/health').set('Origin', 'http://localhost:5173')).headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect((await request(app).get('/health').set('Origin', 'https://untrusted.example')).headers['access-control-allow-origin']).toBeUndefined();
  });
});
describe('environment', () => {
  it('accepts valid configuration and defaults', () => { expect(config.PORT).toBe(3001); });
  it.each([{ PORT: '0' }, { PORT: 'abc' }, { DATABASE_URL: 'https://example.com' }, { CORS_ORIGINS: '*' }, { CORS_ORIGINS: 'https://example.com/path' }, { NODE_ENV: 'production' }])('rejects invalid configuration %j', overrides => {
    expect(() => readConfig({ DATABASE_URL: config.DATABASE_URL, CORS_ORIGINS: 'http://localhost:5173', ...overrides })).toThrow('Invalid environment');
  });
  it('requires database and origins without exposing invalid values', () => {
    expect(() => readConfig({ DATABASE_URL: 'secret' })).toThrow('Invalid environment: DATABASE_URL, CORS_ORIGINS');
  });
});
