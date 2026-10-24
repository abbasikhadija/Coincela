import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from './auth';
import { Button, Panel } from './components';
import { displayPence, Pagination } from './ImportCenter';
import { AllocationForm } from './AllocationForm';
interface Payment {
  id: string; transaction_date: string; description: string; amount_pence: string; unallocated_pence: string;
  payer_name: string | null; payment_reference: string | null; requires_duplicate_review: boolean;
  reviewState?: string;
}
interface Candidate {
  id: string; suggestedPence: string; category: string; evidence: string[]; warnings: string[]; explanation: string; reviewStatus: string;
  invoice: { id: string; invoice_number: string; customer_name: string; total_pence: string; outstanding_pence: string; issue_date: string; due_date: string };
}
interface Detail {
  payment: Payment; state: 'current' | 'stale' | 'not_generated';
  result: { id: string; outcome: string; explanation: string; warnings: string[]; candidates: Candidate[]; createdAt: string } | null;
}
const labels: Record<string, string> = { exact_reference: 'Exact reference match', strong: 'Strong candidate', possible: 'Possible candidate', ambiguous: 'Ambiguous', no_match: 'No match' };
export function ReviewPayments() {
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const selected = params.get('payment') ?? '';
  const current = useRef(selected); current.current = selected;
  const [page, setPage] = useState(1);
  const [list, setList] = useState<{ payments: Payment[]; hasMore: boolean }>({ payments: [], hasMore: false });
  const [loadingList, setLoadingList] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listError, setListError] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [visible, setVisible] = useState(5);
  const [allocation, setAllocation] = useState<{ paymentId: string; seed?: Candidate } | null>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true; setLoadingList(true); setListError('');
    void auth.request<{ payments: Payment[]; hasMore: boolean }>(`/matching/payments?page=${page}`)
      .then(value => { if (active) setList(value); }).catch(error => { if (active) setListError(error.message); })
      .finally(() => { if (active) setLoadingList(false); });
    return () => { active = false; };
  }, [page, retry]);
  useEffect(() => {
    let active = true; setDetail(null); setError(''); setVisible(5);
    if (!selected) { setLoadingDetail(false); return; }
    setLoadingDetail(true);
    void auth.request<Detail>(`/matching/payments/${selected}`).then(value => { if (active) setDetail(value); })
      .catch(error => { if (active) setError(error.message); }).finally(() => { if (active) { setLoadingDetail(false); detailHeading.current?.focus(); } });
    return () => { active = false; };
  }, [selected, retry]);
  async function action(suggestionId?: string) {
    setBusy(true); setError('');
    const id = selected;
    try {
      if (suggestionId) await auth.request(`/matching/suggestions/${suggestionId}/reject`, { method: 'POST' });
      const value = await auth.request<Detail>(`/matching/payments/${id}`, suggestionId ? undefined : { method: 'POST' });
      if (current.current === id) { setDetail(value); const reviewState = value.result ? value.result.candidates.length > 0 && value.result.candidates.every(candidate => candidate.reviewStatus === 'rejected') ? 'rejected' : value.result.outcome : value.state; setList(previous => ({ ...previous, payments: previous.payments.map(payment => payment.id === id ? { ...payment, reviewState } : payment) })); }
    } catch (error) {
      if (current.current === id) { setError(error instanceof Error ? error.message : 'Could not review this payment. Please try again.'); setDetail(null); }
    } finally { setBusy(false); }
  }
  const activeDetail = detail?.payment.id === selected ? detail : null;
  useEffect(() => { setAllocation(null); }, [selected]);
  return <><p className="eyebrow">Inspect the evidence</p><h1>Review Payments</h1><p className="lead">Review one payment at a time. Suggestions never allocate money.</p>
    <div className={`review-workspace ${selected ? 'has-selection' : ''}`}>
      <section className="payment-list" aria-label="Incoming payments"><h2>Incoming payments</h2>
        {listError ? <p role="alert">{listError} <Button onClick={() => setRetry(value => value + 1)}>Retry payments</Button></p> : loadingList ? <p role="status">Loading payments…</p> : !list.payments.length ? <p>No payments imported yet. <Link className="text-link" to="/import">Import payments</Link> to begin.</p> : <ul>{list.payments.map(payment => <li key={payment.id}><button className="payment-choice" disabled={busy} aria-current={selected === payment.id ? 'true' : undefined} onClick={() => setParams({ payment: payment.id })}><strong>{payment.payer_name || payment.description}</strong><span className="amount">{displayPence(payment.unallocated_pence)}</span><span>{payment.transaction_date}</span><span>{payment.reviewState === 'stale' ? 'Out of date · regenerate' : payment.reviewState === 'rejected' ? 'Suggestions rejected' : labels[payment.reviewState ?? ''] ?? 'Not yet checked'}</span><span>{BigInt(payment.unallocated_pence) === 0n ? 'Fully allocated' : payment.requires_duplicate_review ? 'Possible duplicate · needs review' : 'Needs review'}</span></button></li>)}</ul>}
        <Pagination page={page} hasMore={list.hasMore} busy={loadingList || busy} change={setPage} />
      </section>
      <section className="payment-detail" aria-label="Selected payment">
        {!selected ? <Panel><h2>Select an incoming payment</h2><p>Inspect the reference, customer evidence and invoice balances before deciding whether a suggestion is useful.</p></Panel> : <><Button className="secondary mobile-back" disabled={busy} onClick={() => setParams({})}>Back to payments</Button><h2 ref={detailHeading} tabIndex={-1}>Selected payment</h2>
          {error && <p role="alert" className="form-error">{error} <Button className="secondary" onClick={() => setRetry(value => value + 1)}>Refresh payment</Button></p>}
          {loadingDetail ? <p role="status">Loading payment details…</p> : activeDetail && <div hidden={!!allocation}>
            <dl className="financial-details"><dt>Payer</dt><dd>{activeDetail.payment.payer_name || 'Not supplied'}</dd><dt>Payment amount</dt><dd className="amount">{displayPence(activeDetail.payment.amount_pence)}</dd><dt>Unallocated</dt><dd className="amount">{displayPence(activeDetail.payment.unallocated_pence)}</dd><dt>Date</dt><dd>{activeDetail.payment.transaction_date}</dd><dt>Reference</dt><dd>{activeDetail.payment.payment_reference || 'Not supplied'}</dd><dt>Description</dt><dd>{activeDetail.payment.description}</dd></dl>
            <p><Link className="text-link" to={`/transactions/${selected}`}>View payment and allocation history</Link></p><Button className="secondary refresh-payment" disabled={busy} onClick={() => setRetry(value => value + 1)}>Refresh payment</Button>
            {!allocation && <Button className="secondary" onClick={() => setAllocation({ paymentId: selected })}>Choose invoices to allocate</Button>}
            <div className="suggestion-state" role="status">{activeDetail.state === 'stale' ? 'These suggestions are out of date. Financial records have changed. Regenerate before reviewing.' : activeDetail.state === 'not_generated' ? 'No suggestions generated yet.' : 'Suggestions only — generating them does not allocate money.'}</div>
            <Button disabled={busy} onClick={() => void action()}>{busy ? 'Please wait…' : activeDetail.state === 'stale' ? 'Regenerate suggestions' : activeDetail.state === 'current' ? 'Check suggestions again' : 'Generate suggestions'}</Button>
            {activeDetail.result && !allocation && <div className="suggestions"><h3>{labels[activeDetail.result.outcome]}</h3><p>{activeDetail.result.explanation}</p><Warnings warnings={activeDetail.result.warnings} />
              {activeDetail.result.candidates.slice(0, visible).map(candidate => <article className="candidate" key={candidate.id}><span className="badge">{labels[candidate.category]} · {candidate.reviewStatus === 'rejected' ? 'Rejected suggestion' : 'Unconfirmed suggestion'}</span><h3>{candidate.invoice.invoice_number} · {candidate.invoice.customer_name}</h3><dl className="financial-details"><dt>Invoice total</dt><dd className="amount">{displayPence(candidate.invoice.total_pence)}</dd><dt>Outstanding balance</dt><dd className="amount">{displayPence(candidate.invoice.outstanding_pence)}</dd><dt>Suggested allocation</dt><dd className="amount">{displayPence(candidate.suggestedPence)}</dd><dt>Invoice dates</dt><dd>{candidate.invoice.issue_date} → {candidate.invoice.due_date}</dd></dl><p>{candidate.explanation}</p><h4>Supporting evidence</h4><ul className="evidence">{candidate.evidence.map(text => <li key={text}>{text}</li>)}</ul><Warnings warnings={candidate.warnings} />
                {candidate.reviewStatus === 'pending' && <><Button className="secondary" disabled={busy || !!allocation} onClick={() => setAllocation({ paymentId: selected, seed: candidate })}>Review allocation for {candidate.invoice.invoice_number}</Button><Button className="secondary" disabled={busy || !!allocation} onClick={() => void action(candidate.id)}>Reject suggestion for {candidate.invoice.invoice_number}</Button></>}
              </article>)}
              {activeDetail.result.candidates.length > visible && <Button className="secondary" onClick={() => setVisible(value => value + 5)}>Show more candidates ({activeDetail.result.candidates.length - visible} remaining)</Button>}
              <p className="footnote">Rejecting a suggestion changes review status only. Allocations require a separate review and explicit confirmation.</p>
            </div>}
          </div>}
        </>}
        {allocation && allocation.paymentId === selected && <AllocationForm key={allocation.paymentId} paymentId={allocation.paymentId} seed={allocation.seed} close={() => setAllocation(null)} completed={() => setRetry(value => value + 1)} />}
      </section>
    </div></>;
}
function Warnings({ warnings }: { warnings: string[] }) {
  return warnings.length ? <div className="financial-warnings"><h4>Check before deciding</h4><ul>{warnings.map(text => <li key={text}>{text}</li>)}</ul></div> : null;
}
