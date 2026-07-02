/**
 * @qrypto/e2e-suite — KycPage
 * Last updated: 2024-01-15
 */

import { type Page, expect } from '@playwright/test';

import { BasePage } from './BasePage.js';

export class KycPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get documentTypeSelect() {
    return this.page.getByTestId('kyc-document-type');
  }

  get submitButton() {
    return this.page.getByTestId('kyc-submit');
  }

  get statusDisplay() {
    return this.page.getByTestId('kyc-status');
  }

  get errorMessage() {
    return this.page.getByTestId('kyc-error');
  }

  get successMessage() {
    return this.page.getByTestId('kyc-success');
  }

  override async goto(): Promise<void> {
    await this.navigateTo('kyc');
    await expect(this.statusDisplay).toBeVisible();
  }

  async selectDocumentType(type: string): Promise<void> {
    await this.documentTypeSelect.selectOption(type);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
    await this.waitForLoad();
  }

  async submitKyc(documentType = 'passport'): Promise<void> {
    await this.selectDocumentType(documentType);
    await this.submit();
  }

  async getStatus(): Promise<string> {
    return (await this.statusDisplay.textContent()) ?? '';
  }

  async expectStatus(status: string): Promise<void> {
    await expect(this.statusDisplay).toContainText(status, { ignoreCase: true });
  }

  async expectSubmitVisible(): Promise<void> {
    await expect(this.submitButton).toBeVisible();
  }

  async expectSubmitHidden(): Promise<void> {
    await expect(this.submitButton).not.toBeVisible();
  }
}
