import { z } from 'zod';
import { createHash } from 'node:crypto';
import { MAX_PENCE } from '../money.js';
const pence = z.string().refine(value => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= MAX_PENCE);
export const allocationSchema = z.object({
  operationKey: z.string().uuid(), paymentId: z.string().uuid(), confirmed: z.literal(true),
  allocations: z.array(z.object({ invoiceId: z.string().uuid(), amountPence: pence, suggestionId: z.string().uuid().optional() }).strict()).min(1).max(50),
}).strict().refine(value => new Set(value.allocations.map(row => row.invoiceId)).size === value.allocations.length, 'Choose each invoice only once.');
export type AllocationInput = z.infer<typeof allocationSchema>;
export function canonicalRequest(input: AllocationInput) {
  return { paymentId: input.paymentId, confirmed: input.confirmed, allocations: [...input.allocations].sort((a, b) => a.invoiceId.localeCompare(b.invoiceId)) };
}
export function requestHash(input: AllocationInput) { return createHash('sha256').update(JSON.stringify(canonicalRequest(input))).digest('hex'); }
