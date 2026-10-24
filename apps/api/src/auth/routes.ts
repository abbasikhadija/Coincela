import { Router, type RequestHandler } from 'express';
import type pg from 'pg';
import { AuthService } from './service.js';
import { findSession, publicSession, type Principal } from './repository.js';
import { registrationSchema, loginSchema, workspaceSchema, workspaceIdSchema } from './validation.js';
import { HttpError } from '../errors.js';
import { importRoutes } from '../imports/routes.js';
import { matchingRoutes } from '../matching/routes.js';
import { allocationRoutes } from '../allocations/routes.js';
import { activityRoutes } from '../activity/routes.js';
import { workspaceViewRoutes } from '../workspace-views/routes.js';
function authLimiter(): RequestHandler {
  // Bounded per-process abuse protection. No forwarded-IP trust is assumed.
  const attempts = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
    const key = req.ip ?? 'unknown';
    let entry = attempts.get(key);
    if (!entry && attempts.size >= 10000) { next(new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Too many attempts. Please try again in 15 minutes.')); return; }
    if (!entry) { entry = { count: 0, until: now + 15 * 60 * 1000 }; attempts.set(key, entry); }
    entry.count++;
    if (entry.count > 30) {
      res.setHeader('Retry-After', Math.ceil((entry.until - now) / 1000));
      next(new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Too many attempts. Please try again in 15 minutes.')); return;
    }
    next();
  };
}
export function authRoutes(pool: pg.Pool) {
  const router = Router();
  const service = new AuthService(pool);
  const limit = authLimiter();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.post('/auth/register', limit, async (req, res) => {
    const result = registrationSchema.safeParse(req.body);
    if (!result.success) throw new HttpError(400, 'INVALID_INPUT', 'Enter a valid email, a password of 12–128 characters, and a workspace name of 1–100 characters.');
    res.status(201).json(await service.register(result.data));
  });
  router.post('/auth/login', limit, async (req, res) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) throw new HttpError(400, 'INVALID_INPUT', 'Enter your email and password (up to 128 characters).');
    res.json(await service.login(result.data));
  });
  const requireSession: RequestHandler = async (req, res, next) => {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(req.get('Authorization') ?? '');
    const principal = match ? await findSession(pool, match[1]!) : null;
    if (!principal) throw new HttpError(401, 'SESSION_EXPIRED', 'Your session has ended. Please sign in again.');
    res.locals.principal = principal;
    next();
  };
  router.use(requireSession);
  router.use(importRoutes(pool));
  router.use(matchingRoutes(pool));
  router.use(allocationRoutes(pool));
  router.use(activityRoutes(pool));
  router.use(workspaceViewRoutes(pool));
  router.get('/auth/me', (_req, res) => { res.json(publicSession(res.locals.principal as Principal)); });
  router.post('/auth/logout', async (_req, res) => {
    const principal = res.locals.principal as Principal;
    await pool.query('UPDATE sessions SET revoked_at = clock_timestamp() WHERE id = $1 AND user_id = $2', [principal.sessionId, principal.userId]);
    res.status(204).end();
  });
  router.get('/workspaces/:id', async (req, res) => {
    const principal = res.locals.principal as Principal;
    if (!workspaceIdSchema.safeParse(req.params.id).success) throw new HttpError(404, 'NOT_FOUND', 'Workspace not found.');
    const workspace = (await pool.query('SELECT id, name, currency FROM workspaces WHERE id = $1 AND owner_user_id = $2', [req.params.id, principal.userId])).rows[0];
    if (!workspace) throw new HttpError(404, 'NOT_FOUND', 'Workspace not found.');
    res.json({ workspace });
  });
  router.patch('/workspaces/:id', async (req, res) => {
    const principal = res.locals.principal as Principal;
    const input = workspaceSchema.safeParse(req.body);
    if (!workspaceIdSchema.safeParse(req.params.id).success) throw new HttpError(404, 'NOT_FOUND', 'Workspace not found.');
    if (!input.success) throw new HttpError(400, 'INVALID_INPUT', 'Enter a workspace name of 1–100 characters.');
    const workspace = (await pool.query('UPDATE workspaces SET name = $1 WHERE id = $2 AND owner_user_id = $3 RETURNING id, name, currency', [input.data.name, req.params.id, principal.userId])).rows[0];
    if (!workspace) throw new HttpError(404, 'NOT_FOUND', 'Workspace not found.');
    res.json({ workspace });
  });
  return router;
}
