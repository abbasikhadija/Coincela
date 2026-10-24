import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, useAuth } from './auth';
import { Button } from './components';
import { displayPence } from './ImportCenter';
interface Preview {
  allocation: { id: string; amount_pence: string; invoice_number: string; customer_name: string; reversal_id: string | null };
  payment: { description: string; payer_name: string | null; payment_reference: string | null; amount_pence: string; unallocated_pence: string };
  invoice: { total_pence: string; outstanding_pence: string };
}
interface ReversalReceipt { operationId: string; restoredPence: string; paymentUnallocatedPence: string; invoiceOutstandingPence: string; reason: string }
interface Pending { operationKey: string; allocationId: string; confirmed: true; reason: string }
export function ReversalForm({ allocationId, close, completed }: { allocationId: string; close: () => void; completed: () => void }) {
  const auth = useAuth(); const storageKey = `coincela.reversal.${auth.session?.workspace.id ?? ''}.${allocationId}`;
  const [pending, setPending] = useState<Pending | null>(() => { try { return JSON.parse(sessionStorage.getItem(storageKey) ?? 'null'); } catch { return null; } });
  const [data, setData] = useState<Preview | null>(null); const [reason, setReason] = useState(''); const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [retry, setRetry] = useState(0); const [receipt, setReceipt] = useState<ReversalReceipt | null>(null);
  const heading = useRef<HTMLHeadingElement>(null); useEffect(() => { heading.current?.focus(); }, [receipt]);
  useEffect(() => {
    let active = true; setError('');
    void auth.request<Preview>(`/reversals/allocations/${allocationId}`).then(value => { if (active) setData(value); }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [allocationId, retry]);
  const valid = !!data && !data.allocation.reversal_id && !!reason.trim() && reason.trim().length <= 1000;
  async function submit() {
    if (busy || (!pending && (!valid || !confirmed))) return;
    const input: Pending = pending ?? { operationKey: crypto.randomUUID(), allocationId, confirmed: true, reason: reason.trim() };
    setBusy(true); setError('');
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(input)); setPending(input);
      const result = await auth.request<ReversalReceipt>('/reversals', { method: 'POST', body: JSON.stringify(input) });
      sessionStorage.removeItem(storageKey); setPending(null); setReceipt(result); completed();
    } catch (error) {
      if (error instanceof ApiError && error.status < 500) { sessionStorage.removeItem(storageKey); setPending(null); setConfirmed(false); }
      setError(error instanceof Error ? error.message : 'Could not confirm. Retry the same reversal.');
    } finally { setBusy(false); }
  }
  return <section className="allocation-form" aria-label="Reverse allocation"><h3 ref={heading} tabIndex={-1}>{receipt ? 'Reversal confirmed' : 'Review allocation reversal'}</h3>
    {error && <p role="alert" className="form-error">{error} {!pending && <Button className="secondary" onClick={() => setRetry(value => value + 1)}>Refresh reversal details</Button>}</p>}
    {receipt ? <><p role="status">Restored {displayPence(receipt.restoredPence)} to the payment and invoice balances.</p><p>Payment unallocated at reversal: {displayPence(receipt.paymentUnallocatedPence)}. Invoice outstanding at reversal: {displayPence(receipt.invoiceOutstandingPence)}.</p><p>Reason: {receipt.reason}</p><p>The original allocation and audit records remain intact. These balances were recorded at confirmation and may change later.</p><Link className="text-link" to={`/activity?operation=${receipt.operationId}`}>View this reversal in Activity</Link><p><Button onClick={close}>Done</Button></p></> : pending ? <><p role="status">The outcome of this reversal needs checking. Retry the same confirmation safely, including after reload.</p><p>Reason: {pending.reason}</p><Button disabled={busy} onClick={() => void submit()}>{busy ? 'Checking reversal…' : 'Retry same reversal'}</Button><p>Keep this tab until the result is known.</p></> : !data ? <><p role="status">Loading reversal details…</p><Button className="secondary" onClick={close}>Cancel reversal</Button></> : data.allocation.reversal_id ? <><p>This allocation has already been reversed. Its original record is preserved.</p><Button className="secondary" onClick={close}>Back to activity</Button></> : <form onSubmit={event => { event.preventDefault(); void submit(); }} aria-busy={busy}>
      <p>{data.allocation.invoice_number} · {data.allocation.customer_name}</p><dl className="financial-details"><dt>Payment</dt><dd>{data.payment.description}</dd><dt>Payer</dt><dd>{data.payment.payer_name || 'Not supplied'}</dd><dt>Reference</dt><dd>{data.payment.payment_reference || 'Not supplied'}</dd><dt>Original payment</dt><dd>{displayPence(data.payment.amount_pence)}</dd><dt>Invoice total</dt><dd>{displayPence(data.invoice.total_pence)}</dd><dt>Allocation to reverse</dt><dd>{displayPence(data.allocation.amount_pence)}</dd></dl>
      <div className="financial-warnings"><h4>Financial consequences</h4><p>Payment currently unallocated: {displayPence(data.payment.unallocated_pence)}</p><p>Payment unallocated after reversal: {displayPence((BigInt(data.payment.unallocated_pence) + BigInt(data.allocation.amount_pence)).toString())}</p><p>Invoice currently outstanding: {displayPence(data.invoice.outstanding_pence)}</p><p>Invoice outstanding after reversal: {displayPence((BigInt(data.invoice.outstanding_pence) + BigInt(data.allocation.amount_pence)).toString())}</p><p>Only this allocation is reversed, in full. Other allocations in a split stay active. This records a correction; it does not refund or move money at your bank. The original allocation and reason remain in history. The server checks current balances again.</p></div>
      <label htmlFor="reversal-reason">Reason for reversal</label><textarea id="reversal-reason" rows={3} required maxLength={1000} disabled={busy} value={reason} aria-describedby="reversal-reason-help" onChange={event => { setReason(event.target.value); setConfirmed(false); }} /><p id="reversal-reason-help">Explain the correction in 1–1000 characters. This reason is retained in the audit history.</p>
      <label className="confirmation-check"><input type="checkbox" checked={confirmed} disabled={busy || !valid} onChange={event => setConfirmed(event.target.checked)} />I have reviewed the restored balances and confirm this reversal.</label><div className="allocation-actions"><Button type="submit" disabled={busy || !valid || !confirmed}>{busy ? 'Reversing…' : 'Confirm reversal'}</Button><Button type="button" className="secondary" disabled={busy} onClick={close}>Cancel reversal</Button></div>
    </form>}
  </section>;
}
