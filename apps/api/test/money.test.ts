import { expect, it } from 'vitest';
import { parseMoney, serializePence, formatMoney, MAX_PENCE } from '../src/money.js';
it.each([['0', 0n], ['0.01', 1n], ['12.3', 1230n], ['90071992547409.93', 9007199254740993n], ['92233720368547758.07', MAX_PENCE]])('parses %s without floating point', (input, expected) => {
  expect(parseMoney(input)).toBe(expected);
  expect(typeof serializePence(expected)).toBe('string');
});
it.each(['-1', '1.001', '1e2', 'NaN', 'Infinity', '', ' 1', '1 ', '+1', '01.00', '.5', '1.', '1,000.00', '92233720368547758.08', '9'.repeat(10000)])('rejects malformed or overflowing amount %s', input => {
  expect(() => parseMoney(input)).toThrow();
});
it('rejects unsupported currency, non-string inputs and invalid allocation amounts', () => {
  expect(() => parseMoney('1', 'USD')).toThrow();
  expect(() => parseMoney(1 as unknown as string)).toThrow();
  expect(() => parseMoney('0', 'GBP', true)).toThrow();
  expect(() => serializePence(-1n)).toThrow();
  expect(() => serializePence(MAX_PENCE + 1n)).toThrow();
});
it('formats exact decimal strings and explicitly serializes BigInt', () => {
  expect(formatMoney(1n)).toBe('0.01');
  expect(formatMoney(MAX_PENCE)).toBe('92233720368547758.07');
  expect(JSON.stringify({ amountPence: serializePence(9007199254740993n) })).toBe('{"amountPence":"9007199254740993"}');
});
