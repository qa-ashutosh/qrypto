/**
 * @qrypto/e2e-suite — Wallet Tests
 *
 * Tests wallet UI surface — balance display, withdrawal form behaviour,
 * error message rendering for KYC gate and insufficient funds.
 *
 * Last updated: 2024-01-15
 */

import { test, expect } from '@playwright/test';

import { SEED_USERS, loginViaUI, resetMockServer, TEST_BTC_ADDRESS } from '../../fixtures/index.js';
import { WalletPage } from '../../pages/index.js';

test.describe('Wallet — Balance Display', () => {
  test.beforeEach(async () => {
    await resetMockServer();
  });

  test('verified user sees balance cards for all currencies @smoke', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.VERIFIED);

    const walletPage = new WalletPage(page);
    await walletPage.goto();

    await walletPage.expectBalanceVisible('BTC');
    await walletPage.expectBalanceVisible('USDT');
  });

  test('BTC balance shows correct seed value', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.VERIFIED);

    const walletPage = new WalletPage(page);
    await walletPage.goto();

    const btcCard = walletPage.balanceCard('BTC');
    await expect(btcCard).toContainText('0.5');
  });
});

test.describe('Wallet — Withdrawal Form', () => {
  test.beforeEach(async () => {
    await resetMockServer();
  });

  test('withdrawal form submission succeeds for verified user @smoke', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.VERIFIED);

    const walletPage = new WalletPage(page);
    await walletPage.goto();

    await walletPage.fillWithdrawalForm({
      currency: 'USDT',
      amount: '100',
      address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      twoFactorCode: '123456',
    });

    await walletPage.submitWithdrawal();
    await walletPage.expectWithdrawalSuccess();
  });

  test('withdrawal blocked for unverified user — KYC error shown', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.UNVERIFIED);

    const walletPage = new WalletPage(page);
    await walletPage.goto();

    await walletPage.fillWithdrawalForm({
      currency: 'USDT',
      amount: '100',
      address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      twoFactorCode: '123456',
    });

    await walletPage.submitWithdrawal();
    await walletPage.expectWithdrawalError('kyc');
  });

  test('withdrawal fails for zero balance user', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.ZERO_BALANCE);

    const walletPage = new WalletPage(page);
    await walletPage.goto();

    await walletPage.fillWithdrawalForm({
      currency: 'BTC',
      amount: '0.1',
      address: TEST_BTC_ADDRESS,
      twoFactorCode: '123456',
    });

    await walletPage.submitWithdrawal();
    await walletPage.expectWithdrawalError();
  });

  test('deposit address button shows address', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.VERIFIED);

    const walletPage = new WalletPage(page);
    await walletPage.goto();

    await walletPage.getDepositAddress();
    await walletPage.expectDepositAddressVisible();
  });
});
