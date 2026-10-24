import { Router } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import type { Principal } from '../auth/repository.js';
import { HttpError } from '../errors.js';
import { MatchingService } from './service.js';
export function matchingRoutes(pool: pg.Pool) {
  const router = Router(); const service = new MatchingService(pool);
  router.get('/matching/payments', async (req, res) => {
    const input = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict().safeParse(req.query);
    if (!input.success) throw new HttpError(400, 'INVALID_PAGE', 'Choose a valid page number.');
    res.json(await service.list((res.locals.principal as Principal).workspaceId, input.data.page));
  });
  for (const method of ['get', 'post'] as const) router[method]('/matching/payments/:id', async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Payment not found.');
    res.json(await service.detail((res.locals.principal as Principal).workspaceId, req.params.id as string, method === 'post'));
  });
  router.post('/matching/suggestions/:id/reject', async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) throw new HttpError(404, 'SUGGESTION_NOT_FOUND', 'Suggestion not found.');
    res.json(await service.reject((res.locals.principal as Principal).workspaceId, req.params.id as string));
  });
  return router;
}
