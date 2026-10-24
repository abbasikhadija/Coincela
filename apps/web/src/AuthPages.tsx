import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button, Field, Panel } from './components';
import { useAuth } from './auth';
export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const register = mode === 'register';
  if (auth.session) return <Navigate to="/" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    const data = new FormData(event.currentTarget);
    const input: Record<string, string> = { email: String(data.get('email')), password: String(data.get('password')) };
    if (register) input.workspaceName = String(data.get('workspaceName'));
    try { await auth.authenticate(mode, input); }
    catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <div className="auth-page"><p className="eyebrow">Every payment accounted for.</p><h1>{register ? 'Create your account' : 'Sign in to Coincela'}</h1><p className="lead">{register ? 'One account. One workspace for your business.' : 'Continue to your business workspace.'}</p><Panel><form onSubmit={submit} aria-busy={busy}>
    {auth.message && <p role="status">{auth.message}</p>}
    {auth.message.includes('could not restore') && <Button type="button" className="secondary" onClick={auth.retry}>Retry session</Button>}
    {error && <p className="form-error" id="auth-error" role="alert">{error}</p>}
    <Field id={`${mode}-email`} name="email" type="email" label="Email" autoComplete="email" required maxLength={254} aria-describedby={error ? 'auth-error' : undefined} />
    <Field id={`${mode}-password`} name="password" type="password" label="Password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 12 : 1} maxLength={128} aria-describedby={register ? 'password-help' : undefined} />
    {register && <><p id="password-help" className="field-help">Use 12–128 characters. A longer passphrase works well.</p><Field id="workspace-name" name="workspaceName" label="Business or workspace name" autoComplete="organization" required maxLength={100} /></>}
    <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</Button>
  </form><p className="auth-alternative">{register ? <>Already have an account? <Link className="text-link" to="/login">Sign in</Link></> : <>New to Coincela? <Link className="text-link" to="/register">Create an account</Link></>}</p></Panel></div>;
}
export function WorkspaceSettings() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setFeedback('');
    const name = String(new FormData(event.currentTarget).get('name'));
    try {
      const result = await auth.request<{ workspace: NonNullable<typeof auth.session>['workspace'] }>(`/workspaces/${auth.session!.workspace.id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      auth.setWorkspace(result.workspace); setFeedback('Workspace saved.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <><p className="eyebrow">Your account</p><h1>Workspace settings</h1><p className="lead">The basics for your business.</p><Panel><form onSubmit={submit} aria-busy={busy}>
    {error && <p className="form-error" role="alert">{error}</p>}
    <p role="status">{feedback}</p>
    <Field id="settings-name" name="name" label="Workspace name" defaultValue={auth.session!.workspace.name} required maxLength={100} />
    <p className="field-help">Currency: GBP · British pound</p><p className="field-help">Account: {auth.session!.user.email}</p>
    <Button disabled={busy}>{busy ? 'Saving…' : 'Save workspace'}</Button>
  </form></Panel></>;
}
