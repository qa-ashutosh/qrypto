/**
 * @qrypto/e2e-suite — Global Setup
 *
 * Verifies both services are reachable before any browser test runs.
 * Resets mock server state to known seed values.
 *
 * Last updated: 2024-01-15
 */

import { request } from '@playwright/test';

const MOCK_SERVER = process.env['MOCK_SERVER_URL'] ?? 'http://localhost:8080';
const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:3000';
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 500;

async function waitFor(url: string, label: string): Promise<void> {
  const ctx = await request.newContext();
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const res = await ctx.get(url);
      if (res.ok() || res.status() === 404) {
        // eslint-disable-next-line no-console
        console.log(`✓ ${label} ready at ${url}`);
        await ctx.dispose();
        return;
      }
    } catch {
      if (i === MAX_RETRIES) {
        await ctx.dispose();
        throw new Error(`${label} not reachable at ${url} after ${MAX_RETRIES} attempts`);
      }
    }
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  await ctx.dispose();
}

async function resetMockServer(): Promise<void> {
  const ctx = await request.newContext({ baseURL: MOCK_SERVER });
  const res = await ctx.post('/admin/reset');
  if (!res.ok()) throw new Error(`Failed to reset mock server: ${res.status()}`);
  await ctx.dispose();
  // eslint-disable-next-line no-console
  console.log('✓ Mock server state reset\n');
}

export default async function globalSetup(): Promise<void> {
  await waitFor(`${MOCK_SERVER}/admin/health`, 'Mock server');
  await waitFor(FRONTEND_URL, 'Frontend');
  await resetMockServer();
}
