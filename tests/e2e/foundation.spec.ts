import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  // Keep production HTTPS validation intact; forward this test-only hostname
  // to the real local Express process, without mocking its response.
  await page.route('https://api.coincela.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const response = await route.fetch({ url: `http://127.0.0.1:3001${path}` });
    await route.fulfill({ response });
  });
});
test('built assets, real API connectivity, hash navigation and refresh', async ({ page }, testInfo) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
  await page.goto('');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('API connected');
  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: true });
  await page.getByRole('link', { name: 'Import', exact: true }).click();
  await expect(page).toHaveURL(/\/Coincela\/#\/import$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Import', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Import', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: 'Back to overview' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const assets = await page.locator('script[src], link[rel="stylesheet"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('src') ?? node.getAttribute('href')));
  expect(assets.length).toBeGreaterThan(0);
  expect(assets.every(asset => asset?.startsWith('/Coincela/assets/'))).toBe(true);
  expect(failures).toEqual([]);
});
test('keyboard skip link, unavailable API feedback and retry', async ({ page }) => {
  await page.route('**/health', route => route.abort());
  await page.goto('');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('API unavailable. Please try again.');
  await page.unroute('**/health');
  await page.getByRole('button', { name: 'Retry connection' }).click();
  await expect(page.getByRole('status')).toHaveText('API connected');
});
