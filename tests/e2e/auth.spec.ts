import { test, expect, register } from './fixtures';
import pg from 'pg';
import { createHash } from 'node:crypto';
test('register, settings, refresh, logout and login use the real API', async ({ page }, testInfo) => {
  const account = await register(page);
  await page.getByRole('link', { name: 'Workspace settings', exact: true }).click();
  await page.getByLabel('Workspace name', { exact: true }).fill('My saved studio');
  await page.getByRole('button', { name: 'Save workspace' }).click();
  await expect(page.getByText('Workspace saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Workspace name', { exact: true })).toHaveValue('My saved studio');
  expect(await page.evaluate(() => localStorage.getItem('coincela.session'))).toBeNull();
  const stored = await page.evaluate(() => sessionStorage.getItem('coincela.session'));
  expect(stored).not.toBeNull();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Coincela' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('coincela.session'))).toBeNull();
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill('incorrect password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect. Please try again.');
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByText('My saved studio', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('authenticated-overview.png'), fullPage: true });
});
test('server expiry returns to sign in, clears tokens and blocks private routes', async ({ page }) => {
  await register(page);
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('coincela.session')!).token as string);
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query("UPDATE sessions SET created_at=clock_timestamp()-interval '1 hour',expires_at=clock_timestamp()-interval '1 second' WHERE token_hash=$1", [createHash('sha256').update(token).digest('hex')]);
  } finally { await client.end(); }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in to Coincela' })).toBeVisible();
  await expect(page.getByText('Your session has ended. Please sign in again.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('coincela.session'))).toBeNull();
  await page.goto('#/settings');
  await expect(page.getByRole('heading', { name: 'Sign in to Coincela' })).toBeVisible();
});
