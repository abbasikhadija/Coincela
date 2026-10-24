import { randomUUID, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { cpus, platform, release } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runner } from 'node-pg-migrate';
import { createPool } from '../src/db.js';
import { ImportService } from '../src/imports/service.js';
import { MatchingService } from '../src/matching/service.js';
import { matchPayment, ENGINE_VERSION } from '../src/matching/engine.js';
import { dataset } from './dataset.js';
if (!process.env.TEST_DATABASE_URL) throw Error('TEST_DATABASE_URL is required; use a disposable benchmark database.');
const sizes = (process.env.BENCH_SIZES ?? '100,1000,10000').split(',').map(Number);
const admin = createPool(process.env.TEST_DATABASE_URL);
const results: object[] = [];
const metadata = { timestamp: new Date().toISOString(), node: process.version, platform: `${platform()} ${release()}`, cpu: cpus()[0]?.model, engine: ENGINE_VERSION, postgres: (await admin.query('SHOW server_version')).rows[0].server_version };
const output = resolve('../../docs/benchmark-results.json');
try {
  for (const size of sizes) {
    const data = dataset(size); const schema = `bench_${randomUUID().replaceAll('-', '')}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('options', `-c search_path=${schema}`); const pool = createPool(url.toString());
    try {
      const client = await pool.connect();
      try { await runner({ dbClient: client, schema, migrationsSchema: schema, migrationsTable: 'pgmigrations', dir: resolve('migrations'), direction: 'up', log: () => {}, lockValue: Number.parseInt(schema.slice(-12), 16) }); } finally { client.release(); }
      const owner = (await pool.query("INSERT INTO users(email,password_hash) VALUES ('synthetic-benchmark@example.test','fixture-not-a-login') RETURNING id")).rows[0].id;
      const workspace = (await pool.query("INSERT INTO workspaces(owner_user_id,name) VALUES ($1,'Synthetic benchmark') RETURNING id", [owner])).rows[0].id;
      const bank = (await pool.query("INSERT INTO bank_accounts(workspace_id,name) VALUES ($1,'Synthetic bank') RETURNING id", [workspace])).rows[0].id;
      const imports = new ImportService(pool); let invoiceMs = 0; let paymentMs = 0;
      for (let start = 0; start < size; start += 1000) {
        const count = Math.min(1000, size - start); let time = performance.now();
        const invoices = await imports.import(workspace, 'invoices', data.invoiceCsv(start, count), null); invoiceMs += performance.now() - time;
        if (invoices.insertedCount !== count || invoices.status !== 'completed') throw Error('Invoice benchmark import failed');
        time = performance.now(); const payments = await imports.import(workspace, 'transactions', data.paymentCsv(start, count), bank); paymentMs += performance.now() - time;
        if (payments.insertedCount !== count || payments.status !== 'completed') throw Error('Payment benchmark import failed');
      }
      const repeatedFile = await imports.import(workspace, 'transactions', data.paymentCsv(0, Math.min(1000, size)), bank);
      const identityRepeat = await imports.import(workspace, 'transactions', Buffer.concat([Buffer.from('\uFEFF'), data.paymentCsv(0, Math.min(1000, size))]), bank);
      const duplicateFlags = (await pool.query('SELECT count(*)::int AS count FROM bank_transactions WHERE requires_duplicate_review')).rows[0].count;
      if (!repeatedFile.repeatedFile || identityRepeat.insertedCount !== 0 || identityRepeat.duplicateCount !== Math.min(1000, size) || duplicateFlags !== size / 5) throw Error('Duplicate behavior changed');
      const matching = new MatchingService(pool); const persisted = (await pool.query('SELECT id FROM bank_transactions ORDER BY external_transaction_id LIMIT 10')).rows;
      const serviceStart = performance.now();
      for (const row of persisted) await matching.detail(workspace, row.id, true);
      const persistedSampleMs = performance.now() - serviceStart;
      let tp = 0; let fp = 0; let fn = 0; let ambiguousDetected = 0; let ambiguousExpected = 0; let falseAmbiguous = 0;
      const start = performance.now();
      for (let i = 0; i < size; i++) {
        const actual = matchPayment(data.payments[i]!, data.invoices); const expected = data.truth[i]!;
        const predicted = actual.candidates.map(candidate => candidate.invoice.invoice_number);
        tp += predicted.filter(number => expected.invoiceNumbers.includes(number)).length; fp += predicted.filter(number => !expected.invoiceNumbers.includes(number)).length; fn += expected.invoiceNumbers.filter(number => !predicted.includes(number)).length;
        if (expected.ambiguous) { ambiguousExpected++; if (actual.outcome === 'ambiguous') ambiguousDetected++; } else if (actual.outcome === 'ambiguous') falseAmbiguous++;
        if ((i + 1) % 500 === 0) console.log(`Benchmark ${size}: ${i + 1} payments evaluated`);
        if (performance.now() - start > 600000) throw Error('Matching benchmark exceeded ten-minute bound');
      }
      const coreMatchingMs = performance.now() - start;
      const financialRows = (await pool.query('SELECT (SELECT count(*)::int FROM payment_allocations) AS allocations,(SELECT count(*)::int FROM audit_events) AS audits')).rows[0];
      if (financialRows.allocations !== 0 || financialRows.audits !== 0) throw Error('Matching created financial effects');
      const checksum = createHash('sha256').update(data.invoiceCsv(0, size)).update(data.paymentCsv(0, size)).update(JSON.stringify(data.truth)).digest('hex');
      const result = { size, checksum, invoiceImportMs: Math.round(invoiceMs), paymentImportMs: Math.round(paymentMs), coreMatchingMs: Math.round(coreMatchingMs), persistedSampleCount: persisted.length, persistedSampleMs: Math.round(persistedSampleMs), truePositivePairs: tp, falsePositivePairs: fp, falseNegativePairs: fn, candidatePrecision: tp / (tp + fp), candidateRecall: tp / (tp + fn), ambiguousExpected, ambiguousDetected, falseAmbiguous, repeatedFileSkipped: repeatedFile.duplicateCount, repeatedIdentitySkipped: identityRepeat.duplicateCount, legitimateDuplicateFlags: duplicateFlags, financialRows };
      results.push(result); console.log(JSON.stringify(result));
      await mkdir(resolve('../../docs'), { recursive: true }); await writeFile(output, JSON.stringify({ metadata, results }, null, 2) + '\n');
    } finally { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
  }
} finally { await admin.end(); }
