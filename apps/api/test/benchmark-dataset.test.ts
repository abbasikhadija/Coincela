import { expect, it } from 'vitest';
import { dataset } from '../benchmark/dataset.js';
import { parseUpload } from '../src/imports/parser.js';
it('generates reproducible independent truth with split, ambiguity, partial, duplicate and unmatched cases', () => {
  const data = dataset(100); expect(data.truth).toEqual(dataset(100).truth); expect(data.invoices).toHaveLength(100); expect(data.payments).toHaveLength(100);
  expect(data.truth[4]).toEqual({ invoiceNumbers: ['BENCH-000004', 'BENCH-000005'], ambiguous: true, scenario: 'split' });
  expect(data.truth[5]!.invoiceNumbers).toEqual([]); expect(data.truth[6]!.invoiceNumbers).toEqual(['BENCH-000006', 'BENCH-000007']);
  expect(data.payments[3]!.amount_pence).toBe('500150'); expect(data.truth.filter(row => row.ambiguous)).toHaveLength(30);
  expect(parseUpload(data.invoiceCsv(0, 100), 'invoices').errors).toEqual([]); expect(parseUpload(data.paymentCsv(0, 100), 'transactions').errors).toEqual([]);
});
