import type pg from 'pg';
import { hashPassword, verifyPassword, dummyPasswordHash } from './password.js';
import { insertSession, newToken, publicSession } from './repository.js';
import { HttpError } from '../errors.js';
export class AuthService {
  constructor(private pool: pg.Pool) {}
  async register(input: { email: string; password: string; workspaceName: string }) {
    const passwordHash = await hashPassword(input.password);
    const token = newToken();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const user = (await client.query<{ id: string }>('INSERT INTO users(email, password_hash) VALUES ($1, $2) RETURNING id', [input.email, passwordHash])).rows[0]!;
      const workspace = (await client.query<{ id: string; name: string }>('INSERT INTO workspaces(owner_user_id, name) VALUES ($1, $2) RETURNING id, name', [user.id, input.workspaceName])).rows[0]!;
      const session = await insertSession(client, user.id, token);
      await client.query('COMMIT');
      return { token, ...publicSession({ userId: user.id, email: input.email, workspaceId: workspace.id, workspaceName: workspace.name, sessionId: session.id, expiresAt: session.expires_at }) };
    } catch (error) {
      await client.query('ROLLBACK');
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505' && 'constraint' in error && error.constraint === 'users_email_key') {
        throw new HttpError(409, 'EMAIL_IN_USE', 'An account already uses this email. Please sign in.');
      }
      throw error;
    } finally { client.release(); }
  }
  async login(input: { email: string; password: string }) {
    const user = (await this.pool.query<{ id: string; email: string; password_hash: string; workspace_id: string; workspace_name: string }>(
      'SELECT u.id, u.email, u.password_hash, w.id AS workspace_id, w.name AS workspace_name FROM users u JOIN workspaces w ON w.owner_user_id = u.id WHERE u.email = $1', [input.email])).rows[0];
    const valid = await verifyPassword(input.password, user?.password_hash ?? dummyPasswordHash);
    if (!user || !valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect. Please try again.');
    const token = newToken();
    const client = await this.pool.connect();
    try {
      const session = await insertSession(client, user.id, token);
      return { token, ...publicSession({ userId: user.id, email: user.email, workspaceId: user.workspace_id, workspaceName: user.workspace_name, sessionId: session.id, expiresAt: session.expires_at }) };
    } finally { client.release(); }
  }
}
