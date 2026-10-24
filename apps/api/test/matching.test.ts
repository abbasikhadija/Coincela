import { expect, it } from 'vitest';
import fixture from './fixtures/matching.json' with { type: 'json' };
import { matchPayment, type Payment } from '../src/matching/engine.js';
const base: Payment = { id: 'payment', transaction_date: '2026-10-10', description: 'Bank transfer', amount_pence: '10000', unallocated_pence: '10000', payment_reference: null, payer_name: null, requires_duplicate_review: false, currency: 'GBP' };
it.each(fixture.cases)('$name', scenario => {
  const payment = { ...base, ...scenario.payment };
  const invoices = fixture.invoices.filter(invoice => scenario.invoiceIds.includes(invoice.id));
  const before = JSON.stringify({ payment, invoices });
  const actual = matchPayment(payment, invoices);
  expect(actual.outcome).toBe(scenario.outcome);
  expect(actual.candidates.map(candidate => candidate.invoice.id)).toEqual(scenario.candidateIds);
  expect(actual.candidates.map(candidate => candidate.suggestedPence)).toEqual(scenario.amounts);
  expect(actual.candidates.every(candidate => candidate.evidence.length > 0 && candidate.explanation.length > 0)).toBe(true);
  expect(JSON.stringify({ payment, invoices })).toBe(before);
  expect(matchPayment(payment, [...invoices].reverse())).toEqual(actual);
});
it('explains partial/excess, name conflict, duplicate and date warnings', () => {
  const invoice = fixture.invoices[0]!;
  const result = matchPayment({ ...base, payment_reference: 'INV-100', payer_name: 'Wrong Payer', requires_duplicate_review: true, transaction_date: '2026-09-20', amount_pence: '15000', unallocated_pence: '15000' }, [invoice]);
  expect(result.warnings.join(' ')).toContain('duplicate');
  expect(result.candidates[0]?.warnings.join(' ')).toMatch(/exceeds.*predates.*differs/);
  expect(result.candidates[0]?.suggestedPence).toBe('10000');
  const partial = matchPayment({ ...base, payer_name: 'Amber Studio', unallocated_pence: '5000' }, [invoice]);
  expect(partial.candidates[0]?.warnings.join()).toContain('partial');
});
it('does not make a pre-invoice payment a strong candidate and reports late dates', () => {
  expect(matchPayment({ ...base, payer_name: 'Amber Studio', transaction_date: '2026-09-01' }, [fixture.invoices[0]!]).outcome).toBe('possible');
  expect(matchPayment({ ...base, payer_name: 'Amber Studio', transaction_date: '2026-11-01' }, [fixture.invoices[0]!]).candidates[0]?.evidence.join()).toContain('after the invoice due date');
});
it('preserves exact pence beyond Number safety and refuses inconsistent balances', () => {
  const invoice = { ...fixture.invoices[0]!, total_pence: '9007199254740993', outstanding_pence: '9007199254740993' };
  const result = matchPayment({ ...base, amount_pence: invoice.total_pence, unallocated_pence: invoice.total_pence, payment_reference: 'INV-100' }, [invoice]);
  expect(result.candidates[0]?.suggestedPence).toBe('9007199254740993');
  expect(() => matchPayment({ ...base, unallocated_pence: '-1' }, [invoice])).toThrow('Invalid derived');
  expect(() => matchPayment(base, [{ ...invoice, outstanding_pence: '9007199254740994' }])).toThrow('Invalid derived');
});
