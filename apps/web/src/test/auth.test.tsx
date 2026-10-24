import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../App';
import { AuthProvider, useAuth } from '../auth';
const token = 'a'.repeat(43);
const details = () => ({ user: { id: 'user-1', email: 'owner@example.test' }, workspace: { id: 'workspace-1', name: 'My studio', currency: 'GBP' }, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); window.location.hash = '#/'; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('registers through the API, stores only refresh token metadata and renders private settings', async () => {
  const fetchMock = vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith('/health')) return ok({ service: 'coincela-api', status: 'ok' });
    return ok({ token, ...details() });
  });
  vi.stubGlobal('fetch', fetchMock);
  window.location.hash = '#/register'; render(<App />);
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'owner@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'A long passphrase!' } });
  fireEvent.change(screen.getByLabelText('Business or workspace name'), { target: { value: 'My studio' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  expect(JSON.parse(sessionStorage.getItem('coincela.session')!)).toEqual({ token, expiresAt: expect.any(String) });
  expect(localStorage.length).toBe(0);
  const call = fetchMock.mock.calls.find(call => call[0].endsWith('/auth/register'))!;
  expect(JSON.parse(call[1].body)).toEqual({ email: 'owner@example.test', password: 'A long passphrase!', workspaceName: 'My studio' });
  expect(call[1].credentials).toBe('omit');
  fireEvent.click(screen.getByRole('link', { name: 'Workspace settings' }));
  expect(await screen.findByLabelText('Workspace name')).toHaveValue('My studio');
});
it('restores the session using the Authorization header and blocks stale sessions', async () => {
  sessionStorage.setItem('coincela.session', JSON.stringify({ token, expiresAt: details().expiresAt }));
  const fetchMock = vi.fn().mockImplementation(async (url: string) => url.endsWith('/health') ? ok({ status: 'ok', service: 'coincela-api' }) : ok(details()));
  vi.stubGlobal('fetch', fetchMock); render(<App />);
  expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  const call = fetchMock.mock.calls.find(call => call[0].endsWith('/auth/me'))!;
  expect(call[1].headers.Authorization).toBe(`Bearer ${token}`);
});
it('clears rejected server sessions and explains how to recover', async () => {
  sessionStorage.setItem('coincela.session', JSON.stringify({ token, expiresAt: details().expiresAt }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'Session expired' } }) }));
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Sign in to Coincela' })).toBeInTheDocument();
  expect(screen.getByText('Your session has ended. Please sign in again.')).toBeInTheDocument();
  expect(sessionStorage.getItem('coincela.session')).toBeNull();
});
it('keeps refresh credentials during a temporary outage and offers retry', async () => {
  sessionStorage.setItem('coincela.session', JSON.stringify({ token, expiresAt: details().expiresAt }));
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Error('offline'))); render(<App />);
  expect(await screen.findByRole('button', { name: 'Retry session' })).toBeInTheDocument();
  expect(sessionStorage.getItem('coincela.session')).not.toBeNull();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(details())));
  fireEvent.click(screen.getByRole('button', { name: 'Retry session' }));
  expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
});
function SessionProbe() {
  const auth = useAuth();
  return <><p>{auth.session ? 'Authenticated' : 'Signed out'}</p><p>{auth.message}</p><button onClick={() => void auth.authenticate('login', {})}>Authenticate</button><button onClick={() => void auth.request('/private').catch(() => {})}>Private request</button></>;
}
it('expires an active session at its fixed client deadline', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ token, ...details(), expiresAt: new Date(Date.now() + 10000).toISOString() })));
  render(<AuthProvider><SessionProbe /></AuthProvider>);
  await act(async () => { fireEvent.click(screen.getByText('Authenticate')); });
  expect(screen.getByText('Authenticated')).toBeInTheDocument();
  await act(async () => { vi.advanceTimersByTime(10001); });
  expect(screen.getByText('Signed out')).toBeInTheDocument();
  expect(sessionStorage.getItem('coincela.session')).toBeNull();
});
it('clears an active session when any protected request returns 401', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok({ token, ...details() })).mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'Expired' } }) }));
  render(<AuthProvider><SessionProbe /></AuthProvider>);
  await act(async () => { fireEvent.click(screen.getByText('Authenticate')); });
  await act(async () => { fireEvent.click(screen.getByText('Private request')); });
  expect(screen.getByText('Signed out')).toBeInTheDocument();
  expect(sessionStorage.getItem('coincela.session')).toBeNull();
});
it('reports logout failure without pretending the server revoked the session', async () => {
  sessionStorage.setItem('coincela.session', JSON.stringify({ token, expiresAt: details().expiresAt }));
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith('/auth/logout')) throw Error('offline');
    return url.endsWith('/health') ? ok({ status: 'ok', service: 'coincela-api' }) : ok(details());
  }));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach Coincela. Check your connection and try again.');
  expect(sessionStorage.getItem('coincela.session')).not.toBeNull();
});
