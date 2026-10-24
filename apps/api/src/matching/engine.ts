export const ENGINE_VERSION = 'rules-2';
export interface Invoice {
  id: string; invoice_number: string; customer_name: string; issue_date: string; due_date: string;
  total_pence: string; outstanding_pence: string; currency: string;
}
export interface Payment {
  id: string; transaction_date: string; description: string; amount_pence: string; unallocated_pence: string;
  payment_reference: string | null; payer_name: string | null; requires_duplicate_review: boolean; currency: string;
}
export type Category = 'exact_reference' | 'strong' | 'possible' | 'ambiguous' | 'no_match';
export interface Candidate {
  invoice: Invoice; suggestedPence: string; category: Exclude<Category, 'no_match'>;
  evidence: string[]; warnings: string[]; explanation: string;
}
export interface MatchResult { outcome: Category; explanation: string; warnings: string[]; candidates: Candidate[] }
function words(text: string): string { return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' '); }
function containsPhrase(text: string, phrase: string) { return phrase.length > 0 && ` ${words(text)} `.includes(` ${words(phrase)} `); }
function referenceIn(text: string, reference: string) {
  // Preserve punctuation: INV-1 must not match INV-10 or INV/1.
  const source = text.normalize('NFKC').toLowerCase();
  const ref = reference.normalize('NFKC').toLowerCase().trim();
  let start = source.indexOf(ref);
  while (ref && start !== -1) {
    const before = source[start - 1] ?? ''; const after = source[start + ref.length] ?? '';
    if ((!before || !/[-_/\p{L}\p{N}]/u.test(before)) && (!after || !/[-_/\p{L}\p{N}]/u.test(after))) return true;
    start = source.indexOf(ref, start + 1);
  }
  return false;
}
export function matchPayment(payment: Payment, invoices: readonly Invoice[]): MatchResult {
  const available = BigInt(payment.unallocated_pence);
  if (available < 0n || available > BigInt(payment.amount_pence) || invoices.some(invoice => BigInt(invoice.outstanding_pence) < 0n || BigInt(invoice.outstanding_pence) > BigInt(invoice.total_pence))) throw Error('Invalid derived financial balance');
  const warnings = payment.requires_duplicate_review ? ['This payment may be a duplicate. Check its bank record before making any financial decision.'] : [];
  if (available === 0n) return { outcome: 'no_match', explanation: 'This payment has no unallocated amount.', warnings, candidates: [] };
  const referenced = invoices.filter(invoice => referenceIn(payment.payment_reference ?? '', invoice.invoice_number) || referenceIn(payment.description, invoice.invoice_number));
  const eligible = invoices.filter(invoice => invoice.currency === payment.currency && BigInt(invoice.outstanding_pence) > 0n);
  const exact = eligible.filter(invoice => referenced.some(ref => ref.id === invoice.id));
  if (referenced.length && !exact.length) return { outcome: 'no_match', explanation: 'The referenced invoice has no outstanding balance or uses a different currency.', warnings, candidates: [] };
  if (payment.payment_reference && !referenced.length) warnings.push('The payment reference did not identify an imported invoice. Check the reference.');
  const candidates: (Candidate & { rank: number })[] = [];
  for (const invoice of exact.length ? exact : eligible) {
    const outstanding = BigInt(invoice.outstanding_pence);
    const reference = exact.some(candidate => candidate.id === invoice.id);
    const namedPayer = !!payment.payer_name && words(payment.payer_name) === words(invoice.customer_name);
    const describedCustomer = containsPhrase(payment.description, invoice.customer_name) && words(invoice.customer_name).length >= 3;
    const name = namedPayer || describedCustomer;
    const amount = available === outstanding;
    if (!reference && !name && !amount) continue;
    const evidence: string[] = [];
    const candidateWarnings: string[] = [];
    if (reference) evidence.push(`The payment contains invoice reference ${invoice.invoice_number}.`);
    if (namedPayer) evidence.push('The payer name matches the invoice customer.');
    else if (describedCustomer) evidence.push('The payment description contains the invoice customer name.');
    if (amount) evidence.push('The unallocated payment equals the invoice outstanding balance.');
    if (available < outstanding) { evidence.push('The payment could cover part of the outstanding balance.'); candidateWarnings.push('This would be a partial payment; an invoice balance would remain.'); }
    if (available > outstanding) candidateWarnings.push('The payment exceeds this invoice balance. The excess would remain unallocated.');
    if (!reference && !name) candidateWarnings.push('Amount alone is weak evidence. Verify the customer and reference.');
    if (payment.transaction_date < invoice.issue_date) candidateWarnings.push('The payment predates the invoice issue date. Verify that it belongs to this invoice.');
    else if (payment.transaction_date > invoice.due_date) evidence.push('The payment arrived after the invoice due date.');
    else evidence.push('The payment date falls between the invoice issue and due dates.');
    if (reference && payment.payer_name && !namedPayer) candidateWarnings.push('The payer name differs from the invoice customer. Verify who paid.');
    const category = reference ? 'exact_reference' : name && amount && payment.transaction_date >= invoice.issue_date ? 'strong' : 'possible';
    candidates.push({ invoice, suggestedPence: (available < outstanding ? available : outstanding).toString(), category,
      evidence, warnings: candidateWarnings, explanation: reference ? 'An exact invoice reference identifies this candidate. Review the amounts and any warnings.' : name && amount ? 'Customer evidence and the remaining amount support this candidate.' : name ? 'Customer evidence supports a possible partial or excess payment.' : 'Only the amount supports this candidate; more evidence is needed.',
      rank: reference ? 0 : name && amount ? 1 : name ? 2 : 3 });
  }
  candidates.sort((a, b) => a.rank - b.rank || a.invoice.id.localeCompare(b.invoice.id));
  const ambiguous = candidates.length > 1;
  const clean = candidates.map(({ rank: _rank, ...candidate }) => ({ ...candidate, category: ambiguous ? 'ambiguous' as const : candidate.category }));
  return { outcome: ambiguous ? 'ambiguous' : clean[0]?.category ?? 'no_match',
    explanation: ambiguous ? 'Several invoices could match this payment. Check the evidence and choose carefully; these candidates are unconfirmed.' : clean.length ? 'A candidate was found. This is a suggestion, not a confirmed allocation.' : 'No supported candidate was found. Unmatched payments are valid; check your imports and references.',
    warnings, candidates: clean };
}
