import { useEffect, useRef, useState } from 'react';
import { HashRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { apiBase, checkApi } from './api';
import { Button } from './components';
import { AuthProvider, useAuth } from './auth';
import { AuthPage, WorkspaceSettings } from './AuthPages';
import { ImportCenter, RecordList } from './ImportCenter';
import { ReviewPayments } from './ReviewPayments';
import { Activity } from './Activity';
import { Overview } from './Overview';
import { Landing } from './Landing';
import { RecordDetails } from './RecordDetails';
const sections = [['/', 'Overview'], ['/import', 'Import'], ['/review', 'Review Payments'], ['/invoices', 'Invoices'], ['/activity', 'Activity']] as const;
function NavigationFocus() {
  const { pathname } = useLocation(); const previous = useRef(pathname);
  useEffect(() => { document.title = `Coincela · ${document.querySelector('h1')?.textContent ?? 'Every payment accounted for.'}`; if (previous.current !== pathname) document.getElementById('main')?.focus(); previous.current = pathname; }, [pathname]);
  return null;
}
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
function HomeLayout() { const auth = useAuth(); return auth.session ? <PrivateLayout /> : <PublicLayout>{auth.message ? <AuthPage mode="login" /> : <Landing />}</PublicLayout>; }
export function App() {
  return <HashRouter><AuthProvider><NavigationFocus /><a className="skip-link" href="#main" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a><div className="shell"><header><Link className="brand" to="/">Coincela<span>Every payment accounted for.</span></Link><Connectivity /></header><Routes><Route path="/login" element={<PublicLayout><AuthPage key="login" mode="login" /></PublicLayout>} /><Route path="/register" element={<PublicLayout><AuthPage key="register" mode="register" /></PublicLayout>} /><Route path="/" element={<HomeLayout />}><Route index element={<Overview />} /></Route><Route element={<PrivateLayout />}><Route path="/import" element={<ImportCenter />} /><Route path="/invoices" element={<RecordList key="invoices" kind="invoices" />} /><Route path="/transactions" element={<RecordList key="transactions" kind="transactions" />} /><Route path="/invoices/:id" element={<RecordDetails key="invoice-detail" kind="invoices" />} /><Route path="/transactions/:id" element={<RecordDetails key="payment-detail" kind="transactions" />} /><Route path="/review" element={<ReviewPayments />} /><Route path="/activity" element={<Activity />} /><Route path="/settings" element={<WorkspaceSettings />} /><Route path="*" element={<><h1>Page not found</h1><Link className="text-link" to="/">Back to overview</Link></>} /></Route></Routes><footer>Coincela · Every payment accounted for.</footer></div></AuthProvider></HashRouter>;
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
