import { test, expect, register } from './fixtures';
import pg from 'pg';
test('explicit partial confirmation, lost-response retry, split allocation and refreshed balances', async ({ page }, testInfo) => {
  await register(page);
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('coincela.session')!).token as string);
  const headers = { Authorization: `Bearer ${token}` };
  const csv = 'invoice_number,customer_name,issue_date,due_date,currency,total_amount\nALLOC-1,Amber Studio,2026-10-01,2026-10-31,GBP,100.00\nALLOC-2,Birch Studio,2026-10-01,2026-10-31,GBP,50.00\n';
  expect((await page.request.post('http://127.0.0.1:3002/imports/invoices', { headers: { ...headers, 'Content-Type': 'text/csv' }, data: csv })).status()).toBe(201);
  const bankId = (await (await page.request.post('http://127.0.0.1:3002/bank-accounts', { headers, data: { name: 'Allocation browser bank' } })).json()).account.id;
  expect((await page.request.post('http://127.0.0.1:3002/imports/transactions', { headers: { ...headers, 'Content-Type': 'text/csv', 'X-Bank-Account-Id': bankId }, data: 'transaction_date,description,amount,currency,payment_reference\n2026-10-10,Partial browser transfer,100.00,GBP,ALLOC-1\n2026-10-11,Split browser transfer,150.00,GBP,\n' })).status()).toBe(201);
  await page.getByRole('link', { name: 'Review Payments', exact: true }).click();
  await page.getByRole('button', { name: /Partial browser transfer/ }).click();
  await page.getByRole('button', { name: 'Generate suggestions', exact: true }).click();
  await page.getByRole('button', { name: 'Review allocation for ALLOC-1' }).click();
  const form = page.getByRole('region', { name: 'Allocate payment', exact: true });
  await expect(form.getByRole('button', { name: 'Confirm allocation', exact: true })).toBeDisabled();
  await form.getByLabel('Amount for ALLOC-1 (GBP)').fill('40.00');
  await expect(form.getByText('Invoice remaining after confirmation: £60.00')).toBeVisible();
  await expect(form.getByText('Payment remaining after confirmation: £60.00')).toBeVisible();
  await form.getByRole('checkbox').check();
  // Commit at the real API, then lose only the transport response to exercise safe retry.
  let dropped = false;
  await page.route('https://api.coincela.test/allocations', async route => {
    const response = await route.fetch({ url: 'http://127.0.0.1:3002/allocations' });
    if (!dropped) { expect(response.status()).toBe(200); dropped = true; await route.abort('failed'); }
    else await route.fulfill({ response });
  });
  await form.getByRole('button', { name: 'Confirm allocation', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(form.getByRole('button', { name: 'Retry same confirmation' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Choose invoices to allocate' }).click();
  await page.getByRole('button', { name: 'Retry same confirmation' }).click();
  await expect(page.getByRole('heading', { name: 'Allocation confirmed', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Allocated £40.00. Payment remaining: £60.00.' })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Back to payments' }).click();
  await page.getByRole('button', { name: /Split browser transfer/ }).click();
  await page.getByRole('button', { name: 'Choose invoices to allocate' }).click();
  await form.getByRole('button', { name: 'Add ALLOC-1', exact: true }).click();
  await form.getByRole('button', { name: 'Add ALLOC-2', exact: true }).click();
  await form.getByLabel('Amount for ALLOC-1 (GBP)').fill('60.00');
  await form.getByLabel('Amount for ALLOC-2 (GBP)').fill('50.00');
  await expect(form.getByText('Total to allocate: £110.00')).toBeVisible();
  await expect(form.getByText('Payment remaining after confirmation: £40.00')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('allocation-preview.png'), fullPage: true });
  await form.getByRole('checkbox').check(); await form.getByRole('button', { name: 'Confirm allocation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Allocation confirmed', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Allocated £110.00. Payment remaining: £40.00.' })).toBeVisible();
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL }); await client.connect();
  try {
    const state = (await client.query('SELECT count(*)::int AS count,sum(a.amount_pence)::text AS total FROM payment_allocations a JOIN bank_transactions t ON t.id=a.bank_transaction_id WHERE t.bank_account_id=$1', [bankId])).rows[0];
    expect(state).toEqual({ count: 3, total: '15000' });
    const audits = (await client.query('SELECT count(DISTINCT e.id)::int AS count FROM audit_events e JOIN payment_allocations a ON a.operation_id=e.operation_id JOIN bank_transactions t ON t.id=a.bank_transaction_id WHERE t.bank_account_id=$1', [bankId])).rows[0]; expect(audits.count).toBe(2);
  } finally { await client.end(); }
});
