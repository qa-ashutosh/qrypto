/**
 * @qrypto/e2e-suite — AccountPage
 * Last updated: 2024-01-15
 */

import { type Page, expect } from '@playwright/test';

import { BasePage } from './BasePage.js';

export class AccountPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get logoutButton() {
    return this.page.getByTestId('logout-btn');
  }

  get twoFactorStatus() {
    return this.page.getByTestId('2fa-status');
  }

  sessionRow(sessionId: string) {
    return this.page.getByTestId(`session-row-${sessionId}`);
  }

  revokeButton(sessionId: string) {
    return this.page.getByTestId(`revoke-${sessionId}`);
  }

  get sessionsError() {
    return this.page.getByTestId('sessions-error');
  }

  override async goto(): Promise<void> {
    await this.navigateTo('account');
    await this.waitForLoad();
  }

  async clickLogout(): Promise<void> {
    await this.logoutButton.click();
    await this.waitForLoad();
  }

  async expect2faEnabled(): Promise<void> {
    await expect(this.twoFactorStatus).toContainText('Enabled', { ignoreCase: true });
  }

  async expectLogoutButtonVisible(): Promise<void> {
    await expect(this.logoutButton).toBeVisible();
  }
}
