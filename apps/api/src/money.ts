// PostgreSQL BIGINT bounds; all financial values cross HTTP boundaries as strings.
export const MAX_PENCE = 9223372036854775807n;
export function parseMoney(value: string, currency = 'GBP', positive = false): bigint {
  if (currency !== 'GBP') throw new Error('Only GBP is supported.');
  if (typeof value !== 'string' || value.length > 22 || !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value)) {
    throw new Error('Enter an amount with at most two decimal places.');
  }
  const [whole = '', fraction = ''] = value.split('.');
  const pence = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (pence > MAX_PENCE || (positive && pence === 0n)) throw new Error('The amount is outside the supported range.');
  return pence;
}
export function serializePence(value: bigint): string {
  if (value < 0n || value > MAX_PENCE) throw new Error('The amount is outside the supported range.');
  return value.toString();
}
export function formatMoney(value: bigint): string {
  serializePence(value);
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}
