import type { Invoice, Payment } from '../src/matching/engine.js';
export interface Truth { invoiceNumbers: string[]; ambiguous: boolean; scenario: string }
const money = (pence: bigint) => `${pence / 100n}.${(pence % 100n).toString().padStart(2, '0')}`;
const csv = (rows: string[][]) => Buffer.from(rows.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n') + '\n');
// Ground truth is assigned by scenario before matching runs; no matcher is imported.
export function dataset(size: number) {
  if (![100, 1000, 10000].includes(size)) throw Error('Choose 100, 1000 or 10000 records');
  const invoices: Invoice[] = []; const payments: Payment[] = []; const truth: Truth[] = [];
  const reference = (i: number) => `BENCH-${i.toString().padStart(6, '0')}`;
  for (let i = 0; i < size; i++) {
    const amount = BigInt(1000000 + (i % 10 === 7 ? i - 1 : i) * 100);
    invoices.push({ id: `invoice-${i}`, invoice_number: reference(i), customer_name: `Synthetic customer ${i}`, issue_date: '2026-10-01', due_date: '2026-10-31', total_pence: amount.toString(), outstanding_pence: amount.toString(), currency: 'GBP' });
  }
  for (let i = 0; i < size; i++) {
    const base = i - i % 10; const scenario = i % 10; const original = BigInt(invoices[i]!.total_pence);
    let amount = original; let paymentReference: string | null = reference(i); let payer: string | null = null;
    let expected = [reference(i)]; let ambiguous = false; let label = 'exact'; let description = `Synthetic transfer ${i}`;
    if (scenario === 1) { paymentReference = null; payer = invoices[i]!.customer_name; label = 'missing_reference'; }
    if (scenario === 2) { paymentReference = 'INCORRECT'; payer = invoices[i]!.customer_name; label = 'incorrect_reference'; }
    if (scenario === 3) { amount = original / 2n; label = 'partial'; }
    if (scenario === 4) { amount = original + BigInt(invoices[i + 1]!.total_pence); paymentReference = `${reference(i)} ${reference(i + 1)}`; expected = [reference(i), reference(i + 1)]; ambiguous = true; label = 'split'; }
    if (scenario === 5 || scenario === 9) { amount = scenario === 5 ? 17n : 29n; paymentReference = null; expected = []; label = 'unmatched'; }
    if (scenario === 6 || scenario === 7) { amount = BigInt(invoices[base + 6]!.total_pence); paymentReference = null; expected = [reference(base + 6), reference(base + 7)]; ambiguous = true; label = scenario === 6 ? 'ambiguous' : 'legitimate_duplicate_candidate'; description = `Identical visible transfer ${base}`; }
    payments.push({ id: `payment-${i}`, transaction_date: '2026-10-10', description, amount_pence: amount.toString(), unallocated_pence: amount.toString(), currency: 'GBP', payment_reference: paymentReference, payer_name: payer, requires_duplicate_review: scenario === 6 || scenario === 7 });
    truth.push({ invoiceNumbers: expected, ambiguous, scenario: label });
  }
  return { invoices, payments, truth,
    invoiceCsv: (start: number, count: number) => csv([['invoice_number', 'customer_name', 'issue_date', 'due_date', 'currency', 'total_amount'], ...invoices.slice(start, start + count).map(i => [i.invoice_number, i.customer_name, i.issue_date, i.due_date, i.currency, money(BigInt(i.total_pence))])]),
    paymentCsv: (start: number, count: number) => csv([['transaction_date', 'description', 'amount', 'currency', 'external_transaction_id', 'payment_reference', 'payer_name'], ...payments.slice(start, start + count).map(p => [p.transaction_date, p.description, money(BigInt(p.amount_pence)), p.currency, `external-${p.id}`, p.payment_reference ?? '', p.payer_name ?? ''])]),
  };
}
