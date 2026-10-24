import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { allocationSchema, requestHash } from '../src/allocations/validation.js';
const input = () => ({ operationKey: randomUUID(), paymentId: randomUUID(), confirmed: true as const, allocations: [{ invoiceId: randomUUID(), amountPence: '100' }, { invoiceId: randomUUID(), amountPence: '200' }] });
it('requires explicit confirmation and positive bounded string pence with unique invoices', () => {
  const valid = input(); expect(allocationSchema.safeParse(valid).success).toBe(true);
  for (const amountPence of ['0', '-1', '1.01', '01', '9223372036854775808', 100, '1e3']) expect(allocationSchema.safeParse({ ...valid, allocations: [{ invoiceId: randomUUID(), amountPence }] }).success).toBe(false);
  for (const changed of [{ confirmed: false }, { confirmed: undefined }, { allocations: [] }, { allocations: Array(51).fill(valid.allocations[0]) }, { allocations: [valid.allocations[0], valid.allocations[0]] }, { balance: '10000' }]) expect(allocationSchema.safeParse({ ...valid, ...changed }).success).toBe(false);
});
it('canonicalizes split order while detecting different amounts, payment and suggestion identity', () => {
  const valid = input(); expect(requestHash(valid)).toBe(requestHash({ ...valid, allocations: [...valid.allocations].reverse() }));
  expect(requestHash(valid)).not.toBe(requestHash({ ...valid, paymentId: randomUUID() }));
  expect(requestHash(valid)).not.toBe(requestHash({ ...valid, allocations: [{ ...valid.allocations[0]!, amountPence: '101' }] }));
  expect(requestHash(valid)).not.toBe(requestHash({ ...valid, allocations: valid.allocations.map(row => ({ ...row, suggestionId: randomUUID() })) }));
});
