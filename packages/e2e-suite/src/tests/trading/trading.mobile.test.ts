/**
 * @qrypto/e2e-suite — Mobile Trading Flow
 *
 * Tests the trading page at 375px viewport.
 * Verifies the UI is operable on narrow viewports.
 *
 * Last updated: 2024-01-15
 */

import { test, expect } from '@playwright/test';

import { SEED_USERS, resetMockServer } from '../../fixtures/index.js';
import { TradingPage, LoginPage, TwoFactorPage } from '../../pages/index.js';

test.describe('Mobile — Trading Flow @mobile', () => {
  test.beforeEach(async () => {
    await resetMockServer();
  });

  test('login and place order on 375px viewport @smoke', async ({ page }) => {
    // Verify viewport
    expect(page.viewportSize()?.width).toBe(375);

    const loginPage = new LoginPage(page);
    const twoFactorPage = new TwoFactorPage(page);

    await loginPage.goto();
    await loginPage.login(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);
    await twoFactorPage.verify('123456');

    // Navigate to trading
    const tradingPage = new TradingPage(page);
    await tradingPage.goto();

    // Order form should be visible and operable
    await expect(tradingPage.quantityInput).toBeVisible();
    await expect(tradingPage.submitButton).toBeVisible();

    // Place an order
    await tradingPage.fillOrderForm({
      type: 'market',
      quantity: '0.001',
    });
    await tradingPage.placeOrder();
    await tradingPage.expectSuccess();
  });

  test('order book renders on mobile viewport', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const twoFactorPage = new TwoFactorPage(page);

    await loginPage.goto();
    await loginPage.login(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);
    await twoFactorPage.verify('123456');

    const tradingPage = new TradingPage(page);
    await tradingPage.goto();

    await tradingPage.expectOrderBookVisible();
  });
});
