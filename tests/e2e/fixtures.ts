import { test as base, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
export { expect };
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('https://api.coincela.test/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const response = await route.fetch({ url: `http://127.0.0.1:3002${path}` });
      await route.fulfill({ response });
    });
    await use(page);
  },
});
export async function register(page: Page) {
  const email = `${randomUUID()}@example.test`;
  const password = 'A synthetic browser passphrase!';
  await page.goto('#/register');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Business or workspace name').fill('Synthetic browser studio');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  return { email, password };
}
