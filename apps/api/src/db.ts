import pg from 'pg';
export function createPool(connectionString: string) {
  // pg honors sslmode in the connection URL; use sslmode=verify-full with Neon.
  const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 3000, idleTimeoutMillis: 30000, query_timeout: 3000 });
  pool.on('error', () => console.error('Idle database connection failed'));
  return pool;
}
export async function checkDatabase(pool: pg.Pool): Promise<void> {
  await pool.query('SELECT 1 AS connected');
}
