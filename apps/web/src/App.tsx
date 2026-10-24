import { useEffect, useState } from 'react';
import { HashRouter, Link, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { apiBase, checkApi } from './api';
import { Button, Panel } from './components';
import { AuthProvider, useAuth } from './auth';
import { AuthPage, WorkspaceSettings } from './AuthPages';
import { ImportCenter, RecordList } from './ImportCenter';
import { ReviewPayments } from './ReviewPayments';
const sections = [['/', 'Overview'], ['/import', 'Import'], ['/review', 'Review Payments'], ['/invoices', 'Invoices'], ['/activity', 'Activity']] as const;
export function Connectivity() {
  const [status, setStatus] = useState('Checking API connection…');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const base = apiBase();
    if (!base) { setStatus('API connection is not configured.'); return; }
    const controller = new AbortController();
    let active = true;
    setStatus('Checking API connection…');
    const timer = setTimeout(() => controller.abort(), 5000);
    void checkApi(base, controller.signal).then(() => { if (active) setStatus('API connected'); })
      .catch(() => { if (active) setStatus('API unavailable. Please try again.'); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [attempt]);
  return <div className="connectivity"><p role="status">{status}</p>{status.startsWith('API unavailable') && <Button className="secondary" onClick={() => setAttempt(value => value + 1)}>Retry connection</Button>}</div>;
}
function Overview() {
  const { session } = useAuth();
  return <><p className="eyebrow">{session!.workspace.name}</p><h1>Overview</h1><p className="lead">A clear place to account for every payment.</p><Panel><span className="badge">Workspace ready</span><h2>Welcome to your workspace</h2><p>Start by importing your invoices, then add incoming payments. Review explainable suggestions after importing. Allocations will be available in a later release.</p><Link className="button" to="/import">Import your invoices</Link></Panel><p className="footnote">You’ll always review and confirm an allocation before it changes a balance.</p></>;
}
function Placeholder({ name }: { name: string }) {
  return <><p className="eyebrow">Workspace foundation</p><h1>{name}</h1><Panel><h2>This workspace is coming later</h2><p>{name} is not available in this foundation preview.</p><Link className="text-link" to="/">Back to overview</Link></Panel></>;
}
export function App() {
  return <HashRouter><AuthProvider><a className="skip-link" href="#main" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a><div className="shell"><header><Link className="brand" to="/">Coincela<span>Every payment accounted for.</span></Link><Connectivity /></header><Routes><Route path="/login" element={<PublicLayout><AuthPage key="login" mode="login" /></PublicLayout>} /><Route path="/register" element={<PublicLayout><AuthPage key="register" mode="register" /></PublicLayout>} /><Route element={<PrivateLayout />}><Route path="/" element={<Overview />} /><Route path="/import" element={<ImportCenter />} /><Route path="/invoices" element={<RecordList key="invoices" kind="invoices" />} /><Route path="/transactions" element={<RecordList key="transactions" kind="transactions" />} /><Route path="/review" element={<ReviewPayments />} />{sections.filter(([path]) => path === '/activity').map(([path, name]) => <Route key={path} path={path} element={<Placeholder name={name} />} />)}<Route path="/settings" element={<WorkspaceSettings />} /><Route path="*" element={<><h1>Page not found</h1><Link className="text-link" to="/">Back to overview</Link></>} /></Route></Routes><footer>Coincela · Account and workspace foundation</footer></div></AuthProvider></HashRouter>;
}
function PublicLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  return <main id="main" className="public-main" tabIndex={-1}>{loading ? <p role="status">Restoring your session…</p> : children}</main>;
}
function PrivateLayout() {
  const auth = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (auth.loading) return <main id="main" tabIndex={-1}><p role="status">Restoring your session…</p></main>;
  if (!auth.session) return <Navigate to="/login" replace />;
  return <div className="workspace"><nav aria-label="Main navigation">{sections.map(([path, name]) => <NavLink key={path} to={path} end={path === '/'}>{name}</NavLink>)}<div className="account-nav"><NavLink to="/settings">Workspace settings</NavLink><Button className="secondary" disabled={busy} onClick={() => {
    setBusy(true); setError(''); void auth.logout().catch(error => setError(error instanceof Error ? error.message : 'Sign out failed. Please try again.')).finally(() => setBusy(false));
  }}>{busy ? 'Signing out…' : 'Sign out'}</Button>{error && <p className="form-error" role="alert">{error}</p>}</div></nav><main id="main" tabIndex={-1}><Outlet /></main></div>;
}
