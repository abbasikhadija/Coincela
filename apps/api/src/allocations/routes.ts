import { Router } from 'express';
import { z } from 'zod';
import type pg from 'pg';
import type { Principal } from '../auth/repository.js';
import { HttpError } from '../errors.js';
import { allocationSchema } from './validation.js';
import { AllocationService } from './service.js';
export function allocationRoutes(pool: pg.Pool) {
  const router = Router(); const service = new AllocationService(pool);
  router.get('/allocations/payments/:id', async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Payment not found.');
    const query = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), search: z.string().max(100).default('').refine(value => !value.includes('\0')) }).strict().safeParse(req.query);
    if (!query.success) throw new HttpError(400, 'INVALID_QUERY', 'Choose a valid invoice page or search term.');
    res.json(await service.options((res.locals.principal as Principal).workspaceId, req.params.id as string, query.data.page, query.data.search));
  });
  router.post('/allocations', async (req, res) => {
    const input = allocationSchema.safeParse(req.body);
    if (!input.success) throw new HttpError(400, 'INVALID_ALLOCATION', 'Explicitly confirm 1–50 different invoices with positive string pence amounts within the supported range and a confirmation identifier.');
    res.json(await service.allocate(res.locals.principal as Principal, input.data));
  });
  return router;
}
