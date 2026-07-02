/**
 * @qrypto/e2e-suite — Playwright Configuration
 *
 * Full browser tests against @qrypto/frontend-mock on localhost:3000.
 * Mock server must be running on localhost:8080.
 *
 * Runs nightly — not on every PR. Browser tests are expensive.
 * API correctness is the api-suite's job. This suite tests the UI risk surface.
 *
 * Last updated: 2024-01-15
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },

  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    headless: true,
  },

  globalSetup: './src/config/global-setup.ts',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/*.mobile.test.ts'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: ['**/auth/**', '**/wallet/**', '**/trading/**'],
      testIgnore: ['**/*.mobile.test.ts'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: ['**/auth/**', '**/wallet/**'],
      testIgnore: ['**/*.mobile.test.ts'],
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 375, height: 812 },
      },
      testMatch: ['**/*.mobile.test.ts'],
    },
  ],
});
