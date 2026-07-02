/**
 * @qrypto/e2e-suite — Account Tests
 *
 * Tests account page UI — session display, security info, logout.
 *
 * Last updated: 2024-01-15
 */

import { test, expect } from '@playwright/test';

import { SEED_USERS, loginViaUI, resetMockServer } from '../../fixtures/index.js';
import { AccountPage, LoginPage } from '../../pages/index.js';

test.describe('Account — Profile and Security', () => {
  test.beforeEach(async () => {
    await resetMockServer();
  });

  test('account page shows 2FA status as enabled @smoke', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.VERIFIED);

    const accountPage = new AccountPage(page);
    await accountPage.goto();

    await accountPage.expect2faEnabled();
  });

  test('logout button is visible on account page', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.VERIFIED);

    const accountPage = new AccountPage(page);
    await accountPage.goto();

    await accountPage.expectLogoutButtonVisible();
  });

  test('logout from account page redirects to login @smoke', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.VERIFIED);

    const accountPage = new AccountPage(page);
    await accountPage.goto();

    await accountPage.clickLogout();

    const loginPage = new LoginPage(page);
    await loginPage.expectFormVisible();
  });

  test('sessions section shows at least one active session', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.VERIFIED);

    const accountPage = new AccountPage(page);
    await accountPage.goto();

    // Sessions section should show at least the current session
    await expect(page.locator('[data-testid^="session-row-"]').first()).toBeVisible();
  });
});
