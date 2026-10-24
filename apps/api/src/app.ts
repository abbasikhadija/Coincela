import express from 'express';
import cors from 'cors';
import type { Config } from './config.js';
import { errorHandler } from './errors.js';

export function createApp(config: Config, checkDatabase: () => Promise<void>) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || config.CORS_ORIGINS.includes(origin)), credentials: false }));
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', (_req, res) => { res.json({ status: 'ok', service: 'coincela-api' }); });
  app.get('/health/ready', async (_req, res) => {
    try { await checkDatabase(); res.json({ status: 'ok', database: 'connected' }); }
    catch { res.status(503).json({ status: 'unavailable', message: 'The database is unavailable. Please try again shortly.' }); }
  });
  app.use((_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'This endpoint does not exist.' } }); });
  app.use(errorHandler);
  return app;
}
