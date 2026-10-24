import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './auth';
import { Button, Panel } from './components';
import { displayPence } from './ImportCenter';
import { eventLabel, type AuditEvent } from './Activity';
interface Summary { invoiceCount: number; paymentCount: number; outstandingPence: string; paymentsToReview: number; unallocatedPence: string; next: string; recent: AuditEvent[] }
const actions: Record<string, { to: string; label: string; explanation: string }> = {
  import_invoices: { to: '/import', label: 'Import your invoices', explanation: 'Start with your invoice CSV. You can download synthetic samples before uploading your own records.' },
  import_payments: { to: '/import?kind=transactions', label: 'Import incoming payments', explanation: 'Your invoices are ready. Add incoming transfers from a named bank account next.' },
  review: { to: '/review', label: 'Review payments', explanation: 'These payments still have an unallocated amount. Inspect suggestions or choose invoices, then explicitly confirm.' },
  invoices: { to: '/invoices', label: 'Review outstanding invoices', explanation: 'All imported payments are fully allocated, but some invoice balances remain due. Check your invoices or import more incoming payments.' },
  activity: { to: '/activity', label: 'View reconciliation history', explanation: 'Your imported payments are allocated and invoice balances are cleared. Inspect history or import new records when ready.' },
};
export function Overview() {
  const auth = useAuth(); const [data, setData] = useState<Summary | null>(null); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; setError(''); void auth.request<Summary>('/overview').then(value => { if (active) setData(value); }).catch(error => { if (active) setError(error.message); }); return () => { active = false; }; }, [retry]);
  const action = data ? actions[data.next] : null;
  return <><p className="eyebrow">{auth.session?.workspace.name}</p><h1>Overview</h1><p className="lead">See what needs attention and take the next step.</p>
    {error ? <p role="alert">{error} <Button className="secondary" onClick={() => setRetry(value => value + 1)}>Retry overview</Button></p> : !data ? <p>Loading workspace summary…</p> : <>
      <Panel><h2>{data.invoiceCount === 0 && data.paymentCount === 0 ? 'Welcome to your workspace' : 'Your next step'}</h2>{action && <><p>{action.explanation}</p><Link className="button" to={action.to}>{action.label}</Link></>}
        <ol className="onboarding" aria-label="Reconciliation steps"><li>{data.invoiceCount > 0 ? 'Invoices imported' : 'Import invoices'}</li><li>{data.paymentCount > 0 ? 'Payments imported' : 'Import payments'}</li><li>Review suggestions</li><li>Confirm allocations</li><li>Inspect balances and history</li></ol>
      </Panel>
      {(data.invoiceCount > 0 || data.paymentCount > 0) && <section aria-label="Current balances"><h2>What needs attention</h2><dl className="overview-balances"><div><dt>Outstanding invoice balance</dt><dd className="amount">{displayPence(data.outstandingPence)}</dd></div><div><dt>Payments requiring review</dt><dd>{data.paymentsToReview}</dd></div></dl><p>Review means an unallocated amount remains; it is not a matching confidence score.</p><p><Link className="text-link" to="/invoices">Inspect invoices</Link> · <Link className="text-link" to="/transactions">Inspect incoming payments</Link></p></section>}
      {data.recent?.length > 0 && <section aria-label="Recent activity"><h2>Recent activity</h2><ul>{data.recent.map(event => <li key={event.id}><Link className="text-link" to={`/activity?operation=${event.operationId}`}>{eventLabel(event)} · {displayPence(event.amountPence)}</Link> · <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></li>)}</ul><Link className="text-link" to="/activity">View all activity</Link></section>}
      <p className="footnote">Suggestions never allocate money. Confirmation changes balances; a reasoned reversal preserves the original history.</p>
    </>}
  </>;
}
