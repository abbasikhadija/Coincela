import { defineConfig, devices } from '@playwright/test';
if (!process.env.TEST_DATABASE_URL) throw Error('TEST_DATABASE_URL is required for browser tests; use an isolated PostgreSQL database.');
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, forbidOnly: !!process.env.CI, retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:4173/Coincela/', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  webServer: [
    { command: 'npm run db:migrate && npm run start -w @coincela/api', url: 'http://127.0.0.1:3002/health', reuseExistingServer: false, env: { DATABASE_URL: process.env.TEST_DATABASE_URL, CORS_ORIGINS: 'http://127.0.0.1:4173', PORT: '3002' } },
    { command: 'npm run preview -w @coincela/web', url: 'http://127.0.0.1:4173/Coincela/', reuseExistingServer: false },
  ],
});
