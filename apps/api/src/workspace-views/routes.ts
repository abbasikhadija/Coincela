import { Router } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import type { Principal } from '../auth/repository.js';
import { HttpError } from '../errors.js';
import { WorkspaceViewsService } from './service.js';
export function workspaceViewRoutes(pool: pg.Pool) {
  const router = Router(); const service = new WorkspaceViewsService(pool);
  router.get('/overview', async (_req, res) => { res.json(await service.overview((res.locals.principal as Principal).workspaceId)); });
  for (const kind of ['invoices', 'transactions'] as const) router.get(`/${kind}/:id`, async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) throw new HttpError(404, 'RECORD_NOT_FOUND', 'Record not found.');
    const input = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict().safeParse(req.query);
    if (!input.success) throw new HttpError(400, 'INVALID_PAGE', 'Choose a valid allocation history page.');
    res.json(await service.detail((res.locals.principal as Principal).workspaceId, kind, req.params.id as string, input.data.page));
  });
  return router;
}
