import { defineConfig, devices } from '@playwright/test';

/**
 * Runs the e2e suite against an already-running dev server instead of starting
 * one. Use when the app is served by Aspire (or any other port) and the default
 * config's webServer on :3000 would collide.
 *
 *   PW_BASE_URL=http://localhost:3100 npx playwright test --config=playwright.local.config.ts
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'line',
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:3000',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
