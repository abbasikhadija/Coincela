import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { App } from '../App';
import { apiBase, checkApi } from '../api';
import { Field } from '../components';
describe('foundation UI', () => {
  beforeEach(() => { sessionStorage.clear(); });
  it('shows the public landing page with live connectivity and protects workspace routes', async () => {
    window.location.hash = '#/';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', service: 'coincela-api' }) }));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Every payment accounted for.' })).toBeInTheDocument();
    expect(await screen.findByText('API connected')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Create an account' }));
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
  });
  it('reports network failure and retries', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', service: 'coincela-api' }) });
    vi.stubGlobal('fetch', fetchMock); render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry connection' }));
    expect(await screen.findByText('API connected')).toBeInTheDocument();
  });
  it('associates field labels', () => { render(<Field id="reference" label="Reference" />); expect(screen.getByLabelText('Reference')).toHaveAttribute('id', 'reference'); });
});
describe('API configuration', () => {
  it('allows local proxy only in development', () => { expect(apiBase('', false)).toBe('/api'); expect(apiBase('', true)).toBeNull(); });
  it('requires a safe HTTPS production URL', () => {
    expect(apiBase('https://api.example.com/', true)).toBe('https://api.example.com');
    for (const value of ['http://localhost:3001', 'invalid', 'https://user:pass@example.com', 'https://api.example.com?secret=x']) expect(apiBase(value, true)).toBeNull();
  });
  it('rejects unrelated or unsuccessful health responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) }));
    await expect(checkApi('https://api.example.com', new AbortController().signal)).rejects.toThrow();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(checkApi('https://api.example.com', new AbortController().signal)).rejects.toThrow();
  });
});
