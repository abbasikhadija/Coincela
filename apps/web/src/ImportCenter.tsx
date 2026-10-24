import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, useAuth } from './auth';
import { Button, Field, Panel } from './components';
interface RowError { row: number | null; field: string | null; message: string }
interface ImportResult { batchId: string; status: string; rowCount: number; insertedCount: number; duplicateCount: number; reviewCount: number; repeatedFile: boolean; errors: RowError[] }
interface Account { id: string; name: string }
export interface PageResult { records: Record<string, string | number | boolean>[]; hasMore: boolean; page: number }
export function ErrorRows({ errors }: { errors: RowError[] }) {
  return <ul className="import-errors">{errors.map((error, index) => <li key={index}>{error.row ? `Row ${error.row}` : 'File'}{error.field ? ` · ${error.field}` : ''}: {error.message}</li>)}</ul>;
}
export function ImportCenter() {
  const auth = useAuth();
  const [kind, setKind] = useState<'invoices' | 'transactions'>('invoices');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankId, setBankId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [historyErrors, setHistoryErrors] = useState<RowError[]>([]);
  const [history, setHistory] = useState<PageResult>({ records: [], page: 1, hasMore: false });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([auth.request<{ accounts: Account[] }>('/bank-accounts'), auth.request<PageResult>(`/imports?page=${page}`)])
      .then(([banks, batches]) => { if (active) { setAccounts(banks.accounts); setHistory(batches); } })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Could not load imports.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // request reads the current token; revision explicitly reloads after changes.
  }, [revision, page]);
  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const name = String(new FormData(event.currentTarget).get('bankName'));
    try {
      const response = await auth.request<{ account: Account }>('/bank-accounts', { method: 'POST', body: JSON.stringify({ name }) });
      setBankId(response.account.id); setRevision(value => value + 1);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save the bank account.'); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setResult(null); setHistoryErrors([]);
    if (!file) { setError('Choose a CSV file.'); return; }
    if (file.size > 1024 * 1024) { setError('The file exceeds 1 MiB. Split it into smaller files.'); return; }
    if (!file.size) { setError('The file is empty. Choose a CSV with data rows.'); return; }
    setBusy(true);
    try {
      const response = await auth.request<ImportResult>(`/imports/${kind}`, { method: 'POST', body: file,
        headers: { 'Content-Type': 'text/csv', ...(kind === 'transactions' ? { 'X-Bank-Account-Id': bankId } : {}) } });
      setResult(response);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) setResult(error.body as ImportResult);
      else setError(error instanceof Error ? error.message : 'Import failed. Please try again.');
    } finally { setBusy(false); setPage(1); setRevision(value => value + 1); }
  }
  return <><p className="eyebrow">Bring your records together</p><h1>Import</h1><p className="lead">Start with invoices, then add your incoming payments.</p>
    {error && <p role="alert" className="form-error">{error} <Button className="secondary" onClick={() => { setError(''); setRevision(value => value + 1); }}>Reload imports</Button></p>}
    <Panel><h2>Import your records</h2><p>UTF-8 CSV · up to 1 MiB and 1,000 rows. We validate the entire file before inserting any records. Use GBP amounts and YYYY-MM-DD dates.</p>
      <div className="field"><label htmlFor="import-kind">What are you importing?</label><select id="import-kind" value={kind} disabled={busy} onChange={event => { setKind(event.target.value as typeof kind); setResult(null); setError(''); }}><option value="invoices">Invoices</option><option value="transactions">Incoming payments</option></select></div>
      <p><a className="text-link" href={`${import.meta.env.BASE_URL}samples/${kind}.csv`} download>Download sample {kind === 'invoices' ? 'invoices' : 'payments'} CSV</a></p>
      {kind === 'transactions' && <><div className="field"><label htmlFor="bank-account">Bank account</label><select id="bank-account" value={bankId} onChange={event => setBankId(event.target.value)} disabled={busy} required><option value="">Choose a bank account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div><details><summary>Add a named bank account</summary><form onSubmit={createAccount}><Field id="bank-name" name="bankName" label="Bank account name" required maxLength={100} /><Button disabled={busy}>Save bank account</Button></form></details><p className="field-help">Only positive incoming payments are supported. Identical-looking transfers are retained and marked for review.</p></>}
      <form onSubmit={submit} aria-busy={busy}><Field id="csv-file" type="file" accept=".csv,text/csv" label="CSV file" required disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); setResult(null); }} /><Button disabled={busy || (kind === 'transactions' && !bankId)}>{busy ? 'Importing…' : kind === 'invoices' ? 'Import invoices' : 'Import payments'}</Button></form>
    </Panel>
    {result && <section className="panel import-result" aria-live="polite"><h2>{result.status === 'rejected' ? 'Correct your file and try again' : result.repeatedFile ? 'This file was already imported' : 'Import complete'}</h2><p>{result.insertedCount} inserted · {result.duplicateCount} duplicates skipped · {result.rowCount} rows checked.</p>
      {result.status === 'rejected' ? <><p>No financial records from this file were inserted.</p><ErrorRows errors={result.errors} /></> : <>{result.reviewCount > 0 && <p>{result.reviewCount} incoming payments need duplicate review. They were retained because identical visible fields do not prove duplication.</p>}{kind === 'invoices' ? <Button onClick={() => { setKind('transactions'); setResult(null); }}>Next: import payments</Button> : <><p>Next: inspect explainable matching suggestions. No money is allocated during review.</p><Link className="button" to="/review">Review payment suggestions</Link><p><Link className="text-link" to="/transactions">View imported payments</Link></p></>}</>}
    </section>}
    <section className="import-history"><h2>Import history</h2><p><Link className="text-link" to="/invoices">View invoices</Link> · <Link className="text-link" to="/transactions">View incoming payments</Link></p>{loading ? <p role="status">Loading imports…</p> : !history.records.length ? <p>No imports yet. Start with your invoice CSV above.</p> : <div className="table-scroll"><table><caption className="sr-only">Import batches</caption><thead><tr><th scope="col">Imported</th><th scope="col">Records</th><th scope="col">Outcome</th><th scope="col">Inserted / duplicates</th><th scope="col">Details</th></tr></thead><tbody>{history.records.map(batch => <tr key={String(batch.id)}><td>{new Date(String(batch.created_at)).toLocaleString()}</td><td>{batch.kind === 'invoices' ? 'Invoices' : 'Payments'}</td><td>{batch.status === 'completed' ? 'Completed' : 'Rejected'}</td><td>{String(batch.inserted_count)} / {String(batch.duplicate_count)}</td><td>{batch.status === 'rejected' && <Button className="secondary" onClick={() => { void auth.request<{ errors: RowError[] }>(`/imports/${batch.id}/errors`).then(response => setHistoryErrors(response.errors)).catch(error => setError(error.message)); }}>View errors</Button>}</td></tr>)}</tbody></table></div>}
      <Pagination page={page} hasMore={history.hasMore} busy={loading} change={setPage} />{historyErrors.length > 0 && <div role="status"><h3>Import errors</h3><ErrorRows errors={historyErrors} /></div>}
    </section><Link className="text-link" to="/">Back to overview</Link></>;
}
export function Pagination({ page, hasMore, busy, change }: { page: number; hasMore: boolean; busy: boolean; change: (page: number) => void }) {
  return <div className="pagination"><Button className="secondary" disabled={page === 1 || busy} onClick={() => change(page - 1)}>Previous page</Button><span>Page {page}</span><Button className="secondary" disabled={!hasMore || busy} onClick={() => change(page + 1)}>Next page</Button></div>;
}
export function displayPence(value: string): string { const pence = BigInt(value); return `£${pence / 100n}.${(pence % 100n).toString().padStart(2, '0')}`; }
export function RecordList({ kind }: { kind: 'invoices' | 'transactions' }) {
  const auth = useAuth();
  const [data, setData] = useState<PageResult>({ records: [], page: 1, hasMore: false });
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    void auth.request<PageResult>(`/${kind}?page=${page}`).then(response => { if (active) setData(response); }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, page, retry]);
  return <><p className="eyebrow">Imported records</p><h1>{kind === 'invoices' ? 'Invoices' : 'Incoming payments'}</h1><p className="lead">{kind === 'invoices' ? 'Your imported invoice records.' : 'Your incoming payments, ready for later review.'}</p><p><Link className="button" to="/import">Import records</Link></p>{error ? <p role="alert">{error} <Button onClick={() => setRetry(value => value + 1)}>Retry</Button></p> : loading ? <p role="status">Loading records…</p> : !data.records.length ? <p>No records yet. Import a CSV to get started.</p> : <div className="table-scroll"><table><caption className="sr-only">{kind === 'invoices' ? 'Invoice records' : 'Payment records'}</caption><thead><tr>{(kind === 'invoices' ? ['Invoice', 'Customer', 'Issue date', 'Due date', 'Total'] : ['Date', 'Description', 'Amount', 'Reference', 'Review']).map(name => <th key={name} scope="col">{name}</th>)}</tr></thead><tbody>{data.records.map(row => <tr key={String(row.id)}>{kind === 'invoices' ? <><td>{row.invoice_number}</td><td>{row.customer_name}</td><td>{row.issue_date}</td><td>{row.due_date}</td><td className="amount">{displayPence(String(row.total_pence))}</td></> : <><td>{row.transaction_date}</td><td>{row.description}</td><td className="amount">{displayPence(String(row.amount_pence))}</td><td>{row.payment_reference || '—'}</td><td>{row.requires_duplicate_review ? 'Possible duplicate — review required' : 'Not reviewed'}</td></>}</tr>)}</tbody></table></div>}<Pagination page={page} hasMore={data.hasMore} busy={loading} change={setPage} /><Link className="text-link" to="/">Back to overview</Link></>;
}
