import type pg from 'pg';
import { createHash, randomBytes } from 'node:crypto';
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export interface Principal { userId: string; email: string; workspaceId: string; workspaceName: string; sessionId: string; expiresAt: Date }
export function publicSession(principal: Principal) {
  return { user: { id: principal.userId, email: principal.email }, workspace: { id: principal.workspaceId, name: principal.workspaceName, currency: 'GBP' }, expiresAt: principal.expiresAt.toISOString() };
}
export async function insertSession(client: pg.PoolClient, userId: string, token: string) {
  const result = await client.query<{ id: string; expires_at: Date }>('INSERT INTO sessions(user_id, token_hash) VALUES ($1, $2) RETURNING id, expires_at', [userId, hashToken(token)]);
  return result.rows[0]!;
}
export async function findSession(pool: pg.Pool, token: string): Promise<Principal | null> {
  const result = await pool.query<Principal>(`SELECT u.id AS "userId", u.email, w.id AS "workspaceId", w.name AS "workspaceName", s.id AS "sessionId", s.expires_at AS "expiresAt"
    FROM sessions s JOIN users u ON u.id = s.user_id JOIN workspaces w ON w.owner_user_id = u.id
    WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > clock_timestamp()`, [hashToken(token)]);
  return result.rows[0] ?? null;
}
