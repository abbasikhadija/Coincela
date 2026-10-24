import { expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';
it('salts and hashes passwords, verifies exact input and rejects invalid encodings', async () => {
  const password = 'correct horse battery staple';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  expect(first).not.toBe(second); expect(first).not.toContain(password);
  expect(await verifyPassword(password, first)).toBe(true);
  expect(await verifyPassword(`${password} `, first)).toBe(false);
  expect(await verifyPassword(password, 'invalid')).toBe(false);
}, 15000);
