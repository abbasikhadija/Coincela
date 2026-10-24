export function apiBase(value = import.meta.env.VITE_API_URL, production = import.meta.env.PROD): string | null {
  if (!value?.trim()) return production ? null : '/api';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || (production && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash) return null;
    return value.replace(/\/+$/, '');
  } catch { return null; }
}
export async function checkApi(base: string, signal: AbortSignal): Promise<void> {
  const response = await fetch(`${base}/health`, { signal });
  if (!response.ok) throw new Error('API unavailable');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('service' in body) || body.service !== 'coincela-api' || !('status' in body) || body.status !== 'ok') throw new Error('Unexpected health response');
}
