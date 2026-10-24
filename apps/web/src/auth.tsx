import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { apiBase } from './api';
export interface Session {
  user: { id: string; email: string };
  workspace: { id: string; name: string; currency: string };
  expiresAt: string;
}
interface StoredSession { token: string; expiresAt: string }
interface AuthContextValue {
  session: Session | null; loading: boolean; message: string;
  authenticate: (mode: 'login' | 'register', input: Record<string, string>) => Promise<void>;
  logout: () => Promise<void>;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  setWorkspace: (workspace: Session['workspace']) => void;
  retry: () => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);
const storageKey = 'coincela.session';
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
async function send<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const base = apiBase();
  if (!base) throw new Error('The API connection is not configured. Please try again later.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${base}${path}`, { ...init, signal: controller.signal, credentials: 'omit',
      headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
    if (response.status === 204) return undefined as T;
    const body = await response.json();
    if (!response.ok) throw new ApiError(response.status, body.error?.message ?? 'The request failed. Please try again.');
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error('Could not reach Coincela. Check your connection and try again.');
  } finally { clearTimeout(timeout); }
}
function readStored(): StoredSession | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as StoredSession | null;
    if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value.token) || !Number.isFinite(Date.parse(value.expiresAt))) return null;
    return value;
  } catch { return null; }
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const token = useRef<string | null>(null);
  const generation = useRef(0);
  const clear = useCallback((reason = '') => {
    generation.current++;
    token.current = null; setSession(null); setMessage(reason);
    try { sessionStorage.removeItem(storageKey); } catch { /* Memory-only sessions still work. */ }
  }, []);
  const save = useCallback((value: Session & { token: string }) => {
    generation.current++;
    token.current = value.token;
    const { token: raw, ...details } = value;
    setSession(details); setMessage('');
    try { sessionStorage.setItem(storageKey, JSON.stringify({ token: raw, expiresAt: value.expiresAt })); } catch { /* No persistent fallback. */ }
  }, []);
  useEffect(() => {
    let active = true;
    const stored = readStored();
    if (!stored) { setLoading(false); return; }
    if (Date.parse(stored.expiresAt) <= Date.now()) { clear('Your session has ended. Please sign in again.'); setLoading(false); return; }
    token.current = stored.token;
    setLoading(true);
    void send<Session>('/auth/me', stored.token).then(value => {
      if (active) { setSession(value); setMessage(''); }
    }).catch(error => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) clear('Your session has ended. Please sign in again.');
      else setMessage('We could not restore your session. Check your connection and try again.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, clear]);
  useEffect(() => {
    if (!session) return;
    const expire = () => { if (Date.parse(session.expiresAt) <= Date.now()) clear('Your session has ended. Please sign in again.'); };
    const timeout = setTimeout(expire, Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    window.addEventListener('focus', expire);
    return () => { clearTimeout(timeout); window.removeEventListener('focus', expire); };
  }, [session, clear]);
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const current = generation.current;
    try { return await send<T>(path, token.current, init); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401 && generation.current === current) clear('Your session has ended. Please sign in again.');
      throw error;
    }
  }
  return <AuthContext.Provider value={{ session, loading, message,
    authenticate: async (mode, input) => { save(await send<Session & { token: string }>(`/auth/${mode}`, null, { method: 'POST', body: JSON.stringify(input) })); },
    logout: async () => { await request<void>('/auth/logout', { method: 'POST' }); clear(); },
    request, setWorkspace: workspace => setSession(value => value ? { ...value, workspace } : value), retry: () => setAttempt(value => value + 1),
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw Error('AuthProvider required');
  return value;
}
