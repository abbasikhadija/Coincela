import { parse } from 'csv-parse/sync';
import { TextDecoder } from 'node:util';
import { parseMoney } from '../money.js';
export const MAX_UPLOAD_BYTES = 1024 * 1024;
export const MAX_ROWS = 1000;
export type ImportKind = 'invoices' | 'transactions';
export interface RowError { row: number | null; field: string | null; message: string }
export interface InvoiceRow { invoice_number: string; customer_name: string; issue_date: string; due_date: string; currency: 'GBP'; total_pence: string }
export interface PaymentRow { transaction_date: string; description: string; amount_pence: string; currency: 'GBP'; external_transaction_id: string | null; payment_reference: string | null; payer_name: string | null }
export type ParsedRow = InvoiceRow | PaymentRow;
const headers = {
  invoices: ['invoice_number', 'customer_name', 'issue_date', 'due_date', 'currency', 'total_amount'],
  transactions: ['transaction_date', 'description', 'amount', 'currency'],
};
const optional = ['external_transaction_id', 'payment_reference', 'payer_name'];
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function parseUpload(buffer: Buffer, kind: ImportKind): { rows: ParsedRow[]; errors: RowError[]; rowCount: number; rowLines: number[] } {
  const errors: RowError[] = [];
  const fail = (message: string) => ({ rows: [], errors: [{ row: null, field: null, message }], rowCount: 0, rowLines: [] });
  if (!buffer.length) return fail('The file is empty. Choose a CSV file with a header and data rows.');
  if (buffer.length > MAX_UPLOAD_BYTES) return fail('The file exceeds 1 MiB. Split it into smaller files.');
  const records: string[][] = [];
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    // Input bytes and per-record size bound synchronous parsing memory.
    const parser = parse(text, { bom: true, skip_empty_lines: true, max_record_size: 16000, info: true }) as unknown as { record: string[]; info: { lines: number } }[];
    const lines: number[] = [];
    for (const entry of parser) {
      records.push(entry.record); lines.push(entry.info.lines);
      if (records.length > MAX_ROWS + 1) return fail('The file exceeds 1,000 data rows. Split it into smaller files.');
    }
    const columns = records.shift()?.map(value => value.trim());
    lines.shift();
    if (!columns || !columns.length) return fail('Add a CSV header and at least one data row.');
    const permitted = [...headers[kind], ...(kind === 'transactions' ? optional : [])];
    if (new Set(columns).size !== columns.length || columns.some(column => !permitted.includes(column)) || headers[kind].some(column => !columns.includes(column))) {
      return fail(`Use the documented columns: ${headers[kind].join(', ')}${kind === 'transactions' ? `. Optional: ${optional.join(', ')}` : ''}. Headers must be unique.`);
    }
    if (!records.length) return fail('Add at least one data row below the header.');
    const rows: ParsedRow[] = [];
    records.forEach((record, index) => {
      const row = lines[index] ?? index + 2;
      const values = Object.fromEntries(columns.map((column, columnIndex) => [column, record[columnIndex]?.trim() ?? '']));
      const add = (field: string, message: string) => errors.push({ row, field, message });
      const requiredText = kind === 'invoices' ? ['invoice_number', 'customer_name'] : ['description'];
      for (const field of requiredText) if (!values[field] || values[field]!.length > 500 || values[field]!.includes('\0')) add(field, 'Enter a value of 1–500 characters without null characters.');
      for (const field of optional) if (values[field] && (values[field]!.length > 500 || values[field]!.includes('\0'))) add(field, 'Use at most 500 characters without null characters.');
      const dates = kind === 'invoices' ? ['issue_date', 'due_date'] : ['transaction_date'];
      for (const field of dates) if (!validDate(values[field] ?? '')) add(field, 'Use a real date in YYYY-MM-DD format.');
      if (kind === 'invoices' && validDate(values.issue_date ?? '') && validDate(values.due_date ?? '') && values.due_date! < values.issue_date!) add('due_date', 'The due date cannot be before the issue date.');
      let amount = '0';
      const amountField = kind === 'invoices' ? 'total_amount' : 'amount';
      try { amount = parseMoney(values[amountField] ?? '', values.currency, kind === 'transactions').toString(); }
      catch { add(amountField, 'Use a valid GBP amount with at most two decimals, within the supported range. Payments must be positive; invoice totals cannot be negative.'); }
      if (values.currency !== 'GBP') add('currency', 'Only GBP is supported.');
      if (kind === 'invoices') rows.push({ invoice_number: values.invoice_number!, customer_name: values.customer_name!, issue_date: values.issue_date!, due_date: values.due_date!, currency: 'GBP', total_pence: amount });
      else rows.push({ transaction_date: values.transaction_date!, description: values.description!, currency: 'GBP', amount_pence: amount, external_transaction_id: values.external_transaction_id || null, payment_reference: values.payment_reference || null, payer_name: values.payer_name || null });
    });
    return { rows, errors, rowCount: records.length, rowLines: lines };
  } catch { return fail('The CSV could not be read. Check quoting, consistent column counts, UTF-8 encoding and fields under 16,000 characters.'); }
}
