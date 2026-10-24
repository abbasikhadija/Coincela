import express, { Router } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import type { Principal } from '../auth/repository.js';
import { HttpError } from '../errors.js';
import { ImportService } from './service.js';
import { MAX_UPLOAD_BYTES } from './parser.js';
export function importRoutes(pool: pg.Pool) {
  const router = Router();
  const service = new ImportService(pool);
  router.get('/bank-accounts', async (_req, res) => {
    const { workspaceId } = res.locals.principal as Principal;
    res.json({ accounts: (await pool.query('SELECT id,name,currency FROM bank_accounts WHERE workspace_id=$1 ORDER BY name,id', [workspaceId])).rows });
  });
  router.post('/bank-accounts', async (req, res) => {
    const { workspaceId } = res.locals.principal as Principal;
    const input = z.object({ name: z.string().trim().min(1).max(100) }).strict().safeParse(req.body);
    if (!input.success || input.data.name.includes('\0')) throw new HttpError(400, 'INVALID_INPUT', 'Enter a bank account name of 1–100 characters.');
    const account = (await pool.query('INSERT INTO bank_accounts(workspace_id,name) VALUES ($1,$2) ON CONFLICT (workspace_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id,name,currency', [workspaceId, input.data.name])).rows[0];
    res.status(201).json({ account });
  });
  router.post('/imports/:kind', express.raw({ type: 'text/csv', limit: MAX_UPLOAD_BYTES }), async (req, res) => {
    const { workspaceId } = res.locals.principal as Principal;
    if (req.params.kind !== 'invoices' && req.params.kind !== 'transactions') throw new HttpError(400, 'INVALID_KIND', 'Choose invoices or payments.');
    if (!Buffer.isBuffer(req.body)) throw new HttpError(415, 'CSV_REQUIRED', 'Upload a UTF-8 CSV file with Content-Type text/csv.');
    const bankId = req.get('X-Bank-Account-Id') ?? null;
    if (req.params.kind === 'transactions' && !z.string().uuid().safeParse(bankId).success) throw new HttpError(400, 'BANK_ACCOUNT_REQUIRED', 'Choose a bank account before importing payments.');
    const result = await service.import(workspaceId, req.params.kind, req.body, req.params.kind === 'transactions' ? bankId : null);
    res.status(result.status === 'rejected' ? 422 : result.repeatedFile ? 200 : 201).json(result);
  });
  const pagination = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict();
  for (const resource of ['imports', 'invoices', 'transactions'] as const) router.get(`/${resource}`, async (req, res) => {
    const { workspaceId } = res.locals.principal as Principal;
    const query = pagination.safeParse(req.query);
    if (!query.success) throw new HttpError(400, 'INVALID_PAGE', 'Choose a valid page number.');
    const selects = {
      imports: 'SELECT id,kind,status,row_count,inserted_count,duplicate_count,created_at FROM import_batches',
      invoices: 'SELECT id,invoice_number,customer_name,issue_date::text,due_date::text,currency,total_pence::text FROM invoices',
      transactions: 'SELECT id,bank_account_id,transaction_date::text,description,amount_pence::text,currency,payment_reference,payer_name,requires_duplicate_review FROM bank_transactions',
    };
    const results = await pool.query(`${selects[resource]} WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET $2`, [workspaceId, (query.data.page - 1) * 50]);
    res.json({ records: results.rows.slice(0, 50), hasMore: results.rows.length > 50, page: query.data.page });
  });
  router.get('/imports/:id/errors', async (req, res) => {
    const { workspaceId } = res.locals.principal as Principal;
    if (!z.string().uuid().safeParse(req.params.id).success) throw new HttpError(404, 'NOT_FOUND', 'Import not found.');
    if (!(await pool.query('SELECT id FROM import_batches WHERE workspace_id=$1 AND id=$2', [workspaceId, req.params.id])).rowCount) throw new HttpError(404, 'NOT_FOUND', 'Import not found.');
    const results = await pool.query('SELECT row_number AS row,field,message FROM import_errors WHERE workspace_id=$1 AND batch_id=$2 ORDER BY row_number NULLS FIRST,field', [workspaceId, req.params.id]);
    res.json({ errors: results.rows });
  });
  return router;
}
