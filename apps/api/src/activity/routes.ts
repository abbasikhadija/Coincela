import { Router } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import type { Principal } from '../auth/repository.js';
import { HttpError } from '../errors.js';
import { ReversalService } from '../reversals/service.js';
import { reversalSchema } from '../reversals/validation.js';
import { ActivityService } from './service.js';
export function activityRoutes(pool: pg.Pool) {
  const router = Router(); const activity = new ActivityService(pool); const reversals = new ReversalService(pool);
  router.get('/activity', async (req, res) => {
    const query = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict().safeParse(req.query);
    if (!query.success) throw new HttpError(400, 'INVALID_PAGE', 'Choose a valid activity page.');
    res.json(await activity.list((res.locals.principal as Principal).workspaceId, query.data.page));
  });
  router.get('/activity/:id', async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) throw new HttpError(404, 'ACTIVITY_NOT_FOUND', 'Activity record not found.');
    res.json(await activity.detail((res.locals.principal as Principal).workspaceId, req.params.id as string));
  });
  router.get('/reversals/allocations/:id', async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) throw new HttpError(404, 'ALLOCATION_NOT_FOUND', 'Allocation not found.');
    res.json(await reversals.preview((res.locals.principal as Principal).workspaceId, req.params.id as string));
  });
  router.post('/reversals', async (req, res) => {
    const input = reversalSchema.safeParse(req.body);
    if (!input.success) throw new HttpError(400, 'INVALID_REVERSAL', 'Explicitly confirm an allocation reversal with a reason of 1–1000 characters and a confirmation identifier.');
    res.json(await reversals.reverse(res.locals.principal as Principal, input.data));
  });
  return router;
}
