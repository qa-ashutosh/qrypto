/**
 * @qrypto/e2e-suite — LoginPage + TwoFactorPage
 *
 * Page Object Models for the authentication flow.
 *
 * Last updated: 2024-01-15
 */

import { type Page, expect } from '@playwright/test';

import { BasePage } from './BasePage.js';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ─── Locators ──────────────────────────────────────────────────────────────

  get emailInput() {
    return this.page.getByTestId('login-email');
  }

  get passwordInput() {
    return this.page.getByTestId('login-password');
  }

  get submitButton() {
    return this.page.getByTestId('login-submit');
  }

  get errorMessage() {
    return this.page.getByTestId('login-error');
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  override async goto(): Promise<void> {
    await this.page.goto('/');
    await this.waitForLoad();
    await expect(this.emailInput).toBeVisible();
  }

  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
    await this.waitForLoad();
  }

  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  async clickSeedUser(key: string): Promise<void> {
    await this.page.getByTestId(`seed-user-${key}`).click();
  }

  // ─── Assertions ────────────────────────────────────────────────────────────

  override async expectError(text?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (text) await expect(this.errorMessage).toContainText(text);
  }

  override async expectNoError(): Promise<void> {
    await expect(this.errorMessage).not.toBeVisible();
  }

  async expectFormVisible(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async expectSubmitDisabled(): Promise<void> {
    await expect(this.submitButton).toBeDisabled();
  }
}

export class TwoFactorPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ─── Locators ──────────────────────────────────────────────────────────────

  get codeInput() {
    return this.page.getByTestId('2fa-code');
  }

  get submitButton() {
    return this.page.getByTestId('2fa-submit');
  }

  get errorMessage() {
    return this.page.getByTestId('2fa-error');
  }

  get backButton() {
    return this.page.getByTestId('2fa-back');
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  async fillCode(code: string): Promise<void> {
    await this.codeInput.fill(code);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
    await this.waitForLoad();
  }

  async verify(code = '123456'): Promise<void> {
    await this.fillCode(code);
    await this.submit();
  }

  async goBack(): Promise<void> {
    await this.backButton.click();
    await this.waitForLoad();
  }

  // ─── Assertions ────────────────────────────────────────────────────────────

  async expectVisible(): Promise<void> {
    await expect(this.codeInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  override async expectError(text?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (text) await expect(this.errorMessage).toContainText(text);
  }
}
