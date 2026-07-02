/**
 * @qrypto/e2e-suite — Auth Tests
 *
 * Tests the UI risk surface for authentication.
 * API contract correctness belongs to api-suite.
 * This suite tests what only a browser can verify:
 *   - Form behaviour and validation feedback
 *   - Navigation after login/logout
 *   - 2FA screen rendering and back navigation
 *   - Error message presentation
 *
 * Last updated: 2024-01-15
 */

import { test, expect } from '@playwright/test';

import { SEED_USERS, loginViaUI, resetMockServer } from '../../fixtures/index.js';
import { LoginPage, TwoFactorPage } from '../../pages/index.js';

test.describe('Auth — Login Flow', () => {
  test.beforeEach(async () => {
    await resetMockServer();
  });

  test('complete login + 2FA flow lands on trading page @smoke', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const twoFactorPage = new TwoFactorPage(page);

    await loginPage.goto();
    await loginPage.expectFormVisible();

    await loginPage.login(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    // Should transition to 2FA screen
    await twoFactorPage.expectVisible();

    await twoFactorPage.verify('123456');

    // Should land on trading page — nav should be visible
    await expect(page.getByTestId('nav-trading')).toBeVisible();
  });

  test('login without 2FA lands directly on trading page @smoke', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login(SEED_USERS.UNVERIFIED.email, SEED_USERS.UNVERIFIED.password);

    // No 2FA required — should go straight to trading
    await expect(page.getByTestId('nav-trading')).toBeVisible({ timeout: 10000 });
  });

  test('invalid credentials show error message @smoke', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login(SEED_USERS.VERIFIED.email, 'WrongPassword!');

    await loginPage.expectError();
    // Should stay on login page
    await loginPage.expectFormVisible();
  });

  test('empty email form validates required fields', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(loginPage.emailInput).toHaveAttribute('required');
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('empty password form validates required fields', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(loginPage.passwordInput).toHaveAttribute('required');
  });

  test('back button on 2FA screen returns to login form', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const twoFactorPage = new TwoFactorPage(page);

    await loginPage.goto();
    await loginPage.login(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    await twoFactorPage.expectVisible();
    await twoFactorPage.goBack();

    // Should return to login form
    await loginPage.expectFormVisible();
  });

  test('invalid 2FA code shows error and stays on 2FA screen', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const twoFactorPage = new TwoFactorPage(page);

    await loginPage.goto();
    await loginPage.login(SEED_USERS.VERIFIED.email, SEED_USERS.VERIFIED.password);

    await twoFactorPage.verify('999999');

    await twoFactorPage.expectError();
    await twoFactorPage.expectVisible(); // stays on 2FA
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Navigate directly to a protected page
    await page.goto('/');
    const loginPage = new LoginPage(page);
    await loginPage.expectFormVisible();
  });
});

test.describe('Auth — Logout', () => {
  test.beforeEach(async () => {
    await resetMockServer();
  });

  test('logout redirects to login page @smoke', async ({ page }) => {
    await loginViaUI(page);

    // Should be logged in
    await expect(page.getByTestId('nav-trading')).toBeVisible({ timeout: 15000 });

    // Click logout from nav
    await page.getByTestId('nav-logout').click();

    // Should redirect to login
    const loginPage = new LoginPage(page);
    await loginPage.expectFormVisible();
  });

  test('after logout, navigating back shows login form', async ({ page }) => {
    await loginViaUI(page);
    await expect(page.getByTestId('nav-trading')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('nav-logout').click();

    // Attempt to navigate to a protected page
    await page.goto('/');
    const loginPage = new LoginPage(page);
    await loginPage.expectFormVisible();
  });
});
