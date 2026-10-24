import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from './auth';
import { Button } from './components';
import { displayPence, Pagination } from './ImportCenter';
interface Detail {
  record: { id: string; invoice_number?: string; customer_name?: string; issue_date?: string; due_date?: string; total_pence?: string; outstanding_pence?: string; transaction_date?: string; amount_pence?: string; unallocated_pence?: string; description?: string; payer_name?: string | null; payment_reference?: string | null; requires_duplicate_review?: boolean };
  accountName?: string; hasMore: boolean;
  allocations: { id: string; operationId: string; paymentId: string; invoiceId: string; invoiceNumber: string; customerName: string; description: string; amountPence: string; createdAt: string; reversalId: string | null; reversalOperationId: string | null; reason: string | null }[];
}
export function RecordDetails({ kind }: { kind: 'invoices' | 'transactions' }) {
  const { id } = useParams(); const auth = useAuth(); const [data, setData] = useState<Detail | null>(null); const [page, setPage] = useState(1); const [retry, setRetry] = useState(0); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; setLoading(true); setError(''); void auth.request<Detail>(`/${kind}/${id}?page=${page}`).then(value => { if (active) setData(value); }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [kind, id, page, retry]);
  useEffect(() => { setPage(1); }, [id]);
  const invoice = kind === 'invoices'; const row = data && data.record.id === id ? data.record : undefined;
  const balance = row ? BigInt(invoice ? row.outstanding_pence! : row.unallocated_pence!) : 0n; const total = row ? BigInt(invoice ? row.total_pence! : row.amount_pence!) : 0n;
  const status = invoice ? balance === 0n ? 'Paid' : balance === total ? 'Unpaid' : 'Part paid' : balance === 0n ? 'Fully allocated' : balance === total ? 'Unallocated' : 'Partly allocated';
  return <><p className="eyebrow">{invoice ? 'Invoice record' : 'Incoming payment record'}</p><h1>{invoice ? 'Invoice details' : 'Payment details'}</h1><p><Link className="text-link" to={invoice ? '/invoices' : '/transactions'}>{invoice ? 'Back to invoices' : 'Back to incoming payments'}</Link></p>
    {error ? <p role="alert">{error} <Button onClick={() => setRetry(value => value + 1)}>Retry record</Button></p> : loading ? <p role="status">Loading record…</p> : row && data && <>
      <h2>{invoice ? `${row.invoice_number} · ${row.customer_name}` : row.description}</h2><span className="badge">{status}</span><dl className="financial-details">{invoice ? <><dt>Issue date</dt><dd>{row.issue_date}</dd><dt>Due date</dt><dd>{row.due_date}</dd><dt>Invoice total</dt><dd>{displayPence(row.total_pence!)}</dd><dt>Outstanding balance</dt><dd>{displayPence(row.outstanding_pence!)}</dd></> : <><dt>Bank account</dt><dd>{data.accountName}</dd><dt>Date</dt><dd>{row.transaction_date}</dd><dt>Payer</dt><dd>{row.payer_name || 'Not supplied'}</dd><dt>Reference</dt><dd>{row.payment_reference || 'Not supplied'}</dd><dt>Payment amount</dt><dd>{displayPence(row.amount_pence!)}</dd><dt>Unallocated amount</dt><dd>{displayPence(row.unallocated_pence!)}</dd></>}</dl>
      {row.requires_duplicate_review && <p className="financial-warnings">Possible duplicate: check the bank record before allocating this payment.</p>}
      {!invoice && <p><Link className="button" to={`/review?payment=${row.id}`}>Review this payment</Link></p>}
      <p>Balances are derived from active allocations and rechecked on refresh. Reversed allocations remain in history.</p><Button className="secondary" onClick={() => setRetry(value => value + 1)}>Refresh record</Button>
      <section><h2>Allocation history</h2>{!data.allocations.length ? <p>No allocations yet. {invoice ? <Link className="text-link" to="/review">Review incoming payments</Link> : 'Review this payment to choose invoices and explicitly confirm an allocation.'}</p> : <ul className="record-history">{data.allocations.map(allocation => <li key={allocation.id}><strong>{displayPence(allocation.amountPence)} · {allocation.reversalId ? 'Reversed' : 'Active'}</strong><p><Link className="text-link" to={invoice ? `/transactions/${allocation.paymentId}` : `/invoices/${allocation.invoiceId}`}>{invoice ? allocation.description : `${allocation.invoiceNumber} · ${allocation.customerName}`}</Link> · <time dateTime={allocation.createdAt}>{new Date(allocation.createdAt).toLocaleString()}</time></p>{allocation.reason && <p>Reversal reason: {allocation.reason}</p>}<Link className="text-link" to={`/activity?operation=${allocation.operationId}`}>View allocation and audit history</Link>{allocation.reversalOperationId && <p><Link className="text-link" to={`/activity?operation=${allocation.reversalOperationId}`}>View reversal event</Link></p>}</li>)}</ul>}<Pagination page={page} hasMore={data.hasMore} busy={loading} change={setPage} /></section>
    </>}
  </>;
}
