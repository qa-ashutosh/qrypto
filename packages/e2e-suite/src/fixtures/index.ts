/**
 * @qrypto/e2e-suite — Test Fixtures
 * Last updated: 2024-01-15
 */

import { type Page, request } from '@playwright/test';

import { LoginPage, TwoFactorPage } from '../pages/index.js';

export interface SeedUser {
  email: string;
  password: string;
  twoFactorCode: string;
}

export const SEED_USERS: {
  [K in 'VERIFIED' | 'UNVERIFIED' | 'KYC_PENDING' | 'KYC_REJECTED' | 'ZERO_BALANCE']: SeedUser;
} = {
  VERIFIED: {
    email: 'verified@qrypto-test.invalid',
    password: 'TestPassword123!',
    twoFactorCode: '123456',
  },
  UNVERIFIED: {
    email: 'unverified@qrypto-test.invalid',
    password: 'TestPassword123!',
    twoFactorCode: '123456',
  },
  KYC_PENDING: {
    email: 'kyc-pending@qrypto-test.invalid',
    password: 'TestPassword123!',
    twoFactorCode: '123456',
  },
  KYC_REJECTED: {
    email: 'kyc-rejected@qrypto-test.invalid',
    password: 'TestPassword123!',
    twoFactorCode: '123456',
  },
  ZERO_BALANCE: {
    email: 'zero-balance@qrypto-test.invalid',
    password: 'TestPassword123!',
    twoFactorCode: '123456',
  },
};

export const MOCK_SERVER = process.env['MOCK_SERVER_URL'] ?? 'http://localhost:8080';
export const TEST_BTC_ADDRESS = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
export const TEST_ETH_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

/**
 * Complete login + 2FA through the browser UI.
 * Returns after landing on the trading page.
 */
export async function loginViaUI(page: Page, user: SeedUser = SEED_USERS.VERIFIED): Promise<void> {
  const loginPage = new LoginPage(page);
  const twoFactorPage = new TwoFactorPage(page);

  await loginPage.goto();
  await loginPage.login(user.email, user.password);

  // Wait briefly for navigation to settle after form submit
  // await page.waitForTimeout(500);

  // Check if 2FA screen appeared — wait up to 3s for it
  const is2faVisible = await twoFactorPage.codeInput
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);

  if (is2faVisible) {
    await twoFactorPage.verify(user.twoFactorCode);
    // Wait for nav to confirm full login completed
    await page.getByTestId('nav-trading').waitFor({ state: 'visible', timeout: 10000 });
  } else {
    // No 2FA — wait for nav to confirm login completed
    await page.getByTestId('nav-trading').waitFor({ state: 'visible', timeout: 10000 });
  }
}

/**
 * Reset mock server state between tests.
 * Call in beforeEach for test isolation.
 */
export async function resetMockServer(): Promise<void> {
  const ctx = await request.newContext({ baseURL: MOCK_SERVER });
  await ctx.post('/admin/reset');
  await ctx.dispose();
}

/**
 * Force a user's KYC status via admin API.
 */
export async function forceKycStatus(userId: string, status: string): Promise<void> {
  const ctx = await request.newContext({ baseURL: MOCK_SERVER });
  await ctx.post(`/admin/kyc/${userId}/force`, { data: { status } });
  await ctx.dispose();
}
