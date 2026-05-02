/**
 * @qrypto/api-suite — Global Setup
 *
 * Runs once before all tests.
 * Verifies mock server is healthy and resets state to seed values.
 *
 * Last updated: 2024-01-15
 */

import { request } from '@playwright/test';

const MOCK_SERVER = process.env['MOCK_SERVER_URL'] ?? 'http://localhost:8080';
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 500;

// eslint-disable-next-line no-console
async function waitForServer(): Promise<void> {
  const context = await request.newContext({ baseURL: MOCK_SERVER });

  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const res = await context.get('/admin/health');
      if (res.ok()) {
        // eslint-disable-next-line no-console
        console.log(`\n✓ Mock server ready at ${MOCK_SERVER}\n`);
        await context.dispose();
        return;
      }
    } catch {
      if (i === MAX_RETRIES) {
        await context.dispose();
        throw new Error(
          `Mock server not reachable at ${MOCK_SERVER} after ${MAX_RETRIES} attempts.\n` +
            `Run: npm run mock:start`,
        );
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  await context.dispose();
}

async function resetState(): Promise<void> {
  const context = await request.newContext({ baseURL: MOCK_SERVER });
  const res = await context.post('/admin/reset');
  if (!res.ok()) {
    throw new Error(`Failed to reset mock server state: ${res.status()}`);
  }
  await context.dispose();
}

export default async function globalSetup(): Promise<void> {
  await waitForServer();
  await resetState();
  // eslint-disable-next-line no-console
  console.log('✓ Mock server state reset to seed values\n');
}
