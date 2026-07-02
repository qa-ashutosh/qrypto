/**
 * @qrypto/e2e-suite — BasePage
 *
 * Common page interactions shared across all Page Object Models.
 * Every POM extends this class.
 *
 * Last updated: 2024-01-15
 */

import { type Page, type Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  async goto(path = '/'): Promise<void> {
    // base implementation
    await this.page.goto(path);
    await this.waitForLoad();
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  // ─── Nav Links ─────────────────────────────────────────────────────────────

  async navigateTo(page: 'trading' | 'wallet' | 'kyc' | 'account'): Promise<void> {
    await this.page.getByTestId(`nav-${page}`).waitFor({ state: 'visible', timeout: 15000 });
    await this.page.getByTestId(`nav-${page}`).click();
    await this.waitForLoad();
  }

  async logout(): Promise<void> {
    await this.page.getByTestId('nav-logout').click();
    await this.waitForLoad();
  }

  // ─── Error Detection ───────────────────────────────────────────────────────

  async getErrorMessage(testId: string): Promise<string> {
    const el = this.page.getByTestId(testId);
    await el.waitFor({ state: 'visible', timeout: 5000 });
    return (await el.textContent()) ?? '';
  }

  async expectNoError(testId: string): Promise<void> {
    await expect(this.page.getByTestId(testId)).not.toBeVisible();
  }

  async expectError(testId: string, text?: string): Promise<void> {
    const el = this.page.getByTestId(testId);
    await expect(el).toBeVisible();
    if (text) await expect(el).toContainText(text);
  }

  // ─── Loading States ────────────────────────────────────────────────────────

  async waitForElement(testId: string): Promise<Locator> {
    const el = this.page.getByTestId(testId);
    await el.waitFor({ state: 'visible' });
    return el;
  }

  async waitForElementHidden(testId: string): Promise<void> {
    await this.page.getByTestId(testId).waitFor({ state: 'hidden' });
  }

  // ─── Page Title ────────────────────────────────────────────────────────────

  async getPageTitle(): Promise<string> {
    return this.page.title();
  }

  // ─── Session Timeout Detection ─────────────────────────────────────────────

  async isOnLoginPage(): Promise<boolean> {
    return this.page
      .getByTestId('login-email')
      .isVisible()
      .catch(() => false);
  }

  async expectRedirectToLogin(): Promise<void> {
    await expect(this.page.getByTestId('login-email')).toBeVisible({ timeout: 10000 });
  }
}
