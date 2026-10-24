import { useEffect, useState } from 'react';
import { HashRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { apiBase, checkApi } from './api';
import { Button, Panel } from './components';
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
  return <><p className="eyebrow">Your workspace</p><h1>Overview</h1><p className="lead">A clear place to account for every payment.</p><Panel><span className="badge">Foundation preview</span><h2>Your workspace starts here</h2><p>Coincela is being built for freelancers and small service businesses to bring invoices and incoming payments together.</p><p>Importing, payment review and allocations are not available yet. No financial records are stored in this preview.</p><Link className="button" to="/import">See the import workspace</Link></Panel><p className="footnote">You’ll always review and confirm an allocation before it changes a balance.</p></>;
}
function Placeholder({ name }: { name: string }) {
  return <><p className="eyebrow">Workspace foundation</p><h1>{name}</h1><Panel><h2>This workspace is coming later</h2><p>{name} is not available in this foundation preview.</p><Link className="text-link" to="/">Back to overview</Link></Panel></>;
}
export function App() {
  return <HashRouter><a className="skip-link" href="#main" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a><div className="shell"><header><Link className="brand" to="/">Coincela<span>Every payment accounted for.</span></Link><Connectivity /></header><div className="workspace"><nav aria-label="Main navigation">{sections.map(([path, name]) => <NavLink key={path} to={path} end={path === '/'}>{name}</NavLink>)}</nav><main id="main" tabIndex={-1}><Routes><Route path="/" element={<Overview />} />{sections.slice(1).map(([path, name]) => <Route key={path} path={path} element={<Placeholder name={name} />} />)}<Route path="*" element={<><h1>Page not found</h1><Link className="text-link" to="/">Back to overview</Link></>} /></Routes></main></div><footer>Coincela · Foundation preview</footer></div></HashRouter>;
}

