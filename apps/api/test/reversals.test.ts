import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { reversalSchema, reversalHash } from '../src/reversals/validation.js';
const input = () => ({ operationKey: randomUUID(), allocationId: randomUUID(), confirmed: true as const, reason: 'Wrong invoice selected' });
it('requires explicit confirmation and a bounded meaningful reason without client financial values', () => {
  const valid = input(); expect(reversalSchema.safeParse(valid).success).toBe(true);
  for (const patch of [{ reason: '' }, { reason: ' \n ' }, { reason: 'x'.repeat(1001) }, { reason: 'bad\0reason' }, { confirmed: false }, { confirmed: undefined }, { allocationId: 'invalid' }, { amountPence: '1' }, { workspaceId: randomUUID() }]) expect(reversalSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  expect(reversalSchema.parse({ ...valid, reason: '  Wrong invoice\nChecked bank record.  ' }).reason).toBe('Wrong invoice\nChecked bank record.');
});
it('hashes confirmed allocation identity and reason independently of the retry key', () => {
  const valid = input(); expect(reversalHash(valid)).toBe(reversalHash({ ...valid, operationKey: randomUUID() }));
  expect(reversalHash(valid)).not.toBe(reversalHash({ ...valid, reason: 'Different correction' }));
  expect(reversalHash(valid)).not.toBe(reversalHash({ ...valid, allocationId: randomUUID() }));
});
