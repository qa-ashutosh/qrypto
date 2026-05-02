/**
 * @qrypto/api-suite — Playwright Configuration
 *
 * API-mode only — no browser install required.
 * Target: full suite under 3 minutes.
 *
 * Last updated: 2026-04-28
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  // No browser — API mode only
  use: {
    extraHTTPHeaders: {
      'x-test-suite': 'api-suite',
    },
  },

  // Parallel execution — tests are fully isolated via /admin/reset
  fullyParallel: false, // Sequential within files for race condition tests
  // workers: process.env['CI'] ? 2 : 4,
  workers: 1, // Disable parallelism for deterministic test runs — adjust as needed

  // Retries: never in compliance, limited in API suite
  retries: process.env['CI'] ? 1 : 0,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  // Global setup — verify mock server is healthy before any test runs
  globalSetup: './src/config/global-setup.ts',
  globalTeardown: './src/config/global-teardown.ts',

  projects: [
    {
      name: 'api',
      testMatch: '**/*.test.ts',
    },
    {
      name: 'smoke',
      testMatch: '**/*.test.ts',
      grep: /@smoke/,
    },
  ],
});
