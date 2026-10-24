import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, forbidOnly: !!process.env.CI, retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:4173/Coincela/', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  webServer: [
    { command: 'npm run start -w @coincela/api', url: 'http://127.0.0.1:3001/health', reuseExistingServer: false, env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://unused:unused@127.0.0.1:5432/unused', CORS_ORIGINS: 'http://127.0.0.1:4173', PORT: '3001' } },
    { command: 'npm run preview -w @coincela/web', url: 'http://127.0.0.1:4173/Coincela/', reuseExistingServer: false },
  ],
});
