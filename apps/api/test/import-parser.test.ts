import { expect, it } from 'vitest';
import { parseUpload, validDate, MAX_UPLOAD_BYTES } from '../src/imports/parser.js';
const header = 'invoice_number,customer_name,issue_date,due_date,currency,total_amount\n';
it('parses BOM, quoted commas, escaped quotes and multiline fields', () => {
  const result = parseUpload(Buffer.from('\ufeff' + header + 'INV-1,"Example, ""Studio""\nLtd",2026-10-01,2026-10-31,GBP,90071992547409.93\n'), 'invoices');
  expect(result.errors).toEqual([]); expect(result.rows[0]).toMatchObject({ customer_name: 'Example, "Studio"\nLtd', total_pence: '9007199254740993' });
});
it.each(['2026-02-29', '2026-13-01', '2026-00-01', '2026-04-31', '01/10/2026', '0000-01-01'])('rejects invalid date %s', date => { expect(validDate(date)).toBe(false); });
it('accepts real leap days', () => { expect(validDate('2024-02-29')).toBe(true); });
it.each([
  '', header, 'bad,columns\n1,2', header + 'INV-1,"broken,2026-10-01',
  header + 'INV-1,Customer,2026-10-01,2026-10-31,GBP,1,extra',
  header + 'INV-1,Customer,2026-02-30,2026-10-31,GBP,1',
  header + 'INV-1,Customer,2026-10-10,2026-10-01,GBP,1',
  header + 'INV-1,Customer,2026-10-01,2026-10-31,USD,1',
  header + 'INV-1,Customer,2026-10-01,2026-10-31,GBP,-1',
  header + 'INV-1,Customer,2026-10-01,2026-10-31,GBP,1.001',
  header + 'INV-1,Customer,2026-10-01,2026-10-31,GBP,92233720368547758.08',
  'invoice_number,customer_name,issue_date,due_date,currency,currency,total_amount\nI,C,2026-01-01,2026-02-01,GBP,GBP,1',
])('reports invalid CSV without accepting it', csv => { expect(parseUpload(Buffer.from(csv), 'invoices').errors.length).toBeGreaterThan(0); });
it('rejects invalid encoding, nulls, file/row limits', () => {
  expect(parseUpload(Buffer.from([0xff]), 'invoices').errors.length).toBe(1);
  expect(parseUpload(Buffer.alloc(MAX_UPLOAD_BYTES + 1), 'invoices').errors[0]?.message).toContain('1 MiB');
  expect(parseUpload(Buffer.from(header + 'I,C,2026-01-01,2026-02-01,GBP,1\n'.repeat(1001)), 'invoices').errors[0]?.message).toContain('1,000');
  expect(parseUpload(Buffer.from(header + 'I,C\0,2026-01-01,2026-02-01,GBP,1'), 'invoices').errors.length).toBeGreaterThan(0);
});
it('allows zero invoices and rejects nonpositive payments', () => {
  expect(parseUpload(Buffer.from(header + 'I,C,2026-01-01,2026-02-01,GBP,0'), 'invoices').errors).toEqual([]);
  const txHeader = 'transaction_date,description,amount,currency\n';
  for (const amount of ['0', '-1']) expect(parseUpload(Buffer.from(txHeader + `2026-01-01,Payment,${amount},GBP`), 'transactions').errors.length).toBeGreaterThan(0);
});
