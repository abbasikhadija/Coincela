import express from 'express';
import cors from 'cors';
import type { Config } from './config.js';
import { errorHandler } from './errors.js';
import { HttpError } from './errors.js';
import type pg from 'pg';
import { authRoutes } from './auth/routes.js';

export function createApp(config: Config, checkDatabase: () => Promise<void>, pool?: pg.Pool) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, _res, next) => {
    const origin = req.get('Origin');
    if (origin && !config.CORS_ORIGINS.includes(origin)) { next(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'This origin is not allowed.')); return; }
    next();
  });
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || config.CORS_ORIGINS.includes(origin)), credentials: false, allowedHeaders: ['Content-Type', 'Authorization'], methods: ['GET', 'POST', 'PATCH', 'OPTIONS'] }));
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', (_req, res) => { res.json({ status: 'ok', service: 'coincela-api' }); });
  app.get('/health/ready', async (_req, res) => {
    try { await checkDatabase(); res.json({ status: 'ok', database: 'connected' }); }
    catch { res.status(503).json({ status: 'unavailable', message: 'The database is unavailable. Please try again shortly.' }); }
  });
  if (pool) app.use(authRoutes(pool));
  app.use((_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'This endpoint does not exist.' } }); });
  app.use(errorHandler);
  return app;
}
