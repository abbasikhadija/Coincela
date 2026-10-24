import { useEffect, useRef, useState } from 'react';
import { ApiError, useAuth } from './auth';
import { Button } from './components';
import { displayPence, Pagination } from './ImportCenter';
export interface AllocationInvoice { id: string; invoice_number: string; customer_name: string; total_pence: string; outstanding_pence: string }
interface Payment { id: string; amount_pence: string; unallocated_pence: string; payer_name: string | null; payment_reference: string | null; description: string; requires_duplicate_review: boolean }
interface Row { invoice: AllocationInvoice; amount: string; suggestionId?: string }
interface Input { operationKey: string; paymentId: string; confirmed: true; allocations: { invoiceId: string; amountPence: string; suggestionId?: string }[] }
interface Pending { input: Input; summary: { invoice: string; customer: string; amountPence: string }[] }
interface Receipt { operationId: string; allocatedPence: string; remainingPence: string; allocations: { invoiceNumber: string; customerName: string; amountPence: string; remainingPence: string }[] }
function decimal(pence: string) { const n = BigInt(pence); return `${n / 100n}.${(n % 100n).toString().padStart(2, '0')}`; }
export function amountPence(value: string): bigint | null {
  if (!/^(0|[1-9]\d{0,16})(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.'); const result = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
  return result > 0n && result <= 9223372036854775807n ? result : null;
}
export function AllocationForm({ paymentId, seed, close, completed }: { paymentId: string; seed?: { invoice: AllocationInvoice; suggestedPence: string; id: string; warnings?: string[]; evidence?: string[]; category?: string }; close: () => void; completed: () => void }) {
  const auth = useAuth();
  const storageKey = `coincela.allocation.${auth.session?.workspace.id ?? ''}.${paymentId}`;
  const [pending, setPending] = useState<Pending | null>(() => { try { return JSON.parse(sessionStorage.getItem(storageKey) ?? 'null'); } catch { return null; } });
  const [rows, setRows] = useState<Row[]>(seed ? [{ invoice: seed.invoice, amount: decimal(seed.suggestedPence), suggestionId: seed.id }] : []);
  const [data, setData] = useState<{ payment: Payment; invoices: AllocationInvoice[]; hasMore: boolean } | null>(null);
  const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [term, setTerm] = useState('');
  const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null); const [retry, setRetry] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [receipt]);
  useEffect(() => {
    let active = true; setError('');
    void auth.request<NonNullable<typeof data>>(`/allocations/payments/${paymentId}?page=${page}&search=${encodeURIComponent(term)}`)
      .then(value => { if (active) { setData(value); setRows(previous => previous.map(row => ({ ...row, invoice: value.invoices.find(invoice => invoice.id === row.invoice.id) ?? row.invoice }))); } })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [paymentId, page, term, retry]);
  const amounts = rows.map(row => amountPence(row.amount));
  const total = amounts.reduce<bigint>((sum, amount) => sum + (amount ?? 0n), 0n);
  const valid = data && rows.length > 0 && amounts.every((amount, index) => amount !== null && amount <= BigInt(rows[index]!.invoice.outstanding_pence)) && total <= BigInt(data.payment.unallocated_pence);
  function edit(next: Row[]) { setRows(next); setConfirmed(false); }
  async function submit() {
    if (!pending && (!valid || !confirmed)) return;
    const attempt: Pending = pending ?? { input: { operationKey: crypto.randomUUID(), paymentId, confirmed: true, allocations: rows.map((row, index) => ({ invoiceId: row.invoice.id, amountPence: amounts[index]!.toString(), ...(row.suggestionId ? { suggestionId: row.suggestionId } : {}) })) }, summary: rows.map((row, index) => ({ invoice: row.invoice.invoice_number, customer: row.invoice.customer_name, amountPence: amounts[index]!.toString() })) };
    setBusy(true); setError('');
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(attempt)); setPending(attempt);
      const result = await auth.request<Receipt>('/allocations', { method: 'POST', body: JSON.stringify(attempt.input) });
      sessionStorage.removeItem(storageKey); setPending(null); setReceipt(result); completed();
    } catch (error) {
      // Unknown outcomes must retain the exact confirmed payload/key, including after reload.
      if (error instanceof ApiError && error.status < 500) { sessionStorage.removeItem(storageKey); setPending(null); setConfirmed(false); }
      setError(error instanceof Error ? error.message : 'Could not confirm. Retry the same confirmation.');
    } finally { setBusy(false); }
  }
  if (receipt) return <section className="allocation-form" aria-label="Allocation result"><h3 ref={heading} tabIndex={-1}>Allocation confirmed</h3><p role="status">Allocated {displayPence(receipt.allocatedPence)}. Payment remaining: {displayPence(receipt.remainingPence)}.</p><p>These balances were recorded at confirmation. Refresh the payment to see any later changes.</p><ul>{receipt.allocations.map(row => <li key={row.invoiceNumber}>{row.invoiceNumber} · {row.customerName}: {displayPence(row.amountPence)} allocated; invoice remaining {displayPence(row.remainingPence)}.</li>)}</ul><p className="footnote">Confirmation record: {receipt.operationId}. Corrections will require a reasoned reversal in a later release.</p><Button onClick={close}>Done</Button></section>;
  return <section className="allocation-form" aria-label="Allocate payment"><h3 ref={heading} tabIndex={-1}>Allocate this payment</h3><p>Choose invoices and review the financial consequences. Nothing changes until you explicitly confirm.</p>
    {error && <p role="alert" className="form-error">{error} {!pending && <Button className="secondary" onClick={() => setRetry(value => value + 1)}>Refresh allocation balances</Button>}</p>}
    {pending ? <><p role="status">The outcome of your previous confirmation needs checking. Retry the same confirmation to retrieve its result safely; it cannot allocate twice.</p><ul>{pending.summary.map(row => <li key={row.invoice}>{row.invoice} · {row.customer}: {displayPence(row.amountPence)}</li>)}</ul><Button disabled={busy} onClick={() => void submit()}>{busy ? 'Checking confirmation…' : 'Retry same confirmation'}</Button><p>Keep this confirmation until its result is known.</p></> : !data ? <><p role="status">Loading current balances…</p><Button className="secondary" onClick={close}>Cancel allocation</Button></> : <>
      <dl className="financial-details"><dt>Payment amount</dt><dd>{displayPence(data.payment.amount_pence)}</dd><dt>Available payment</dt><dd>{displayPence(data.payment.unallocated_pence)}</dd><dt>Payer</dt><dd>{data.payment.payer_name || 'Not supplied'}</dd><dt>Reference</dt><dd>{data.payment.payment_reference || 'Not supplied'}</dd><dt>Description</dt><dd>{data.payment.description}</dd></dl>
      {data.payment.requires_duplicate_review && <p className="financial-warnings">Possible duplicate: check the bank record before confirming.</p>}
      {seed && <div className="financial-warnings"><h4>{seed.category === 'ambiguous' ? 'Ambiguous suggestion — verify the chosen invoice' : 'Suggestion evidence — verify before confirming'}</h4><ul>{[...(seed.evidence ?? []), ...(seed.warnings ?? [])].map(text => <li key={text}>{text}</li>)}</ul></div>}
      <form onSubmit={event => { event.preventDefault(); setPage(1); setTerm(search); }}><label htmlFor="invoice-search">Find invoice or customer</label><input id="invoice-search" maxLength={100} value={search} disabled={busy} onChange={event => setSearch(event.target.value)} /><Button className="secondary" disabled={busy}>Search invoices</Button></form>
      <ul className="invoice-choices">{data.invoices.map(invoice => <li key={invoice.id}>{invoice.invoice_number} · {invoice.customer_name} · outstanding {displayPence(invoice.outstanding_pence)} <Button className="secondary" disabled={busy || BigInt(invoice.outstanding_pence) === 0n || rows.some(row => row.invoice.id === invoice.id) || rows.length >= 50} onClick={() => edit([...rows, { invoice, amount: '' }])}>Add {invoice.invoice_number}</Button></li>)}</ul>
      {!data.invoices.length && <p>No invoices found. Import invoices or change your search.</p>}<Pagination page={page} hasMore={data.hasMore} busy={busy} change={setPage} />
      {rows.map((row, index) => <div className="allocation-row" key={row.invoice.id}><h4>{row.invoice.invoice_number} · {row.invoice.customer_name}</h4><p>Invoice total {displayPence(row.invoice.total_pence)} · outstanding {displayPence(row.invoice.outstanding_pence)}</p><label htmlFor={`allocation-${row.invoice.id}`}>Amount for {row.invoice.invoice_number} (GBP)</label><input id={`allocation-${row.invoice.id}`} inputMode="decimal" value={row.amount} disabled={busy} aria-invalid={!!row.amount && (amounts[index] === null || amounts[index]! > BigInt(row.invoice.outstanding_pence))} onChange={event => edit(rows.map((item, at) => at === index ? { ...item, amount: event.target.value } : item))} /><p>Invoice remaining after confirmation: {amounts[index] !== null && amounts[index]! <= BigInt(row.invoice.outstanding_pence) ? displayPence((BigInt(row.invoice.outstanding_pence) - amounts[index]!).toString()) : 'Enter a positive amount within the outstanding balance.'}</p><Button className="secondary" disabled={busy} onClick={() => edit(rows.filter((_, at) => at !== index))}>Remove {row.invoice.invoice_number}</Button></div>)}
      <div className="financial-warnings"><h4>Before you confirm</h4><p>Total to allocate: {displayPence(total.toString())}</p><p>Payment remaining after confirmation: {total <= BigInt(data.payment.unallocated_pence) ? displayPence((BigInt(data.payment.unallocated_pence) - total).toString()) : 'Allocation exceeds available payment.'}</p><p>Any invoice balance shown above remains due. Excess payment remains unallocated. Check the customer, reference and any suggestion warnings. The server checks current balances again.</p><p>Corrections require a reversal; the reversal workflow is not available in this release.</p></div>
      <label className="confirmation-check"><input type="checkbox" checked={confirmed} disabled={busy || !valid} onChange={event => setConfirmed(event.target.checked)} />I have reviewed these invoices and amounts and confirm this allocation.</label>
      <div className="allocation-actions"><Button disabled={busy || !valid || !confirmed} onClick={() => void submit()}>{busy ? 'Confirming…' : 'Confirm allocation'}</Button><Button className="secondary" disabled={busy} onClick={close}>Cancel allocation</Button></div>
    </>}
  </section>;
}
