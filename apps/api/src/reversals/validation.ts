import { createHash } from 'node:crypto';
import { z } from 'zod';
export const reversalSchema = z.object({
  operationKey: z.string().uuid(), allocationId: z.string().uuid(), confirmed: z.literal(true),
  reason: z.string().trim().min(1).max(1000).refine(value => [...value].every(char => ['\n', '\r', '\t'].includes(char) || (char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127))),
}).strict();
export type ReversalInput = z.infer<typeof reversalSchema>;
export function reversalRequest(input: ReversalInput) { return { allocationId: input.allocationId, confirmed: input.confirmed, reason: input.reason }; }
export function reversalHash(input: ReversalInput) { return createHash('sha256').update(JSON.stringify(reversalRequest(input))).digest('hex'); }
