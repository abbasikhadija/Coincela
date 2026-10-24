import type pg from 'pg';
export interface ActivityEvent { id: string; operationId: string; eventType: string; createdAt: Date; actorEmail: string; amountPence: string; details: Record<string, unknown> }
const eventSelect = `SELECT e.id,e.operation_id AS "operationId",e.event_type AS "eventType",e.created_at AS "createdAt",u.email AS "actorEmail",
 COALESCE(e.details->>'allocatedPence',e.details->>'restoredPence','0') AS "amountPence",e.details
 FROM audit_events e JOIN users u ON u.id=e.actor_user_id`;
export async function listEvents(client: pg.PoolClient, workspaceId: string, page: number) {
  // Summaries omit large request/results; detail is revealed only for a selected operation.
  return (await client.query<Omit<ActivityEvent, 'details'>>(`SELECT id,"operationId","eventType","createdAt","actorEmail","amountPence" FROM (${eventSelect} WHERE e.workspace_id=$1 AND e.operation_id IS NOT NULL) events ORDER BY "createdAt" DESC,id DESC LIMIT 26 OFFSET $2`, [workspaceId, (page - 1) * 25])).rows;
}
export async function findEvent(client: pg.PoolClient, workspaceId: string, operationId: string) {
  return (await client.query<ActivityEvent>(`${eventSelect} WHERE e.workspace_id=$1 AND e.operation_id=$2 ORDER BY e.created_at,e.id LIMIT 1`, [workspaceId, operationId])).rows[0];
}
export async function timeline(client: pg.PoolClient, workspaceId: string, operationIds: string[]) {
  return (await client.query<ActivityEvent>(`${eventSelect} WHERE e.workspace_id=$1 AND e.operation_id=ANY($2::uuid[]) ORDER BY e.created_at,e.id`, [workspaceId, operationIds])).rows;
}
