import { defineConfig, devices } from '@playwright/test';

/**
 * Two dev servers, because the suite contains two kinds of test that need opposite
 * data sources:
 *
 * - **:3000, mock data ON** — most specs read the built-in `mockRecipes` (recipe 1 and
 *   friends). This is what `.env.local` sets, and what those specs were written against.
 * - **:3001, mock data OFF** — specs that intercept API responses with `page.route` need
 *   the service to actually issue a fetch. With mocking enabled, `getRecipeById` returns
 *   mock data and short-circuits before any request, so the stubs would never be hit.
 *
 * Both servers set `NEXT_PUBLIC_MOCK_DATA` explicitly rather than inheriting whatever
 * `.env.local` happens to say, so a local override cannot quietly break the suite.
 */

/** Specs that stub the API and therefore need mocking disabled. */
const STUBBED_SPECS = /tilbehor-inline\.spec\.ts/;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: STUBBED_SPECS,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: STUBBED_SPECS,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: STUBBED_SPECS,
    },
    {
      name: 'chromium-stubbed',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3001' },
      testMatch: STUBBED_SPECS,
    },
  ],

  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_ALLOW_UNAUTHENTICATED: 'true',
        NEXT_PUBLIC_MOCK_DATA: 'true',
      },
    },
    {
      command: 'npm run dev -- -p 3001',
      url: 'http://localhost:3001',
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_ALLOW_UNAUTHENTICATED: 'true',
        NEXT_PUBLIC_MOCK_DATA: 'false',
      },
    },
  ],
});
