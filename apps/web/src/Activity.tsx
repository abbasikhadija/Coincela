import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from './auth';
import { Button } from './components';
import { displayPence, Pagination } from './ImportCenter';
import { ReversalForm } from './ReversalForm';
export interface AuditEvent {
  id: string; operationId: string; eventType: string; createdAt: string; actorEmail: string; amountPence: string;
  details?: { reason?: string; originalOperationId?: string };
}
export interface HistoryAllocation {
  id: string; operation_id: string; bank_transaction_id: string; invoice_id: string; amount_pence: string; created_at: string;
  invoice_number: string; customer_name: string; reversal_id: string | null; reversal_operation_id: string | null; reversal_reason: string | null; reversed_at: string | null;
  invoice: { total_pence: string; outstanding_pence: string };
}
interface ActivityDetail {
  event: AuditEvent; payment: { id: string; description: string; amount_pence: string; unallocated_pence: string; payer_name: string | null; payment_reference: string | null } | null;
  allocations: HistoryAllocation[]; timeline: AuditEvent[];
}
export function eventLabel(event: AuditEvent) { return event.eventType === 'allocation_reversed' ? 'Allocation reversed' : event.eventType === 'payment_allocated' ? 'Payment allocated' : 'Recorded event'; }
export function Activity() {
  const auth = useAuth(); const [params, setParams] = useSearchParams(); const selected = params.get('operation') ?? '';
  const [page, setPage] = useState(1); const [revision, setRevision] = useState(0);
  const [list, setList] = useState<{ events: AuditEvent[]; hasMore: boolean }>({ events: [], hasMore: false });
  const [detail, setDetail] = useState<ActivityDetail | null>(null); const [loading, setLoading] = useState(true); const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState(''); const [error, setError] = useState(''); const [reversing, setReversing] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true; setLoading(true); setListError('');
    void auth.request<typeof list>(`/activity?page=${page}`).then(value => { if (active) setList(value); }).catch(error => { if (active) setListError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, revision]);
  useEffect(() => {
    let active = true; setDetail(null); setError(''); setDetailLoading(!!selected);
    if (selected) void auth.request<ActivityDetail>(`/activity/${selected}`).then(value => { if (active) setDetail(value); })
      .catch(error => { if (active) setError(error.message); }).finally(() => { if (active) { setDetailLoading(false); if (!reversing) heading.current?.focus(); } });
    return () => { active = false; };
  }, [selected, revision]);
  useEffect(() => { setReversing(null); }, [selected]);
  return <><p className="eyebrow">A record of every decision</p><h1>Activity</h1><p className="lead">Inspect allocations and their audit history. Correct a mistake with a reasoned reversal; original records stay intact.</p>
    <section aria-label="Activity history" hidden={!!reversing}><h2>Recent activity</h2>{listError ? <p role="alert">{listError} <Button onClick={() => setRevision(value => value + 1)}>Retry activity</Button></p> : loading ? <p role="status">Loading activity…</p> : !list.events.length ? <p>No financial activity yet. <Link className="text-link" to="/review">Review payments</Link> to confirm an allocation.</p> : <ol className="activity-list">{list.events.map(event => <li key={event.id}><button className="payment-choice" aria-current={selected === event.operationId ? 'true' : undefined} onClick={() => setParams({ operation: event.operationId })}><strong>{eventLabel(event)} · {displayPence(event.amountPence)}</strong><span><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time> · {event.actorEmail}</span></button></li>)}</ol>}<Pagination page={page} hasMore={list.hasMore} busy={loading} change={setPage} /></section>
    {!selected ? <p>Select an event to inspect its allocation details and related timeline.</p> : <section aria-label="Activity details"><h2 ref={heading} tabIndex={-1}>Selected activity</h2>{error && <p role="alert">{error} <Button onClick={() => setRevision(value => value + 1)}>Refresh activity</Button></p>}{detailLoading ? <p role="status">Loading allocation history…</p> : detail && <div hidden={!!reversing}>
      <h3>{eventLabel(detail.event)} · {displayPence(detail.event.amountPence)}</h3><p><time dateTime={detail.event.createdAt}>{new Date(detail.event.createdAt).toLocaleString()}</time> · {detail.event.actorEmail}</p><p className="footnote">Confirmation: {detail.event.operationId}. Audit amounts record the original decision. Balances below are current as of this refresh.</p>
      {detail.payment && <><dl className="financial-details"><dt>Payment</dt><dd>{detail.payment.description}</dd><dt>Payer</dt><dd>{detail.payment.payer_name || 'Not supplied'}</dd><dt>Reference</dt><dd>{detail.payment.payment_reference || 'Not supplied'}</dd><dt>Original payment</dt><dd>{displayPence(detail.payment.amount_pence)}</dd><dt>Currently unallocated</dt><dd>{displayPence(detail.payment.unallocated_pence)}</dd></dl><Link className="text-link" to={`/review?payment=${detail.payment.id}`}>Review this payment</Link></>}
      {detail.event.details?.originalOperationId && <p><Link className="text-link" to={`/activity?operation=${detail.event.details.originalOperationId}`}>View original allocation confirmation</Link></p>}
      {detail.allocations.map(row => <article className="candidate" key={row.id}><h3>{row.invoice_number} · {row.customer_name}</h3><span className="badge">{row.reversal_id ? 'Reversed allocation' : 'Active allocation'}</span><dl className="financial-details"><dt>Original allocation</dt><dd>{displayPence(row.amount_pence)}</dd><dt>Invoice total</dt><dd>{displayPence(row.invoice.total_pence)}</dd><dt>Current outstanding</dt><dd>{displayPence(row.invoice.outstanding_pence)}</dd></dl><p className="footnote">Allocation record: {row.id}</p>
        {row.reversal_id ? <><p>Reversal reason: {row.reversal_reason}</p><p>Reversed {new Date(row.reversed_at!).toLocaleString()}.</p><Link className="text-link" to={`/activity?operation=${row.reversal_operation_id}`}>View reversal event</Link><p><Button className="secondary" onClick={() => setReversing(row.id)}>Check reversal confirmation</Button></p></> : <Button className="secondary" onClick={() => setReversing(row.id)}>Review reversal for {row.invoice_number}</Button>}
      </article>)}
      <h3>Related audit timeline</h3><ol className="audit-timeline">{detail.timeline.map(event => <li key={event.id}><strong>{eventLabel(event)} · {displayPence(event.amountPence)}</strong><p><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time> · {event.actorEmail}</p>{event.details?.reason && <p>Reason: {event.details.reason}</p>}</li>)}</ol><Button className="secondary" onClick={() => setRevision(value => value + 1)}>Refresh activity</Button>
    </div>}
      {reversing && <ReversalForm key={reversing} allocationId={reversing} close={() => setReversing(null)} completed={() => setRevision(value => value + 1)} />}
    </section>}
  </>;
}
